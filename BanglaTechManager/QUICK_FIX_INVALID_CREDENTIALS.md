# ⚡ Quick Fix: Invalid Credentials Error

## 🚨 Problem
Getting "Invalid credentials" when trying to login as a customer.

## ✅ Solution (3 Steps)

### 1️⃣ Start Server (if not running)
```bash
cd BanglaTechManager
npm run dev
```

**Wait for:** `serving on port 5000`

### 2️⃣ Fix Customer Accounts
**Open a NEW terminal** (keep server running) and run:

```bash
cd BanglaTechManager
npx tsx ensure-all-customer-logins.ts
```

### 3️⃣ Try Login Again
- **URL:** http://localhost:5000/login
- **Email:** `rahim.khan1@company.com`
- **Password:** `demo123`

## 🎯 Quick Test

Test if login works:

```bash
cd BanglaTechManager
npx tsx test-customer-login-direct.ts
```

## 📋 Customer Credentials

**Password:** `demo123` (for all customers)

**Sample Emails:**
- `rahim.khan1@company.com`
- `fatema.khan2@company.com`
- `karim.ahmed3@company.com`
- `sufia.begum9@company.com`

## 🔍 Still Not Working?

1. **Check server console** for error messages
2. **Try a different customer email**
3. **Restart server** (Ctrl+C, then `npm run dev` again)
4. **Wait 5 seconds** after server starts for accounts to be created

## 💡 Tip

The server automatically creates customer accounts when it starts. If you see "Invalid credentials", the account might not be created yet. Wait a few seconds and try again, or run the fix script above.

