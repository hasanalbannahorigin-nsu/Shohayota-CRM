/**
 * Quota Enforcement Service
 * Tracks usage and enforces limits per tenant
 */

import { db } from "./db";
import { tenantUsageMetrics, tenants } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";
import { insertTenantUsageMetricSchema } from "@shared/schema";
import { withTenantContext } from "./db-tenant-context";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  remaining: number;
}

/**
 * Get current period (YYYY-MM format)
 */
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// In-memory storage for usage metrics when DB is not available
const inMemoryMetrics = new Map<string, any>();

/**
 * Get or create usage metrics for current period
 */
async function getOrCreateUsageMetrics(tenantId: string): Promise<any> {
  const period = getCurrentPeriod();
  const key = `${tenantId}:${period}`;

  if (!db) {
    // In-memory mode
    if (!inMemoryMetrics.has(key)) {
      inMemoryMetrics.set(key, {
        tenantId,
        period,
        apiCalls: 0,
        activeUsers: 0,
        storageUsed: 0,
        callMinutes: 0,
        messagesSent: 0,
      });
    }
    return inMemoryMetrics.get(key);
  }

  // Try to get existing metrics
  const existing = await db
    .select()
    .from(tenantUsageMetrics)
    .where(and(eq(tenantUsageMetrics.tenantId, tenantId), eq(tenantUsageMetrics.period, period)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new metrics for this period
  const newMetrics = insertTenantUsageMetricSchema.parse({
    tenantId,
    period,
    apiCalls: 0,
    activeUsers: 0,
    storageUsed: 0,
    callMinutes: 0,
    messagesSent: 0,
  });

  if (!db) {
    // In-memory mode: use storage
    return await storage.createOrUpdateUsageMetrics(newMetrics);
  }

  // Use tenant context for RLS enforcement
  const dbInstance = db;
  if (dbInstance) {
    await withTenantContext(
      {
        tenantId,
        userRole: "system", // System operation
      },
      async () => {
        await dbInstance.insert(tenantUsageMetrics).values(newMetrics);
      }
    );
  }
  return await storage.createOrUpdateUsageMetrics(newMetrics);
}

/**
 * Increment API call count
 */
export async function incrementApiCalls(tenantId: string): Promise<void> {
  const metrics = await getOrCreateUsageMetrics(tenantId);
  
  if (!db) {
    // In-memory mode
    metrics.apiCalls = (metrics.apiCalls || 0) + 1;
    return;
  }

  // Use tenant context for RLS enforcement
  const dbInstance = db;
  if (dbInstance) {
    await withTenantContext(
      {
        tenantId,
        userRole: "system", // System operation
      },
      async () => {
        await dbInstance
          .update(tenantUsageMetrics)
          .set({
            apiCalls: sql`${tenantUsageMetrics.apiCalls} + 1`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(tenantUsageMetrics.tenantId, tenantId),
            eq(tenantUsageMetrics.period, metrics.period)
          ));
      }
    );
  }
}

/**
 * Check if tenant can make API calls
 */
export async function checkApiCallQuota(tenantId: string): Promise<QuotaCheckResult> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { allowed: false, reason: "Tenant not found", currentUsage: 0, limit: 0, remaining: 0 };
  }

  const metrics = await getOrCreateUsageMetrics(tenantId);
  const limit = (tenant as any).quotaMaxApiCalls || 10000;
  const currentUsage = metrics.apiCalls || 0;
  const remaining = Math.max(0, limit - currentUsage);

  // Check tenant status
  if ((tenant as any).status === "suspended" || (tenant as any).status === "canceled") {
    return {
      allowed: false,
      reason: `Tenant is ${(tenant as any).status}`,
      currentUsage,
      limit,
      remaining,
    };
  }

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: "API call quota exceeded",
      currentUsage,
      limit,
      remaining,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    remaining,
  };
}

/**
 * Check if tenant can create more users
 */
export async function checkUserQuota(tenantId: string): Promise<QuotaCheckResult> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { allowed: false, reason: "Tenant not found", currentUsage: 0, limit: 0, remaining: 0 };
  }

  const users = await storage.getUsersByTenant(tenantId);
  const limit = (tenant as any).quotaMaxUsers || 10;
  const currentUsage = users.length;
  const remaining = Math.max(0, limit - currentUsage);

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: "User quota exceeded",
      currentUsage,
      limit,
      remaining,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    remaining,
  };
}

/**
 * Check if tenant can create more customers
 */
export async function checkCustomerQuota(tenantId: string): Promise<QuotaCheckResult> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    return { allowed: false, reason: "Tenant not found", currentUsage: 0, limit: 0, remaining: 0 };
  }

  const customers = await storage.getCustomersByTenant(tenantId, 10000, 0);
  const limit = (tenant as any).quotaMaxCustomers || 1000;
  const currentUsage = customers.length;
  const remaining = Math.max(0, limit - currentUsage);

  if (currentUsage >= limit) {
    return {
      allowed: false,
      reason: "Customer quota exceeded",
      currentUsage,
      limit,
      remaining,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit,
    remaining,
  };
}

/**
 * Get usage summary for tenant
 */
export async function getTenantUsageSummary(tenantId: string): Promise<{
  apiCalls: number;
  activeUsers: number;
  storageUsed: number;
  callMinutes: number;
  messagesSent: number;
  quotas: {
    maxUsers: number;
    maxCustomers: number;
    maxStorage: number;
    maxApiCalls: number;
  };
}> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const metrics = await getOrCreateUsageMetrics(tenantId);
  const tenantData = tenant as any;

  // Calculate active users from actual user count
  const users = await storage.getUsersByTenant(tenantId);
  const activeUsersCount = users.length;

  return {
    apiCalls: metrics.apiCalls || 0,
    activeUsers: activeUsersCount,
    storageUsed: metrics.storageUsed || 0,
    callMinutes: metrics.callMinutes || 0,
    messagesSent: metrics.messagesSent || 0,
    quotas: {
      maxUsers: tenantData.quotaMaxUsers || 10,
      maxCustomers: tenantData.quotaMaxCustomers || 1000,
      maxStorage: tenantData.quotaMaxStorage || 10737418240,
      maxApiCalls: tenantData.quotaMaxApiCalls || 10000,
    },
  };
}

