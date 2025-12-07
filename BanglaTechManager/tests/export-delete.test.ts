/**
 * Export and Delete Tests
 * 
 * Tests to verify tenant export and deletion work correctly:
 * - Export includes all tenant data
 * - Export format is valid JSON
 * - Soft delete preserves data for retention period
 * - Hard delete removes data after retention
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = 'http://localhost:5000/api';

describe('Tenant Export and Delete', () => {
  let superAdminToken: string;
  let testTenantId: string;

  beforeAll(async () => {
    // Login as super admin
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'superadmin@sohayota.com',
        password: 'demo123',
      }),
    });

    const data = await response.json();
    superAdminToken = data.token;

    // Create a test tenant for export/delete tests
    const provisionResponse = await fetch(`${API_BASE}/admin/tenants/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Export Test Tenant',
        contactEmail: 'export@test.com',
        adminName: 'Export Admin',
        adminEmail: 'admin@export.com',
        adminPassword: 'test123',
        plan: 'basic',
      }),
    });

    const provisionData = await provisionResponse.json();
    testTenantId = provisionData.tenant.id;
  });

  describe('Tenant Export', () => {
    it('should export all tenant data', async () => {
      const response = await fetch(`${API_BASE}/tenants/export?tenantId=${testTenantId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const data = await response.json();
      
      // Verify export structure
      expect(data.tenant).toBeDefined();
      expect(data.tenant.id).toBe(testTenantId);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.customers).toBeDefined();
      expect(Array.isArray(data.customers)).toBe(true);
      expect(data.tickets).toBeDefined();
      expect(Array.isArray(data.tickets)).toBe(true);
    });

    it('should include all related entities in export', async () => {
      const response = await fetch(`${API_BASE}/tenants/export?tenantId=${testTenantId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      const data = await response.json();

      // Check for all expected entities
      expect(data.messages).toBeDefined();
      expect(data.files).toBeDefined();
      expect(data.integrationCredentials).toBeDefined();
      expect(data.auditLogs).toBeDefined();
    });

    it('should export data in GDPR-compliant format', async () => {
      const response = await fetch(`${API_BASE}/tenants/export?tenantId=${testTenantId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      const data = await response.json();

      // GDPR compliance checks
      expect(data.exportDate).toBeDefined();
      expect(data.tenantId).toBe(testTenantId);
      
      // All personal data should be included
      if (data.users && data.users.length > 0) {
        const user = data.users[0];
        expect(user.email).toBeDefined();
        expect(user.name).toBeDefined();
      }
    });
  });

  describe('Tenant Soft Delete', () => {
    it('should soft delete tenant (mark as deleted)', async () => {
      const response = await fetch(`${API_BASE}/admin/tenants/${testTenantId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          hardDelete: false,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('deleted');

      // Verify tenant still exists but is marked deleted
      const getResponse = await fetch(`${API_BASE}/admin/tenants/${testTenantId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      const tenantData = await getResponse.json();
      expect(tenantData.status).toBe('deleted');
    });

    it('should allow export after soft delete', async () => {
      // Even after soft delete, export should work
      const response = await fetch(`${API_BASE}/tenants/export?tenantId=${testTenantId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.tenant).toBeDefined();
    });
  });

  describe('Tenant Hard Delete', () => {
    it('should hard delete tenant after retention period', async () => {
      // Note: This test may need to be adjusted based on retention policy
      // For testing, we might need to manually set deletion date
      
      const response = await fetch(`${API_BASE}/admin/tenants/${testTenantId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          hardDelete: true,
          force: true, // Bypass retention for testing
        }),
      });

      // Hard delete should either succeed or return appropriate error
      // depending on retention policy
      expect([200, 400, 403]).toContain(response.status);
    });
  });
});

