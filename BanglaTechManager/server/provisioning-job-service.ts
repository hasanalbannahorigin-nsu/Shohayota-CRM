/**
 * Provisioning Job Service
 * Handles background provisioning jobs with status tracking
 */

import { storage } from "./storage";
import { provisionTenant, type TenantProvisioningOptions } from "./tenant-provisioning";
import { logAuditEvent } from "./audit-service";
import { v4 as uuidv4 } from "uuid";

export type ProvisioningJobStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface ProvisioningJob {
  id: string;
  tenantId?: string;
  status: ProvisioningJobStatus;
  options: TenantProvisioningOptions;
  progress: {
    step: string;
    completed: number;
    total: number;
  };
  result?: any;
  error?: string;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// In-memory job store (use Redis/DB in production)
const jobs = new Map<string, ProvisioningJob>();

/**
 * Create a provisioning job
 */
export async function createProvisioningJob(
  options: TenantProvisioningOptions,
  createdBy: string
): Promise<ProvisioningJob> {
  const jobId = uuidv4();
  
  const job: ProvisioningJob = {
    id: jobId,
    status: "pending",
    options,
    progress: {
      step: "Initializing",
      completed: 0,
      total: 6, // Total steps
    },
    warnings: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobs.set(jobId, job);

  // Start provisioning asynchronously
  processProvisioningJob(jobId, createdBy).catch((error) => {
    console.error(`[PROVISIONING] Job ${jobId} failed:`, error);
  });

  return job;
}

/**
 * Get provisioning job status
 */
export function getProvisioningJob(jobId: string): ProvisioningJob | undefined {
  return jobs.get(jobId);
}

/**
 * Process provisioning job in background
 */
async function processProvisioningJob(jobId: string, createdBy: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    job.status = "in_progress";
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    // Step 1: Create tenant record
    job.progress = { step: "Creating tenant record", completed: 1, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    const result = await provisionTenant(job.options);
    job.tenantId = result.tenant.id;
    job.warnings = result.warnings;

    // Step 2: Create admin user (done in provisionTenant)
    job.progress = { step: "Creating admin user", completed: 2, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    // Step 3: Seed default settings (done in provisionTenant)
    job.progress = { step: "Seeding default settings", completed: 3, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    // Step 4: Provision storage prefix (async, non-blocking)
    job.progress = { step: "Provisioning storage", completed: 4, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);
    
    // Storage prefix is handled by file storage service
    // In production, this would create S3 prefixes, etc.

    // Step 5: Create integration placeholders
    job.progress = { step: "Creating integration placeholders", completed: 5, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);
    
    // Integration placeholders created automatically on first use

    // Step 6: Setup usage counters
    job.progress = { step: "Setting up usage counters", completed: 6, total: 6 };
    job.updatedAt = new Date();
    jobs.set(jobId, job);
    
    // Usage counters initialized automatically

    // Complete
    job.status = "completed";
    job.result = {
      tenantId: result.tenant.id,
      adminToken: result.adminToken,
      onboardingChecklist: [
        "Complete tenant profile",
        "Configure branding",
        "Set up integrations",
        "Invite team members",
        "Import initial data",
      ],
    };
    job.completedAt = new Date();
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    // Log audit
    await logAuditEvent({
      tenantId: result.tenant.id,
      userId: createdBy,
      action: "create",
      resourceType: "provisioning_job",
      resourceId: jobId,
      details: { status: "completed", tenantId: result.tenant.id },
    });
  } catch (error: any) {
    job.status = "failed";
    job.error = error.message || "Unknown error";
    job.updatedAt = new Date();
    jobs.set(jobId, job);

    // Log audit
    if (job.tenantId) {
      await logAuditEvent({
        tenantId: job.tenantId,
        userId: createdBy,
        action: "create",
        resourceType: "provisioning_job",
        resourceId: jobId,
        details: { status: "failed", error: job.error },
      });
    }
  }
}

/**
 * List all provisioning jobs (for admin)
 */
export function listProvisioningJobs(limit = 100, offset = 0): ProvisioningJob[] {
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(offset, offset + limit);
}

/**
 * Cancel a provisioning job
 */
export function cancelProvisioningJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== "pending") {
    return false;
  }

  job.status = "cancelled";
  job.updatedAt = new Date();
  jobs.set(jobId, job);
  return true;
}

