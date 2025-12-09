/**
 * AI Service Base
 * Core infrastructure for AI operations: model management, tenant scoping, audit logging
 */

import { db } from "../db";
import { storage } from "../storage";
import { aiOperationLogs, type InsertAiOperationLog } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

export interface AIModelConfig {
  provider: "openai" | "anthropic" | "azure" | "local" | "custom";
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIOperationContext {
  tenantId: string;
  userId?: string;
  operationType: string;
  inputRef?: string;
  promptTemplate?: string;
}

export interface AIOperationResult {
  success: boolean;
  outputRef?: string;
  data?: any;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  latency?: number;
  confidence?: number;
}

/**
 * Base AI Service with tenant scoping, audit logging, and cost control
 */
export class AIServiceBase {
  /**
   * Get tenant AI settings
   * NOTE: AI Settings feature removed - returns null
   */
  async getTenantSettings(tenantId: string): Promise<null> {
    return null;
  }

  /**
   * Get or create default AI settings for tenant
   * NOTE: AI Settings feature removed - returns null
   */
  async ensureTenantSettings(tenantId: string): Promise<null> {
    return null;
  }

  /**
   * Check if feature is enabled for tenant
   * NOTE: AI Settings feature removed - always returns true
   */
  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    return true; // All features enabled by default
  }

  /**
   * Check cost caps and rate limits
   * NOTE: AI Settings feature removed - always allows
   */
  async checkCostAndRateLimit(tenantId: string, estimatedCost: number = 0): Promise<{ allowed: boolean; reason?: string }> {
    return { allowed: true };
  }

  /**
   * Record AI operation in audit log
   */
  async logAIOperation(
    context: AIOperationContext,
    result: AIOperationResult,
    modelConfig?: AIModelConfig
  ): Promise<string> {
    const logEntry: InsertAiOperationLog = {
      tenantId: context.tenantId,
      userId: context.userId,
      operationType: context.operationType,
      inputRef: context.inputRef,
      outputRef: result.outputRef,
      modelProvider: modelConfig?.provider,
      modelName: modelConfig?.modelName,
      promptTemplate: context.promptTemplate,
      promptHash: context.promptTemplate ? this.hashString(context.promptTemplate) : undefined,
      inputHash: context.inputRef ? this.hashString(context.inputRef) : undefined,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      latency: result.latency,
      confidence: result.confidence,
      status: result.success ? "completed" : "failed",
      errorMessage: result.error,
    };

    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      if (!memStorage.aiOperationLogs) memStorage.aiOperationLogs = new Map();
      const id = crypto.randomUUID();
      memStorage.aiOperationLogs.set(id, { id, ...logEntry, createdAt: new Date() });
      return id;
    }

    const [log] = await db.insert(aiOperationLogs).values(logEntry).returning();
    return log.id;
  }

  /**
   * Update cost tracking for tenant
   * NOTE: AI Settings feature removed - no-op
   */
  async updateCostTracking(tenantId: string, cost: number): Promise<void> {
    // Cost tracking disabled
    return;
  }

  /**
   * Get model configuration for tenant
   * NOTE: AI Settings feature removed - returns default config
   */
  async getModelConfig(tenantId: string, operationType?: string): Promise<AIModelConfig | null> {
    // Return default OpenAI config
    return {
      provider: "openai",
      modelName: "gpt-4",
    };
  }

  /**
   * Hash string for privacy (SHA-256)
   */
  private hashString(input: string): string {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  /**
   * Validate tenant has feature enabled
   * NOTE: AI Settings feature removed - always allows
   */
  async validateFeatureAccess(tenantId: string, feature: string): Promise<void> {
    // All features enabled by default
    return;
  }
}

