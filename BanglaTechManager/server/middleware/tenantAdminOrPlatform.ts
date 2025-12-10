import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';
import { db } from '../db';
import { storage } from '../storage';

/**
 * tenantAdminOrPlatform middleware
 * 
 * Allows:
 * - super_admin: full access to any tenant
 * - tenant_admin: only access to their own tenant (req.user.tenant_id === target tenantId)
 * 
 * If roles missing, queries users table for roles
 */
export async function tenantAdminOrPlatform(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let roles: string[] = [];
    let userTenantId: string | undefined = user.tenant_id || user.tenantId;

    // First, check if roles are in req.user (from JWT)
    if (user.roles && Array.isArray(user.roles)) {
      roles = user.roles;
    } else if (user.role) {
      roles = [user.role];
    } else {
      // If roles missing, query users table
      try {
        let result;
        if (pool) {
          result = await pool.query('SELECT roles, tenant_id FROM users WHERE id = $1', [user.id]);
        } else if (db) {
          result = await db.execute({ 
            sql: 'SELECT roles, tenant_id FROM users WHERE id = $1', 
            args: [user.id] 
          });
          result = { rows: result.rows || [] };
        } else {
          // In-memory fallback
          const dbUser = await storage.getUser(user.id);
          if (dbUser) {
            const dbRoles = (dbUser as any).roles;
            if (Array.isArray(dbRoles)) {
              roles = dbRoles;
            } else if (dbRoles) {
              roles = [dbRoles];
            }
            if (!userTenantId && dbUser.tenantId) {
              userTenantId = dbUser.tenantId;
            }
          }
          result = { rows: dbUser ? [{ roles, tenant_id: dbUser.tenantId }] : [] };
        }
        
        if (result.rows && result.rows.length > 0) {
          const dbRoles = result.rows[0].roles;
          if (Array.isArray(dbRoles)) {
            roles = dbRoles;
          } else if (dbRoles) {
            roles = [dbRoles];
          }
          
          // Also get tenant_id if not already set
          if (!userTenantId && result.rows[0].tenant_id) {
            userTenantId = result.rows[0].tenant_id;
          }
        }
      } catch (dbError) {
        console.error('[TenantAdminOrPlatform] Error querying users table:', dbError);
      }
    }

    // Super admin has full access to all tenants
    const userRole = user.role || (user as any).role;
    
    if (roles.includes('super_admin') || userRole === 'super_admin') {
      return next();
    }

    // Tenant admin can only access their own tenant
    if (roles.includes('tenant_admin') || userRole === 'tenant_admin') {
      const targetTenantId = req.params.tenantId || req.body.tenantId;
      
      if (!targetTenantId) {
        return res.status(400).json({ error: 'tenantId required' });
      }

      if (!userTenantId || userTenantId !== targetTenantId) {
        return res.status(403).json({ error: 'tenant_admin can only manage their tenant' });
      }

      return next();
    }

    res.status(403).json({ error: 'forbidden' });
  } catch (error) {
    console.error('[TenantAdminOrPlatform] Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
