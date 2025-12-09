# 🔧 Fix Customer Login - Quick Solution

## Problem
The script shows "Storage not initialized" because it's trying to access the server's storage from a separate process.

## ✅ Solution: Restart the Server

The **easiest** fix is to restart the server. The server automatically creates customer user accounts when it starts.

### Step 1: Stop Current Server
Press `Ctrl+C` in the terminal where the server is running

### Step 2: Start Server Again
```bash
cd BanglaTechManager
npm run dev
```

### Step 3: Wait for Initialization
Look for messages like:
```
✅ Created customer user account 1/38: rahim.khan1@company.com
✅ Created customer user account 2/38: ...
...
✅ Created 38 customer user accounts for Dhaka Tech Solutions
```

### Step 4: Test Customer Login
1. Go to: http://localhost:5000/login
2. Use any customer email (check console output)
3. Password: `demo123`

---

## Alternative: Use Browser Console (Without Restart)

If you can't restart the server, use the browser console:

### Step 1: Login as Admin
1. Go to: http://localhost:5000/login
2. Login with:
   - Email: `admin@dhakatech.com`
   - Password: `demo123`

### Step 2: Open Browser Console
Press `F12` → Go to "Console" tab

### Step 3: Run This Code
Copy and paste this into the console:

```javascript
// Create customer user accounts
fetch('/api/admin/create-customer-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Created:', data.created, 'accounts');
  console.log('⏭️ Skipped:', data.skipped, '(already existed)');
  
  // Get customer credentials
  return fetch('/api/admin/customer-credentials', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
})
.then(r => r.json())
.then(data => {
  console.log('\n📧 Customer Login Credentials:');
  console.log('Password for all: demo123\n');
  data.credentials.slice(0, 10).forEach(c => {
    console.log(`Email: ${c.email}`);
  });
});
```

### Step 4: Use Customer Email to Login
Copy one of the emails from console and login with password `demo123`

---

## Recommended: Restart Server ⭐

Restarting is simpler and ensures everything is set up correctly!

