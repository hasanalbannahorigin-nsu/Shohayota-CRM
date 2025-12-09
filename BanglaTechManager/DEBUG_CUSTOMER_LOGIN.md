# 🔍 Debug Customer Login

## Problem
Customer login not working with email from customer portal.

## Quick Debug Steps

### Step 1: Check if Customer Email Exists

**In Browser Console (after opening http://localhost:5000):**

```javascript
// Replace with the actual customer email you're trying
const email = "your-customer-email@company.com";

fetch(`/api/debug/user/${encodeURIComponent(email)}`)
  .then(r => r.json())
  .then(data => {
    console.log("Debug Results:", data);
    if (data.customer) {
      console.log("✅ Customer found:", data.customer);
    } else {
      console.log("❌ Customer not found");
      console.log("Similar customers:", data.similarCustomers);
    }
    if (data.user) {
      console.log("✅ User account exists:", data.user);
    } else {
      console.log("❌ User account not found");
    }
  });
```

### Step 2: Try to Login

```javascript
const email = "your-customer-email@company.com";
const password = "demo123";

fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
})
.then(r => r.json())
.then(data => {
  if (data.token) {
    console.log("✅ Login successful!", data.user);
  } else {
    console.error("❌ Login failed:", data.error);
  }
});
```

### Step 3: Fix the Account

If customer exists but user account doesn't:

```javascript
const email = "your-customer-email@company.com";

fetch('/api/fix-customer-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
})
.then(r => r.json())
.then(data => {
  console.log("Fix result:", data);
  if (data.success) {
    console.log(`✅ Fixed! Login with: ${data.email} / ${data.password}`);
  }
});
```

## Common Issues

1. **Email format mismatch** - Check server console for email normalization
2. **User account not created** - Run fix endpoint
3. **Password hash missing** - Auto-fixed on login

## Check Server Console

Look for these messages:
- `[LOGIN] Attempting login for: ...`
- `[LOGIN] No user found, checking customers...`
- `[LOGIN] Found customer: ...`
- `[LOGIN] ✅ Created user account for customer: ...`

