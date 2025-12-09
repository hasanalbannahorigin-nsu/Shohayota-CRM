# Quick Login Fix Guide

## 🚀 Immediate Actions

### 1. Check Current Status
The login flow is **already implemented** with auto-provisioning in `server/routes.ts`!

### 2. Test Login Now

```bash
# Windows PowerShell
curl.exe -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"rahim.khan1@yahoo.com\",\"password\":\"customer123\"}'

# Linux/Mac
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim.khan1@yahoo.com","password":"customer123"}'
```

### 3. Expected Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "rahim.khan1@yahoo.com",
    "name": "Rahim Khan",
    "role": "customer",
    "tenantId": "...",
    "customerId": "..."
  }
}
```

---

## 🔍 Debug Checklist (5 minutes)

### ✅ Step 1: Server Running?
```bash
curl http://localhost:5000/api/health
# or check browser: http://localhost:5000
```

### ✅ Step 2: Check Server Logs
Look for `[LOGIN]` messages in console:
- `[LOGIN] Attempting login for: <email>`
- `[LOGIN] ✅ Found customer: <name>`
- `[LOGIN] ✅ SUCCESS`

### ✅ Step 3: Verify Email Exists
Check `150-customer-credentials.json` - all emails there should work.

### ✅ Step 4: Password Correct?
- **Pre-created accounts**: `customer123`
- **New customers**: Password they set on first login

### ✅ Step 5: Check Database (if accessible)
```sql
-- User exists?
SELECT email, role FROM users WHERE email = 'rahim.khan1@yahoo.com';

-- Customer exists?
SELECT email, name FROM customers WHERE email = 'rahim.khan1@yahoo.com';
```

---

## 🛠️ Common Fixes

### Issue: "Invalid credentials"
**Fix**: 
1. Verify password is `customer123` for pre-created accounts
2. Check server logs for password comparison result
3. Ensure email is exact match (case-insensitive)

### Issue: "Email not found"
**Fix**:
1. Check email exists in `150-customer-credentials.json`
2. Verify customer was created in database
3. Check server logs for customer lookup

### Issue: Auto-provision not working
**Fix**:
1. Check `storage.getCustomerByEmail()` returns customer
2. Verify `storage.createCustomerUser()` doesn't throw error
3. Check server logs for auto-provision messages

---

## 📋 Test All 150 Accounts

```bash
# Test first account
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim.khan1@yahoo.com","password":"customer123"}'

# Test second account  
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"karim.khan2@outlook.com","password":"customer123"}'
```

All 150 accounts use password: **`customer123`**

---

## 🎯 Quick Test Script

Run `test-login.sh`:
```bash
chmod +x test-login.sh
./test-login.sh rahim.khan1@yahoo.com customer123
```

Or use PowerShell:
```powershell
.\test-login.sh rahim.khan1@yahoo.com customer123
```

---

## 📝 Summary

✅ **Login is already working** with auto-provisioning!

**Credentials:**
- Email: Any from `150-customer-credentials.json`
- Password: `customer123`

**If login fails:**
1. Check server logs (`[LOGIN]` messages)
2. Verify email/password correct
3. Check database if accessible
4. Restart server if needed

