/**
 * Queue Manager
 * Manages background job queues for webhook processing, connector sync, etc.
 * Uses BullMQ with Redis
 */

import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

// Redis connection
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Queue definitions
export const webhookQueue = new Queue("webhooks", { connection });
export const connectorSyncQueue = new Queue("connector-sync", { connection });
export const automationQueue = new Queue("automations", { connection });

/**
 * Enqueue webhook processing job
 */
export async function enqueueWebhookProcessing(
  tenantId: string,
  integrationId: string,
  events: any[]
): Promise<void> {
  for (const event of events) {
    await webhookQueue.add(
      "process",
      {
        tenantId,
        integrationId,
        event,
      },
      {
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        jobId: `${integrationId}:${event.providerId || event.type || Math.random().toString(36).slice(2)}`,
      }
    );
  }
}

/**
 * Enqueue connector sync job
 */
export async function enqueueConnectorSync(
  tenantId: string,
  integrationId: string,
  connectorId: string,
  direction: "inbound" | "outbound" | "bidirectional",
  syncType: "full" | "incremental" | "backfill",
  since?: string
): Promise<void> {
  await connectorSyncQueue.add(
    "sync",
    {
      tenantId,
      integrationId,
      connectorId,
      direction,
      syncType,
      since,
    },
    {
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed sync jobs for 7 days
        count: 500,
      },
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );
}

/**
 * Create webhook processing worker
 */
export function createWebhookWorker(processor: (job: any) => Promise<void>) {
  return new Worker(
    "webhooks",
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: 10, // Process up to 10 webhooks concurrently
    }
  );
}

/**
 * Create connector sync worker
 */
export function createSyncWorker(processor: (job: any) => Promise<void>) {
  return new Worker(
    "connector-sync",
    async (job) => {
      await processor(job);
    },
    {
      connection,
      concurrency: 5, // Process up to 5 syncs concurrently
    }
  );
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const [webhookWaiting, webhookActive, webhookCompleted, webhookFailed] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
  ]);

  const [syncWaiting, syncActive, syncCompleted, syncFailed] = await Promise.all([
    connectorSyncQueue.getWaitingCount(),
    connectorSyncQueue.getActiveCount(),
    connectorSyncQueue.getCompletedCount(),
    connectorSyncQueue.getFailedCount(),
  ]);

  return {
    webhooks: {
      waiting: webhookWaiting,
      active: webhookActive,
      completed: webhookCompleted,
      failed: webhookFailed,
    },
    sync: {
      waiting: syncWaiting,
      active: syncActive,
      completed: syncCompleted,
      failed: syncFailed,
    },
  };
}

export { connection as redisConnection };

