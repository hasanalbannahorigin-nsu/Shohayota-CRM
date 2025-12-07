import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./storage";

// Use an environment-provided secret in production, but fall back to a
// development-only default so the app can run without manual configuration.
const JWT_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const JWT_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY = "30d";

// In-memory refresh token store (use Redis in production)
const refreshTokens = new Map<string, { userId: string; expiresAt: number }>();

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function generateRefreshToken(userId: string): string {
  const refreshToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
  refreshTokens.set(refreshToken, { userId, expiresAt });
  return refreshToken;
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const tokenData = refreshTokens.get(token);
    
    if (!tokenData || tokenData.userId !== decoded.userId) {
      return null;
    }
    
    if (tokenData.expiresAt < Date.now()) {
      refreshTokens.delete(token);
      return null;
    }
    
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

export function revokeRefreshToken(token: string): void {
  refreshTokens.delete(token);
}

// Middleware to authenticate requests
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1]; // Bearer <token>

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}

// Middleware to verify tenant access and enforce tenant isolation
export function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tenantId = req.params.tenantId || req.body.tenantId;
  
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Super admin can access all tenants
  if (req.user.role === "super_admin") {
    next();
    return;
  }

  // Regular users can only access their own tenant
  if (tenantId && req.user.tenantId !== tenantId) {
    res.status(403).json({ error: "Forbidden: Access to this tenant is not allowed" });
    return;
  }

  next();
}

// Middleware to check user roles
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Super admin has all permissions
    if (req.user.role === "super_admin") {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions: This action requires a higher role" });
      return;
    }

    next();
  };
}

// Middleware to enforce strict tenant isolation
export function enforceTenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.tenantId) {
    res.status(400).json({ error: "Tenant context is required" });
    return;
  }

  // For non-super-admins, enforce strict tenant matching
  if (req.user.role !== "super_admin") {
    // Check query string or path parameters
    const paramTenant = req.params.tenantId;
    const bodyTenant = req.body?.tenantId;

    if ((paramTenant && paramTenant !== req.user.tenantId) ||
        (bodyTenant && bodyTenant !== req.user.tenantId)) {
      res.status(403).json({ error: "Forbidden: You can only access resources within your tenant" });
      return;
    }
  }

  next();
}
