/**
 * MCP (Master Control Plane) Controller
 * Handles all MCP admin operations
 */

import { Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { tenants, users, customers, tickets, tenantFeatureFlags } from "@shared/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { logMcpAction } from "../utils/mcpAudit";
import { provisionTenant } from "../tenant-provisioning";
import { AuthenticatedUser } from "../auth";

/**
 * List all tenants (platform_admin only)
 */
export async function listTenants(req: Request, res: Response): Promise<void> {
  try {
    const { page = "1", perPage = "20", status, plan } = req.query;
    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const offset = (pageNum - 1) * perPageNum;

    if (db) {
      // Use database
      let query = db.select().from(tenants);
      
      if (status) {
        query = query.where(eq(tenants.status, status as string)) as any;
      }
      
      if (plan) {
        query = query.where(eq(tenants.plan, plan as string)) as any;
      }

      const result = await query
        .orderBy(tenants.createdAt)
        .limit(perPageNum)
        .offset(offset);

      // Get total count
      const totalResult = await db
        .select({ count: count() })
        .from(tenants);

      res.json({
        success: true,
        data: result,
        pagination: {
          page: pageNum,
          perPage: perPageNum,
          total: totalResult[0]?.count || 0,
        },
      });
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      if (!memStorage.tenants) {
        res.json({ success: true, data: [], pagination: { page: pageNum, perPage: perPageNum, total: 0 } });
        return;
      }

      let tenantList = Array.from(memStorage.tenants.values());
      
      if (status) {
        tenantList = tenantList.filter((t: any) => t.status === status);
      }
      
      if (plan) {
        tenantList = tenantList.filter((t: any) => t.plan === plan);
      }

      tenantList.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const paginated = tenantList.slice(offset, offset + perPageNum);

      res.json({
        success: true,
        data: paginated,
        pagination: {
          page: pageNum,
          perPage: perPageNum,
          total: tenantList.length,
        },
      });
    }
  } catch (error) {
    console.error("[MCP] Error listing tenants:", error);
    res.status(500).json({ error: "Failed to list tenants" });
  }
}

/**
 * Create a new tenant (platform_admin only)
 */
export async function createTenant(req: Request, res: Response): Promise<void> {
  try {
    const { name, domain, plan = "free" } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    // Generate slug from name
    const slug = (domain || name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).substring(0, 100);

    let tenant;
    
    if (db) {
      // Use database with transaction
      const result = await db.insert(tenants).values({
        name,
        slug,
        contactEmail: domain ? `admin@${domain}` : `admin@${slug}.local`,
        plan,
        status: "active",
      }).returning();

      tenant = result[0];

      // Optionally call tenant provisioning
      try {
        await provisionTenant(tenant.id, { name, plan });
      } catch (provisionError) {
        console.error("[MCP] Tenant provisioning failed:", provisionError);
        // Continue even if provisioning fails
      }
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      if (!memStorage.tenants) {
        memStorage.tenants = new Map();
      }

      const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      tenant = {
        id: tenantId,
        name,
        slug,
        contactEmail: domain ? `admin@${domain}` : `admin@${slug}.local`,
        plan,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memStorage.tenants.set(tenantId, tenant);
    }

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "create_tenant",
      tenant.id,
      { name, domain, plan }
    );

    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    console.error("[MCP] Error creating tenant:", error);
    res.status(500).json({ error: "Failed to create tenant" });
  }
}

/**
 * Get tenant details (platform_admin or tenant_admin for their tenant)
 */
export async function getTenantDetails(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    let tenant;

    if (db) {
      const result = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      tenant = result[0];
    } else {
      const memStorage = storage as any;
      tenant = memStorage.tenants?.get(tenantId);
    }

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error("[MCP] Error getting tenant details:", error);
    res.status(500).json({ error: "Failed to get tenant details" });
  }
}

/**
 * Update tenant (platform_admin only)
 */
export async function updateTenant(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const { status, plan } = req.body;
    const user = req.user as AuthenticatedUser;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    let tenant;

    if (db) {
      const updates: any = {};
      if (status) updates.status = status;
      if (plan) updates.plan = plan;
      updates.updatedAt = new Date();

      const result = await db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, tenantId))
        .returning();

      tenant = result[0];
    } else {
      const memStorage = storage as any;
      tenant = memStorage.tenants?.get(tenantId);
      
      if (tenant) {
        if (status) tenant.status = status;
        if (plan) tenant.plan = plan;
        tenant.updatedAt = new Date();
        memStorage.tenants.set(tenantId, tenant);
      }
    }

    if (!tenant) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "update_tenant",
      tenantId,
      { status, plan }
    );

    res.json({ success: true, data: tenant });
  } catch (error) {
    console.error("[MCP] Error updating tenant:", error);
    res.status(500).json({ error: "Failed to update tenant" });
  }
}

/**
 * Suspend tenant (platform_admin only)
 */
export async function suspendTenant(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    if (db) {
      await db
        .update(tenants)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    } else {
      const memStorage = storage as any;
      const tenant = memStorage.tenants?.get(tenantId);
      if (tenant) {
        tenant.status = "suspended";
        tenant.updatedAt = new Date();
        memStorage.tenants.set(tenantId, tenant);
      }
    }

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "suspend_tenant",
      tenantId,
      {}
    );

    res.json({ success: true });
  } catch (error) {
    console.error("[MCP] Error suspending tenant:", error);
    res.status(500).json({ error: "Failed to suspend tenant" });
  }
}

/**
 * Activate tenant (platform_admin only)
 */
