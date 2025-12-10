import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { db } from '../db';
import { storage } from '../storage';

/**
 * isPlatformAdmin middleware - ensures user has super_admin or tenant_admin role
 * 
 * Checks req.user.roles first (if present from JWT)
 * If roles missing, queries users table for roles
 * Denies with 403 unless roles includes 'super_admin' or 'tenant_admin'
 */
export async function isPlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Debug logging
    console.log('[PlatformAdmin] Checking user:', {
      id: user.id,
      email: (user as any).email,
      role: user.role,
      roles: (user as any).roles,
    });

    let roles: string[] = [];

    // First, check if roles are in req.user (from JWT)
    // Check both roles array and role string
    if ((user as any).roles && Array.isArray((user as any).roles)) {
      roles = (user as any).roles;
    } else if (user.role) {
      // Fallback to single role string
      roles = [user.role];
    } else {
      // If roles missing, query users table
      try {
        let result;
        if (pool) {
          result = await pool.query('SELECT roles FROM users WHERE id = $1', [user.id]);
        } else if (db) {
          result = await db.execute({ 
            sql: 'SELECT roles FROM users WHERE id = $1', 
            args: [user.id] 
          });
          result = { rows: result.rows || [] };
        } else {
          // In-memory fallback
          const dbUser = await storage.getUser(user.id);
          if (dbUser) {
            // Check if user has roles array or role string
            if ((dbUser as any).roles) {
              roles = Array.isArray((dbUser as any).roles) ? (dbUser as any).roles : [(dbUser as any).roles];
            } else if (dbUser.role) {
              // Use the role from the user object
              roles = [dbUser.role];
            }
          }
          result = { rows: dbUser ? [{ roles: roles }] : [] };
        }
        
        if (result.rows && result.rows.length > 0) {
          const dbRoles = result.rows[0].roles;
          if (Array.isArray(dbRoles)) {
            roles = dbRoles;
          } else if (dbRoles) {
            roles = [dbRoles];
          }
        }
      } catch (dbError) {
        console.error('[PlatformAdmin] Error querying users table:', dbError);
        // Continue with empty roles array
      }
    }

    // Only allow super_admin and tenant_admin to access admin features
    const userRole = user.role || (user as any).role;
    
    // If no roles found from array, use the role string
    if (roles.length === 0 && userRole) {
      roles = [userRole];
    }
    
    // Check roles array first, then fallback to role string
    // Only allow super_admin and tenant_admin
    const hasAccess = 
      roles.includes('super_admin') ||
      roles.includes('tenant_admin') ||
      userRole === 'super_admin' ||
      userRole === 'tenant_admin';

    console.log('[PlatformAdmin] Access check:', {
      userId: user.id,
      email: (user as any).email,
      roles,
      userRole,
      hasAccess,
    });

    if (hasAccess) {
      console.log('[PlatformAdmin] ✅ Access granted');
      return next();
    }

    console.log('[PlatformAdmin] ❌ Access denied for user:', user.id, 'role:', userRole, 'roles:', roles);
    res.status(403).json({ error: 'super_admin or tenant_admin role required' });
  } catch (error) {
    console.error('[PlatformAdmin] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
