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
import { teams, teamMembers, teamRoles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
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
          .filter((t: any) => t.tenantId === tenantId);
        res.json(teamsList);
        return;
      }

      const teamsList = await db.select()
        .from(teams)
        .where(eq(teams.tenantId, tenantId));

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

      if (!db) {
        return res.status(501).json({ error: "Team update requires database" });
      }

      const [updated] = await db.update(teams)
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
        return res.status(501).json({ error: "Team deletion requires database" });
      }

      await db.delete(teams)
        .where(and(eq(teams.id, teamId), eq(teams.tenantId, tenantId)));

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
}

// Import storage
import { storage } from "../storage";

