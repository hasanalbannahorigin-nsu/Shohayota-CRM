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
  // Provide snake_case alias for middleware that expects tenant_id
  tenant_id?: string;
  role: string;
  customerId?: string; // For customer role users, links to customers table
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
// Supports both OAuth2/Keycloak JWT (via authenticateJWT) and local JWT tokens
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check if OAuth2/Keycloak is configured
  const OAUTH_ISSUER = process.env.OAUTH_ISSUER;
  const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
  const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
  
  // If OAuth2 is configured, use OAuth2 middleware
  if (OAUTH_ISSUER && OAUTH_CLIENT_ID) {
    const { authenticateJWT } = await import("./middleware/jwt-oauth");
    return authenticateJWT(req, res, next);
  }
  
  // If local JWT public key is configured, use local JWT middleware
  if (JWT_PUBLIC_KEY) {
    const { localJwtMiddleware } = await import("./middleware/jwt-oauth");
    return localJwtMiddleware()(req, res, next);
  }
  
  // Fallback to local JWT with SESSION_SECRET (existing behavior)
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

  // Ensure required fields are present for downstream handlers
  const tenantId = user.tenantId ?? (user as any).tenant_id;
  if (!user.role || !tenantId) {
    res.status(401).json({ error: "Invalid token payload" });
    return;
  }

  // Guarantee both tenantId and tenant_id are present for downstream handlers
  // Also ensure customerId is preserved for customer users
  req.user = {
    ...user,
    role: user.role,
    tenantId: tenantId,
    tenant_id: tenantId,
    customerId: user.customerId || (user as any).customerId, // Preserve customerId
  };
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

// Middleware to require customer role and ensure customerId exists
export function requireCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Ensure JSON response
  res.setHeader("Content-Type", "application/json");

  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "customer") {
    res.status(403).json({ error: "This endpoint is only available for customers" });
    return;
  }

  if (!req.user.customerId) {
    console.error("[AUTH] Customer user missing customerId:", {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });
    res.status(403).json({ error: "Customer account not properly configured. Please contact support." });
    return;
  }

  next();
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
