/**
 * OAuth Controller
 * Handles OAuth flow initiation and callbacks for connector integrations
 */

import { Router, Request, Response } from "express";
import { authenticate } from "../../auth";
import { CONNECTOR_REGISTRY, getConnector } from "../../connectors/registry";
import { createIntegration, updateIntegrationCredentials } from "../services/integration.service";
import { logAuditEvent } from "../../audit-service";
import crypto from "crypto";

const router = Router();

// Store OAuth state temporarily (in production, use Redis)
const oauthStateStore = new Map<string, { tenantId: string; connectorId: string; expiresAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.expiresAt < now) {
      oauthStateStore.delete(state);
    }
  }
}, 5 * 60 * 1000);

/**
 * Start OAuth flow - redirect user to provider auth URL
 * GET /api/oauth/start/:connectorId
 */
router.get("/start/:connectorId", authenticate, async (req: Request, res: Response) => {
  try {
    const connectorId = req.params.connectorId;
    const connector = getConnector(connectorId);

    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    if (!connector.oauthEnabled) {
      return res.status(400).json({ error: "Connector does not support OAuth" });
    }

    // Get tenant ID from authenticated user (never trust client)
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Generate secure state token (CSRF protection + tenant mapping)
    const stateNonce = crypto.randomBytes(32).toString("hex");
    const state = Buffer.from(
      JSON.stringify({
        t: tenantId,
        c: connectorId,
        n: stateNonce,
        ts: Date.now(),
      })
    ).toString("base64url");

    // Store state server-side (in production, use Redis with TTL)
    oauthStateStore.set(state, {
      tenantId,
      connectorId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Build OAuth URL
    const clientIdEnv = `OAUTH_${connectorId.toUpperCase().replace(/-/g, "_")}_CLIENT_ID`;
    const clientId = process.env[clientIdEnv];
    
    if (!clientId) {
      return res.status(500).json({ 
        error: `OAuth client ID not configured for ${connectorId}`,
        hint: `Set ${clientIdEnv} environment variable`
      });
    }

    const redirectUri = `${process.env.APP_BASE_URL || "http://localhost:5000"}/api/oauth/callback/${connectorId}`;
    const scopes = connector.oauthScopes || [];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline", // Request refresh token
      prompt: "consent", // Force consent screen
      state,
    });

    const authUrl = `${connector.oauthAuthUrl}?${params.toString()}`;

    // Log OAuth initiation
    await logAuditEvent({
      tenantId,
      userId: (req as any).user?.id,
      action: "oauth_initiated",
      resource: `connector:${connectorId}`,
      details: { connectorId },
    });

    res.redirect(authUrl);
  } catch (error: any) {
    console.error("OAuth start error:", error);
    res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

/**
 * OAuth callback - handle provider redirect with code
 * GET /api/oauth/callback/:connectorId
 */
router.get("/callback/:connectorId", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    const connectorId = req.params.connectorId;

    if (error) {
      return res.status(400).send(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state parameter");
    }

    // Verify state
    let stateData;
    try {
      const decoded = Buffer.from(state as string, "base64url").toString("utf8");
      const parsed = JSON.parse(decoded);
      stateData = oauthStateStore.get(state as string);
      
      if (!stateData || stateData.connectorId !== connectorId) {
        return res.status(400).send("Invalid or expired state token");
      }

      // Clean up used state
      oauthStateStore.delete(state as string);
    } catch (e) {
      return res.status(400).send("Invalid state token");
    }

    const connector = getConnector(connectorId);
    if (!connector || !connector.oauthEnabled) {
      return res.status(404).send("Connector not found or OAuth not supported");
    }

    // Exchange code for tokens
    const clientIdEnv = `OAUTH_${connectorId.toUpperCase().replace(/-/g, "_")}_CLIENT_ID`;
    const clientSecretEnv = `OAUTH_${connectorId.toUpperCase().replace(/-/g, "_")}_CLIENT_SECRET`;
    const clientId = process.env[clientIdEnv];
    const clientSecret = process.env[clientSecretEnv];

    if (!clientId || !clientSecret) {
      return res.status(500).send("OAuth credentials not configured");
    }

    const redirectUri = `${process.env.APP_BASE_URL || "http://localhost:5000"}/api/oauth/callback/${connectorId}`;

    const tokenResponse = await fetch(connector.oauthTokenUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return res.status(500).send("Failed to exchange authorization code for tokens");
    }

    const tokenData = await tokenResponse.json();

    // Save integration with encrypted credentials
    // Note: In production, extract user ID from session or token
    const integration = await createIntegration(
      stateData.tenantId,
      connectorId,
      {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
      },
      {
        webhook_secret: crypto.randomBytes(32).toString("hex"), // Generate webhook secret
        oauth_provider: connectorId,
      }
    );

    // Log successful connection
    await logAuditEvent({
      tenantId: stateData.tenantId,
      userId: null, // OAuth callback doesn't have user context
      action: "integration_connected",
      resource: `integration:${integration.id}`,
      details: { connectorId, integrationId: integration.id },
    });

    // Redirect to success page or return JSON
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5000";
    res.redirect(`${frontendUrl}/integrations?connected=${connectorId}`);
  } catch (error: any) {
    console.error("OAuth callback error:", error);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;

