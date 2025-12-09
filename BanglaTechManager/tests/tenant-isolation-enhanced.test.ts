/**
 * Enhanced Tenant Isolation Tests
 * 
 * Comprehensive tests for tenant isolation and company name enforcement
 * 
 * Run with: npm test -- tenant-isolation-enhanced
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { app } from "../server/index";
import { storage } from "../server/storage";

// Test helper functions
async function getTokenFor(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  
  if (res.status !== 200) {
    throw new Error(`Failed to get token for ${email}: ${res.body.error}`);
  }
  
  return res.body.token;
}

async function createTestTenant(name: string, email: string): Promise<string> {
  const tenant = await storage.createTenant({
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    contactEmail: email,
  });
  return tenant.id;
}

async function createTestUser(
  tenantId: string,
  email: string,
  password: string = "test123"
): Promise<string> {
  const user = await storage.createUser({
    tenantId,
    email,
    name: email.split("@")[0],
    password,
    role: "tenant_admin",
  } as any);
  return user.id;
}

describe("Tenant Isolation - Enhanced Tests", () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let tenant1Token: string;
  let tenant2Token: string;
  let tenant1CustomerId: string;
  let tenant2CustomerId: string;

  beforeAll(async () => {
    // Create test tenants
    tenant1Id = await createTestTenant("Test Tenant 1", "admin@tenant1.com");
    tenant2Id = await createTestTenant("Test Tenant 2", "admin@tenant2.com");

    // Create test users
    await createTestUser(tenant1Id, "admin@tenant1.com", "test123");
    await createTestUser(tenant2Id, "admin@tenant2.com", "test123");

    // Get tokens
    tenant1Token = await getTokenFor("admin@tenant1.com", "test123");
    tenant2Token = await getTokenFor("admin@tenant2.com", "test123");

    // Create test customers
    const customer1 = await storage.createCustomer({
      tenantId: tenant1Id,
      name: "Customer 1",
      email: "customer1@example.com",
      phone: "+8801234567890",
      status: "active",
    } as any);

    const customer2 = await storage.createCustomer({
      tenantId: tenant2Id,
      name: "Customer 2",
      email: "customer2@example.com",
      phone: "+8809876543210",
      status: "active",
    } as any);

    tenant1CustomerId = customer1.id;
    tenant2CustomerId = customer2.id;
  });

  describe("Company Name Enforcement", () => {
    test("customer list returns companyName from tenant", async () => {
      const res = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      res.body.forEach((c: any) => {
        expect(c.companyName).toBeDefined();
        expect(c.companyName).toBe("Test Tenant 1");
      });
    });

    test("single customer returns companyName from tenant", async () => {
      const res = await request(app)
        .get(`/api/customers/${tenant1CustomerId}`)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.companyName).toBe("Test Tenant 1");
    });

    test("client-provided company field is ignored on create", async () => {
      const payload = {
        name: "New Customer",
        email: "new@example.com",
        phone: "+8801111111111",
        company: "FAKE COMPANY NAME",
      };

      const res = await request(app)
        .post("/api/customers")
        .send(payload)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.companyName).toBe("Test Tenant 1");
      expect(res.body.companyName).not.toBe("FAKE COMPANY NAME");
    });

    test("client-provided company field is ignored on update", async () => {
      const payload = {
        name: "Updated Customer",
        company: "FAKE COMPANY NAME",
      };

      const res = await request(app)
        .patch(`/api/customers/${tenant1CustomerId}`)
        .send(payload)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.companyName).toBe("Test Tenant 1");
      expect(res.body.companyName).not.toBe("FAKE COMPANY NAME");
    });
  });

  describe("Tenant Isolation", () => {
    test("tenant admin only sees own customers", async () => {
      const res = await request(app)
        .get("/api/customers")
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      res.body.forEach((c: any) => {
        expect(c.tenantId).toBe(tenant1Id);
      });
    });

    test("tenant admin cannot access other tenant's customer", async () => {
      const res = await request(app)
        .get(`/api/customers/${tenant2CustomerId}`)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(404);
    });

    test("tenant admin cannot update other tenant's customer", async () => {
      const res = await request(app)
        .patch(`/api/customers/${tenant2CustomerId}`)
        .send({ name: "Hacked" })
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(404);
    });

    test("tenant admin cannot delete other tenant's customer", async () => {
      const res = await request(app)
        .delete(`/api/customers/${tenant2CustomerId}`)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Tenant ID Spoofing Prevention", () => {
    test("client-provided tenant_id is ignored on create", async () => {
      const payload = {
        name: "Spoofed Customer",
        email: "spoofed@example.com",
        tenant_id: tenant2Id, // Try to create in other tenant
      };

      const res = await request(app)
        .post("/api/customers")
        .send(payload)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.tenantId).toBe(tenant1Id); // Should be in tenant1
      expect(res.body.tenantId).not.toBe(tenant2Id);
      expect(res.body.companyName).toBe("Test Tenant 1");
    });

    test("client-provided tenantId is ignored on create", async () => {
      const payload = {
        name: "Another Spoofed Customer",
        email: "spoofed2@example.com",
        tenantId: tenant2Id, // Try different field name
      };

      const res = await request(app)
        .post("/api/customers")
        .send(payload)
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.tenantId).toBe(tenant1Id);
    });
  });

  describe("Search Tenant Isolation", () => {
    test("search only returns own tenant's customers", async () => {
      const res = await request(app)
        .get("/api/customers/search?q=Customer")
        .set("Authorization", `Bearer ${tenant1Token}`);

      expect(res.status).toBe(200);
      res.body.forEach((c: any) => {
        expect(c.tenantId).toBe(tenant1Id);
        expect(c.companyName).toBe("Test Tenant 1");
      });
    });
  });
});

