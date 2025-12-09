/**
 * Model Context Protocol (MCP) Server Implementation
 * 
 * MCP Server provides a standardized way for AI assistants to connect
 * to external data sources and tools within the Shohayota CRM system.
 */

import { EventEmitter } from 'events';
import { storage } from '../storage';
import type { AuthenticatedUser } from '../auth';

export interface MCPServerConfig {
  enabled: boolean;
  port?: number;
  host?: string;
  authentication?: {
    type: 'jwt' | 'api_key' | 'none';
    secret?: string;
  };
  resources?: MCPResource[];
  tools?: MCPTool[];
  prompts?: MCPPrompt[];
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
}

export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private server: any = null;
  private connections: Map<string, any> = new Map();
  private tenantContext?: string;
  private user?: AuthenticatedUser;

  constructor(config: MCPServerConfig) {
    super();
    this.config = {
      enabled: false,
      port: 3001,
      host: '0.0.0.0',
      authentication: {
        type: 'jwt',
      },
      resources: [],
      tools: [],
      prompts: [],
      ...config,
    };
  }

  /**
   * Initialize the MCP server with tenant and user context
   */
  async initialize(tenantId?: string, user?: AuthenticatedUser): Promise<void> {
    this.tenantContext = tenantId;
    this.user = user;

    // Load default resources, tools, and prompts
    await this.loadDefaultResources();
    await this.loadDefaultTools();
    await this.loadDefaultPrompts();

    this.emit('initialized', { tenantId, userId: user?.id });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('MCP Server is not enabled in configuration');
    }

    if (this.server) {
      throw new Error('MCP Server is already running');
    }

    // In a real implementation, you would set up a WebSocket or HTTP server here
    // For now, we'll create a service that can be called via HTTP endpoints
    
    this.server = {
      running: true,
      port: this.config.port,
      host: this.config.host,
    };

    this.emit('started', {
      port: this.config.port,
      host: this.config.host,
    });

    console.log(`[MCP Server] Started on ${this.config.host}:${this.config.port}`);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Close all connections
    for (const [id, connection] of this.connections.entries()) {
      try {
        await this.closeConnection(id);
      } catch (error) {
        console.error(`[MCP Server] Error closing connection ${id}:`, error);
      }
    }

    this.server = null;
    this.emit('stopped');
    console.log('[MCP Server] Stopped');
  }

  /**
   * Handle MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      // Validate request
      if (request.jsonrpc !== '2.0') {
        return this.createErrorResponse(request.id, -32600, 'Invalid Request');
      }

      // Route to appropriate handler
      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(request);
        case 'resources/list':
          return await this.handleListResources(request);
        case 'resources/read':
          return await this.handleReadResource(request);
        case 'tools/list':
          return await this.handleListTools(request);
        case 'tools/call':
          return await this.handleCallTool(request);
        case 'prompts/list':
          return await this.handleListPrompts(request);
        case 'prompts/get':
          return await this.handleGetPrompt(request);
        default:
          return this.createErrorResponse(request.id, -32601, 'Method not found');
      }
    } catch (error: any) {
      return this.createErrorResponse(
        request.id,
        -32603,
        'Internal error',
        error.message
      );
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(request: MCPRequest): Promise<MCPResponse> {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
        serverInfo: {
          name: 'shohayota-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  /**
   * Handle list resources request
   */
  private async handleListResources(request: MCPRequest): Promise<MCPResponse> {
    const resources = this.config.resources || [];
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: resources.map(r => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        })),
      },
    };
  }

  /**
   * Handle read resource request
   */
  private async handleReadResource(request: MCPRequest): Promise<MCPResponse> {
    const uri = request.params?.uri as string;
    
    if (!uri) {
      return this.createErrorResponse(request.id, -32602, 'Invalid params: uri required');
    }

    const resource = this.config.resources?.find(r => r.uri === uri);
    
    if (!resource) {
      return this.createErrorResponse(request.id, -32602, 'Resource not found');
    }

    // Load resource content based on URI
    const content = await this.loadResourceContent(uri);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.mimeType || 'text/plain',
            text: content,
          },
        ],
      },
    };
  }

  /**
   * Handle list tools request
   */
  private async handleListTools(request: MCPRequest): Promise<MCPResponse> {
    const tools = this.config.tools || [];
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  /**
   * Handle call tool request
   */
  private async handleCallTool(request: MCPRequest): Promise<MCPResponse> {
    const toolName = request.params?.name as string;
    const arguments_ = request.params?.arguments || {};

    if (!toolName) {
      return this.createErrorResponse(request.id, -32602, 'Invalid params: name required');
    }

    const tool = this.config.tools?.find(t => t.name === toolName);
    
    if (!tool) {
      return this.createErrorResponse(request.id, -32602, 'Tool not found');
    }

    // Execute the tool
    const result = await this.executeTool(toolName, arguments_);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  }

  /**
   * Handle list prompts request
   */
  private async handleListPrompts(request: MCPRequest): Promise<MCPResponse> {
    const prompts = this.config.prompts || [];
    
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        prompts: prompts.map(p => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments || [],
        })),
      },
    };
  }

  /**
   * Handle get prompt request
   */
  private async handleGetPrompt(request: MCPRequest): Promise<MCPResponse> {
    const promptName = request.params?.name as string;
    const arguments_ = request.params?.arguments || {};

    if (!promptName) {
      return this.createErrorResponse(request.id, -32602, 'Invalid params: name required');
    }

    const prompt = this.config.prompts?.find(p => p.name === promptName);
    
    if (!prompt) {
      return this.createErrorResponse(request.id, -32602, 'Prompt not found');
    }

    // Generate prompt content
    const content = await this.generatePromptContent(promptName, arguments_);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        description: prompt.description,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: content,
            },
          },
        ],
      },
    };
  }

  /**
   * Load default resources
   */
  private async loadDefaultResources(): Promise<void> {
    if (!this.tenantContext) return;

    this.config.resources = [
      {
        uri: `shohayota://tenants/${this.tenantContext}/customers`,
        name: 'Customers',
        description: 'List of all customers in the tenant',
        mimeType: 'application/json',
      },
      {
        uri: `shohayota://tenants/${this.tenantContext}/tickets`,
        name: 'Tickets',
        description: 'List of all support tickets',
        mimeType: 'application/json',
      },
      {
        uri: `shohayota://tenants/${this.tenantContext}/analytics`,
        name: 'Analytics',
        description: 'Analytics and metrics for the tenant',
        mimeType: 'application/json',
      },
    ];
  }

  /**
   * Load default tools
   */
  private async loadDefaultTools(): Promise<void> {
    this.config.tools = [
      {
        name: 'search_customers',
        description: 'Search for customers by name, email, or phone number',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_ticket',
        description: 'Get details of a specific ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'string',
              description: 'Ticket ID',
            },
          },
          required: ['ticketId'],
        },
      },
      {
        name: 'create_ticket',
        description: 'Create a new support ticket',
        inputSchema: {
          type: 'object',
          properties: {
            customerId: {
              type: 'string',
              description: 'Customer ID',
            },
            subject: {
              type: 'string',
              description: 'Ticket subject',
            },
            description: {
              type: 'string',
              description: 'Ticket description',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Ticket priority',
            },
          },
          required: ['customerId', 'subject', 'description'],
        },
      },
      {
        name: 'update_ticket_status',
        description: 'Update the status of a ticket',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'string',
              description: 'Ticket ID',
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'resolved', 'closed'],
              description: 'New ticket status',
            },
          },
          required: ['ticketId', 'status'],
        },
      },
    ];
  }

  /**
   * Load default prompts
   */
  private async loadDefaultPrompts(): Promise<void> {
    this.config.prompts = [
      {
        name: 'customer_summary',
        description: 'Generate a summary of customer information',
        arguments: [
          {
            name: 'customerId',
            description: 'Customer ID',
            required: true,
          },
        ],
      },
      {
        name: 'ticket_analysis',
        description: 'Analyze ticket trends and patterns',
        arguments: [
          {
            name: 'timeRange',
            description: 'Time range for analysis (e.g., "last 7 days")',
            required: false,
          },
        ],
      },
    ];
  }

  /**
   * Load resource content
   */
  private async loadResourceContent(uri: string): Promise<string> {
    if (!this.tenantContext) {
      throw new Error('Tenant context not set');
    }

    if (uri.startsWith(`shohayota://tenants/${this.tenantContext}/customers`)) {
      const customers = await storage.getCustomersByTenant(this.tenantContext);
      return JSON.stringify(customers, null, 2);
    }

    if (uri.startsWith(`shohayota://tenants/${this.tenantContext}/tickets`)) {
      const tickets = await storage.getTicketsByTenant(this.tenantContext);
      return JSON.stringify(tickets, null, 2);
    }

    if (uri.startsWith(`shohayota://tenants/${this.tenantContext}/analytics`)) {
      // Return analytics data
      return JSON.stringify({ message: 'Analytics data' }, null, 2);
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  }

  /**
   * Execute a tool
   */
  private async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.tenantContext) {
      throw new Error('Tenant context not set');
    }

    switch (toolName) {
      case 'search_customers':
        const results = await storage.searchCustomers(this.tenantContext, args.query);
        return results.slice(0, args.limit || 10);
      
      case 'get_ticket':
        return await storage.getTicket(args.ticketId, this.tenantContext);
      
      case 'create_ticket':
        return await storage.createTicket({
          tenantId: this.tenantContext,
          customerId: args.customerId,
          subject: args.subject,
          description: args.description,
          priority: args.priority || 'medium',
          status: 'open',
        });
      
      case 'update_ticket_status':
        const ticket = await storage.getTicket(args.ticketId, this.tenantContext);
        if (!ticket) {
          throw new Error('Ticket not found');
        }
        return await storage.updateTicket(args.ticketId, {
          status: args.status,
        });
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Generate prompt content
   */
  private async generatePromptContent(promptName: string, args: Record<string, any>): Promise<string> {
    if (!this.tenantContext) {
      throw new Error('Tenant context not set');
    }

    switch (promptName) {
      case 'customer_summary':
        const customer = await storage.getCustomer(args.customerId, this.tenantContext);
        if (!customer) {
          return `Customer with ID ${args.customerId} not found.`;
        }
        return `Customer Summary:\nName: ${customer.name}\nEmail: ${customer.email}\nPhone: ${customer.phone}\nCreated: ${customer.createdAt}`;
      
      case 'ticket_analysis':
        const tickets = await storage.getTicketsByTenant(this.tenantContext);
        const openTickets = tickets.filter(t => t.status === 'open').length;
        const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;
        return `Ticket Analysis:\nTotal Tickets: ${tickets.length}\nOpen: ${openTickets}\nResolved: ${resolvedTickets}`;
      
      default:
        throw new Error(`Unknown prompt: ${promptName}`);
    }
  }

  /**
   * Close a connection
   */
  private async closeConnection(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (connection) {
      // Close connection logic here
      this.connections.delete(id);
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: any
  ): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MCPServerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPServerConfig {
    return { ...this.config };
  }
}

// Singleton instance
let mcpServerInstance: MCPServer | null = null;

export function getMCPServer(config?: MCPServerConfig): MCPServer {
  if (!mcpServerInstance) {
    if (!config) {
      throw new Error('MCP Server config required for first initialization');
    }
    mcpServerInstance = new MCPServer(config);
  }
  return mcpServerInstance;
}

