# Login Debug Checklist & Fix Guide

## 1. Quick Debug Checklist (Check These First)

### ✅ Are you hitting the correct endpoint?
- **Check**: Browser Network tab → Look for `POST /api/auth/login`
- **Fix**: Verify frontend is calling the correct URL

### ✅ Is the server receiving the email/password?
- **Check**: Add `console.log('[LOGIN] Body:', req.body)` in login route
- **Fix**: Check server logs for incoming request data

### ✅ Does a users record exist for this email?
```sql
SELECT id, email, role, tenant_id, customer_id, password_hash 
FROM users 
WHERE email = 'rahim.khan1@yahoo.com';
```
- **If NO user row**: Check customers table (see next step)
- **If YES user row**: Verify password_hash exists and is not NULL

### ✅ If no users row, is there a customers row with that email?
```sql
SELECT id, email, tenant_id, name 
FROM customers 
WHERE email = 'rahim.khan1@yahoo.com';
```
- **If customer exists**: Auto-provision should create user on first login
- **If NO customer**: Email doesn't exist in system

### ✅ Is the password hash valid?
- **Check**: `password_hash` should start with `$2b$` or `$2a$` (bcrypt format)
- **Fix**: If missing/corrupted, password reset needed

### ✅ Is JWT secret correct?
- **Check**: `SESSION_SECRET` environment variable matches token verification
- **Fix**: Ensure same secret used for signing and verifying

### ✅ Check server logs for errors
- **Look for**: Database connection errors, exceptions, stack traces
- **Fix**: Address any errors shown in logs

---

## 2. Immediate Login Fix Code

### Current Implementation Status
✅ **Already Implemented** - The login route in `server/routes.ts` already has auto-provisioning!

**Current flow:**
1. ✅ Checks users table first
2. ✅ If not found, checks customers table
3. ✅ Auto-provisions user with provided password
4. ✅ Verifies password with bcrypt
5. ✅ Issues JWT with tenant_id and customerId

### If You Need to Verify/Update

The login handler is at: `server/routes.ts` (lines 343-538)

**Key sections:**
- Line 356: `getUserByEmail(email)` - Check users
- Line 363: `getCustomerByEmail(email)` - Check customers  
- Line 414: `createCustomerUser()` - Auto-provision
- Line 484: `bcrypt.compare()` - Password verification
- Line 515-523: JWT token generation

---

## 3. Verification Commands

### Test Login (curl)

```bash
# Test with pre-created customer
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rahim.khan1@yahoo.com","password":"customer123"}'
```

**Expected Response:**
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

### Test Auto-Provision (New Customer)

```bash
# First, ensure customer exists but no user account
# Then login - should auto-provision
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"newcustomer@example.com","password":"mypassword123"}'
```

### Verify User Created (Check Database)

```sql
-- After auto-provision login, verify user exists
SELECT id, email, role, tenant_id, customer_id, password_hash 
FROM users 
WHERE email = 'newcustomer@example.com';
```

### Test Protected Endpoint

```bash
# Use token from login response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/customers/me
```

**Expected:** Customer profile JSON

---

## 4. Common Issues & Solutions

### Issue: "Invalid credentials" but email exists
**Cause**: Password hash mismatch or missing hash
**Fix**: 
- Check password_hash in database
- Try resetting password
- Verify using correct password (`customer123` for pre-created accounts)

### Issue: Auto-provision not working
**Cause**: Customer not found or storage error
**Fix**:
- Check server logs for `[LOGIN]` messages
- Verify customer exists in customers table
- Check storage.getCustomerByEmail() returns customer

### Issue: Token issued but rejected
**Cause**: JWT secret mismatch or token format issue
**Fix**:
- Verify SESSION_SECRET matches
- Check token format in browser DevTools
- Verify Authorization header format: `Bearer <token>`

### Issue: "Email not found" but customer exists
**Cause**: Email normalization mismatch
**Fix**:
- Check email is lowercase and trimmed
- Verify customer email matches exactly (case-insensitive)
- Check server logs for email normalization

---

## 5. Debug Logging

The login route already includes comprehensive logging:

- `[LOGIN] Attempting login for: <email>`
- `[LOGIN] No user found, checking customers...`
- `[LOGIN] ✅ Found customer: <name>`
- `[LOGIN] Auto-provisioning user account...`
- `[LOGIN] ✅ Auto-provisioned user account`
- `[LOGIN] Password comparison: <true/false>`
- `[LOGIN] ✅ SUCCESS for <email>`

**To debug:**
1. Watch server console/logs
2. Look for `[LOGIN]` prefixed messages
3. Check for error messages

---

## 6. Quick Test Script

Save as `test-login.sh`:

```bash
#!/bin/bash

EMAIL="rahim.khan1@yahoo.com"
PASSWORD="customer123"
BASE_URL="http://localhost:5000"

echo "Testing login for: $EMAIL"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "Response:"
echo "$RESPONSE" | jq '.'

TOKEN=$(echo "$RESPONSE" | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo ""
  echo "✅ Login successful!"
  echo "Token: ${TOKEN:0:50}..."
  
  echo ""
  echo "Testing protected endpoint..."
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/customers/me" | jq '.'
else
  echo ""
  echo "❌ Login failed!"
  echo "Check server logs for details"
fi
```

**Run:** `chmod +x test-login.sh && ./test-login.sh`

---

## 7. Database Queries for Debugging

```sql
-- Check if user exists
SELECT * FROM users WHERE email = 'rahim.khan1@yahoo.com';

-- Check if customer exists
SELECT * FROM customers WHERE email = 'rahim.khan1@yahoo.com';

-- List all customer emails (first 10)
SELECT email, name, tenant_id FROM customers LIMIT 10;

-- Check user-customer link
SELECT u.email, u.role, u.tenant_id, u.customer_id, c.name as customer_name
FROM users u
LEFT JOIN customers c ON u.customer_id = c.id
WHERE u.email = 'rahim.khan1@yahoo.com';

-- Count users vs customers
SELECT 
  (SELECT COUNT(*) FROM users WHERE role = 'customer') as user_count,
  (SELECT COUNT(*) FROM customers) as customer_count;
```

---

## Summary

✅ **Current Status**: Auto-provisioning is already implemented!

**To test:**
1. Use any email from `150-customer-credentials.json`
2. Password: `customer123`
3. Should login successfully

**If login fails:**
1. Check server logs for `[LOGIN]` messages
2. Verify email exists in customers table
3. Check password_hash in users table
4. Verify password matches (`customer123`)

