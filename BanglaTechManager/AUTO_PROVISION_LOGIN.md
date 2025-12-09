# Auto-Provision Login Implementation

## Overview
Implemented auto-provisioning login flow for customers. When a customer tries to log in with their email:
1. If user exists → normal login (verify password)
2. If no user but customer exists → auto-create user account with provided password
3. If neither exists → invalid credentials

## Security Features

✅ **Tenant-aware**: All operations respect tenant isolation
✅ **RBAC enforced**: Customer users cannot be elevated to admin
✅ **Password hashing**: All passwords hashed with bcrypt (10 rounds)
✅ **No client trust**: Tenant ID always derived from customer record, never from client
✅ **Email normalization**: All emails normalized (lowercase, trimmed)

## Implementation Details

### Login Flow (`server/routes.ts`)

1. **Normalize email** (lowercase, trim)
2. **Check users table** for existing user
3. **If no user found**:
   - Check customers table for matching email
   - If customer found:
     - Auto-create user account with:
       - `role = "customer"`
       - `tenantId = customer.tenantId`
       - `customerId = customer.id`
       - `passwordHash = bcrypt.hash(providedPassword, 10)`
     - Log auto-provision event
4. **Verify password** using bcrypt.compare
5. **Issue JWT** with tenant_id and customerId

### Storage Helpers (`server/storage.ts`)

- `getUserByEmail(email)` - Find user by normalized email
- `getCustomerByEmail(email)` - Find customer by normalized email  
- `createCustomerUser(tenantId, customerId, email, password, name)` - Create user for customer

### Schema (`shared/schema.ts`)

Users table includes:
- `tenantId` (required, FK to tenants)
- `customerId` (optional, FK to customers)
- `role` (enum: super_admin, tenant_admin, support_agent, customer)
- `passwordHash` (bcrypt hash)

## Usage

### First Login (Auto-Provision)

```bash
POST /api/auth/login
{
  "email": "customer@example.com",
  "password": "their-chosen-password"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "user-id",
    "email": "customer@example.com",
    "name": "Customer Name",
    "role": "customer",
    "tenantId": "tenant-id",
    "customerId": "customer-id"
  }
}
```

### Subsequent Logins

Same endpoint, same credentials. Works as normal login.

## Testing

### Manual Test

1. Create a customer (without user account):
   ```sql
   INSERT INTO customers (id, tenant_id, name, email, status)
   VALUES ('cust-123', 'tenant-123', 'Test Customer', 'test@example.com', 'active');
   ```

2. Login with customer email:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"mypassword123"}'
   ```

3. Verify:
   - Returns 200 with JWT token
   - User record created in users table
   - User has role='customer'
   - User has customerId linked to customer

### Test Cases

✅ **Test A**: Existing user login still works
✅ **Test B**: Customer without user can login (auto-provision)
✅ **Test C**: Wrong password fails
✅ **Test D**: Non-existent email fails
✅ **Test E**: Tenant isolation maintained

## Notes

- **First login sets password**: Customer chooses password on first login
- **No email verification**: For immediate fix, password is set on first login
- **Future enhancement**: Consider email verification flow for production
- **Backward compatible**: Existing customers with hardcoded passwords still work

## Files Modified

1. `server/routes.ts` - Updated login route with auto-provisioning
2. `server/storage.ts` - Already has required helpers
3. `shared/schema.ts` - Already has customerId and tenantId fields

## Security Considerations

⚠️ **Auto-provision without email verification** means anyone with customer email can set password
- Acceptable for: Internal systems, pre-verified customers
- Not recommended for: Public-facing systems, unverified emails

**Recommended enhancement**: Add email verification flow:
1. Customer requests password reset
2. System sends email with verification link
3. Customer sets password via verified link
4. Then can login normally

