/**
 * Invite Routes
 * Handles user invitation flows
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { createInviteToken, acceptInviteToken, revokeInviteToken } from "../service/invite-service";
import { logAuditEvent } from "../audit-service";
import { storage } from "../storage";
import { db } from "../db";
import { inviteTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

export function registerInviteRoutes(app: Express): void {
  // ==================== List Invites ====================
  // GET /api/invites - List invites for tenant (requires users.invite)
  app.get("/api/invites", authenticate, authorize(PERMISSIONS.USERS_INVITE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const invitesList = Array.from(memStorage.invites?.values() || [])
          .filter((inv: any) => inv.tenantId === tenantId && !inv.acceptedAt && !inv.revokedAt);
        res.json(invitesList);
        return;
      }

      const invitesList = await db.select()
        .from(inviteTokens)
        .where(eq(inviteTokens.tenantId, tenantId));

      res.json(invitesList.filter(inv => !inv.acceptedAt && !inv.revokedAt));
    } catch (error: any) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ error: error.message || "Failed to fetch invites" });
    }
  });

  // ==================== Create Invite ====================
  // POST /api/invites - Create invite token (requires users.invite)
  app.post("/api/invites", authenticate, authorize(PERMISSIONS.USERS_INVITE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { email, roleId } = req.body;

      if (!email) {
        return res.status(400).json({ error: "email is required" });
      }

      const { token, inviteId } = await createInviteToken(
        tenantId,
        email,
        roleId,
        req.user!.id,
        req.ip,
        req.headers["user-agent"]
      );

      res.status(201).json({
        id: inviteId,
        email,
        token, // Return token for testing (in production, only return in email)
        message: "Invite sent successfully",
      });
    } catch (error: any) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: error.message || "Failed to create invite" });
    }
  });

  // ==================== Accept Invite ====================
  // POST /api/invites/:token/accept - Accept invite and create user
  app.post("/api/invites/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      const { password, name } = req.body;

      if (!password) {
        return res.status(400).json({ error: "password is required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "password must be at least 6 characters" });
      }

      const { userId, email } = await acceptInviteToken(token, password, name);

      res.status(201).json({
        userId,
        email,
        message: "Account created successfully. You can now login.",
      });
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      res.status(400).json({ error: error.message || "Failed to accept invite" });
    }
  });

  // ==================== Revoke Invite ====================
  // DELETE /api/invites/:id - Revoke invite (requires users.invite)
  app.delete("/api/invites/:id", authenticate, authorize(PERMISSIONS.USERS_INVITE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const inviteId = req.params.id;

      await revokeInviteToken(inviteId, tenantId, req.user!.id, req.ip, req.headers["user-agent"]);

      res.json({ message: "Invite revoked successfully" });
    } catch (error: any) {
      console.error("Error revoking invite:", error);
      res.status(500).json({ error: error.message || "Failed to revoke invite" });
    }
  });
}

