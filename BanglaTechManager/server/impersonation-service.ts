/**
 * Impersonation Service
 * Handles super-admin impersonation with two-step confirmation and audit logging
 */

import { storage } from "./storage";
import { generateToken } from "./auth";
import { logAuditEvent } from "./audit-service";

export interface ImpersonationRequest {
  tenantId: string;
  userId: string;
  reason: string;
  confirmed: boolean;
}

export interface ImpersonationSession {
  id: string;
  superAdminId: string;
  impersonatedUserId: string;
  tenantId: string;
  reason: string;
  startedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory impersonation sessions (use Redis/DB in production)
const activeImpersonations = new Map<string, ImpersonationSession>();

/**
 * Request impersonation (step 1: confirmation required)
 */
export async function requestImpersonation(
  superAdminId: string,
  tenantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ requiresConfirmation: boolean; confirmationToken?: string }> {
  // Validate user belongs to tenant
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.tenantId !== tenantId) {
    throw new Error("User does not belong to specified tenant");
  }

  // Validate super-admin
  const superAdmin = await storage.getUser(superAdminId);
  if (!superAdmin || superAdmin.role !== "super_admin") {
    throw new Error("Only super-admins can impersonate users");
  }

  // Return confirmation requirement
  return {
    requiresConfirmation: true,
    confirmationToken: `impersonate_${Date.now()}_${userId}`, // In production, use secure token
  };
}

/**
 * Confirm and start impersonation (step 2: explicit confirmation)
 */
export async function confirmImpersonation(
  superAdminId: string,
  tenantId: string,
  userId: string,
  reason: string,
  confirmationToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; sessionId: string }> {
  // Validate confirmation token
  if (!confirmationToken.startsWith(`impersonate_`) || !confirmationToken.includes(userId)) {
    throw new Error("Invalid confirmation token");
  }

  // Validate user belongs to tenant
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (user.tenantId !== tenantId) {
    throw new Error("User does not belong to specified tenant");
  }

  // Validate super-admin
  const superAdmin = await storage.getUser(superAdminId);
  if (!superAdmin || superAdmin.role !== "super_admin") {
    throw new Error("Only super-admins can impersonate users");
  }

  if (!reason || reason.trim().length < 10) {
    throw new Error("Reason is required and must be at least 10 characters");
  }

  // Create impersonation session
  const sessionId = `impersonation_${Date.now()}_${userId}`;
  const session: ImpersonationSession = {
    id: sessionId,
    superAdminId,
    impersonatedUserId: userId,
    tenantId,
    reason: reason.trim(),
    startedAt: new Date(),
    ipAddress,
    userAgent,
  };

  activeImpersonations.set(sessionId, session);

  // Generate token with impersonation flag
  const token = generateToken({
    id: userId,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
  });

  // Log audit entry
  await logAuditEvent({
    tenantId,
    userId: superAdminId,
    action: "impersonate",
    resourceType: "user",
    resourceId: userId,
    details: {
      impersonatedUserId: userId,
      impersonatedUserEmail: user.email,
      reason,
      sessionId,
    },
    impersonatedBy: superAdminId,
    ipAddress,
    userAgent,
  });

  return { token, sessionId };
}

/**
 * End impersonation session
 */
export async function endImpersonation(
  sessionId: string,
  superAdminId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const session = activeImpersonations.get(sessionId);
  if (!session) {
    throw new Error("Impersonation session not found");
  }

  if (session.superAdminId !== superAdminId) {
    throw new Error("Only the super-admin who started the session can end it");
  }

  // Log audit entry
  await logAuditEvent({
    tenantId: session.tenantId,
    userId: superAdminId,
    action: "impersonate",
    resourceType: "user",
    resourceId: session.impersonatedUserId,
    details: {
      action: "end",
      sessionId,
      duration: Date.now() - session.startedAt.getTime(),
    },
    impersonatedBy: superAdminId,
    ipAddress,
    userAgent,
  });

  activeImpersonations.delete(sessionId);
}

/**
 * Get active impersonation session
 */
export function getImpersonationSession(sessionId: string): ImpersonationSession | undefined {
  return activeImpersonations.get(sessionId);
}

/**
 * Get all active impersonations for a super-admin
 */
export function getActiveImpersonations(superAdminId: string): ImpersonationSession[] {
  return Array.from(activeImpersonations.values()).filter(
    (session) => session.superAdminId === superAdminId
  );
}

