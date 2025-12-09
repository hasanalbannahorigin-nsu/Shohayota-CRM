# 🔧 Fix "Invalid Credentials" Error for Customer Login

## Problem
You're getting "Invalid credentials" when trying to login as a customer.

## Quick Fix

### Step 1: Make sure server is running
```bash
cd BanglaTechManager
npm run dev
```

Wait for the server to fully start (you'll see "serving on port 5000").

### Step 2: Fix customer accounts (while server is running)

Open a **NEW terminal window** (keep server running) and run:

```bash
cd BanglaTechManager
npx tsx ensure-all-customer-logins.ts
```

This will create/fix all customer login accounts.

### Step 3: Test login

Try logging in with:
- **Email:** `rahim.khan1@company.com`
- **Password:** `demo123`

## Common Issues & Solutions

### Issue 1: Customer account doesn't exist
**Solution:** Run the fix script above while server is running.

### Issue 2: Password hash is wrong
**Solution:** The login endpoint will auto-fix this on first failed login attempt. Try logging in again.

### Issue 3: Email case mismatch
**Solution:** The system normalizes emails automatically. Make sure you're using lowercase:
- ✅ `rahim.khan1@company.com`
- ❌ `Rahim.Khan1@Company.com` (will be normalized, but use lowercase to be safe)

### Issue 4: Server not initialized
**Solution:** 
1. Stop the server (Ctrl+C)
2. Start it again: `npm run dev`
3. Wait for "serving on port 5000"
4. Wait a few more seconds for customer accounts to be created
5. Try login again

## Verify Customer Accounts

To see all customer accounts:

```bash
cd BanglaTechManager
npx tsx show-customer-credentials.ts
```

## Test Login via API

Test if login works:

```bash
cd BanglaTechManager
npx tsx test-customer-login-direct.ts
```

## Customer Login Credentials

**Password for ALL customers:** `demo123`

### Sample Customer Emails:
- `rahim.khan1@company.com`
- `fatema.khan2@company.com`
- `karim.ahmed3@company.com`
- `sufia.begum9@company.com`
- `priya.sharma19@company.com`

## Still Not Working?

1. **Check server console** - Look for error messages
2. **Check browser console** - Open DevTools (F12) and check for errors
3. **Verify email format** - Must be lowercase: `firstname.lastname@company.com`
4. **Try different customer email** - Some accounts might not be created yet
5. **Restart server** - Stop (Ctrl+C) and start again: `npm run dev`

## Debug Steps

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to login
4. Check the `/api/auth/login` request
5. Look at the response - it will show the exact error

## Server Logs

When you try to login, check the server console. You should see:
```
[LOGIN] Attempting login for: rahim.khan1@company.com
[LOGIN] ✅ Found customer: ...
[LOGIN] ✅ Created user account for customer: ...
[LOGIN] ✅ SUCCESS for rahim.khan1@company.com role: customer
```

If you see errors, that will tell you what's wrong.

