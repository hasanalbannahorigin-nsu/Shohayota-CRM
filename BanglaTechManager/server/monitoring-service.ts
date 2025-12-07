/**
 * Monitoring Service
 * Tracks per-tenant metrics, alerts, and observability
 */

import { storage } from "./storage";
import { getTenantUsageSummary } from "./quota-service";
import { logAuditEvent } from "./audit-service";

export interface TenantMetrics {
  tenantId: string;
  period: string; // YYYY-MM
  apiCalls: number;
  activeUsers: number;
  storageUsed: number; // bytes
  callMinutes: number;
  messagesSent: number;
  errorRate: number; // percentage
  averageLatency: number; // milliseconds
  lastActivity: Date;
}

export interface Alert {
  id: string;
  tenantId: string;
  type: "quota_warning" | "quota_exceeded" | "high_error_rate" | "high_latency" | "suspicious_activity";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details: Record<string, any>;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

// In-memory alerts store (use Redis/DB in production)
const alerts = new Map<string, Alert>();

/**
 * Get tenant metrics for monitoring
 */
export async function getTenantMetrics(
  tenantId: string,
  period?: string
): Promise<TenantMetrics | null> {
  const usage = await getTenantUsageSummary(tenantId);
  if (!usage) {
    return null;
  }

  // Get current period if not provided
  const currentPeriod = period || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();

  // In production, calculate error rate and latency from logs/metrics
  // For now, return basic metrics
  return {
    tenantId,
    period: currentPeriod,
    apiCalls: usage.apiCalls || 0,
    activeUsers: usage.activeUsers || 0,
    storageUsed: usage.storageUsed || 0,
    callMinutes: usage.callMinutes || 0,
    messagesSent: usage.messagesSent || 0,
    errorRate: 0, // Would be calculated from logs
    averageLatency: 0, // Would be calculated from request logs
    lastActivity: new Date(), // Would be from last API call timestamp
  };
}

/**
 * Check thresholds and create alerts
 */
export async function checkThresholds(tenantId: string): Promise<Alert[]> {
  const metrics = await getTenantMetrics(tenantId);
  if (!metrics) {
    return [];
  }

  const newAlerts: Alert[] = [];
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return [];
  }

  const tenantData = tenant as any;

  // Check quota thresholds
  const quotaStatus = {
    users: metrics.activeUsers / (tenantData.quotaMaxUsers || 10),
    customers: 0, // Would calculate from actual customer count
    apiCalls: metrics.apiCalls / (tenantData.quotaMaxApiCalls || 10000),
    storage: metrics.storageUsed / (tenantData.quotaMaxStorage || 10737418240),
  };

  // Quota warnings (80% threshold)
  if (quotaStatus.apiCalls >= 0.8) {
    const alertId = `quota_warning_${tenantId}_api_${Date.now()}`;
    if (!alerts.has(alertId)) {
      const alert: Alert = {
        id: alertId,
        tenantId,
        type: "quota_warning",
        severity: quotaStatus.apiCalls >= 0.95 ? "high" : "medium",
        message: `API call quota at ${(quotaStatus.apiCalls * 100).toFixed(1)}% (${metrics.apiCalls}/${tenantData.quotaMaxApiCalls})`,
        details: {
          resourceType: "api_calls",
          currentUsage: metrics.apiCalls,
          limit: tenantData.quotaMaxApiCalls,
          percentage: quotaStatus.apiCalls * 100,
        },
        createdAt: new Date(),
        acknowledged: false,
      };
      alerts.set(alertId, alert);
      newAlerts.push(alert);
    }
  }

  // Error rate threshold (5% error rate)
  if (metrics.errorRate > 5) {
    const alertId = `high_error_rate_${tenantId}_${Date.now()}`;
    if (!alerts.has(alertId)) {
      const alert: Alert = {
        id: alertId,
        tenantId,
        type: "high_error_rate",
        severity: metrics.errorRate > 10 ? "critical" : "high",
        message: `High error rate detected: ${metrics.errorRate.toFixed(2)}%`,
        details: {
          errorRate: metrics.errorRate,
          threshold: 5,
        },
        createdAt: new Date(),
        acknowledged: false,
      };
      alerts.set(alertId, alert);
      newAlerts.push(alert);
    }
  }

  // Latency threshold (1 second average)
  if (metrics.averageLatency > 1000) {
    const alertId = `high_latency_${tenantId}_${Date.now()}`;
    if (!alerts.has(alertId)) {
      const alert: Alert = {
        id: alertId,
        tenantId,
        type: "high_latency",
        severity: metrics.averageLatency > 3000 ? "critical" : "medium",
        message: `High latency detected: ${metrics.averageLatency.toFixed(0)}ms average`,
        details: {
          averageLatency: metrics.averageLatency,
          threshold: 1000,
        },
        createdAt: new Date(),
        acknowledged: false,
      };
      alerts.set(alertId, alert);
      newAlerts.push(alert);
    }
  }

  return newAlerts;
}

/**
 * Get alerts for tenant
 */
export function getTenantAlerts(
  tenantId: string,
  options: { acknowledged?: boolean; severity?: string; limit?: number } = {}
): Alert[] {
  let result = Array.from(alerts.values()).filter((alert) => alert.tenantId === tenantId);

  if (options.acknowledged !== undefined) {
    result = result.filter((alert) => alert.acknowledged === options.acknowledged);
  }

  if (options.severity) {
    result = result.filter((alert) => alert.severity === options.severity);
  }

  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Acknowledge alert
 */
export function acknowledgeAlert(
  alertId: string,
  userId: string
): boolean {
  const alert = alerts.get(alertId);
  if (!alert) {
    return false;
  }

  alert.acknowledged = true;
  alert.acknowledgedAt = new Date();
  alert.acknowledgedBy = userId;
  alerts.set(alertId, alert);

  return true;
}

/**
 * Get all alerts (super-admin only)
 */
export function getAllAlerts(options: { severity?: string; limit?: number } = {}): Alert[] {
  let result = Array.from(alerts.values());

  if (options.severity) {
    result = result.filter((alert) => alert.severity === options.severity);
  }

  result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

