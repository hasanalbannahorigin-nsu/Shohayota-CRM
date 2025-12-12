// server/ai-assistant.ts
import { Request, Response } from 'express';
import { storage } from './storage';
import pool from './db/pool';
import Redis from 'ioredis';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS_PER_REQUEST || 2048);
const AI_TENANT_DAILY_QUOTA = Number(process.env.AI_TENANT_DAILY_QUOTA || 10000);
const AI_RATE_LIMIT_PER_MIN = Number(process.env.AI_RATE_LIMIT_PER_MIN || 5);

// In-memory fallback for rate limiting and quotas if Redis is not available
const memoryStore: {
  rateLimits: Map<string, { count: number; resetAt: number }>;
  quotas: Map<string, number>;
} = {
  rateLimits: new Map(),
  quotas: new Map(),
};

let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    console.log('✅ Redis connected for AI rate limiting');
  } else {
    console.warn('⚠️  Redis not configured - using in-memory rate limits & quotas');
  }
} catch (err) {
  console.warn('⚠️  Redis connection failed - using in-memory fallback:', (err as Error).message);
}

// Get tenant-scoped context using storage layer
async function getTenantContext(tenantId: string, limit = 5) {
  try {
    const [tickets, customers] = await Promise.all([
      storage.getTicketsByTenant(tenantId),
      storage.getCustomersByTenant(tenantId, limit, 0),
    ]);

    // Get recent tickets (limit to most recent)
    const recentTickets = tickets
      .sort((a: any, b: any) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);

    return {
      tickets: recentTickets.map((t: any) => ({
        id: t.id,
        title: t.title || 'Untitled',
        status: t.status || 'unknown',
        priority: t.priority || 'normal',
        updated_at: t.updatedAt || t.createdAt,
      })),
      customers: customers.map((c: any) => ({
        id: c.id,
        name: c.name || 'Unknown',
        email: c.email || '',
        phone: c.phone || '',
      })),
    };
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return { tickets: [], customers: [] };
  }
}

function buildPrompt(userQuery: string, ctx: any, maxChars = 18000) {
  const system = `You are Shohayota CRM AI Assistant. Use ONLY the tenant data provided. 
If unsure, say "I don't know". Suggest next actions when helpful. Be concise and friendly.

This CRM also supports Model Context Protocol (MCP) tools. You can mention that users can access advanced CRM operations through MCP-compatible AI assistants.`;

  const ticketLines = ctx.tickets
    .map((t: any) => `- [${t.id}] ${t.title} (${t.status}, ${t.priority})`)
    .join('\n');
  
  const customerLines = ctx.customers
    .map((c: any) => `- [${c.id}] ${c.name} <${c.email || 'no email'}> ${c.phone || ''}`)
    .join('\n');

  const tenantData = [
    'Tenant Data:',
    `Tickets (${ctx.tickets.length} total):`,
    ticketLines || 'No tickets',
    `\nCustomers (${ctx.customers.length} total):`,
    customerLines || 'No customers',
    '',
  ].join('\n');

  let full = `${system}\n\n${tenantData}\n\nUser Query: ${userQuery}\n\nAssistant Response:`;
  
  if (full.length > maxChars) {
    full = `${system}\n\nTenant Data: (${ctx.tickets.length} tickets, ${ctx.customers.length} customers)\n\nUser Query: ${userQuery}\n\nAssistant Response:`;
  }
  
  return full;
}

// Call Gemini API using correct Google format
async function callGemini(prompt: string, maxTokens = 512): Promise<{ answer: string; raw?: any }> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  // Use Google's Gemini API format
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    },
  };

  try {
    // Use native fetch (Node 18+ has it built-in)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    
    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No text in Gemini response');
    }

    return { answer: text, raw: data };
  } catch (error: any) {
    console.error('Gemini API call failed:', error.message);
    throw error;
  }
}

