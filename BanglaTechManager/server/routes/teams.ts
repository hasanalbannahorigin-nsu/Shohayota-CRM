/**
 * Team Routes
 * Handles team management and team-role mappings
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import {
  createTeam,
  addTeamMember,
  removeTeamMember,
  assignRoleToTeam,
  removeRoleFromTeam,
} from "../service/rbac-service";
import { db } from "../db";
import { storage } from "../storage";
import { teams, teamMembers, teamRoles, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";

export function registerTeamRoutes(app: Express): void {
  // ==================== List Teams ====================
  // GET /api/teams - List teams in tenant (requires teams.read)
  app.get("/api/teams", authenticate, authorize(PERMISSIONS.TEAMS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const teamsList = Array.from(memStorage.teams?.values() || [])
          .filter((t: any) => t.tenantId === tenantId)
          .map((t: any) => {
            const memberCount = Array.from(memStorage.teamMembers?.values() || []).filter(
              (tm: any) => tm.teamId === t.id
            ).length;
            return { ...t, memberCount };
          });
        res.json(teamsList);
        return;
      }

      const teamsList = await db.select({
        id: teams.id,
        tenantId: teams.tenantId,
        name: teams.name,
        description: teams.description,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        memberCount: sql<number>`COUNT(${teamMembers.userId})`,
      })
        .from(teams)
        .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .where(eq(teams.tenantId, tenantId))
        .groupBy(teams.id);

      res.json(teamsList);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // ==================== Create Team ====================
  // POST /api/teams - Create team (requires teams.create)
  app.post("/api/teams", authenticate, authorize(PERMISSIONS.TEAMS_CREATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      const team = await createTeam(tenantId, name, description);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "team",
        resourceId: team.id,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(team);
    } catch (error: any) {
      console.error("Error creating team:", error);
      res.status(500).json({ error: error.message || "Failed to create team" });
    }
  });

  // ==================== Update Team ====================
  // PUT /api/teams/:id - Update team (requires teams.update)
  app.put("/api/teams/:id", authenticate, authorize(PERMISSIONS.TEAMS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const teamId = req.params.id;
      const { name, description } = req.body;

      let updated: any;
      if (!db) {
        const memStorage = storage as any;
        const team = memStorage.teams?.get(teamId);
        if (!team || team.tenantId !== tenantId) {
          return res.status(404).json({ error: "Team not found" });
        }
        updated = {
          ...team,
          name: name ?? team.name,
          description: description ?? team.description,
          updatedAt: new Date(),
        };
        memStorage.teams.set(teamId, updated);
      } else {
        [updated] = await db.update(teams)
          .set({
            name,
            description,
            updatedAt: new Date(),
          })
          .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)))
          .returning();
  
        if (!updated) {
          return res.status(404).json({ error: "Team not found" });
        }
      }

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "team",
        resourceId: teamId,
        details: { name, description },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating team:", error);
      res.status(500).json({ error: error.message || "Failed to update team" });
    }
  });

  // ==================== Delete Team ====================
  // DELETE /api/teams/:id - Delete team (requires teams.delete)
  app.delete("/api/teams/:id", authenticate, authorize(PERMISSIONS.TEAMS_DELETE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const teamId = req.params.id;

      if (!db) {
        const memStorage = storage as any;
        const team = memStorage.teams?.get(teamId);
        if (!team || team.tenantId !== tenantId) {
          return res.status(404).json({ error: "Team not found" });
        }
        memStorage.teams.delete(teamId);
        // clean memberships/roles
        if (memStorage.teamMembers) {
          for (const key of Array.from(memStorage.teamMembers.keys())) {
            if (key.startsWith(`${teamId}:`)) memStorage.teamMembers.delete(key);
          }
        }
        if (memStorage.teamRoles) {
          for (const key of Array.from(memStorage.teamRoles.keys())) {
            if (key.startsWith(`${teamId}:`)) memStorage.teamRoles.delete(key);
          }
        }
      } else {
        await db.delete(teams)
          .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)));
      }

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "team",
        resourceId: teamId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Team deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting team:", error);
      res.status(500).json({ error: error.message || "Failed to delete team" });
    }
  });

  // ==================== Add Team Member ====================
  // POST /api/teams/:id/members - Add member to team (requires teams.manage_members)
  app.post("/api/teams/:id/members", authenticate, authorize(PERMISSIONS.TEAMS_MANAGE_MEMBERS), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const teamId = req.params.id;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Verify user belongs to tenant
      const user = await storage.getUser(userId);
      if (!user || user.tenantId !== tenantId) {
        return res.status(404).json({ error: "User not found" });
      }

      await addTeamMember(teamId, userId);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "team",
        resourceId: teamId,
        details: { action: "add_member", memberId: userId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Member added to team successfully" });
    } catch (error: any) {
      console.error("Error adding team member:", error);
      res.status(500).json({ error: error.message || "Failed to add team member" });
    }
  });

  // ==================== Remove Team Member ====================
  // DELETE /api/teams/:id/members/:userId - Remove member from team
  app.delete("/api/teams/:id/members/:userId", authenticate, authorize(PERMISSIONS.TEAMS_MANAGE_MEMBERS), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const teamId = req.params.id;
      const userId = req.params.userId;

      if (!db) {
        const memStorage = storage as any;
        if (memStorage.teamMembers) {
          memStorage.teamMembers.delete(`${teamId}:${userId}`);
        }
      }
      await removeTeamMember(teamId, userId);

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "team",
        resourceId: teamId,
        details: { action: "remove_member", memberId: userId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Member removed from team successfully" });
    } catch (error: any) {
      console.error("Error removing team member:", error);
      res.status(500).json({ error: error.message || "Failed to remove team member" });
    }
  });

  // ==================== Assign Role to Team ====================
  // POST /api/teams/:id/roles - Assign role to team (requires teams.assign_roles)
  app.post("/api/teams/:id/roles", authenticate, authorize(PERMISSIONS.TEAMS_ASSIGN_ROLES), async (req, res) => {
    try {
      const teamId = req.params.id;
      const { roleId } = req.body;

      if (!roleId) {
        return res.status(400).json({ error: "roleId is required" });
      }

      await assignRoleToTeam(teamId, roleId);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "role_assign",
        resourceType: "team",
        resourceId: teamId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Role assigned to team successfully" });
    } catch (error: any) {
      console.error("Error assigning role to team:", error);
      res.status(500).json({ error: error.message || "Failed to assign role to team" });
    }
  });

  // ==================== Remove Role from Team ====================
  // DELETE /api/teams/:id/roles/:roleId - Remove role from team
  app.delete("/api/teams/:id/roles/:roleId", authenticate, authorize(PERMISSIONS.TEAMS_ASSIGN_ROLES), async (req, res) => {
    try {
      const teamId = req.params.id;
      const roleId = req.params.roleId;

      await removeRoleFromTeam(teamId, roleId);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "role_revoke",
        resourceType: "team",
        resourceId: teamId,
        details: { roleId },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Role removed from team successfully" });
    } catch (error: any) {
      console.error("Error removing role from team:", error);
      res.status(500).json({ error: error.message || "Failed to remove role from team" });
    }
  });

  // ==================== List Team Members ====================
  app.get("/api/teams/:id/members", authenticate, authorize(PERMISSIONS.TEAMS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const teamId = req.params.id;

      if (!db) {
        const memStorage = storage as any;
        const members = Array.from(memStorage.teamMembers?.values() || [])
          .filter((tm: any) => tm.teamId === teamId)
          .map((tm: any) => {
            const user = memStorage.users?.get(tm.userId);
            return user && user.tenantId === tenantId ? {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            } : null;
          })
          .filter(Boolean);
        return res.json(members);
      }

      const members = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
        .from(teamMembers)
        .innerJoin(users, eq(users.id, teamMembers.userId))
        .where(and(eq(teamMembers.teamId, teamId), eq(users.tenantId, tenantId)));

      res.json(members);
    } catch (error) {
      console.error("Error listing team members:", error);
      res.status(500).json({ error: "Failed to list team members" });
    }
  });
}

