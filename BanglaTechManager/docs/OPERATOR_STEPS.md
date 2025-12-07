# Operator Steps - Multi-Tenant System

Quick reference guide for common operator tasks.

## Quick Links
- [Tenant Operations](#tenant-operations)
- [User Management](#user-management)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Tenant Operations

### List All Tenants
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/tenants
```

### Get Tenant Details
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/tenants/<tenant_id>
```

### Create New Tenant
```bash
curl -X POST http://localhost:5000/api/admin/tenants/provision \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Company Name",
    "contactEmail": "contact@company.com",
    "adminName": "Admin Name",
    "adminEmail": "admin@company.com",
    "adminPassword": "secure_password",
    "plan": "basic"
  }'
```

### Change Tenant Status
```bash
# Suspend
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/suspend \
  -H "Authorization: Bearer <super_admin_token>"

# Reactivate
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/reactivate \
  -H "Authorization: Bearer <super_admin_token>"

# Cancel
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/cancel \
  -H "Authorization: Bearer <super_admin_token>"
```

### Export Tenant Data
```bash
curl -X GET "http://localhost:5000/api/tenants/export?tenantId=<tenant_id>" \
  -H "Authorization: Bearer <super_admin_token>" \
  -o tenant-export.json
```

### Delete Tenant
```bash
# Soft delete
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/delete \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"hardDelete": false}'

# Hard delete (⚠️ Permanent!)
curl -X POST http://localhost:5000/api/admin/tenants/<tenant_id>/delete \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"hardDelete": true, "force": true}'
```

---

## User Management

### List Tenant Users
```bash
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/users
```

### Create User
```bash
curl -X POST http://localhost:5000/api/tenants/users \
  -H "Authorization: Bearer <tenant_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Name",
    "email": "user@company.com",
    "password": "password123",
    "role": "support_agent"
  }'
```

### Reset User Password
```bash
# (Implementation depends on your password reset flow)
curl -X POST http://localhost:5000/api/tenants/users/<user_id>/reset-password \
  -H "Authorization: Bearer <tenant_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "new_password"}'
```

---

## Monitoring

### Check System Health
```bash
curl http://localhost:5000/api/health
```

### View Tenant Quotas
```bash
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/quotas
```

### View All Alerts
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/alerts
```

### View Tenant Metrics
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  "http://localhost:5000/api/admin/metrics?tenantId=<tenant_id>"
```

### View Audit Logs
```bash
# All logs
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/audit-logs

# Tenant-specific
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/audit-logs?tenantId=<tenant_id>"

# Filtered
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/audit-logs?tenantId=<tenant_id>&action=create&resourceType=customer"
```

---

## Troubleshooting

### Tenant Cannot Login
1. Check tenant status:
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  http://localhost:5000/api/admin/tenants/<tenant_id>
```

2. Verify user exists:
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  "http://localhost:5000/api/admin/tenants/<tenant_id>/users"
```

3. Check audit logs:
```bash
curl -H "Authorization: Bearer <super_admin_token>" \
  "http://localhost:5000/api/audit-logs?tenantId=<tenant_id>&action=login"
```

### Data Isolation Issue
1. Test isolation:
```bash
# As Tenant A
curl -H "Authorization: Bearer <tenant_a_token>" \
  http://localhost:5000/api/customers

# As Tenant B (should see different data)
curl -H "Authorization: Bearer <tenant_b_token>" \
  http://localhost:5000/api/customers
```

2. Check middleware logs
3. Verify JWT contains correct tenant ID
4. Check database RLS policies

### Quota Exceeded
1. Check current usage:
```bash
curl -H "Authorization: Bearer <tenant_admin_token>" \
  http://localhost:5000/api/tenants/quotas
```

2. Options:
   - Upgrade plan
   - Increase quota (super-admin only)
   - Request tenant to reduce usage

### Performance Issues
1. Check system metrics
2. Identify resource-intensive tenants
3. Review database queries
4. Check for missing indexes

---

## Common Tasks Checklist

### Daily
- [ ] Check system health
- [ ] Review error logs
- [ ] Monitor quota usage
- [ ] Check for alerts

### Weekly
- [ ] Review tenant statuses
- [ ] Check backup status
- [ ] Review audit logs
- [ ] Update documentation

### Monthly
- [ ] Review tenant growth
- [ ] Analyze usage patterns
- [ ] Plan capacity upgrades
- [ ] Review security logs

---

## Emergency Procedures

### System Down
1. Check server status
2. Check database connectivity
3. Review error logs
4. Restart services if needed
5. Notify stakeholders

### Data Breach Suspected
1. **IMMEDIATE:** Suspend affected tenants
2. Preserve audit logs
3. Notify security team
4. Investigate scope
5. Document incident

### Data Loss
1. Stop all operations
2. Identify affected tenants
3. Restore from backup
4. Verify data integrity
5. Resume operations

---

## Useful Scripts

### Backup All Tenants
```bash
#!/bin/bash
# backup-all-tenants.sh

TOKEN="<super_admin_token>"
BACKUP_DIR="./backups/$(date +%Y%m%d)"

mkdir -p "$BACKUP_DIR"

# Get all tenants
TENANTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/tenants | jq -r '.[].id')

for tenant_id in $TENANTS; do
  echo "Backing up tenant $tenant_id..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    "http://localhost:5000/api/tenants/export?tenantId=$tenant_id" \
    -o "$BACKUP_DIR/tenant-$tenant_id.json"
done

echo "Backup complete: $BACKUP_DIR"
```

### Check All Tenant Statuses
```bash
#!/bin/bash
# check-tenant-statuses.sh

TOKEN="<super_admin_token>"

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/admin/tenants | \
  jq -r '.[] | "\(.name) - \(.status) - \(.plan)"'
```

---

## Contact Information

- **On-Call:** [Phone/Email]
- **Escalation:** [Manager Contact]
- **Emergency:** [Emergency Contact]

---

## Change Log

| Date | Change | Operator |
|------|--------|----------|
| 2025-12-01 | Initial operator guide | System |

