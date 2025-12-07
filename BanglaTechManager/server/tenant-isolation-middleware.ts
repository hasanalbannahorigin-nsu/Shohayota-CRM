/**
 * Tenant Isolation Middleware
 * Ensures all data operations are scoped to the authenticated user's tenant
 * and prevents tenant ID injection attacks
 */

import { Request, Response, NextFunction } from "express";

/**
 * Middleware to strip tenantId from request body/params to prevent injection
 * Tenant ID should ONLY come from the authenticated user's token
 */
export function stripTenantIdFromRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Remove tenantId from body if present (security: never trust client)
  if (req.body && typeof req.body === "object") {
    delete req.body.tenantId;
  }

  // Remove tenantId from query params (except for super-admin operations)
  if (req.user?.role !== "super_admin" && req.query.tenantId) {
    delete req.query.tenantId;
  }

  next();
}

/**
 * Middleware to ensure tenant context is set from authenticated user
 */
export function ensureTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // For non-super-admins, tenantId must come from user token
  if (req.user.role !== "super_admin" && !req.user.tenantId) {
    res.status(403).json({ error: "Tenant context required" });
    return;
  }

  // Set tenant context (can be overridden by super-admin via header)
  if (req.user.role === "super_admin" && req.headers["x-tenant-id"]) {
    (req as any).tenantContext = req.headers["x-tenant-id"];
  } else {
    (req as any).tenantContext = req.user.tenantId;
  }

  next();
}

/**
 * Validate that a resource belongs to the user's tenant
 */
export function validateTenantOwnership(
  resourceTenantId: string | undefined,
  userTenantId: string | undefined,
  userRole: string
): boolean {
  // Super-admin can access any tenant
  if (userRole === "super_admin") {
    return true;
  }

  // Resource must belong to user's tenant
  if (!resourceTenantId || !userTenantId) {
    return false;
  }

  return resourceTenantId === userTenantId;
}

