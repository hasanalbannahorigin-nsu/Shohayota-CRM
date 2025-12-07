/**
 * RBAC Service
 * Handles roles, permissions, teams, and effective permission calculation
 * Includes caching with Redis support (falls back to in-memory)
 */

import { storage } from "../storage";
import { db } from "../db";
import { 
  roles, 
  permissions, 
  rolePermissions, 
  userRoles, 
  userPermissionOverrides,
  teams,
  teamMembers,
  teamRoles,
  users,
  type Role,
  type Permission,
  type InsertRole,
  type InsertRolePermission,
  type InsertUserRole,
  type InsertUserPermissionOverride,
  type InsertTeam,
  type InsertTeamMember,
  type InsertTeamRole,
} from "@shared/schema";
import { eq, and, inArray, isNull, or } from "drizzle-orm";
import { PERMISSIONS } from "../config/permissions";
import { withTenantContext } from "../db-tenant-context";

// ==================== Cache Interface ====================

interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
}

// In-memory cache adapter (for development)
class InMemoryCache implements CacheAdapter {
  private cache = new Map<string, { value: any; expiresAt?: number }>();
  private subscribers = new Map<string, Set<(message: string) => void>>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    const subs = this.subscribers.get(channel);
    if (subs) {
      subs.forEach(callback => callback(message));
    }
  }

  subscribe(channel: string, callback: (message: string) => void): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
    
    return () => {
      this.subscribers.get(channel)?.delete(callback);
    };
  }
}

// Redis cache adapter (for production)
// Uncomment and configure when Redis is available
/*
import Redis from "ioredis";

class RedisCache implements CacheAdapter {
  private client: Redis;
  private pub: Redis;
  private sub: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.client = new Redis(redisUrl);
    this.pub = new Redis(redisUrl);
    this.sub = new Redis(redisUrl);
    
    // Subscribe to invalidation channel
    this.sub.subscribe("perm-invalidate");
    this.sub.on("message", (channel, message) => {
      if (channel === "perm-invalidate") {
        this.handleInvalidation(message);
      }
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.pub.publish(channel, message);
  }

  private handleInvalidation(message: string): void {
    const data = JSON.parse(message);
    if (data.userIds) {
      data.userIds.forEach((userId: string) => {
        this.del(`perm:user:${userId}`);
      });
    }
    if (data.tenantId) {
      // Invalidate all users in tenant
      // This would require a tenant->users index, simplified here
    }
  }
}
*/

// Use in-memory cache for now (can be swapped for Redis)
const cache: CacheAdapter = new InMemoryCache();

// Subscribe to invalidation messages (for multi-node support)
if (cache instanceof InMemoryCache) {
  cache.subscribe("perm-invalidate", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.userIds) {
        data.userIds.forEach((userId: string) => {
          cache.del(`perm:user:${userId}`);
        });
      }
    } catch (error) {
      console.error("Error handling cache invalidation:", error);
    }
  });
}

// ==================== Permission Cache Keys ====================
const PERM_CACHE_KEY = (userId: string) => `perm:user:${userId}`;
const PERM_CACHE_TTL = 60; // 60 seconds

// ==================== Role Management ====================

/**
 * Create a new role
 */
