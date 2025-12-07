/**
 * Connector Integration Tests
 * Tests for webhook ingestion, OAuth flows, and integration management
 */

import request from "supertest";
import { Express } from "express";
import { db } from "../db";
import { tenants, integrations, users } from "@shared/schema";
import { sql } from "drizzle-orm";

// Mock app - adjust import based on your setup
let app: Express;

// Test data
const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";
const TEST_INTEGRATION_ID = "22222222-2222-2222-2222-222222222222";

describe("Connectors - Integration Tests", () => {
  beforeAll(async () => {
    // Set up test tenant
    await db.execute(sql`
      INSERT INTO tenants (id, name, slug, contact_email, status, plan, created_at)
      VALUES (${TEST_TENANT_ID}, 'Test Tenant', 'test-tenant', 'test@example.com', 'active', 'basic', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Set up test user
    await db.execute(sql`
      INSERT INTO users (id, tenant_id, email, name, role, is_active, created_at)
      VALUES (${TEST_USER_ID}, ${TEST_TENANT_ID}, 'test@example.com', 'Test User', 'tenant_admin', true, NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Set up test integration
    await db.execute(sql`
      INSERT INTO integrations (
        id, tenant_id, connector_id, display_name, 
        encrypted_credentials_ref, config, status, created_by, created_at
      )
      VALUES (
        ${TEST_INTEGRATION_ID},
        ${TEST_TENANT_ID},
        'gmail',
        'Test Gmail Integration',
        'test_cred_ref',
        jsonb_build_object('webhook_secret', 's3cr3t'),
        'connected',
        ${TEST_USER_ID},
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterAll(async () => {
    // Clean up test data
    await db.execute(sql`DELETE FROM integrations WHERE id = ${TEST_INTEGRATION_ID}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${TEST_USER_ID}`);
    await db.execute(sql`DELETE FROM tenants WHERE id = ${TEST_TENANT_ID}`);
  });

  describe("Webhook Ingestion", () => {
    it("should accept webhook and store event", async () => {
      const response = await request(app)
        .post("/api/webhooks/gmail/s3cr3t")
        .send({
          messageId: "test-message-123",
          label: "INBOX",
          snippet: "Test email",
        })
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.delivered).toBeGreaterThanOrEqual(1);
    });

    it("should reject webhook with unknown secret", async () => {
      await request(app)
        .post("/api/webhooks/gmail/unknown-secret")
        .send({})
        .expect(404);
    });

    it("should deduplicate duplicate webhook events", async () => {
      const payload = {
        messageId: "duplicate-test-123",
        label: "INBOX",
      };

      // First request
      const firstResponse = await request(app)
        .post("/api/webhooks/gmail/s3cr3t")
        .send(payload)
        .expect(200);

      expect(firstResponse.body.ok).toBe(true);

      // Duplicate request
      const secondResponse = await request(app)
        .post("/api/webhooks/gmail/s3cr3t")
        .send(payload)
        .expect(200);

      expect(secondResponse.body.duplicate).toBe(true);
      expect(secondResponse.body.delivered).toBe(0);
    });
  });

  describe("OAuth Flow", () => {
    it("should redirect to OAuth provider", async () => {
      // This test requires authentication
      // Mock authentication middleware or use test token
      const response = await request(app)
        .get("/api/oauth/start/gmail")
        .set("Authorization", "Bearer test-token")
        .expect(302); // Redirect

      expect(response.headers.location).toContain("accounts.google.com");
      expect(response.headers.location).toContain("client_id");
    });

    it("should reject OAuth for non-OAuth connector", async () => {
      await request(app)
        .get("/api/oauth/start/telegram")
        .set("Authorization", "Bearer test-token")
        .expect(400);
    });
  });

  describe("Integration Management", () => {
    it("should list tenant integrations", async () => {
      const response = await request(app)
        .get("/api/integrations")
        .set("Authorization", "Bearer test-token")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should get integration details", async () => {
      const response = await request(app)
        .get(`/api/integrations/${TEST_INTEGRATION_ID}`)
        .set("Authorization", "Bearer test-token")
        .expect(200);

      expect(response.body.id).toBe(TEST_INTEGRATION_ID);
      expect(response.body.connector_id).toBe("gmail");
    });

    it("should test integration connection", async () => {
      const response = await request(app)
        .post(`/api/integrations/${TEST_INTEGRATION_ID}/test`)
        .set("Authorization", "Bearer test-token")
        .expect(200);

      expect(response.body).toHaveProperty("ok");
    });
  });
});

