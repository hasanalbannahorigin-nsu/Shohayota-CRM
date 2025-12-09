# Tenant Isolation Verification Guide

## Quick Verification Endpoints

After implementing strict tenant isolation, use these endpoints to verify everything is working correctly.

### 1. Basic Tenant Isolation Check

```bash
# Login as tenant admin first, then:
GET /api/verify/tenant-isolation
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "...",
    "email": "admin@dhakatech.com",
    "role": "tenant_admin",
    "tenantId": "tenant-a-id"
  },
  "requestTenantId": "tenant-a-id",
  "counts": {
    "customers": 50,
    "tickets": 25,
    "messages": 100,
    "users": 5
  },
  "isolation": {
    "status": "ok",
    "violations": {
      "customers": 0,
      "tickets": 0,
      "messages": 0,
      "users": 0
    }
  }
}
```

### 2. Cross-Tenant Access Prevention Test

```bash
GET /api/verify/cross-tenant-access
Authorization: Bearer <token>
```

This endpoint tests that you cannot access other tenants' data.

### 3. Tenant Spoofing Prevention Test

```bash
GET /api/verify/tenant-spoofing-prevention
Authorization: Bearer <token>
```

This endpoint verifies that client-supplied `tenantId` is ignored for non-super-admins.

### 4. Super Admin Cross-Tenant Access Test

```bash
# Login as super admin first
GET /api/verify/super-admin-access?tenantId=<tenant-id>
Authorization: Bearer <super-admin-token>
```

This endpoint tests that super admins can access other tenants with `?tenantId=` query param.

## Manual Test Checklist

### Test 1: Tenant Admin Isolation
1. Login as `admin@dhakatech.com` / `demo123`
2. Call `GET /api/tickets`
3. ✅ Verify all tickets have `tenantId = DhakaTech tenant ID`
4. ✅ Verify no tickets from other tenants appear

### Test 2: Cross-Tenant Access Prevention
1. Login as `admin@dhakatech.com`
2. Get a ticket ID from another tenant (e.g., ChittagongSoft)
3. Call `GET /api/tickets/<other-tenant-ticket-id>`
4. ✅ Should return 404 (not found)

### Test 3: Tenant Spoofing Prevention
1. Login as `admin@dhakatech.com`
2. Call `POST /api/customers` with body:
   ```json
   {
     "name": "Test",
     "email": "test@test.com",
     "tenantId": "<other-tenant-id>"
   }
   ```
3. ✅ Customer should be created in DhakaTech tenant (not other tenant)
4. ✅ Response should show `tenantId = DhakaTech tenant ID`

### Test 4: Super Admin Cross-Tenant Access
1. Login as `superadmin@sohayota.com` / `demo123`
2. Call `GET /api/tickets?tenantId=<dhaka-tech-tenant-id>`
3. ✅ Should return tickets from DhakaTech tenant
4. Call `GET /api/tickets?tenantId=<chittagong-tenant-id>`
5. ✅ Should return tickets from ChittagongSoft tenant

### Test 5: Messages Isolation
1. Login as `admin@dhakatech.com`
2. Get a ticket ID from your tenant
3. Call `GET /api/tickets/<ticket-id>/messages`
4. ✅ All messages should belong to your tenant
5. Try to get messages for a ticket from another tenant
6. ✅ Should return 404

### Test 6: Search Isolation
1. Login as `admin@dhakatech.com`
2. Call `GET /api/search?q=test`
3. ✅ All results should belong to your tenant
4. ✅ No results from other tenants

### Test 7: Analytics Isolation
1. Login as `admin@dhakatech.com`
2. Call `GET /api/analytics/stats`
3. ✅ All counts should reflect only your tenant's data
4. Login as `admin@chittagong.tech.com`
5. Call `GET /api/analytics/stats`
6. ✅ Should show different counts (ChittagongSoft data)

## Running Automated Tests

If you have Jest and Supertest installed:

```bash
npm test -- tenant-isolation
```

Or run the test file directly:

```bash
npx tsx tests/tenant-isolation.test.ts
```

## Expected Behavior Summary

| Action | Tenant Admin | Support Agent | Customer | Super Admin |
|--------|--------------|---------------|----------|-------------|
| View own tenant data | ✅ | ✅ | ✅ | ✅ |
| View other tenant data | ❌ (404) | ❌ (404) | ❌ (404) | ✅ (with ?tenantId=) |
| Create in own tenant | ✅ | ✅ | ❌ | ✅ |
| Create in other tenant | ❌ (ignored) | ❌ (ignored) | ❌ | ✅ (with tenantId in body) |
| Spoof tenantId in body | ❌ (ignored) | ❌ (ignored) | ❌ (ignored) | ✅ (allowed) |
| Use ?tenantId= query | ❌ (ignored) | ❌ (ignored) | ❌ (ignored) | ✅ (allowed) |

## Troubleshooting

### Issue: Getting data from other tenants
- ✅ Check that `enforceStrictTenantIsolation` middleware is applied
- ✅ Verify storage methods filter by `tenantId`
- ✅ Check that `getRequestTenantId()` is used in routes

### Issue: Can't create resources
- ✅ Verify `tenantId` is set from `req.user.tenantId` (not from body)
- ✅ Check that `preventTenantSpoofing` middleware is applied

### Issue: Super admin can't access other tenants
- ✅ Verify super admin provides `?tenantId=` query param
- ✅ Check that `getRequestTenantId()` handles super admin correctly

## Security Notes

1. **All tenant isolation is enforced server-side** - Frontend cannot bypass
2. **TenantId is stripped from request body** for non-super-admins
3. **Storage methods filter by tenantId** - Even if route logic fails, storage protects
4. **Defense in depth** - Multiple layers ensure isolation
5. **All violations are logged** - Check console for `[SECURITY]` messages

