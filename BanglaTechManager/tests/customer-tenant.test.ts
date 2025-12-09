/**
 * Customer Tenant Company Name Tests
 * 
 * Tests to verify that company names come from tenant, not from customer records
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import { storage } from "../server/storage";
import type { Express } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

// Mock Express app for testing
let app: Express;
let server: any;
let testTenant: any;
let testUser: any;

beforeAll(async () => {
  // Initialize test data
  const { default: express } = await import("express");
  app = express();
  app.use(express.json());
  
  // Register routes
  server = await registerRoutes(app);
  
  // Create test tenant
  testTenant = await storage.createTenant({
    name: "Dhaka Tech Solutions",
    contactEmail: "admin@dhakatech.com",
    slug: "dhaka-tech",
  });
  
  // Create test user
  testUser = await storage.createUser({
    email: "admin@dhakatech.com",
    name: "Test Admin",
    password: "test123",
    role: "tenant_admin",
    tenantId: testTenant.id,
  });
});

describe("Customer Company Name from Tenant", () => {
  it("creates customer under tenant and returns tenant companyName", async () => {
    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    
    // Create customer with company field in body (should be ignored)
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ 
        name: "John Doe", 
        email: "john@example.com", 
        company: "OTHER COMPANY" // This should be ignored
      });
    
    expect(res.status).toBe(201);
    expect(res.body.companyName).toBe("Dhaka Tech Solutions"); // tenant name from DB
    expect(res.body.companyName).not.toBe("OTHER COMPANY");
    expect(res.body.company).toBeNull(); // company field should be null
  });
  
  it("lists customers with companyName belonging to tenant", async () => {
    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    
    // Create a few customers
    await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Customer 1", email: "customer1@test.com" });
    
    await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Customer 2", email: "customer2@test.com" });
    
    // List customers
    const res = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All customers should have companyName from tenant
    res.body.forEach((c: any) => {
      expect(c.companyName).toBe("Dhaka Tech Solutions");
      expect(c.company).toBeNull(); // company field should be null
    });
  });
  
  it("ignores company field when updating customer", async () => {
    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    
    // Create customer
    const createRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test Customer", email: "test@test.com" });
    
    const customerId = createRes.body.id;
    
    // Try to update with company field (should be ignored)
    const updateRes = await request(app)
      .patch(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ 
        name: "Updated Name",
        company: "FAKE COMPANY" // Should be ignored
      });
    
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.companyName).toBe("Dhaka Tech Solutions"); // Still from tenant
    expect(updateRes.body.companyName).not.toBe("FAKE COMPANY");
    expect(updateRes.body.company).toBeNull(); // company field should be null
  });
  
  it("returns companyName from tenant for getCustomerById", async () => {
    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    
    // Create customer
    const createRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test Customer", email: "test@test.com" });
    
    const customerId = createRes.body.id;
    
    // Get customer by ID
    const getRes = await request(app)
      .get(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${token}`);
    
    expect(getRes.status).toBe(200);
    expect(getRes.body.companyName).toBe("Dhaka Tech Solutions");
    expect(getRes.body.company).toBeNull();
  });
  
  it("searchCustomers returns companyName from tenant", async () => {
    // Login first
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;
    
    // Search customers
    const res = await request(app)
      .get("/api/customers/search?q=test")
      .set("Authorization", `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    
    // All results should have companyName from tenant
    res.body.forEach((c: any) => {
      expect(c.companyName).toBe("Dhaka Tech Solutions");
    });
  });
});

describe("Tenant Isolation - Company Names", () => {
  it("different tenants see different company names", async () => {
    // Create second tenant
    const tenant2 = await storage.createTenant({
      name: "Chittagong Tech Hub",
      contactEmail: "admin@chittagong.com",
      slug: "chittagong-tech",
    });
    
    // Create user for second tenant
    const user2 = await storage.createUser({
      email: "admin@chittagong.com",
      name: "Chittagong Admin",
      password: "test123",
      role: "tenant_admin",
      tenantId: tenant2.id,
    });
    
    // Login as tenant 1
    const login1 = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@dhakatech.com", password: "test123" });
    const token1 = login1.body.token;
    
    // Create customer in tenant 1
    const customer1 = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token1}`)
      .send({ name: "Tenant 1 Customer", email: "t1@test.com" });
    
    expect(customer1.body.companyName).toBe("Dhaka Tech Solutions");
    
    // Login as tenant 2
    const login2 = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@chittagong.com", password: "test123" });
    const token2 = login2.body.token;
    
    // Create customer in tenant 2
    const customer2 = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token2}`)
      .send({ name: "Tenant 2 Customer", email: "t2@test.com" });
    
    expect(customer2.body.companyName).toBe("Chittagong Tech Hub");
    
    // List customers for tenant 1
    const list1 = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${token1}`);
    
    list1.body.forEach((c: any) => {
      expect(c.companyName).toBe("Dhaka Tech Solutions");
    });
    
    // List customers for tenant 2
    const list2 = await request(app)
      .get("/api/customers")
      .set("Authorization", `Bearer ${token2}`);
    
    list2.body.forEach((c: any) => {
      expect(c.companyName).toBe("Chittagong Tech Hub");
    });
  });
});

