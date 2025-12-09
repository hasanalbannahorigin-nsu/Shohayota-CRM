# MCP Server Creation Feature

## Overview

Added a comprehensive "Create MCP Server" option to the BanglaTechManager application. This allows users to set up and manage Model Context Protocol (MCP) servers for AI integrations.

## What Was Added

### 1. Enhanced MCP Server Page (`client/src/pages/mcp-server.tsx`)

- **Create MCP Server Dialog**: A comprehensive dialog form that allows users to:
  - Name their MCP server
  - Add a description
  - Configure host and port
  - Choose authentication type (JWT, API Key, or None)
  - Set up API keys when needed

- **No Server State**: When no MCP server exists, users see a helpful empty state card with:
  - Clear instructions
  - Prominent "Create MCP Server" button
  - Explanation of what MCP servers do

- **Conditional Rendering**: 
  - Shows creation dialog when no server exists
  - Shows management interface (start/stop, configuration) when server exists
  - Tabs (Configuration, Resources, Tools, Prompts) only appear after server is created

### 2. Routing (`client/src/App.tsx`)

- Added route: `/mcp-server` → `MCPServerPage` component
- Route is accessible to authenticated users

### 3. Navigation (`client/src/components/app-sidebar.tsx`)

- Added "MCP Server" menu item in the sidebar
- Placed between "Integrations" and "AI Settings"
- Uses Server icon from lucide-react

## Features

### Create Server Dialog Fields

1. **Server Name** (Required)
   - Descriptive name for the MCP server instance
   - Placeholder: "My MCP Server"

2. **Description** (Optional)
   - Multi-line text area for describing the server's purpose
   - Placeholder: "Describe what this MCP server will provide access to..."

3. **Host** (Default: 0.0.0.0)
   - Network interface to bind to
   - Default listens on all interfaces

4. **Port** (Default: 3001)
   - Port number for the server
   - Must be an available port

5. **Authentication Type**
   - **JWT Token** (Recommended): Uses JWT for secure authentication
   - **API Key**: Requires a custom API key
   - **None**: Development only, no authentication

6. **API Key** (Conditional)
   - Required when authentication type is "API Key"
   - Password-masked input
   - Warning about storing securely

## User Flow

1. **First Time User**:
   - Navigates to MCP Server page
   - Sees empty state with "Create MCP Server" button
   - Clicks button → Dialog opens
   - Fills in server details
   - Clicks "Create Server" → Server is created

2. **Existing Server**:
   - Sees server status card
   - Can start/stop server
   - Can configure settings
   - Can view resources, tools, and prompts

## API Endpoints Required

The frontend expects the following backend API endpoints:

### 1. GET `/api/mcp/status`
Returns current server status:
```typescript
{
  enabled: boolean;
  running: boolean;
  port?: number;
  host?: string;
  tenantId?: string;
  resources: number;
  tools: number;
  prompts: number;
}
```

### 2. POST `/api/mcp/create`
Creates a new MCP server:
```typescript
Request Body:
{
  name: string;
  description?: string;
  port: number;
  host: string;
  authentication: {
    type: 'jwt' | 'api_key' | 'none';
    secret?: string; // for api_key type
  };
}

Response:
{
  id: string;
  name: string;
  status: 'created' | 'error';
  message?: string;
}
```

### 3. POST `/api/mcp/start`
Starts the MCP server:
```typescript
Response:
{
  success: boolean;
  message?: string;
}
```

### 4. POST `/api/mcp/stop`
Stops the MCP server:
```typescript
Response:
{
  success: boolean;
  message?: string;
}
```

### 5. PUT `/api/mcp/config`
Updates server configuration:
```typescript
Request Body:
{
  enabled: boolean;
  port?: number;
  host?: string;
  authentication?: {
    type: 'jwt' | 'api_key' | 'none';
    secret?: string;
  };
}
```

### 6. GET `/api/mcp/resources`
Returns available resources (only when server is running)

### 7. GET `/api/mcp/tools`
Returns available tools (only when server is running)

### 8. GET `/api/mcp/prompts`
Returns available prompts (only when server is running)

## Next Steps: Backend Implementation

To complete this feature, you'll need to:

1. **Create MCP Server Service** (`server/mcp-server-service.ts`):
   - Handle server creation
   - Store server configuration in database
   - Manage server lifecycle (start/stop)
   - Implement MCP protocol handlers

2. **Add Database Schema**:
   - Create `mcp_servers` table to store server configurations
   - Fields: id, tenant_id, name, description, host, port, auth_config, status, created_at, updated_at

3. **Implement API Routes** (`server/routes/mcp.ts` or add to existing routes):
   - All the endpoints listed above
   - Proper authentication and authorization
   - Tenant isolation

4. **MCP Protocol Implementation**:
   - Implement MCP server according to Model Context Protocol specification
   - Expose CRM resources, tools, and prompts
   - Handle authentication

## Files Modified

1. `BanglaTechManager/client/src/pages/mcp-server.tsx` - Enhanced with create dialog
2. `BanglaTechManager/client/src/App.tsx` - Added route
3. `BanglaTechManager/client/src/components/app-sidebar.tsx` - Added menu item

## Testing

To test the UI:

1. Navigate to `/mcp-server` (or click "MCP Server" in sidebar)
2. You should see the empty state if no server exists
3. Click "Create MCP Server" button
4. Fill in the form and submit
5. The dialog should close and show server status (once backend is implemented)

## Notes

- The frontend is fully implemented and ready
- Backend API endpoints need to be created to make this functional
- Error handling is in place for API failures
- Toast notifications provide user feedback
- All form validation is client-side

