/**
 * Quota Enforcement Tests
 * 
 * Tests to verify quota enforcement works correctly:
 * - API calls are tracked per tenant
 * - Quotas are enforced before resource creation
 * - Soft warnings are issued when approaching limits
 * - Hard blocks are enforced when limits are exceeded
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = 'http://localhost:5000/api';

describe('Quota Enforcement', () => {
  let tenantAdminToken: string;
  let tenantId: string;

  beforeAll(async () => {
    // Login as a tenant admin
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@dhakatech.com',
        password: 'demo123',
      }),
    });

    const data = await response.json();
    tenantAdminToken = data.token;
    tenantId = data.user.tenantId;
  });

  describe('API Call Tracking', () => {
    it('should track API calls per tenant', async () => {
      // Make several API calls
      for (let i = 0; i < 5; i++) {
        await fetch(`${API_BASE}/customers`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tenantAdminToken}`,
          },
        });
      }

      // Check usage metrics
      const response = await fetch(`${API_BASE}/tenants/quotas`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tenantAdminToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.usage.apiCalls).toBeGreaterThanOrEqual(5);
    });
  });

  describe('User Quota Enforcement', () => {
    it('should allow creating users within quota limit', async () => {
      // First, check current quota status
      const quotaResponse = await fetch(`${API_BASE}/tenants/quotas`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tenantAdminToken}`,
        },
      });

      const quotaData = await quotaResponse.json();
      const currentUsers = quotaData.usage.users;
      const maxUsers = quotaData.quota.maxUsers;

      if (currentUsers < maxUsers) {
        // Should be able to create a user
        const response = await fetch(`${API_BASE}/tenants/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantAdminToken}`,
          },
          body: JSON.stringify({
            name: 'Test User',
            email: `testuser${Date.now()}@test.com`,
            password: 'test123',
            role: 'support_agent',
          }),
        });

        expect(response.ok).toBe(true);
      } else {
        // At quota limit - should fail
        const response = await fetch(`${API_BASE}/tenants/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantAdminToken}`,
          },
          body: JSON.stringify({
            name: 'Test User',
            email: `testuser${Date.now()}@test.com`,
            password: 'test123',
            role: 'support_agent',
          }),
        });

        expect(response.status).toBe(403);
        const error = await response.json();
        expect(error.error).toContain('quota');
      }
    });
  });

  describe('Customer Quota Enforcement', () => {
    it('should allow creating customers within quota limit', async () => {
      const quotaResponse = await fetch(`${API_BASE}/tenants/quotas`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tenantAdminToken}`,
        },
      });

      const quotaData = await quotaResponse.json();
      const currentCustomers = quotaData.usage.customers;
      const maxCustomers = quotaData.quota.maxCustomers;

      if (currentCustomers < maxCustomers) {
        const response = await fetch(`${API_BASE}/customers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantAdminToken}`,
          },
          body: JSON.stringify({
            name: 'Test Customer',
            email: `testcustomer${Date.now()}@test.com`,
            phone: '+880-1711-123456',
          }),
        });

        expect(response.ok).toBe(true);
      }
    });
  });

  describe('Quota Warnings', () => {
    it('should issue warnings when approaching quota limits', async () => {
      const response = await fetch(`${API_BASE}/tenants/quotas`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tenantAdminToken}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      // Check if warnings are present when approaching limits
      if (data.usage.users / data.quota.maxUsers > 0.8) {
        expect(data.warnings).toBeDefined();
        expect(data.warnings.length).toBeGreaterThan(0);
      }
    });
  });
});

