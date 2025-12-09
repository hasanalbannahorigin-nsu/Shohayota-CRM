# 🔑 Create Customer User Account Guide

## Problem

You see a customer in the customer portal, but when you try to log in with their email, it doesn't work. This is because **not all customers have user accounts** - only customers with user accounts can log in.

## Solution

Create a user account for the customer you want to log in with.

## Method 1: Create User Account by Email (Easiest)

If you know the customer's email address:

```bash
npx tsx create-customer-user-by-email.ts customer@email.com
```

**Example:**
```bash
npx tsx create-customer-user-by-email.ts rahim.khan1@company.com
```

This will:
- ✅ Find the customer by email
- ✅ Create a user account for them
- ✅ Set password to `demo123`
- ✅ Show you the login credentials

## Method 2: See All Customer Credentials

To see all customers that already have user accounts:

```bash
npx tsx show-customer-credentials.ts
```

## Method 3: Manual Creation via Code

If you want to create it programmatically:

```typescript
import { storage } from "./server/storage";

// Find customer
const customer = await storage.getCustomersByTenant(tenantId)
  .find(c => c.email === "customer@email.com");

// Create user account
await storage.createCustomerUser(
  customer.tenantId,
  customer.id,
  customer.email,
  "demo123",  // password
  customer.name
);
```

## Default Password

All customer user accounts created through these methods use:
```
Password: demo123
```

## After Creating User Account

1. Go to: http://localhost:5000/login
2. Enter the customer email
3. Enter password: `demo123`
4. You'll be redirected to `/customer/dashboard`

## Troubleshooting

### "Customer not found"
- Make sure you copied the exact email from the customer portal
- Check for typos (email is case-insensitive but must match exactly)

### "User account already exists"
- The customer already has a user account
- Use `show-customer-credentials.ts` to see all credentials
- Or try logging in with password: `demo123`

### "Email already in use by another user"
- A user account with this email exists but is not linked to this customer
- You may need to use a different customer email

---

**Quick Command:**
```bash
# Create user account for customer
npx tsx create-customer-user-by-email.ts YOUR_CUSTOMER_EMAIL@company.com
```

