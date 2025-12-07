# 🔐 Login Credentials for Shohayota CRM

## Super Admin Account
**Full system access across all tenants**

- **Email:** `superadmin@sohayota.com`
- **Password:** `demo123`
- **Role:** `super_admin`
- **Access:** Can view and manage all tenants, impersonate tenant admins, manage system-wide settings

---

## Tenant Admin Accounts
**Full access within their respective tenant**

### Tenant 1: Dhaka Tech Solutions
- **Email:** `admin@dhakatech.com`
- **Password:** `demo123`
- **Role:** `tenant_admin`
- **Tenant:** Dhaka Tech Solutions

### Tenant 2: Chittagong Tech Hub
- **Email:** `admin@chittagong.tech.com`
- **Password:** `demo123`
- **Role:** `tenant_admin`
- **Tenant:** Chittagong Tech Hub

### Tenant 3: Sylhet Software House
- **Email:** `admin@sylhet.software.com`
- **Password:** `demo123`
- **Role:** `tenant_admin`
- **Tenant:** Sylhet Software House

### Tenant 4: Khulna IT Systems
- **Email:** `admin@khulna.it.com`
- **Password:** `demo123`
- **Role:** `tenant_admin`
- **Tenant:** Khulna IT Systems

---

## Support Agent Accounts
**Can manage customers and tickets within their tenant**

### Support Agent for Dhaka Tech Solutions
- **Email:** `support@dhaka.com`
- **Password:** `demo123`
- **Role:** `support_agent`
- **Tenant:** Dhaka Tech Solutions

### Support Agent for Chittagong Tech Hub
- **Email:** `support@chittagong.com`
- **Password:** `demo123`
- **Role:** `support_agent`
- **Tenant:** Chittagong Tech Hub

### Support Agent for Sylhet Software House
- **Email:** `support@sylhet.com`
- **Password:** `demo123`
- **Role:** `support_agent`
- **Tenant:** Sylhet Software House

### Support Agent for Khulna IT Systems
- **Email:** `support@khulna.com`
- **Password:** `demo123`
- **Role:** `support_agent`
- **Tenant:** Khulna IT Systems

---

## Customer Accounts
**Note:** Customer accounts are created automatically with sample data. Each tenant has approximately 38 customers (150 total across 4 tenants).

Customer emails follow the pattern: `{firstname}.{lastname}{number}@company.com`

Example customer emails:
- `rahim.khan1@company.com`
- `karim.ahmed2@company.com`
- `fatema.hassan3@company.com`

**Note:** Customer accounts are typically accessed through the CRM interface by support agents and admins, not directly by customers themselves.

---

## Quick Reference

| Account Type | Email Pattern | Password | Count |
|-------------|---------------|----------|-------|
| Super Admin | `superadmin@sohayota.com` | `demo123` | 1 |
| Tenant Admin | `admin@[tenant].com` | `demo123` | 4 |
| Support Agent | `support@[city].com` | `demo123` | 4 |
| Customers | `{name}{number}@company.com` | N/A | ~150 |

---

## Testing Multi-Tenant Isolation

To test data isolation:

1. **Login as Tenant 1 Admin:** `admin@dhakatech.com` / `demo123`
   - Should only see Dhaka Tech Solutions data

2. **Login as Tenant 2 Admin:** `admin@chittagong.tech.com` / `demo123`
   - Should only see Chittagong Tech Hub data

3. **Login as Super Admin:** `superadmin@sohayota.com` / `demo123`
   - Can see all tenants and switch between them
   - Can impersonate tenant admins

---

## Security Notes

⚠️ **These are default demo credentials. Change them in production!**

- All passwords are: `demo123`
- For production, implement:
  - Password complexity requirements
  - Password expiration policies
  - Two-factor authentication
  - Account lockout after failed attempts

---

## Application Access

- **URL:** `http://localhost:5000`
- **Login Page:** `http://localhost:5000/login`

