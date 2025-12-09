/**
 * Tenant Admin or Platform Admin Middleware
 * Allows platform_admin full access, or tenant_admin only for their own tenant
 */

import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "../auth";

export function tenantAdminOrPlatform(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as AuthenticatedUser & { roles?: string[] };
  
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Support both roles array (from OAuth2) and role string (from local JWT)
  const roles = user.roles || (user.role ? [user.role] : []);
  const isPlatformAdmin = roles.includes("platform_admin") || user.role === "platform_admin" || user.role === "super_admin";
  
  if (isPlatformAdmin) {
    // Platform admin has full access
    return next();
  }

  // Check if user is tenant_admin
  const isTenantAdmin = roles.includes("tenant_admin") || user.role === "tenant_admin";
  
  if (!isTenantAdmin) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // Tenant admin can only access their own tenant
  const tenantId = req.params.tenantId || req.body.tenantId;
  
  if (!tenantId) {
    res.status(400).json({ error: "tenantId required" });
    return;
  }

  const userTenantId = user.tenantId || user.tenant_id;
  
  if (!userTenantId || userTenantId !== tenantId) {
    res.status(403).json({ error: "tenant_admin can only manage their tenant" });
    return;
  }

  next();
}

