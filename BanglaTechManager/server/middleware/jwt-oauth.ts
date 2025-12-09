/**
 * OAuth2 / Keycloak JWT Verification Middleware
 * 
 * This middleware validates JWT tokens from an OIDC issuer (e.g., Keycloak)
 * using JWKS (JSON Web Key Set) for public key verification.
 * 
 * SETUP INSTRUCTIONS:
 * ===================
 * 
 * 1. KEYCLOAK DOCKER SETUP (Recommended for local development):
 *    - See docs/KEYCLOAK_SETUP.md for complete Docker Compose setup
 *    - Run: docker-compose -f docker-compose.keycloak.yml up -d
 *    - Access: http://localhost:8080 (admin/admin)
 * 
 * 2. CREATE KEYCLOAK REALM:
 *    - Login to Keycloak Admin Console
 *    - Create new realm: "shohayota-crm" (or your preferred name)
 * 
 * 3. CREATE KEYCLOAK CLIENT:
 *    - Client ID: "shohayota-crm-client" (this becomes OAUTH_CLIENT_ID)
 *    - Client Type: OpenID Connect
 *    - Valid Redirect URIs: http://localhost:5000/* (dev) or https://your-domain.com/* (prod)
 *    - Web Origins: http://localhost:5000 (dev) or https://your-domain.com (prod)
 *    - Client Authentication: On (for confidential client) or Off (for public)
 * 
 * 4. CONFIGURE TOKEN MAPPERS:
 *    - Add "tenant_id" mapper (User Attribute):
 *      * User Attribute: tenant_id
 *      * Token Claim Name: tenant_id
 *      * Add to access token: ON
 *    - Add "roles" mapper (User Realm Role):
 *      * Token Claim Name: roles
 *      * Add to access token: ON
 * 
 * 5. SET ENVIRONMENT VARIABLES:
 *    - OAUTH_ISSUER=http://localhost:8080/realms/shohayota-crm
 *    - OAUTH_CLIENT_ID=shohayota-crm-client
 * 
 * ALTERNATIVE: Local RS256 JWT Verification
 * ==========================================
 * If you prefer to use local JWT verification instead of Keycloak:
 * 
 * 1. Generate RSA key pair:
 *    openssl genrsa -out private.pem 2048
 *    openssl rsa -in private.pem -pubout -out public.pem
 * 
 * 2. Set environment variable:
 *    JWT_PUBLIC_KEY="$(cat public.pem)"
 * 
 * 3. The middleware will automatically use local JWT when JWT_PUBLIC_KEY is set
 *    and OAUTH_ISSUER is not set.
 * 
 * USAGE:
 * ======
 * The authenticate() function in server/auth.ts automatically uses this middleware
 * when OAUTH_ISSUER and OAUTH_CLIENT_ID are configured. No code changes needed
 * in your routes - it's a drop-in replacement.
 * 
 * For more details, see: docs/KEYCLOAK_SETUP.md
 */

import { Request, Response, NextFunction } from "express";
import { expressjwt, GetVerificationKey } from "express-jwt";
import { expressJwtSecret } from "jwks-rsa";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AuthenticatedUser } from "../auth";

// Extend Express Request to include auth property from express-jwt
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload | undefined;
    }
  }
}

// Environment configuration
const OAUTH_ISSUER = process.env.OAUTH_ISSUER;
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;

// Determine which auth method to use
const USE_OAUTH = !!OAUTH_ISSUER && !!OAUTH_CLIENT_ID;
const USE_LOCAL_JWT = !!JWT_PUBLIC_KEY && !USE_OAUTH;

/**
 * Extract user information from JWT claims
 * Maps OIDC standard claims to our AuthenticatedUser interface
 */
