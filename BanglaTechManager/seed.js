#!/usr/bin/env node

/**
 * seed.js - Database seed script for Sohayota CRM
 * 
 * Creates initial tenants and admin user in the database.
 * 
 * Usage:
 *   export DATABASE_URL="postgres://user:pass@host:5432/dbname"
 *   export ADMIN_PASSWORD="your-secure-password"
 *   node seed.js
 * 
 * Or with environment variables:
 *   DATABASE_URL="..." ADMIN_PASSWORD="..." node seed.js
 */

import pg from 'pg';
import bcrypt from 'bcrypt';

const { Client } = pg;

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Usage: export DATABASE_URL="postgres://user:pass@host:5432/dbname" && node seed.js');
    process.exit(1);
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'demo123';
  
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Create tenants table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        contact_email VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Tenants table ready');

    // Create users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(36) REFERENCES tenants(id),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'support_agent',
        created_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Users table ready');

    // Insert tenants
    const tenants = [
      { name: 'Dhaka Tech Solutions', email: 'admin@dhakatech.com' },
      { name: 'Chittagong Software House', email: 'admin@chittagong.tech.com' },
      { name: 'Sylhet IT Services', email: 'admin@sylhet.software.com' },
      { name: 'Khulna Digital Systems', email: 'admin@khulna.it.com' },
    ];

    const tenantIds = [];
    for (const tenant of tenants) {
      const result = await client.query(
        `INSERT INTO tenants (name, contact_email) 
         VALUES ($1, $2)
         ON CONFLICT (contact_email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tenant.name, tenant.email]
      );
      tenantIds.push(result.rows[0].id);
      console.log(`✓ Tenant created/updated: ${tenant.name}`);
    }

    // Hash admin password
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Insert admin users for each tenant
    for (let i = 0; i < tenants.length; i++) {
      await client.query(
        `INSERT INTO users (tenant_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
        [
          tenantIds[i],
          'Admin User',
          tenants[i].email,
          passwordHash,
          'tenant_admin',
        ]
      );
      console.log(`✓ Admin user created: ${tenants[i].email}`);
    }

    // Create a super admin user (tenant_id = NULL)
    const superAdminEmail = 'superadmin@sohayota.com';
    await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [
        null,
        'Super Admin',
        superAdminEmail,
        passwordHash,
        'super_admin',
      ]
    );
    console.log(`✓ Super admin user created: ${superAdminEmail}`);

    console.log('\n✅ Seed completed successfully!\n');
    console.log('📋 Test Credentials:');
    console.log('─────────────────────────────────────');
    tenants.forEach((tenant, idx) => {
      console.log(`\nTenant ${idx + 1}: ${tenant.name}`);
      console.log(`  Email: ${tenant.email}`);
      console.log(`  Password: ${adminPassword}`);
      console.log(`  Role: tenant_admin`);
    });
    console.log(`\nSuper Admin:`);
    console.log(`  Email: ${superAdminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role: super_admin`);
    console.log('─────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
