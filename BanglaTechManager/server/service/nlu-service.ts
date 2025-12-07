/**
 * NLU Service
 * Natural Language Understanding: Intent classification and entity extraction
 */

import { AIServiceBase, type AIOperationContext, type AIOperationResult } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";
import { nluResults, type InsertNluResult } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface Intent {
  intent: string;
  confidence: number;
}

export interface Entity {
  type: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface NLUResult {
  id: string;
  primaryIntent?: string;
  intents: Intent[];
  entities: Entity[];
  sentiment?: string;
  sentimentScore?: number;
}

/**
 * NLU Service
 * Note: In production, integrate with OpenAI, Anthropic, or custom NLU models
 */
export class NLUService extends AIServiceBase {
  /**
   * Parse text for intents and entities
   */
  async parseText(
    tenantId: string,
    text: string,
    sourceType: "message" | "transcript" | "call",
    sourceId?: string,
    userId?: string
  ): Promise<NLUResult> {
    await this.validateFeatureAccess(tenantId, "nluEnabled");

    const costCheck = await this.checkCostAndRateLimit(tenantId, 5);
    if (!costCheck.allowed) {
      throw new Error(costCheck.reason);
    }

    const startTime = Date.now();

    // TODO: In production, call actual NLU API
    // Example: OpenAI function calling, or custom NLU model
    const mockResult: NLUResult = {
      id: crypto.randomUUID(),
      primaryIntent: "general_question",
      intents: [
        { intent: "general_question", confidence: 0.85 },
        { intent: "technical_support", confidence: 0.12 },
      ],
      entities: [
        { type: "phone", value: "+1234567890", start: 10, end: 22, confidence: 0.9 },
      ],
      sentiment: "neutral",
      sentimentScore: 0,
    };

    // Store result
    const nluData: InsertNluResult = {
      tenantId,
      sourceType,
      sourceId,
      sourceText: text,
      primaryIntent: mockResult.primaryIntent as any,
      intents: mockResult.intents,
      entities: mockResult.entities,
      sentiment: mockResult.sentiment,
      sentimentScore: mockResult.sentimentScore,
      modelUsed: "gpt-4",
      processingTime: Date.now() - startTime,
    };

    let resultId: string;
    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.nluResults) memStorage.nluResults = new Map();
      resultId = mockResult.id;
      memStorage.nluResults.set(resultId, { id: resultId, ...nluData, createdAt: new Date() });
    } else {
      const [result] = await db.insert(nluResults).values(nluData).returning();
      resultId = result.id;
    }

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "nlu",
        inputRef: sourceId || text.substring(0, 100),
      },
      {
        success: true,
        outputRef: resultId,
        latency: Date.now() - startTime,
        cost: 5,
        confidence: Math.max(...mockResult.intents.map(i => i.confidence)) * 100,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 5);

    return { ...mockResult, id: resultId };
  }

  /**
   * Batch classify messages
   */
  async batchClassify(
    tenantId: string,
    texts: string[],
    userId?: string
  ): Promise<NLUResult[]> {
    const results: NLUResult[] = [];
    for (const text of texts) {
      const result = await this.parseText(tenantId, text, "message", undefined, userId);
      results.push(result);
    }
    return results;
  }
}

