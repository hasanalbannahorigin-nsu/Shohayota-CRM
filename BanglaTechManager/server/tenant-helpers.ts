/**
 * Tenant Isolation Helpers
 * 
 * Centralized functions for enforcing strict multi-tenant isolation
 * across all endpoints in the CRM.
 */

import { Request } from "express";
import { AuthenticatedUser } from "./auth";

/**
 * Get tenant ID from authenticated user with super_admin support
 * 
 * Rules:
 * - Super Admin: Can optionally filter by ?tenantId= query param
 * - Tenant Admin/Agent/Customer: MUST use their own tenantId only
 * 
 * @param req Express request with authenticated user
 * @returns Tenant ID to use for filtering
 */
export function getTenantIdForQuery(req: Request & { user?: AuthenticatedUser }): string | null {
  const user = req.user;
  
  if (!user) {
    return null;
  }

  // Super admin can optionally filter by tenant
  if (user.role === "super_admin") {
    const queryTenantId = req.query.tenantId as string | undefined;
    if (queryTenantId) {
      return queryTenantId;
    }
    // Super admin without tenant filter can see all - return null to indicate "all tenants"
    return null;
  }

  // Non-super-admin: STRICT isolation - only their tenant
  if (!user.tenantId) {
    throw new Error("Tenant context required");
  }

  return user.tenantId;
}

/**
 * Get tenant ID for CREATE/UPDATE operations
 * 
 * Rules:
 * - Super Admin: Can specify tenantId in body/query, but must validate it
 * - Tenant Admin/Agent/Customer: MUST use their own tenantId, ignore any in body
 * 
 * @param req Express request with authenticated user
 * @returns Tenant ID to use for creating/updating resources
 */
export function getTenantIdForMutation(req: Request & { user?: AuthenticatedUser }): string {
  const user = req.user;
  
  if (!user) {
    throw new Error("Authentication required");
  }

  // Super admin can create/update for any tenant (must explicitly specify)
  if (user.role === "super_admin") {
    const tenantId = (req as any).tenantContext || req.body.tenantId || req.query.tenantId || user.tenantId;
    if (!tenantId) {
      throw new Error("Tenant ID required for super admin operations");
    }
    return tenantId as string;
  }

  // Non-super-admin: STRICT isolation - force their tenantId
  if (!user.tenantId) {
    throw new Error("Tenant context required");
  }

  // CRITICAL: Ignore any tenantId in request body for non-super-admin
  return user.tenantId;
}

/**
 * Validate tenant ownership of a resource
 * 
 * @param resourceTenantId Tenant ID of the resource
 * @param user User making the request
 * @returns true if user can access the resource
 */
export function canAccessTenantResource(
  resourceTenantId: string | undefined | null,
  user: AuthenticatedUser
): boolean {
  // Super admin can access any tenant
  if (user.role === "super_admin") {
    return true;
  }

  // Resource must belong to user's tenant
  if (!resourceTenantId || !user.tenantId) {
    return false;
  }

  return resourceTenantId === user.tenantId;
}

/**
 * Strip tenantId from request body to prevent injection
 * 
 * @param body Request body object
 * @returns Body without tenantId field
 */
export function stripTenantIdFromBody<T extends Record<string, any>>(body: T): Omit<T, 'tenantId'> {
  const { tenantId, ...rest } = body;
  return rest;
}

/**
 * Ensure tenantId in data matches authenticated user's tenant
 * 
 * @param data Data object that may contain tenantId
 * @param user Authenticated user
 * @returns Data with correct tenantId
 */
export function enforceTenantId<T extends { tenantId?: string }>(
  data: T,
  user: AuthenticatedUser
): T & { tenantId: string } {
  const tenantId = getTenantIdForMutation({ user } as any);
  return {
    ...data,
    tenantId, // Force correct tenantId
  };
}

