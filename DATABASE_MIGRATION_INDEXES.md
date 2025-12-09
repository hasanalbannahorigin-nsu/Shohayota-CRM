# Database Migration & Indexes for Tenant Isolation

## Overview

This document describes the recommended database indexes and migration steps for optimal performance of tenant isolation queries.

---

## 📊 Required Indexes

### Performance Indexes

All tenant-scoped tables should have indexes on `tenant_id` columns for fast filtering:

```sql
-- Customers table
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id 
ON customers (tenant_id);

-- Tickets table
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id 
ON tickets (tenant_id);

-- Messages table
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id 
ON messages (tenant_id);

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
ON users (tenant_id);

-- Files table
CREATE INDEX IF NOT EXISTS idx_files_tenant_id 
ON files (tenant_id);

-- Integration Credentials table
CREATE INDEX IF NOT EXISTS idx_integration_credentials_tenant_id 
ON integration_credentials (tenant_id);

-- Audit Logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id 
ON audit_logs (tenant_id);

-- Usage Metrics table
CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant_id 
ON tenant_usage_metrics (tenant_id);
```

### Composite Indexes (Optional but Recommended)

For common query patterns:

```sql
-- Tickets by tenant and status
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status 
ON tickets (tenant_id, status);

-- Customers by tenant and status
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status 
ON customers (tenant_id, status);

-- Messages by ticket and tenant
CREATE INDEX IF NOT EXISTS idx_messages_ticket_tenant 
ON messages (ticket_id, tenant_id);
```

---

## 🔧 Migration Steps

### Option 1: Using Drizzle ORM

If using Drizzle, indexes can be defined in schema:

```typescript
// shared/schema.ts
export const customers = pgTable("customers", {
  // ... columns
  tenantId: varchar("tenant_id", { length: 36 })
    .references(() => tenants.id)
    .notNull(),
}, (table) => ({
  tenantIdx: index("idx_customers_tenant_id").on(table.tenantId),
}));
```

Then run:
```bash
npm run db:push
```

### Option 2: Manual SQL Migration

Create a migration file:

```sql
-- migrations/XXXX_add_tenant_indexes.sql

-- Add indexes for tenant isolation performance
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_tenant_id ON files (tenant_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON tickets (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status ON customers (tenant_id, status);
```

Run migration:
```bash
psql -U postgres -d your_database -f migrations/XXXX_add_tenant_indexes.sql
```

### Option 3: Using Migration Tool

If using a migration tool like `node-pg-migrate`:

```bash
npm install -g node-pg-migrate
node-pg-migrate create add-tenant-indexes
```

Then add the index creation SQL to the generated migration file.

---

## ✅ Verification

After creating indexes, verify they exist:

```sql
-- PostgreSQL
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%tenant%'
ORDER BY tablename, indexname;
```

Or check index usage:

```sql
-- Check if indexes are being used
EXPLAIN ANALYZE
SELECT * FROM customers WHERE tenant_id = 'some-tenant-id';
```

---

## 📊 Performance Impact

### Before Indexes
- Full table scans on every tenant query
- Slow queries as data grows
- High database load

### After Indexes
- Fast indexed lookups
- O(log n) complexity
- Reduced database load
- Better scalability

---

## 🔍 Monitoring

Monitor index usage and performance:

```sql
-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname LIKE '%tenant%';
```

---

## 📝 Notes

1. **Index Creation**: Indexes can be created safely on existing tables without downtime
2. **Index Size**: Indexes take additional storage space
3. **Write Performance**: Indexes slightly slow down INSERT/UPDATE operations but dramatically speed up SELECT queries
4. **Maintenance**: PostgreSQL automatically maintains indexes

---

## ✅ Checklist

- [ ] Create index on `customers.tenant_id`
- [ ] Create index on `tickets.tenant_id`
- [ ] Create index on `messages.tenant_id`
- [ ] Create index on `users.tenant_id`
- [ ] Create index on `files.tenant_id`
- [ ] (Optional) Create composite indexes
- [ ] Verify indexes exist
- [ ] Monitor index usage
- [ ] Test query performance

---

**Date**: 2025-01-07  
**Status**: Ready for Implementation

