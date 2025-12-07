/**
 * MFA Service
 * Handles TOTP (Time-based One-Time Password) MFA setup and verification
 */

import { db } from "../db";
import { storage } from "../storage";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "../audit-service";
import { encrypt, decrypt } from "../encryption-service";
// Note: Install required packages: npm install speakeasy qrcode @types/speakeasy @types/qrcode
// For now, using a placeholder implementation
// import speakeasy from "speakeasy";
// import QRCode from "qrcode";

// Placeholder TOTP implementation (replace with speakeasy in production)
function generateTOTPSecret(): { base32: string; otpauth_url: string } {
  const secret = crypto.randomBytes(20).toString("base32");
  return {
    base32: secret,
    otpauth_url: `otpauth://totp/Shohayota?secret=${secret}&issuer=Shohayota%20CRM`,
  };
}

function verifyTOTPCode(secret: string, code: string): boolean {
  // Placeholder - implement proper TOTP verification with speakeasy
  // For now, return false (MFA will not work until speakeasy is installed)
  console.warn("MFA verification requires speakeasy package. Install: npm install speakeasy");
  return false;
}

async function generateQRCode(url: string): Promise<string> {
  // Placeholder - implement QR code generation with qrcode package
  // For now, return data URL placeholder
  console.warn("QR code generation requires qrcode package. Install: npm install qrcode");
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

/**
 * Setup MFA for a user (generate secret and QR code)
 */
export async function setupMFA(
  userId: string,
  tenantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
  const user = await storage.getUser(userId);
  if (!user || user.tenantId !== tenantId) {
    throw new Error("User not found");
  }

  // Generate TOTP secret
  const secret = generateTOTPSecret();

  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  // Hash backup codes before storing
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  // Encrypt MFA secret before storing
  const encryptedSecret = encrypt(secret.base32);

  // Update user (would need updateUser method in storage)
  // For now, we'll return the secret and backup codes
  // In production, store encrypted secret and hashed backup codes

  // Log audit (don't log the secret!)
  await logAuditEvent({
    tenantId,
    userId,
    action: "mfa_setup",
    resourceType: "user",
    resourceId: userId,
    details: { mfaEnabled: true },
    ipAddress,
    userAgent,
  });

  // Generate QR code
  const qrCode = await generateQRCode(secret.otpauth_url);

  return {
    secret: secret.base32, // Return for user to save (mask in logs)
    qrCode,
    backupCodes, // Return for user to save (one-time display)
  };
}

/**
 * Verify MFA code and enable MFA
 */
export async function verifyMFA(
  userId: string,
  tenantId: string,
  code: string,
  secret: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean }> {
  const user = await storage.getUser(userId);
  if (!user || user.tenantId !== tenantId) {
    throw new Error("User not found");
  }

  // Verify TOTP code
  const verified = verifyTOTPCode(secret, code);

  if (!verified) {
    // Log failed attempt
    await logAuditEvent({
      tenantId,
      userId,
      action: "mfa_verify",
      resourceType: "user",
      resourceId: userId,
      details: { success: false },
      ipAddress,
      userAgent,
    });

    throw new Error("Invalid MFA code");
  }

  // Encrypt and store secret
  const encryptedSecret = encrypt(secret);

  // Generate and hash backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => bcrypt.hash(code, 10))
  );

  // Update user (would need updateUser method)
  // Store: mfaEnabled = true, mfaSecret = encryptedSecret, mfaBackupCodes = hashedBackupCodes

  // Log successful verification
  await logAuditEvent({
    tenantId,
    userId,
    action: "mfa_verify",
    resourceType: "user",
    resourceId: userId,
    details: { success: true, mfaEnabled: true },
    ipAddress,
    userAgent,
  });

  return { success: true }; // Note: backupCodes should be returned once, stored securely
}

/**
 * Verify MFA code during login
 */
export async function verifyMFACode(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) {
    return false;
  }

  const encryptedSecret = (user as any).mfaSecret;
  if (!encryptedSecret) {
    return false;
  }

  // Decrypt secret
  const secret = decrypt(encryptedSecret);

  // Verify TOTP code
  const verified = verifyTOTPCode(secret, code);

  if (verified) {
    return true;
  }

  // Check backup codes
  const backupCodes = (user as any).mfaBackupCodes || [];
  for (const hashedCode of backupCodes) {
    if (await bcrypt.compare(code, hashedCode)) {
      // Remove used backup code
      const updatedCodes = backupCodes.filter((c: string) => c !== hashedCode);
      // Update user with remaining backup codes
      return true;
    }
  }

  return false;
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(
  userId: string,
  tenantId: string,
  password: string,
  mfaCode: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user || user.tenantId !== tenantId) {
    throw new Error("User not found");
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new Error("Invalid password");
  }

  // Verify MFA code
  const mfaValid = await verifyMFACode(userId, mfaCode);
  if (!mfaValid) {
    throw new Error("Invalid MFA code");
  }

  // Disable MFA (would need updateUser method)
  // Set: mfaEnabled = false, mfaSecret = null, mfaBackupCodes = []

  // Log audit
  await logAuditEvent({
    tenantId,
    userId,
    action: "mfa_disable",
    resourceType: "user",
    resourceId: userId,
    details: { mfaEnabled: false },
    ipAddress,
    userAgent,
  });
}

// Import required modules
import crypto from "crypto";
import bcrypt from "bcrypt";

