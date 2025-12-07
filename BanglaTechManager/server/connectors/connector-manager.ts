/**
 * Connector Manager Service
 * Handles connect/disconnect flows, token lifecycle, credential encryption, health checks
 */

import { storage } from "../storage";
import { db } from "../db";
import { integrations, connectors, type Integration, type InsertIntegration } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../encryption-service";
import { logAuditEvent } from "../audit-service";
import { getConnector } from "./registry";
import { getAdapter } from "./adapter-factory";
import { v4 as uuidv4 } from "uuid";

export interface OAuthState {
  tenantId: string;
  connectorId: string;
  userId: string;
  stateToken: string;
  redirectUrl?: string;
}

// In-memory OAuth state store (use Redis in production)
const oauthStateStore = new Map<string, OAuthState>();

/**
 * Generate OAuth state token for CSRF protection
 */
export function generateOAuthState(tenantId: string, connectorId: string, userId: string, redirectUrl?: string): string {
  const stateToken = uuidv4();
  oauthStateStore.set(stateToken, {
    tenantId,
    connectorId,
    userId,
    stateToken,
    redirectUrl,
  });
  
  // Expire after 10 minutes
  setTimeout(() => {
    oauthStateStore.delete(stateToken);
  }, 10 * 60 * 1000);
  
  return stateToken;
}

/**
 * Validate and consume OAuth state token
 */
export function validateOAuthState(stateToken: string): OAuthState | null {
  const state = oauthStateStore.get(stateToken);
  if (!state) {
    return null;
  }
  oauthStateStore.delete(stateToken); // Consume token
  return state;
}

/**
 * Create integration (connect connector)
 */
export async function connectIntegration(
  tenantId: string,
  connectorId: string,
  userId: string,
  credentials: Record<string, any>,
  config?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<Integration> {
  const connector = getConnector(connectorId);
  if (!connector) {
    throw new Error(`Connector ${connectorId} not found`);
  }

  if (connector.status !== "active") {
    throw new Error(`Connector ${connectorId} is not available`);
  }

  // Encrypt credentials
  const encryptedCredentialsRef = await encryptCredentials(tenantId, connectorId, credentials);

  // Check if integration already exists
  let existingIntegration: Integration | null = null;
  
  if (db) {
    const existing = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.connectorId, connectorId),
        eq(integrations.deletedAt, null as any)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      existingIntegration = existing[0];
    }
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const allIntegrations = Array.from(memStorage.integrations?.values() || []);
    existingIntegration = allIntegrations.find(
      (i: any) => i.tenantId === tenantId && i.connectorId === connectorId && !i.deletedAt
    ) || null;
  }

  const integrationData: InsertIntegration = {
    tenantId,
    connectorId,
    displayName: config?.displayName || connector.displayName,
    encryptedCredentialsRef,
    config: {
      ...config,
      syncSettings: config?.syncSettings || {
        enabled: true,
        direction: connector.capabilities.bidirectional ? "bidirectional" : connector.capabilities.inbound ? "inbound" : "outbound",
      },
      testMode: config?.testMode || false,
    },
    status: "connected",
    tokenScopes: connector.oauthScopes || [],
    createdBy: userId,
  };

  let integration: Integration;

  if (existingIntegration) {
    // Update existing integration
    if (db) {
      const updated = await db
        .update(integrations)
        .set({
          encryptedCredentialsRef,
          config: integrationData.config,
          status: "connected",
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existingIntegration.id))
        .returning();
      
      integration = updated[0];
    } else {
      // In-memory mode
      const memStorage = storage as any;
      existingIntegration.encryptedCredentialsRef = encryptedCredentialsRef;
      existingIntegration.config = integrationData.config;
      existingIntegration.status = "connected";
      existingIntegration.updatedAt = new Date();
      integration = existingIntegration;
    }
  } else {
    // Create new integration
    if (db) {
      const created = await db
        .insert(integrations)
        .values(integrationData)
        .returning();
      
      integration = created[0];
    } else {
      // In-memory mode
      const memStorage = storage as any;
      const newIntegration: Integration = {
        id: uuidv4(),
        ...integrationData,
        lastSyncAt: null,
        lastEventAt: null,
        lastError: null,
        lastErrorAt: null,
        tokenExpiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      if (!memStorage.integrations) {
        memStorage.integrations = new Map();
      }
      memStorage.integrations.set(newIntegration.id, newIntegration);
      integration = newIntegration;
    }
  }

  // Run health check (skip in test mode)
  if (!(integrationData.config as any)?.testMode) {
    try {
      await testIntegrationConnection(integration.id, tenantId);
    } catch (error: any) {
      // Mark as error but don't fail the connection
      await updateIntegrationStatus(integration.id, tenantId, "error", error.message);
    }
  }

  // Log audit
  await logAuditEvent({
    tenantId,
    userId,
    action: existingIntegration ? "update" : "create",
    resourceType: "integration",
    resourceId: integration.id,
    details: {
      connectorId,
      action: "connect",
    },
    ipAddress,
    userAgent,
  });

  return integration;
}

/**
 * Disconnect integration
 */
