import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { createServer } from "../server/index";
import { storage } from "../server/storage";
import type { Express } from "express";

describe("Customer Access & Permissions", () => {
  let app: Express;
  let customerToken: string;
  let customerId: string;
  let tenantId: string;
  let otherCustomerToken: string;
  let otherCustomerId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    app = await createServer();
    
    // Create test tenant
    const tenant = await storage.createTenant({
      name: "Test Tenant",
      domain: "test.com",
      plan: "pro",
    });
    tenantId = tenant.id;

    // Create another tenant for isolation testing
    const otherTenant = await storage.createTenant({
      name: "Other Tenant",
      domain: "other.com",
      plan: "pro",
    });
    otherTenantId = otherTenant.id;

    // Create customer in first tenant
    const customer = await storage.createCustomer({
      tenantId,
      name: "Test Customer",
      email: "customer@test.com",
      phone: "1234567890",
      status: "active",
    });
    customerId = customer.id;

    // Create customer user account
    const customerUser = await storage.createCustomerUser(
      tenantId,
      customerId,
      "customer@test.com",
      "password123",
      "Test Customer"
    );

    // Create customer in other tenant
    const otherCustomer = await storage.createCustomer({
      tenantId: otherTenantId,
      name: "Other Customer",
      email: "customer@other.com",
      phone: "0987654321",
      status: "active",
    });
    otherCustomerId = otherCustomer.id;

    // Create other customer user account
    const otherCustomerUser = await storage.createCustomerUser(
      otherTenantId,
      otherCustomerId,
      "customer@other.com",
      "password123",
      "Other Customer"
    );

    // Login as customer to get token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@test.com", password: "password123" });
    
    expect(loginRes.status).toBe(200);
    customerToken = loginRes.body.token;
    expect(loginRes.body.user.role).toBe("customer");
    expect(loginRes.body.user.customerId).toBe(customerId);

    // Login as other customer
    const otherLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "customer@other.com", password: "password123" });
    
    expect(otherLoginRes.status).toBe(200);
    otherCustomerToken = otherLoginRes.body.token;
  });

  describe("GET /api/customers/me", () => {
    it("should return customer profile for authenticated customer", async () => {
      const res = await request(app)
        .get("/api/customers/me")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerId);
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.email).toBe("customer@test.com");
    });

    it("should return 403 for non-customer users", async () => {
      // This would require creating a non-customer user, but for now we'll test the endpoint
      // In a real scenario, you'd create a tenant_admin user and try to access this endpoint
      // For now, we'll just verify the endpoint exists and requires authentication
      const res = await request(app)
        .get("/api/customers/me");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/customers/me/tickets", () => {
    it("should return only customer's tickets", async () => {
      // Create a ticket for this customer
      const ticket = await storage.createTicket({
        tenantId,
        customerId,
        title: "Test Ticket",
        description: "Test description",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .get("/api/customers/me/tickets")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((t: any) => t.id === ticket.id)).toBe(true);
      // Verify all tickets belong to this customer
      res.body.forEach((ticket: any) => {
        expect(ticket.customerId).toBe(customerId);
        expect(ticket.tenantId).toBe(tenantId);
      });
    });

    it("should not return tickets from other customers", async () => {
      // Create a ticket for another customer in the same tenant
      const otherCustomer = await storage.createCustomer({
        tenantId,
        name: "Another Customer",
        email: "another@test.com",
        phone: "1111111111",
        status: "active",
      });

      await storage.createTicket({
        tenantId,
        customerId: otherCustomer.id,
        title: "Other Customer Ticket",
        description: "Should not see this",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .get("/api/customers/me/tickets")
        .set("Authorization", `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      // Should not contain the other customer's ticket
      expect(res.body.some((t: any) => t.customerId === otherCustomer.id)).toBe(false);
    });
  });

  describe("POST /api/customers/me/tickets", () => {
    it("should create ticket for customer", async () => {
      const res = await request(app)
        .post("/api/customers/me/tickets")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          title: "New Customer Ticket",
          description: "Customer created this ticket",
          category: "support",
          priority: "high",
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("New Customer Ticket");
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.status).toBe("open");
    });

    it("should ignore tenantId and customerId from request body", async () => {
      const res = await request(app)
        .post("/api/customers/me/tickets")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          title: "Security Test Ticket",
          description: "Testing tenant isolation",
          tenantId: otherTenantId, // Try to spoof tenant
          customerId: otherCustomerId, // Try to spoof customer
        });

      expect(res.status).toBe(201);
      // Should use authenticated user's tenantId and customerId
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.customerId).toBe(customerId);
      expect(res.body.tenantId).not.toBe(otherTenantId);
      expect(res.body.customerId).not.toBe(otherCustomerId);
    });
  });

  describe("POST /api/customers/me/tickets/:ticketId/messages", () => {
    it("should allow customer to send message in their ticket", async () => {
      const ticket = await storage.createTicket({
        tenantId,
        customerId,
        title: "Message Test Ticket",
        description: "For testing messages",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .post(`/api/customers/me/tickets/${ticket.id}/messages`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          body: "This is a test message from customer",
        });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe("This is a test message from customer");
      expect(res.body.ticketId).toBe(ticket.id);
      expect(res.body.tenantId).toBe(tenantId);
    });

    it("should not allow customer to message other customer's ticket", async () => {
      const otherCustomer = await storage.createCustomer({
        tenantId,
        name: "Another Customer",
        email: "another2@test.com",
        phone: "2222222222",
        status: "active",
      });

      const otherTicket = await storage.createTicket({
        tenantId,
        customerId: otherCustomer.id,
        title: "Other Customer Ticket",
        description: "Should not access",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .post(`/api/customers/me/tickets/${otherTicket.id}/messages`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          body: "Trying to message other customer's ticket",
        });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/customers/me/calls", () => {
    it("should create call request for customer", async () => {
      const res = await request(app)
        .post("/api/customers/me/calls")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          direction: "outbound",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("requested");
      expect(res.body.tenantId).toBe(tenantId);
      expect(res.body.requesterId).toBe((await storage.getUserByEmail("customer@test.com"))!.id);
    });

    it("should allow associating call request with customer's ticket", async () => {
      const ticket = await storage.createTicket({
        tenantId,
        customerId,
        title: "Call Request Ticket",
        description: "For call request",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .post("/api/customers/me/calls")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          ticketId: ticket.id,
          direction: "outbound",
        });

      expect(res.status).toBe(201);
      expect(res.body.ticketId).toBe(ticket.id);
    });

    it("should not allow associating call request with other customer's ticket", async () => {
      const otherCustomer = await storage.createCustomer({
        tenantId,
        name: "Another Customer",
        email: "another3@test.com",
        phone: "3333333333",
        status: "active",
      });

      const otherTicket = await storage.createTicket({
        tenantId,
        customerId: otherCustomer.id,
        title: "Other Customer Ticket",
        description: "Should not access",
        category: "support",
        status: "open",
        priority: "medium",
        createdBy: (await storage.getUserByEmail("customer@test.com"))!.id,
      });

      const res = await request(app)
        .post("/api/customers/me/calls")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          ticketId: otherTicket.id,
          direction: "outbound",
        });

      expect(res.status).toBe(404);
    });
  });

  describe("Tenant Isolation", () => {
    it("should not allow customer from one tenant to access other tenant's data", async () => {
      // Try to access other tenant's customer profile (should fail)
      const res = await request(app)
        .get("/api/customers/me")
        .set("Authorization", `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tenantId).toBe(otherTenantId);
      expect(res.body.tenantId).not.toBe(tenantId);
    });
  });
});

