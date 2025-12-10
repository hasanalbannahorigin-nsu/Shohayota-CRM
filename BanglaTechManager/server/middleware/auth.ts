/**
 * JWT Authentication Middleware
 * 
 * This is a dev-friendly JWT middleware. In production, replace with your
 * OAuth2/Keycloak middleware or proper JWT verification.
 * 
 * Exports checkJwt middleware that verifies HS256 JWT tokens and sets req.user
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../auth';

const JWT_SECRET = process.env.TEST_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-secret-change-me';

export interface JwtUser {
  id: string;
  tenant_id?: string;
  tenantId?: string;
  roles?: string[];
  role?: string;
  email?: string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser & { roles?: string[] };
    }
  }
}

/**
 * checkJwt middleware - verifies JWT token and sets req.user
 * 
 * Looks for token in Authorization header: "Bearer <token>"
 * Verifies HS256 JWT and extracts user claims
 * Sets req.user with id, tenant_id, and roles
 */
export function checkJwt(req: Request, res: Response, next: NextFunction): void {
  // Use existing authenticate function which handles OAuth2/Keycloak and local JWT
  authenticate(req, res, (err?: any) => {
    if (err) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Ensure req.user has roles array
    if (req.user && !req.user.roles) {
      // Extract roles from role string if present
      if (req.user.role) {
        (req.user as any).roles = [req.user.role];
      } else {
        (req.user as any).roles = [];
      }
    }
    
    next();
  });
}

