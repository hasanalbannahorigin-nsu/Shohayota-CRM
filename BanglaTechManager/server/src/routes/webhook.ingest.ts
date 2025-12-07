/**
 * Webhook Ingestion Endpoint
 * Unified endpoint to receive provider webhooks, validate signatures, and process events
 */

import { Router, Request, Response } from "express";
import express from "express";
import { db } from "../../db";
import { integrations, integrationWebhooks } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getIntegrationWithCredentials } from "../services/integration.service";
import { getAdapter } from "../../connectors/adapter-factory";
import { logIntegrationEvent } from "../../connectors/observability";
import crypto from "crypto";

const router = Router();

/**
 * Unified webhook receiver
 * POST /api/webhooks/:connectorId/:webhookSecret
 * 
 * Pattern: /api/webhooks/{connector}/{tenantWebhookSecret}
 * The webhook secret is tenant-specific and stored in integration config
 */
router.post("/:connectorId/:webhookSecret", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
  try {
    const connectorId = req.params.connectorId;
    const webhookSecret = req.params.webhookSecret;

    // Find integration by connector and webhook secret
    const allIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.connectorId, connectorId));

    // Find integration with matching webhook secret
    let integration = null;
    for (const int of allIntegrations) {
      const config = (int.config as any) || {};
      if (config.webhook_secret === webhookSecret) {
        integration = int;
        break;
      }
    }

    if (!integration) {
      return res.status(404).json({ error: "Integration not found or invalid webhook secret" });
    }

    // Get integration with decrypted credentials
    const integrationWithCreds = await getIntegrationWithCredentials(integration.id);
    if (!integrationWithCreds || !integrationWithCreds.credentials) {
      return res.status(500).json({ error: "Failed to load integration credentials" });
    }

    // Validate webhook signature (provider-specific)
    const signatureValid = await validateWebhookSignature(
      connectorId,
      req.body,
      req.headers,
      webhookSecret
    );

    // Extract provider event ID for deduplication
    const providerEventId = extractProviderEventId(connectorId, req.body, req.headers);

    // Check for duplicate event (idempotency)
    const existingWebhook = await db
      .select()
      .from(integrationWebhooks)
      .where(
        and(
          eq(integrationWebhooks.tenantId, integration.tenantId),
          eq(integrationWebhooks.connectorId, connectorId),
          eq(integrationWebhooks.providerEventId, providerEventId)
        )
      )
      .limit(1);

    if (existingWebhook.length > 0) {
      // Duplicate - return success but don't process again
      return res.status(200).json({ 
        ok: true, 
        delivered: 0, 
        duplicate: true,
        message: "Event already processed" 
      });
    }

    // Store webhook event
    const [webhookEvent] = await db
      .insert(integrationWebhooks)
      .values({
        tenantId: integration.tenantId,
        integrationId: integration.id,
        connectorId,
        providerEventId,
        providerEventType: extractEventType(connectorId, req.body),
        rawPayload: req.body,
        signatureValid,
        status: "pending",
      })
      .returning();

    // Use adapter to normalize webhook payload
    let normalizedEvents = [];
    try {
      const adapter = getAdapter(connectorId);
      if (adapter && adapter.normalizeWebhookEvent) {
        const eventType = extractEventType(connectorId, req.body);
        const normalized = await adapter.normalizeWebhookEvent(eventType, req.body);
        normalizedEvents = [{
          type: normalized.type,
          providerId: providerEventId,
          data: normalized.data,
          timestamp: normalized.timestamp,
        }];
      } else {
        // Fallback: create generic normalized event
        normalizedEvents = [{
          type: `${connectorId}.webhook`,
          providerId: providerEventId,
          data: req.body,
          timestamp: new Date().toISOString(),
        }];
      }
    } catch (error: any) {
      console.error(`Error normalizing webhook for ${connectorId}:`, error);
      // Still store the webhook, but mark as failed
      await db
        .update(integrationWebhooks)
        .set({
          status: "failed",
          errorMessage: error.message,
        })
        .where(eq(integrationWebhooks.id, webhookEvent.id));

      return res.status(500).json({ 
        error: "Failed to process webhook",
        webhookId: webhookEvent.id 
      });
    }

    // Update webhook event with normalized data
    if (normalizedEvents.length > 0) {
      await db
        .update(integrationWebhooks)
        .set({
          normalizedEvent: normalizedEvents,
          status: "processed",
          processedAt: new Date(),
        })
        .where(eq(integrationWebhooks.id, webhookEvent.id));
    }

    // Log webhook receipt
    await logIntegrationEvent({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      connectorId,
      level: "info",
      message: `Webhook received: ${providerEventId}`,
      details: {
        eventType: extractEventType(connectorId, req.body),
        eventsCount: normalizedEvents.length,
      },
    });

    // TODO: Enqueue normalized events for processing by automation engine
    // For now, just return success
    // await enqueueWebhookProcessing(integration.tenantId, integration.id, normalizedEvents);

    res.status(200).json({
      ok: true,
      delivered: normalizedEvents.length,
      webhookId: webhookEvent.id,
    });
  } catch (error: any) {
    console.error("Webhook ingestion error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Validate webhook signature (provider-specific)
 */
async function validateWebhookSignature(
  connectorId: string,
  body: any,
  headers: any,
  secret: string
): Promise<boolean> {
  try {
    switch (connectorId) {
      case "stripe":
        // Stripe signature validation
        const stripeSig = headers["stripe-signature"];
        if (!stripeSig) return false;
        // Implement Stripe signature verification
        // For now, return true if signature header exists
        return !!stripeSig;

      case "github":
        // GitHub signature validation
        const githubSig = headers["x-hub-signature-256"];
        if (!githubSig) return false;
        const payload = JSON.stringify(body);
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(payload);
        const calculatedSig = `sha256=${hmac.digest("hex")}`;
        return crypto.timingSafeEqual(
          Buffer.from(githubSig),
          Buffer.from(calculatedSig)
        );

      case "slack":
        // Slack signature validation
        const slackSig = headers["x-slack-signature"];
        const slackTimestamp = headers["x-slack-request-timestamp"];
        if (!slackSig || !slackTimestamp) return false;
        const slackPayload = JSON.stringify(body);
        const slackBaseString = `v0:${slackTimestamp}:${slackPayload}`;
        const slackHmac = crypto.createHmac("sha256", secret);
        slackHmac.update(slackBaseString);
        const slackCalculatedSig = `v0=${slackHmac.digest("hex")}`;
        return crypto.timingSafeEqual(
          Buffer.from(slackSig),
          Buffer.from(slackCalculatedSig)
        );

      default:
        // For connectors without signature validation, require webhook secret match
        return true;
    }
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
}

/**
 * Extract provider event ID for deduplication
 */
function extractProviderEventId(connectorId: string, body: any, headers: any): string {
  // Provider-specific event ID extraction
  switch (connectorId) {
    case "stripe":
      return body?.id || body?.event?.id || `stripe_${Date.now()}`;
    case "github":
      return headers["x-github-delivery"] || `github_${Date.now()}`;
    case "slack":
      return body?.event_id || headers["x-slack-request-timestamp"] || `slack_${Date.now()}`;
    default:
      return body?.id || body?.eventId || body?.messageId || `event_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Extract event type from webhook payload
 */
function extractEventType(connectorId: string, body: any): string {
  switch (connectorId) {
    case "stripe":
      return body?.type || "unknown";
    case "github":
      return body?.action || body?.event || "unknown";
    case "slack":
      return body?.type || body?.event?.type || "unknown";
    default:
      return body?.type || body?.eventType || "webhook";
  }
}

export default router;

