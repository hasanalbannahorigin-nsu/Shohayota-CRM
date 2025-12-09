# 🔧 Create Customer User Accounts via API

## Problem
Customer login doesn't work because customer user accounts haven't been created.

## Solution: Use API Endpoint

Since the server is running, we can use an API endpoint to create customer user accounts without restarting.

### Step 1: Login as Admin

1. Go to: http://localhost:5000/login
2. Login with:
   - Email: `admin@dhakatech.com`
   - Password: `demo123`

### Step 2: Create Customer User Accounts

Open browser console (F12) or use curl/Postman:

**Option A: Using Browser Console (Easiest)**

1. After logging in as admin, open browser console (F12)
2. Run this JavaScript:

```javascript
fetch('/api/admin/create-customer-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(data => {
  console.log('✅ Result:', data);
  console.log(`Created: ${data.created} accounts`);
  console.log(`Skipped: ${data.skipped} (already exist)`);
});
```

**Option B: Using curl (Terminal)**

```bash
# First, login to get token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dhakatech.com","password":"demo123"}' \
  | jq -r '.token')

# Then create customer user accounts
curl -X POST http://localhost:5000/api/admin/create-customer-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```

### Step 3: Get Customer Credentials

After creating accounts, get customer emails:

**In Browser Console:**
```javascript
fetch('/api/admin/customer-credentials', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('Customer Login Credentials:');
  data.credentials.forEach(c => {
    console.log(`Email: ${c.email}, Password: demo123`);
  });
});
```

### Step 4: Test Customer Login

1. Logout (or open incognito window)
2. Go to: http://localhost:5000/login
3. Use any customer email from the list
4. Password: `demo123`

---

## Quick Fix Script

Alternatively, restart the server to automatically create all customer user accounts:

```bash
# Stop server (Ctrl+C)
# Then:
cd BanglaTechManager
npm run dev
```

Wait for: `✅ Created X customer user accounts` messages.

