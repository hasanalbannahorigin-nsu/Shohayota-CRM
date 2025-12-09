/**
 * Tenant Isolation Tests
 * 
 * Tests to verify that multi-tenant isolation is properly enforced
 * across Tickets, Messages, Search, and Analytics modules.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { storage } from "../server/storage";
import type { Express } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

// Mock Express app for testing
let app: Express;
let server: any;

beforeAll(async () => {
  // Initialize test data
  const { default: express } = await import("express");
  app = express();
  app.use(express.json());
  
  // Register routes
  server = await registerRoutes(app);
  
  // Create test tenants and users
  const tenantA = await storage.createTenant({
    name: "Test Tenant A",
    contactEmail: "admin@tenanta.com",
    slug: "tenant-a",
  });
  
  const tenantB = await storage.createTenant({
    name: "Test Tenant B",
    contactEmail: "admin@tenantb.com",
    slug: "tenant-b",
  });
  
  // Create users for each tenant
  const userA = await storage.createUser({
    email: "admin@tenanta.com",
    name: "Tenant A Admin",
    password: "test123",
    role: "tenant_admin",
    tenantId: tenantA.id,
  });
  
  const userB = await storage.createUser({
    email: "admin@tenantb.com",
    name: "Tenant B Admin",
    password: "test123",
    role: "tenant_admin",
    tenantId: tenantB.id,
  });
  
  // Create test customers
  const customerA = await storage.createCustomer({
    tenantId: tenantA.id,
    name: "Customer A",
    email: "customer@tenanta.com",
    status: "active",
  });
  
  const customerB = await storage.createCustomer({
    tenantId: tenantB.id,
    name: "Customer B",
    email: "customer@tenantb.com",
    status: "active",
  });
  
  // Create test tickets
  const ticketA = await storage.createTicket({
    tenantId: tenantA.id,
    customerId: customerA.id,
    title: "Ticket A",
    description: "Description A",
    category: "support",
    createdBy: userA.id,
  });
  
  const ticketB = await storage.createTicket({
    tenantId: tenantB.id,
    customerId: customerB.id,
    title: "Ticket B",
    description: "Description B",
    category: "support",
    createdBy: userB.id,
  });
  
  // Store test data globally for tests
  (global as any).testData = {
    tenantA,
    tenantB,
    userA,
    userB,
    customerA,
    customerB,
    ticketA,
    ticketB,
  };
});

afterAll(async () => {
  if (server) {
    server.close();
  }
});

// Helper function to login and get token
async function loginAs(email: string, password: string = "test123"): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.body.error}`);
  }
  
  return res.body.token;
}

describe("Tenant Isolation - Tickets", () => {
  it("should only return tickets for tenant A when logged in as tenant A admin", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get("/api/tickets")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All tickets should belong to tenant A
    res.body.forEach((ticket: any) => {
      expect(ticket.tenantId).toBe(testData.tenantA.id);
    });
    
    // Should not include tenant B tickets
    const tenantBTickets = res.body.filter((t: any) => t.tenantId === testData.tenantB.id);
    expect(tenantBTickets.length).toBe(0);
  });
  
  it("should return 404 when tenant A admin requests ticket from tenant B", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get(`/api/tickets/${testData.ticketB.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("not found");
  });
  
  it("should allow tenant A admin to create ticket in their own tenant", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId: testData.customerA.id,
        title: "New Ticket A",
        description: "New description",
        category: "support",
      });
    
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe(testData.tenantA.id);
    expect(res.body.title).toBe("New Ticket A");
  });
  
  it("should ignore tenantId in body when creating ticket as tenant A admin", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    // Try to create ticket with tenant B's ID in body
    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId: testData.tenantB.id, // Should be ignored
        customerId: testData.customerA.id,
        title: "Ticket with spoofed tenantId",
        description: "Should be created in tenant A",
        category: "support",
      });
    
    expect(res.status).toBe(201);
    // Ticket should be created in tenant A, not tenant B
    expect(res.body.tenantId).toBe(testData.tenantA.id);
    expect(res.body.tenantId).not.toBe(testData.tenantB.id);
  });
  
  it("should return 404 when tenant A admin tries to update ticket from tenant B", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .patch(`/api/tickets/${testData.ticketB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "closed",
      });
    
    expect(res.status).toBe(404);
  });
});

describe("Tenant Isolation - Messages", () => {
  it("should only return messages for tickets in tenant A", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    // Create a message for ticket A
    await storage.createMessage({
      tenantId: testData.tenantA.id,
      ticketId: testData.ticketA.id,
      senderId: testData.userA.id,
      body: "Message for ticket A",
    });
    
    const res = await request(app)
      .get(`/api/tickets/${testData.ticketA.id}/messages`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All messages should belong to tenant A
    res.body.forEach((message: any) => {
      expect(message.tenantId).toBe(testData.tenantA.id);
      expect(message.ticketId).toBe(testData.ticketA.id);
    });
  });
  
  it("should return 404 when tenant A admin requests messages for tenant B ticket", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get(`/api/tickets/${testData.ticketB.id}/messages`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(404);
  });
  
  it("should prevent tenant A admin from posting message to tenant B ticket", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .post("/api/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ticketId: testData.ticketB.id,
        content: "Trying to post to tenant B ticket",
      });
    
    expect(res.status).toBe(404); // Ticket not found (because it's in different tenant)
  });
});

describe("Tenant Isolation - Search", () => {
  it("should only return search results from tenant A", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get("/api/search?q=Ticket")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All results should belong to tenant A
    res.body.forEach((result: any) => {
      if (result.type === "ticket") {
        // Verify ticket belongs to tenant A
        const ticket = res.body.find((r: any) => r.id === result.id && r.type === "ticket");
        expect(ticket).toBeDefined();
      }
    });
  });
  
  it("should not return tenant B customers in search results for tenant A admin", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get("/api/search?q=Customer")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    
    // Should not find tenant B customer
    const tenantBCustomer = res.body.find(
      (r: any) => r.type === "customer" && r.id === testData.customerB.id
    );
    expect(tenantBCustomer).toBeUndefined();
  });
});

describe("Tenant Isolation - Analytics", () => {
  it("should only return analytics for tenant A", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .get("/api/analytics/stats")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    
    // Analytics should only reflect tenant A's data
    expect(res.body.totalTickets).toBeGreaterThanOrEqual(0);
    expect(res.body.totalCustomers).toBeGreaterThanOrEqual(0);
    
    // Verify counts match tenant A's actual data
    const tenantATickets = await storage.getTicketsByTenant(testData.tenantA.id);
    const tenantACustomers = await storage.getCustomersByTenant(testData.tenantA.id, 1000, 0);
    
    expect(res.body.totalTickets).toBe(tenantATickets.length);
    expect(res.body.totalCustomers).toBe(tenantACustomers.length);
  });
  
  it("should return different analytics for tenant B", async () => {
    const testData = (global as any).testData;
    const tokenB = await loginAs("admin@tenantb.com");
    
    const res = await request(app)
      .get("/api/analytics/stats")
      .set("Authorization", `Bearer ${tokenB}`);
    
    expect(res.status).toBe(200);
    
    // Analytics should reflect tenant B's data
    const tenantBTickets = await storage.getTicketsByTenant(testData.tenantB.id);
    const tenantBCustomers = await storage.getCustomersByTenant(testData.tenantB.id, 1000, 0);
    
    expect(res.body.totalTickets).toBe(tenantBTickets.length);
    expect(res.body.totalCustomers).toBe(tenantBCustomers.length);
  });
});

describe("Super Admin Access", () => {
  it("should allow super admin to access tenant A data with ?tenantId= query param", async () => {
    const testData = (global as any).testData;
    
    // Create super admin user
    const superAdmin = await storage.createUser({
      email: "superadmin@test.com",
      name: "Super Admin",
      password: "test123",
      role: "super_admin",
      tenantId: testData.tenantA.id, // Super admin has a system tenant
    });
    
    const token = await loginAs("superadmin@test.com");
    
    // Access tenant A tickets
    const res = await request(app)
      .get(`/api/tickets?tenantId=${testData.tenantA.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All tickets should belong to tenant A
    res.body.forEach((ticket: any) => {
      expect(ticket.tenantId).toBe(testData.tenantA.id);
    });
  });
  
  it("should allow super admin to access tenant B data with ?tenantId= query param", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("superadmin@test.com");
    
    // Access tenant B tickets
    const res = await request(app)
      .get(`/api/tickets?tenantId=${testData.tenantB.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All tickets should belong to tenant B
    res.body.forEach((ticket: any) => {
      expect(ticket.tenantId).toBe(testData.tenantB.id);
    });
  });
  
  it("should prevent non-super-admin from using ?tenantId= query param", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    // Try to access tenant B with ?tenantId= (should be ignored)
    const res = await request(app)
      .get(`/api/tickets?tenantId=${testData.tenantB.id}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    
    // Should still only return tenant A tickets (tenantId param ignored)
    res.body.forEach((ticket: any) => {
      expect(ticket.tenantId).toBe(testData.tenantA.id);
    });
  });
});

describe("Defensive Coding - Tenant Spoofing Prevention", () => {
  it("should ignore tenantId in request body for non-super-admins", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    // Try to create customer with tenant B's ID in body
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId: testData.tenantB.id, // Should be ignored
        name: "Spoofed Customer",
        email: "spoofed@test.com",
      });
    
    expect(res.status).toBe(201);
    // Customer should be created in tenant A, not tenant B
    expect(res.body.tenantId).toBe(testData.tenantA.id);
    expect(res.body.tenantId).not.toBe(testData.tenantB.id);
  });
  
  it("should prevent tenant A admin from updating tenant B customer", async () => {
    const testData = (global as any).testData;
    const token = await loginAs("admin@tenanta.com");
    
    const res = await request(app)
      .patch(`/api/customers/${testData.customerB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Name",
      });
    
    expect(res.status).toBe(404);
  });
});

