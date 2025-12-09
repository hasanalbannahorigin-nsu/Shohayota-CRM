# 🔧 Fix Customer Login - Step by Step

## Problem
Customer login is not working because customer user accounts haven't been created.

## Solution

### Option 1: Restart the Server (Recommended)

The server will automatically create customer user accounts when it starts:

1. **Stop the current server** (if running)
   - Press `Ctrl+C` in the terminal where server is running

2. **Start the server again:**
   ```bash
   cd BanglaTechManager
   npm run dev
   ```

3. **Wait for initialization** - Look for messages like:
   ```
   ✅ Created customer user account 1/38: rahim.khan1@company.com
   ✅ Created 38 customer user accounts for Dhaka Tech Solutions
   ```

4. **Then try customer login:**
   - Go to: http://localhost:5000/login
   - Use any customer email + password: `demo123`

### Option 2: Create User Accounts for Existing Customers

If the server is already running and you don't want to restart:

1. **Open a NEW terminal window**

2. **Run the fix script:**
   ```bash
   cd BanglaTechManager
   npx tsx fix-customer-login.ts
   ```

3. **This will:**
   - Find all customers
   - Create user accounts for customers that don't have them
   - Show you which customer emails you can use

4. **Then login:**
   - Go to: http://localhost:5000/login
   - Use any customer email shown by the script
   - Password: `demo123`

### Option 3: Create User Account for Specific Customer

If you know the customer email:

```bash
cd BanglaTechManager
npx tsx create-customer-user-by-email.ts customer@email.com
```

## Verify It's Working

After running the fix, test login:

1. Go to: http://localhost:5000/login
2. Enter customer email (from customers table)
3. Enter password: `demo123`
4. You should be redirected to `/customer/dashboard`

## Troubleshooting

### "User not found" error
- Customer user account doesn't exist
- Run `npx tsx fix-customer-login.ts` to create it

### "Invalid credentials" error
- Password is wrong (should be `demo123`)
- Or customer user account doesn't exist

### "Storage not initialized"
- Server is not running
- Start server with: `npm run dev`

---

**Quick Fix Command:**
```bash
cd BanglaTechManager
npx tsx fix-customer-login.ts
```

