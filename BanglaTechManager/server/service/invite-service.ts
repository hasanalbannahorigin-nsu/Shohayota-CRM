/**
 * Invite Service
 * Handles user invitations with secure token generation and validation
 */

import { db } from "../db";
import { storage } from "../storage";
import { inviteTokens, users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { insertInviteTokenSchema } from "@shared/schema";
import { logAuditEvent } from "../audit-service";
import { assignRoleToUser } from "./rbac-service";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { emailService } from "../email-service";

const TOKEN_EXPIRY_HOURS = 72; // 72 hours TTL

/**
 * Create an invite token
 */
export async function createInviteToken(
  tenantId: string,
  email: string,
  roleId: string | undefined,
  createdBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; inviteId: string }> {
  // Check if user already exists
  const existing = await storage.getUserByEmail(email);
  if (existing) {
    throw new Error("User with this email already exists");
  }

  // Generate secure token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, 10);

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

  // Create invite token record
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const inviteId = crypto.randomUUID();
    const invite = {
      id: inviteId,
      tenantId,
      email,
      roleId: roleId || null,
      tokenHash,
      expiresAt,
      createdBy,
      used: false,
      createdAt: new Date(),
    };
    if (!memStorage.inviteTokens) {
      memStorage.inviteTokens = new Map();
    }
    memStorage.inviteTokens.set(inviteId, invite);

    // Send invite email
    await sendInviteEmail(email, rawToken, tenantId);

    // Log audit
    await logAuditEvent({
      tenantId,
      userId: createdBy,
      action: "invite_create",
      resourceType: "invite",
      resourceId: inviteId,
      details: { email, roleId },
      ipAddress,
      userAgent,
    });

    return { token: rawToken, inviteId };
  }

  const [invite] = await db.insert(inviteTokens).values({
    tenantId,
    email,
    roleId: roleId || null,
    tokenHash,
    expiresAt,
    createdBy,
  }).returning();

  // Send invite email
  await sendInviteEmail(email, rawToken, tenantId);

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: createdBy,
    action: "invite_create",
    resourceType: "invite",
    resourceId: invite.id,
    details: { email, roleId },
    ipAddress,
    userAgent,
  });

  return { token: rawToken, inviteId: invite.id };
}

/**
 * Accept an invite token and create user
 */
export async function acceptInviteToken(
  token: string,
  password: string,
  name?: string
): Promise<{ userId: string; email: string }> {
  // Hash the provided token to compare
  const tokenHash = await bcrypt.hash(token, 10);

  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const invites = Array.from(memStorage.inviteTokens?.values() || []);
    
    // Find invite by comparing hashed tokens
    let invite: any = null;
    for (const inv of invites) {
      if (await bcrypt.compare(token, inv.tokenHash)) {
        invite = inv;
        break;
      }
    }

    if (!invite) {
      throw new Error("Invalid or expired invite token");
    }

    // Check if already used
    if (invite.used) {
      throw new Error("Invite token has already been used");
    }

    // Check if expired
    if (new Date() > new Date(invite.expiresAt)) {
      throw new Error("Invite token has expired");
    }

    // Create user
    const user = await storage.createUser({
      tenantId: invite.tenantId,
      email: invite.email,
      name: name || invite.email.split("@")[0],
      password,
      role: "support_agent", // Default role
      isActive: true,
    } as any);

    // Assign role if specified
    if (invite.roleId) {
      await assignRoleToUser(user.id, invite.roleId, user.id);
    }

    // Mark invite as used
    invite.used = true;
    invite.usedAt = new Date();
    invite.usedBy = user.id;

    // Log audit
    await logAuditEvent({
      tenantId: invite.tenantId,
      userId: user.id,
      action: "invite_accept",
      resourceType: "invite",
      resourceId: invite.id,
      details: { email: invite.email },
    });

    return { userId: user.id, email: user.email };
  }

  // Database mode - find invite by comparing hashes
  // Note: This is inefficient - in production, store a lookup index
  const allInvites = await db.select().from(inviteTokens)
    .where(and(
      eq(inviteTokens.used, false),
      gt(inviteTokens.expiresAt, new Date())
    ));

  let invite: any = null;
  for (const inv of allInvites) {
    if (await bcrypt.compare(token, inv.tokenHash)) {
      invite = inv;
      break;
    }
  }

  if (!invite) {
    throw new Error("Invalid or expired invite token");
  }

  // Create user
  const user = await storage.createUser({
    tenantId: invite.tenantId,
    email: invite.email,
    name: name || invite.email.split("@")[0],
    password,
    role: "support_agent",
    isActive: true,
  } as any);

  // Assign role if specified
  if (invite.roleId) {
    await assignRoleToUser(user.id, invite.roleId, user.id);
  }

  // Mark invite as used
  await db.update(inviteTokens)
    .set({
      used: true,
      usedAt: new Date(),
      usedBy: user.id,
    })
    .where(eq(inviteTokens.id, invite.id));

  // Log audit
  await logAuditEvent({
    tenantId: invite.tenantId,
    userId: user.id,
    action: "invite_accept",
    resourceType: "invite",
    resourceId: invite.id,
    details: { email: invite.email },
  });

  return { userId: user.id, email: user.email };
}

/**
 * Revoke an invite token
 */
export async function revokeInviteToken(
  inviteId: string,
  tenantId: string,
  revokedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  if (!db) {
    // In-memory mode
    const memStorage = storage as any;
    const invite = memStorage.inviteTokens?.get(inviteId);
    if (invite && invite.tenantId === tenantId) {
      memStorage.inviteTokens.delete(inviteId);
    }
    return;
  }

  await db.delete(inviteTokens)
    .where(and(
      eq(inviteTokens.id, inviteId),
      eq(inviteTokens.tenantId, tenantId)
    ));

  // Log audit
  await logAuditEvent({
    tenantId,
    userId: revokedBy,
    action: "invite_revoke",
    resourceType: "invite",
    resourceId: inviteId,
    ipAddress,
    userAgent,
  });
}

/**
 * Send invite email
 */
async function sendInviteEmail(email: string, token: string, tenantId: string): Promise<void> {
  const tenant = await storage.getTenant(tenantId);
  const inviteUrl = `${process.env.APP_URL || "http://localhost:5000"}/accept-invite?token=${token}`;

  try {
    await emailService.sendEmail({
      to: email,
      subject: `Invitation to join ${tenant?.name || "Shohayota CRM"}`,
      html: `
        <h2>You've been invited!</h2>
        <p>You've been invited to join ${tenant?.name || "Shohayota CRM"}.</p>
        <p>Click the link below to accept your invitation and set up your account:</p>
        <p><a href="${inviteUrl}">Accept Invitation</a></p>
        <p>This link will expire in ${TOKEN_EXPIRY_HOURS} hours.</p>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send invite email:", error);
    // Don't fail the invite creation if email fails
  }
}

