# Multi-Tenant Migration Guide

## Overview
This guide covers migrating tenants from shared database to dedicated databases/schemas.

## Table of Contents
1. [Migration Strategy](#migration-strategy)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Steps](#migration-steps)
4. [Post-Migration Verification](#post-migration-verification)
5. [Rollback Procedure](#rollback-procedure)

---

## Migration Strategy

### When to Migrate

Migrate a tenant to a dedicated database when:
- Tenant exceeds 100,000 records
- Tenant requires custom database configuration
- Tenant requests dedicated infrastructure
- Compliance requires data separation

### Migration Types

1. **Schema-per-Tenant:** Same database, separate schema
2. **Database-per-Tenant:** Completely separate database
3. **Hybrid:** Some tenants shared, some dedicated

---

## Pre-Migration Checklist

### 1. Backup Tenant Data
```bash
# Export tenant data
curl -X GET "http://localhost:5000/api/tenants/export?tenantId=<tenant_id>" \
  -H "Authorization: Bearer <super_admin_token>" \
  -o tenant-backup-$(date +%Y%m%d).json
```

### 2. Verify Data Integrity
- Check record counts
- Verify foreign key relationships
- Validate data consistency

### 3. Notify Tenant
- Inform tenant of migration schedule
- Set maintenance window
- Provide rollback plan

### 4. Prepare Target Database
```sql
-- Create new database
CREATE DATABASE tenant_<tenant_id>;

-- Create schema (if using schema-per-tenant)
CREATE SCHEMA tenant_<tenant_id>;
```

### 5. Test Migration Script
- Run on test/staging environment
- Verify all data migrated
- Test application connectivity

---

## Migration Steps

### Step 1: Suspend Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/suspend \
  -H "Authorization: Bearer <super_admin_token>"
```

**Why:** Prevents data changes during migration

### Step 2: Export Data
```bash
# Export complete tenant data
curl -X GET "http://localhost:5000/api/tenants/export?tenantId=<tenant_id>" \
  -H "Authorization: Bearer <super_admin_token>" \
  -o migration-export.json
```

### Step 3: Create Target Database/Schema
```sql
-- Option A: Database-per-tenant
CREATE DATABASE tenant_<tenant_id>
  WITH ENCODING 'UTF8'
  LC_COLLATE='en_US.UTF-8'
  LC_CTYPE='en_US.UTF-8';

-- Option B: Schema-per-tenant
CREATE SCHEMA tenant_<tenant_id>;
```

### Step 4: Run Database Migration
```bash
# Run schema migration on target database
drizzle-kit push --schema=./shared/schema.ts \
  --database-url="postgresql://user:pass@host/tenant_<tenant_id>"
```

### Step 5: Import Data
```bash
# Use restore API or direct database import
curl -X POST http://localhost:5000/api/admin/tenants/restore \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d @migration-export.json \
  --data-urlencode "targetDatabase=tenant_<tenant_id>"
```

### Step 6: Update Tenant Configuration
```bash
# Update tenant record with new database connection
curl -X PATCH http://localhost:5000/api/admin/tenants/<tenant_id> \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "database": {
        "type": "dedicated",
        "connectionString": "postgresql://user:pass@host/tenant_<tenant_id>"
      }
    }
  }'
```

### Step 7: Update Application Configuration
```typescript
// Update tenant routing logic
// server/tenant-router.ts
export function getTenantDatabase(tenantId: string): DatabaseConnection {
  const tenant = await getTenant(tenantId);
  
  if (tenant.settings?.database?.type === 'dedicated') {
    return new DatabaseConnection(tenant.settings.database.connectionString);
  }
  
  return getSharedDatabase();
}
```

### Step 8: Verify Migration
- Check record counts match
- Test API endpoints
- Verify data relationships
- Test user authentication

### Step 9: Reactivate Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/reactivate \
  -H "Authorization: Bearer <super_admin_token>"
```