// Rate limiting with Redis or in-memory fallback
async function tenantRateLimitOk(tenantId: string): Promise<boolean> {
  if (redis) {
    try {
      const key = `ai:rl:${tenantId}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 60);
      }
      return count <= AI_RATE_LIMIT_PER_MIN;
    } catch (err) {
      console.error('Redis rate limit error, falling back to memory:', err);
    }
  }

  // In-memory fallback
  const key = `rl:${tenantId}`;
  const now = Date.now();
  const limit = memoryStore.rateLimits.get(key);

  if (!limit || now > limit.resetAt) {
    memoryStore.rateLimits.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= AI_RATE_LIMIT_PER_MIN) {
    return false;
  }

  limit.count++;
  return true;
}

// Quota management with Redis or in-memory fallback
async function tenantQuotaConsume(tenantId: string, estTokens: number): Promise<boolean> {
  if (redis) {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const key = `ai:quota:${tenantId}:${day}`;
      const used = Number(await redis.get(key) || '0');
      
      if (used + estTokens > AI_TENANT_DAILY_QUOTA) {
        return false;
      }
      
      await redis.incrby(key, estTokens);
      await redis.expire(key, 86400); // 24 hours
      return true;
    } catch (err) {
      console.error('Redis quota error, falling back to memory:', err);
    }
  }

  // In-memory fallback
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${tenantId}:${day}`;
  const used = memoryStore.quotas.get(key) || 0;

  if (used + estTokens > AI_TENANT_DAILY_QUOTA) {
    return false;
  }

  memoryStore.quotas.set(key, used + estTokens);
  return true;
}

// Enhanced rule-based fallback responses
function ruleBasedResponse(query: string, ctx: any): string {
  const lowerQuery = query.toLowerCase();
  
  if (/open tickets?/i.test(lowerQuery)) {
    const openTickets = ctx.tickets.filter((t: any) => t.status === 'open');
    const highPriority = openTickets.filter((t: any) => t.priority === 'high');
    return `📊 You have ${openTickets.length} open tickets. ${highPriority.length} are high priority.`;
  }
  
  if (/customer/i.test(lowerQuery)) {
    return `👥 You have ${ctx.customers.length} customers in your CRM.`;
  }
  
  if (/report|analytics|statistics/i.test(lowerQuery)) {
    const totalTickets = ctx.tickets.length;
    const closedTickets = ctx.tickets.filter((t: any) => t.status === 'closed').length;
    const rate = totalTickets > 0 ? Math.round((closedTickets / totalTickets) * 100) : 0;
    return `📈 Analytics: ${totalTickets} total tickets, ${closedTickets} closed (${rate}% resolution rate).`;
  }
  
  if (/priority|urgent|high/i.test(lowerQuery)) {
    const highPriority = ctx.tickets.filter((t: any) => t.priority === 'high');
    return `🚨 You have ${highPriority.length} high priority tickets.`;
  }
  
  return `I can help you with CRM tasks. You asked: "${query}". Try asking about tickets, customers, or analytics. Type 'help' for more options.`;
}

// Save AI usage log (optional, won't fail if table doesn't exist)
async function saveAiUsageLog(tenantId: string, userId: string | null, prompt: string, result: any) {
  if (!pool) return; // Skip if no database
  
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs (tenant_id, user_id, prompt, result, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [tenantId, userId, prompt, JSON.stringify(result)]
    );
  } catch (e: any) {
    // Ignore if table doesn't exist
    if (!e.message?.includes('does not exist')) {
      console.error('AI usage log failed:', e.message);
    }
  }
}

// Main AI chat handler
export async function handleAiChat(req: Request, res: Response) {
  const user = (req as any).user;
  const tenantId = user?.tenant_id || user?.tenantId;
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant context required' });
  }

  const query = String(req.body.query || req.body.prompt || '').trim();
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  // Check rate limit
  if (!(await tenantRateLimitOk(tenantId))) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a minute.' });
  }

  try {
    // Get tenant context
    const ctx = await getTenantContext(tenantId);
    const prompt = buildPrompt(query, ctx);

    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const estTokens = Math.ceil(prompt.length / 4);
    
    // Check quota
    if (!(await tenantQuotaConsume(tenantId, estTokens))) {
      return res.status(402).json({ error: 'Daily quota exceeded' });
    }

    // Try Gemini first if configured
    if (GEMINI_API_KEY) {
      try {
        const { answer } = await callGemini(prompt, Math.min(1024, Math.floor(AI_MAX_TOKENS / 2)));
        const response = { text: answer, provider: 'gemini' };
        
        await saveAiUsageLog(tenantId, user?.id || null, query, response);
        
        return res.json({ success: true, data: response });
      } catch (err: any) {
        console.error('Gemini failed, using fallback:', err.message);
        // Fall through to rule-based response
      }
    }

    // Fallback to rule-based response
    const ruleText = ruleBasedResponse(query, ctx);
    const response = { text: ruleText, provider: 'rule' };
    
    await saveAiUsageLog(tenantId, user?.id || null, query, response);
    
    return res.json({ success: true, data: response });
  } catch (error: any) {
    console.error('AI handler error:', error);
    
    // Return a helpful error instead of generic "internal error"
    const errorMessage = error.message || 'Internal server error';
    return res.status(500).json({ 
      error: 'Failed to process AI request',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
}
