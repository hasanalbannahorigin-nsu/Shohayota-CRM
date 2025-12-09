# 🔐 Login Credentials for Testing

## Role-Based Access Test Accounts

Use these credentials to test different roles and tenant isolation in the CRM system.

---

## 👑 Super Admin

**Role**: `super_admin`  
**Access**: Can view all tenants (when explicitly specified with `?tenantId=`)

| Email | Password | Description |
|-------|----------|-------------|
| `superadmin@sohayota.com` | `demo123` | Full system access, can manage all tenants |

**What you can test:**
- ✅ View all tenants' data (with `?tenantId=` parameter)
- ✅ Manage tenant settings
- ✅ Create/manage users across tenants
- ✅ View system-wide analytics

---

## 🏢 Tenant Admins

**Role**: `tenant_admin`  
**Access**: Can ONLY see and manage their own tenant's data

### Tenant 1: Dhaka Tech Solutions

| Email | Password | Tenant | Company Name |
|-------|----------|--------|--------------|
| `admin@dhakatech.com` | `demo123` | Dhaka Tech Solutions | "Dhaka Tech Solutions" |

**What you can test:**
- ✅ View ONLY Dhaka Tech customers
- ✅ All customers show `companyName = "Dhaka Tech Solutions"`
- ✅ Cannot see other tenants' data
- ✅ Cannot access other tenants' tickets/customers

### Tenant 2: Chittagong Tech Hub

| Email | Password | Tenant | Company Name |
|-------|----------|--------|--------------|
| `admin@chittagong.tech.com` | `demo123` | Chittagong Tech Hub | "Chittagong Tech Hub" |

**What you can test:**
- ✅ View ONLY Chittagong customers
- ✅ All customers show `companyName = "Chittagong Tech Hub"`
- ✅ Cannot see Dhaka Tech's data
- ✅ Tenant isolation works correctly

### Tenant 3: Sylhet Software House

| Email | Password | Tenant | Company Name |
|-------|----------|--------|--------------|
| `admin@sylhet.software.com` | `demo123` | Sylhet Software House | "Sylhet Software House" |

### Tenant 4: Khulna IT Systems

| Email | Password | Tenant | Company Name |
|-------|----------|--------|--------------|
| `admin@khulna.it.com` | `demo123` | Khulna IT Systems | "Khulna IT Systems" |

---

## 👨‍💼 Support Agents

**Role**: `support_agent`  
**Access**: Can manage customers and tickets, but cannot delete or manage users

### Dhaka Tech Support Agent

| Email | Password | Tenant | Role |
|-------|----------|--------|------|
| `support@dhaka.com` | `demo123` | Dhaka Tech Solutions | `support_agent` |

**What you can test:**
- ✅ Can view and manage Dhaka Tech customers
- ✅ Can create/update tickets
- ✅ Cannot delete customers
- ✅ Cannot manage users
- ✅ Limited to own tenant only

---

## 🧪 Testing Scenarios

### Test 1: Tenant Isolation
1. Login as `admin@dhakatech.com` / `demo123`
2. View customers - should only see Dhaka Tech customers
3. All customers should have `companyName = "Dhaka Tech Solutions"`
4. Try to access a Chittagong customer ID → Should get 404

### Test 2: Cross-Tenant Access Prevention
1. Login as `admin@dhakatech.com` / `demo123`
2. Note a customer ID from the list
3. Logout
4. Login as `admin@chittagong.tech.com` / `demo123`
5. Try to access the Dhaka Tech customer ID → Should get 404

### Test 3: Company Name Enforcement
1. Login as any tenant admin
2. View customers list
3. Verify all customers show the tenant's company name (not individual company field)
4. Create a new customer with `company: "FAKE COMPANY"` in request
5. Verify the created customer shows tenant's company name, not "FAKE COMPANY"

### Test 4: Super Admin Access
1. Login as `superadmin@sohayota.com` / `demo123`
2. View customers without `?tenantId=` → May need explicit tenant
3. View customers with `?tenantId=<dhaka-tenant-id>` → Should see Dhaka Tech customers
4. Switch tenants using `?tenantId=` parameter

### Test 5: Role-Based Permissions
1. Login as `support@dhaka.com` / `demo123` (Support Agent)
2. Try to delete a customer → Should be denied
3. Try to manage users → Should be denied
4. Can create/update tickets → Should work

---

## 📊 Quick Reference

### All Tenant Admins
- **Password**: `demo123` (all accounts)
- **Permissions**: Full access to own tenant only
- **Cannot**: Access other tenants, view system-wide data

### Support Agents
- **Password**: `demo123`
- **Permissions**: Manage customers/tickets in own tenant
- **Cannot**: Delete customers, manage users, access other tenants

### Super Admin
- **Password**: `demo123`
- **Permissions**: Full system access
- **Can**: View all tenants (with explicit `?tenantId=` parameter)

---

## 🔒 Security Features to Verify

1. **Tenant Isolation**
   - Each tenant admin sees ONLY their tenant's data
   - Cannot access other tenants' customers/tickets/messages

2. **Company Name Enforcement**
   - Company name comes from tenant name (not customer field)
   - All customers in a tenant show the same company name
   - Cannot spoof company name via API

3. **Role-Based Access**
   - Tenant admin: Full access to own tenant
   - Support agent: Limited access (no delete/manage users)
   - Super admin: Can view all tenants (when specified)

4. **Tenant ID Spoofing Prevention**
   - Cannot inject tenant_id in request body
   - All resources created in authenticated user's tenant

---

**Note**: All passwords are set to `demo123` for easy testing. Change these in production!

