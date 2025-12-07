/**
 * AI Background Workers
 * Handles async tasks: transcription, embedding, RAG generation, cleanup
 */

import { TranscriptionService } from "./transcription-service";
import { RAGService } from "./rag-service";
import { AISettingsService } from "./ai-settings-service";
import { db } from "../db";
import { storage } from "../storage";
import { transcripts, kbDocuments, aiSettings } from "@shared/schema";
import { eq, lt } from "drizzle-orm";

const transcriptionService = new TranscriptionService();
const ragService = new RAGService();
const settingsService = new AISettingsService();

/**
 * Background Worker Service
 * Manages async AI tasks
 */
export class AIBackgroundWorkers {
  /**
   * Process transcription job (called by worker)
   */
  async processTranscriptionJob(jobId: string, tenantId: string): Promise<void> {
    // This is handled internally by TranscriptionService
    // Workers would poll for pending jobs and call this
    console.log(`[Worker] Processing transcription job ${jobId} for tenant ${tenantId}`);
  }

  /**
   * Create embeddings for pending documents
   */
  async processEmbeddingJobs(): Promise<void> {
    if (!db) {
      // In-memory mode - would process from storage
      const memStorage = storage as any;
      const pendingDocs = Array.from(memStorage.kbDocuments?.values() || [])
        .filter((d: any) => !d.embedded && !d.deletedAt);

      for (const doc of pendingDocs) {
        try {
          await ragService["createEmbeddings"](doc.id, doc.tenantId, doc.content);
        } catch (error) {
          console.error(`Failed to create embeddings for doc ${doc.id}:`, error);
        }
      }
      return;
    }

    // Find documents that need embedding
    const pendingDocs = await db
      .select()
      .from(kbDocuments)
      .where(eq(kbDocuments.embedded, false));

    for (const doc of pendingDocs) {
      try {
        await ragService["createEmbeddings"](doc.id, doc.tenantId, doc.content);
      } catch (error) {
        console.error(`Failed to create embeddings for doc ${doc.id}:`, error);
      }
    }
  }

  /**
   * Reset daily cost tracking (run daily)
   */
  async resetDailyCosts(): Promise<void> {
    if (!db) {
      // In-memory mode
      const memStorage = storage as any;
      const now = new Date();
      Array.from(memStorage.aiSettings?.values() || []).forEach((settings: any) => {
        const resetDate = new Date(settings.costResetDate || now);
        const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceReset >= 1) {
          settings.currentDailyCost = 0;
          settings.costResetDate = now;
        }
      });
      return;
    }

    // Reset daily costs for all tenants
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await db
      .update(aiSettings)
      .set({
        currentDailyCost: 0,
        costResetDate: new Date(),
      })
      .where(lt(aiSettings.costResetDate, yesterday));
  }

  /**
   * Cleanup old AI artifacts based on retention policy
   */
  async cleanupOldArtifacts(): Promise<void> {
    if (!db) return;

    // Get all tenant settings with retention policies
    const allSettings = await db.select().from(aiSettings);

    for (const settings of allSettings) {
      const retentionDays = settings.dataRetentionDays || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Delete old transcripts
      await db
        .delete(transcripts)
        .where(
          and(
            eq(transcripts.tenantId, settings.tenantId),
            lt(transcripts.createdAt, cutoffDate)
          )
        );

      // Note: Would also cleanup summaries, action suggestions, etc.
      // based on retention policy
    }
  }

  /**
   * Start background workers (call this on server startup)
   */
  startWorkers(): void {
    // Transcription worker - check every 5 seconds
    setInterval(() => {
      // Workers would poll for pending transcription jobs
      // and process them
    }, 5000);

    // Embedding worker - check every 30 seconds
    setInterval(() => {
      this.processEmbeddingJobs().catch(console.error);
    }, 30000);

    // Daily cost reset - run at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyCosts();
      // Then run daily
      setInterval(() => {
        this.resetDailyCosts();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    // Cleanup worker - run daily at 2 AM
    const twoAM = new Date(now);
    twoAM.setHours(2, 0, 0, 0);
    if (twoAM.getTime() < now.getTime()) {
      twoAM.setDate(twoAM.getDate() + 1);
    }
    const msUntilTwoAM = twoAM.getTime() - now.getTime();

    setTimeout(() => {
      this.cleanupOldArtifacts();
      // Then run daily
      setInterval(() => {
        this.cleanupOldArtifacts();
      }, 24 * 60 * 60 * 1000);
    }, msUntilTwoAM);

    console.log("[AI Workers] Background workers started");
  }
}

