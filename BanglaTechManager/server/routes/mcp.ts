/**
 * MCP (Master Control Plane) Routes
 * All routes are prefixed with /mcp/api
 */

import { Router } from "express";
import * as mcpController from "../controllers/mcpController";
import { isPlatformAdmin } from "../middleware/platformAdmin";
import { tenantAdminOrPlatform } from "../middleware/tenantAdminOrPlatform";
import { authenticate } from "../auth";

const router = Router();

// All MCP routes require authentication
router.use(authenticate);

// Platform admin only endpoints
router.get("/tenants", isPlatformAdmin, mcpController.listTenants);
router.post("/tenants", isPlatformAdmin, mcpController.createTenant);
router.patch("/tenants/:tenantId", isPlatformAdmin, mcpController.updateTenant);
router.post("/tenants/:tenantId/suspend", isPlatformAdmin, mcpController.suspendTenant);
router.post("/tenants/:tenantId/activate", isPlatformAdmin, mcpController.activateTenant);
router.post("/tenants/:tenantId/migrate", isPlatformAdmin, mcpController.runMigrationForTenant);
router.post("/tenants/:tenantId/feature-flags", isPlatformAdmin, mcpController.updateFeatureFlags);
router.get("/jobs", isPlatformAdmin, mcpController.listJobs);

// Tenant-scoped endpoints (allow tenant_admin for their tenant)
router.get("/tenants/:tenantId", tenantAdminOrPlatform, mcpController.getTenantDetails);
router.get("/tenants/:tenantId/metrics", tenantAdminOrPlatform, mcpController.getTenantMetrics);
router.get("/tenants/:tenantId/logs", tenantAdminOrPlatform, mcpController.getTenantLogs);

export default router;

