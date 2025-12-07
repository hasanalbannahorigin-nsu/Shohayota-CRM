/**
 * Sync Worker Service
 * Handles scheduled and event-driven syncs for integrations
 */

import { db } from "../db";
import { integrations, integrationSyncJobs, type Integration, type InsertIntegrationSyncJob } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getIntegration } from "./connector-manager";
import { getAdapter } from "./adapter-factory";
import { decryptCredentials } from "../encryption-service";
import { updateIntegrationStatus } from "./connector-manager";
import { v4 as uuidv4 } from "uuid";

export interface SyncOptions {
  direction: "inbound" | "outbound" | "bidirectional";
  syncType: "full" | "incremental" | "backfill";
  cursor?: string;
}

/**
 * Create sync job
 */
export async function createSyncJob(
  integrationId: string,
  tenantId: string,
  options: SyncOptions
): Promise<string> {
  const integration = await getIntegration(integrationId, tenantId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const jobData: InsertIntegrationSyncJob = {
    tenantId,
    integrationId,
    connectorId: integration.connectorId,
    direction: options.direction,
    syncType: options.syncType,
    status: "pending",
    syncCursor: options.cursor,
    itemsProcessed: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
  };

  let jobId: string;

  if (db) {
    const inserted = await db
      .insert(integrationSyncJobs)
      .values(jobData)
      .returning();
    
    jobId = inserted[0].id;
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    if (!memStorage.integrationSyncJobs) {
      memStorage.integrationSyncJobs = new Map();
    }
    const job = {
      id: uuidv4(),
      ...jobData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memStorage.integrationSyncJobs.set(job.id, job);
    jobId = job.id;
  }

  // Trigger sync immediately (async)
  processSyncJob(jobId, tenantId).catch((error) => {
    console.error(`Sync job ${jobId} failed:`, error);
  });

  return jobId;
}

/**
 * Process sync job
 */
async function processSyncJob(jobId: string, tenantId: string): Promise<void> {
  let job: any;

  if (db) {
    const jobs = await db
      .select()
      .from(integrationSyncJobs)
      .where(and(
        eq(integrationSyncJobs.id, jobId),
        eq(integrationSyncJobs.tenantId, tenantId)
      ))
      .limit(1);
    
    job = jobs[0];
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    job = memStorage.integrationSyncJobs?.get(jobId);
  }

  if (!job) {
    throw new Error("Sync job not found");
  }

  if (job.status !== "pending") {
    return; // Already processed or cancelled
  }

  // Mark as running
  await updateSyncJobStatus(jobId, tenantId, "running", { startedAt: new Date() });

  try {
    const integration = await getIntegration(job.integrationId, tenantId);
    if (!integration) {
      throw new Error("Integration not found");
    }

    const adapter = getAdapter(job.connectorId);
    if (!adapter) {
      throw new Error(`Adapter not found for connector ${job.connectorId}`);
    }

    // Decrypt credentials
    const credentials = await decryptCredentials(integration.encryptedCredentialsRef, tenantId);

    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsFailed = 0;
    let nextCursor: string | undefined = job.syncCursor;

    // Perform sync based on direction
    if (job.direction === "inbound" || job.direction === "bidirectional") {
      if (adapter.syncInbound) {
        const result = await adapter.syncInbound(credentials, nextCursor);
        
        // Process items (create/update tickets, messages, etc.)
        for (const item of result.items) {
          try {
            await processInboundItem(integration, item, tenantId);
            itemsCreated++;
          } catch (error) {
            console.error("Failed to process inbound item:", error);
            itemsFailed++;
          }
          itemsProcessed++;
        }

        nextCursor = result.nextCursor;
      }
    }

    // Update integration last sync time
    if (db) {
      await db
        .update(integrations)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, job.integrationId));
    }

    // Mark job as completed
    await updateSyncJobStatus(jobId, tenantId, "completed", {
      completedAt: new Date(),
      itemsProcessed,
      itemsCreated,
      itemsUpdated,
      itemsFailed,
      syncCursor: nextCursor,
    });
  } catch (error: any) {
    console.error(`Sync job ${jobId} error:`, error);
    
    await updateSyncJobStatus(jobId, tenantId, "failed", {
      completedAt: new Date(),
      errorMessage: error.message,
    });

    // Update integration error status
    await updateIntegrationStatus(
      job.integrationId,
      tenantId,
      "error",
      error.message
    );
  }
}

/**
 * Process inbound item (create ticket, message, etc.)
 */
async function processInboundItem(
  integration: Integration,
  item: any,
  tenantId: string
): Promise<void> {
  // TODO: Implement item processing based on connector type and mapping
  // For now, just log
  console.log(`Processing inbound item for integration ${integration.id}:`, item);
}

/**
 * Update sync job status
 */
async function updateSyncJobStatus(
  jobId: string,
  tenantId: string,
  status: "running" | "completed" | "failed" | "cancelled",
  updates?: Partial<{
    startedAt: Date;
    completedAt: Date;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsFailed: number;
    errorMessage: string;
    syncCursor: string;
  }>
): Promise<void> {
  if (db) {
    await db
      .update(integrationSyncJobs)
      .set({
        status,
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(integrationSyncJobs.id, jobId),
        eq(integrationSyncJobs.tenantId, tenantId)
      ));
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    const job = memStorage.integrationSyncJobs?.get(jobId);
    if (job && job.tenantId === tenantId) {
      Object.assign(job, { status, ...updates, updatedAt: new Date() });
    }
  }
}

/**
 * Schedule periodic syncs for integrations
 */
export async function schedulePeriodicSyncs(): Promise<void> {
  // Get all active integrations
  let allIntegrations: Integration[] = [];

  if (db) {
    allIntegrations = await db
      .select()
      .from(integrations)
      .where(and(
        eq(integrations.status, "connected"),
        isNull(integrations.deletedAt)
      ));
  } else {
    // In-memory mode
    const memStorage = (global as any).memStorage || {};
    allIntegrations = Array.from(memStorage.integrations?.values() || [])
      .filter((i: any) => i.status === "connected" && !i.deletedAt);
  }

  for (const integration of allIntegrations) {
    const config = integration.config as any;
    const syncSettings = config?.syncSettings;

    if (!syncSettings?.enabled) {
      continue;
    }

    // Check if sync is due (simple time-based check)
    const lastSync = integration.lastSyncAt;
    const now = new Date();
    const syncInterval = syncSettings.frequency || "1h"; // Default 1 hour
    
    if (lastSync) {
      const lastSyncTime = new Date(lastSync).getTime();
      const intervalMs = parseInterval(syncInterval);
      if (now.getTime() - lastSyncTime < intervalMs) {
        continue; // Not due yet
      }
    }

    // Create sync job
    try {
      await createSyncJob(integration.id, integration.tenantId, {
        direction: syncSettings.direction || "inbound",
        syncType: "incremental",
        cursor: syncSettings.lastSyncCursor,
      });
    } catch (error) {
      console.error(`Failed to schedule sync for integration ${integration.id}:`, error);
    }
  }
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 3600000; // Default 1 hour
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 3600000;
  }
}

// Run periodic syncs every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    schedulePeriodicSyncs().catch(console.error);
  }, 5 * 60 * 1000);
}

