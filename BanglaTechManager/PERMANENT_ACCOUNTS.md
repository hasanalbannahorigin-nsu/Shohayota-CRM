# 🗄️ Permanent Database Accounts

## ✅ Successfully Created

- **4 Tenants**
- **1 Super Admin**
- **4 Tenant Admins**
- **4 Support Agents**
- **250 Customers** (distributed across 4 tenants)

**Total: 259 user accounts**

## 🔑 All Passwords

**Password for ALL accounts:** `demo123`

## 📋 Account List

### 👑 Super Admin
- **Email:** `superadmin@sohayota.com`
- **Password:** `demo123`
- **Role:** `super_admin`

### 🏢 Tenant Admins (4)
- `admin@dhakatech.com` / `demo123` - Dhaka Tech Solutions
- `admin@chittagong.tech.com` / `demo123` - Chittagong Tech Hub
- `admin@sylhet.software.com` / `demo123` - Sylhet Software House
- `admin@khulna.it.com` / `demo123` - Khulna IT Systems

### 👨‍💼 Support Agents (4)
- `support@dhaka.com` / `demo123` - Dhaka Tech Solutions
- `support@chittagong.com` / `demo123` - Chittagong Tech Hub
- `support@sylhet.com` / `demo123` - Sylhet Software House
- `support@khulna.com` / `demo123` - Khulna IT Systems

### 👤 Customers (250)

**Distribution:**
- **Dhaka Tech Solutions:** 63 customers (1-63)
- **Chittagong Tech Hub:** 63 customers (64-126)
- **Sylhet Software House:** 63 customers (127-189)
- **Khulna IT Systems:** 61 customers (190-250)

**Email Format:** `firstname.lastname{number}@company.com`

**Sample Customer Emails:**
- `rahim.khan1@company.com` (Customer #1 - Dhaka)
- `fatema.khan2@company.com` (Customer #2 - Dhaka)
- `karim.ahmed3@company.com` (Customer #3 - Dhaka)
- `rahim.khan64@company.com` (Customer #64 - Chittagong)
- `rahim.khan127@company.com` (Customer #127 - Sylhet)
- `rahim.khan190@company.com` (Customer #190 - Khulna)
- `samir.menon249@company.com` (Customer #249 - Khulna)
- `samir.menon250@company.com` (Customer #250 - Khulna)

## 🚀 How to Use

### Run Seed Script (if needed)
```bash
cd BanglaTechManager
npx tsx seed-permanent-accounts.ts
```

This will create all permanent accounts. The script is idempotent - it won't create duplicates.

### Start Server
```bash
cd BanglaTechManager
npm run dev
```

### Login
Go to: http://localhost:5000/login

Use any account from the list above with password: `demo123`

## 📊 Customer Email Pattern

All customer emails follow this pattern:
- Format: `{firstname}.{lastname}{number}@company.com`
- Numbers: 1-250 (sequential across all tenants)
- Examples:
  - Customer 1: `rahim.khan1@company.com`
  - Customer 50: `sufia.begum50@company.com`
  - Customer 100: `jasmine.iyer100@company.com`
  - Customer 250: `samir.menon250@company.com`

## ✅ Benefits

1. **Fixed Emails** - No more random emails that change on restart
2. **Predictable** - Always know which emails exist
3. **Fast** - All accounts created in seconds
4. **Permanent** - Accounts persist across server restarts
5. **Complete** - All roles covered (super admin, tenant admin, support, customer)

## 🔄 Re-seeding

If you need to reset the database:

1. Stop the server
2. Run: `npx tsx seed-permanent-accounts.ts`
3. Start server: `npm run dev`

The script will:
- Create accounts if they don't exist
- Skip accounts that already exist
- Fix any misconfigured accounts

## 📝 Notes

- All accounts use password: `demo123`
- Customer emails are sequential (1-250)
- Accounts are distributed evenly across 4 tenants
- The system detects permanent accounts (250 customers) and won't reseed randomly

