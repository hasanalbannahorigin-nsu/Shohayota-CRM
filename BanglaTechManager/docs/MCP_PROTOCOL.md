# Model Context Protocol (MCP) Integration

The Shohayota CRM now supports **Model Context Protocol (MCP)**, enabling AI assistants to interact with your CRM data and perform actions through standardized tools.

## What is MCP?

Model Context Protocol (MCP) is an open protocol that allows AI assistants to securely access external tools and data sources. With MCP, AI assistants can:

- Retrieve customer information
- Search and create tickets
- Access CRM analytics
- Perform actions on your behalf

## Available MCP Tools

### 1. **get_customer**
Get customer information by ID or email.

**Parameters:**
- `customerId` (string, optional): Customer ID
- `email` (string, optional): Customer email

**Example:**
```json
{
  "name": "get_customer",
  "arguments": {
    "email": "customer@example.com"
  }
}
```

### 2. **search_customers**
Search customers by name, email, or phone.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 10)

### 3. **get_ticket**
Get ticket details by ID.

**Parameters:**
- `ticketId` (string, required): Ticket ID

### 4. **search_tickets**
Search tickets with filters.

**Parameters:**
- `status` (string, optional): 'open', 'in_progress', or 'closed'
- `priority` (string, optional): 'low', 'medium', or 'high'
- `query` (string, optional): Keyword search
- `limit` (number, optional): Max results (default: 20)

### 5. **create_ticket**
Create a new support ticket.

**Parameters:**
- `customerId` (string, required): Customer ID
- `title` (string, required): Ticket title
- `description` (string, required): Ticket description
- `priority` (string, optional): 'low', 'medium', or 'high' (default: 'medium')
- `category` (string, optional): 'bug', 'feature', or 'support'

### 6. **update_ticket**
Update ticket status or priority.

**Parameters:**
- `ticketId` (string, required): Ticket ID
- `status` (string, optional): New status
- `priority` (string, optional): New priority

### 7. **get_analytics**
Get CRM analytics and metrics.

**Parameters:**
- `period` (string, optional): 'today', 'week', 'month', or 'all' (default: 'all')

### 8. **list_customers**
List all customers with pagination.

**Parameters:**
- `limit` (number, optional): Max results (default: 50)
- `offset` (number, optional): Skip results (default: 0)

### 9. **list_tickets**
List all tickets with optional filtering.

**Parameters:**
- `status` (string, optional): Filter by status
- `limit` (number, optional): Max results (default: 50)

## API Endpoints

### List Tools
```http
GET /api/mcp/tools
Authorization: Bearer <JWT_TOKEN>
```

Returns all available MCP tools with their schemas.

### Call Tool
```http
POST /api/mcp/tools/call
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "get_customer",
  "arguments": {
    "email": "customer@example.com"
  }
}
```

### Health Check
```http
GET /api/mcp/health
```

Returns MCP server status.

## Integration with AI Assistants

### Using with Claude Desktop

1. Add to Claude Desktop configuration:
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

### Using with ChatGPT/GPT-4

1. Configure custom action/function calling with these tool definitions
2. Use the `/api/mcp/tools/call` endpoint
3. Include JWT token in Authorization header

## Security

- All MCP endpoints require authentication (JWT token)
- Tenant isolation is enforced - users can only access their tenant's data
- Rate limiting applies to prevent abuse

## Example Usage

### Get Customer Info
```bash
curl -X POST http://localhost:5000/api/mcp/tools/call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_customer",
    "arguments": {
      "email": "rahim.khan1@company.com"
    }
  }'
```

### Create Ticket
```bash
curl -X POST http://localhost:5000/api/mcp/tools/call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_ticket",
    "arguments": {
      "customerId": "customer-id-here",
      "title": "Need help with login",
      "description": "Customer cannot log in to the portal",
      "priority": "high",
      "category": "support"
    }
  }'
```

### Get Analytics
```bash
curl -X POST http://localhost:5000/api/mcp/tools/call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_analytics",
    "arguments": {
      "period": "week"
    }
  }'
```

## Benefits

✅ **Standardized Interface**: MCP provides a consistent way for AI assistants to interact with your CRM
✅ **Secure**: All operations are authenticated and tenant-isolated
✅ **Extensible**: Easy to add new tools as needed
✅ **AI-Ready**: Works with Claude, ChatGPT, and other MCP-compatible assistants

## Next Steps

1. Get your JWT token by logging into the CRM
2. Use the MCP endpoints with your AI assistant
3. Explore the available tools and integrate them into your workflows

For more information, visit: https://modelcontextprotocol.io/

