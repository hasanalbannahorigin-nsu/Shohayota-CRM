# 👤 Customer Login - Quick Start Guide

## 🚀 Server is Running!

The website is now accessible at: **http://localhost:5000**

## 🔑 Customer Login Steps

### Step 1: Open Login Page
- Go to: **http://localhost:5000/login**
- Or click the login link if already on the site

### Step 2: Use Customer Credentials

**Password for ALL customers:** `demo123`

#### Sample Customer Accounts (Choose any):

| Email | Password | Tenant |
|-------|----------|--------|
| `rahim.khan1@company.com` | `demo123` | Dhaka Tech Solutions |
| `fatema.khan2@company.com` | `demo123` | Dhaka Tech Solutions |
| `karim.ahmed3@company.com` | `demo123` | Dhaka Tech Solutions |
| `sufia.begum9@company.com` | `demo123` | Dhaka Tech Solutions |
| `priya.sharma19@company.com` | `demo123` | Chittagong Tech Hub |
| `deepak.singh57@company.com` | `demo123` | Chittagong Tech Hub |
| `majid.hassan85@company.com` | `demo123` | Sylhet Software House |
| `ravi.iyer95@company.com` | `demo123` | Sylhet Software House |
| `samir.patel123@company.com` | `demo123` | Khulna IT Systems |
| `priya.ahmed143@company.com` | `demo123` | Khulna IT Systems |

### Step 3: Login
1. Enter any customer email (e.g., `rahim.khan1@company.com`)
2. Enter password: `demo123`
3. Click "Sign In"

### Step 4: Customer Dashboard
After successful login, you'll be automatically redirected to:
- **Customer Dashboard:** `/customer/dashboard`

## 🎯 What Customers Can Do

Once logged in as a customer, you can:
- ✅ View your own tickets
- ✅ Create new support tickets
- ✅ Send messages in tickets
- ✅ Request calls with support agents
- ✅ View ticket history

## 📋 Get All Customer Emails

To see all available customer accounts, run:

```bash
cd BanglaTechManager
npx tsx show-customer-credentials.ts
```

This will list all ~150 customer accounts with their emails.

## 🔍 Customer Email Pattern

All customer emails follow this pattern:
- Format: `{firstname}.{lastname}{number}@company.com`
- Examples:
  - `rahim.khan1@company.com`
  - `fatema.begum2@company.com`
  - `karim.ahmed3@company.com`

## ⚠️ Troubleshooting

### Login Fails?
1. **Check server is running:** `http://localhost:5000` should load
2. **Verify email format:** Must be lowercase (e.g., `rahim.khan1@company.com`)
3. **Check password:** Must be exactly `demo123`
4. **Check server console:** Look for error messages

### Customer Account Not Found?
- Customer accounts are created automatically when the server starts
- Wait a few seconds after server startup for accounts to be created
- Check server console for: `✅ Created customer user account`

### Need More Customer Accounts?
- Run: `npx tsx show-customer-credentials.ts` to see all available customers
- Or check the server console output when it starts

## 🎉 Quick Test

**Fastest way to test customer login:**

1. Open: http://localhost:5000/login
2. Email: `rahim.khan1@company.com`
3. Password: `demo123`
4. Click "Sign In"
5. You'll be redirected to the customer dashboard!

---

**Happy Testing! 🚀**

