/**
 * MCP Server Routes
 * 
 * HTTP endpoints for managing and interacting with MCP servers
 */

import type { Express, Request, Response } from 'express';
import { authenticate, requireRole } from '../auth';
import { mcpService } from '../mcp/mcp-service';
import { ensureTenantContext } from '../tenant-isolation-middleware';

export function registerMCPRoutes(app: Express): void {
  const router = app;

  /**
   * POST /api/mcp/request
   * Handle MCP protocol requests
   */
  router.post(
    '/api/mcp/request',
    authenticate,
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const request = req.body;
        const user = (req as any).user;

        const response = await mcpService.handleRequest(tenantId, request, user);
        res.json(response);
      } catch (error: any) {
        console.error('[MCP Routes] Error handling request:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/mcp/status
   * Get MCP server status for current tenant
   */
  router.get(
    '/api/mcp/status',
    authenticate,
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const status = await mcpService.getServerStatus(tenantId);
        res.json(status);
      } catch (error: any) {
        console.error('[MCP Routes] Error getting status:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/mcp/start
   * Start MCP server for current tenant
   */
  router.post(
    '/api/mcp/start',
    authenticate,
    requireRole(['tenant_admin', 'super_admin']),
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const user = (req as any).user;
        await mcpService.startServer(tenantId, user);

        res.json({
          success: true,
          message: 'MCP server started successfully',
        });
      } catch (error: any) {
        console.error('[MCP Routes] Error starting server:', error);
        res.status(500).json({
          error: 'Failed to start MCP server',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /api/mcp/stop
   * Stop MCP server for current tenant
   */
  router.post(
    '/api/mcp/stop',
    authenticate,
    requireRole(['tenant_admin', 'super_admin']),
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        await mcpService.stopServer(tenantId);

        res.json({
          success: true,
          message: 'MCP server stopped successfully',
        });
      } catch (error: any) {
        console.error('[MCP Routes] Error stopping server:', error);
        res.status(500).json({
          error: 'Failed to stop MCP server',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/mcp/config
   * Get MCP server configuration
   */
  router.get(
    '/api/mcp/config',
    authenticate,
    requireRole(['tenant_admin', 'super_admin']),
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const status = await mcpService.getServerStatus(tenantId);
        res.json(status);
      } catch (error: any) {
        console.error('[MCP Routes] Error getting config:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );

  /**
   * PUT /api/mcp/config
   * Update MCP server configuration
   */
  router.put(
    '/api/mcp/config',
    authenticate,
    requireRole(['tenant_admin', 'super_admin']),
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const config = req.body;
        await mcpService.updateConfig(tenantId, config);

        res.json({
          success: true,
          message: 'Configuration updated successfully',
        });
      } catch (error: any) {
        console.error('[MCP Routes] Error updating config:', error);
        res.status(500).json({
          error: 'Failed to update configuration',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/mcp/resources
   * List available MCP resources
   */
  router.get(
    '/api/mcp/resources',
    authenticate,
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const user = (req as any).user;
        const request = {
          jsonrpc: '2.0' as const,
          id: 1,
          method: 'resources/list',
        };

        const response = await mcpService.handleRequest(tenantId, request, user);
        res.json(response.result);
      } catch (error: any) {
        console.error('[MCP Routes] Error listing resources:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/mcp/tools
   * List available MCP tools
   */
  router.get(
    '/api/mcp/tools',
    authenticate,
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const user = (req as any).user;
        const request = {
          jsonrpc: '2.0' as const,
          id: 1,
          method: 'tools/list',
        };

        const response = await mcpService.handleRequest(tenantId, request, user);
        res.json(response.result);
      } catch (error: any) {
        console.error('[MCP Routes] Error listing tools:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /api/mcp/prompts
   * List available MCP prompts
   */
  router.get(
    '/api/mcp/prompts',
    authenticate,
    ensureTenantContext,
    async (req: Request, res: Response) => {
      try {
        const tenantId = (req as any).tenantContext;
        if (!tenantId) {
          return res.status(403).json({ error: 'Tenant context required' });
        }

        const user = (req as any).user;
        const request = {
          jsonrpc: '2.0' as const,
          id: 1,
          method: 'prompts/list',
        };

        const response = await mcpService.handleRequest(tenantId, request, user);
        res.json(response.result);
      } catch (error: any) {
        console.error('[MCP Routes] Error listing prompts:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message,
        });
      }
    }
  );
}

