# MCP (Master Control Plane) - Complete Features Guide

## Overview
The Master Control Plane (MCP) is a comprehensive admin interface for managing tenants, viewing metrics, audit logs, and feature flags. It's accessible only to **super_admin** and **tenant_admin** roles.

## Access Control

### Super Admin
- **Full Access**: Can view and manage ALL tenants
- **Can Create**: New tenants
- **Can Manage**: Suspend, activate, update any tenant
- **Can View**: All tenant metrics, logs, and feature flags

### Tenant Admin
- **View Access**: Can view all tenants (for platform overview)
- **Manage Own Tenant**: Can only manage their own tenant
- **Cannot**: Create new tenants or manage other tenants
- **Can View**: Metrics, logs, and feature flags for their tenant

## All MCP Features

### 1. View All Tenants
**Location**: `/mcp/tenants`

**Features**:
- Paginated list of all tenants
- Filter by status (active, suspended)
- Filter by plan (free, basic, pro, enterprise)
- View tenant name, status, plan, and creation date
- Quick actions menu for each tenant

**Actions Available**:
- View Details (all users)
- Suspend/Activate (super_admin only)
- Run Migration (super_admin only)

**Screenshot Areas**:
- Tenant list table with pagination
- Filter options
- Action dropdown menus

---

### 2. Create New Tenant
**Location**: `/mcp/new-tenant`

**Features**:
- Form to create a new tenant
- Required fields:
  - **Name**: Tenant name (required)
  - **Domain**: Optional domain name
  - **Plan**: Select from Free, Basic, Pro, Enterprise

**Access**: Super Admin only

**After Creation**:
- Redirects to tenant details page
- Tenant is created with "active" status
- Audit log entry is created

---

### 3. View Tenant Details
**Location**: `/mcp/tenants/:tenantId`

**Features**:
- Complete tenant information
- Four main tabs:
  1. **Overview**: Basic tenant info
  2. **Metrics**: Key statistics
  3. **Audit Logs**: Action history
  4. **Feature Flags**: Feature toggles

**Overview Tab**:
- Tenant ID
- Name
- Domain
- Plan
- Status
- Created date

**Actions** (Super Admin only):
- Suspend/Activate button
- Run Migration button

---

### 4. Tenant Metrics
**Location**: `/mcp/tenants/:tenantId` → Metrics tab

**Metrics Displayed**:
- **Users**: Total number of users in tenant
- **Customers**: Total number of customers
- **Tickets**: Total number of tickets
- **Open Tickets**: Number of currently open tickets

**Visualization**:
- Grid layout with metric cards
- Large numbers with labels
- Color-coded for easy reading

---

### 5. Audit Logs
**Location**: `/mcp/tenants/:tenantId` → Audit Logs tab

**Features**:
- Chronological list of all MCP actions
- Shows:
  - Action type (create_tenant, update_tenant, suspend_tenant, etc.)
  - Actor role (super_admin, tenant_admin)
  - Actor ID
  - Timestamp
  - Payload (JSON data)

**Actions Logged**:
- `create_tenant`
- `update_tenant`
- `suspend_tenant`
- `activate_tenant`
- `run_migration`
- `update_feature_flags`

**Display**:
- Scrollable list (max 200 logs)
- Formatted JSON payloads
- Human-readable timestamps

---

### 6. Feature Flags Management
**Location**: `/mcp/tenants/:tenantId` → Feature Flags tab

**Features**:
- Toggle features on/off per tenant
- Available flags:
  - **AI Assistant**: Enable AI-powered features
  - **Voice Calls**: Enable voice call functionality
  - More flags can be added as needed

**Functionality**:
- Switch toggles for each feature
- Real-time updates
- Changes are logged in audit logs

**Access**:
- Super Admin: Can manage all tenants' flags
- Tenant Admin: Can manage their own tenant's flags

---

### 7. Suspend/Activate Tenants
**Location**: `/mcp/tenants/:tenantId` or `/mcp/tenants` (dropdown menu)

**Features**:
- **Suspend**: Deactivates a tenant (status → "suspended")
- **Activate**: Reactivates a suspended tenant (status → "active")

**Access**: Super Admin only

**Effects**:
- Status change is immediate
- Audit log entry created
- Tenant status badge updates

---

### 8. Run Migration for Tenant
**Location**: `/mcp/tenants/:tenantId` or `/mcp/tenants` (dropdown menu)

**Features**:
- Enqueues a migration job for a tenant
- Returns a job ID for tracking
- Placeholder for background job system

**Access**: Super Admin only

**Response**:
- Job ID
- Status message
- Tenant ID

---

## Navigation Structure

### Sidebar Menu (MCP Layout)
```
Master Control Plane
├── Tenants (List all tenants)
├── New Tenant (Super Admin only)
└── My Tenant (Tenant Admin - links to their tenant)
```

### Main Routes
- `/mcp/tenants` - Tenant list
- `/mcp/tenants/:tenantId` - Tenant details
- `/mcp/new-tenant` - Create tenant form

---

## API Endpoints

