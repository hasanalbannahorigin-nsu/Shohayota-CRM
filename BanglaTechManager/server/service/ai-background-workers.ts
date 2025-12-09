/**
 * AI Background Workers
 * Handles async tasks: transcription, embedding, RAG generation, cleanup
 */

import { TranscriptionService } from "./transcription-service";
import { db } from "../db";
import { storage } from "../storage";
import { transcripts } from "@shared/schema";
import { eq, lt, and } from "drizzle-orm";

const transcriptionService = new TranscriptionService();

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
   * NOTE: KB feature removed - this function is disabled
   */
  async processEmbeddingJobs(): Promise<void> {
    // KB feature removed - no-op
    return;
  }

  /**
   * Reset daily cost tracking (run daily)
   * NOTE: AI Settings feature removed - this function is disabled
   */
  async resetDailyCosts(): Promise<void> {
    // AI Settings feature removed - no-op
    return;
  }

  /**
   * Cleanup old AI artifacts based on retention policy
   * NOTE: AI Settings feature removed - simplified cleanup
   */
  async cleanupOldArtifacts(): Promise<void> {
    if (!db) return;

    // Simple cleanup: delete transcripts older than 90 days
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old transcripts for all tenants
    await db
      .delete(transcripts)
      .where(lt(transcripts.createdAt, cutoffDate));
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

