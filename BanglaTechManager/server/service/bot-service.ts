/**
 * Bot Service
 * Conversational bot with stateless FAQ and stateful multi-turn flows
 */

import { AIServiceBase, type AIOperationContext, type AIOperationResult } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";
import { botSessions, botMessages, type InsertBotSession, type InsertBotMessage } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { NLUService } from "./nlu-service";

const nluService = new NLUService();

export interface BotResponse {
  message: string;
  suggestedActions?: Array<{
    type: string;
    label: string;
    payload: Record<string, any>;
  }>;
  intent?: string;
  entities?: Record<string, any>;
  handoverToAgent?: boolean;
  handoverReason?: string;
}

export interface BotSessionState {
  id: string;
  state: string;
  slots: Record<string, any>;
  context: Record<string, any>;
}

/**
 * Bot Service
 * Handles conversational flows with FAQ and multi-turn dialogues
 */
export class BotService extends AIServiceBase {
  /**
   * Create bot session
   */
  async createSession(
    tenantId: string,
    options: {
      customerId?: string;
      ticketId?: string;
      channel: string;
      userId?: string;
    }
  ): Promise<string> {
    await this.validateFeatureAccess(tenantId, "botEnabled");

    const sessionData: InsertBotSession = {
      tenantId,
      customerId: options.customerId,
      ticketId: options.ticketId,
      channel: options.channel,
      state: "idle",
      slots: {},
      context: {},
    };

    let sessionId: string;
    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.botSessions) memStorage.botSessions = new Map();
      sessionId = crypto.randomUUID();
      memStorage.botSessions.set(sessionId, {
        id: sessionId,
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      });
    } else {
      const [session] = await db.insert(botSessions).values(sessionData).returning();
      sessionId = session.id;
    }

    return sessionId;
  }

  /**
   * Process bot message
   */
  async processMessage(
    tenantId: string,
    sessionId: string,
    userMessage: string,
    userId?: string
  ): Promise<BotResponse> {
    await this.validateFeatureAccess(tenantId, "botEnabled");

    const startTime = Date.now();

    // Get session
    const session = await this.getSession(sessionId, tenantId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Store user message
    await this.addMessage(sessionId, tenantId, "user", userMessage);

    // Analyze message with NLU
    const nluResult = await nluService.parseText(tenantId, userMessage, "message", undefined, userId);

    // Determine response based on intent and state
    const response = await this.generateResponse(tenantId, session, userMessage, nluResult);

    // Store bot response
    await this.addMessage(sessionId, tenantId, "bot", response.message, {
      intent: response.intent || nluResult.primaryIntent,
      entities: nluResult.entities,
      suggestedActions: response.suggestedActions,
    });

    // Update session state
    await this.updateSession(sessionId, tenantId, {
      state: response.handoverToAgent ? "handover" : session.state,
      slots: { ...session.slots, ...nluResult.entities.reduce((acc, e) => ({ ...acc, [e.type]: e.value }), {}) },
      handoverToAgent: response.handoverToAgent || false,
      handoverReason: response.handoverReason,
    });

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "bot",
        inputRef: sessionId,
      },
      {
        success: true,
        latency: Date.now() - startTime,
        cost: 3,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 3);

    return response;
  }

  /**
   * Generate bot response based on intent and state
   */
  private async generateResponse(
    tenantId: string,
    session: BotSessionState,
    userMessage: string,
    nluResult: any
  ): Promise<BotResponse> {
    // TODO: In production, use actual LLM or rule-based system
    // For now, provide mock responses based on intent

    const intent = nluResult.primaryIntent || "general_question";

    // Simple FAQ responses
    const faqResponses: Record<string, string> = {
      billing_inquiry: "I can help with billing questions. What specific billing issue are you experiencing?",
      password_reset: "I can help you reset your password. Please provide your email address.",
      product_issue: "I understand you're having a product issue. Let me connect you with a support agent.",
      general_question: "I'm here to help! How can I assist you today?",
    };

    const response: BotResponse = {
      message: faqResponses[intent] || faqResponses["general_question"],
      intent,
      entities: nluResult.entities.reduce((acc: any, e: any) => ({ ...acc, [e.type]: e.value }), {}),
    };

    // Check if handover needed
    if (intent === "product_issue" || intent === "complaint") {
      response.handoverToAgent = true;
      response.handoverReason = "Complex issue requiring human agent";
      response.suggestedActions = [
        {
          type: "create_ticket",
          label: "Create Support Ticket",
          payload: {
            intent,
            entities: response.entities,
            customerId: session.context.customerId,
          },
        },
      ];
    } else {
      response.suggestedActions = [
        {
          type: "continue_chat",
          label: "Continue Conversation",
          payload: {},
        },
      ];
    }

    return response;
  }

  /**
   * Get session
   */
  async getSession(sessionId: string, tenantId: string): Promise<BotSessionState | null> {
    if (!db) {
      const memStorage = storage as any;
      const session = memStorage.botSessions?.get(sessionId);
      if (!session || session.tenantId !== tenantId) return null;
      return {
        id: session.id,
        state: session.state,
        slots: session.slots || {},
        context: session.context || {},
      };
    }

    const [session] = await db
      .select()
      .from(botSessions)
      .where(and(eq(botSessions.id, sessionId), eq(botSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) return null;

    return {
      id: session.id,
      state: session.state,
      slots: (session.slots as any) || {},
      context: (session.context as any) || {},
    };
  }

  /**
   * Update session
   */
  private async updateSession(
    sessionId: string,
    tenantId: string,
    updates: Partial<BotSessionState>
  ): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const session = memStorage.botSessions?.get(sessionId);
      if (session && session.tenantId === tenantId) {
        Object.assign(session, updates, { updatedAt: new Date(), lastActivityAt: new Date() });
      }
      return;
    }

    await db
      .update(botSessions)
      .set({
        ...updates,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(and(eq(botSessions.id, sessionId), eq(botSessions.tenantId, tenantId)));
  }

  /**
   * Add message to session
   */
  private async addMessage(
    sessionId: string,
    tenantId: string,
    role: "user" | "bot" | "system",
    content: string,
    metadata?: any
  ): Promise<string> {
    const messageData: InsertBotMessage = {
      sessionId,
      tenantId,
      role,
      content,
      intent: metadata?.intent,
      entities: metadata?.entities || {},
      suggestedActions: metadata?.suggestedActions || [],
    };

    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.botMessages) memStorage.botMessages = new Map();
      const id = crypto.randomUUID();
      memStorage.botMessages.set(id, { id, ...messageData, createdAt: new Date() });
      return id;
    }

    const [message] = await db.insert(botMessages).values(messageData).returning();
    return message.id;
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string, tenantId: string): Promise<any[]> {
    if (!db) {
      const memStorage = storage as any;
      return Array.from(memStorage.botMessages?.values() || [])
        .filter((m: any) => m.sessionId === sessionId && m.tenantId === tenantId)
        .sort((a: any, b: any) => a.createdAt - b.createdAt);
    }

    return await db
      .select()
      .from(botMessages)
      .where(and(eq(botMessages.sessionId, sessionId), eq(botMessages.tenantId, tenantId)))
      .orderBy(botMessages.createdAt);
  }
}

