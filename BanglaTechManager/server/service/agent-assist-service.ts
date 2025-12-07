/**
 * Agent Assist Service
 * Real-time suggestions, summaries, and action extraction for agents
 */

import { AIServiceBase, type AIOperationContext, type AIOperationResult } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";
import { aiSummaries, aiActionSuggestions, type InsertAiSummary, type InsertAiActionSuggestion } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export interface AssistSuggestion {
  type: "reply" | "kb_article" | "tag" | "priority" | "action";
  content: string;
  confidence: number;
  evidence?: Array<{
    type: string;
    id: string;
    text: string;
    relevance: number;
  }>;
  metadata?: Record<string, any>;
}

export interface ConversationSnapshot {
  messages: Array<{
    role: "user" | "agent" | "system";
    content: string;
    timestamp: Date;
  }>;
  ticketId?: string;
  customerId?: string;
  context?: Record<string, any>;
}

/**
 * Agent Assist Service
 * Provides real-time assistance to agents during conversations
 */
export class AgentAssistService extends AIServiceBase {
  /**
   * Get assist suggestions for current conversation
   */
  async getSuggestions(
    tenantId: string,
    snapshot: ConversationSnapshot,
    userId?: string
  ): Promise<AssistSuggestion[]> {
    await this.validateFeatureAccess(tenantId, "assistEnabled");

    const costCheck = await this.checkCostAndRateLimit(tenantId, 5);
    if (!costCheck.allowed) {
      throw new Error(costCheck.reason);
    }

    const startTime = Date.now();

    // TODO: In production, use LLM to generate suggestions
    // For now, return mock suggestions
    const suggestions: AssistSuggestion[] = [
      {
        type: "reply",
        content: "Thank you for contacting us. I'll help you resolve this issue.",
        confidence: 0.85,
      },
      {
        type: "kb_article",
        content: "How to reset password",
        confidence: 0.78,
        evidence: [
          {
            type: "kb_document",
            id: "kb-001",
            text: "To reset your password, go to Settings > Security > Reset Password",
            relevance: 0.9,
          },
        ],
      },
      {
        type: "tag",
        content: "billing",
        confidence: 0.72,
      },
      {
        type: "priority",
        content: "medium",
        confidence: 0.68,
      },
    ];

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "assist",
        inputRef: snapshot.ticketId || snapshot.customerId || "conversation",
      },
      {
        success: true,
        latency: Date.now() - startTime,
        cost: 5,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 5);

    return suggestions;
  }

  /**
   * Generate summary for call or conversation
   */
  async generateSummary(
    tenantId: string,
    sourceType: "call" | "ticket" | "conversation",
    sourceId: string,
    content: string,
    userId?: string
  ): Promise<string> {
    await this.validateFeatureAccess(tenantId, "assistEnabled");

    const startTime = Date.now();

    // TODO: In production, use LLM to generate summary
    const summary = `Summary: ${content.substring(0, 200)}...`;

    // Store summary
    const summaryData: InsertAiSummary = {
      tenantId,
      sourceType,
      sourceId,
      summary,
      actionItems: [],
      modelUsed: "gpt-4",
      confidence: 85,
    };

    let summaryRecordId: string;
    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.aiSummaries) memStorage.aiSummaries = new Map();
      summaryRecordId = crypto.randomUUID();
      memStorage.aiSummaries.set(summaryRecordId, {
        id: summaryRecordId,
        ...summaryData,
        createdAt: new Date(),
      });
    } else {
      const [record] = await db.insert(aiSummaries).values(summaryData).returning();
      summaryRecordId = record.id;
    }

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "summarize",
        inputRef: sourceId,
      },
      {
        success: true,
        outputRef: summaryRecordId,
        latency: Date.now() - startTime,
        cost: 5,
        confidence: 85,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 5);

    return summary;
  }

  /**
   * Extract actionable tasks from text
   */
  async extractActions(
    tenantId: string,
    sourceType: string,
    sourceId: string,
    text: string,
    userId?: string
  ): Promise<Array<{ type: string; parameters: Record<string, any>; confidence: number }>> {
    await this.validateFeatureAccess(tenantId, "assistEnabled");

    const startTime = Date.now();

    // TODO: In production, use LLM to extract actions
    const actions = [
      {
        type: "create_ticket",
        parameters: {
          title: "Customer inquiry",
          priority: "medium",
        },
        confidence: 0.8,
      },
    ];

    // Store action suggestions
    for (const action of actions) {
      const actionData: InsertAiActionSuggestion = {
        tenantId,
        sourceType,
        sourceId,
        actionType: action.type,
        parameters: action.parameters,
        description: `Suggested action: ${action.type}`,
        confidence: Math.round(action.confidence * 100),
        modelUsed: "gpt-4",
      };

      if (!db) {
        const memStorage = storage as any;
        if (!memStorage.aiActionSuggestions) memStorage.aiActionSuggestions = new Map();
        const id = crypto.randomUUID();
        memStorage.aiActionSuggestions.set(id, {
          id,
          ...actionData,
          status: "suggested",
          createdAt: new Date(),
        });
      } else {
        await db.insert(aiActionSuggestions).values(actionData);
      }
    }

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "action_extraction",
        inputRef: sourceId,
      },
      {
        success: true,
        latency: Date.now() - startTime,
        cost: 5,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 5);

    return actions;
  }

  /**
   * Get summary by source
   */
  async getSummary(sourceType: string, sourceId: string, tenantId: string): Promise<any | null> {
    if (!db) {
      const memStorage = storage as any;
      return Array.from(memStorage.aiSummaries?.values() || []).find(
        (s: any) => s.sourceType === sourceType && s.sourceId === sourceId && s.tenantId === tenantId
      ) || null;
    }

    const [summary] = await db
      .select()
      .from(aiSummaries)
      .where(
        and(
          eq(aiSummaries.tenantId, tenantId),
          eq(aiSummaries.sourceType, sourceType),
          eq(aiSummaries.sourceId, sourceId)
        )
      )
      .limit(1);

    return summary || null;
  }

  /**
   * Accept action suggestion
   */
  async acceptAction(actionId: string, tenantId: string, userId: string): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const action = memStorage.aiActionSuggestions?.get(actionId);
      if (action && action.tenantId === tenantId) {
        action.status = "accepted";
        action.acceptedBy = userId;
        action.acceptedAt = new Date();
      }
      return;
    }

    await db
      .update(aiActionSuggestions)
      .set({
        status: "accepted",
        acceptedBy: userId,
        acceptedAt: new Date(),
      })
      .where(eq(aiActionSuggestions.id, actionId));
  }
}

