/**
 * Platform Admin Middleware
 * Ensures the user has platform_admin role
 */

import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "../auth";

export function isPlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as AuthenticatedUser & { roles?: string[] };
  
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Check if user has platform_admin role
  // Support both roles array (from OAuth2) and role string (from local JWT)
  const roles = user.roles || (user.role ? [user.role] : []);
  const hasPlatformAdmin = roles.includes("platform_admin") || user.role === "platform_admin" || user.role === "super_admin";

  if (!hasPlatformAdmin) {
    res.status(403).json({ error: "platform_admin role required" });
    return;
  }

  next();
}

