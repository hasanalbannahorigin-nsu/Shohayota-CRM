/**
 * Authorization Middleware
 * Checks user permissions before allowing access to protected routes
 */

import { Request, Response, NextFunction } from "express";
import { getEffectivePermissions, hasPermission, hasAnyPermission } from "../service/rbac-service";
import { logAuditEvent } from "../audit-service";

/**
 * Authorization middleware factory
 * Usage: app.get("/api/users", authorize("users.read"), handler)
 * Usage: app.post("/api/users", authorize(["users.create", "users.invite"]), handler)
 */
export function authorize(permissionOrPermissions: string | string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const userId = user.id;
      const tenantId = user.tenantId;
      const permissions = Array.isArray(permissionOrPermissions)
        ? permissionOrPermissions
        : [permissionOrPermissions];

      // Check if user has required permission(s)
      const hasAccess = await hasAnyPermission(userId, permissions);

      // Log the authorization attempt (only log denials to avoid audit log bloat)
      if (!hasAccess) {
        await logAuditEvent({
          tenantId,
          userId,
          action: "permission_denied",
          resourceType: "api",
          resourceId: req.path,
          details: {
            method: req.method,
            path: req.path,
            requiredPermissions: permissions,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      if (!hasAccess) {
        res.status(403).json({
          error: "Permission denied",
          required: permissions,
          message: "You do not have permission to perform this action",
        });
        return;
      }

      // Permission granted, continue
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

/**
 * Require all specified permissions (user must have ALL)
 */
export function requireAll(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (!user || !user.id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const userId = user.id;
      const tenantId = user.tenantId;
      const effectivePerms = await getEffectivePermissions(userId);
      const hasAll = permissions.every(perm => effectivePerms.has(perm));

      // Log the authorization attempt (only log denials)
      if (!hasAll) {
        await logAuditEvent({
          tenantId,
          userId,
          action: "permission_denied",
          resourceType: "api",
          resourceId: req.path,
          details: {
            method: req.method,
            path: req.path,
            requiredPermissions: permissions,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      if (!hasAll) {
        res.status(403).json({
          error: "Permission denied",
          required: permissions,
          message: "You do not have all required permissions",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}

/**
 * Require any of the specified permissions (user must have AT LEAST ONE)
 * This is the default behavior of authorize()
 */
export function requireAny(permissions: string[]) {
  return authorize(permissions);
}

