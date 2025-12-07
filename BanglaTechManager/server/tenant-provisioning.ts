/**
 * Tenant Provisioning Service
 * Handles creation, configuration, and lifecycle management of tenants
 */

import { storage } from "./storage";
import { db } from "./db";
import { tenants, users, insertTenantSchema, insertUserSchema } from "@shared/schema";
import { generateToken } from "./auth";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export interface TenantProvisioningOptions {
  name: string;
  contactEmail: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  plan?: string;
  slug?: string;
}

export interface ProvisioningResult {
  tenant: any;
  adminUser: any;
  adminToken: string;
  warnings: string[];
}

/**
 * Provision a new tenant with default settings
 */
export async function provisionTenant(options: TenantProvisioningOptions): Promise<ProvisioningResult> {
  const warnings: string[] = [];
  
  // Generate slug if not provided
  const slug = options.slug || generateSlug(options.name);
  
  // IDEMPOTENCY: Check if tenant with same slug already exists
  const existingTenant = await storage.getTenantByName(options.name);
  if (existingTenant) {
    // Check if slug matches (idempotent provisioning)
    const existingSlug = existingTenant.slug || generateSlug(existingTenant.name);
    if (existingSlug === slug) {
      // Tenant already exists - return existing tenant (idempotent)
      const existingAdmin = await storage.getUserByEmail(options.adminEmail);
      if (existingAdmin && existingAdmin.tenantId === existingTenant.id) {
        // Admin user already exists - return existing setup
        const adminToken = generateToken({
          id: existingAdmin.id,
          email: existingAdmin.email,
          name: existingAdmin.name,
          tenantId: existingAdmin.tenantId,
          role: existingAdmin.role,
        });
        
        return {
          tenant: existingTenant,
          adminUser: {
            id: existingAdmin.id,
            email: existingAdmin.email,
            name: existingAdmin.name,
            role: existingAdmin.role,
          },
          adminToken,
          warnings: ["Tenant already exists - returning existing tenant (idempotent operation)"],
        };
      }
    }
  }
  
  // Validate tenant data
  const tenantData = insertTenantSchema.parse({
    name: options.name,
    slug,
    contactEmail: options.contactEmail,
    status: "trialing",
    plan: options.plan || "basic",
    settings: {
      branding: {},
      features: {
        voice: true,
        whatsapp: false,
        analytics: true,
        ai: true,
      },
      customFields: {},
      notificationChannels: ["email", "in_app"],
    },
    quotaMaxUsers: getQuotaForPlan(options.plan || "basic", "users"),
    quotaMaxCustomers: getQuotaForPlan(options.plan || "basic", "customers"),
    quotaMaxStorage: getQuotaForPlan(options.plan || "basic", "storage"),
    quotaMaxApiCalls: getQuotaForPlan(options.plan || "basic", "apiCalls"),
    billingState: "trial",
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });

  // Create tenant
  const tenant = await storage.createTenant(tenantData);
  
  // Create admin user
  const adminUserData = insertUserSchema.parse({
    tenantId: tenant.id,
    name: options.adminName,
    email: options.adminEmail,
    password: options.adminPassword,
    role: "tenant_admin",
  });

  const adminUser = await storage.createUser(adminUserData);
  
  // Generate token for admin
  const adminToken = generateToken({
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    tenantId: adminUser.tenantId,
    role: adminUser.role,
  });

  // Seed default data (optional - can be done async)
  try {
    await seedDefaultTenantData(tenant.id);
  } catch (error: any) {
    const errorMsg = `Failed to seed default data: ${error.message}`;
    warnings.push(errorMsg);
    console.error("[PROVISIONING ERROR]", errorMsg, error);
    // Log failure but don't fail provisioning
  }

  // Log provisioning (with error handling)
  try {
    await logAudit({
      tenantId: tenant.id,
      userId: adminUser.id,
      action: "create",
      resourceType: "tenant",
      resourceId: tenant.id,
      details: { name: tenant.name, plan: tenant.plan },
    });
  } catch (error: any) {
    const errorMsg = `Failed to log provisioning audit: ${error.message}`;
    warnings.push(errorMsg);
    console.error("[PROVISIONING ERROR]", errorMsg, error);
    // Continue even if audit logging fails
  }

  return {
    tenant,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
    },
    adminToken,
    warnings,
  };
}

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

/**
 * Get quota limits based on plan
 */
function getQuotaForPlan(plan: string, resource: string): number {
  const quotas: Record<string, Record<string, number>> = {
    basic: {
      users: 10,
      customers: 1000,
      storage: 10737418240, // 10GB
      apiCalls: 10000,
    },
    pro: {
      users: 50,
      customers: 10000,
      storage: 107374182400, // 100GB
      apiCalls: 100000,
    },
    enterprise: {
      users: 1000,
      customers: 1000000,
      storage: 1073741824000, // 1TB
      apiCalls: 1000000,
    },
  };

  return quotas[plan]?.[resource] || quotas.basic[resource];
}

/**
 * Seed default tenant data (roles, pipelines, etc.)
 */
async function seedDefaultTenantData(tenantId: string): Promise<void> {
  // This can be expanded to create default pipelines, tags, etc.
  // For now, it's a placeholder
}

/**
 * Update tenant status (suspend, activate, cancel, etc.)
 */
export async function updateTenantStatus(
  tenantId: string,
  status: "active" | "trialing" | "suspended" | "canceled" | "deleted",
  updatedBy: string
): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Update tenant status (would need to add updateTenant method to storage)
  // For now, this is a placeholder - would need to update the storage layer
  
  await logAudit({
    tenantId,
    userId: updatedBy,
    action: "update",
    resourceType: "tenant",
    resourceId: tenantId,
    details: { status, previousStatus: (tenant as any).status },
  });
}

/**
 * Log audit event (placeholder - will be implemented in audit service)
 */
async function logAudit(data: {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
}): Promise<void> {
  // Will be implemented with audit service
  console.log("[AUDIT]", data);
}

