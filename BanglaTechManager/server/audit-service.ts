/**
 * Audit Logging Service
 * Records all tenant-scoped actions for compliance and security
 */

import { db } from "./db";
import { auditLogs, insertAuditLogSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { withTenantContext } from "./db-tenant-context";

export interface AuditLogData {
  tenantId: string;
  userId?: string;
  action: "create" | "update" | "delete" | "login" | "logout" | "impersonate" | "export" | "import" | "quota_exceeded" | "quota_warning" | "permission_denied" | "role_assign" | "role_revoke" | "invite_create" | "invite_accept" | "invite_revoke" | "mfa_setup" | "mfa_verify" | "mfa_disable" | "password_reset" | "session_revoke";
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    const auditData = insertAuditLogSchema.parse({
      tenantId: data.tenantId,
      userId: data.userId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      details: data.details || {},
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      impersonatedBy: data.impersonatedBy,
    });

    if (!db) {
      // In-memory mode: use storage
      await storage.createAuditLog(auditData);
      return;
    }

    // Use tenant context for RLS enforcement
    const dbInstance = db;
    if (dbInstance) {
      await withTenantContext(
        {
          tenantId: data.tenantId,
          userRole: data.userId ? "tenant_admin" : "system", // Default role for system events
        },
        async () => {
          await dbInstance.insert(auditLogs).values(auditData);
        }
      );
    }
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("[AUDIT] Failed to log event:", error);
  }
}

/**
 * Get audit logs for a tenant
 */
export async function getAuditLogs(
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    resourceType?: string;
    action?: string;
    userId?: string;
  } = {}
): Promise<any[]> {
  if (!db) {
    // In-memory mode: use storage
    return await storage.getAuditLogs(tenantId, options);
  }

  let query = db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId));

  if (options.resourceType) {
    // Would need to add resourceType filter
  }
  if (options.action) {
    // Would need to add action filter
  }
  if (options.userId) {
    // Would need to add userId filter
  }

  const results = await query
    .limit(options.limit || 100)
    .offset(options.offset || 0)
    .orderBy(auditLogs.createdAt);

  return results;
}

/**
 * Get audit logs for super-admin (all tenants)
 */
export async function getAllAuditLogs(
  options: {
    limit?: number;
    offset?: number;
    tenantId?: string;
  } = {}
): Promise<any[]> {
  if (!db) {
    // In-memory mode: get all logs and filter
    const memStorage = storage as any;
    let logs = Array.from(memStorage.auditLogs?.values() || []);
    
    if (options.tenantId) {
      logs = logs.filter((l: any) => l.tenantId === options.tenantId);
    }
    
    return logs
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(options.offset || 0, (options.offset || 0) + (options.limit || 100));
  }

  let query = db.select().from(auditLogs);

  if (options.tenantId) {
    query = query.where(eq(auditLogs.tenantId, options.tenantId)) as any;
  }

  const results = await (query as any)
    .limit(options.limit || 100)
    .offset(options.offset || 0)
    .orderBy(auditLogs.createdAt);

  return results;
}

