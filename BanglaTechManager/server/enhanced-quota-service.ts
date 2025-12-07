/**
 * Enhanced Quota Service
 * Implements soft warnings and hard enforcement for quotas
 */

import { storage } from "./storage";
import { checkApiCallQuota, checkUserQuota, checkCustomerQuota, getTenantUsageSummary, type QuotaCheckResult } from "./quota-service";
import { logAuditEvent } from "./audit-service";

export type QuotaEnforcementLevel = "none" | "soft" | "hard";

export interface QuotaEnforcementResult {
  allowed: boolean;
  level: QuotaEnforcementLevel;
  message?: string;
  quota: QuotaCheckResult;
  warningThreshold?: number; // Percentage at which to warn (default 80%)
}

/**
 * Check quota with soft/hard enforcement
 */
export async function checkQuotaWithEnforcement(
  tenantId: string,
  resourceType: "users" | "customers" | "api_calls" | "storage",
  action: "create" | "update" | "delete"
): Promise<QuotaEnforcementResult> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return {
      allowed: false,
      level: "hard",
      message: "Tenant not found",
      quota: { allowed: false, reason: "Tenant not found", currentUsage: 0, limit: 0, remaining: 0 },
    };
  }

  const tenantData = tenant as any;
  const warningThreshold = 0.8; // 80%

  let quotaCheck: QuotaCheckResult;

  switch (resourceType) {
    case "users":
      quotaCheck = await checkUserQuota(tenantId);
      break;
    case "customers":
      quotaCheck = await checkCustomerQuota(tenantId);
      break;
    case "api_calls":
      quotaCheck = await checkApiCallQuota(tenantId);
      break;
    case "storage":
      // Storage quota check would be implemented here
      quotaCheck = { allowed: true, currentUsage: 0, limit: tenantData.quotaMaxStorage || 0, remaining: tenantData.quotaMaxStorage || 0 };
      break;
    default:
      return {
        allowed: false,
        level: "hard",
        message: "Unknown resource type",
        quota: { allowed: false, reason: "Unknown resource type", currentUsage: 0, limit: 0, remaining: 0 },
      };
  }

  if (!quotaCheck.allowed) {
    // Hard enforcement: quota exceeded
    return {
      allowed: false,
      level: "hard",
      message: quotaCheck.reason || "Quota exceeded",
      quota: quotaCheck,
      warningThreshold,
    };
  }

  // Check if approaching limit (soft warning)
  const usagePercentage = quotaCheck.limit > 0 ? quotaCheck.currentUsage / quotaCheck.limit : 0;
  
  if (usagePercentage >= 1.0) {
    // At or over limit (shouldn't happen if quotaCheck.allowed is true, but double-check)
    return {
      allowed: false,
      level: "hard",
      message: "Quota exceeded",
      quota: quotaCheck,
      warningThreshold,
    };
  }

  if (usagePercentage >= warningThreshold) {
    // Soft warning: approaching limit
    const remainingPercentage = ((1 - usagePercentage) * 100).toFixed(1);
    return {
      allowed: true,
      level: "soft",
      message: `Warning: ${remainingPercentage}% of ${resourceType} quota remaining (${quotaCheck.remaining} remaining of ${quotaCheck.limit})`,
      quota: quotaCheck,
      warningThreshold,
    };
  }

  // Within limits
  return {
    allowed: true,
    level: "none",
    quota: quotaCheck,
    warningThreshold,
  };
}

/**
 * Enforce quota before operation
 * Throws error if hard enforcement blocks, returns warning if soft enforcement
 */
export async function enforceQuota(
  tenantId: string,
  resourceType: "users" | "customers" | "api_calls" | "storage",
  action: "create" | "update" | "delete",
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ warning?: string }> {
  const enforcement = await checkQuotaWithEnforcement(tenantId, resourceType, action);

  if (enforcement.level === "hard" && !enforcement.allowed) {
    // Log quota exceeded attempt
    await logAuditEvent({
      tenantId,
      userId,
      action: "quota_exceeded",
      resourceType: "quota",
      resourceId: tenantId,
      details: {
        resourceType,
        action,
        quota: enforcement.quota,
      },
      ipAddress,
      userAgent,
    });

    throw new Error(enforcement.message || "Quota exceeded. Please upgrade your plan or contact support.");
  }

  if (enforcement.level === "soft" && enforcement.message) {
    // Log soft warning
    await logAuditEvent({
      tenantId,
      userId,
      action: "quota_warning",
      resourceType: "quota",
      resourceId: tenantId,
      details: {
        resourceType,
        action,
        quota: enforcement.quota,
        warning: enforcement.message,
      },
      ipAddress,
      userAgent,
    });

    return { warning: enforcement.message };
  }

  return {};
}

/**
 * Get quota status with enforcement level
 */
export async function getQuotaStatus(tenantId: string): Promise<{
  users: QuotaEnforcementResult;
  customers: QuotaEnforcementResult;
  apiCalls: QuotaEnforcementResult;
  storage: QuotaEnforcementResult;
}> {
  return {
    users: await checkQuotaWithEnforcement(tenantId, "users", "create"),
    customers: await checkQuotaWithEnforcement(tenantId, "customers", "create"),
    apiCalls: await checkQuotaWithEnforcement(tenantId, "api_calls", "create"),
    storage: await checkQuotaWithEnforcement(tenantId, "storage", "create"),
  };
}

