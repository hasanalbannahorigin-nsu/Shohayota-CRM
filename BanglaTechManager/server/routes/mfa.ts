/**
 * MFA Routes
 * Handles TOTP-based multi-factor authentication
 */

import { Express } from "express";
import { authenticate } from "../auth";
import { setupMFA, verifyMFA, disableMFA } from "../service/mfa-service";
import { storage } from "../storage";

export function registerMFARoutes(app: Express): void {
  // ==================== Setup MFA ====================
  // POST /api/auth/mfa/setup - Generate TOTP secret and QR code
  app.post("/api/auth/mfa/setup", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      const { secret, qrCode, backupCodes } = await setupMFA(
        userId,
        tenantId,
        req.ip,
        req.headers["user-agent"]
      );

      // Return secret and QR code (user should save these)
      // Note: In production, mask secret in logs
      res.json({
        secret, // User should save this
        qrCode, // Display QR code for scanning
        backupCodes, // User should save these (one-time display)
        message: "Save your backup codes securely. You will not see them again.",
      });
    } catch (error: any) {
      console.error("Error setting up MFA:", error);
      res.status(500).json({ error: error.message || "Failed to setup MFA" });
    }
  });

  // ==================== Verify and Enable MFA ====================
  // POST /api/auth/mfa/verify - Verify code and enable MFA
  app.post("/api/auth/mfa/verify", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;
      const { code, secret } = req.body;

      if (!code || !secret) {
        return res.status(400).json({ error: "code and secret are required" });
      }

      const result = await verifyMFA(userId, tenantId, code, secret, req.ip, req.headers["user-agent"]);

      res.json({
        success: result.success,
        message: "MFA enabled successfully",
      });
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      res.status(400).json({ error: error.message || "Failed to verify MFA" });
    }
  });

  // ==================== Disable MFA ====================
  // POST /api/auth/mfa/disable - Disable MFA (requires password + code)
  app.post("/api/auth/mfa/disable", authenticate, async (req, res) => {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;
      const { password, mfaCode } = req.body;

      if (!password || !mfaCode) {
        return res.status(400).json({ error: "password and mfaCode are required" });
      }

      await disableMFA(userId, tenantId, password, mfaCode, req.ip, req.headers["user-agent"]);

      res.json({ message: "MFA disabled successfully" });
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      res.status(400).json({ error: error.message || "Failed to disable MFA" });
    }
  });
}

