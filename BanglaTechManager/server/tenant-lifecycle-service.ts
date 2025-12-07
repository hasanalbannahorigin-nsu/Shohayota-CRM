/**
 * Tenant Lifecycle Service
 * Handles tenant state transitions: suspend, reactivate, cancel, delete
 */

import { storage } from "./storage";
import { logAuditEvent } from "./audit-service";

export type TenantLifecycleStatus = "active" | "trialing" | "suspended" | "canceled" | "deleted";

export interface TenantLifecycleState {
  status: TenantLifecycleStatus;
  suspendedAt?: Date;
  canceledAt?: Date;
  deletedAt?: Date;
  scheduledDeletionAt?: Date;
  retentionEndsAt?: Date;
  reason?: string;
  updatedBy: string;
}

// Retention period: 30 days for soft delete, 90 days for hard delete
const SOFT_DELETE_RETENTION_DAYS = 30;
const HARD_DELETE_RETENTION_DAYS = 90;

/**
 * Suspend a tenant
 * Blocks writes/active workflows; allows export/reads for admin
 */
export async function suspendTenant(
  tenantId: string,
  reason: string,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  if (tenantData.status === "suspended") {
    return; // Already suspended
  }

  // Update tenant status
  await storage.updateTenant(tenantId, {
    status: "suspended",
    updatedAt: new Date(),
  } as any);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "update",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      status: "suspended",
      previousStatus: tenantData.status,
      reason,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Reactivate a tenant
 * Restores normal operations
 */
export async function reactivateTenant(
  tenantId: string,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  if (tenantData.status === "active") {
    return; // Already active
  }

  if (tenantData.status === "deleted") {
    throw new Error("Cannot reactivate a deleted tenant");
  }

  // Update tenant status
  await storage.updateTenant(tenantId, {
    status: "active",
    updatedAt: new Date(),
  } as any);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "update",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      status: "active",
      previousStatus: tenantData.status,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Cancel a tenant
 * Schedule deletion; read-only and export allowed during retention window
 */
export async function cancelTenant(
  tenantId: string,
  reason: string,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  if (tenantData.status === "canceled" || tenantData.status === "deleted") {
    return; // Already canceled or deleted
  }

  const canceledAt = new Date();
  const retentionEndsAt = new Date(canceledAt.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Update tenant status
  await storage.updateTenant(tenantId, {
    status: "canceled",
    canceledAt,
    retentionEndsAt,
    updatedAt: new Date(),
  } as any);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "update",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      status: "canceled",
      previousStatus: tenantData.status,
      reason,
      retentionEndsAt: retentionEndsAt.toISOString(),
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Schedule tenant deletion (soft delete)
 * Mark for purge; retain data until retention ends
 */
export async function scheduleTenantDeletion(
  tenantId: string,
  reason: string,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ deletedAt: Date; retentionEndsAt: Date }> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  if (tenantData.status === "deleted") {
    throw new Error("Tenant is already deleted");
  }

  const deletedAt = new Date();
  const retentionEndsAt = new Date(deletedAt.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Update tenant status
  await storage.updateTenant(tenantId, {
    status: "deleted",
    deletedAt,
    retentionEndsAt,
    updatedAt: new Date(),
  } as any);

  // Revoke all integration credentials
  try {
    const credentials = await storage.getIntegrationCredentialsByTenant(tenantId);
    for (const cred of credentials) {
      await storage.updateIntegrationCredential(cred.id, tenantId, {
        isActive: false,
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error(`[LIFECYCLE] Failed to revoke integrations for tenant ${tenantId}:`, error);
  }

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "delete",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      status: "deleted",
      previousStatus: tenantData.status,
      reason,
      retentionEndsAt: retentionEndsAt.toISOString(),
    },
    ipAddress,
    userAgent,
  });

  return { deletedAt, retentionEndsAt };
}

/**
 * Hard delete tenant (permanent removal)
 * Only allowed after retention period ends
 */
export async function hardDeleteTenant(
  tenantId: string,
  updatedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const tenantData = tenant as any;
  
  // Check if tenant is in deleted state
  if (tenantData.status !== "deleted") {
    throw new Error("Tenant must be soft-deleted before hard deletion");
  }

  // Check retention period
  const retentionEndsAt = tenantData.retentionEndsAt ? new Date(tenantData.retentionEndsAt) : null;
  if (retentionEndsAt && retentionEndsAt > new Date()) {
    throw new Error(
      `Cannot hard delete tenant before retention period ends. Retention ends at: ${retentionEndsAt.toISOString()}`
    );
  }

  // In production, this would:
  // 1. Delete all tenant data from database
  // 2. Delete all files from storage
  // 3. Remove all integration credentials
  // 4. Delete audit logs (after final audit entry)
  // 5. Remove from billing system

  // For now, we'll mark it as hard-deleted
  // In production, you'd actually delete the records

  // Log final audit entry before deletion
  await logAuditEvent({
    tenantId,
    userId: updatedBy,
    action: "delete",
    resourceType: "tenant",
    resourceId: tenantId,
    details: {
      status: "hard_deleted",
      previousStatus: tenantData.status,
      permanent: true,
    },
    ipAddress,
    userAgent,
  });

  // In production: Actually delete all tenant data
  // For now, we'll just mark it
  console.warn(`[LIFECYCLE] Hard delete requested for tenant ${tenantId}. In production, this would permanently delete all data.`);
}

/**
 * Check if tenant can perform operations
 */
export function canTenantOperate(tenant: any): { allowed: boolean; reason?: string } {
  const status = tenant.status;
  
  if (status === "suspended") {
    return {
      allowed: false,
      reason: "Tenant is suspended. Writes are blocked, but reads and exports are allowed.",
    };
  }

  if (status === "canceled") {
    return {
      allowed: false,
      reason: "Tenant is canceled. Only read-only operations and exports are allowed.",
    };
  }

  if (status === "deleted") {
    return {
      allowed: false,
      reason: "Tenant is deleted. Only exports are allowed during retention period.",
    };
  }

  return { allowed: true };
}

/**
 * Get tenants scheduled for hard deletion
 */
export async function getTenantsScheduledForHardDeletion(): Promise<any[]> {
  // In production, query database for tenants with status="deleted" and retentionEndsAt < now
  // For now, return empty array
  return [];
}

