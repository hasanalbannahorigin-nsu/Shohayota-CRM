# Ticket Creation Error Fix

## Problem
The ticket creation was failing with error: `"Unexpected token '<', "<!DOCTYPE "... is not valid JSON"`

This error indicates the API was returning HTML instead of JSON, typically caused by:
1. Authentication failure (redirecting to login page)
2. Route not found (404 HTML page)
3. Server error returning HTML error page

## Root Causes Identified

### 1. Token Key Mismatch
- **Frontend** was using: `localStorage.getItem("token")`
- **Auth library** expects: `localStorage.getItem("auth_token")`
- This caused authentication to fail silently

### 2. Missing JSON Response Headers
- Some routes weren't explicitly setting `Content-Type: application/json`
- Errors could return HTML error pages instead of JSON

### 3. Insufficient Error Handling
- Errors weren't being caught and returned as JSON properly
- No logging to help debug issues

## Fixes Applied

### 1. Fixed Frontend Token Retrieval
**File:** `client/src/pages/customer-ticket-form.tsx`
- Changed from `localStorage.getItem("token")` to `localStorage.getItem("auth_token")`
- Added token validation before making request
- Added better error handling with content-type checking
- Improved error messages

### 2. Added JSON Response Middleware
**File:** `server/routes/customer-portal.ts`
- Added `ensureJsonResponse` middleware to all customer portal routes
- Ensures all responses (including errors) return JSON
- Applied to all `/api/customers/me/*` endpoints

### 3. Enhanced Error Handling
**File:** `server/routes/customer-portal.ts`
- Added comprehensive logging for ticket creation
- Better error messages with stack traces in development
- Validation of required fields (tenantId, customerId, userId)
- Graceful handling of optional operations (email, SSE)

### 4. Improved Auth Middleware
**File:** `server/auth.ts`
- Added JSON response header to `requireCustomer` middleware
- Added logging for missing customerId
- Better error messages

## Testing

### Manual Test Steps:
1. **Login as customer:**
   ```bash
   POST /api/auth/login
   {
     "email": "customer@example.com",
     "password": "demo123"
   }
   ```

2. **Create ticket:**
   ```bash
   POST /api/customers/me/tickets
   Authorization: Bearer <token>
   {
     "title": "Test Ticket",
     "description": "Test description",
     "category": "support",
     "priority": "medium"
   }
   ```

3. **Verify response:**
   - Should return 201 with ticket JSON
   - Should NOT return HTML
   - Check browser console for any errors

### Expected Behavior:
- ✅ Ticket created successfully
- ✅ Initial message created with ticket description
- ✅ JSON response returned (not HTML)
- ✅ Proper error messages if validation fails
- ✅ Logging in server console for debugging

## Debugging

If ticket creation still fails:

1. **Check browser console:**
   - Look for network errors
   - Verify Authorization header is sent
   - Check response content-type

2. **Check server logs:**
   - Look for `[CUSTOMER PORTAL]` prefixed logs
   - Check for authentication errors
   - Verify user context (tenantId, customerId, userId)

3. **Verify authentication:**
   - Ensure token is stored in `localStorage.getItem("auth_token")`
   - Check token hasn't expired
   - Verify user has `customer` role and `customerId`

4. **Check route registration:**
   - Verify `registerCustomerPortalRoutes` is called in `server/routes.ts`
   - Ensure routes are registered before catch-all routes

## Files Modified

1. `client/src/pages/customer-ticket-form.tsx` - Fixed token retrieval and error handling
2. `server/routes/customer-portal.ts` - Added JSON middleware and better error handling
3. `server/auth.ts` - Improved customer role middleware

## Next Steps

If issues persist:
1. Check server console for detailed error logs
2. Verify customer user has proper `customerId` set
3. Ensure customer portal routes are registered correctly
4. Test authentication flow separately

