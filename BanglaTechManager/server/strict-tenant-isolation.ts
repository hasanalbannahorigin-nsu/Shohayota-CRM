/**
 * Strict Tenant Isolation Helper
 * Ensures ALL queries are filtered by tenantId
 */

import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "./auth";

/**
 * Get tenantId for the current request
 * - For super_admin: can use ?tenantId= query param (if provided)
 * - For all others: MUST use req.user.tenantId
 */
export function getRequestTenantId(req: Request): string | null {
  const user = req.user as AuthenticatedUser | undefined;
  
  if (!user) {
    return null;
  }

  // Super admin can access other tenants via ?tenantId= query param
  if (user.role === "super_admin") {
    const queryTenantId = req.query.tenantId as string | undefined;
    if (queryTenantId) {
      return queryTenantId;
    }
    // If no ?tenantId= provided, super_admin uses their own tenantId (system tenant)
    return user.tenantId || (user as any).tenant_id || null;
  }

  // All other roles MUST use their own tenantId
  return user.tenantId || (user as any).tenant_id || null;
}

/**
 * Middleware to enforce strict tenant isolation
 * Ensures tenantId is always set and valid
 */
export function enforceStrictTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tenantId = getRequestTenantId(req);
  
  if (!tenantId) {
    return res.status(403).json({ 
      error: "Tenant context required. Please ensure you are authenticated." 
    });
  }

  // Store tenantId in request for use in routes
  (req as any).tenantId = tenantId;
  next();
}

/**
 * Prevent tenant spoofing in request body
 * Strips tenantId from body for non-super-admins
 */
export function preventTenantSpoofing(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as AuthenticatedUser | undefined;
  
  if (!user) {
    return next();
  }

  // Super admin can set tenantId in body (for cross-tenant operations)
  if (user.role === "super_admin") {
    // Allow tenantId in body, but validate it exists
    if (req.body.tenantId && !req.query.tenantId) {
      // If tenantId in body but not in query, use body value
      (req as any).tenantId = req.body.tenantId;
    }
    return next();
  }

  // For all other roles: STRIP tenantId from body - it comes from JWT only
  if (req.body && typeof req.body === "object") {
    delete req.body.tenantId;
  }

  // Also strip from query params (except super_admin)
  if (req.query.tenantId) {
    delete req.query.tenantId;
  }

  next();
}

/**
 * Validate that a resource belongs to the requested tenant
 */
export function validateResourceTenant(
  resourceTenantId: string | undefined | null,
  requestTenantId: string,
  userRole: string
): boolean {
  // Super admin can access any tenant
  if (userRole === "super_admin") {
    return true;
  }

  // Resource must belong to user's tenant
  if (!resourceTenantId || !requestTenantId) {
    return false;
  }

  return resourceTenantId === requestTenantId;
}