export async function disconnectIntegration(
  integrationId: string,
  tenantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const integration = await getIntegration(integrationId, tenantId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const connector = getConnector(integration.connectorId);
  
  // Revoke tokens if OAuth and provider supports revocation
  if (connector?.oauthEnabled && integration.encryptedCredentialsRef) {
    try {
      // TODO: Implement provider-specific token revocation
      // For now, we just mark as disconnected
    } catch (error) {
      console.error(`Failed to revoke tokens for integration ${integrationId}:`, error);
    }
  }

  // Update integration status
  if (db) {
    await db
      .update(integrations)
      .set({
        status: "disconnected",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const integration = memStorage.integrations?.get(integrationId);
    if (integration) {
      integration.status = "disconnected";
      integration.deletedAt = new Date();
      integration.updatedAt = new Date();
    }
  }

  // Log audit
  await logAuditEvent({
    tenantId,
    userId,
    action: "delete",
    resourceType: "integration",
    resourceId: integrationId,
    details: {
      connectorId: integration.connectorId,
      action: "disconnect",
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Get integration by ID (tenant-scoped)
 */
export async function getIntegration(integrationId: string, tenantId: string): Promise<Integration | null> {
  if (db) {
    const result = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.id, integrationId),
        eq(integrations.tenantId, tenantId),
        eq(integrations.deletedAt, null as any)
      ))
      .limit(1);
    
    return result[0] || null;
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const integration = memStorage.integrations?.get(integrationId);
    if (integration && integration.tenantId === tenantId && !integration.deletedAt) {
      return integration;
    }
    return null;
  }
}

/**
 * Get all integrations for tenant
 */
export async function getTenantIntegrations(tenantId: string): Promise<Integration[]> {
  if (db) {
    return await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.tenantId, tenantId),
        eq(integrations.deletedAt, null as any)
      ));
  } else {
    // In-memory mode
    const memStorage = storage as any;
    return Array.from(memStorage.integrations?.values() || [])
      .filter((i: any) => i.tenantId === tenantId && !i.deletedAt);
  }
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  integrationId: string,
  tenantId: string,
  status: Integration["status"],
  errorMessage?: string
): Promise<void> {
  if (db) {
    await db
      .update(integrations)
      .set({
        status,
        lastError: errorMessage || null,
        lastErrorAt: errorMessage ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const integration = memStorage.integrations?.get(integrationId);
    if (integration && integration.tenantId === tenantId) {
      integration.status = status;
      integration.lastError = errorMessage || null;
      integration.lastErrorAt = errorMessage ? new Date() : null;
      integration.updatedAt = new Date();
    }
  }
}

/**
 * Test integration connection (health check)
 */
export async function testIntegrationConnection(integrationId: string, tenantId: string): Promise<boolean> {
  const integration = await getIntegration(integrationId, tenantId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const connector = getConnector(integration.connectorId);
  if (!connector) {
    throw new Error("Connector not found");
  }

  // Check test mode
  const config = integration.config as any;
  if (config?.testMode) {
    // In test mode, skip actual connection test
    return true;
  }

  // Decrypt credentials
  const credentials = await decryptCredentials(integration.encryptedCredentialsRef, tenantId);

  if (!credentials || Object.keys(credentials).length === 0) {
    throw new Error("Invalid credentials");
  }

  // Use adapter for connection test
  const adapter = getAdapter(integration.connectorId);
  if (adapter) {
    return await adapter.testConnection(credentials);
  }

  // Fallback: just verify credentials exist
  return true;

  // Update last sync time
  if (db) {
    await db
      .update(integrations)
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const integration = memStorage.integrations?.get(integrationId);
    if (integration) {
      integration.lastSyncAt = new Date();
      integration.updatedAt = new Date();
    }
  }

  return true;
}

/**
 * Refresh OAuth tokens
 */
export async function refreshIntegrationTokens(
  integrationId: string,
  tenantId: string
): Promise<void> {
  const integration = await getIntegration(integrationId, tenantId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const connector = getConnector(integration.connectorId);
  if (!connector?.oauthEnabled) {
    throw new Error("Connector does not support OAuth");
  }

  // Decrypt current credentials
  const credentials = await decryptCredentials(integration.encryptedCredentialsRef, tenantId);
  
  // Use adapter for token refresh
  const adapter = getAdapter(integration.connectorId);
  if (!adapter) {
    throw new Error(`Adapter not found for connector ${integration.connectorId}`);
  }

  const newTokens = await adapter.refreshTokens(credentials);

  // Re-encrypt and update credentials
  const newEncryptedRef = await encryptCredentials(tenantId, integration.connectorId, {
    ...credentials,
    ...newTokens,
  });

  if (db) {
    await db
      .update(integrations)
      .set({
        encryptedCredentialsRef: newEncryptedRef,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  } else {
    // In-memory mode
    const memStorage = storage as any;
    const integration = memStorage.integrations?.get(integrationId);
    if (integration) {
      integration.encryptedCredentialsRef = newEncryptedRef;
      integration.updatedAt = new Date();
    }
  }

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: integration.createdBy,
    action: "update",
    resourceType: "integration",
    resourceId: integrationId,
    details: {
      connectorId: integration.connectorId,
      action: "token_refresh",
    },
  });
}

