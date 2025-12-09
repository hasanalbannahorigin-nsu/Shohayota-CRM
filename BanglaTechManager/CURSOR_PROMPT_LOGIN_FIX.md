# Cursor Prompt: Fix Customer Login Flow

## Copy and paste this entire block into Cursor:

---

Fix customer login flow: implement "auto-provision on first login" for customers and make login robust. Update server/routes.ts login handler (POST /api/auth/login) to:

1. Look up user by email in users table using storage.getUserByEmail(email).

2. If not found, look up customers by email using storage.getCustomerByEmail(email).

3. If a customer exists but no user, create a user record with:
   - role='customer'
   - tenantId from customer.tenantId (never trust client-supplied tenant_id)
   - customerId linked to customer.id
   - password_hash from bcrypt.hash(providedPassword, 10)
   - email normalized (lowercase, trimmed)

4. Then verify password using bcrypt.compare(password, user.password_hash).

5. Issue JWT token with payload containing: sub (user.id), role, tenant_id (from user.tenantId), customerId (from user.customerId).

6. Return JSON with token, refreshToken, and user object.

Ensure storage helpers exist in server/storage.ts:
- getUserByEmail(email: string): Promise<User | undefined>
- getCustomerByEmail(email: string): Promise<Customer | undefined>  
- createCustomerUser(tenantId, customerId, email, password, name): Promise<User>

Add console.info logs for auto-provision events like: "[LOGIN] Auto-provisioned user {userId} for customer {customerId}".

Add comprehensive error handling with try-catch and return appropriate HTTP status codes (400 for missing fields, 401 for invalid credentials, 500 for server errors).

Ensure all operations are tenant-aware and never trust tenant_id from client request body.

End PROMPT

---

## What This Prompt Does

This prompt will:
- ✅ Verify/update the login handler in `server/routes.ts`
- ✅ Ensure auto-provisioning works correctly
- ✅ Add proper error handling
- ✅ Add logging for debugging
- ✅ Verify storage helpers exist
- ✅ Ensure tenant isolation

## Current Status

**Note**: The login flow is already implemented with auto-provisioning! This prompt will verify and enhance it if needed.

