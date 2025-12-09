/**
 * Verification Routes for Tenant Isolation
 * 
 * Quick verification endpoints to test tenant isolation
 * These endpoints help verify that multi-tenant isolation is working correctly
 */

import type { Express } from "express";
import { authenticate, requireRole } from "./auth";
import { getRequestTenantId } from "./strict-tenant-isolation";
import { storage } from "./storage";

export function registerVerificationRoutes(app: Express): void {
  /**
   * GET /api/verify/tenant-isolation
   * 
   * Returns information about the current user's tenant context
   * and verifies tenant isolation is working
   */
  app.get("/api/verify/tenant-isolation", authenticate, async (req, res) => {
    try {
      const tenantId = getRequestTenantId(req);
      const user = req.user!;
      
      // Get counts for current tenant
      const customers = await storage.getCustomersByTenant(tenantId, 1000, 0);
      const tickets = await storage.getTicketsByTenant(tenantId);
      // Get all messages for tenant (iterate through tickets)
      const allMessages: any[] = [];
      for (const ticket of tickets) {
        const ticketMessages = await storage.getMessagesByTicket(ticket.id, tenantId);
        allMessages.push(...ticketMessages);
      }
      const users = await storage.getUsersByTenant(tenantId);
      
      // Verify all data belongs to tenant
      const customerViolations = customers.filter((c: any) => c.tenantId !== tenantId);
      const ticketViolations = tickets.filter((t: any) => t.tenantId !== tenantId);
      const messageViolations = allMessages.filter((m: any) => m.tenantId !== tenantId);
      const userViolations = users.filter((u: any) => u.tenantId !== tenantId);
      
      const verification = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        requestTenantId: tenantId,
        counts: {
          customers: customers.length,
          tickets: tickets.length,
          messages: allMessages.length,
          users: users.length,
        },
        isolation: {
          status: "ok",
          violations: {
            customers: customerViolations.length,
            tickets: ticketViolations.length,
            messages: messageViolations.length,
            users: userViolations.length,
          },
        },
        timestamp: new Date().toISOString(),
      };
      
      // If violations found, mark as error
      const totalViolations = 
        customerViolations.length + 
        ticketViolations.length + 
        messageViolations.length + 
        userViolations.length;
      
      if (totalViolations > 0) {
        verification.isolation.status = "error";
        verification.isolation.violations = {
          customers: customerViolations.map((c: any) => ({ id: c.id, tenantId: c.tenantId })),
          tickets: ticketViolations.map((t: any) => ({ id: t.id, tenantId: t.tenantId })),
          messages: messageViolations.map((m: any) => ({ id: m.id, tenantId: m.tenantId })),
          users: userViolations.map((u: any) => ({ id: u.id, tenantId: u.tenantId })),
        };
      }
      
      res.json(verification);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Verification failed", 
        message: error.message 
      });
    }
  });
  
  /**
   * GET /api/verify/cross-tenant-access
   * 
   * Tests cross-tenant access prevention
   * Attempts to access resources from other tenants
   */
  app.get("/api/verify/cross-tenant-access", authenticate, async (req, res) => {
    try {
      const tenantId = getRequestTenantId(req);
      const user = req.user!;
      
      // Get all tenants
      const allTenants = Array.from((storage as any).tenants.values());
      const otherTenants = allTenants.filter((t: any) => t.id !== tenantId);
      
      const results = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        currentTenant: tenantId,
        crossTenantTests: [] as any[],
      };
      
      // Test accessing other tenants' data
      for (const otherTenant of otherTenants.slice(0, 3)) { // Test up to 3 other tenants
        const otherCustomers = await storage.getCustomersByTenant(otherTenant.id, 10, 0);
        const otherTickets = await storage.getTicketsByTenant(otherTenant.id);
        
        // Try to access a customer from other tenant (should return empty or filtered)
        const testCustomerId = otherCustomers[0]?.id;
        if (testCustomerId) {
          const accessedCustomer = await storage.getCustomer(testCustomerId, tenantId);
          results.crossTenantTests.push({
            tenantId: otherTenant.id,
            tenantName: otherTenant.name,
            test: "access_customer",
            customerId: testCustomerId,
            accessible: accessedCustomer !== undefined,
            expected: false,
            passed: accessedCustomer === undefined,
          });
        }
        
        // Try to access a ticket from other tenant (should return undefined)
        const testTicketId = otherTickets[0]?.id;
        if (testTicketId) {
          const accessedTicket = await storage.getTicket(testTicketId, tenantId);
          results.crossTenantTests.push({
            tenantId: otherTenant.id,
            tenantName: otherTenant.name,
            test: "access_ticket",
            ticketId: testTicketId,
            accessible: accessedTicket !== undefined,
            expected: false,
            passed: accessedTicket === undefined,
          });
        }
      }
      
      const allPassed = results.crossTenantTests.every((test) => test.passed);
      
      res.json({
        ...results,
        summary: {
          totalTests: results.crossTenantTests.length,
          passed: results.crossTenantTests.filter((t) => t.passed).length,
          failed: results.crossTenantTests.filter((t) => !t.passed).length,
          allPassed,
        },
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Cross-tenant access test failed", 
        message: error.message 
      });
    }
  });
  
  /**
   * GET /api/verify/tenant-spoofing-prevention
   * 
   * Tests that tenant spoofing is prevented
   * Verifies that client-supplied tenantId is ignored for non-super-admins
   */
  app.get("/api/verify/tenant-spoofing-prevention", authenticate, async (req, res) => {
    try {
      const tenantId = getRequestTenantId(req);
      const user = req.user!;
      
      // Get all tenants
      const allTenants = Array.from((storage as any).tenants.values());
      const otherTenants = allTenants.filter((t: any) => t.id !== tenantId);
      
      const results = {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        currentTenant: tenantId,
        spoofingTests: [] as any[],
        note: user.role === "super_admin" 
          ? "Super admin can set tenantId in body - this is expected behavior"
          : "Non-super-admins should have tenantId stripped from request body",
      };
      
      if (user.role !== "super_admin" && otherTenants.length > 0) {
        const otherTenant = otherTenants[0];
        
        // Test: Try to create customer with other tenant's ID in body
        // This should be prevented by middleware
        results.spoofingTests.push({
          test: "create_customer_with_spoofed_tenantId",
          attemptedTenantId: otherTenant.id,
          expectedBehavior: "tenantId should be ignored, customer created in user's tenant",
          note: "This test requires actual POST request - see manual test instructions",
        });
        
        // Test: Verify getRequestTenantId ignores query param for non-super-admins
        const testReq = {
          user,
          query: { tenantId: otherTenant.id },
        } as any;
        
        const effectiveTenantId = getRequestTenantId(testReq);
        results.spoofingTests.push({
          test: "query_param_tenantId_ignored",
          attemptedTenantId: otherTenant.id,
          effectiveTenantId,
          expected: tenantId,
          passed: effectiveTenantId === tenantId,
        });
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ 
        error: "Tenant spoofing prevention test failed", 
        message: error.message 
      });
    }
  });
  
  /**
   * GET /api/verify/super-admin-access
   * 
   * Tests super admin cross-tenant access with ?tenantId= query param
   */
  app.get("/api/verify/super-admin-access", authenticate, requireRole("super_admin"), async (req, res) => {
    try {
      const user = req.user!;
      const requestedTenantId = req.query.tenantId as string | undefined;
      
      if (!requestedTenantId) {
        return res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
          },
          message: "Provide ?tenantId= query param to test cross-tenant access",
          example: "/api/verify/super-admin-access?tenantId=<tenant-id>",
        });
      }
      
      // Verify tenant exists
      const tenant = await storage.getTenant(requestedTenantId);
      if (!tenant) {
        return res.status(404).json({ 
          error: "Tenant not found",
          requestedTenantId 
        });
      }
      
      // Get data for requested tenant
      const customers = await storage.getCustomersByTenant(requestedTenantId, 10, 0);
      const tickets = await storage.getTicketsByTenant(requestedTenantId);
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        requestedTenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        access: {
          customers: customers.length,
          tickets: tickets.length,
        },
        verification: {
          allCustomersBelongToTenant: customers.every((c: any) => c.tenantId === requestedTenantId),
          allTicketsBelongToTenant: tickets.every((t: any) => t.tenantId === requestedTenantId),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ 
        error: "Super admin access test failed", 
        message: error.message 
      });
    }
  });
}

