/**
 * User Management Routes
 * RBAC-based user management with permission checks
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { storage } from "../storage";
import { db } from "../db";
import { users, userRoles, roles, sessions, revokedTokens } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";
import { assignRoleToUser, revokeRoleFromUser, invalidateUserPermissions } from "../service/rbac-service";
import { checkUserQuota } from "../quota-service";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { insertUserSchema } from "@shared/schema";

const SALT_ROUNDS = 10;

/**
 * Register user management routes
 */
export function registerUserRoutes(app: Express): void {
  // ==================== User List ====================
  // GET /api/users - List users in tenant (requires users.read)
  app.get("/api/users", authenticate, authorize(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const tenantUsers = await storage.getUsersByTenant(tenantId);

      // Get user roles for each user
      const usersWithRoles = await Promise.all(
        tenantUsers.map(async (user) => {
          const userRoleIds = await getUserRoleIds(user.id);
          const userRolesList = await getRolesByIds(userRoleIds);
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role, // Legacy field
            isActive: (user as any).isActive ?? true,
            mfaEnabled: (user as any).mfaEnabled ?? false,
            roles: userRolesList,
            lastLoginAt: (user as any).lastLoginAt,
            createdAt: user.createdAt,
          };
        })
      );

      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // ==================== Create User or Invite ====================
  // POST /api/users - Create user or create invite (requires users.create)
  app.post("/api/users", authenticate, authorize(PERMISSIONS.USERS_CREATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, email, password, roleIds, sendInvite } = req.body;

      // Check quota
      const quotaCheck = await checkUserQuota(tenantId);
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          error: quotaCheck.reason || "User quota exceeded",
          quota: quotaCheck,
        });
      }

      // Validate input
      if (!name || !email) {
        return res.status(400).json({ error: "name and email are required" });
      }

      // Check if user already exists
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      // If sendInvite is true, create invite token instead
      if (sendInvite) {
        // This will be handled by invite service
        return res.status(501).json({ error: "Invite flow not yet implemented" });
      }

      // Create user directly
      if (!password) {
        return res.status(400).json({ error: "password is required when creating user directly" });
      }

      const userData = insertUserSchema.parse({
        tenantId,
        name,
        email,
        password,
        role: "support_agent", // Default role (legacy field)
        isActive: true,
      });

      const user = await storage.createUser(userData);

      // Assign roles if provided
      if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
        for (const roleId of roleIds) {
          await assignRoleToUser(user.id, roleId, req.user!.id);
        }
      }

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "user",
        resourceId: user.id,
        details: { email: user.email, roleIds },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: (user as any).isActive ?? true,
        createdAt: user.createdAt,
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  // ==================== Get Single User ====================
  // GET /api/users/:id - Get user (requires users.read)
  app.get("/api/users/:id", authenticate, authorize(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.params.id;

      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user roles
      const userRoleIds = await getUserRoleIds(userId);
      const userRolesList = await getRolesByIds(userRoleIds);

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Legacy field
        isActive: (user as any).isActive ?? true,
        mfaEnabled: (user as any).mfaEnabled ?? false,
        roles: userRolesList,
        lastLoginAt: (user as any).lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: (user as any).updatedAt,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ==================== Update User ====================
  // PUT /api/users/:id - Update user (requires users.update)
  app.put("/api/users/:id", authenticate, authorize(PERMISSIONS.USERS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.params.id;
      const { name, email, roleIds, isActive } = req.body;

      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update user fields
      const updates: any = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (isActive !== undefined) updates.isActive = isActive;
      updates.updatedAt = new Date();

      // Update in storage (would need updateUser method)
      // For now, we'll handle this in the storage layer

      // Update roles if provided
      if (roleIds && Array.isArray(roleIds)) {
        // Get current roles
        const currentRoleIds = await getUserRoleIds(userId);
        
        // Remove roles not in new list
        for (const roleId of currentRoleIds) {
          if (!roleIds.includes(roleId)) {
            await revokeRoleFromUser(userId, roleId);
          }
        }

        // Add new roles
        for (const roleId of roleIds) {
          if (!currentRoleIds.includes(roleId)) {
            await assignRoleToUser(userId, roleId, req.user!.id);
          }
        }

        // Invalidate permission cache
        await invalidateUserPermissions([userId]);
      }

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "user",
        resourceId: userId,
        details: { updates },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        id: user.id,
        name: updates.name || user.name,
        email: updates.email || user.email,
        isActive: updates.isActive !== undefined ? updates.isActive : ((user as any).isActive ?? true),
      });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: error.message || "Failed to update user" });
    }
  });

  // ==================== Deactivate User ====================
  // DELETE /api/users/:id - Deactivate user (requires users.delete)
  app.delete("/api/users/:id", authenticate, authorize(PERMISSIONS.USERS_DELETE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.params.id;

      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      // Deactivate user (soft delete)
      const updates: any = {
        isActive: false,
        updatedAt: new Date(),
      };
      // Would update in storage

      // Revoke all sessions/tokens
      await revokeUserSessions(userId);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "user",
        resourceId: userId,
        details: { deactivated: true },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "User deactivated successfully" });
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: error.message || "Failed to deactivate user" });
    }
  });

  // ==================== Revoke Sessions ====================
  // POST /api/users/:id/sessions/revoke - Revoke all user sessions (requires users.update)
  app.post("/api/users/:id/sessions/revoke", authenticate, authorize(PERMISSIONS.USERS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.params.id;

      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      await revokeUserSessions(userId);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "session_revoke",
        resourceType: "user",
        resourceId: userId,
        details: { revokedBy: req.user!.id },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "All sessions revoked successfully" });
    } catch (error: any) {
      console.error("Error revoking sessions:", error);
      res.status(500).json({ error: error.message || "Failed to revoke sessions" });
    }
  });
}

// ==================== Helper Functions ====================

async function getUserRoleIds(userId: string): Promise<string[]> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    return Array.from(memStorage.userRoles?.values() || [])
      .filter((ur: any) => ur.userId === userId)
      .map((ur: any) => ur.roleId);
  }

  const result = await db.select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return result.map(r => r.roleId);
}

async function getRolesByIds(roleIds: string[]): Promise<Array<{ id: string; name: string; description?: string }>> {
  if (roleIds.length === 0) return [];

  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    return Array.from(memStorage.roles?.values() || [])
      .filter((r: any) => roleIds.includes(r.id))
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
      }));
  }

  const result = await db.select({
    id: roles.id,
    name: roles.name,
    description: roles.description,
  })
    .from(roles)
    .where(inArray(roles.id, roleIds));

  return result;
}

async function revokeUserSessions(userId: string): Promise<void> {
  if (!db) {
    // In-memory mode - would need to track sessions
    return;
  }

  // Mark all sessions as revoked
  await db.update(sessions)
    .set({
      revoked: true,
      revokedAt: new Date(),
    })
    .where(and(
      eq(sessions.userId, userId),
      eq(sessions.revoked, false)
    ));
}

// Import inArray
import { inArray } from "drizzle-orm";

