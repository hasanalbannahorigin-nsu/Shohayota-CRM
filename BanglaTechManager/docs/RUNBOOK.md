# Multi-Tenant System Runbook

## Overview
This runbook provides operational procedures for managing the multi-tenant CRM system.

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Tenant Management](#tenant-management)
3. [Incident Response](#incident-response)
4. [Backup and Recovery](#backup-and-recovery)
5. [Monitoring and Alerts](#monitoring-and-alerts)
6. [Troubleshooting](#troubleshooting)

---

## Daily Operations

### Health Checks
```bash
# Check API health
curl http://localhost:5000/api/health

# Check database connectivity
# (if using PostgreSQL)
psql -h localhost -U postgres -d shohayota -c "SELECT 1"
```

### Verify Tenant Isolation
```bash
# Test as Tenant A
curl -H "Authorization: Bearer <tenant_a_token>" \
  http://localhost:5000/api/customers

# Test as Tenant B (should see different data)
curl -H "Authorization: Bearer <tenant_b_token>" \
  http://localhost:5000/api/customers
```

### Check System Metrics
```bash
# View all tenant metrics (super-admin only)
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/alerts
```

---

## Tenant Management

### Provision New Tenant

**Via API:**
```bash
curl -X POST http://localhost:5000/api/admin/tenants/provision \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Company",
    "contactEmail": "contact@newcompany.com",
    "adminName": "Admin User",
    "adminEmail": "admin@newcompany.com",
    "adminPassword": "secure_password",
    "plan": "pro"
  }'
```

**Via UI:**
1. Login as super-admin
2. Navigate to "Super Admin" page
3. Click "Provision New Tenant"
4. Fill in tenant details
5. Submit

### Suspend Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/suspend \
  -H "Authorization: Bearer <super_admin_token>"
```

**Reasons to suspend:**
- Payment failure
- Terms of service violation
- Security incident
- Requested by tenant

### Reactivate Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/reactivate \
  -H "Authorization: Bearer <super_admin_token>"
```

### Cancel Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/cancel \
  -H "Authorization: Bearer <super_admin_token>"
```

**Note:** Canceled tenants enter retention period before hard deletion.

### Delete Tenant

**Soft Delete (Recommended):**
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/delete \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"hardDelete": false}'
```

**Hard Delete (After Retention):**
```bash
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/delete \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"hardDelete": true, "force": true}'
```

**⚠️ WARNING:** Hard delete is permanent and irreversible!

---

## Incident Response

### Data Isolation Breach

**Symptoms:**
- Tenant reports seeing another tenant's data
- Audit logs show cross-tenant access
- Error logs indicate tenant ID mismatch

**Response:**
1. **Immediate:** Suspend affected tenants
2. **Investigate:** Check audit logs for unauthorized access
3. **Verify:** Test isolation with test accounts
4. **Fix:** Review and fix isolation middleware
5. **Notify:** Inform affected tenants
6. **Document:** Record incident in audit log

### Quota Exceeded

**Symptoms:**
- Tenant cannot create new resources
- Quota warnings in logs
- API returns 403 errors

**Response:**
1. **Verify:** Check actual usage vs. quota
2. **Options:**
   - Upgrade tenant plan
   - Increase quota temporarily
   - Request tenant to reduce usage
3. **Document:** Log quota adjustment in audit log

### Performance Degradation

**Symptoms:**
- Slow API responses
- Database connection timeouts
- High CPU/memory usage

**Response:**
1. **Monitor:** Check system metrics
2. **Identify:** Find resource-intensive tenants
3. **Mitigate:**
   - Add database indexes
   - Optimize queries
   - Scale resources
   - Rate limit specific tenants

---

## Backup and Recovery

### Export Tenant Data

**Via API:**
```bash
curl -X GET "http://localhost:5000/api/tenants/export?tenantId=<tenant_id>" \
  -H "Authorization: Bearer <super_admin_token>" \
  -o tenant-export.json
```

**Via UI:**
1. Login as super-admin or tenant admin
2. Navigate to tenant settings
3. Click "Export Data"
4. Download JSON file

### Restore Tenant Data

**Via API:**
```bash
curl -X POST http://localhost:5000/api/admin/tenants/restore \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d @tenant-export.json
```

### Automated Backups

**Recommended Schedule:**
- Full backup: Daily at 2 AM
- Incremental: Every 6 hours
- Retention: 30 days

**Implementation:**
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

---

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Per-Tenant:**
   - API call count
   - Active users
   - Customer count
   - Storage usage
   - Error rate

2. **System-Wide:**
   - Total tenants
   - Database connections
   - Response times
   - Error rates
   - Resource usage

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API Calls (monthly) | 80% of quota | 95% of quota |
| Storage Usage | 80% of quota | 95% of quota |
| Error Rate | > 1% | > 5% |
| Response Time | > 500ms | > 2000ms |

### View Alerts

```bash
# Get all alerts
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/alerts

# Get tenant-specific alerts
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/alerts
```

---

## Troubleshooting

### Tenant Cannot Access Data

**Check:**
1. Tenant status (should be "active")
2. User's tenant ID matches JWT
3. Database RLS policies are active
4. Audit logs for access attempts

**Fix:**
```bash
# Verify tenant status
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/tenants/<tenant_id>

# Reactivate if suspended
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/reactivate \
  -H "Authorization: Bearer <super_admin_token>"
```

### Quota Enforcement Not Working

**Check:**
1. Usage metrics are being tracked
2. Quota service is running
3. Middleware is enforcing quotas

**Fix:**
```bash
# Check usage metrics
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/quotas

# Manually reset if needed (super-admin only)
# (Implementation depends on your quota service)
```

### Database Connection Issues

**Check:**
1. Database is running
2. Connection pool settings
3. Network connectivity

**Fix:**
```bash
# Restart database connection pool
# (Implementation depends on your setup)

# Check database logs
tail -f /var/log/postgresql/postgresql.log
```

### Audit Logs Not Recording

**Check:**
1. Audit service is running
2. Database write permissions
3. Log storage capacity

**Fix:**
```bash
# Test audit logging
curl -X POST http://localhost:5000/api/test/audit \
  -H "Authorization: Bearer <token>"

# Check audit service logs
# (Location depends on your logging setup)
```

---

## Emergency Contacts

- **System Administrator:** [Your Contact]
- **Database Administrator:** [DB Admin Contact]
- **Security Team:** [Security Contact]
- **On-Call Engineer:** [On-Call Contact]

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-01 | Initial runbook | System |

---

## Appendix

### Useful Commands

```bash
# View all tenants
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/tenants

# View tenant usage
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/quotas

# View audit logs
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/audit-logs?tenantId=<tenant_id>"
```

### Database Queries

```sql
-- Check tenant status
SELECT id, name, status, plan FROM tenants WHERE id = '<tenant_id>';

-- Check usage metrics
SELECT * FROM tenant_usage_metrics WHERE tenant_id = '<tenant_id>';

-- View recent audit logs
SELECT * FROM audit_logs 
WHERE tenant_id = '<tenant_id>' 
ORDER BY created_at DESC 
LIMIT 100;
```

