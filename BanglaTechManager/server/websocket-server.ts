/**
 * WebSocket Server for Live AI Chat
 * Provides real-time communication for AI Assistant
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

const JWT_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  provider?: 'gemini' | 'rule';
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  tenantId: string;
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Map<string, ClientConnection>();

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(httpServer: Server) {
  wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws/ai-chat',
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('🔌 New WebSocket connection attempt');

    // Extract token from query string or headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.id || decoded.userId;
      const tenantId = decoded.tenantId || decoded.tenant_id;

      if (!userId || !tenantId) {
        ws.close(1008, 'Invalid token: missing user or tenant info');
        return;
      }

      // Store client connection
      const connection: ClientConnection = {
        ws,
        userId,
        tenantId,
        isAlive: true,
      };

      clients.set(userId, connection);
      console.log(`✅ WebSocket connected: User ${userId}, Tenant ${tenantId}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'system',
        content: 'Connected to AI Assistant. You can now chat in real-time!',
        timestamp: new Date().toISOString(),
      }));

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'ping') {
            // Heartbeat
            connection.isAlive = true;
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (message.type === 'chat' && message.content) {
            await handleChatMessage(connection, message.content);
          }
        } catch (error: any) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            content: 'Failed to process message',
            timestamp: new Date().toISOString(),
          }));
        }
      });

      // Handle connection close
      ws.on('close', () => {
        clients.delete(userId);
        console.log(`🔌 WebSocket disconnected: User ${userId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(userId);
      });

      // Heartbeat to keep connection alive
      ws.on('pong', () => {
        connection.isAlive = true;
      });

    } catch (error: any) {
      console.error('WebSocket authentication error:', error.message);
      ws.close(1008, 'Authentication failed');
    }
  });

  // Ping all clients every 30 seconds
  const interval = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const client = Array.from(clients.values()).find(c => c.ws === ws);
      if (client) {
        if (!client.isAlive) {
          ws.terminate();
          clients.delete(client.userId);
          return;
        }
        client.isAlive = false;
        ws.ping();
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('✅ WebSocket server initialized on /ws/ai-chat');
  return wss;
}

/**
 * Handle chat message from client
 */
async function handleChatMessage(connection: ClientConnection, userMessage: string) {
  const { ws, userId, tenantId } = connection;

  // Send user message back for confirmation
  ws.send(JSON.stringify({
    id: `msg-${Date.now()}`,
    type: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  }));

  // Send "thinking" indicator
  ws.send(JSON.stringify({
    type: 'system',
    content: 'AI is thinking...',
    timestamp: new Date().toISOString(),
  }));

  try {
    // Call AI assistant directly
    const { storage } = await import('./storage');
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
    
    // Get tenant context
    const tickets = await storage.getTicketsByTenant(tenantId);
    const customers = await storage.getCustomersByTenant(tenantId, 5, 0);
    
    // Build prompt
    const system = `You are Shohayota CRM AI Assistant. Use ONLY the tenant data provided. 
If unsure, say "I don't know". Suggest next actions when helpful. Be concise and friendly.`;
    
    const ticketLines = tickets.slice(0, 5).map((t: any) => 
      `- [${t.id}] ${t.title || 'Untitled'} (${t.status || 'unknown'}, ${t.priority || 'normal'})`
    ).join('\n');
    
    const customerLines = customers.map((c: any) => 
      `- [${c.id}] ${c.name || 'Unknown'} <${c.email || 'no email'}> ${c.phone || ''}`
    ).join('\n');
    
    const prompt = `${system}\n\nTenant Data:\nTickets:\n${ticketLines || 'No tickets'}\n\nCustomers:\n${customerLines || 'No customers'}\n\nUser Query: ${userMessage}\n\nAssistant Response:`;
    
    let aiResponse = '';
    let provider = 'rule';
    
    // Try Gemini first
    if (GEMINI_API_KEY) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
            },
          }),
        });
        
        if (response.ok) {
          const data: any = await response.json();
          aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          provider = 'gemini';
        }
      } catch (err) {
        console.error('Gemini error:', err);
      }
    }
    
    // Fallback to rule-based
    if (!aiResponse) {
      const lowerQuery = userMessage.toLowerCase();
      if (/open tickets?/i.test(lowerQuery)) {
        const openTickets = tickets.filter((t: any) => t.status === 'open');
        aiResponse = `📊 You have ${openTickets.length} open tickets.`;
      } else if (/customer/i.test(lowerQuery)) {
        aiResponse = `👥 You have ${customers.length} customers in your CRM.`;
      } else {
        aiResponse = `I can help you with CRM tasks. You asked: "${userMessage}". Try asking about tickets, customers, or analytics.`;
      }
      provider = 'rule';
    }

    // Send AI response
    ws.send(JSON.stringify({
      id: `ai-${Date.now()}`,
      type: 'ai',
      content: aiResponse,
      provider,
      timestamp: new Date().toISOString(),
    }));

  } catch (error: any) {
    console.error('AI chat error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      content: 'Failed to get AI response. Please try again.',
      timestamp: new Date().toISOString(),
    }));
  }
}

/**
 * Broadcast message to all clients in a tenant
 */
export function broadcastToTenant(tenantId: string, message: any) {
  const tenantClients = Array.from(clients.values()).filter(
    c => c.tenantId === tenantId
  );
  
  tenantClients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Send message to specific user
 */
export function sendToUser(userId: string, message: any) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

