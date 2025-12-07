// server/tenant-middleware.ts
import { Request, Response, NextFunction } from "express";

/**
 * Tenant middleware:
 * - expects req.user to be populated by auth middleware (server/auth.ts)
 * - sets req.tenantId and ensures user belongs to that tenant (or superadmin)
 */
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  // auth middleware should have attached req.user
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // if super admin can operate cross-tenant, you may pass tenant as query/header
  if (user.role === "superadmin" || user.role === "super-admin") {
    // allow tenant override via header X-Tenant-Id (optional)
    const override = req.header("X-Tenant-Id") || req.query.tenantId;
    if (override) {
      req.tenantId = String(override);
      return next();
    }
    // else allow, but tenantId must be provided on operation level
    return next();
  }

  // normal user: their token must include tenantId
  if (!user.tenantId) {
    return res.status(403).json({ error: "Tenant not associated with user token" });
  }
  req.tenantId = user.tenantId;
  next();
}
