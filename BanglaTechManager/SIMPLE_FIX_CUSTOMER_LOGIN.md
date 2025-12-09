# 🔧 Simple Fix for Customer Login

## The Problem
Customer login doesn't work because customer user accounts haven't been created yet.

## ✅ Quick Fix (Choose One)

### Option 1: Restart Server (Easiest) ⭐

1. **Stop the server** (press `Ctrl+C` in the terminal)

2. **Start it again:**
   ```bash
   cd BanglaTechManager
   npm run dev
   ```

3. **Wait for these messages:**
   ```
   ✅ Created customer user account 1/38: rahim.khan1@company.com
   ✅ Created customer user account 10/38: ...
   ✅ Created 38 customer user accounts for Dhaka Tech Solutions
   ```

4. **Now login:**
   - Go to: http://localhost:5000/login
   - Email: Any customer email (check server console)
   - Password: `demo123`

---

### Option 2: Use API Endpoint (Without Restart)

**Step 1:** Login as admin first
- Go to: http://localhost:5000/login
- Email: `admin@dhakatech.com`
- Password: `demo123`

**Step 2:** Open browser console (Press F12)

**Step 3:** Run this code in console:

```javascript
fetch('/api/admin/create-customer-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => {
  alert(`✅ Created ${data.created} customer accounts!\n\nYou can now login with any customer email + password: demo123`);
  console.log('Result:', data);
});
```

**Step 4:** Get customer emails:
```javascript
fetch('/api/admin/customer-credentials')
  .then(r => r.json())
  .then(data => {
    console.log('Customer Emails you can use:');
    data.credentials.slice(0, 10).forEach(c => {
      console.log(`${c.email} / demo123`);
    });
  });
```

---

## 🎯 After Fixing

**Customer Login:**
- URL: http://localhost:5000/login
- Email: Any customer email
- Password: `demo123`
- You'll be redirected to `/customer/dashboard`

---

**Recommended:** Use Option 1 (Restart Server) - it's simpler and ensures everything is set up correctly!

