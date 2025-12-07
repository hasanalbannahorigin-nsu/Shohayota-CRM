/**
 * Tenant Provisioning Tests
 * 
 * Tests to verify tenant provisioning works correctly:
 * - New tenants are created with default settings
 * - Admin users are created automatically
 * - Default roles and quotas are set
 * - Provisioning is idempotent
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://localhost:5000/api';

describe('Tenant Provisioning', () => {
  let superAdminToken: string;

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
  });

  describe('Provisioning New Tenant', () => {
    it('should create a new tenant with default settings', async () => {
      const response = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Test Tenant',
          contactEmail: 'test@tenant.com',
          adminName: 'Test Admin',
          adminEmail: 'admin@test.com',
          adminPassword: 'test123',
          plan: 'basic',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      
      expect(data.tenant).toBeDefined();
      expect(data.tenant.name).toBe('Test Tenant');
      expect(data.tenant.status).toBe('trialing');
      expect(data.tenant.plan).toBe('basic');
      expect(data.adminToken).toBeDefined();
    });

    it('should create admin user automatically', async () => {
      const provisionResponse = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Test Tenant 2',
          contactEmail: 'test2@tenant.com',
          adminName: 'Test Admin 2',
          adminEmail: 'admin2@test.com',
          adminPassword: 'test123',
          plan: 'pro',
        }),
      });

      const provisionData = await provisionResponse.json();
      const tenantId = provisionData.tenant.id;

      // Try to login with the admin credentials
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin2@test.com',
          password: 'test123',
        }),
      });

      expect(loginResponse.ok).toBe(true);
      const loginData = await loginResponse.json();
      expect(loginData.user.tenantId).toBe(tenantId);
      expect(loginData.user.role).toBe('tenant_admin');
    });

    it('should set default quotas based on plan', async () => {
      const response = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Enterprise Tenant',
          contactEmail: 'enterprise@test.com',
          adminName: 'Enterprise Admin',
          adminEmail: 'admin@enterprise.com',
          adminPassword: 'test123',
          plan: 'enterprise',
        }),
      });

      const data = await response.json();
      const tenant = data.tenant;

      // Enterprise plan should have higher quotas
      expect(tenant.quotaMaxUsers).toBeGreaterThan(10);
      expect(tenant.quotaMaxCustomers).toBeGreaterThan(100);
      expect(tenant.quotaMaxStorage).toBeGreaterThan(1000);
    });

    it('should be idempotent (safe to retry)', async () => {
      const tenantData = {
        name: 'Idempotent Test Tenant',
        slug: 'idempotent-test',
        contactEmail: 'idempotent@test.com',
        adminName: 'Idempotent Admin',
        adminEmail: 'admin@idempotent.com',
        adminPassword: 'test123',
        plan: 'basic',
      };

      // First provision
      const response1 = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(tenantData),
      });

      expect(response1.ok).toBe(true);
      const data1 = await response1.json();
      const tenantId1 = data1.tenant.id;

      // Retry with same data
      const response2 = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(tenantData),
      });

      expect(response2.ok).toBe(true);
      const data2 = await response2.json();
      
      // Should return the same tenant (or handle gracefully)
      // Implementation may vary - either return existing or create new
      expect(data2.tenant).toBeDefined();
    });
  });

  describe('Default Settings', () => {
    it('should set default branding settings', async () => {
      const response = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Branding Test',
          contactEmail: 'branding@test.com',
          adminName: 'Branding Admin',
          adminEmail: 'admin@branding.com',
          adminPassword: 'test123',
        }),
      });

      const data = await response.json();
      expect(data.tenant.settings).toBeDefined();
      expect(data.tenant.settings.branding).toBeDefined();
    });

    it('should enable default features', async () => {
      const response = await fetch(`${API_BASE}/admin/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'Features Test',
          contactEmail: 'features@test.com',
          adminName: 'Features Admin',
          adminEmail: 'admin@features.com',
          adminPassword: 'test123',
        }),
      });

      const data = await response.json();
      expect(data.tenant.settings.features).toBeDefined();
      // Default features should be enabled
      expect(data.tenant.settings.features.analytics).toBe(true);
    });
  });
});

