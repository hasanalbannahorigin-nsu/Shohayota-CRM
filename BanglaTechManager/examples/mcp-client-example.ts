/**
 * Example MCP Client Usage
 * Shows how to use the MCP protocol endpoints with the CRM
 */

// Example: Using MCP tools with fetch API

const API_BASE = 'http://localhost:5000';
const JWT_TOKEN = 'your_jwt_token_here'; // Get this from login

/**
 * List all available MCP tools
 */
async function listMcpTools() {
  const response = await fetch(`${API_BASE}/api/mcp/tools`, {
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
  });
  const data = await response.json();
  console.log('Available MCP Tools:', data.tools.map((t: any) => t.name));
  return data;
}

/**
 * Call an MCP tool
 */
async function callMcpTool(toolName: string, args: any) {
  const response = await fetch(`${API_BASE}/api/mcp/tools/call`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: toolName,
      arguments: args,
    }),
  });
  const data = await response.json();
  return data;
}

/**
 * Example: Get customer information
 */
async function getCustomerExample() {
  const result = await callMcpTool('get_customer', {
    email: 'rahim.khan1@company.com',
  });
  console.log('Customer Info:', result.content[0].text);
  return JSON.parse(result.content[0].text);
}

/**
 * Example: Search tickets
 */
async function searchTicketsExample() {
  const result = await callMcpTool('search_tickets', {
    status: 'open',
    priority: 'high',
    limit: 10,
  });
  console.log('Open High Priority Tickets:', result.content[0].text);
  return JSON.parse(result.content[0].text);
}

/**
 * Example: Create a ticket
 */
async function createTicketExample() {
  const result = await callMcpTool('create_ticket', {
    customerId: 'customer-id-here',
    title: 'Need help with login',
    description: 'Customer cannot access the portal',
    priority: 'high',
    category: 'support',
  });
  console.log('Created Ticket:', result.content[0].text);
  return JSON.parse(result.content[0].text);
}

/**
 * Example: Get analytics
 */
async function getAnalyticsExample() {
  const result = await callMcpTool('get_analytics', {
    period: 'week',
  });
  console.log('CRM Analytics:', result.content[0].text);
  return JSON.parse(result.content[0].text);
}

// Run examples
async function runExamples() {
  try {
    console.log('=== MCP Client Examples ===\n');
    
    // List tools
    await listMcpTools();
    console.log('\n');
    
    // Get analytics
    await getAnalyticsExample();
    console.log('\n');
    
    // Search tickets
    await searchTicketsExample();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run:
// runExamples();

export {
  listMcpTools,
  callMcpTool,
  getCustomerExample,
  searchTicketsExample,
  createTicketExample,
  getAnalyticsExample,
};