All MCP endpoints are under `/mcp/api`:

### List Tenants
```
GET /mcp/api/tenants?page=1&perPage=20&status=active&plan=pro
```

### Create Tenant
```
POST /mcp/api/tenants
Body: { name: string, domain?: string, plan: string }
```

### Get Tenant Details
```
GET /mcp/api/tenants/:tenantId
```

### Update Tenant
```
PATCH /mcp/api/tenants/:tenantId
Body: { status?: string, plan?: string }
```

### Suspend Tenant
```
POST /mcp/api/tenants/:tenantId/suspend
```

### Activate Tenant
```
POST /mcp/api/tenants/:tenantId/activate
```

### Get Tenant Metrics
```
GET /mcp/api/tenants/:tenantId/metrics
```

### Get Tenant Logs
```
GET /mcp/api/tenants/:tenantId/logs?limit=200
```

### Update Feature Flags
```
POST /mcp/api/tenants/:tenantId/feature-flags
Body: { flags: { [key: string]: boolean } }
```

### Run Migration
```
POST /mcp/api/tenants/:tenantId/migrate
```

---

## How to Access MCP

### Step 1: Login
1. Navigate to `http://localhost:5000`
2. Login with credentials:
   - **Super Admin**: `superadmin@sohayota.com` / `demo123`
   - **Tenant Admin**: `admin@dhakatech.com` / `demo123`

### Step 2: Access MCP
1. After login, look for **"MCP"** in the sidebar menu
2. Click on **"MCP"** to access the Master Control Plane
3. You'll see the MCP layout with sidebar navigation

### Step 3: Explore Features
1. **View Tenants**: Click "Tenants" in sidebar
2. **Create Tenant**: Click "New Tenant" (Super Admin only)
3. **View Details**: Click on any tenant name or "View Details"
4. **Explore Tabs**: In tenant details, switch between Overview, Metrics, Logs, and Feature Flags

---

## Visual Features Summary

### Tenant List Page
- ✅ Table with tenant information
- ✅ Status badges (active/suspended)
- ✅ Plan indicators
- ✅ Action dropdown menus
- ✅ Pagination controls
- ✅ "New Tenant" button (Super Admin)
- ✅ Empty state with "Create First Tenant" button

### Tenant Detail Page
- ✅ Header with tenant name and domain
- ✅ Status badge
- ✅ Action buttons (Suspend/Activate/Migrate)
- ✅ Tab navigation (Overview, Metrics, Logs, Features)
- ✅ Overview: Tenant information grid
- ✅ Metrics: Four metric cards (Users, Customers, Tickets, Open Tickets)
- ✅ Logs: Scrollable audit log list with formatted JSON
- ✅ Features: Toggle switches for feature flags

### Create Tenant Form
- ✅ Clean form layout
- ✅ Name input (required)
- ✅ Domain input (optional)
- ✅ Plan dropdown (Free, Basic, Pro, Enterprise)
- ✅ Submit button
- ✅ Cancel button
- ✅ Form validation

---

## Security Features

1. **Role-Based Access Control (RBAC)**
   - All endpoints protected by middleware
   - Super Admin: Full access
   - Tenant Admin: Limited to own tenant

2. **Audit Logging**
   - All actions are logged
   - Includes actor ID, role, action, and payload
   - Timestamped for compliance

3. **Authentication Required**
   - All MCP routes require valid JWT token
   - Token must include proper roles

4. **Tenant Isolation**
   - Tenant Admin can only access their tenant
   - Super Admin can access all tenants

---

## Error Handling

### Common Errors
- **401 Unauthorized**: Not logged in or invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Tenant doesn't exist
- **400 Bad Request**: Invalid input data

### Error Display
- Toast notifications for errors
- Error messages in UI
- Retry buttons where applicable

---

## Database Support

MCP works with:
- **PostgreSQL**: Full feature support
- **In-Memory Storage**: Fallback for development/testing

All database operations use:
- Connection pooling
- Transaction support
- Error handling with fallbacks

---

## Testing Checklist

### As Super Admin
- [ ] View all tenants
- [ ] Create new tenant
- [ ] View tenant details
- [ ] Suspend a tenant
- [ ] Activate a tenant
- [ ] View tenant metrics
- [ ] View audit logs
- [ ] Update feature flags
- [ ] Run migration

### As Tenant Admin
- [ ] View all tenants (read-only)
- [ ] View own tenant details
- [ ] Cannot create tenants
- [ ] Cannot suspend/activate other tenants
- [ ] Can manage own tenant's feature flags
- [ ] Can view own tenant's metrics and logs

---

## Future Enhancements

Potential additions:
- Export tenant data
- Bulk operations
- Advanced filtering
- Search functionality
- Tenant usage analytics
- Billing integration
- Custom feature flags
- Tenant templates

---

## Support

For issues or questions:
1. Check server console logs
2. Verify user roles in database
3. Ensure JWT token includes correct roles
4. Check browser console for frontend errors

---

**Last Updated**: 2024-12-10
**Version**: 1.0.0

