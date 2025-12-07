import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticate, requireRole, generateToken, generateRefreshToken, verifyRefreshToken, revokeRefreshToken, enforceTenantIsolation, type AuthenticatedUser } from "./auth";
import bcrypt from "bcrypt";
import { insertCustomerSchema, insertTicketSchema, insertUserSchema, type Ticket, type Customer, type User } from "@shared/schema";
import { emailService } from "./email-service";
import { provisionTenant, updateTenantStatus } from "./tenant-provisioning";
import { logAuditEvent, getAuditLogs, getAllAuditLogs } from "./audit-service";
import { checkApiCallQuota, checkUserQuota, checkCustomerQuota, getTenantUsageSummary, incrementApiCalls } from "./quota-service";
import { exportTenantData, deleteTenantData, restoreTenantData } from "./tenant-export";
import { stripTenantIdFromRequest, ensureTenantContext, validateTenantOwnership } from "./tenant-isolation-middleware";
import { getTenantConfig, updateTenantConfig, hasFeatureAccess, getTenantBranding } from "./tenant-config-service";
import { uploadFile, getFile, getFilesForResource, deleteFile, readFileContent } from "./file-storage-service";
import { getEffectivePermissions, hasPermission, setTenantRole, getTenantRolesWithPermissions, initializeRoleTemplates, validateRole, getAvailableRoles } from "./role-service";
import { createProvisioningJob, getProvisioningJob, listProvisioningJobs, cancelProvisioningJob } from "./provisioning-job-service";
import { suspendTenant, reactivateTenant, cancelTenant, scheduleTenantDeletion, hardDeleteTenant, canTenantOperate } from "./tenant-lifecycle-service";
import { requestImpersonation, confirmImpersonation, endImpersonation, getActiveImpersonations } from "./impersonation-service";
import { enforceQuota, getQuotaStatus } from "./enhanced-quota-service";
import { getTenantMetrics, checkThresholds, getTenantAlerts, acknowledgeAlert, getAllAlerts } from "./monitoring-service";
import { validateTicketReferences, validateMessageReferences, validatePhoneCallReferences, validateTicketUpdateReferences, ensureTenantIdFromContext } from "./tenant-validation-service";
import { encryptCredentials, decryptCredentials } from "./encryption-service";
import { registerUserRoutes } from "./routes/users";
import { registerInviteRoutes } from "./routes/invites";
import { registerMFARoutes } from "./routes/mfa";
import { registerTeamRoutes } from "./routes/teams";
import { registerRoleRoutes } from "./routes/roles";
import { registerAIRoutes } from "./routes/ai";
import { registerSLARoutes } from "./routes/sla";
import { registerTagsRoutes } from "./routes/tags";
import { registerTelephonyRoutes } from "./routes/telephony";
import { registerConnectorRoutes } from "./routes/connectors";
import oauthRouter from "./src/routes/oauth.controller";
import webhookRouter from "./src/routes/webhook.ingest";

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== Global Middleware for Tenant Isolation ====================
  // CRITICAL: Strip tenantId from all requests to prevent injection attacks
  // Tenant ID should ONLY come from the authenticated user's JWT token
  app.use("/api", (req, res, next) => {
    // Skip for auth endpoints (no user context yet)
    if (req.path.includes("/auth/") || req.path === "/api/health") {
      return next();
    }
    stripTenantIdFromRequest(req, res, next);
  });

  // ==================== Global Middleware for Tenant Context Validation ====================
  // CRITICAL: Verify tenantId from JWT matches actual user record
  app.use("/api", async (req, res, next) => {
    // Skip for auth endpoints (no user context yet)
    if (req.path.includes("/auth/") || req.path === "/api/health") {
      return next();
    }

    // If user is authenticated, verify tenantId is valid
    if ((req as any).user) {
      const user = (req as any).user;
      try {
        // Fetch fresh user record to verify tenantId
        const dbUser = await storage.getUser(user.id);
        if (!dbUser) {
          return res.status(401).json({ error: "User not found" });
        }

        // CRITICAL: Verify tenantId from JWT matches database
        if (user.tenantId !== dbUser.tenantId) {
          console.error(`[SECURITY] Tenant ID mismatch! JWT: ${user.tenantId}, DB: ${dbUser.tenantId}, User: ${user.id}`);
          return res.status(403).json({ error: "Invalid tenant context" });
        }

        // Update req.user with verified tenantId
        (req as any).user.tenantId = dbUser.tenantId;
      } catch (error) {
        console.error("Error validating tenant context:", error);
        return res.status(500).json({ error: "Failed to validate tenant context" });
      }
    }

    next();
  });

  // ==================== Global Middleware for Tenant Context Validation ====================
  // CRITICAL: Verify tenantId from JWT matches actual user record
  app.use("/api", async (req, res, next) => {
    // Skip for auth endpoints (no user context yet)
    if (req.path.includes("/auth/") || req.path === "/api/health") {
      return next();
    }

    // If user is authenticated, verify tenantId is valid
    if ((req as any).user) {
      const user = (req as any).user;
      try {
        // Fetch fresh user record to verify tenantId
        const dbUser = await storage.getUser(user.id);
        if (!dbUser) {
          return res.status(401).json({ error: "User not found" });
        }

        // CRITICAL: Verify tenantId from JWT matches database
        if (user.tenantId !== dbUser.tenantId) {
          console.error(`[SECURITY] Tenant ID mismatch! JWT: ${user.tenantId}, DB: ${dbUser.tenantId}, User: ${user.id}`);
          return res.status(403).json({ error: "Invalid tenant context" });
        }

        // Update req.user with verified tenantId
        (req as any).user.tenantId = dbUser.tenantId;
      } catch (error) {
        console.error("Error validating tenant context:", error);
        return res.status(500).json({ error: "Failed to validate tenant context" });
      }
    }

    next();
  });

  // ==================== Global Middleware for API Call Tracking ====================
  // Track API calls for quota enforcement (applied to all /api routes)
  app.use("/api", async (req, res, next) => {
    // Skip tracking for auth endpoints and quota checks
    if (req.path.includes("/auth/") || req.path.includes("/quotas") || req.path.includes("/health")) {
      return next();
    }

    // If authenticated, track API call
    if ((req as any).user) {
      try {
        await incrementApiCalls((req as any).user.tenantId);
      } catch (error) {
        // Don't fail request if tracking fails
        console.error("Failed to track API call:", error);
      }
    }
    next();
  });

  // ==================== Tenant Management Routes ====================

  // Test endpoint to verify tenant isolation (for debugging)
  app.get("/api/test/isolation", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const userId = req.user!.id;
      
      // Get all data for this tenant
      const customers = await storage.getCustomersByTenant(tenantId, 1000, 0);
      const tickets = await storage.getTicketsByTenant(tenantId);
      const users = await storage.getUsersByTenant(tenantId);
      
      // Verify all data belongs to this tenant
      const allCustomersValid = customers.every((c: any) => c.tenantId === tenantId);
      const allTicketsValid = tickets.every((t: any) => t.tenantId === tenantId);
      const allUsersValid = users.every((u: any) => u.tenantId === tenantId);
      
      res.json({
        tenantId,
        userId,
        isolation: {
          customers: {
            count: customers.length,
            allValid: allCustomersValid,
            invalid: customers.filter((c: any) => c.tenantId !== tenantId).length
          },
          tickets: {
            count: tickets.length,
            allValid: allTicketsValid,
            invalid: tickets.filter((t: any) => t.tenantId !== tenantId).length
          },
          users: {
            count: users.length,
            allValid: allUsersValid,
            invalid: users.filter((u: any) => u.tenantId !== tenantId).length
          }
        },
        status: allCustomersValid && allTicketsValid && allUsersValid ? "PASS" : "FAIL"
      });
    } catch (error) {
      console.error("Error testing isolation:", error);
      res.status(500).json({ error: "Failed to test isolation" });
    }
  });

  // Get current tenant info
  app.get("/api/tenants/current", authenticate, async (req, res) => {
    try {
      const tenant = await storage.getTenant(req.user!.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error) {
      console.error("Error fetching current tenant:", error);
      res.status(500).json({ error: "Failed to fetch tenant info" });
    }
  });

  // Get all users in tenant (tenant admins and super admin only)
  app.get("/api/tenants/users", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      // CRITICAL: Always use tenantId from authenticated user, never from request
      const tenantId = req.user!.tenantId;
      
      // Additional security: Log tenant access for audit
      console.log(`[AUDIT] User ${req.user!.id} (${req.user!.email}) accessing users for tenant ${tenantId}`);
      
      const users = await storage.getUsersByTenant(tenantId);
      
      // Double-check: Filter out any users that don't belong to this tenant (defense in depth)
      const filteredUsers = users.filter((u: any) => u.tenantId === tenantId);
      
      res.json(filteredUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching tenant users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create new user in tenant (tenant admin and super admin only)
  app.post("/api/tenants/users", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      // Check quota before creating
      const quotaCheck = await checkUserQuota(req.user!.tenantId);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ 
          error: quotaCheck.reason || "Quota exceeded",
          quota: quotaCheck 
        });
      }

      const { name, email, password, role } = req.body;

      // Validate input
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields: name, email, password, role" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Validate role against role templates
      const isValidRole = await validateRole(role);
      if (!isValidRole) {
        const availableRoles = await getAvailableRoles();
        return res.status(400).json({ 
          error: `Invalid role. Available roles: ${availableRoles.join(", ")}` 
        });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const user = await storage.createUser({
        tenantId: req.user!.tenantId,
        name,
        email,
        password,
        role,
      } as any);

      // Log audit
      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "user",
        resourceId: user.id,
        details: { email: user.email, role: user.role },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Get tenant statistics (admin only)
  app.get("/api/tenants/stats", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const customers = await storage.getCustomersByTenant(tenantId, 1000, 0);
      const tickets = await storage.getTicketsByTenant(tenantId);
      const users = await storage.getUsersByTenant(tenantId);

      const ticketsArray = tickets as any[];
      const customersArray = customers as any[];
      const usersArray = users as any[];

      const stats = {
        totalCustomers: customersArray.length,
        totalTickets: ticketsArray.length,
        totalUsers: usersArray.length,
        openTickets: ticketsArray.filter((t: any) => t.status === "open").length,
        closedTickets: ticketsArray.filter((t: any) => t.status === "closed").length,
        inProgressTickets: ticketsArray.filter((t: any) => t.status === "in_progress").length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching tenant stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ==================== Authentication Routes ====================
  
  // Login with refresh token
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Debug: Check if storage is initialized
      const memStorage = storage as any;
      const userCount = memStorage.users?.size || 0;
      console.log(`[LOGIN] Attempting login for: ${email}, Users in storage: ${userCount}`);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[LOGIN] User not found: ${email}`);
        // List available users for debugging
        if (memStorage.users) {
          const allEmails = Array.from(memStorage.users.values()).map((u: any) => u.email);
          console.log(`[LOGIN] Available users: ${allEmails.join(", ")}`);
        }
        return res.status(401).json({ error: "Invalid credentials" });
      }

      console.log(`[LOGIN] User found: ${user.email}, Role: ${user.role}`);
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        console.log(`[LOGIN] Password mismatch for: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const authUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      };

      const token = generateToken(authUser);
      const refreshToken = generateRefreshToken(user.id);
      
      res.json({
        token,
        refreshToken,
        user: authUser,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticate, async (req, res) => {
    res.json({ user: req.user });
  });

  // Refresh access token
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
      }

      const userId = verifyRefreshToken(refreshToken);
      if (!userId) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const authUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      };

      const newAccessToken = generateToken(authUser);

      res.json({
        token: newAccessToken,
        user: authUser,
      });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  // Logout (invalidate refresh token)
  app.post("/api/auth/logout", (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        revokeRefreshToken(refreshToken);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ==================== Customer Routes ====================
  
  // Get all customers for tenant
  app.get("/api/customers", authenticate, async (req, res) => {
    try {
      // CRITICAL: Always use tenantId from authenticated user, never from request
      const tenantId = req.user!.tenantId;
      
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const customers = await storage.getCustomersByTenant(
        tenantId,
        limit,
        offset
      );
      
      // Double-check: Filter out any customers that don't belong to this tenant (defense in depth)
      const filteredCustomers = customers.filter((c: any) => c.tenantId === tenantId);
      
      res.json(filteredCustomers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Search customers
  app.get("/api/customers/search", authenticate, async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }

      const customers = await storage.searchCustomers(req.user!.tenantId, query);
      res.json(customers);
    } catch (error) {
      console.error("Error searching customers:", error);
      res.status(500).json({ error: "Failed to search customers" });
    }
  });

  // Get single customer
  app.get("/api/customers/:id", authenticate, async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id, req.user!.tenantId);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Get customer timeline
  app.get("/api/customers/:id/timeline", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      const customer = await storage.getCustomer(id, tenantId);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Return mock timeline data
      const timeline = [
        {
          id: "timeline-1",
          type: "ticket_created",
          title: "Ticket created",
          description: "New support ticket opened",
          timestamp: new Date(Date.now() - 86400000),
        },
        {
          id: "timeline-2",
          type: "call_completed",
          title: "Call completed",
          description: "Phone call with customer",
          timestamp: new Date(Date.now() - 172800000),
        },
      ];

      res.json(timeline);
    } catch (error) {
      console.error("Error fetching customer timeline:", error);
      res.status(500).json({ error: "Failed to fetch customer timeline" });
    }
  });

  // Get customer tickets
  app.get("/api/customers/:id/tickets", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      const customer = await storage.getCustomer(id, tenantId);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const allTickets = await storage.getTicketsByTenant(tenantId);
      const customerTickets = (allTickets as any[]).filter((t: any) => t.customerId === id);

      res.json(customerTickets);
    } catch (error) {
      console.error("Error fetching customer tickets:", error);
      res.status(500).json({ error: "Failed to fetch customer tickets" });
    }
  });

  // Get customer calls
  app.get("/api/customers/:id/calls", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      const customer = await storage.getCustomer(id, tenantId);
      
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Return mock call data for this customer
      const calls = [
        {
          id: "call-001",
          customerId: id,
          status: "completed",
          duration: 600,
          transcript: "Customer called about billing inquiry. Resolved successfully.",
          timestamp: new Date(Date.now() - 86400000),
        },
      ];

      res.json(calls);
    } catch (error) {
      console.error("Error fetching customer calls:", error);
      res.status(500).json({ error: "Failed to fetch customer calls" });
    }
  });

  // Create customer
  app.post("/api/customers", authenticate, requireRole("tenant_admin", "support_agent"), ensureTenantContext, async (req, res) => {
    try {
      // SECURITY: Ensure tenantId comes from authenticated user, not request body
      const tenantId = (req as any).tenantContext || req.user!.tenantId;
      
      // Check quota before creating
      const quotaCheck = await checkCustomerQuota(tenantId);
      if (!quotaCheck.allowed) {
        return res.status(403).json({ 
          error: quotaCheck.reason || "Quota exceeded",
          quota: quotaCheck 
        });
      }

      // CRITICAL: Force tenantId from authenticated user, ignore any in body
      const customerData = insertCustomerSchema.parse({
        ...req.body,
        tenantId: tenantId, // Always use authenticated user's tenantId
      });

      // Additional validation: ensure tenantId matches
      if (customerData.tenantId !== tenantId) {
        console.warn(`[SECURITY] Tenant ID mismatch detected. User: ${tenantId}, Body: ${customerData.tenantId}`);
        customerData.tenantId = tenantId; // Force correct tenantId
      }

      const customer = await storage.createCustomer(customerData);

      // Log audit
      await logAuditEvent({
        tenantId: tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "customer",
        resourceId: customer.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(customer);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Update customer
  app.patch("/api/customers/:id", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const updates = req.body;
      const customer = await storage.updateCustomer(
        req.params.id,
        req.user!.tenantId,
        updates
      );

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete("/api/customers/:id", authenticate, requireRole("tenant_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id, req.user!.tenantId);

      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // ==================== Ticket Routes ====================
  
  // Get all tickets for tenant
  app.get("/api/tickets", authenticate, async (req, res) => {
    try {
      // CRITICAL: Always use tenantId from authenticated user, never from request
      const tenantId = req.user!.tenantId;
      
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const status = req.query.status as string | undefined;
      const tickets = await storage.getTicketsByTenant(tenantId, status);
      
      // Double-check: Filter out any tickets that don't belong to this tenant (defense in depth)
      const filteredTickets = tickets.filter((t: any) => t.tenantId === tenantId);
      
      res.json(filteredTickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // Get single ticket
  app.get("/api/tickets/:id", authenticate, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id, req.user!.tenantId);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // Create ticket
  app.post("/api/tickets", authenticate, requireRole("tenant_admin", "support_agent"), ensureTenantContext, async (req, res) => {
    try {
      // SECURITY: Ensure tenantId comes from authenticated user, not request body
      const tenantId = (req as any).tenantContext || req.user!.tenantId;
      
      const ticketData = insertTicketSchema.parse({
        ...req.body,
        tenantId: tenantId, // Always use authenticated user's tenantId
        createdBy: req.user!.id,
      });

      // Additional validation: ensure tenantId matches
      ticketData.tenantId = ensureTenantIdFromContext(ticketData.tenantId, tenantId);

      // CRITICAL: Validate that all referenced resources belong to this tenant
      const validation = await validateTicketReferences({
        tenantId,
        customerId: ticketData.customerId || null,
        assigneeId: ticketData.assigneeId || null,
        createdBy: ticketData.createdBy,
      });

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error || "Invalid tenant ownership" });
      }

      const ticket = await storage.createTicket(ticketData);
      
      // Send email notification for new ticket
      if (ticketData.customerId) {
        const customer = await storage.getCustomer(ticketData.customerId, req.user!.tenantId);
        const creator = await storage.getUser(req.user!.id);
        if (customer && creator) {
          emailService.sendTicketCreatedEmail(
            creator.email,
            ticket.title,
            ticket.id,
            customer.name
          ).catch(err => console.error("Failed to send ticket created email:", err));
        }
      }
      
      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid ticket data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  // Update ticket
  app.patch("/api/tickets/:id", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const oldTicket = await storage.getTicket(req.params.id, tenantId);
      
      if (!oldTicket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const updates = req.body;

      // Validate assignee if being updated
      if (updates.assigneeId !== undefined || updates.customerId !== undefined) {
        const validation = await validateTicketUpdateReferences(tenantId, {
          assigneeId: updates.assigneeId,
          customerId: updates.customerId,
        });
        if (!validation.valid) {
          return res.status(403).json({ error: validation.error || "Invalid tenant ownership" });
        }
      }

      const ticket = await storage.updateTicket(
        req.params.id,
        tenantId,
        updates
      );

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Send email if assignee changed
      if (updates.assigneeId && updates.assigneeId !== oldTicket?.assigneeId) {
        const assignee = await storage.getUser(updates.assigneeId);
        const customer = oldTicket?.customerId ? await storage.getCustomer(oldTicket.customerId, req.user!.tenantId) : null;
        if (assignee && customer) {
          emailService.sendTicketAssignedEmail(
            assignee.email,
            assignee.name,
            ticket.title,
            ticket.id,
            customer.name
          ).catch(err => console.error("Failed to send assignment email:", err));
        }
      }

      // Send email if status changed
      if (updates.status && updates.status !== oldTicket?.status) {
        const customer = oldTicket?.customerId ? await storage.getCustomer(oldTicket.customerId, req.user!.tenantId) : null;
        if (customer) {
          emailService.sendTicketStatusChangeEmail(
            customer.email,
            customer.name,
            ticket.title,
            updates.status.replace("_", " ").toUpperCase()
          ).catch(err => console.error("Failed to send status email:", err));
        }
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // Delete ticket
  app.delete("/api/tickets/:id", authenticate, requireRole("tenant_admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteTicket(req.params.id, req.user!.tenantId);

      if (!deleted) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  // ==================== Message Routes ====================
  
  // Get messages for a ticket
  app.get("/api/tickets/:ticketId/messages", authenticate, async (req, res) => {
    try {
      const messages = await storage.getMessagesByTicket(
        req.params.ticketId,
        req.user!.tenantId
      );
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Create message
  app.post("/api/messages", authenticate, async (req, res) => {
    try {
      const { ticketId, content } = req.body;
      const tenantId = req.user!.tenantId;

      if (!ticketId || !content) {
        return res.status(400).json({ error: "Ticket ID and content required" });
      }

      // CRITICAL: Validate that ticket and sender belong to this tenant
      const validation = await validateMessageReferences(
        ticketId,
        req.user!.id,
        tenantId
      );

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error || "Invalid tenant ownership" });
      }

      const message = await storage.createMessage({
        tenantId,
        ticketId,
        senderId: req.user!.id,
        content,
      });

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // ==================== Analytics/Stats Routes ====================

  app.get("/api/analytics/stats", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      const allTickets: Ticket[] = Array.from((storage as any).tickets.values())
        .filter((t: any) => t.tenantId === tenantId) as Ticket[];
      const allCustomers: Customer[] = Array.from((storage as any).customers.values())
        .filter((c: any) => c.tenantId === tenantId) as Customer[];
      const allUsers: User[] = Array.from((storage as any).users.values())
        .filter((u: any) => u.tenantId === tenantId) as User[];

      const activeCustomers = allCustomers.filter((c: Customer) => c.status === "active").length;
      const openTickets = allTickets.filter((t: Ticket) => t.status === "open").length;
      const inProgressTickets = allTickets.filter((t: Ticket) => t.status === "in_progress").length;
      const resolvedTickets = allTickets.filter((t: Ticket) => t.status === "closed").length;
      const highPriorityTickets = allTickets.filter((t: Ticket) => t.priority === "high").length;
      const mediumPriorityTickets = allTickets.filter((t: Ticket) => t.priority === "medium").length;

      // Calculate average resolution time (mock: 48 hours)
      const avgResolutionTime = "48 hours";

      // Calculate customer growth (mock: +12% this month)
      const customerGrowth = 12;

      // Calculate agent performance
      const agentPerformance: { [key: string]: { name: string; closedTickets: number } } = {};
      for (const ticket of allTickets) {
        if (ticket.assigneeId && ticket.status === "closed") {
          if (!agentPerformance[ticket.assigneeId]) {
            const agent = await storage.getUser(ticket.assigneeId);
            agentPerformance[ticket.assigneeId] = {
              name: agent?.name || "Unknown",
              closedTickets: 0,
            };
          }
          agentPerformance[ticket.assigneeId].closedTickets++;
        }
      }

      // Get top agent
      const topAgent = Object.values(agentPerformance).sort(
        (a, b) => b.closedTickets - a.closedTickets
      )[0];

      // Ticket categories breakdown
      const categoryBreakdown = {
        support: allTickets.filter((t: Ticket) => t.category === "support").length,
        bug: allTickets.filter((t: Ticket) => t.category === "bug").length,
        feature: allTickets.filter((t: Ticket) => t.category === "feature").length,
      };

      // Resolution rate
      const resolutionRate =
        allTickets.length > 0
          ? Math.round((resolvedTickets / allTickets.length) * 100)
          : 0;

      const stats = {
        // Basic metrics
        totalCustomers: allCustomers.length,
        activeCustomers,
        totalTickets: allTickets.length,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        highPriorityTickets,
        mediumPriorityTickets,

        // Performance metrics
        averageResolutionTime: avgResolutionTime,
        resolutionRate,
        customerGrowth,
        satisfactionRate: "94%",

        // Agent performance
        topAgent: topAgent ? {
          name: topAgent.name,
          closedTickets: topAgent.closedTickets,
        } : null,
        totalAgents: allUsers.filter((u: any) => ["support_agent", "tenant_admin"].includes(u.role)).length,

        // Category breakdown
        categoryBreakdown,

        // Additional insights
        averageTicketsPerAgent: allUsers.length > 0
          ? Math.round(allTickets.length / allUsers.length)
          : 0,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ==================== AI Assistant Routes ====================

  app.post("/api/ai/query", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ 
          error: "Invalid query. Please provide a text question.",
          id: Math.random().toString(),
          content: "❌ I need a valid query to process. Please try again.",
          sender: "ai",
          timestamp: new Date(),
          type: "error"
        });
      }

      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        return res.status(400).json({ 
          error: "Query cannot be empty.",
          id: Math.random().toString(),
          content: "Please ask me something! Type 'help' for available commands.",
          sender: "ai",
          timestamp: new Date(),
          type: "suggestion"
        });
      }

      // Import the AI assistant
      const { createAIAssistant } = await import("./ai-assistant");
      const aiAssistant = createAIAssistant(req.user!.tenantId);
      const aiResponse = await aiAssistant.processQuery(trimmedQuery);

      res.json(aiResponse);
    } catch (error: any) {
      console.error("Error processing AI query:", error);
      res.status(500).json({
        id: Math.random().toString(),
        content: `❌ Error: ${error.message || "Failed to process query. Please try again."}`,
        sender: "ai",
        timestamp: new Date(),
        type: "error"
      });
    }
  });

  // ==================== Settings/Integration Routes ====================

  app.get("/api/settings/integrations", authenticate, async (req, res) => {
    try {
      const integrations = [
        {
          id: "gmail",
          name: "Gmail",
          status: "connected",
          email: req.user!.email,
        },
        {
          id: "calendar",
          name: "Google Calendar",
          status: "connected",
          email: req.user!.email,
        },
        {
          id: "telegram",
          name: "Telegram",
          status: "not_connected",
        },
      ];

      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.post("/api/settings/integrations/:id/disconnect", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      res.json({
        message: `Disconnected ${id} successfully`,
        status: "disconnected",
      });
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  app.patch("/api/users/me", authenticate, async (req, res) => {
    try {
      const updates = req.body;
      res.json({
        ...req.user,
        ...updates,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ==================== Global Search Routes ====================

  app.get("/api/search", authenticate, async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const lowerQuery = query.toLowerCase();

      // Search customers
      const customers = Array.from((storage as any).customers.values())
        .filter((c: any) => c.tenantId === req.user!.tenantId)
        .filter(
          (c: any) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.email.toLowerCase().includes(lowerQuery) ||
            (c.company?.toLowerCase() || "").includes(lowerQuery)
        )
        .slice(0, 10)
        .map((c: any) => ({
          type: "customer",
          id: c.id,
          title: c.name,
          description: `${c.email} • ${c.company || "N/A"}`,
        }));

      // Search tickets
      const tickets = Array.from((storage as any).tickets.values())
        .filter((t: any) => t.tenantId === req.user!.tenantId)
        .filter(
          (t: any) =>
            t.title.toLowerCase().includes(lowerQuery) ||
            (t.description?.toLowerCase() || "").includes(lowerQuery)
        )
        .slice(0, 10)
        .map((t: any) => ({
          type: "ticket",
          id: t.id,
          title: t.title,
          description: t.description,
        }));

      res.json([...customers, ...tickets].slice(0, 20));
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ==================== Phone Call & Voice Routes ====================

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  // Initiate phone call
  app.post("/api/calls/initiate", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const { customerId, direction, ticketId } = req.body;
      const tenantId = req.user!.tenantId;

      if (!customerId || !direction) {
        return res.status(400).json({ error: "Customer ID and direction required" });
      }

      // CRITICAL: Validate that all referenced resources belong to this tenant
      const validation = await validatePhoneCallReferences(
        customerId,
        req.user!.id,
        ticketId || null,
        tenantId
      );

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error || "Invalid tenant ownership" });
      }

      const call = {
        id: Math.random().toString(36).substring(7),
        tenantId,
        customerId,
        userId: req.user!.id,
        ticketId: ticketId || null,
        direction,
        status: "initiated",
        timestamp: new Date(),
        initiatedBy: req.user!.id,
      };

      // Log audit
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "create",
        resourceType: "phone_call",
        resourceId: call.id,
        details: { customerId, ticketId, direction },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(call);
    } catch (error) {
      console.error("Error initiating call:", error);
      res.status(500).json({ error: "Failed to initiate call" });
    }
  });

  // End call with transcript
  app.post("/api/calls/end", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const { callId, transcript, duration } = req.body;
      if (!callId) {
        return res.status(400).json({ error: "Call ID required" });
      }

      const call = {
        id: callId,
        status: "completed",
        transcript,
        duration,
        completedAt: new Date(),
      };

      res.json(call);
    } catch (error) {
      console.error("Error ending call:", error);
      res.status(500).json({ error: "Failed to end call" });
    }
  });

  // Get all calls for tenant
  app.get("/api/calls", authenticate, async (req, res) => {
    try {
      const tenantId = req.user!.tenantId;
      
      // Return mock call history for all calls in tenant
      const calls = [
        {
          id: "call-001",
          customerId: "customer-1",
          status: "completed",
          duration: 600,
          transcript: "Customer called about billing inquiry. Resolved successfully.",
          timestamp: new Date(Date.now() - 86400000),
          startTime: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "call-002",
          customerId: "customer-2",
          status: "missed",
          duration: 0,
          timestamp: new Date(Date.now() - 172800000),
          startTime: new Date(Date.now() - 172800000).toISOString(),
        },
      ];

      res.json(calls);
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ error: "Failed to fetch calls" });
    }
  });

  // Get single call by ID
  app.get("/api/calls/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user!.tenantId;
      
      // Return mock call data
      const call = {
        id,
        customerId: "customer-1",
        status: "completed",
        duration: 600,
        transcript: "Customer called about billing inquiry. Resolved successfully.",
        timestamp: new Date(Date.now() - 86400000),
        startTime: new Date(Date.now() - 86400000).toISOString(),
        direction: "incoming",
        userId: req.user!.id,
      };

      res.json(call);
    } catch (error) {
      console.error("Error fetching call:", error);
      res.status(500).json({ error: "Failed to fetch call" });
    }
  });

  // Get call history for customer
  app.get("/api/calls/history/:customerId", authenticate, async (req, res) => {
    try {
      const { customerId } = req.params;
      const customer = await storage.getCustomer(customerId, req.user!.tenantId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Return mock call history
      const history = [
        {
          id: "call-001",
          customerId,
          status: "completed",
          duration: 600,
          transcript: "Customer called about billing inquiry. Resolved successfully.",
          timestamp: new Date(Date.now() - 86400000),
        },
        {
          id: "call-002",
          customerId,
          status: "missed",
          duration: 0,
          timestamp: new Date(Date.now() - 172800000),
        },
      ];

      res.json(history);
    } catch (error) {
      console.error("Error fetching call history:", error);
      res.status(500).json({ error: "Failed to fetch call history" });
    }
  });

  // ==================== Notification Routes ====================

  // Send notification
  app.post("/api/notifications/send", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      const { customerId, type, title, content } = req.body;
      if (!customerId || !type || !title || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const notification = {
        id: Math.random().toString(36).substring(7),
        customerId,
        type,
        title,
        content,
        sentAt: new Date(),
        status: "sent",
      };

      res.json(notification);
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Get notifications for tenant
  app.get("/api/notifications", authenticate, async (req, res) => {
    try {
      const notifications = [
        {
          id: "notif-001",
          type: "email",
          title: "Ticket Assigned",
          content: "New ticket assigned to you",
          timestamp: new Date(Date.now() - 3600000),
          read: false,
        },
        {
          id: "notif-002",
          type: "sms",
          title: "Customer Call",
          content: "Customer called regarding ticket #123",
          timestamp: new Date(Date.now() - 7200000),
          read: true,
        },
      ];

      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // ==================== Super Admin Routes ====================

  // Provision new tenant (super-admin only)
  app.post("/api/admin/tenants/provision", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { name, contactEmail, adminName, adminEmail, adminPassword, plan, slug } = req.body;

      if (!name || !contactEmail || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create provisioning job (runs in background)
      const job = await createProvisioningJob({
        name,
        contactEmail,
        adminName,
        adminEmail,
        adminPassword,
        plan: plan || "basic",
        slug,
      }, req.user!.id);

      res.status(202).json({
        jobId: job.id,
        status: job.status,
        message: "Provisioning job created. Use GET /api/provision/:jobId to check status.",
      });
    } catch (error: any) {
      console.error("Error creating provisioning job:", error);
      res.status(500).json({ error: error.message || "Failed to create provisioning job" });
    }
  });

  // Get provisioning job status
  app.get("/api/provision/:jobId", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const job = getProvisioningJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Provisioning job not found" });
      }
      res.json(job);
    } catch (error: any) {
      console.error("Error fetching provisioning job:", error);
      res.status(500).json({ error: error.message || "Failed to fetch provisioning job" });
    }
  });

  // List all tenants (super-admin only)
  app.get("/api/admin/tenants", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      // Get all tenants from storage (would need getAllTenants method)
      // For now, return placeholder
      const tenants = Array.from((storage as any).tenants?.values() || []);
      res.json(tenants.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: (t as any).slug,
        contactEmail: (t as any).contactEmail,
        status: (t as any).status || "active",
        plan: (t as any).plan || "basic",
        createdAt: t.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  // Suspend tenant (super-admin only)
  app.post("/api/admin/tenants/:tenantId/suspend", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { reason } = req.body;
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: "Reason is required and must be at least 10 characters" });
      }
      await suspendTenant(tenantId, reason.trim(), req.user!.id, req.ip, req.headers["user-agent"]);
      res.json({ success: true, message: "Tenant suspended successfully" });
    } catch (error: any) {
      console.error("Error suspending tenant:", error);
      res.status(500).json({ error: error.message || "Failed to suspend tenant" });
    }
  });

  // Reactivate tenant (super-admin only)
  app.post("/api/admin/tenants/:tenantId/reactivate", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      await reactivateTenant(tenantId, req.user!.id, req.ip, req.headers["user-agent"]);
      res.json({ success: true, message: "Tenant reactivated successfully" });
    } catch (error: any) {
      console.error("Error reactivating tenant:", error);
      res.status(500).json({ error: error.message || "Failed to reactivate tenant" });
    }
  });

  // Cancel tenant (super-admin only)
  app.post("/api/admin/tenants/:tenantId/cancel", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { reason } = req.body;
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: "Reason is required and must be at least 10 characters" });
      }
      await cancelTenant(tenantId, reason.trim(), req.user!.id, req.ip, req.headers["user-agent"]);
      res.json({ success: true, message: "Tenant canceled. Data will be retained for 30 days." });
    } catch (error: any) {
      console.error("Error canceling tenant:", error);
      res.status(500).json({ error: error.message || "Failed to cancel tenant" });
    }
  });

  // Update tenant status (legacy endpoint, use specific endpoints above)
  app.patch("/api/admin/tenants/:tenantId/status", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { status } = req.body;
      if (!["active", "trialing", "suspended", "canceled", "deleted"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      await updateTenantStatus(tenantId, status, req.user!.id);
      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "tenant",
        resourceId: tenantId,
        details: { status },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json({ success: true, message: `Tenant status updated to ${status}` });
    } catch (error: any) {
      console.error("Error updating tenant status:", error);
      res.status(500).json({ error: error.message || "Failed to update tenant status" });
    }
  });

  // ==================== Quota Management Routes ====================

  // Check quotas for current tenant
  app.get("/api/tenants/quotas", authenticate, async (req, res) => {
    try {
      const usage = await getTenantUsageSummary(req.user!.tenantId);
      
      // Get customer count
      const customers = await storage.getCustomersByTenant(req.user!.tenantId, 10000, 0);
      const customerCount = customers.length;
      
      // Transform to match frontend expectations
      res.json({
        users: {
          used: usage.activeUsers,
          limit: usage.quotas.maxUsers,
        },
        customers: {
          used: customerCount,
          limit: usage.quotas.maxCustomers,
        },
        storage: {
          used: usage.storageUsed,
          limit: usage.quotas.maxStorage,
        },
        apiCalls: {
          used: usage.apiCalls,
          limit: usage.quotas.maxApiCalls,
        },
      });
    } catch (error: any) {
      console.error("Error fetching quotas:", error);
      res.status(500).json({ error: error.message || "Failed to fetch quotas" });
    }
  });

  // Check if API call is allowed (middleware will use this)
  app.get("/api/tenants/quotas/api-calls", authenticate, async (req, res) => {
    try {
      const result = await checkApiCallQuota(req.user!.tenantId);
      res.json(result);
    } catch (error: any) {
      console.error("Error checking API quota:", error);
      res.status(500).json({ error: error.message || "Failed to check quota" });
    }
  });

  // ==================== Audit Log Routes ====================

  // Get audit logs for current tenant
  app.get("/api/audit-logs", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const { limit = 100, offset = 0, resourceType, action, userId } = req.query;
      const logs = await getAuditLogs(req.user!.tenantId, {
        limit: Number(limit),
        offset: Number(offset),
        resourceType: resourceType as string,
        action: action as any,
        userId: userId as string,
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Get all audit logs (super-admin only)
  app.get("/api/admin/audit-logs", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { limit = 100, offset = 0, tenantId } = req.query;
      const logs = await getAllAuditLogs({
        limit: Number(limit),
        offset: Number(offset),
        tenantId: tenantId as string,
      });
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ==================== Tenant Export/Delete Routes ====================

  // Export tenant data (tenant admin or super-admin) - Also supports POST as per spec
  app.get("/api/tenants/export", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.role === "super_admin" && req.query.tenantId 
        ? req.query.tenantId as string 
        : req.user!.tenantId;

      const exportData = await exportTenantData(tenantId, req.user!.id);

      await logAuditEvent({
        tenantId,
        userId: req.user!.id,
        action: "export",
        resourceType: "tenant",
        resourceId: tenantId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="tenant-${tenantId}-export-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting tenant data:", error);
      res.status(500).json({ error: error.message || "Failed to export tenant data" });
    }
  });

  // Export tenant data (POST endpoint as per spec)
  app.post("/api/tenants/:tenantId/export", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const actualTenantId = req.user!.role === "super_admin" ? tenantId : req.user!.tenantId;

      if (req.user!.role !== "super_admin" && actualTenantId !== req.user!.tenantId) {
        return res.status(403).json({ error: "You can only export your own tenant data" });
      }

      const exportData = await exportTenantData(actualTenantId, req.user!.id);

      await logAuditEvent({
        tenantId: actualTenantId,
        userId: req.user!.id,
        action: "export",
        resourceType: "tenant",
        resourceId: actualTenantId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="tenant-${actualTenantId}-export-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting tenant data:", error);
      res.status(500).json({ error: error.message || "Failed to export tenant data" });
    }
  });

  // Restore tenant data from export (super-admin only)
  app.post("/api/admin/tenants/restore", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { exportData, targetTenantId } = req.body;

      if (!exportData || !exportData.metadata) {
        return res.status(400).json({ error: "Invalid export data format" });
      }

      const result = await restoreTenantData(
        exportData,
        req.user!.id,
        targetTenantId
      );

      await logAuditEvent({
        tenantId: result.tenantId,
        userId: req.user!.id,
        action: "import",
        resourceType: "tenant",
        resourceId: result.tenantId,
        details: {
          restoredItems: result.restored.length,
          warnings: result.warnings.length,
          sourceExportDate: exportData.metadata.exportedAt,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        success: true,
        tenantId: result.tenantId,
        restored: result.restored,
        warnings: result.warnings,
        message: `Restored ${result.restored.length} items to tenant ${result.tenantId}`,
      });
    } catch (error: any) {
      console.error("Error restoring tenant data:", error);
      res.status(500).json({ error: error.message || "Failed to restore tenant data" });
    }
  });

  // Schedule tenant deletion (soft delete) - super-admin or tenant admin
  app.post("/api/admin/tenants/:tenantId/delete", authenticate, requireRole("super_admin", "tenant_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { reason, confirm } = req.body;
      if (req.user!.role !== "super_admin" && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "You can only delete your own tenant" });
      }
      if (!confirm) {
        return res.status(400).json({ error: "Deletion requires explicit confirmation" });
      }
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: "Reason is required and must be at least 10 characters" });
      }
      const { deletedAt, retentionEndsAt } = await scheduleTenantDeletion(
        tenantId, reason.trim(), req.user!.id, req.ip, req.headers["user-agent"]
      );
      res.json({ success: true, message: "Tenant deletion scheduled.", deletedAt, retentionEndsAt });
    } catch (error: any) {
      console.error("Error scheduling tenant deletion:", error);
      res.status(500).json({ error: error.message || "Failed to schedule tenant deletion" });
    }
  });

  // Hard delete tenant (permanent removal) - super-admin only, after retention period
  app.delete("/api/admin/tenants/:tenantId", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { confirm = false } = req.body;
      if (!confirm) {
        return res.status(400).json({ error: "Hard deletion requires explicit confirmation" });
      }
      await hardDeleteTenant(tenantId, req.user!.id, req.ip, req.headers["user-agent"]);
      res.json({ success: true, message: "Tenant permanently deleted" });
    } catch (error: any) {
      console.error("Error hard deleting tenant:", error);
      res.status(500).json({ error: error.message || "Failed to hard delete tenant" });
    }
  });

  // ==================== Tenant Configuration Routes ====================

  // Get tenant configuration (tenant admin only)
  app.get("/api/tenants/config", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const config = await getTenantConfig(req.user!.tenantId);
      res.json(config);
    } catch (error: any) {
      console.error("Error fetching tenant config:", error);
      res.status(500).json({ error: error.message || "Failed to fetch tenant configuration" });
    }
  });

  // Update tenant configuration (tenant admin only)
  app.patch("/api/tenants/config", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const updates = req.body;
      const config = await updateTenantConfig(
        req.user!.tenantId,
        updates,
        req.user!.id,
        req.ip,
        req.headers["user-agent"]
      );
      res.json(config);
    } catch (error: any) {
      console.error("Error updating tenant config:", error);
      res.status(500).json({ error: error.message || "Failed to update tenant configuration" });
    }
  });

  // Get tenant branding (public endpoint for UI customization)
  app.get("/api/tenants/branding", authenticate, async (req, res) => {
    try {
      const branding = await getTenantBranding(req.user!.tenantId);
      res.json(branding);
    } catch (error: any) {
      console.error("Error fetching tenant branding:", error);
      res.status(500).json({ error: error.message || "Failed to fetch tenant branding" });
    }
  });

  // Check feature access (for feature flags)
  app.get("/api/tenants/features/:feature", authenticate, async (req, res) => {
    try {
      const { feature } = req.params;
      const hasAccess = await hasFeatureAccess(req.user!.tenantId, feature as any);
      res.json({ feature, enabled: hasAccess });
    } catch (error: any) {
      console.error("Error checking feature access:", error);
      res.status(500).json({ error: error.message || "Failed to check feature access" });
    }
  });

  // ==================== File Management Routes ====================

  // Upload file
  app.post("/api/files", authenticate, requireRole("tenant_admin", "support_agent"), ensureTenantContext, async (req, res) => {
    try {
      // Note: In production, use multer or similar for file uploads
      // This is a simplified version expecting base64 or multipart
      const { resourceType, resourceId, filename, mimeType, size, data } = req.body;

      if (!resourceType || !resourceId || !filename || !data) {
        return res.status(400).json({ error: "Missing required fields: resourceType, resourceId, filename, data" });
      }

      const buffer = Buffer.from(data, "base64");
      const result = await uploadFile(
        req.user!.tenantId,
        resourceType,
        resourceId,
        {
          filename,
          mimeType,
          size: size || buffer.length,
          buffer,
        },
        req.user!.id
      );

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: error.message || "Failed to upload file" });
    }
  });

  // Get file metadata
  app.get("/api/files/:id", authenticate, async (req, res) => {
    try {
      const file = await getFile(req.params.id, req.user!.tenantId);
      res.json(file);
    } catch (error: any) {
      console.error("Error fetching file:", error);
      res.status(404).json({ error: error.message || "File not found" });
    }
  });

  // Download file
  app.get("/api/files/:id/download", authenticate, async (req, res) => {
    try {
      const file = await getFile(req.params.id, req.user!.tenantId);
      const buffer = await readFileContent(req.params.id, req.user!.tenantId);

      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${file.originalFilename}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      res.status(404).json({ error: error.message || "File not found" });
    }
  });

  // Get files for a resource
  app.get("/api/files", authenticate, async (req, res) => {
    try {
      const { resourceType, resourceId } = req.query;
      
      if (!resourceType || !resourceId) {
        return res.status(400).json({ error: "resourceType and resourceId required" });
      }

      const files = await getFilesForResource(
        resourceType as string,
        resourceId as string,
        req.user!.tenantId
      );
      res.json(files);
    } catch (error: any) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: error.message || "Failed to fetch files" });
    }
  });

  // Delete file
  app.delete("/api/files/:id", authenticate, requireRole("tenant_admin", "support_agent"), async (req, res) => {
    try {
      await deleteFile(req.params.id, req.user!.tenantId, req.user!.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: error.message || "Failed to delete file" });
    }
  });

  // ==================== Role & Permission Management Routes ====================

  // Get all roles with effective permissions for tenant
  app.get("/api/tenants/roles", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const roles = await getTenantRolesWithPermissions(req.user!.tenantId);
      res.json(roles);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: error.message || "Failed to fetch roles" });
    }
  });

  // Get effective permissions for a role
  app.get("/api/tenants/roles/:roleName/permissions", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const { roleName } = req.params;
      const permissions = await getEffectivePermissions(req.user!.tenantId, roleName);
      res.json({ roleName, permissions });
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch permissions" });
    }
  });

  // Check if user has permission
  app.get("/api/tenants/permissions/check", authenticate, async (req, res) => {
    try {
      const { resourceType, action } = req.query;
      
      if (!resourceType || !action) {
        return res.status(400).json({ error: "resourceType and action required" });
      }

      const hasAccess = await hasPermission(
        req.user!.tenantId,
        req.user!.role,
        resourceType as any,
        action as any
      );
      res.json({ hasPermission: hasAccess });
    } catch (error: any) {
      console.error("Error checking permission:", error);
      res.status(500).json({ error: error.message || "Failed to check permission" });
    }
  });

  // Set tenant-specific role permissions
  app.put("/api/tenants/roles/:roleName", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const { roleName } = req.params;
      const { permissions, displayName } = req.body;

      if (!permissions) {
        return res.status(400).json({ error: "permissions required" });
      }

      const role = await setTenantRole(req.user!.tenantId, roleName, permissions, displayName);

      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "update",
        resourceType: "role",
        resourceId: role.id,
        details: { roleName, permissions },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(role);
    } catch (error: any) {
      console.error("Error setting role:", error);
      res.status(500).json({ error: error.message || "Failed to set role" });
    }
  });

  // Get all role templates (global)
  app.get("/api/admin/role-templates", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const templates = await storage.getAllRoleTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching role templates:", error);
      res.status(500).json({ error: error.message || "Failed to fetch role templates" });
    }
  });

  // ==================== Integration Credential Routes ====================

  // Get integration credentials for tenant
  app.get("/api/integrations/credentials", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const credentials = await storage.getIntegrationCredentialsByTenant(req.user!.tenantId);
      // Decrypt credentials before returning (only for tenant admin)
      const decryptedCredentials = credentials.map(cred => ({
        id: cred.id,
        provider: cred.provider,
        isActive: cred.isActive,
        lastUsedAt: cred.lastUsedAt,
        // Decrypt credentials (in production, only return if user has permission)
        credentials: decryptCredentials(cred.encryptedCredentials),
      }));
      res.json(credentials.map(c => ({
        id: c.id,
        provider: c.provider,
        isActive: c.isActive,
        lastUsedAt: c.lastUsedAt,
        createdAt: c.createdAt,
      })));
    } catch (error: any) {
      console.error("Error fetching credentials:", error);
      res.status(500).json({ error: error.message || "Failed to fetch credentials" });
    }
  });

  // Create/update integration credential
  app.post("/api/integrations/credentials", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const { provider, credentials: credsData } = req.body;

      if (!provider || !credsData) {
        return res.status(400).json({ error: "provider and credentials required" });
      }

      // Encrypt credentials before storing
      const encryptedCredentials = encryptCredentials(credsData);

      const existing = await storage.getIntegrationCredential(req.user!.tenantId, provider);
      let credential;

      if (existing) {
        credential = await storage.updateIntegrationCredential(existing.id, req.user!.tenantId, {
          encryptedCredentials,
          isActive: true,
          updatedAt: new Date(),
        });
      } else {
        credential = await storage.createIntegrationCredential({
          tenantId: req.user!.tenantId,
          provider,
          encryptedCredentials,
          isActive: true,
        });
      }

      if (!credential) {
        return res.status(500).json({ error: "Failed to save credential" });
      }

      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: existing ? "update" : "create",
        resourceType: "integration_credential",
        resourceId: credential.id,
        details: { provider },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        id: credential.id,
        provider: credential.provider,
        isActive: credential.isActive,
      });
    } catch (error: any) {
      console.error("Error saving credentials:", error);
      res.status(500).json({ error: error.message || "Failed to save credentials" });
    }
  });

  // Delete integration credential
  app.delete("/api/integrations/credentials/:id", authenticate, requireRole("tenant_admin", "super_admin"), enforceTenantIsolation, async (req, res) => {
    try {
      const deleted = await storage.deleteIntegrationCredential(req.params.id, req.user!.tenantId);
      if (!deleted) {
        return res.status(404).json({ error: "Credential not found" });
      }

      await logAuditEvent({
        tenantId: req.user!.tenantId,
        userId: req.user!.id,
        action: "delete",
        resourceType: "integration_credential",
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting credential:", error);
      res.status(500).json({ error: error.message || "Failed to delete credential" });
    }
  });

  // ==================== Impersonation Routes ====================

  // Request impersonation (step 1: confirmation required)
  app.post("/api/admin/impersonate/request", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, userId, reason } = req.body;
      if (!tenantId || !userId || !reason) {
        return res.status(400).json({ error: "tenantId, userId, and reason are required" });
      }
      const result = await requestImpersonation(
        req.user!.id,
        tenantId,
        userId,
        reason,
        req.ip,
        req.headers["user-agent"]
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error requesting impersonation:", error);
      res.status(500).json({ error: error.message || "Failed to request impersonation" });
    }
  });

  // Confirm and start impersonation (step 2: explicit confirmation)
  app.post("/api/admin/impersonate/confirm", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { tenantId, userId, reason, confirmationToken } = req.body;
      if (!tenantId || !userId || !reason || !confirmationToken) {
        return res.status(400).json({ error: "All fields are required" });
      }
      const result = await confirmImpersonation(
        req.user!.id,
        tenantId,
        userId,
        reason,
        confirmationToken,
        req.ip,
        req.headers["user-agent"]
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error confirming impersonation:", error);
      res.status(500).json({ error: error.message || "Failed to confirm impersonation" });
    }
  });

  // End impersonation session
  app.post("/api/admin/impersonate/end", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      await endImpersonation(sessionId, req.user!.id, req.ip, req.headers["user-agent"]);
      res.json({ success: true, message: "Impersonation session ended" });
    } catch (error: any) {
      console.error("Error ending impersonation:", error);
      res.status(500).json({ error: error.message || "Failed to end impersonation" });
    }
  });

  // Get active impersonations
  app.get("/api/admin/impersonate/active", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const sessions = getActiveImpersonations(req.user!.id);
      res.json(sessions);
    } catch (error: any) {
      console.error("Error fetching active impersonations:", error);
      res.status(500).json({ error: error.message || "Failed to fetch active impersonations" });
    }
  });

  // ==================== Monitoring & Alerts Routes ====================

  // Get tenant metrics
  app.get("/api/tenants/metrics", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.role === "super_admin" && req.query.tenantId 
        ? req.query.tenantId as string 
        : req.user!.tenantId;
      const metrics = await getTenantMetrics(tenantId, req.query.period as string);
      if (!metrics) {
        return res.status(404).json({ error: "Metrics not found" });
      }
      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching tenant metrics:", error);
      res.status(500).json({ error: error.message || "Failed to fetch metrics" });
    }
  });

  // Get tenant alerts
  app.get("/api/tenants/alerts", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const tenantId = req.user!.role === "super_admin" && req.query.tenantId 
        ? req.query.tenantId as string 
        : req.user!.tenantId;
      const { acknowledged, severity, limit } = req.query;
      const alerts = getTenantAlerts(tenantId, {
        acknowledged: acknowledged === "true" ? true : acknowledged === "false" ? false : undefined,
        severity: severity as string,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(alerts);
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch alerts" });
    }
  });

  // Acknowledge alert
  app.post("/api/tenants/alerts/:alertId/acknowledge", authenticate, requireRole("tenant_admin", "super_admin"), async (req, res) => {
    try {
      const acknowledged = acknowledgeAlert(req.params.alertId, req.user!.id);
      if (!acknowledged) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true, message: "Alert acknowledged" });
    } catch (error: any) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ error: error.message || "Failed to acknowledge alert" });
    }
  });

  // Get all alerts (super-admin only)
  app.get("/api/admin/alerts", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const { severity, limit } = req.query;
      const alerts = getAllAlerts({
        severity: severity as string,
        limit: limit ? Number(limit) : undefined,
      });
      res.json(alerts);
    } catch (error: any) {
      console.error("Error fetching all alerts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch alerts" });
    }
  });

  // Check thresholds and create alerts (can be called periodically)
  app.post("/api/admin/tenants/:tenantId/check-thresholds", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const alerts = await checkThresholds(req.params.tenantId);
      res.json({ alerts, count: alerts.length });
    } catch (error: any) {
      console.error("Error checking thresholds:", error);
      res.status(500).json({ error: error.message || "Failed to check thresholds" });
    }
  });

  // ==================== Quota Enforcement Middleware ====================
  // This middleware should be applied to routes that consume quotas
  // For now, we'll add it to key routes manually

  // ==================== Register RBAC Routes ====================
  registerUserRoutes(app);
  registerInviteRoutes(app);
  registerMFARoutes(app);
  registerTeamRoutes(app);
  registerRoleRoutes(app);
  registerAIRoutes(app);
  registerSLARoutes(app);
  registerTagsRoutes(app);
  registerTelephonyRoutes(app);
  registerConnectorRoutes(app);
  
  // Register OAuth and webhook routes
  app.use("/api/oauth", oauthRouter);
  app.use("/api/webhooks", webhookRouter);

  const httpServer = createServer(app);

  return httpServer;
}