export async function createRole(
  tenantId: string | null,
  name: string,
  description: string | undefined,
  permissionCodes: string[]
): Promise<Role> {
  if (!db) {
    // In-memory mode - use storage
    throw new Error("Database required for RBAC operations");
  }

  // Validate permissions
  const validPermissions = await validatePermissions(permissionCodes);
  if (!validPermissions) {
    throw new Error("Invalid permission codes provided");
  }

  // Create role
  const [role] = await db.insert(roles).values({
    tenantId,
    name,
    description,
    isSystemDefault: false,
  }).returning();

  // Assign permissions
  if (permissionCodes.length > 0) {
    const permIds = await getPermissionIds(permissionCodes);
    await db.insert(rolePermissions).values(
      permIds.map(permId => ({
        roleId: role.id,
        permissionId: permId,
      }))
    );
  }

  // Invalidate cache for all users in tenant (if tenant-scoped)
  if (tenantId) {
    await invalidateTenantPermissions(tenantId);
  }

  return role;
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: {
    name?: string;
    description?: string;
    permissionCodes?: string[];
  }
): Promise<Role> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  updateData.updatedAt = new Date();

  // Update role
  const [updated] = await db.update(roles)
    .set(updateData)
    .where(eq(roles.id, roleId))
    .returning();

  if (!updated) {
    throw new Error("Role not found");
  }

  // Update permissions if provided
  if (updates.permissionCodes !== undefined) {
    // Remove existing permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Add new permissions
    if (updates.permissionCodes.length > 0) {
      const permIds = await getPermissionIds(updates.permissionCodes);
      await db.insert(rolePermissions).values(
        permIds.map(permId => ({
          roleId: roleId,
          permissionId: permId,
        }))
      );
    }

    // Invalidate cache for all users with this role
    await invalidateRolePermissions(roleId);
  }

  return updated;
}

/**
 * Delete a role (disallow if assigned, or force reassign)
 */
export async function deleteRole(
  roleId: string,
  forceReassignTo?: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  // Check if role is assigned to users
  const assignedUsers = await db.select().from(userRoles).where(eq(userRoles.roleId, roleId));

  if (assignedUsers.length > 0 && !forceReassignTo) {
    throw new Error(`Cannot delete role: ${assignedUsers.length} users have this role. Use forceReassignTo to reassign.`);
  }

  // Reassign if needed
  if (forceReassignTo && assignedUsers.length > 0) {
    await db.update(userRoles)
      .set({ roleId: forceReassignTo })
      .where(eq(userRoles.roleId, roleId));
  }

  // Delete role (cascade will handle role_permissions and user_roles)
  await db.delete(roles).where(eq(roles.id, roleId));

  // Invalidate cache for affected users
  if (assignedUsers.length > 0) {
    const userIds = assignedUsers.map(ur => ur.userId);
    await invalidateUserPermissions(userIds);
  }
}

// ==================== User Role Assignment ====================

/**
 * Assign a role to a user
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  assignedBy: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  // Check if already assigned
  const existing = await db.select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
    .limit(1);

  if (existing.length > 0) {
    return; // Already assigned
  }

  // Assign role
  await db.insert(userRoles).values({
    userId,
    roleId,
    assignedBy,
  });

  // Invalidate user's permission cache
  await invalidateUserPermissions([userId]);
}

/**
 * Revoke a role from a user
 */
export async function revokeRoleFromUser(
  userId: string,
  roleId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

  // Invalidate user's permission cache
  await invalidateUserPermissions([userId]);
}

// ==================== Effective Permissions ====================

/**
 * Get effective permissions for a user
 * Combines: role permissions + team role permissions + user overrides
 * Deny overrides take precedence over allow
 */
export async function getEffectivePermissions(userId: string): Promise<Set<string>> {
  // Check cache first
  const cacheKey = PERM_CACHE_KEY(userId);
  const cached = await cache.get<string[]>(cacheKey);
  if (cached) {
    return new Set(cached);
  }

  // Calculate effective permissions
  const effectivePerms = new Set<string>();

  // Get user's direct roles
  const userRoleIds = await getUserRoleIds(userId);
  
  // Get permissions from user's roles
  if (userRoleIds.length > 0) {
    const rolePerms = await getRolePermissions(userRoleIds);
    rolePerms.forEach(perm => effectivePerms.add(perm));
  }

  // Get permissions from user's teams
  const teamRoleIds = await getUserTeamRoleIds(userId);
  if (teamRoleIds.length > 0) {
    const teamPerms = await getRolePermissions(teamRoleIds);
    teamPerms.forEach(perm => effectivePerms.add(perm));
  }

  // Apply user permission overrides (deny takes precedence)
  const overrides = await getUserPermissionOverrides(userId);
  for (const override of overrides) {
    const permCode = await getPermissionCode(override.permissionId);
    if (override.allow) {
      effectivePerms.add(permCode);
    } else {
      effectivePerms.delete(permCode); // Deny removes permission
    }
  }

  // Cache result
  await cache.set(cacheKey, Array.from(effectivePerms), PERM_CACHE_TTL);

  return effectivePerms;
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const perms = await getEffectivePermissions(userId);
  return perms.has(permissionCode);
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
  const perms = await getEffectivePermissions(userId);
  return permissionCodes.some(code => perms.has(code));
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
  const perms = await getEffectivePermissions(userId);
  return permissionCodes.every(code => perms.has(code));
}

