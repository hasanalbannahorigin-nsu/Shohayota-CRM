/**
 * Integration Service
 * Manages tenant-scoped connector integrations (connect/disconnect, credentials, config)
 */

import { db } from "../../db";
import { integrations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../../encryption-service";
import { sql } from "drizzle-orm";

export interface IntegrationRecord {
  id: string;
  tenant_id: string;
  connector_id: string;
  display_name?: string;
  encrypted_credentials_ref?: string;
  config?: any;
  status: string;
  last_sync_at?: Date;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Create a new integration for a tenant
 */
export async function createIntegration(
  tenantId: string,
  connectorId: string,
  credentials: Record<string, any>,
  config: Record<string, any> = {},
  createdBy?: string
): Promise<IntegrationRecord> {
  // Encrypt credentials
  const encryptedCreds = encryptCredentials(credentials);
  
  // Store encrypted credentials reference (in production, store in separate secure storage)
  const credentialsRef = `cred_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // For now, we'll store encrypted credentials in the config as encrypted_credentials
  // In production, use a separate credentials table or KMS-backed storage
  const integrationConfig = {
    ...config,
    encrypted_credentials: encryptedCreds,
    credentials_ref: credentialsRef,
  };

  const [integration] = await db
    .insert(integrations)
    .values({
      tenantId,
      connectorId,
      displayName: connectorId,
      encryptedCredentialsRef: credentialsRef,
      config: integrationConfig,
      status: "connected",
      createdBy: createdBy || null,
    })
    .returning();

  return {
    id: integration.id,
    tenant_id: integration.tenantId,
    connector_id: integration.connectorId,
    display_name: integration.displayName || undefined,
    encrypted_credentials_ref: integration.encryptedCredentialsRef || undefined,
    config: integration.config as any,
    status: integration.status,
    last_sync_at: integration.lastSyncAt || undefined,
    created_by: integration.createdBy || undefined,
    created_at: integration.createdAt || undefined,
    updated_at: integration.updatedAt || undefined,
  };
}

/**
 * Get integration by ID (with decrypted credentials)
 */
export async function getIntegrationById(id: string): Promise<IntegrationRecord | null> {
  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, id))
    .limit(1);

  if (!integration) return null;

  return {
    id: integration.id,
    tenant_id: integration.tenantId,
    connector_id: integration.connectorId,
    display_name: integration.displayName || undefined,
    encrypted_credentials_ref: integration.encryptedCredentialsRef || undefined,
    config: integration.config as any,
    status: integration.status,
    last_sync_at: integration.lastSyncAt || undefined,
    created_by: integration.createdBy || undefined,
    created_at: integration.createdAt || undefined,
    updated_at: integration.updatedAt || undefined,
  };
}

/**
 * Get integration with decrypted credentials
 */
export async function getIntegrationWithCredentials(id: string): Promise<IntegrationRecord & { credentials: any } | null> {
  const integration = await getIntegrationById(id);
  if (!integration) return null;

  // Decrypt credentials from config
  const config = integration.config || {};
  const encryptedCreds = config.encrypted_credentials;
  
  if (!encryptedCreds) {
    return { ...integration, credentials: null };
  }

  try {
    const credentials = decryptCredentials(encryptedCreds);
    return { ...integration, credentials };
  } catch (error) {
    console.error("Failed to decrypt credentials:", error);
    return { ...integration, credentials: null };
  }
}

/**
 * Update integration credentials
 */
export async function updateIntegrationCredentials(
  id: string,
  credentials: Record<string, any>
): Promise<IntegrationRecord | null> {
  const existing = await getIntegrationById(id);
  if (!existing) return null;

  const encryptedCreds = encryptCredentials(credentials);
  const config = existing.config || {};
  config.encrypted_credentials = encryptedCreds;

  const [updated] = await db
    .update(integrations)
    .set({
      config,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, id))
    .returning();

  if (!updated) return null;

  return {
    id: updated.id,
    tenant_id: updated.tenantId,
    connector_id: updated.connectorId,
    display_name: updated.displayName || undefined,
    encrypted_credentials_ref: updated.encryptedCredentialsRef || undefined,
    config: updated.config as any,
    status: updated.status,
    last_sync_at: updated.lastSyncAt || undefined,
    created_by: updated.createdBy || undefined,
    created_at: updated.createdAt || undefined,
    updated_at: updated.updatedAt || undefined,
  };
}

/**
 * Get all integrations for a tenant
 */
export async function getTenantIntegrations(tenantId: string): Promise<IntegrationRecord[]> {
  const results = await db
    .select()
    .from(integrations)
    .where(eq(integrations.tenantId, tenantId));

  return results.map((r) => ({
    id: r.id,
    tenant_id: r.tenantId,
    connector_id: r.connectorId,
    display_name: r.displayName || undefined,
    encrypted_credentials_ref: r.encryptedCredentialsRef || undefined,
    config: r.config as any,
    status: r.status,
    last_sync_at: r.lastSyncAt || undefined,
    created_by: r.createdBy || undefined,
    created_at: r.createdAt || undefined,
    updated_at: r.updatedAt || undefined,
  }));
}

/**
 * Delete integration (soft delete)
 */
export async function deleteIntegration(id: string): Promise<boolean> {
  const [updated] = await db
    .update(integrations)
    .set({
      status: "disconnected",
      deletedAt: new Date(),
    })
    .where(eq(integrations.id, id))
    .returning();

  return !!updated;
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  id: string,
  status: string,
  error?: string
): Promise<boolean> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (error) {
    updateData.lastError = error;
    updateData.lastErrorAt = new Date();
  }

  const [updated] = await db
    .update(integrations)
    .set(updateData)
    .where(eq(integrations.id, id))
    .returning();

  return !!updated;
}

