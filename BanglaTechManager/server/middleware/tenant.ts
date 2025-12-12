import { Request, Response, NextFunction } from "express";

/**
 * tenantMiddleware
 * Ensures tenant_id is present on req.user and exposes it for downstream handlers.
 * Also stores tenant/user identifiers on res.locals for RLS-aware helpers.
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId;
  if (!tenantId) {
    res.status(401).json({ error: "tenant required" });
    return;
  }

  (req as any).tenantId = tenantId;
  res.locals.tenantId = tenantId;
  res.locals.userId = (req as any).user?.id;
  res.locals.userRole = (req as any).user?.role || (req as any).user?.roles?.[0];

  next();
}

