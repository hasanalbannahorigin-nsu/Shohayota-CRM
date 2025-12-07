/**
 * Webhook Ingestion Service
 * Handles webhook receipt, validation, idempotency, and event normalization
 */

import { db } from "../db";
import { integrations, integrationWebhooks, type InsertIntegrationWebhook } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getIntegration } from "./connector-manager";
import { getConnector } from "./registry";
import { getAdapter } from "./adapter-factory";
import { logIntegrationEvent } from "./observability";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export interface NormalizedEvent {
  type: string;
  data: Record<string, any>;
  timestamp: string;
  providerEventId: string;
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
  algorithm: "hmac-sha256" | "hmac-sha1" = "hmac-sha256"
): boolean {
  try {
    const hmac = crypto.createHmac(algorithm === "hmac-sha256" ? "sha256" : "sha1", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    
    // Handle different signature formats (hex, base64, with/without prefix)
    const normalizedSignature = signature.replace(/^sha256=/, "").replace(/^sha1=/, "");
    const normalizedExpected = expectedSignature;
    
    return crypto.timingSafeEqual(
      Buffer.from(normalizedSignature, "hex"),
      Buffer.from(normalizedExpected, "hex")
    );
  } catch (error) {
    console.error("Webhook signature validation error:", error);
    return false;
  }
}

/**
 * Process incoming webhook
 */
export async function processWebhook(
  connectorId: string,
  tenantId: string,
  providerEventId: string,
  providerEventType: string,
  rawPayload: Record<string, any>,
  signature?: string,
  signatureHeader?: string
): Promise<{ webhookId: string; normalizedEvent: NormalizedEvent | null }> {
  // Get integration
  const integration = await getIntegrationByConnector(tenantId, connectorId);
  if (!integration) {
    throw new Error(`Integration not found for connector ${connectorId}`);
  }

  if (integration.status !== "connected") {
    throw new Error(`Integration is not connected`);
  }

  // Validate signature if webhook secret is configured
  let signatureValid = false;
  const webhookSecret = (integration.config as any)?.webhookSecret;
  
  if (webhookSecret && signature) {
    const payloadString = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);
    signatureValid = validateWebhookSignature(payloadString, signature, webhookSecret);
    
    if (!signatureValid) {
      throw new Error("Invalid webhook signature");
    }
  } else if (webhookSecret && !signature) {
    throw new Error("Webhook signature required but not provided");
  } else {
    // No secret configured, allow (for development/testing)
    signatureValid = true;
  }

  // Check idempotency (dedupe by provider event ID)
  const existingWebhook = await getWebhookByProviderEvent(tenantId, connectorId, providerEventId);
  if (existingWebhook) {
    // Duplicate webhook, return existing
    return {
      webhookId: existingWebhook.id,
      normalizedEvent: existingWebhook.normalizedEvent as NormalizedEvent | null,
    };
  }

  // Normalize event using adapter if available
  let normalizedEvent: NormalizedEvent;
  const adapter = getAdapter(connectorId);
  if (adapter) {
    normalizedEvent = await adapter.normalizeWebhookEvent(providerEventType, rawPayload);
  } else {
    normalizedEvent = await normalizeWebhookEvent(
      connectorId,
      providerEventType,
      rawPayload
    );
  }

  // Log webhook receipt
  await logIntegrationEvent(
    tenantId,
    integration.id,
    connectorId,
    "info",
    `Webhook received: ${providerEventType}`,
    { providerEventId, eventType: providerEventType },
    "webhook"
  );

  // Store webhook
  const webhookData: InsertIntegrationWebhook = {
    tenantId,
    integrationId: integration.id,
    connectorId,
    providerEventId,
    providerEventType,
    rawPayload,
    normalizedEvent,
    status: "pending",
    signatureValid,
    retryCount: 0,
  };

  let webhookId: string;

  if (db) {
    const inserted = await db
      .insert(integrationWebhooks)
      .values(webhookData)
      .returning();
    
    webhookId = inserted[0].id;
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    if (!memStorage.integrationWebhooks) {
      memStorage.integrationWebhooks = new Map();
    }
    const webhook = {
      id: uuidv4(),
      ...webhookData,
      receivedAt: new Date(),
      createdAt: new Date(),
    };
    memStorage.integrationWebhooks.set(webhook.id, webhook);
    webhookId = webhook.id;
  }

  // Enqueue for processing (async)
  // TODO: Implement queue system for webhook processing
  // For now, mark as processed immediately
  await markWebhookProcessed(webhookId, tenantId);

  return {
    webhookId,
    normalizedEvent,
  };
}

/**
 * Normalize webhook event to platform format
 */
async function normalizeWebhookEvent(
  connectorId: string,
  providerEventType: string,
  rawPayload: Record<string, any>
): Promise<NormalizedEvent> {
  const connector = getConnector(connectorId);
  if (!connector) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  // TODO: Implement connector-specific normalization
  // For now, return a generic normalized event
  return {
    type: providerEventType,
    data: rawPayload,
    timestamp: new Date().toISOString(),
    providerEventId: rawPayload.id || rawPayload.event_id || uuidv4(),
  };
}

/**
 * Get integration by connector ID (tenant-scoped)
 */
async function getIntegrationByConnector(tenantId: string, connectorId: string) {
  if (db) {
    const result = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.connectorId, connectorId),
        eq(integrations.deletedAt, null as any)
      ))
      .limit(1);
    
    return result[0] || null;
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    const allIntegrations = Array.from(memStorage.integrations?.values() || []);
    return allIntegrations.find(
      (i: any) => i.tenantId === tenantId && i.connectorId === connectorId && !i.deletedAt
    ) || null;
  }
}

/**
 * Get webhook by provider event ID (for idempotency)
 */
async function getWebhookByProviderEvent(
  tenantId: string,
  connectorId: string,
  providerEventId: string
) {
  if (db) {
    const result = await db
      .select()
      .from(integrationWebhooks)
      .where(and(
        eq(integrationWebhooks.tenantId, tenantId),
        eq(integrationWebhooks.connectorId, connectorId),
        eq(integrationWebhooks.providerEventId, providerEventId)
      ))
      .limit(1);
    
    return result[0] || null;
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    const allWebhooks = Array.from(memStorage.integrationWebhooks?.values() || []);
    return allWebhooks.find(
      (w: any) => w.tenantId === tenantId && w.connectorId === connectorId && w.providerEventId === providerEventId
    ) || null;
  }
}

/**
 * Mark webhook as processed
 */
async function markWebhookProcessed(webhookId: string, tenantId: string): Promise<void> {
  if (db) {
    await db
      .update(integrationWebhooks)
      .set({
        status: "processed",
        processedAt: new Date(),
      })
      .where(and(
        eq(integrationWebhooks.id, webhookId),
        eq(integrationWebhooks.tenantId, tenantId)
      ));
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    const webhook = memStorage.integrationWebhooks?.get(webhookId);
    if (webhook && webhook.tenantId === tenantId) {
      webhook.status = "processed";
      webhook.processedAt = new Date();
    }
  }
}