// ==================== Team Management ====================

/**
 * Create a team
 */
export async function createTeam(
  tenantId: string,
  name: string,
  description?: string
): Promise<Team> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  const [team] = await db.insert(teams).values({
    tenantId,
    name,
    description,
  }).returning();

  return team;
}

/**
 * Add member to team
 */
export async function addTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.insert(teamMembers).values({
    teamId,
    userId,
  });

  // Invalidate user's permission cache (team roles may grant permissions)
  await invalidateUserPermissions([userId]);
}

/**
 * Remove member from team
 */
export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  // Invalidate user's permission cache
  await invalidateUserPermissions([userId]);
}

/**
 * Assign role to team
 */
export async function assignRoleToTeam(
  teamId: string,
  roleId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.insert(teamRoles).values({
    teamId,
    roleId,
  });

  // Invalidate cache for all team members
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  const userIds = members.map(m => m.userId);
  if (userIds.length > 0) {
    await invalidateUserPermissions(userIds);
  }
}

/**
 * Remove role from team
 */
export async function removeRoleFromTeam(
  teamId: string,
  roleId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.delete(teamRoles)
    .where(and(eq(teamRoles.teamId, teamId), eq(teamRoles.roleId, roleId)));

  // Invalidate cache for all team members
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
  const userIds = members.map(m => m.userId);
  if (userIds.length > 0) {
    await invalidateUserPermissions(userIds);
  }
}

// ==================== Permission Overrides ====================

/**
 * Set user permission override (allow or deny)
 */
export async function setUserPermissionOverride(
  userId: string,
  permissionId: string,
  allow: boolean,
  createdBy: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.insert(userPermissionOverrides).values({
    userId,
    permissionId,
    allow,
    createdBy,
  }).onConflictDoUpdate({
    target: [userPermissionOverrides.userId, userPermissionOverrides.permissionId],
    set: {
      allow,
      createdBy,
    },
  });

  // Invalidate user's permission cache
  await invalidateUserPermissions([userId]);
}

/**
 * Remove user permission override
 */
export async function removeUserPermissionOverride(
  userId: string,
  permissionId: string
): Promise<void> {
  if (!db) {
    throw new Error("Database required for RBAC operations");
  }

  await db.delete(userPermissionOverrides)
    .where(and(
      eq(userPermissionOverrides.userId, userId),
      eq(userPermissionOverrides.permissionId, permissionId)
    ));

  // Invalidate user's permission cache
  await invalidateUserPermissions([userId]);
}

// ==================== Helper Functions ====================

async function getUserRoleIds(userId: string): Promise<string[]> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const userRolesList = Array.from(memStorage.userRoles?.values() || [])
      .filter((ur: any) => ur.userId === userId);
    return userRolesList.map((ur: any) => ur.roleId);
  }

  const result = await db.select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  
  return result.map(r => r.roleId);
}

