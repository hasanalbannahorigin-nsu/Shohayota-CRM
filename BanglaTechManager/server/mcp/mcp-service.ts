/**
 * MCP Server Service
 * 
 * Service layer for managing MCP server instances per tenant
 */

import { storage } from '../storage';
import { getTenantConfig, updateTenantConfig } from '../tenant-config-service';
import { MCPServer, getMCPServer, type MCPServerConfig } from './mcp-server';
import type { AuthenticatedUser } from '../auth';

export interface MCPServerStatus {
  enabled: boolean;
  running: boolean;
  port?: number;
  host?: string;
  tenantId?: string;
  resources: number;
  tools: number;
  prompts: number;
}

export class MCPService {
  private servers: Map<string, MCPServer> = new Map();

  /**
   * Get or create MCP server for a tenant
   */
  async getServerForTenant(tenantId: string, user?: AuthenticatedUser): Promise<MCPServer> {
    if (this.servers.has(tenantId)) {
      return this.servers.get(tenantId)!;
    }

    // Load configuration from database or use defaults
    const config = await this.loadTenantConfig(tenantId);
    
    const server = getMCPServer(config);
    await server.initialize(tenantId, user);
    
    this.servers.set(tenantId, server);
    return server;
  }

  /**
   * Start MCP server for a tenant
   */
  async startServer(tenantId: string, user?: AuthenticatedUser): Promise<void> {
    const server = await this.getServerForTenant(tenantId, user);
    
    const config = server.getConfig();
    if (!config.enabled) {
      throw new Error('MCP Server is not enabled for this tenant');
    }

    await server.start();
    await this.saveTenantConfig(tenantId, config);
  }

  /**
   * Stop MCP server for a tenant
   */
  async stopServer(tenantId: string): Promise<void> {
    const server = this.servers.get(tenantId);
    if (server) {
      await server.stop();
      this.servers.delete(tenantId);
    }
  }

  /**
   * Get server status
   */
  async getServerStatus(tenantId: string): Promise<MCPServerStatus> {
    const server = this.servers.get(tenantId);
    if (!server) {
      return {
        enabled: false,
        running: false,
        resources: 0,
        tools: 0,
        prompts: 0,
      };
    }

    const config = server.getConfig();
    return {
      enabled: config.enabled,
      running: server['server'] !== null,
      port: config.port,
      host: config.host,
      tenantId,
      resources: config.resources?.length || 0,
      tools: config.tools?.length || 0,
      prompts: config.prompts?.length || 0,
    };
  }

  /**
   * Update server configuration
   */
  async updateConfig(tenantId: string, config: Partial<MCPServerConfig>): Promise<void> {
    const server = await this.getServerForTenant(tenantId);
    server.updateConfig(config);
    await this.saveTenantConfig(tenantId, server.getConfig());
  }

  /**
   * Handle MCP request
   */
  async handleRequest(tenantId: string, request: any, user?: AuthenticatedUser): Promise<any> {
    const server = await this.getServerForTenant(tenantId, user);
    return await server.handleRequest(request);
  }

  /**
   * Load tenant configuration from database
   */
  private async loadTenantConfig(tenantId: string): Promise<MCPServerConfig> {
    try {
      const config = await getTenantConfig(tenantId);
      const mcpConfig = (config as any)?.mcpServer as MCPServerConfig | undefined;
      
      if (mcpConfig) {
        return mcpConfig;
      }
    } catch (error) {
      console.error(`[MCP Service] Error loading config for tenant ${tenantId}:`, error);
    }

    // Return default configuration
    return {
      enabled: false,
      port: 3001,
      host: '0.0.0.0',
      authentication: {
        type: 'jwt',
      },
      resources: [],
      tools: [],
      prompts: [],
    };
  }

  /**
   * Save tenant configuration to database
   */
  private async saveTenantConfig(tenantId: string, config: MCPServerConfig): Promise<void> {
    try {
      const tenantConfig = await getTenantConfig(tenantId);
      const userId = 'system'; // In real implementation, pass user ID from context
      await updateTenantConfig(tenantId, {
        ...tenantConfig,
        mcpServer: config as any,
      } as any, userId);
    } catch (error) {
      console.error(`[MCP Service] Error saving config for tenant ${tenantId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const mcpService = new MCPService();

