# ⚡ Quick Start: Permanent Accounts

## 🎯 One-Time Setup

### Step 1: Create Permanent Accounts
```bash
cd BanglaTechManager
npm run seed
```

This creates:
- ✅ 4 Tenants
- ✅ 1 Super Admin
- ✅ 4 Tenant Admins
- ✅ 4 Support Agents
- ✅ 250 Customers

### Step 2: Start Server
```bash
npm run dev
```

### Step 3: Login
Go to: http://localhost:5000/login

## 🔑 Quick Login Credentials

**Password for ALL accounts:** `demo123`

### Test These Accounts:

**Super Admin:**
- `superadmin@sohayota.com` / `demo123`

**Tenant Admin:**
- `admin@dhakatech.com` / `demo123`

**Support Agent:**
- `support@dhaka.com` / `demo123`

**Customer:**
- `rahim.khan1@company.com` / `demo123`
- `fatema.khan2@company.com` / `demo123`
- `karim.ahmed3@company.com` / `demo123`

## 📧 All Customer Emails

Customers are numbered 1-250:
- `rahim.khan1@company.com` (Customer #1)
- `fatema.khan2@company.com` (Customer #2)
- ... up to ...
- `samir.menon250@company.com` (Customer #250)

**Format:** `{firstname}.{lastname}{number}@company.com`

## ✅ Done!

All accounts are permanent and will work every time you start the server.

See `PERMANENT_ACCOUNTS.md` for complete account list.

