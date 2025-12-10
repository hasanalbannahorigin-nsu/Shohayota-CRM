# Master Control Plane (MCP) - Faculty Guide

## Overview

The Master Control Plane (MCP) is a secure admin console for managing the entire platform. It provides:

- **Tenant Provisioning**: Create and manage tenants
- **Tenant Lifecycle**: Suspend, activate, and manage tenant status
- **Metrics & Monitoring**: View tenant usage metrics
- **Feature Flags**: Enable/disable features per tenant
- **Audit Logging**: Track all MCP actions
- **Migration Management**: Run database migrations per tenant

## Access Requirements

### Roles

- **platform_admin**: Full access to all MCP features
- **tenant_admin**: Limited access to view and manage their own tenant only

### Creating a Platform Admin User

#### Option 1: Using Keycloak (OAuth2)

1. **Access Keycloak Admin Console**
   - URL: `http://localhost:8080` (or your Keycloak instance)
   - Login with admin credentials

2. **Navigate to Your Realm**
   - Select the realm (e.g., `shohayota-crm`)

3. **Create User**
   - Go to **Users** → **Create new user**
   - Fill in:
     - **Username**: `platform-admin`
     - **Email**: `platform-admin@yourdomain.com`
     - **Email Verified**: `On`
     - **First Name**: `Platform`
     - **Last Name**: `Admin`
   - Click **Create**

4. **Set Password**
   - Go to **Credentials** tab
   - Set password (e.g., `admin123`)
   - **Temporary**: `Off`
   - Click **Set password**

5. **Assign Roles**
   - Go to **Role mapping** tab
   - Click **Assign role**
   - Select **Realm roles**
   - Assign `platform_admin` role
   - If role doesn't exist, create it:
     - Go to **Realm roles** → **Create role**
     - Name: `platform_admin`
     - Click **Save**

6. **Add Tenant ID Attribute**
   - Go to **Attributes** tab
   - Add attribute:
     - **Key**: `tenant_id`
     - **Value**: `platform` (or leave empty for platform admin)
   - Click **Save**

#### Option 2: Using Local JWT (Development)

For local testing without Keycloak, generate a test token:

```bash
TEST_JWT_SECRET=your-secret node scripts/generate-test-token.js "" "platform_admin"
```

Copy the token and paste it in browser console:

```javascript
localStorage.setItem('auth_token', '<PASTED_TOKEN>');
```

## Running Migrations

Before using MCP, run the database migrations:

```bash
export DATABASE_URL="postgres://user:password@localhost:5432/database"
node scripts/run-migrations.js
```

This will create the required tables:
- `tenants`
- `mcp_audit_logs`
- `tenant_feature_flags`

## Accessing MCP

### Web UI

1. **Login** to the application with a platform_admin or tenant_admin account
2. **Navigate** to `/mcp` in your browser
   - Full URL: `http://localhost:5000/mcp`
3. **MCP Layout** will show:
   - Sidebar with navigation
   - Main content area

### API Endpoints

All MCP endpoints are prefixed with `/mcp/api`:

- Base URL: `http://localhost:5000/mcp/api`

## API Endpoints Reference

### Platform Admin Only Endpoints

#### List Tenants
```bash
curl -X GET "http://localhost:5000/mcp/api/tenants?page=1&perPage=20" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

#### Create Tenant
```bash
curl -X POST "http://localhost:5000/mcp/api/tenants" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "domain": "acme.local",
    "plan": "pro"
  }'
```

#### Update Tenant
```bash
curl -X PATCH "http://localhost:5000/mcp/api/tenants/<TENANT_ID>" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "plan": "enterprise"
  }'
```

#### Suspend Tenant
```bash
curl -X POST "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/suspend" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

#### Activate Tenant
```bash
curl -X POST "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/activate" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

#### Run Migration
```bash
curl -X POST "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/migrate" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

#### Update Feature Flags
```bash
curl -X POST "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/feature-flags" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "flags": {
      "ai_assistant": true,
      "voice_calls": false,
      "advanced_analytics": true
    }
  }'
```

### Tenant-Scoped Endpoints (Platform Admin or Tenant Admin)

#### Get Tenant Details
```bash
curl -X GET "http://localhost:5000/mcp/api/tenants/<TENANT_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Get Tenant Metrics
```bash
curl -X GET "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/metrics" \
  -H "Authorization: Bearer <TOKEN>"
```

Response:
```json
{
  "success": true,
  "data": {
    "users": 15,
    "customers": 250,
    "tickets": 1200,
    "openTickets": 45
  }
}
```

#### Get Tenant Audit Logs
```bash
curl -X GET "http://localhost:5000/mcp/api/tenants/<TENANT_ID>/logs?limit=50" \
  -H "Authorization: Bearer <TOKEN>"
```

## Getting a Token

### From Keycloak

```bash
# Get access token
curl -X POST "http://localhost:8080/realms/shohayota-crm/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=shohayota-crm-client" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "username=platform-admin" \
  -d "password=<PASSWORD>" \
  -d "grant_type=password"

# Extract access_token from response
```

### From Local Auth

If using local JWT authentication:

```bash
# Login via API
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "platform-admin@test.com",
    "password": "<PASSWORD>"
  }'

# Extract token from response
```

## MCP UI Features

### Tenants List (`/mcp/tenants`)

- View all tenants in a table
- Filter by status and plan
- Pagination support
- Actions:
  - View Details
  - Suspend/Activate
  - Run Migration

### Tenant Detail (`/mcp/tenants/:tenantId`)

Tabs:
1. **Overview**: Basic tenant information
2. **Metrics**: Usage statistics (users, customers, tickets)
3. **Audit Logs**: Recent MCP actions
4. **Feature Flags**: Enable/disable features

### New Tenant Form (`/mcp/new-tenant`)

- Create new tenant
- Set name, domain, and plan
- Automatically provisions tenant

## Security Considerations

1. **Role-Based Access**: Only platform_admin can perform destructive actions
2. **Tenant Isolation**: tenant_admin can only access their own tenant
3. **Audit Logging**: All MCP actions are logged
4. **Input Validation**: All endpoints validate inputs
5. **Transaction Safety**: Multi-step operations use database transactions

## Troubleshooting

### "Access Denied" Error

- Verify user has `platform_admin` or `tenant_admin` role
- Check JWT token is valid and not expired
- Ensure token includes correct roles in claims

### "Tenant not found" Error

- Verify tenant ID is correct
- Check tenant exists in database
- Ensure user has access to the tenant

### Migration Fails

- Check database connection
- Verify tenant exists
- Review server logs for detailed error

## Testing

Run MCP tests:

```bash
npm test -- tests/mcp.test.ts
```

Or run all tests:

```bash
npm test
```

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Review audit logs in MCP UI
3. Verify user roles and permissions
4. Check database connectivity

