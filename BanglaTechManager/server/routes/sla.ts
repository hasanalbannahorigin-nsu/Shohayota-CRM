/**
 * SLA Routes
 * Handles SLA policy management
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { db } from "../db";
import { storage } from "../storage";
import { slaPolicies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";

export function registerSLARoutes(app: Express): void {
  // ==================== List SLA Policies ====================
  // GET /api/sla/policies - List SLA policies for tenant
  app.get("/api/sla/policies", authenticate, authorize(PERMISSIONS.TICKETS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const policies = Array.from(memStorage.slaPolicies?.values() || [])
          .filter((p: any) => p.tenantId === tenantId);
        res.json(policies);
        return;
      }

      const policies = await db.select()
        .from(slaPolicies)
        .where(eq(slaPolicies.tenantId, tenantId));

      res.json(policies);
    } catch (error: any) {
      console.error("Error fetching SLA policies:", error);
      res.status(500).json({ error: error.message || "Failed to fetch SLA policies" });
    }
  });

  // ==================== Create SLA Policy ====================
  // POST /api/sla/policies - Create SLA policy
  app.post("/api/sla/policies", authenticate, authorize(PERMISSIONS.TICKETS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description, responseTime, resolutionTime, priority } = req.body;

      if (!name || !responseTime || !resolutionTime) {
        return res.status(400).json({ error: "name, responseTime, and resolutionTime are required" });
      }

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        if (!memStorage.slaPolicies) {
          memStorage.slaPolicies = new Map();
        }
        const policy = {
          id: `sla-${Date.now()}`,
          tenantId,
          name,
          description: description || null,
          responseTime,
          resolutionTime,
          priority: priority || "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memStorage.slaPolicies.set(policy.id, policy);
        res.status(201).json(policy);
        return;
      }

      const [policy] = await db.insert(slaPolicies)
        .values({
          tenantId,
          name,
          description: description || null,
          responseTime,
          resolutionTime,
          priority: priority || "medium",
        })
        .returning();

      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "sla_policy",
        resourceId: policy.id,
        details: { name, responseTime, resolutionTime },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(policy);
    } catch (error: any) {
      console.error("Error creating SLA policy:", error);
      res.status(500).json({ error: error.message || "Failed to create SLA policy" });
    }
  });

  // ==================== Delete SLA Policy ====================
  // DELETE /api/sla/policies/:id - Delete SLA policy
  app.delete("/api/sla/policies/:id", authenticate, authorize(PERMISSIONS.TICKETS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const policy = memStorage.slaPolicies?.get(id);
        if (!policy || policy.tenantId !== tenantId) {
          return res.status(404).json({ error: "SLA policy not found" });
        }
        memStorage.slaPolicies.delete(id);
        res.status(204).send();
        return;
      }

      const [deleted] = await db.delete(slaPolicies)
        .where(eq(slaPolicies.id, id))
        .returning();

      if (!deleted || deleted.tenantId !== tenantId) {
        return res.status(404).json({ error: "SLA policy not found" });
      }

      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "sla_policy",
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting SLA policy:", error);
      res.status(500).json({ error: error.message || "Failed to delete SLA policy" });
    }
  });
}