export async function activateTenant(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    if (db) {
      await db
        .update(tenants)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    } else {
      const memStorage = storage as any;
      const tenant = memStorage.tenants?.get(tenantId);
      if (tenant) {
        tenant.status = "active";
        tenant.updatedAt = new Date();
        memStorage.tenants.set(tenantId, tenant);
      }
    }

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "activate_tenant",
      tenantId,
      {}
    );

    res.json({ success: true });
  } catch (error) {
    console.error("[MCP] Error activating tenant:", error);
    res.status(500).json({ error: "Failed to activate tenant" });
  }
}

/**
 * Run migration for tenant (platform_admin only)
 */
export async function runMigrationForTenant(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const user = req.user as AuthenticatedUser;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    // This is a prototype - in production, you would enqueue a background job
    const jobId = `migration-${tenantId}-${Date.now()}`;

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "run_migration",
      tenantId,
      { jobId }
    );

    res.json({
      success: true,
      data: {
        jobId,
        message: "Migration enqueued (prototype)",
        tenantId,
      },
    });
  } catch (error) {
    console.error("[MCP] Error running migration:", error);
    res.status(500).json({ error: "Failed to run migration" });
  }
}

/**
 * Get tenant metrics (platform_admin or tenant_admin for their tenant)
 */
export async function getTenantMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    let metrics: {
      users: number;
      customers: number;
      tickets: number;
      openTickets: number;
    };

    if (db) {
      // Use database queries
      const [usersResult, customersResult, ticketsResult, openTicketsResult] = await Promise.all([
        db.select({ count: count() }).from(users).where(eq(users.tenantId, tenantId)),
        db.select({ count: count() }).from(customers).where(eq(customers.tenantId, tenantId)),
        db.select({ count: count() }).from(tickets).where(eq(tickets.tenantId, tenantId)),
        db.select({ count: count() }).from(tickets).where(
          and(
            eq(tickets.tenantId, tenantId),
            eq(tickets.status, "open")
          )
        ),
      ]);

      metrics = {
        users: usersResult[0]?.count || 0,
        customers: customersResult[0]?.count || 0,
        tickets: ticketsResult[0]?.count || 0,
        openTickets: openTicketsResult[0]?.count || 0,
      };
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      
      const allUsers = Array.from(memStorage.users?.values() || []).filter((u: any) => u.tenantId === tenantId);
      const allCustomers = Array.from(memStorage.customers?.values() || []).filter((c: any) => c.tenantId === tenantId);
      const allTickets = Array.from(memStorage.tickets?.values() || []).filter((t: any) => t.tenantId === tenantId);
      const openTickets = allTickets.filter((t: any) => t.status === "open");

      metrics = {
        users: allUsers.length,
        customers: allCustomers.length,
        tickets: allTickets.length,
        openTickets: openTickets.length,
      };
    }

    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error("[MCP] Error getting tenant metrics:", error);
    res.status(500).json({ error: "Failed to get tenant metrics" });
  }
}

/**
 * Get tenant logs (platform_admin or tenant_admin for their tenant)
 */
export async function getTenantLogs(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const { limit = "200" } = req.query;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    const { getMcpAuditLogs } = await import("../utils/mcpAudit");
    const logs = await getMcpAuditLogs(tenantId, parseInt(limit as string, 10));

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("[MCP] Error getting tenant logs:", error);
    res.status(500).json({ error: "Failed to get tenant logs" });
  }
}

/**
 * Update feature flags for tenant (platform_admin only)
 */
export async function updateFeatureFlags(req: Request, res: Response): Promise<void> {
  try {
    const { tenantId } = req.params;
    const { flags } = req.body; // { flagKey: enabled }
    const user = req.user as AuthenticatedUser;

    if (!tenantId) {
      res.status(400).json({ error: "tenantId is required" });
      return;
    }

    if (!flags || typeof flags !== "object") {
      res.status(400).json({ error: "flags object is required" });
      return;
    }

    if (db) {
      // Update feature flags in database
      for (const [flagKey, enabled] of Object.entries(flags)) {
        await db
          .insert(tenantFeatureFlags)
          .values({
            tenantId,
            flagKey,
            enabled: enabled === true,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [tenantFeatureFlags.tenantId, tenantFeatureFlags.flagKey],
            set: {
              enabled: enabled === true,
              updatedAt: new Date(),
            },
          });
      }
    } else {
      // Use in-memory storage
      const memStorage = storage as any;
      if (!memStorage.tenantFeatureFlags) {
        memStorage.tenantFeatureFlags = new Map();
      }

      for (const [flagKey, enabled] of Object.entries(flags)) {
        const key = `${tenantId}:${flagKey}`;
        memStorage.tenantFeatureFlags.set(key, {
          tenantId,
          flagKey,
          enabled: enabled === true,
          updatedAt: new Date(),
        });
      }
    }

    // Audit log
    const roles = (user as any).roles || (user.role ? [user.role] : []);
    await logMcpAction(
      user.id,
      roles.join(",") || user.role,
      "update_feature_flags",
      tenantId,
      { flags }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("[MCP] Error updating feature flags:", error);
    res.status(500).json({ error: "Failed to update feature flags" });
  }
}

/**
 * List background jobs (platform_admin only)
 */
export async function listJobs(req: Request, res: Response): Promise<void> {
  try {
    // This is a prototype - in production, you would query your job queue
    res.json({
      success: true,
      data: [],
      message: "Job listing not yet implemented",
    });
  } catch (error) {
    console.error("[MCP] Error listing jobs:", error);
    res.status(500).json({ error: "Failed to list jobs" });
  }
}

