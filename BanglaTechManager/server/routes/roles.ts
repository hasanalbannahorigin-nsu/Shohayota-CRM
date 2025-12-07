/**
 * Role Routes
 * Handles role management and role-permission assignments
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import {
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  revokeRoleFromUser,
  getEffectivePermissions,
} from "../service/rbac-service";
import { db } from "../db";
import { storage } from "../storage";
import { roles, rolePermissions, permissions } from "@shared/schema";
import { eq, and, isNull, or, inArray } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";

export function registerRoleRoutes(app: Express): void {
  // ==================== List Roles ====================
  // GET /api/roles - List roles (requires roles.read)
  app.get("/api/roles", authenticate, authorize(PERMISSIONS.ROLES_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const rolesList = Array.from(memStorage.roles?.values() || [])
          .filter((r: any) => r.tenantId === tenantId || r.tenantId === null);
        res.json(rolesList);
        return;
      }

      // Get tenant-scoped roles and global roles
      const rolesList = await db.select()
        .from(roles)
        .where(or(
          eq(roles.tenantId, tenantId),
          isNull(roles.tenantId)
        ));

      // Get permissions for each role
      const rolesWithPerms = await Promise.all(
        rolesList.map(async (role) => {
          const permIds = await getRolePermissionIds(role.id);
          const perms = await getPermissionsByIds(permIds);
          
          return {
            ...role,
            permissions: perms.map(p => p.code),
          };
        })
      );

      res.json(rolesWithPerms);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // ==================== Get All Permissions ====================
  // GET /api/roles/permissions - Get all available permissions (requires roles.read)
  app.get("/api/roles/permissions", authenticate, authorize(PERMISSIONS.ROLES_READ), async (req, res) => {
    try {
      if (!db) {
        // In-memory mode - return mock permissions
        const mockPermissions = [
          { code: "users.read", name: "Read Users", category: "users" },
          { code: "users.create", name: "Create Users", category: "users" },
          { code: "users.update", name: "Update Users", category: "users" },
          { code: "users.delete", name: "Delete Users", category: "users" },
          { code: "tickets.read", name: "Read Tickets", category: "tickets" },
          { code: "tickets.create", name: "Create Tickets", category: "tickets" },
          { code: "tickets.update", name: "Update Tickets", category: "tickets" },
          { code: "tickets.delete", name: "Delete Tickets", category: "tickets" },
        ];
        res.json(mockPermissions);
        return;
      }

      const allPermissions = await db.select().from(permissions);
      res.json(allPermissions);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch permissions" });
    }
  });

  // ==================== Create Role ====================
  // POST /api/roles - Create role (requires roles.create)
  app.post("/api/roles", authenticate, authorize(PERMISSIONS.ROLES_CREATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description, permissionCodes } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      const role = await createRole(tenantId, name, description, permissionCodes || []);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "role",
        resourceId: role.id,
        details: { name, description, permissionCodes },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(role);
    } catch (error: any) {
      console.error("Error creating role:", error);
      res.status(500).json({ error: error.message || "Failed to create role" });
    }
  });

  // ==================== Update Role ====================
  // PUT /api/roles/:id - Update role (requires roles.update)
  app.put("/api/roles/:id", authenticate, authorize(PERMISSIONS.ROLES_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const roleId = req.params.id;
      const { name, description, permissionCodes } = req.body;

      const role = await updateRole(roleId, {
        name,
        description,
        permissionCodes,
      });

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "role",
        resourceId: roleId,
        details: { name, description, permissionCodes },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(role);
    } catch (error: any) {
      console.error("Error updating role:", error);
      res.status(500).json({ error: error.message || "Failed to update role" });
    }
  });

  // ==================== Delete Role ====================
  // DELETE /api/roles/:id - Delete role (requires roles.delete)
  app.delete("/api/roles/:id", authenticate, authorize(PERMISSIONS.ROLES_DELETE), async (req, res) => {
    try {
      const roleId = req.params.id;
      const { forceReassignTo } = req.body;

      await deleteRole(roleId, forceReassignTo);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "role",
        resourceId: roleId,
        details: { forceReassignTo },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Role deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting role:", error);
      res.status(500).json({ error: error.message || "Failed to delete role" });
    }
  });

  // ==================== Assign Role to User ====================
  // POST /api/roles/:roleId/assign - Assign role to user (requires roles.assign)
  app.post("/api/roles/:roleId/assign", authenticate, authorize(PERMISSIONS.ROLES_ASSIGN), async (req, res) => {
    try {
      const roleId = req.params.roleId;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      await assignRoleToUser(userId, roleId, req.user!.id);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "role_assign",
        resourceType: "user",
        resourceId: userId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Role assigned successfully" });
    } catch (error: any) {
      console.error("Error assigning role:", error);
      res.status(500).json({ error: error.message || "Failed to assign role" });
    }
  });

  // ==================== Revoke Role from User ====================
  // POST /api/roles/:roleId/revoke - Revoke role from user (requires roles.revoke)
  app.post("/api/roles/:roleId/revoke", authenticate, authorize(PERMISSIONS.ROLES_REVOKE), async (req, res) => {
    try {
      const roleId = req.params.roleId;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      await revokeRoleFromUser(userId, roleId);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "role_revoke",
        resourceType: "user",
        resourceId: userId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Role revoked successfully" });
    } catch (error: any) {
      console.error("Error revoking role:", error);
      res.status(500).json({ error: error.message || "Failed to revoke role" });
    }
  });

  // ==================== Get User Permissions ====================
  // GET /api/users/:id/permissions - Get effective permissions for user
  app.get("/api/users/:id/permissions", authenticate, authorize(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.params.id;

      // Verify user belongs to tenant
      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      const effectivePerms = await getEffectivePermissions(userId);

      res.json({
        userId,
        permissions: Array.from(effectivePerms),
      });
    } catch (error: any) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch permissions" });
    }
  });
}

// ==================== Helper Functions ====================

async function getRolePermissionIds(roleId: string): Promise<string[]> {
  if (!db) {
    const memStorage = storage as any;
    return Array.from(memStorage.rolePermissions?.values() || [])
      .filter((rp: any) => rp.roleId === roleId)
      .map((rp: any) => rp.permissionId);
  }

  const result = await db.select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  return result.map(r => r.permissionId);
}

async function getPermissionsByIds(permIds: string[]): Promise<Array<{ id: string; code: string }>> {
  if (permIds.length === 0) return [];

  if (!db) {
    const memStorage = storage as any;
    return Array.from(memStorage.permissions?.values() || [])
      .filter((p: any) => permIds.includes(p.id))
      .map((p: any) => ({ id: p.id, code: p.code }));
  }

  const result = await db.select({
    id: permissions.id,
    code: permissions.code,
  })
    .from(permissions)
    .where(inArray(permissions.id, permIds));

  return result;
}