async function getUserTeamRoleIds(userId: string): Promise<string[]> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const teamMembersList = Array.from(memStorage.teamMembers?.values() || [])
      .filter((tm: any) => tm.userId === userId);
    const teamIds = teamMembersList.map((tm: any) => tm.teamId);
    
    if (teamIds.length === 0) return [];
    
    const teamRolesList = Array.from(memStorage.teamRoles?.values() || [])
      .filter((tr: any) => teamIds.includes(tr.teamId));
    return teamRolesList.map((tr: any) => tr.roleId);
  }

  // Get user's teams
  const userTeams = await db.select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  if (userTeams.length === 0) return [];

  const teamIds = userTeams.map(t => t.teamId);

  // Get roles assigned to those teams
  const result = await db.select({ roleId: teamRoles.roleId })
    .from(teamRoles)
    .where(inArray(teamRoles.teamId, teamIds));

  return result.map(r => r.roleId);
}

async function getRolePermissions(roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return [];

  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const rolePermsList = Array.from(memStorage.rolePermissions?.values() || [])
      .filter((rp: any) => roleIds.includes(rp.roleId));
    const permIds = rolePermsList.map((rp: any) => rp.permissionId);
    
    const permsList = Array.from(memStorage.permissions?.values() || [])
      .filter((p: any) => permIds.includes(p.id));
    return permsList.map((p: any) => p.code);
  }

  const rolePerms = await db.select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds));

  if (rolePerms.length === 0) return [];

  const permIds = rolePerms.map(rp => rp.permissionId);
  const perms = await db.select({ code: permissions.code })
    .from(permissions)
    .where(inArray(permissions.id, permIds));

  return perms.map(p => p.code);
}

async function getUserPermissionOverrides(userId: string): Promise<Array<{ permissionId: string; allow: boolean }>> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    return Array.from(memStorage.userPermissionOverrides?.values() || [])
      .filter((upo: any) => upo.userId === userId)
      .map((upo: any) => ({ permissionId: upo.permissionId, allow: upo.allow }));
  }

  const result = await db.select({
    permissionId: userPermissionOverrides.permissionId,
    allow: userPermissionOverrides.allow,
  })
    .from(userPermissionOverrides)
    .where(eq(userPermissionOverrides.userId, userId));

  return result;
}

async function getPermissionCode(permissionId: string): Promise<string> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const perm = Array.from(memStorage.permissions?.values() || [])
      .find((p: any) => p.id === permissionId);
    return perm?.code || "";
  }

  const [perm] = await db.select({ code: permissions.code })
    .from(permissions)
    .where(eq(permissions.id, permissionId))
    .limit(1);

  return perm?.code || "";
}

async function getPermissionIds(permissionCodes: string[]): Promise<string[]> {
  if (permissionCodes.length === 0) return [];

  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    return Array.from(memStorage.permissions?.values() || [])
      .filter((p: any) => permissionCodes.includes(p.code))
      .map((p: any) => p.id);
  }

  const result = await db.select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.code, permissionCodes));

  return result.map(p => p.id);
}

async function validatePermissions(permissionCodes: string[]): Promise<boolean> {
  const allValid = permissionCodes.every(code => 
    Object.values(PERMISSIONS).includes(code as any)
  );
  return allValid;
}

// ==================== Cache Invalidation ====================

export async function invalidateUserPermissions(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await cache.del(PERM_CACHE_KEY(userId));
  }

  // Publish invalidation message for multi-node support
  await cache.publish("perm-invalidate", JSON.stringify({ userIds }));
}

async function invalidateRolePermissions(roleId: string): Promise<void> {
  if (!db) return;

  const usersWithRole = await db.select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId));

  const userIds = usersWithRole.map(u => u.userId);
  if (userIds.length > 0) {
    await invalidateUserPermissions(userIds);
  }
}

async function invalidateTenantPermissions(tenantId: string): Promise<void> {
  if (!db) return;

  const tenantUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  const userIds = tenantUsers.map(u => u.id);
  if (userIds.length > 0) {
    await invalidateUserPermissions(userIds);
  }
}

// Export types
export type Team = typeof teams.$inferSelect;

