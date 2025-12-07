/**
 * Tenant Configuration Service
 * Manages per-tenant configuration (branding, features, custom fields)
 */

import { storage } from "./storage";
import { logAuditEvent } from "./audit-service";

export interface TenantConfig {
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  features?: {
    voice?: boolean;
    whatsapp?: boolean;
    analytics?: boolean;
    ai?: boolean;
  };
  customFields?: Record<string, any>;
  notificationChannels?: string[];
}

/**
 * Get tenant configuration
 */
export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  return tenantData.settings || {};
}

/**
 * Update tenant configuration
 */
export async function updateTenantConfig(
  tenantId: string,
  updates: Partial<TenantConfig>,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<TenantConfig> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  const currentSettings = tenantData.settings || {};

  // Merge updates with existing settings
  const newSettings: TenantConfig = {
    ...currentSettings,
    branding: {
      ...currentSettings.branding,
      ...updates.branding,
    },
    features: {
      ...currentSettings.features,
      ...updates.features,
    },
    customFields: {
      ...currentSettings.customFields,
      ...updates.customFields,
    },
    notificationChannels: updates.notificationChannels || currentSettings.notificationChannels,
  };

  // Update tenant settings
  await storage.updateTenant(tenantId, { settings: newSettings as any });

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "update",
    resourceType: "tenant_config",
    resourceId: tenantId,
    details: { updatedFields: Object.keys(updates) },
    ipAddress,
    userAgent,
  });

  return newSettings;
}

/**
 * Validate feature access for tenant
 */
export async function hasFeatureAccess(tenantId: string, feature: "voice" | "whatsapp" | "analytics" | "ai"): Promise<boolean> {
  const config = await getTenantConfig(tenantId);
  return config.features?.[feature] ?? false;
}

/**
 * Get tenant branding
 */
export async function getTenantBranding(tenantId: string): Promise<TenantConfig["branding"]> {
  const config = await getTenantConfig(tenantId);
  return config.branding || {};
}