### Step 10: Monitor
- Watch error logs
- Monitor performance
- Check user reports
- Verify quota tracking

---

## Post-Migration Verification

### Data Verification
```sql
-- Compare record counts
SELECT 
  'shared' as source,
  COUNT(*) as customers
FROM customers 
WHERE tenant_id = '<tenant_id>'

UNION ALL

SELECT 
  'dedicated' as source,
  COUNT(*) as customers
FROM tenant_<tenant_id>.customers;
```

### Application Verification
```bash
# Test API endpoints
curl -H "Authorization: Bearer <tenant_token>" \
  http://localhost:5000/api/customers

# Verify response times
curl -w "@curl-format.txt" \
  -H "Authorization: Bearer <tenant_token>" \
  http://localhost:5000/api/customers
```

### User Acceptance Testing
- Have tenant admin test all features
- Verify data appears correctly
- Check performance improvements
- Confirm no data loss

---

## Rollback Procedure

### If Migration Fails

1. **Immediate:** Keep tenant suspended
2. **Restore:** Use backup to restore to shared database
3. **Verify:** Confirm all data restored
4. **Reactivate:** Reactivate tenant on shared database
5. **Investigate:** Identify and fix migration issues
6. **Retry:** Attempt migration again after fixes

### Rollback Steps

```bash
# 1. Suspend tenant (if not already)
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/suspend \
  -H "Authorization: Bearer <super_admin_token>"

# 2. Restore from backup
curl -X POST http://localhost:5000/api/admin/tenants/restore \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d @tenant-backup-YYYYMMDD.json

# 3. Revert tenant configuration
curl -X PATCH http://localhost:5000/api/admin/tenants/<tenant_id> \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "database": {
        "type": "shared"
      }
    }
  }'

# 4. Reactivate tenant
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/reactivate \
  -H "Authorization: Bearer <super_admin_token>"
```

---

## Automated Migration Script

```typescript
// scripts/migrate-tenant.ts
import { migrateTenant } from './migration-service';

async function main() {
  const tenantId = process.argv[2];
  
  if (!tenantId) {
    console.error('Usage: ts-node migrate-tenant.ts <tenant_id>');
    process.exit(1);
  }
  
  try {
    console.log(`Starting migration for tenant ${tenantId}...`);
    
    // 1. Suspend
    await suspendTenant(tenantId);
    
    // 2. Export
    const exportData = await exportTenantData(tenantId);
    
    // 3. Create target database
    await createDedicatedDatabase(tenantId);
    
    // 4. Import
    await importTenantData(tenantId, exportData);
    
    // 5. Update configuration
    await updateTenantConfig(tenantId, {
      database: { type: 'dedicated' }
    });
    
    // 6. Verify
    await verifyMigration(tenantId);
    
    // 7. Reactivate
    await reactivateTenant(tenantId);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('Initiating rollback...');
    await rollbackMigration(tenantId);
    process.exit(1);
  }
}

main();
```

---

## Best Practices

1. **Always backup before migration**
2. **Test on staging first**
3. **Schedule during low-traffic periods**
4. **Have rollback plan ready**
5. **Monitor closely after migration**
6. **Document all steps**
7. **Notify stakeholders**

---

## Troubleshooting

### Migration Takes Too Long
- **Cause:** Large dataset
- **Solution:** Use batch processing, increase timeout

### Data Mismatch
- **Cause:** Concurrent writes during export
- **Solution:** Ensure tenant is suspended before export

### Connection Issues
- **Cause:** Network or firewall
- **Solution:** Verify connectivity, check firewall rules

### Foreign Key Violations
- **Cause:** Missing related records
- **Solution:** Export/import in correct order (tenants → users → customers → tickets)

---

## Support

For migration assistance, contact:
- **Database Team:** [Contact]
- **DevOps Team:** [Contact]
- **On-Call Engineer:** [Contact]

