/**
 * MCP Protocol Tests
 * Tests for Model Context Protocol endpoints
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

const API_BASE = 'http://localhost:5000';
let authToken: string;

describe('MCP Protocol Endpoints', () => {
  beforeAll(async () => {
    // Login to get JWT token
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@dhakatech.com',
        password: 'demo123',
      }),
    });
    const loginData = await loginResponse.json();
    authToken = loginData.token;
  });

  describe('GET /api/mcp/health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.protocol).toBe('mcp');
    });
  });

  describe('GET /api/mcp/tools', () => {
    it('should list all available tools', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.tools).toBeInstanceOf(Array);
      expect(data.tools.length).toBeGreaterThan(0);
      
      // Check for expected tools
      const toolNames = data.tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_customer');
      expect(toolNames).toContain('search_tickets');
      expect(toolNames).toContain('create_ticket');
      expect(toolNames).toContain('get_analytics');
    });

    it('should require authentication', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/mcp/tools/call', () => {
    it('should call get_analytics tool', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'get_analytics',
          arguments: { period: 'all' },
        }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.content).toBeInstanceOf(Array);
      expect(data.content[0].type).toBe('text');
      
      const analytics = JSON.parse(data.content[0].text);
      expect(analytics).toHaveProperty('customers');
      expect(analytics).toHaveProperty('tickets');
    });

    it('should call search_customers tool', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'search_customers',
          arguments: { query: 'rahim', limit: 5 },
        }),
      });
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.content).toBeInstanceOf(Array);
    });

    it('should return error for unknown tool', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'unknown_tool',
          arguments: {},
        }),
      });
      
      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await fetch(`${API_BASE}/api/mcp/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'get_analytics',
          arguments: {},
        }),
      });
      
      expect(response.status).toBe(401);
    });
  });
});

