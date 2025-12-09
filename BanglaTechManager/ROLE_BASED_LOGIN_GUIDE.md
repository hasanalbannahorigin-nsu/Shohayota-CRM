# 🔐 Role-Based Login Testing Guide

This guide helps you test all role-based logins in the Shohayota CRM system.

## 🚀 Quick Start

### Option 1: Interactive HTML Page (Recommended)

1. **Start the server:**
   ```bash
   cd BanglaTechManager
   npm run dev
   ```

2. **Open the test page:**
   - Open `test-all-roles.html` in your browser
   - Or navigate to: `http://localhost:5000/test-all-roles.html` (if served)
   - Click any "Login" button to test that role

### Option 2: Programmatic Testing

Run the automated test script:

```bash
cd BanglaTechManager
npx tsx test-all-role-logins.ts
```

This will test all logins and show a summary.

### Option 3: Manual Testing

Use the credentials below to login manually at `http://localhost:5000/login`

---

## 📋 All Login Credentials

### 👑 Super Admin

**Full system access across all tenants**

| Email | Password | Role | Access |
|-------|----------|------|--------|
| `superadmin@sohayota.com` | `demo123` | `super_admin` | Can view/manage all tenants |

**What to test:**
- ✅ View all tenants' data (with `?tenantId=` parameter)
- ✅ Manage tenant settings
- ✅ Create/manage users across tenants
- ✅ View system-wide analytics
- ✅ Impersonate tenant admins

---

### 🏢 Tenant Admins

**Full access within their respective tenant**

#### Tenant 1: Dhaka Tech Solutions
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@dhakatech.com` | `demo123` | `tenant_admin` | Dhaka Tech Solutions |

**What to test:**
- ✅ View ONLY Dhaka Tech customers
- ✅ All customers show `companyName = "Dhaka Tech Solutions"`
- ✅ Cannot see other tenants' data
- ✅ Cannot access other tenants' tickets/customers
- ✅ Can create/manage users in own tenant

#### Tenant 2: Chittagong Tech Hub
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@chittagong.tech.com` | `demo123` | `tenant_admin` | Chittagong Tech Hub |

**What to test:**
- ✅ View ONLY Chittagong customers
- ✅ All customers show `companyName = "Chittagong Tech Hub"`
- ✅ Cannot see Dhaka Tech's data
- ✅ Tenant isolation works correctly

#### Tenant 3: Sylhet Software House
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@sylhet.software.com` | `demo123` | `tenant_admin` | Sylhet Software House |

#### Tenant 4: Khulna IT Systems
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `admin@khulna.it.com` | `demo123` | `tenant_admin` | Khulna IT Systems |

---

### 👨‍💼 Support Agents

**Can manage customers and tickets within their tenant**

#### Support Agent for Dhaka Tech Solutions
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `support@dhaka.com` | `demo123` | `support_agent` | Dhaka Tech Solutions |

**What to test:**
- ✅ Can view and manage Dhaka Tech customers
- ✅ Can create/update tickets
- ✅ Cannot delete customers
- ✅ Cannot manage users
- ✅ Limited to own tenant only

#### Support Agent for Chittagong Tech Hub
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `support@chittagong.com` | `demo123` | `support_agent` | Chittagong Tech Hub |

#### Support Agent for Sylhet Software House
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `support@sylhet.com` | `demo123` | `support_agent` | Sylhet Software House |

#### Support Agent for Khulna IT Systems
| Email | Password | Role | Tenant |
|-------|----------|------|--------|
| `support@khulna.com` | `demo123` | `support_agent` | Khulna IT Systems |

---

### 👤 Customer Accounts

**Limited read-only access, can create tickets**

**Password for all customers:** `demo123`

#### Sample Customer Accounts

| Email | Password | Tenant | Role |
|-------|----------|--------|------|
| `rahim.khan1@company.com` | `demo123` | Dhaka Tech Solutions | `customer` |
| `fatema.khan2@company.com` | `demo123` | Dhaka Tech Solutions | `customer` |
| `karim.ahmed3@company.com` | `demo123` | Dhaka Tech Solutions | `customer` |
| `sufia.begum9@company.com` | `demo123` | Dhaka Tech Solutions | `customer` |
| `priya.sharma19@company.com` | `demo123` | Chittagong Tech Hub | `customer` |
| `deepak.singh57@company.com` | `demo123` | Chittagong Tech Hub | `customer` |
| `majid.hassan85@company.com` | `demo123` | Sylhet Software House | `customer` |
| `ravi.iyer95@company.com` | `demo123` | Sylhet Software House | `customer` |
| `samir.patel123@company.com` | `demo123` | Khulna IT Systems | `customer` |
| `priya.ahmed143@company.com` | `demo123` | Khulna IT Systems | `customer` |

**What to test:**
- ✅ Can view own tickets
- ✅ Can create new tickets
- ✅ Can send messages in tickets
- ✅ Can request calls with agents
- ✅ Redirected to `/customer/dashboard` after login
- ✅ Cannot access admin features
- ✅ Cannot see other customers' data

**Note:** There are ~150 customer accounts total. To see all customer emails, run:
```bash
npx tsx show-customer-credentials.ts
```

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

### Test 6: Customer Dashboard
1. Login as `rahim.khan1@company.com` / `demo123`
2. Should be redirected to `/customer/dashboard`
3. Can view own tickets
4. Can create new tickets
5. Cannot access admin dashboard

---

## 📊 Quick Reference Table

| Role | Count | Password | Key Permissions |
|------|-------|----------|----------------|
| Super Admin | 1 | `demo123` | Full system access |
| Tenant Admin | 4 | `demo123` | Full access within tenant |
| Support Agent | 4 | `demo123` | Manage customers/tickets |
| Customer | ~150 | `demo123` | View own tickets, create tickets |

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
   - Customer: Can only view own tickets
   - Super admin: Can view all tenants (when specified)

4. **Tenant ID Spoofing Prevention**
   - Cannot inject tenant_id in request body
   - All resources created in authenticated user's tenant

---

## 🛠️ Troubleshooting

### Server Not Running
```bash
cd BanglaTechManager
npm run dev
```

### Login Fails
- Check server console for errors
- Verify email/password are correct
- Ensure user account exists in database
- Check network tab in browser DevTools

### Customer Login Not Working
- Customer accounts are created automatically on server startup
- Check server console for: `✅ Created customer user account`
- Run `npx tsx show-customer-credentials.ts` to see available customers

### CORS Errors
- Make sure you're accessing from `http://localhost:5000`
- Check server CORS configuration

---

## 📝 Notes

- **All passwords are:** `demo123` (for easy testing)
- **Change passwords in production!**
- **Server URL:** `http://localhost:5000`
- **Login endpoint:** `POST /api/auth/login`
- **Customer redirect:** `/customer/dashboard`
- **Admin redirect:** `/`

---

**Happy Testing! 🚀**

