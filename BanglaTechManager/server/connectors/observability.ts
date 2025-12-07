/**
 * Observability Service for Connectors
 * Metrics, logging, and health monitoring
 */

import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { integrations, integrationLogs, integrationWebhooks, integrationSyncJobs } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getIntegration } from "./connector-manager";

export interface IntegrationMetrics {
  integrationId: string;
  connectorId: string;
  status: string;
  lastSyncAt?: Date | null;
  lastEventAt?: Date | null;
  lastError?: string | null;
  lastErrorAt?: Date | null;
  // Event counts
  eventsToday: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  // Error counts
  errorsToday: number;
  errorsThisWeek: number;
  // API call counts
  apiCallsToday: number;
  apiCallsThisWeek: number;
  // Rate limit hits
  rateLimitHits: number;
  // Sync stats
  lastSyncStatus?: string;
  lastSyncItemsProcessed?: number;
  lastSyncItemsFailed?: number;
}

/**
 * Get integration metrics
 */
export async function getIntegrationMetrics(
  integrationId: string,
  tenantId: string
): Promise<IntegrationMetrics | null> {
  const integration = await getIntegration(integrationId, tenantId);
  if (!integration) {
    return null;
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(now.setDate(now.getDate() - 7));
  const monthStart = new Date(now.setDate(now.getDate() - 30));

  let metrics: IntegrationMetrics = {
    integrationId,
    connectorId: integration.connectorId,
    status: integration.status,
    lastSyncAt: integration.lastSyncAt,
    lastEventAt: integration.lastEventAt,
    lastError: integration.lastError,
    lastErrorAt: integration.lastErrorAt,
    eventsToday: 0,
    eventsThisWeek: 0,
    eventsThisMonth: 0,
    errorsToday: 0,
    errorsThisWeek: 0,
    apiCallsToday: 0,
    apiCallsThisWeek: 0,
    rateLimitHits: 0,
  };

  if (db) {
    // Get webhook event counts
    const eventsTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationWebhooks)
      .where(and(
        eq(integrationWebhooks.integrationId, integrationId),
        eq(integrationWebhooks.tenantId, tenantId),
        gte(integrationWebhooks.receivedAt, todayStart)
      ));

    const eventsWeekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationWebhooks)
      .where(and(
        eq(integrationWebhooks.integrationId, integrationId),
        eq(integrationWebhooks.tenantId, tenantId),
        gte(integrationWebhooks.receivedAt, weekStart)
      ));

    const eventsMonthResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationWebhooks)
      .where(and(
        eq(integrationWebhooks.integrationId, integrationId),
        eq(integrationWebhooks.tenantId, tenantId),
        gte(integrationWebhooks.receivedAt, monthStart)
      ));

    // Get error counts
    const errorsTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationLogs)
      .where(and(
        eq(integrationLogs.integrationId, integrationId),
        eq(integrationLogs.tenantId, tenantId),
        eq(integrationLogs.level, "error"),
        gte(integrationLogs.createdAt, todayStart)
      ));

    const errorsWeekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationLogs)
      .where(and(
        eq(integrationLogs.integrationId, integrationId),
        eq(integrationLogs.tenantId, tenantId),
        eq(integrationLogs.level, "error"),
        gte(integrationLogs.createdAt, weekStart)
      ));

    // Get API call counts (from logs)
    const apiCallsTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationLogs)
      .where(and(
        eq(integrationLogs.integrationId, integrationId),
        eq(integrationLogs.tenantId, tenantId),
        eq(integrationLogs.operation, "api_call"),
        gte(integrationLogs.createdAt, todayStart)
      ));

    const apiCallsWeekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(integrationLogs)
      .where(and(
        eq(integrationLogs.integrationId, integrationId),
        eq(integrationLogs.tenantId, tenantId),
        eq(integrationLogs.operation, "api_call"),
        gte(integrationLogs.createdAt, weekStart)
      ));

    // Get last sync job
    const lastSyncJob = await db
      .select()
      .from(integrationSyncJobs)
      .where(and(
        eq(integrationSyncJobs.integrationId, integrationId),
        eq(integrationSyncJobs.tenantId, tenantId)
      ))
      .orderBy(sql`${integrationSyncJobs.createdAt} DESC`)
      .limit(1);

    metrics.eventsToday = Number(eventsTodayResult[0]?.count || 0);
    metrics.eventsThisWeek = Number(eventsWeekResult[0]?.count || 0);
    metrics.eventsThisMonth = Number(eventsMonthResult[0]?.count || 0);
    metrics.errorsToday = Number(errorsTodayResult[0]?.count || 0);
    metrics.errorsThisWeek = Number(errorsWeekResult[0]?.count || 0);
    metrics.apiCallsToday = Number(apiCallsTodayResult[0]?.count || 0);
    metrics.apiCallsThisWeek = Number(apiCallsWeekResult[0]?.count || 0);

    if (lastSyncJob.length > 0) {
      metrics.lastSyncStatus = lastSyncJob[0].status;
      metrics.lastSyncItemsProcessed = lastSyncJob[0].itemsProcessed;
      metrics.lastSyncItemsFailed = lastSyncJob[0].itemsFailed;
    }
  }

  return metrics;
}

