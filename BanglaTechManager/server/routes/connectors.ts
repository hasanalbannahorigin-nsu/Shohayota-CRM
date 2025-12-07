/**
 * Connector Framework API Routes
 * Handles connector management, OAuth flows, webhooks, and integration operations
 */

import { Express } from "express";
import { authenticate, requireRole } from "../auth";
import {
  getActiveConnectors,
  getConnector,
  CONNECTOR_REGISTRY,
} from "../connectors/registry";
import {
  connectIntegration,
  disconnectIntegration,
  getIntegration,
  getTenantIntegrations,
  testIntegrationConnection,
  refreshIntegrationTokens,
  generateOAuthState,
  validateOAuthState,
} from "../connectors/connector-manager";
import { processWebhook } from "../connectors/webhook-service";
import { logAuditEvent } from "../audit-service";
import { decryptCredentials } from "../encryption-service";
import { exchangeOAuthCode } from "../connectors/oauth-handlers";

const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || "http://localhost:5000/api/connectors/oauth/callback";

export function registerConnectorRoutes(app: Express): void {
  // ==================== Connector Catalog ====================
  
  // GET /api/connectors - List available connectors
  app.get("/api/connectors", authenticate, async (req, res) => {
    try {
      const connectors = getActiveConnectors();
      res.json(connectors.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        description: c.description,
        category: c.category,
        icon: c.icon,
        oauthEnabled: c.oauthEnabled,
        apiKeyRequired: c.apiKeyRequired,
        webhookSupported: c.webhookSupported,
        capabilities: c.capabilities,
        oauthScopes: c.oauthScopes,
        status: c.status,
      })));
    } catch (error: any) {
      console.error("Error fetching connectors:", error);
      res.status(500).json({ error: error.message || "Failed to fetch connectors" });
    }
  });

  // GET /api/connectors/:id - Get connector details
  app.get("/api/connectors/:id", authenticate, async (req, res) => {
    try {
      const connector = getConnector(req.params.id);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }
      res.json(connector);
    } catch (error: any) {
      console.error("Error fetching connector:", error);
      res.status(500).json({ error: error.message || "Failed to fetch connector" });
    }
  });

  // ==================== Integration Management ====================
  
  // GET /api/integrations - List tenant integrations
  app.get("/api/integrations", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integrations = await getTenantIntegrations(tenantId);
      
      // Enrich with connector info
      const enriched = integrations.map((integration) => {
        const connector = getConnector(integration.connectorId);
        return {
          ...integration,
          connector: connector ? {
            id: connector.id,
            displayName: connector.displayName,
            icon: connector.icon,
            category: connector.category,
          } : null,
        };
      });
      
      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: error.message || "Failed to fetch integrations" });
    }
  });

  // GET /api/integrations/:id - Get integration details
  app.get("/api/integrations/:id", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integration = await getIntegration(req.params.id, tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const connector = getConnector(integration.connectorId);
      
      res.json({
        ...integration,
        connector: connector ? {
          id: connector.id,
          displayName: connector.displayName,
          icon: connector.icon,
          category: connector.category,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching integration:", error);
      res.status(500).json({ error: error.message || "Failed to fetch integration" });
    }
  });

  // POST /api/integrations - Create/connect integration
  app.post("/api/integrations", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { connectorId, credentials, config } = req.body;

      if (!connectorId) {
        return res.status(400).json({ error: "connectorId is required" });
      }

      const connector = getConnector(connectorId);
      if (!connector) {
        return res.status(404).json({ error: "Connector not found" });
      }

      // Handle OAuth flow
      if (connector.oauthEnabled && !credentials) {
        // Initiate OAuth flow
        const stateToken = generateOAuthState(
          tenantId,
          connectorId,
          req.user!.id,
          req.body.redirectUrl
        );

        const authUrl = new URL(connector.oauthAuthUrl!);
        authUrl.searchParams.set("client_id", process.env[`${connectorId.toUpperCase()}_CLIENT_ID`] || "");
        authUrl.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", connector.oauthScopes?.join(" ") || "");
        authUrl.searchParams.set("state", stateToken);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        return res.json({
          oauthUrl: authUrl.toString(),
          stateToken,
        });
      }

      // Direct credential connection (API key, etc.)
      if (!credentials) {
        return res.status(400).json({ error: "credentials are required for non-OAuth connectors" });
      }

      const integration = await connectIntegration(
        tenantId,
        connectorId,
        req.user!.id,
        credentials,
        config,
        req.ip,
        req.headers["user-agent"]
      );

      res.status(201).json(integration);
    } catch (error: any) {
      console.error("Error creating integration:", error);
      res.status(500).json({ error: error.message || "Failed to create integration" });
    }
  });

  // POST /api/integrations/:id/revoke - Disconnect integration
  app.post("/api/integrations/:id/revoke", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      await disconnectIntegration(
        req.params.id,
        tenantId,
        req.user!.id,
        req.ip,
        req.headers["user-agent"]
      );

      res.json({ success: true, message: "Integration disconnected" });
    } catch (error: any) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect integration" });
    }
  });

  // POST /api/integrations/:id/test - Test connection
  app.post("/api/integrations/:id/test", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const success = await testIntegrationConnection(req.params.id, tenantId);
      
      res.json({ success, message: "Connection test successful" });
    } catch (error: any) {
      console.error("Error testing integration:", error);
      res.status(500).json({ error: error.message || "Connection test failed" });
    }
  });

  // POST /api/integrations/:id/refresh - Refresh tokens
  app.post("/api/integrations/:id/refresh", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      await refreshIntegrationTokens(req.params.id, tenantId);
      
      res.json({ success: true, message: "Tokens refreshed" });
    } catch (error: any) {
      console.error("Error refreshing tokens:", error);
      res.status(500).json({ error: error.message || "Failed to refresh tokens" });
    }
  });

  // POST /api/integrations/:id/mapping - Update field mapping
  app.post("/api/integrations/:id/mapping", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integration = await getIntegration(req.params.id, tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const { mappings } = req.body;
      // TODO: Implement mapping update logic
      
      res.json({ success: true, message: "Mapping updated" });
    } catch (error: any) {
      console.error("Error updating mapping:", error);
      res.status(500).json({ error: error.message || "Failed to update mapping" });
    }
  });

  // POST /api/integrations/:id/sync - Trigger manual sync
  app.post("/api/integrations/:id/sync", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { direction, syncType } = req.body;
      
      const { createSyncJob } = await import("../connectors/sync-worker");
      const jobId = await createSyncJob(req.params.id, tenantId, {
        direction: direction || "inbound",
        syncType: syncType || "incremental",
      });
      
      res.json({ success: true, jobId, message: "Sync job queued" });
    } catch (error: any) {
      console.error("Error triggering sync:", error);
      res.status(500).json({ error: error.message || "Failed to trigger sync" });
    }
  });

  // POST /api/integrations/:id/simulate - Simulate webhook (test mode)
  app.post("/api/integrations/:id/simulate", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integration = await getIntegration(req.params.id, tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const config = integration.config as any;
      if (!config?.testMode) {
        return res.status(400).json({ error: "Integration is not in test mode" });
      }

      const { eventType, data } = req.body;
      const { simulateWebhook, generateMockWebhook } = await import("../connectors/mock-service");
      
      const payload = data || generateMockWebhook(integration.connectorId, eventType || "test");
      simulateWebhook(integration.id, tenantId, payload);

      // Process the simulated webhook
      const { processWebhook } = await import("../connectors/webhook-service");
      await processWebhook(
        integration.connectorId,
        tenantId,
        `mock_${Date.now()}`,
        payload.eventType || eventType || "test",
        payload.data || payload,
        undefined,
        undefined
      );

      res.json({ success: true, message: "Webhook simulated" });
    } catch (error: any) {
      console.error("Error simulating webhook:", error);
      res.status(500).json({ error: error.message || "Failed to simulate webhook" });
    }
  });

  // GET /api/integrations/:id/logs - Get integration logs
  app.get("/api/integrations/:id/logs", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integration = await getIntegration(req.params.id, tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const { getIntegrationLogs } = await import("../connectors/observability");
      const logs = await getIntegrationLogs(req.params.id, tenantId, 100);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch logs" });
    }
  });

  // GET /api/integrations/:id/metrics - Get integration metrics
  app.get("/api/integrations/:id/metrics", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const integration = await getIntegration(req.params.id, tenantId);
      
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const { getIntegrationMetrics, checkIntegrationHealth } = await import("../connectors/observability");
      const metrics = await getIntegrationMetrics(req.params.id, tenantId);
      const health = await checkIntegrationHealth(req.params.id, tenantId);
      
      res.json({ metrics, health });
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: error.message || "Failed to fetch metrics" });
    }
  });

  // ==================== OAuth Callback ====================
  
  // GET /api/connectors/oauth/callback - OAuth callback handler
  app.get("/api/connectors/oauth/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`/integrations?error=${encodeURIComponent(error as string)}`);
      }

      if (!code || !state) {
        return res.redirect("/integrations?error=missing_parameters");
      }

      const oauthState = validateOAuthState(state as string);
      if (!oauthState) {
        return res.redirect("/integrations?error=invalid_state");
      }

      const connector = getConnector(oauthState.connectorId);
      if (!connector || !connector.oauthEnabled) {
        return res.redirect("/integrations?error=invalid_connector");
      }

      // Exchange code for tokens
      const tokenResponse = await exchangeOAuthCode(
        oauthState.connectorId,
        code as string,
        oauthState.tenantId
      );

      // Create integration
      await connectIntegration(
        oauthState.tenantId,
        oauthState.connectorId,
        oauthState.userId,
        {
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          expires_in: tokenResponse.expires_in,
        },
        undefined,
        req.ip,
        req.headers["user-agent"]
      );

      res.redirect(oauthState.redirectUrl || "/integrations?success=true");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`/integrations?error=${encodeURIComponent(error.message)}`);
    }
  });

  // ==================== Webhook Endpoints ====================
  
  // POST /api/webhooks/:connectorId/:webhookSecret - Public webhook receiver
  app.post("/api/webhooks/:connectorId/:webhookSecret", async (req, res) => {
    try {
      const { connectorId, webhookSecret } = req.params;
      
      // Find integration by webhook secret
      // TODO: Implement webhook secret lookup
      const tenantId = ""; // Lookup from webhookSecret
      
      if (!tenantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const rawBody = req.body;
      const signature = req.headers["x-signature"] || req.headers["x-hub-signature-256"] || req.headers["authorization"];
      
      const providerEventId = rawBody.id || rawBody.event_id || rawBody.message_id || `${Date.now()}`;
      const providerEventType = rawBody.type || rawBody.event || rawBody.event_type || "unknown";

      await processWebhook(
        connectorId,
        tenantId,
        providerEventId,
        providerEventType,
        rawBody,
        signature as string,
        req.headers["x-signature-header"] as string
      );

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });
}


