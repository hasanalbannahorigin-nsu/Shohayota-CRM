/**
 * Model Context Protocol (MCP) Server for CRM
 * Exposes CRM data and tools to AI assistants via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { storage } from './storage';
import { z } from 'zod';

// MCP Server instance
let mcpServer: Server | null = null;

// Store tenant context (set via middleware)
const tenantContexts = new Map<string, { tenantId: string; userId: string; role: string }>();

/**
 * Initialize MCP Server
 */
export function initMcpServer() {
  if (mcpServer) {
    return mcpServer;
  }

  mcpServer = new Server(
    {
      name: 'shohayota-crm-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // List available tools
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_customer',
          description: 'Get customer information by ID or email. Returns customer details including name, email, phone, status, and associated tickets.',
          inputSchema: {
            type: 'object',
            properties: {
              customerId: {
                type: 'string',
                description: 'Customer ID',
              },
              email: {
                type: 'string',
                description: 'Customer email address',
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['tenantId'],
            oneOf: [{ required: ['customerId'] }, { required: ['email'] }],
          },
        },
        {
          name: 'search_customers',
          description: 'Search for customers by name, email, or phone. Returns list of matching customers.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (name, email, or phone)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)',
                default: 10,
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['query', 'tenantId'],
          },
        },
        {
          name: 'get_ticket',
          description: 'Get ticket information by ID. Returns ticket details including status, priority, customer, and messages.',
          inputSchema: {
            type: 'object',
            properties: {
              ticketId: {
                type: 'string',
                description: 'Ticket ID',
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['ticketId', 'tenantId'],
          },
        },
        {
          name: 'search_tickets',
          description: 'Search for tickets by status, priority, customer, or keyword. Returns list of matching tickets.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['open', 'in_progress', 'closed'],
                description: 'Filter by ticket status',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Filter by ticket priority',
              },
              customerId: {
                type: 'string',
                description: 'Filter by customer ID',
              },
              query: {
                type: 'string',
                description: 'Search query (searches in title and description)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 20)',
                default: 20,
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['tenantId'],
          },
        },
        {
          name: 'create_ticket',
          description: 'Create a new support ticket. Returns the created ticket with ID.',
          inputSchema: {
            type: 'object',
            properties: {
              customerId: {
                type: 'string',
                description: 'Customer ID',
              },
              title: {
                type: 'string',
                description: 'Ticket title',
              },
              description: {
                type: 'string',
                description: 'Ticket description',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Ticket priority (default: medium)',
                default: 'medium',
              },
              category: {
                type: 'string',
                enum: ['bug', 'feature', 'support'],
                description: 'Ticket category',
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
              userId: {
                type: 'string',
                description: 'User ID creating the ticket',
              },
            },
            required: ['customerId', 'title', 'description', 'tenantId', 'userId'],
          },
        },
        {
          name: 'update_ticket',
          description: 'Update an existing ticket. Can update status, priority, assignee, etc.',
          inputSchema: {
            type: 'object',
            properties: {
              ticketId: {
                type: 'string',
                description: 'Ticket ID',
              },
              status: {
                type: 'string',
                enum: ['open', 'in_progress', 'closed'],
                description: 'New ticket status',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'New ticket priority',
              },
              assigneeId: {
                type: 'string',
                description: 'User ID to assign ticket to',
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['ticketId', 'tenantId'],
          },
        },
        {
          name: 'add_ticket_message',
          description: 'Add a message/comment to a ticket. Returns the created message.',
          inputSchema: {
            type: 'object',
            properties: {
              ticketId: {
                type: 'string',
                description: 'Ticket ID',
              },
              body: {
                type: 'string',
                description: 'Message content',
              },
              authorId: {
                type: 'string',
                description: 'User ID of the message author',
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['ticketId', 'body', 'authorId', 'tenantId'],
          },
        },
        {
          name: 'get_analytics',
          description: 'Get CRM analytics including ticket statistics, customer counts, and performance metrics.',
          inputSchema: {
            type: 'object',
            properties: {
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
              period: {
                type: 'string',
                enum: ['today', 'week', 'month', 'all'],
                description: 'Time period for analytics (default: all)',
                default: 'all',
              },
            },
            required: ['tenantId'],
          },
        },
        {
          name: 'list_customers',
          description: 'List all customers for a tenant. Supports pagination.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 50)',
                default: 50,
              },
              offset: {
                type: 'number',
                description: 'Number of results to skip (default: 0)',
                default: 0,
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['tenantId'],
          },
        },
        {
          name: 'list_tickets',
          description: 'List all tickets for a tenant. Supports pagination and filtering.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['open', 'in_progress', 'closed'],
                description: 'Filter by status',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 50)',
                default: 50,
              },
              tenantId: {
                type: 'string',
                description: 'Tenant ID (required for authentication)',
              },
            },
            required: ['tenantId'],
          },
        },
      ],
    };
  });

  // List available resources
  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'crm://customers',
          name: 'Customers',
          description: 'List of all customers in the CRM',
          mimeType: 'application/json',
        },
        {
          uri: 'crm://tickets',
          name: 'Tickets',
          description: 'List of all tickets in the CRM',
          mimeType: 'application/json',
        },
        {
          uri: 'crm://analytics',
          name: 'Analytics',
          description: 'CRM analytics and metrics',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Read resource
  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const context = getContextFromUri(uri);
    
    if (!context) {
      throw new Error('Tenant context required. Use set_tenant_context first.');
    }

    try {
      if (uri === 'crm://customers') {
        const customers = await storage.getCustomersByTenant(context.tenantId, 100, 0);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(customers, null, 2),
            },
          ],
        };
      } else if (uri === 'crm://tickets') {
        const tickets = await storage.getTicketsByTenant(context.tenantId);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(tickets, null, 2),
            },
          ],
        };
      } else if (uri === 'crm://analytics') {
        const analytics = await getAnalytics(context.tenantId);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(analytics, null, 2),
            },
          ],
        };
      }
      throw new Error(`Unknown resource: ${uri}`);
    } catch (error: any) {
      throw new Error(`Failed to read resource: ${error.message}`);
    }
  });

  // Handle tool calls
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tenantId = (args as any)?.tenantId;
    const userId = (args as any)?.userId;

    if (!tenantId) {
      throw new Error('tenantId is required for all tool calls');
    }

    try {
      switch (name) {
        case 'get_customer': {
          const { customerId, email } = args as any;
          let customer;
          if (customerId) {
            customer = await storage.getCustomer(customerId, tenantId);
          } else if (email) {
            customer = await storage.getCustomerByEmail(email);
            if (customer && customer.tenantId !== tenantId) {
              throw new Error('Customer not found in tenant');
            }
          } else {
            throw new Error('Either customerId or email is required');
          }

          if (!customer) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Customer not found' }, null, 2),
                },
              ],
            };
          }

          // Get customer's tickets
          const tickets = await storage.getTicketsByTenant(tenantId);
          const customerTickets = tickets.filter((t: any) => t.customerId === customer.id);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    customer: {
                      id: customer.id,
                      name: customer.name,
                      email: customer.email,
                      phone: customer.phone,
                      status: customer.status,
                    },
                    tickets: customerTickets.length,
                    recentTickets: customerTickets.slice(0, 5).map((t: any) => ({
                      id: t.id,
                      title: t.title,
                      status: t.status,
                      priority: t.priority,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'search_customers': {
          const { query, limit = 10 } = args as any;
          const customers = await storage.searchCustomers(tenantId, query);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(customers.slice(0, limit), null, 2),
              },
            ],
          };
        }

        case 'get_ticket': {
          const { ticketId } = args as any;
          const ticket = await storage.getTicket(ticketId, tenantId);
          if (!ticket) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Ticket not found' }, null, 2),
                },
              ],
            };
          }

          // Get messages for this ticket
          const messages = await storage.getMessagesByTicket(ticketId, tenantId);
          const customer = await storage.getCustomer((ticket as any).customerId, tenantId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    ticket: {
                      id: ticket.id,
                      title: (ticket as any).title,
                      description: (ticket as any).description,
                      status: ticket.status,
                      priority: (ticket as any).priority,
                      category: (ticket as any).category,
                      createdAt: (ticket as any).createdAt,
                    },
                    customer: customer
                      ? {
                          id: customer.id,
                          name: customer.name,
                          email: customer.email,
                        }
                      : null,
                    messages: messages.length,
                    recentMessages: messages.slice(0, 5).map((m: any) => ({
                      id: m.id,
                      body: m.body,
                      createdAt: m.createdAt,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'search_tickets': {
          const {
            status,
            priority,
            customerId,
            query,
            limit = 20,
          } = args as any;
          let tickets = await storage.getTicketsByTenant(tenantId);

          // Apply filters
          if (status) {
            tickets = tickets.filter((t: any) => t.status === status);
          }
          if (priority) {
            tickets = tickets.filter((t: any) => t.priority === priority);
          }
          if (customerId) {
            tickets = tickets.filter((t: any) => t.customerId === customerId);
          }
          if (query) {
            const lowerQuery = query.toLowerCase();
            tickets = tickets.filter(
              (t: any) =>
                t.title?.toLowerCase().includes(lowerQuery) ||
                t.description?.toLowerCase().includes(lowerQuery)
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tickets.slice(0, limit), null, 2),
              },
            ],
          };
        }

        case 'create_ticket': {
          const { customerId, title, description, priority = 'medium', category, userId } = args as any;
          const ticket = await storage.createTicket({
            tenantId,
            customerId,
            title,
            description,
            status: 'open',
            priority,
            category: category || 'support',
            createdBy: userId,
          } as any);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    ticket: {
                      id: ticket.id,
                      title: (ticket as any).title,
                      status: ticket.status,
                      priority: (ticket as any).priority,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'update_ticket': {
          const { ticketId, status, priority, assigneeId } = args as any;
          const updates: any = {};
          if (status) updates.status = status;
          if (priority) updates.priority = priority;
          if (assigneeId) updates.assigneeId = assigneeId;

          const ticket = await storage.updateTicket(ticketId, tenantId, updates);
          if (!ticket) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Ticket not found or update failed' }, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    ticket: {
                      id: ticket.id,
                      status: ticket.status,
                      priority: (ticket as any).priority,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'add_ticket_message': {
          const { ticketId, body, authorId } = args as any;
          const message = await storage.addMessageByUser(tenantId, ticketId, authorId, body);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: {
                      id: message.id,
                      body: (message as any).body,
                      createdAt: (message as any).createdAt,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'get_analytics': {
          const { period = 'all' } = args as any;
          const analytics = await getAnalytics(tenantId, period);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(analytics, null, 2),
              },
            ],
          };
        }

        case 'list_customers': {
          const { limit = 50, offset = 0 } = args as any;
          const customers = await storage.getCustomersByTenant(tenantId, limit, offset);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    count: customers.length,
                    customers: customers.map((c: any) => ({
                      id: c.id,
                      name: c.name,
                      email: c.email,
                      phone: c.phone,
                      status: c.status,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'list_tickets': {
          const { status, limit = 50 } = args as any;
          let tickets = await storage.getTicketsByTenant(tenantId, status);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    count: tickets.length,
                    tickets: tickets.slice(0, limit).map((t: any) => ({
                      id: t.id,
                      title: t.title,
                      status: t.status,
                      priority: t.priority,
                      customerId: t.customerId,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return mcpServer;
}

/**
 * Set tenant context for MCP operations
 */
export function setMcpTenantContext(sessionId: string, tenantId: string, userId: string, role: string) {
  tenantContexts.set(sessionId, { tenantId, userId, role });
}

/**
 * Get tenant context from session
 */
function getContextFromUri(uri: string): { tenantId: string; userId: string; role: string } | null {
  // Extract session from URI or use default
  const match = uri.match(/crm:\/\/([^\/]+)/);
  if (match) {
    const sessionId = match[1];
    return tenantContexts.get(sessionId) || null;
  }
  // Try to get first available context (for single-tenant scenarios)
  const contexts = Array.from(tenantContexts.values());
  return contexts.length > 0 ? contexts[0] : null;
}

/**
 * Get analytics for a tenant
 */
async function getAnalytics(tenantId: string, period: string = 'all'): Promise<any> {
  const tickets = await storage.getTicketsByTenant(tenantId);
  const customers = await storage.getCustomersByTenant(tenantId, 1000, 0);

  const now = new Date();
  let filteredTickets = tickets;

  if (period !== 'all') {
    const cutoff = new Date();
    if (period === 'today') {
      cutoff.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (period === 'month') {
      cutoff.setMonth(cutoff.getMonth() - 1);
    }
    filteredTickets = tickets.filter((t: any) => new Date(t.createdAt) >= cutoff);
  }

  const statusCounts = {
    open: filteredTickets.filter((t: any) => t.status === 'open').length,
    in_progress: filteredTickets.filter((t: any) => t.status === 'in_progress').length,
    closed: filteredTickets.filter((t: any) => t.status === 'closed').length,
  };

  const priorityCounts = {
    high: filteredTickets.filter((t: any) => t.priority === 'high').length,
    medium: filteredTickets.filter((t: any) => t.priority === 'medium').length,
    low: filteredTickets.filter((t: any) => t.priority === 'low').length,
  };

  return {
    period,
    customers: {
      total: customers.length,
      active: customers.filter((c: any) => c.status === 'active').length,
    },
    tickets: {
      total: filteredTickets.length,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      resolutionRate:
        filteredTickets.length > 0
          ? Math.round((statusCounts.closed / filteredTickets.length) * 100)
          : 0,
    },
  };
}

/**
 * Start MCP server (stdio transport for CLI usage)
 */
export async function startMcpServer() {
  const server = initMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('✅ MCP Server started (stdio transport)');
  return server;
}