function extractUserFromClaims(claims: any): AuthenticatedUser | null {
  try {
    // Extract standard OIDC claims
    const sub = claims.sub || claims.user_id || claims.id;
    const email = claims.email || claims.preferred_username;
    const name = claims.name || claims.given_name + " " + claims.family_name || email;
    
    // Extract tenant_id from custom claim or realm/group
    const tenantId = claims.tenant_id || 
                     claims.tenantId || 
                     claims["https://your-domain.com/tenant_id"] ||
                     claims.realm_access?.tenant_id ||
                     null;
    
    // Extract roles from token
    // Keycloak provides roles in resource_access or realm_access
    const roles = claims.roles || 
                  claims.realm_access?.roles || 
                  claims.resource_access?.[OAUTH_CLIENT_ID || ""]?.roles ||
                  [];
    
    // Determine primary role (use first role or default)
    const role = roles[0] || claims.role || "support_agent";
    
    if (!sub || !email || !tenantId) {
      console.warn("[JWT] Missing required claims:", { sub, email, tenantId });
      return null;
    }
    
    return {
      id: sub,
      email,
      name,
      tenantId,
      tenant_id: tenantId, // Provide snake_case alias
      role,
      customerId: claims.customer_id || claims.customerId,
    };
  } catch (error) {
    console.error("[JWT] Error extracting user from claims:", error);
    return null;
  }
}

/**
 * OAuth2/Keycloak JWT Verification Middleware using JWKS
 * Validates JWT tokens from OIDC issuer using public keys from JWKS endpoint
 */
export function oauthJwtMiddleware() {
  if (!USE_OAUTH) {
    throw new Error("OAuth2 middleware requires OAUTH_ISSUER and OAUTH_CLIENT_ID environment variables");
  }
  
  const jwksUri = `${OAUTH_ISSUER}/.well-known/jwks.json`;
  
  return expressjwt({
    secret: expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: jwksUri,
    }) as GetVerificationKey,
    audience: OAUTH_CLIENT_ID,
    issuer: OAUTH_ISSUER,
    algorithms: ["RS256"],
    requestProperty: "auth", // Store decoded token in req.auth
  });
}

/**
 * Local RS256 JWT Verification Middleware
 * Validates JWT tokens using a provided public key
 */
export function localJwtMiddleware() {
  if (!USE_LOCAL_JWT) {
    throw new Error("Local JWT middleware requires JWT_PUBLIC_KEY environment variable");
  }
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1]; // Bearer <token>
      
      if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      
      // Verify token with public key
      const decoded = jwt.verify(token, JWT_PUBLIC_KEY!, {
        algorithms: ["RS256"],
      }) as JwtPayload;
      
      // Extract user from claims
      const user = extractUserFromClaims(decoded);
      if (!user) {
        res.status(401).json({ error: "Invalid token claims" });
        return;
      }
      
      req.user = user;
      next();
    } catch (error: any) {
      if (error.name === "JsonWebTokenError") {
        res.status(401).json({ error: "Invalid token" });
      } else if (error.name === "TokenExpiredError") {
        res.status(401).json({ error: "Token expired" });
      } else {
        console.error("[JWT] Verification error:", error);
        res.status(401).json({ error: "Token verification failed" });
      }
    }
  };
}

/**
 * Main JWT Authentication Middleware
 * Automatically selects OAuth2 or local JWT based on environment configuration
 */
export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (USE_OAUTH) {
    // Use OAuth2/Keycloak middleware
    const middleware = oauthJwtMiddleware();
    middleware(req, res, (err?: any) => {
      if (err) {
        if (err.name === "UnauthorizedError") {
          res.status(401).json({ error: "Invalid or expired token" });
        } else {
          console.error("[JWT] OAuth verification error:", err);
          res.status(401).json({ error: "Authentication failed" });
        }
        return;
      }
      
      // Extract user from decoded token in req.auth
      if (req.auth) {
        const user = extractUserFromClaims(req.auth);
        if (!user) {
          res.status(401).json({ error: "Invalid token claims" });
          return;
        }
        req.user = user;
      }
      
      next();
    });
  } else if (USE_LOCAL_JWT) {
    // Use local JWT middleware
    localJwtMiddleware()(req, res, next);
  } else {
    // Fallback: no OAuth2/local JWT configured, but this shouldn't happen
    // as the authenticate() function in auth.ts handles the fallback to local JWT
    res.status(401).json({ 
      error: "Authentication required" 
    });
  }
}

/**
 * Optional: Middleware to make OAuth2 authentication optional
 * Allows both OAuth2 and local JWT tokens
 */
export function optionalJwtAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Try OAuth2 first if configured
  if (USE_OAUTH) {
    const middleware = oauthJwtMiddleware();
    middleware(req, res, (err?: any) => {
      if (!err && req.auth) {
        const user = extractUserFromClaims(req.auth);
        if (user) {
          req.user = user;
        }
      }
      // Continue even if OAuth2 fails (allow fallback)
      next();
    });
  } else {
    next();
  }
}

