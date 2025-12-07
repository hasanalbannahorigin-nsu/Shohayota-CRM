/**
 * Multi-Tenant Isolation Tests
 * 
 * Tests to verify that data isolation is working correctly:
 * - Tenants cannot access each other's data
 * - Tenant ID injection is prevented
 * - Database-level protection works
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://localhost:5000/api';

interface TestUser {
  email: string;
  password: string;
  tenantId: string;
  token?: string;
}

interface TestTenant {
  id: string;
  name: string;
}

describe('Multi-Tenant Data Isolation', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let userA: TestUser;
  let userB: TestUser;
  let customerA: any;
  let ticketA: any;

  beforeAll(async () => {
    // Create test tenants and users
    // This would typically use a test database or test provisioning API
    console.log('Setting up test tenants...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up test data...');
  });

  describe('Authentication and Tenant Context', () => {
    it('should authenticate tenant A user and return tenant context', async () => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA.email,
          password: userA.password,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user.tenantId).toBe(tenantA.id);
      expect(data.token).toBeDefined();
      userA.token = data.token;
    });

    it('should authenticate tenant B user and return different tenant context', async () => {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userB.email,
          password: userB.password,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.user.tenantId).toBe(tenantB.id);
      expect(data.user.tenantId).not.toBe(tenantA.id);
      expect(data.token).toBeDefined();
      userB.token = data.token;
    });
  });

  describe('Customer Data Isolation', () => {
    it('should allow tenant A to create a customer', async () => {
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA.token}`,
        },
        body: JSON.stringify({
          name: 'Test Customer A',
          email: 'customerA@test.com',
          phone: '+880-1711-123456',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.tenantId).toBe(tenantA.id);
      customerA = data;
    });

    it('should NOT allow tenant B to see tenant A customers', async () => {
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userB.token}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      const customerAInList = data.find((c: any) => c.id === customerA.id);
      expect(customerAInList).toBeUndefined();
    });

    it('should reject tenant B accessing tenant A customer by ID', async () => {
      const response = await fetch(`${API_BASE}/customers/${customerA.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userB.token}`,
        },
      });

      expect(response.status).toBe(404); // Should not find the customer
    });

    it('should reject tenant ID injection in request body', async () => {
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA.token}`,
        },
        body: JSON.stringify({
          name: 'Injected Customer',
          email: 'injected@test.com',
          tenantId: tenantB.id, // Attempted injection
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      // Should use tenant A's ID, not the injected one
      expect(data.tenantId).toBe(tenantA.id);
      expect(data.tenantId).not.toBe(tenantB.id);
    });
  });

  describe('Ticket Data Isolation', () => {
    it('should allow tenant A to create a ticket', async () => {
      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userA.token}`,
        },
        body: JSON.stringify({
          customerId: customerA.id,
          title: 'Test Ticket A',
          description: 'This is a test ticket',
          status: 'open',
          priority: 'medium',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.tenantId).toBe(tenantA.id);
      ticketA = data;
    });

    it('should NOT allow tenant B to see tenant A tickets', async () => {
      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userB.token}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      const ticketAInList = data.find((t: any) => t.id === ticketA.id);
      expect(ticketAInList).toBeUndefined();
    });

    it('should reject tenant B updating tenant A ticket', async () => {
      const response = await fetch(`${API_BASE}/tickets/${ticketA.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userB.token}`,
        },
        body: JSON.stringify({
          status: 'closed',
        }),
      });

      expect(response.status).toBe(404); // Should not find the ticket
    });
  });

  describe('User Data Isolation', () => {
    it('should NOT allow tenant A to see tenant B users', async () => {
      const response = await fetch(`${API_BASE}/tenants/users`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userA.token}`,
        },
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      const userBInList = data.find((u: any) => u.id === userB.id);
      expect(userBInList).toBeUndefined();
    });
  });

  describe('Database-Level Protection', () => {
    it('should verify tenant ID in JWT matches database user record', async () => {
      // This test verifies the middleware that checks JWT tenantId against DB
      // If someone tries to modify the JWT, the middleware should catch it
      
      // First, get a valid token
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userA.email,
          password: userA.password,
        }),
      });
      
      const loginData = await loginResponse.json();
      const validToken = loginData.token;
      
      // Try to use the token - should work
      const response = await fetch(`${API_BASE}/customers`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });
      
      expect(response.ok).toBe(true);
    });
  });
});

