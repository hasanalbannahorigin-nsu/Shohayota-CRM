/**
 * Role and Permission Service
 * Manages role templates and per-tenant role customizations
 */

import { storage } from "./storage";
import { insertRoleTemplateSchema, insertTenantRoleSchema, type InsertRoleTemplate, type InsertTenantRole } from "@shared/schema";

export interface PermissionSet {
  customers?: { read: boolean; create: boolean; update: boolean; delete: boolean };
  tickets?: { read: boolean; create: boolean; update: boolean; delete: boolean };
  users?: { read: boolean; create: boolean; update: boolean; delete: boolean };
  settings?: { read: boolean; update: boolean };
  analytics?: { read: boolean };
}

/**
 * Initialize default role templates
 */
export async function initializeRoleTemplates(): Promise<void> {
  const templates = [
    {
      name: "super_admin",
      displayName: "Super Administrator",
      description: "Full system access across all tenants",
      permissions: {
        customers: { read: true, create: true, update: true, delete: true },
        tickets: { read: true, create: true, update: true, delete: true },
        users: { read: true, create: true, update: true, delete: true },
        settings: { read: true, update: true },
        analytics: { read: true },
      },
      isSystem: true,
    },
    {
      name: "tenant_admin",
      displayName: "Tenant Administrator",
      description: "Full access within tenant",
      permissions: {
        customers: { read: true, create: true, update: true, delete: true },
        tickets: { read: true, create: true, update: true, delete: true },
        users: { read: true, create: true, update: true, delete: false },
        settings: { read: true, update: true },
        analytics: { read: true },
      },
      isSystem: true,
    },
    {
      name: "support_agent",
      displayName: "Support Agent",
      description: "Can manage customers and tickets",
      permissions: {
        customers: { read: true, create: true, update: true, delete: false },
        tickets: { read: true, create: true, update: true, delete: false },
        users: { read: true, create: false, update: false, delete: false },
        settings: { read: false, update: false },
        analytics: { read: true },
      },
      isSystem: true,
    },
    {
      name: "customer",
      displayName: "Customer",
      description: "Limited read-only access",
      permissions: {
        customers: { read: true, create: false, update: false, delete: false },
        tickets: { read: true, create: true, update: false, delete: false },
        users: { read: false, create: false, update: false, delete: false },
        settings: { read: false, update: false },
        analytics: { read: false },
      },
      isSystem: true,
    },
  ];

  for (const template of templates) {
    const existing = await storage.getRoleTemplate(template.name);
    if (!existing) {
      await storage.createRoleTemplate(insertRoleTemplateSchema.parse(template));
    }
  }
}

/**
 * Get effective permissions for a role in a tenant
 * Returns tenant-specific overrides if they exist, otherwise global template
 */
export async function getEffectivePermissions(
  tenantId: string,
  roleName: string
): Promise<PermissionSet> {
  // Check for tenant-specific role
  const tenantRole = await storage.getTenantRole(tenantId, roleName);
  if (tenantRole && tenantRole.permissions) {
    return tenantRole.permissions as PermissionSet;
  }

  // Fall back to global template
  const template = await storage.getRoleTemplate(roleName);
  if (template) {
    return template.permissions as PermissionSet;
  }

  // Default: no permissions
  return {};
}

/**
 * Check if user has permission for an action
 */
export async function hasPermission(
  tenantId: string,
  roleName: string,
  resourceType: "customers" | "tickets" | "users" | "settings" | "analytics",
  action: "read" | "create" | "update" | "delete"
): Promise<boolean> {
  const permissions = await getEffectivePermissions(tenantId, roleName);
  const resourcePerms = permissions[resourceType];
  
  if (!resourcePerms) return false;
  
  // For settings, only read/update are valid
  if (resourceType === "settings" && (action === "create" || action === "delete")) {
    return false;
  }
  
  // For analytics, only read is valid
  if (resourceType === "analytics" && action !== "read") {
    return false;
  }

  return resourcePerms[action] === true;
}

/**
 * Create or update tenant-specific role
 */
export async function setTenantRole(
  tenantId: string,
  roleName: string,
  permissions: PermissionSet,
  displayName?: string
): Promise<any> {
  const existing = await storage.getTenantRole(tenantId, roleName);
  
  if (existing) {
    return await storage.updateTenantRole(existing.id, tenantId, {
      permissions: permissions as any,
      displayName,
    });
  } else {
    return await storage.createTenantRole(insertTenantRoleSchema.parse({
      tenantId,
      roleName,
      displayName,
      permissions: permissions as any,
      isActive: true,
    }));
  }
}

/**
 * Get all roles for a tenant (with effective permissions)
 */
export async function getTenantRolesWithPermissions(tenantId: string): Promise<Array<{
  name: string;
  displayName: string;
  permissions: PermissionSet;
  isCustom: boolean;
}>> {
  const templates = await storage.getAllRoleTemplates();
  const tenantRoles = await storage.getTenantRoles(tenantId);
  
  const tenantRoleMap = new Map(tenantRoles.map(r => [r.roleName, r]));

  return templates.map(template => {
    const tenantRole = tenantRoleMap.get(template.name);
    return {
      name: template.name,
      displayName: tenantRole?.displayName || template.displayName,
      permissions: (tenantRole?.permissions || template.permissions) as PermissionSet,
      isCustom: !!tenantRole,
    };
  });
}

/**
 * Validate that a role name exists in role templates
 */
export async function validateRole(roleName: string): Promise<boolean> {
  const template = await storage.getRoleTemplate(roleName);
  return !!template;
}

/**
 * Get all available role names from templates
 */
export async function getAvailableRoles(): Promise<string[]> {
  const templates = await storage.getAllRoleTemplates();
  return templates.map(t => t.name);
}

