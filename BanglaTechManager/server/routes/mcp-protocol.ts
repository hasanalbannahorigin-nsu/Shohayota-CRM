/**
 * MCP Protocol HTTP endpoints
 * Exposes MCP-compatible tools via HTTP for AI assistants
 */

import { Express } from 'express';
import { authenticate } from '../auth';
import { listMcpTools, callMcpTool } from '../mcp-handlers';

/**
 * Register MCP Protocol routes
 */
export function registerMcpProtocolRoutes(app: Express) {
  // List available MCP tools
  app.get('/api/mcp/tools', authenticate, listMcpTools);

  // Call an MCP tool
  app.post('/api/mcp/tools/call', authenticate, callMcpTool);

  // Health check
  app.get('/api/mcp/health', (req, res) => {
    res.json({ status: 'ok', protocol: 'mcp', version: '1.0.0', server: 'shohayota-crm' });
  });
}

