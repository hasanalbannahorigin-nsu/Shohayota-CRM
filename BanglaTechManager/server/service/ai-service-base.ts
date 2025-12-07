/**
 * AI Service Base
 * Core infrastructure for AI operations: model management, tenant scoping, audit logging
 */

import { db } from "../db";
import { storage } from "../storage";
import { aiSettings, aiOperationLogs, type AiSettings, type InsertAiOperationLog } from "@shared/schema";
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
   */
  async getTenantSettings(tenantId: string): Promise<AiSettings | null> {
    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      return memStorage.aiSettings?.get(tenantId) || null;
    }

    const [settings] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.tenantId, tenantId))
      .limit(1);

    return settings || null;
  }

  /**
   * Get or create default AI settings for tenant
   */
  async ensureTenantSettings(tenantId: string): Promise<AiSettings> {
    const existing = await this.getTenantSettings(tenantId);
    if (existing) return existing;

    // Create default settings
    const defaultSettings: Partial<AiSettings> = {
      tenantId,
      transcriptionEnabled: false,
      nluEnabled: false,
      botEnabled: false,
      ragEnabled: false,
      nlqEnabled: false,
      assistEnabled: false,
      defaultModelProvider: "openai",
      defaultModelName: "gpt-4",
      embeddingModel: "text-embedding-ada-002",
      allowExternalModels: true,
      piiRedactionEnabled: false,
      consentRequired: false,
      dataRetentionDays: 90,
      rateLimitPerMinute: 60,
      rateLimitPerHour: 1000,
    };

    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      if (!memStorage.aiSettings) memStorage.aiSettings = new Map();
      const settings = { id: crypto.randomUUID(), ...defaultSettings } as AiSettings;
      memStorage.aiSettings.set(tenantId, settings);
      return settings;
    }

    const [settings] = await db
      .insert(aiSettings)
      .values(defaultSettings as any)
      .returning();

    return settings;
  }

  /**
   * Check if feature is enabled for tenant
   */
  async isFeatureEnabled(tenantId: string, feature: keyof AiSettings): Promise<boolean> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings) return false;
    return settings[feature] === true;
  }

  /**
   * Check cost caps and rate limits
   */
  async checkCostAndRateLimit(tenantId: string, estimatedCost: number = 0): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings) {
      return { allowed: false, reason: "AI settings not configured" };
    }

    // Check daily cost cap
    if (settings.dailyCostCap && settings.currentDailyCost + estimatedCost > settings.dailyCostCap) {
      return { allowed: false, reason: "Daily cost cap exceeded" };
    }

    // Check monthly cost cap
    if (settings.monthlyCostCap && settings.currentMonthlyCost + estimatedCost > settings.monthlyCostCap) {
      return { allowed: false, reason: "Monthly cost cap exceeded" };
    }

    // TODO: Implement rate limiting checks (per minute/hour)

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
   */
  async updateCostTracking(tenantId: string, cost: number): Promise<void> {
    if (!db) {
      // In-memory mode - cost tracking would be in settings
      const memStorage = storage as any;
      const settings = memStorage.aiSettings?.get(tenantId);
      if (settings) {
        settings.currentDailyCost = (settings.currentDailyCost || 0) + cost;
        settings.currentMonthlyCost = (settings.currentMonthlyCost || 0) + cost;
      }
      return;
    }

    await db
      .update(aiSettings)
      .set({
        currentDailyCost: sql`current_daily_cost + ${cost}`,
        currentMonthlyCost: sql`current_monthly_cost + ${cost}`,
      })
      .where(eq(aiSettings.tenantId, tenantId));
  }

  /**
   * Get model configuration for tenant
   */
  async getModelConfig(tenantId: string, operationType?: string): Promise<AIModelConfig | null> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings) return null;

    // Check if external models are allowed
    if (!settings.allowExternalModels && settings.defaultModelProvider !== "local") {
      return {
        provider: "local",
        modelName: "local-model",
      };
    }

    return {
      provider: settings.defaultModelProvider as any,
      modelName: settings.defaultModelName,
      // API keys would be stored encrypted in integration credentials
      // For now, return config without keys
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
   */
  async validateFeatureAccess(tenantId: string, feature: keyof AiSettings): Promise<void> {
    const enabled = await this.isFeatureEnabled(tenantId, feature);
    if (!enabled) {
      throw new Error(`AI feature ${feature} is not enabled for this tenant`);
    }
  }
}

