/**
 * Tags Routes
 * Handles tag management for customers and tickets
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { db } from "../db";
import { storage } from "../storage";
import { tags } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";

export function registerTagsRoutes(app: Express): void {
  // ==================== List Tags ====================
  // GET /api/tags - List tags for tenant
  app.get("/api/tags", authenticate, authorize(PERMISSIONS.CUSTOMERS_READ), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const tagsList = Array.from(memStorage.tags?.values() || [])
          .filter((t: any) => t.tenantId === tenantId);
        res.json(tagsList);
        return;
      }

      const tagsList = await db.select()
        .from(tags)
        .where(eq(tags.tenantId, tenantId));

      res.json(tagsList);
    } catch (error: any) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: error.message || "Failed to fetch tags" });
    }
  });

  // ==================== Create Tag ====================
  // POST /api/tags - Create tag
  app.post("/api/tags", authenticate, authorize(PERMISSIONS.CUSTOMERS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, color, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        if (!memStorage.tags) {
          memStorage.tags = new Map();
        }
        const tag = {
          id: `tag-${Date.now()}`,
          tenantId,
          name,
          color: color || "#3b82f6",
          description: description || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memStorage.tags.set(tag.id, tag);
        res.status(201).json(tag);
        return;
      }

      const [tag] = await db.insert(tags)
        .values({
          tenantId,
          name,
          color: color || "#3b82f6",
          description: description || null,
        })
        .returning();

      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "tag",
        resourceId: tag.id,
        details: { name, color },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(tag);
    } catch (error: any) {
      console.error("Error creating tag:", error);
      res.status(500).json({ error: error.message || "Failed to create tag" });
    }
  });

  // ==================== Delete Tag ====================
  // DELETE /api/tags/:id - Delete tag
  app.delete("/api/tags/:id", authenticate, authorize(PERMISSIONS.CUSTOMERS_UPDATE), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      if (!db) {
        // In-memory mode
        const memStorage = storage as any;
        const tag = memStorage.tags?.get(id);
        if (!tag || tag.tenantId !== tenantId) {
          return res.status(404).json({ error: "Tag not found" });
        }
        memStorage.tags.delete(id);
        res.status(204).send();
        return;
      }

      const [deleted] = await db.delete(tags)
        .where(eq(tags.id, id))
        .returning();

      if (!deleted || deleted.tenantId !== tenantId) {
        return res.status(404).json({ error: "Tag not found" });
      }

      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "tag",
        resourceId: id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: error.message || "Failed to delete tag" });
    }
  });
}

