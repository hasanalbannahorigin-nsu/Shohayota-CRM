/**
 * MCP Audit Logging Utility
 * Logs all MCP actions for audit trail
 */

import { db } from "../db";
import { mcpAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

export interface McpAuditLogData {
  actorId?: string;
  actorRole: string;
  action: string;
  targetTenantId?: string;
  payload?: Record<string, any>;
}

/**
 * Log an MCP action to the audit log
 */
export async function logMcpAction(
  actorId: string | undefined,
  actorRole: string,
  action: string,
  targetTenantId: string | undefined,
  payload: Record<string, any> = {}
): Promise<void> {
  try {
    if (db) {
      // Use database
      await db.insert(mcpAuditLogs).values({
        actorId: actorId || null,
        actorRole,
        action,
        targetTenantId: targetTenantId || null,
        payload: payload || {},
      });
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      if (!memStorage.mcpAuditLogs) {
        memStorage.mcpAuditLogs = new Map();
      }
      
      const logId = `mcp-audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      memStorage.mcpAuditLogs.set(logId, {
        id: logId,
        actorId: actorId || null,
        actorRole,
        action,
        targetTenantId: targetTenantId || null,
        payload: payload || {},
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("[MCP Audit] Failed to log action:", error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Get MCP audit logs for a tenant
 */
export async function getMcpAuditLogs(
  targetTenantId?: string,
  limit: number = 200
): Promise<any[]> {
  try {
    if (db) {
      const query = db.select().from(mcpAuditLogs);
      
      if (targetTenantId) {
        query.where(eq(mcpAuditLogs.targetTenantId, targetTenantId));
      }
      
      const logs = await query
        .orderBy(mcpAuditLogs.createdAt)
        .limit(limit);
      
      return logs;
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      if (!memStorage.mcpAuditLogs) {
        return [];
      }
      
      let logs = Array.from(memStorage.mcpAuditLogs.values());
      
      if (targetTenantId) {
        logs = logs.filter((log: any) => log.targetTenantId === targetTenantId);
      }
      
      // Sort by created_at descending and limit
      logs.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return logs.slice(0, limit);
    }
  } catch (error) {
    console.error("[MCP Audit] Failed to get audit logs:", error);
    return [];
  }
}

