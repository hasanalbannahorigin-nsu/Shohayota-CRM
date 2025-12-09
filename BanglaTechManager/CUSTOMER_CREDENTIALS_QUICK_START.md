# 🎯 Customer Login - Quick Start Guide

## ✅ Server is Running!

The website is now running at: **http://localhost:5000**

## 🔑 Customer Login Credentials

The server automatically creates a customer user account for the **first customer** of the **first tenant (Dhaka Tech Solutions)** during initialization.

### How to Find Your Customer Email:

The customer email follows this pattern:
- Format: `[firstname].[lastname]1@company.com`
- Examples:
  - `rahim.khan1@company.com`
  - `karim.ahmed1@company.com`
  - `fatema.begum1@company.com`

### Password:
```
demo123
```

## 📋 Steps to Login:

1. **Open your browser** and go to: http://localhost:5000/login

2. **Check the server console** - Look for this message:
   ```
   ✅ Created customer user account: [email] (password: demo123)
   ```
   This will show you the exact customer email to use.

3. **Login with customer credentials:**
   - Email: (from console output, e.g., `rahim.khan1@company.com`)
   - Password: `demo123`

4. **You will be redirected to** `/customer/dashboard` where you can:
   - ✅ View your tickets
   - ✅ Create new tickets
   - ✅ Send messages in tickets
   - ✅ Request calls with agents

## 🔍 Alternative: Get Credentials via Script

If you want to see all customer credentials, run:
```bash
npx tsx show-customer-credentials.ts
```

## 🎨 Customer Dashboard Features

Once logged in as a customer, you'll see:
- **My Tickets** - List of all your tickets
- **Create Ticket** - Create a new support ticket
- **Request Call** - Request a call with a support agent
- **Ticket Thread** - View and reply to messages in tickets

---

**Need Help?** Check `CUSTOMER_LOGIN_CREDENTIALS.md` for more details.

