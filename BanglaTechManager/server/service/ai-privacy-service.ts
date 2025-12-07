/**
 * AI Privacy Service
 * Handles PII redaction, consent management, and data retention
 */

import { AIServiceBase } from "./ai-service-base";
import { db } from "../db";
import { storage } from "../storage";
import { aiSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface PIIPattern {
  type: "ssn" | "credit_card" | "phone" | "email" | "ip_address";
  pattern: RegExp;
  replacement: string;
}

/**
 * AI Privacy Service
 * Manages PII redaction and privacy controls
 */
export class AIPrivacyService extends AIServiceBase {
  private piiPatterns: PIIPattern[] = [
    {
      type: "ssn",
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: "[SSN-REDACTED]",
    },
    {
      type: "credit_card",
      pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      replacement: "[CARD-REDACTED]",
    },
    {
      type: "phone",
      pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      replacement: "[PHONE-REDACTED]",
    },
    {
      type: "email",
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: "[EMAIL-REDACTED]",
    },
    {
      type: "ip_address",
      pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
      replacement: "[IP-REDACTED]",
    },
  ];

  /**
   * Redact PII from text
   */
  async redactPII(tenantId: string, text: string): Promise<string> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings?.piiRedactionEnabled) {
      return text; // No redaction if not enabled
    }

    let redacted = text;
    for (const pattern of this.piiPatterns) {
      redacted = redacted.replace(pattern.pattern, pattern.replacement);
    }

    return redacted;
  }

  /**
   * Check if consent is required and given
   */
  async checkConsent(tenantId: string, userId?: string): Promise<{ required: boolean; given: boolean }> {
    const settings = await this.getTenantSettings(tenantId);
    if (!settings) {
      return { required: false, given: false };
    }

    if (!settings.consentRequired) {
      return { required: false, given: true };
    }

    // TODO: In production, check consent records for user
    // For now, assume consent is given if required
    return { required: true, given: true };
  }

  /**
   * Record consent
   */
  async recordConsent(tenantId: string, userId: string, consentGiven: boolean): Promise<void> {
    // TODO: Store consent in database
    // For now, just log it
    console.log(`[Privacy] Consent recorded for tenant ${tenantId}, user ${userId}: ${consentGiven}`);
  }

  /**
   * Purge tenant AI data (for data deletion requests)
   */
  async purgeTenantData(tenantId: string): Promise<void> {
    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      
      // Delete transcripts
      Array.from(memStorage.transcripts?.values() || [])
        .filter((t: any) => t.tenantId === tenantId)
        .forEach((t: any) => memStorage.transcripts.delete(t.id));

      // Delete NLU results
      Array.from(memStorage.nluResults?.values() || [])
        .filter((n: any) => n.tenantId === tenantId)
        .forEach((n: any) => memStorage.nluResults.delete(n.id));

      // Delete bot sessions
      Array.from(memStorage.botSessions?.values() || [])
        .filter((b: any) => b.tenantId === tenantId)
        .forEach((b: any) => memStorage.botSessions.delete(b.id));

      // Delete KB documents
      Array.from(memStorage.kbDocuments?.values() || [])
        .filter((k: any) => k.tenantId === tenantId)
        .forEach((k: any) => memStorage.kbDocuments.delete(k.id));

      // Delete summaries
      Array.from(memStorage.aiSummaries?.values() || [])
        .filter((s: any) => s.tenantId === tenantId)
        .forEach((s: any) => memStorage.aiSummaries.delete(s.id));

      // Delete action suggestions
      Array.from(memStorage.aiActionSuggestions?.values() || [])
        .filter((a: any) => a.tenantId === tenantId)
        .forEach((a: any) => memStorage.aiActionSuggestions.delete(a.id));

      // Delete operation logs
      Array.from(memStorage.aiOperationLogs?.values() || [])
        .filter((l: any) => l.tenantId === tenantId)
        .forEach((l: any) => memStorage.aiOperationLogs.delete(l.id));

      return;
    }

    // Database mode - would use cascade deletes or explicit deletes
    // This is a simplified version
    console.log(`[Privacy] Purging AI data for tenant ${tenantId}`);
    // In production, would delete all AI-related records for tenant
  }

  /**
   * Enable/disable PII redaction
   */
  async setPIIRedaction(tenantId: string, enabled: boolean): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const settings = memStorage.aiSettings?.get(tenantId);
      if (settings) {
        settings.piiRedactionEnabled = enabled;
      }
      return;
    }

    await db
      .update(aiSettings)
      .set({ piiRedactionEnabled: enabled })
      .where(eq(aiSettings.tenantId, tenantId));
  }
}

