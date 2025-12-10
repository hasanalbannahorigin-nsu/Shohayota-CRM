#!/usr/bin/env node

/**
 * Test Token Generator
 * Generates HS256 JWT tokens for development/testing
 * 
 * Usage:
 *   node scripts/generate-test-token.js <tenantId> <role1,role2,...>
 * 
 * Example:
 *   node scripts/generate-test-token.js "" "platform_admin"
 *   node scripts/generate-test-token.js "tenant-123" "tenant_admin"
 */

import jwt from 'jsonwebtoken';

const tenantId = process.argv[2] || '';
const rolesStr = process.argv[3] || 'platform_admin';
const roles = rolesStr.split(',').map(r => r.trim());

const JWT_SECRET = process.env.TEST_JWT_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-secret-change-me';

const payload = {
  id: 'test-admin-1',
  email: 'admin@test.com',
  name: 'Test Admin',
  tenant_id: tenantId || undefined,
  tenantId: tenantId || undefined,
  roles: roles,
  role: roles[0] || 'platform_admin', // For backward compatibility
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
};

const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

console.log('\n🔑 Generated Test Token:\n');
console.log(token);
console.log('\n📋 Token Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n💡 To use in browser:');
console.log(`localStorage.setItem('auth_token', '${token}');`);
console.log('\n');

