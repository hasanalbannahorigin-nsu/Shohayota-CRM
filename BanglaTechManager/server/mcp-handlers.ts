/**
 * MCP (Model Context Protocol) Handlers for CRM
 * Provides CRM data and tools via HTTP endpoints compatible with MCP protocol
 */

import { Request, Response } from 'express';
import { storage } from './storage';

/**
 * List available MCP tools
 */
export async function listMcpTools(req: Request, res: Response) {
  res.json({
    tools: [
      {
        name: 'get_customer',
        description: 'Get customer information by ID or email',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'Customer ID' },
            email: { type: 'string', description: 'Customer email' },
          },
          required: [],
          oneOf: [{ required: ['customerId'] }, { required: ['email'] }],
        },
      },
      {
        name: 'search_customers',
        description: 'Search customers by name, email, or phone',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results', default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_ticket',
        description: 'Get ticket information by ID',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Ticket ID' },
          },
          required: ['ticketId'],
        },
      },
      {
        name: 'search_tickets',
        description: 'Search tickets by status, priority, or keyword',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            query: { type: 'string', description: 'Search keyword' },
            limit: { type: 'number', default: 20 },
          },
        },
      },
      {
        name: 'create_ticket',
        description: 'Create a new support ticket',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
            category: { type: 'string', enum: ['bug', 'feature', 'support'] },
          },
          required: ['customerId', 'title', 'description'],
        },
      },
      {
        name: 'update_ticket',
        description: 'Update ticket status, priority, or assignee',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            status: { type: 'string', enum: ['open', 'in_progress', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
          required: ['ticketId'],
        },
      },
      {
        name: 'get_analytics',
        description: 'Get CRM analytics and metrics',
        inputSchema: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['today', 'week', 'month', 'all'], default: 'all' },
          },
        },
      },
      {
        name: 'list_customers',
        description: 'List all customers with pagination',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
          },
        },
      },
      {
        name: 'list_tickets',
        description: 'List all tickets with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'closed'] },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    ],
  });
}

/**
 * Call an MCP tool
 */
export async function callMcpTool(req: Request, res: Response) {
  const user = (req as any).user;
  const tenantId = user?.tenantId || user?.tenant_id;
  const userId = user?.id;

  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant context required' });
  }

  const { name, arguments: args } = req.body;

  try {
    switch (name) {
      case 'get_customer': {
        const { customerId, email } = args || {};
        let customer;
        if (customerId) {
          customer = await storage.getCustomer(customerId, tenantId);
        } else if (email) {
          customer = (storage as any).getCustomerByEmail?.(email);
          if (customer && customer.tenantId !== tenantId) {
            return res.json({ error: 'Customer not found in tenant' });
          }
        }

        if (!customer) {
          return res.json({ error: 'Customer not found' });
        }

        const tickets = await storage.getTicketsByTenant(tenantId);
        const customerTickets = tickets.filter((t: any) => t.customerId === customer.id);

        return res.json({
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
                  recentTickets: customerTickets.slice(0, 5),
                },
                null,
                2
              ),
            },
          ],
        });
      }

      case 'search_customers': {
        const { query, limit = 10 } = args || {};
        const customers = await storage.searchCustomers(tenantId, query);
        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(customers.slice(0, limit), null, 2),
            },
          ],
        });
      }

      case 'get_ticket': {
        const { ticketId } = args || {};
        const ticket = await storage.getTicket(ticketId, tenantId);
        if (!ticket) {
          return res.json({ error: 'Ticket not found' });
        }

        const messages = await storage.getMessagesByTicket(ticketId, tenantId);
        const customer = await storage.getCustomer((ticket as any).customerId, tenantId);

        return res.json({
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
                  },
                  customer: customer
                    ? { id: customer.id, name: customer.name, email: customer.email }
                    : null,
                  messages: messages.length,
                },
                null,
                2
              ),
            },
          ],
        });
      }

      case 'search_tickets': {
        const { status, priority, query, limit = 20 } = args || {};
        let tickets = await storage.getTicketsByTenant(tenantId);

        if (status) tickets = tickets.filter((t: any) => t.status === status);
        if (priority) tickets = tickets.filter((t: any) => t.priority === priority);
        if (query) {
          const lowerQuery = query.toLowerCase();
          tickets = tickets.filter(
            (t: any) =>
              t.title?.toLowerCase().includes(lowerQuery) ||
              t.description?.toLowerCase().includes(lowerQuery)
          );
        }

        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(tickets.slice(0, limit), null, 2),
            },
          ],
        });
      }

      case 'create_ticket': {
        const { customerId, title, description, priority = 'medium', category } = args || {};
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

        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, ticket: { id: ticket.id, title: (ticket as any).title } }, null, 2),
            },
          ],
        });
      }

      case 'update_ticket': {
        const { ticketId, status, priority } = args || {};
        const updates: any = {};
        if (status) updates.status = status;
        if (priority) updates.priority = priority;

        const ticket = await storage.updateTicket(ticketId, tenantId, updates);
        if (!ticket) {
          return res.json({ error: 'Ticket not found' });
        }

        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, ticket: { id: ticket.id, status: ticket.status } }, null, 2),
            },
          ],
        });
      }

      case 'get_analytics': {
        const { period = 'all' } = args || {};
        const tickets = await storage.getTicketsByTenant(tenantId);
        const customers = await storage.getCustomersByTenant(tenantId, 1000, 0);

        const statusCounts = {
          open: tickets.filter((t: any) => t.status === 'open').length,
          in_progress: tickets.filter((t: any) => t.status === 'in_progress').length,
          closed: tickets.filter((t: any) => t.status === 'closed').length,
        };

        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  period,
                  customers: { total: customers.length },
                  tickets: {
                    total: tickets.length,
                    byStatus: statusCounts,
                    resolutionRate: tickets.length > 0 ? Math.round((statusCounts.closed / tickets.length) * 100) : 0,
                  },
                },
                null,
                2
              ),
            },
          ],
        });
      }

      case 'list_customers': {
        const { limit = 50, offset = 0 } = args || {};
        const customers = await storage.getCustomersByTenant(tenantId, limit, offset);
        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: customers.length, customers }, null, 2),
            },
          ],
        });
      }

      case 'list_tickets': {
        const { status, limit = 50 } = args || {};
        let tickets = await storage.getTicketsByTenant(tenantId, status);
        return res.json({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: tickets.length, tickets: tickets.slice(0, limit) }, null, 2),
            },
          ],
        });
      }

      default:
        return res.status(400).json({ error: `Unknown tool: ${name}` });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

