# Where is MCP Used? - Complete Guide

## 📍 MCP Implementation Locations

### 1. **API Endpoints** (Server-Side)

MCP is exposed via HTTP endpoints in your CRM:

**File:** `server/routes/mcp-protocol.ts`
- `GET /api/mcp/tools` - List all available MCP tools
- `POST /api/mcp/tools/call` - Execute an MCP tool
- `GET /api/mcp/health` - Health check

**Registered in:** `server/routes.ts` (line 721)
```typescript
registerMcpProtocolRoutes(app);
```

### 2. **MCP Server Implementation**

**File:** `server/mcp-server.ts`
- Core MCP server logic using `@modelcontextprotocol/sdk`
- Defines available tools and resources
- Handles MCP protocol requests

**File:** `server/mcp-handlers.ts`
- Implements the actual logic for each MCP tool:
  - `get_customer`
  - `search_customers`
  - `get_ticket`
  - `search_tickets`
  - `create_ticket`
  - `update_ticket`
  - `add_ticket_message`
  - `get_analytics`
  - `list_customers`
  - `list_tickets`

### 3. **AI Assistant Integration**

**File:** `server/ai-assistant.ts` (line 73-76)
- The AI Assistant mentions MCP tools in its system prompt
- Users are informed that they can access advanced CRM operations through MCP

```typescript
"This CRM also supports Model Context Protocol (MCP) tools. 
You can mention that users can access advanced CRM operations 
through MCP-compatible AI assistants."
```

---

## 🔗 How to Access MCP

### Option 1: Direct API Calls (Programmatic)

#### **1. List Available Tools**
```bash
curl -X GET http://localhost:5000/api/mcp/tools \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### **2. Call an MCP Tool**
```bash
curl -X POST http://localhost:5000/api/mcp/tools/call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_customer",
    "arguments": {
      "email": "customer@example.com"
    }
  }'
```

### Option 2: JavaScript/TypeScript Client

See example in: `examples/mcp-client-example.ts`

```typescript
import { listMcpTools, callMcpTool } from './examples/mcp-client-example';

// List tools
const tools = await listMcpTools();

// Call a tool
const result = await callMcpTool('get_customer', {
  email: 'customer@example.com'
});
```

### Option 3: External AI Assistants

MCP can be used with:
- **Claude Desktop** - Add MCP server to configuration
- **ChatGPT/GPT-4** - Use function calling with MCP tools
- **Custom AI Assistants** - Integrate via HTTP endpoints

**Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "shohayota-crm": {
      "command": "node",
      "args": ["path/to/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:5000",
        "API_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

---

## 🎯 Use Cases

### 1. **Internal AI Assistant**
- Location: `/ai-assistant-final` page
- The Gemini-powered AI assistant mentions MCP tools are available
- Users can interact through the web UI

### 2. **External AI Assistants**
- Claude Desktop, ChatGPT, or custom AI assistants
- Can call MCP tools directly via HTTP endpoints
- Full CRM functionality available through MCP

### 3. **API Integration**
- Third-party applications
- Automated workflows
- Scripts and automation tools

---

## 🔐 Authentication

All MCP endpoints require:
1. **JWT Token** - Get from login: `POST /api/auth/login`
2. **Tenant Context** - Automatically extracted from JWT
3. **Permission** - User must have appropriate role

---

## 📋 Available MCP Tools

1. **get_customer** - Get customer by ID or email
2. **search_customers** - Search customers
3. **get_ticket** - Get ticket details
4. **search_tickets** - Search tickets with filters
5. **create_ticket** - Create new ticket
6. **update_ticket** - Update ticket status/priority
7. **add_ticket_message** - Add message to ticket
8. **get_analytics** - Get CRM analytics
9. **list_customers** - List customers with pagination
10. **list_tickets** - List tickets with filtering

---

## 🧪 Testing MCP

### Quick Test (Postman/curl)

1. **Login to get JWT token:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dhakatech.com",
    "password": "demo123"
  }'
```

2. **Use the token to list MCP tools:**
```bash
curl -X GET http://localhost:5000/api/mcp/tools \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_FROM_STEP_1"
```

3. **Call a tool:**
```bash
curl -X POST http://localhost:5000/api/mcp/tools/call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_analytics",
    "arguments": {}
  }'
```

---

## 📚 Documentation Files

- **`docs/MCP_PROTOCOL.md`** - Full MCP protocol documentation
- **`examples/mcp-client-example.ts`** - Code examples
- **`tests/mcp-protocol.test.ts`** - Test cases
- **`MCP_IMPLEMENTATION_SUMMARY.md`** - Implementation summary

---

## 🔍 Summary

**MCP is used in:**
1. ✅ **API Endpoints** - `/api/mcp/*` routes
2. ✅ **Server Handlers** - `server/mcp-handlers.ts`
3. ✅ **AI Assistant** - Mentioned in AI prompts
4. ✅ **External Integrations** - Available for Claude, ChatGPT, etc.

**Access Points:**
- 🌐 Web UI: Not directly visible, but AI mentions it
- 🔌 API: `/api/mcp/tools` and `/api/mcp/tools/call`
- 🤖 AI Assistants: External MCP-compatible assistants
- 💻 Code: See `examples/mcp-client-example.ts`

**Current Status:** ✅ Fully Implemented and Ready to Use

---

For detailed API documentation, see: `docs/MCP_PROTOCOL.md`