/**
 * Log integration event
 */
export async function logIntegrationEvent(
  tenantId: string,
  integrationId: string | null,
  connectorId: string,
  level: "info" | "warn" | "error" | "debug",
  message: string,
  details?: Record<string, any>,
  operation?: string,
  duration?: number
): Promise<void> {
  if (db) {
    await db.insert(integrationLogs).values({
      tenantId,
      integrationId: integrationId || null,
      connectorId,
      level,
      message,
      details: details || {},
      operation,
      duration,
    });
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    if (!memStorage.integrationLogs) {
      memStorage.integrationLogs = new Map();
    }
    const log = {
      id: uuidv4(),
      tenantId,
      integrationId: integrationId || null,
      connectorId,
      level,
      message,
      details: details || {},
      operation,
      duration,
      createdAt: new Date(),
    };
    memStorage.integrationLogs.set(log.id, log);
  }
}

/**
 * Get integration logs
 */
export async function getIntegrationLogs(
  integrationId: string,
  tenantId: string,
  limit = 100
): Promise<any[]> {
  if (db) {
    return await db
      .select()
      .from(integrationLogs)
      .where(and(
        eq(integrationLogs.integrationId, integrationId),
        eq(integrationLogs.tenantId, tenantId)
      ))
      .orderBy(sql`${integrationLogs.createdAt} DESC`)
      .limit(limit);
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    const allLogs = Array.from(memStorage.integrationLogs?.values() || [])
      .filter((log: any) => log.integrationId === integrationId && log.tenantId === tenantId)
      .sort((a: any, b: any) => b.createdAt - a.createdAt)
      .slice(0, limit);
    return allLogs;
  }
}

/**
 * Check integration health and alert if needed
 */
export async function checkIntegrationHealth(
  integrationId: string,
  tenantId: string
): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const metrics = await getIntegrationMetrics(integrationId, tenantId);
  if (!metrics) {
    return { healthy: false, issues: ["Integration not found"] };
  }

  const issues: string[] = [];

  // Check status
  if (metrics.status === "error" || metrics.status === "auth_failed") {
    issues.push(`Integration status: ${metrics.status}`);
  }

  // Check for recent errors
  if (metrics.errorsToday > 10) {
    issues.push(`High error rate: ${metrics.errorsToday} errors today`);
  }

  // Check last sync
  if (metrics.lastSyncAt) {
    const hoursSinceSync = (Date.now() - new Date(metrics.lastSyncAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync > 24) {
      issues.push(`Last sync was ${Math.floor(hoursSinceSync)} hours ago`);
    }
  } else {
    issues.push("No syncs performed yet");
  }

  // Check last error
  if (metrics.lastError && metrics.lastErrorAt) {
    const hoursSinceError = (Date.now() - new Date(metrics.lastErrorAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceError < 1) {
      issues.push(`Recent error: ${metrics.lastError}`);
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

