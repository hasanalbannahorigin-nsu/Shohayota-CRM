/**
 * NLQ Service
 * Natural Language Query: Convert natural language to safe database queries
 */

import { AIServiceBase, type AIOperationContext, type AIOperationResult } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";

export interface NLQQueryPlan {
  type: "read" | "write" | "delete";
  description: string;
  sql?: string;
  parameters?: Record<string, any>;
  riskLevel: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}

export interface NLQResult {
  queryPlan: NLQQueryPlan;
  results?: any[];
  executionTime?: number;
  rowCount?: number;
}

/**
 * NLQ Service
 * Converts natural language questions to safe, parameterized queries
 */
export class NLQService extends AIServiceBase {
  /**
   * Parse natural language query
   */
  async parseQuery(
    tenantId: string,
    question: string,
    userId?: string
  ): Promise<NLQQueryPlan> {
    await this.validateFeatureAccess(tenantId, "nlqEnabled");

    const costCheck = await this.checkCostAndRateLimit(tenantId, 5);
    if (!costCheck.allowed) {
      throw new Error(costCheck.reason);
    }

    // TODO: In production, use LLM to parse NL to query plan
    // For now, provide mock parsing

    // Simple keyword-based parsing
    const lowerQuestion = question.toLowerCase();

    let queryPlan: NLQQueryPlan;

    if (lowerQuestion.includes("open tickets") || lowerQuestion.includes("unresolved")) {
      queryPlan = {
        type: "read",
        description: "Get open tickets for tenant",
        sql: "SELECT * FROM tickets WHERE tenant_id = $1 AND status IN ('new', 'open', 'pending')",
        parameters: { tenantId },
        riskLevel: "low",
        requiresConfirmation: false,
      };
    } else if (lowerQuestion.includes("customer") && lowerQuestion.includes("count")) {
      queryPlan = {
        type: "read",
        description: "Count customers for tenant",
        sql: "SELECT COUNT(*) FROM customers WHERE tenant_id = $1",
        parameters: { tenantId },
        riskLevel: "low",
        requiresConfirmation: false,
      };
    } else {
      // Default: ambiguous query
      queryPlan = {
        type: "read",
        description: "Query requires clarification",
        riskLevel: "medium",
        requiresConfirmation: true,
      };
    }

    // Log operation
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "nlq",
        inputRef: question.substring(0, 100),
        promptTemplate: "nlq_parser",
      },
      {
        success: true,
        cost: 5,
      },
      {
        provider: "openai",
        modelName: "gpt-4",
      }
    );

    await this.updateCostTracking(tenantId, 5);

    return queryPlan;
  }

  /**
   * Execute query plan (only for read-only, low-risk queries)
   */
  async executeQuery(
    tenantId: string,
    queryPlan: NLQQueryPlan,
    userId?: string
  ): Promise<NLQResult> {
    // Safety checks
    if (queryPlan.type !== "read") {
      throw new Error("Only read queries are allowed");
    }

    if (queryPlan.riskLevel === "high") {
      throw new Error("High-risk queries require super-admin approval");
    }

    if (queryPlan.requiresConfirmation) {
      throw new Error("Query requires user confirmation");
    }

    if (!queryPlan.sql) {
      throw new Error("No SQL query provided");
    }

    const startTime = Date.now();

    // TODO: In production, execute parameterized query safely
    // For now, return mock results
    const results = [
      { id: "1", title: "Sample Ticket", status: "open" },
      { id: "2", title: "Another Ticket", status: "pending" },
    ];

    const executionTime = Date.now() - startTime;

    // Log execution
    await this.logAIOperation(
      {
        tenantId,
        userId,
        operationType: "nlq_execute",
        inputRef: queryPlan.sql,
      },
      {
        success: true,
        latency: executionTime,
        cost: 1,
      }
    );

    return {
      queryPlan,
      results,
      executionTime,
      rowCount: results.length,
    };
  }

  /**
   * Get clarification prompts for ambiguous queries
   */
  getClarificationPrompts(question: string): string[] {
    // TODO: Generate clarification prompts using LLM
    return [
      "What specific data are you looking for?",
      "Do you want to see tickets, customers, or calls?",
      "What time period are you interested in?",
    ];
  }
}

