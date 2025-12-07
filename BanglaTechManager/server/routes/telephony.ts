/**
 * Telephony Routes
 * Handles phone calls, recordings, transcriptions, and phone numbers
 */

import { Express, Request, Response } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { TelephonyService } from "../service/telephony-service";
import { createProviderAdapter } from "../service/telephony-provider-adapter";
import { logAuditEvent } from "../audit-service";
import { db } from "../db";
import { storage } from "../storage";
import { phoneNumbers, phoneCalls, recordings, callLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const telephonyService = new TelephonyService();

export function registerTelephonyRoutes(app: Express): void {
  // ==================== Phone Numbers ====================

  /**
   * POST /api/telephony/numbers
   * Provision phone number
   */
  app.post(
    "/api/telephony/numbers",
    authenticate,
    authorize([PERMISSIONS.TENANT_UPDATE]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { provider, credentials, areaCode, region, capabilities } = req.body;

        if (!provider || !credentials) {
          return res.status(400).json({ error: "provider and credentials are required" });
        }

        const result = await telephonyService.provisionNumber(
          tenantId,
          provider,
          credentials,
          {
            areaCode,
            region,
            capabilities: capabilities || { inbound: true, outbound: true },
          }
        );

        res.status(201).json(result);
      } catch (error: any) {
        console.error("Error provisioning phone number:", error);
        res.status(500).json({ error: error.message || "Failed to provision phone number" });
      }
    }
  );

  /**
   * GET /api/telephony/numbers
   * List tenant phone numbers
   */
  app.get(
    "/api/telephony/numbers",
    authenticate,
    authorize([PERMISSIONS.CALLS_READ]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;

        if (!db) {
          const memStorage = storage as any;
          const numbers = Array.from(memStorage.phoneNumbers?.values() || [])
            .filter((n: any) => n.tenantId === tenantId);
          res.json(numbers);
          return;
        }

        const numbers = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.tenantId, tenantId));

        res.json(numbers);
      } catch (error: any) {
        console.error("Error fetching phone numbers:", error);
        res.status(500).json({ error: error.message || "Failed to fetch phone numbers" });
      }
    }
  );

  /**
   * DELETE /api/telephony/numbers/:id
   * Release phone number
   */
  app.delete(
    "/api/telephony/numbers/:id",
    authenticate,
    authorize([PERMISSIONS.TENANT_UPDATE]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;

        if (!db) {
          const memStorage = storage as any;
          const phoneNumber = memStorage.phoneNumbers?.get(id);
          if (!phoneNumber || phoneNumber.tenantId !== tenantId) {
            return res.status(404).json({ error: "Phone number not found" });
          }
          
          // Release from provider
          const adapter = createProviderAdapter(phoneNumber.provider, {});
          await adapter.releaseNumber(phoneNumber.providerNumberId);
          
          memStorage.phoneNumbers.delete(id);
          res.status(204).send();
          return;
        }

        const [phoneNumber] = await db
          .select()
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.tenantId, tenantId)))
          .limit(1);

        if (!phoneNumber) {
          return res.status(404).json({ error: "Phone number not found" });
        }

        // Release from provider
        const credentials = await telephonyService["getProviderCredentials"](tenantId, phoneNumber.provider);
        const adapter = createProviderAdapter(phoneNumber.provider, credentials);
        await adapter.releaseNumber(phoneNumber.providerNumberId);

        await db.delete(phoneNumbers).where(eq(phoneNumbers.id, id));

        await logAuditEvent({
          tenantId,
          userId: req.user!.id,
          action: "delete",
          resourceType: "phone_number",
          resourceId: id,
        });

        res.status(204).send();
      } catch (error: any) {
        console.error("Error releasing phone number:", error);
        res.status(500).json({ error: error.message || "Failed to release phone number" });
      }
    }
  );

  // ==================== Calls ====================

  /**
   * POST /api/telephony/calls
   * Initiate outbound call
   */
  app.post(
    "/api/telephony/calls",
    authenticate,
    authorize([PERMISSIONS.CALLS_CREATE]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { fromNumberId, toNumber, agentId } = req.body;

        if (!fromNumberId || !toNumber) {
          return res.status(400).json({ error: "fromNumberId and toNumber are required" });
        }

        const result = await telephonyService.initiateOutboundCall(
          tenantId,
          fromNumberId,
          toNumber,
          agentId || req.user!.id
        );

        res.status(201).json(result);
      } catch (error: any) {
        console.error("Error initiating call:", error);
        res.status(500).json({ error: error.message || "Failed to initiate call" });
      }
    }
  );

  /**
   * GET /api/telephony/calls
   * List calls
   */
  app.get(
    "/api/telephony/calls",
    authenticate,
    authorize([PERMISSIONS.CALLS_READ]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { customerId, status, limit = 50, offset = 0 } = req.query;

        if (!db) {
          const memStorage = storage as any;
          let calls = Array.from(memStorage.phoneCalls?.values() || [])
            .filter((c: any) => c.tenantId === tenantId);
          
          if (customerId) {
            calls = calls.filter((c: any) => c.customerId === customerId);
          }
          if (status) {
            calls = calls.filter((c: any) => c.status === status);
          }
          
          res.json(calls.slice(Number(offset), Number(offset) + Number(limit)));
          return;
        }

        let query = db.select().from(phoneCalls).where(eq(phoneCalls.tenantId, tenantId));

        if (customerId) {
          query = query.where(and(eq(phoneCalls.tenantId, tenantId), eq(phoneCalls.customerId, customerId as string))) as any;
        }
        if (status) {
          query = query.where(and(eq(phoneCalls.tenantId, tenantId), eq(phoneCalls.status, status as any))) as any;
        }

        const calls = await query.limit(Number(limit)).offset(Number(offset));
        res.json(calls);
      } catch (error: any) {
        console.error("Error fetching calls:", error);
        res.status(500).json({ error: error.message || "Failed to fetch calls" });
      }
    }
  );

  /**
   * GET /api/telephony/calls/:id
   * Get call details
   */
  app.get(
    "/api/telephony/calls/:id",
    authenticate,
    authorize([PERMISSIONS.CALLS_READ]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;

        const call = await telephonyService["getCall"](tenantId, id);
        if (!call) {
          return res.status(404).json({ error: "Call not found" });
        }

        // Get call logs
        let logs = [];
        if (!db) {
          const memStorage = storage as any;
          logs = Array.from(memStorage.callLogs?.values() || [])
            .filter((l: any) => l.callId === id && l.tenantId === tenantId);
        } else {
          logs = await db
            .select()
            .from(callLogs)
            .where(and(eq(callLogs.callId, id), eq(callLogs.tenantId, tenantId)));
        }

        res.json({ ...call, logs });
      } catch (error: any) {
        console.error("Error fetching call:", error);
        res.status(500).json({ error: error.message || "Failed to fetch call" });
      }
    }
  );

  /**
   * PATCH /api/telephony/calls/:id
   * Update call metadata
   */
  app.patch(
    "/api/telephony/calls/:id",
    authenticate,
    authorize([PERMISSIONS.CALLS_UPDATE, PERMISSIONS.CALLS_READ]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;
        const updates = req.body;

        if (!db) {
          const memStorage = storage as any;
          const call = memStorage.phoneCalls?.get(id);
          if (!call || call.tenantId !== tenantId) {
            return res.status(404).json({ error: "Call not found" });
          }
          Object.assign(call, updates, { updatedAt: new Date() });
          res.json(call);
          return;
        }

        const [updated] = await db
          .update(phoneCalls)
          .set({ ...updates, updatedAt: new Date() })
          .where(and(eq(phoneCalls.id, id), eq(phoneCalls.tenantId, tenantId)))
          .returning();

        if (!updated) {
          return res.status(404).json({ error: "Call not found" });
        }

        res.json(updated);
      } catch (error: any) {
        console.error("Error updating call:", error);
        res.status(500).json({ error: error.message || "Failed to update call" });
      }
    }
  );

  /**
   * POST /api/telephony/calls/:id/convert-to-ticket
   * Convert call to ticket
   */
  app.post(
    "/api/telephony/calls/:id/convert-to-ticket",
    authenticate,
    authorize([PERMISSIONS.TICKETS_CREATE]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;
        const { title, description, priority, category } = req.body;

        if (!title) {
          return res.status(400).json({ error: "title is required" });
        }

        const result = await telephonyService.convertCallToTicket(tenantId, id, {
          title,
          description,
          priority,
          category,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error converting call to ticket:", error);
        res.status(500).json({ error: error.message || "Failed to convert call to ticket" });
      }
    }
  );

  // ==================== Recordings ====================

  /**
   * GET /api/telephony/recordings/:id
   * Get recording metadata and signed URL
   */
  app.get(
    "/api/telephony/recordings/:id",
    authenticate,
    authorize([PERMISSIONS.CALLS_RECORD]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;

        const recording = await telephonyService["getRecording"](tenantId, id);
        if (!recording) {
          return res.status(404).json({ error: "Recording not found" });
        }

        // In production, generate signed URL for download
        const signedUrl = `/api/telephony/recordings/${id}/download?token=${Date.now()}`;

        res.json({
          ...recording,
          downloadUrl: signedUrl,
        });
      } catch (error: any) {
        console.error("Error fetching recording:", error);
        res.status(500).json({ error: error.message || "Failed to fetch recording" });
      }
    }
  );

  /**
   * GET /api/telephony/recordings/:id/download
   * Download recording
   */
  app.get(
    "/api/telephony/recordings/:id/download",
    authenticate,
    authorize([PERMISSIONS.CALLS_RECORD]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { id } = req.params;

        const recording = await telephonyService["getRecording"](tenantId, id);
        if (!recording) {
          return res.status(404).json({ error: "Recording not found" });
        }

        // In production, stream file from storage
        res.setHeader("Content-Type", `audio/${recording.format || "mp3"}`);
        res.setHeader("Content-Disposition", `attachment; filename="recording-${id}.${recording.format || "mp3"}"`);
        res.send("Mock recording data"); // In production, stream actual file
      } catch (error: any) {
        console.error("Error downloading recording:", error);
        res.status(500).json({ error: error.message || "Failed to download recording" });
      }
    }
  );

  // ==================== Transcriptions ====================

  /**
   * POST /api/telephony/transcriptions
   * Start transcription job for recording
   */
  app.post(
    "/api/telephony/transcriptions",
    authenticate,
    authorize([PERMISSIONS.CALLS_RECORD]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { recordingId, language, diarize, redactPii } = req.body;

        if (!recordingId) {
          return res.status(400).json({ error: "recordingId is required" });
        }

        const result = await telephonyService.startTranscription(tenantId, recordingId, {
          language,
          diarize,
          redactPii,
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error starting transcription:", error);
        res.status(500).json({ error: error.message || "Failed to start transcription" });
      }
    }
  );

  // ==================== Webhooks ====================

  /**
   * POST /api/telephony/webhooks/:tenantId/:secret
   * Provider webhook endpoint
   */
  app.post(
    "/api/telephony/webhooks/:tenantId/:secret",
    async (req: Request, res: Response) => {
      try {
        const { tenantId, secret } = req.params;
        const provider = req.body.AccountSid ? "twilio" : "unknown";

        // Validate webhook signature
        const adapter = createProviderAdapter(provider, {});
        const isValid = adapter.validateWebhookSignature(
          JSON.stringify(req.body),
          req.headers["x-twilio-signature"] as string || "",
          req.originalUrl
        );

        if (!isValid) {
          return res.status(401).json({ error: "Invalid webhook signature" });
        }

        const event = adapter.parseWebhookEvent(req.body);

        // Handle event based on type
        switch (event.eventType) {
          case "call.incoming":
            await telephonyService.handleIncomingCall(tenantId, event);
            break;
          case "call.answered":
            await telephonyService.handleCallAnswered(tenantId, event.callId);
            break;
          case "call.completed":
            await telephonyService.handleCallCompleted(tenantId, event);
            break;
          case "recording.available":
            // Store recording
            const call = await telephonyService["getCall"](tenantId, event.data.CallSid);
            if (call) {
              await telephonyService.storeRecording(
                tenantId,
                call.id,
                event.data.RecordingSid,
                provider
              );
            }
            break;
        }

        // Return TwiML or empty response
        res.type("text/xml");
        res.send("<Response></Response>");
      } catch (error: any) {
        console.error("Error handling webhook:", error);
        res.status(500).json({ error: error.message || "Failed to handle webhook" });
      }
    }
  );

  // ==================== Usage & Settings ====================

  /**
   * GET /api/telephony/usage
   * Get tenant telephony usage metrics
   */
  app.get(
    "/api/telephony/usage",
    authenticate,
    authorize([PERMISSIONS.TENANT_READ]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const { startDate, endDate } = req.query;

        // Calculate usage metrics
        if (!db) {
          const memStorage = storage as any;
          const calls = Array.from(memStorage.phoneCalls?.values() || [])
            .filter((c: any) => c.tenantId === tenantId);
          
          const totalCalls = calls.length;
          const totalMinutes = calls.reduce((sum: number, c: any) => sum + (c.duration || 0), 0) / 60;
          const recordedCalls = calls.filter((c: any) => c.recordingId).length;

          res.json({
            totalCalls,
            totalMinutes: Math.round(totalMinutes),
            recordedCalls,
            phoneNumbers: Array.from(memStorage.phoneNumbers?.values() || [])
              .filter((n: any) => n.tenantId === tenantId).length,
          });
          return;
        }

        // Database mode - calculate from actual data
        const calls = await db
          .select()
          .from(phoneCalls)
          .where(eq(phoneCalls.tenantId, tenantId));

        const totalCalls = calls.length;
        const totalMinutes = calls.reduce((sum, c) => sum + (c.duration || 0), 0) / 60;
        const recordedCalls = calls.filter((c) => c.recordingId).length;
        const phoneNumbersCount = await db
          .select()
          .from(phoneNumbers)
          .where(eq(phoneNumbers.tenantId, tenantId));

        res.json({
          totalCalls,
          totalMinutes: Math.round(totalMinutes),
          recordedCalls,
          phoneNumbers: phoneNumbersCount.length,
        });
      } catch (error: any) {
        console.error("Error fetching usage:", error);
        res.status(500).json({ error: error.message || "Failed to fetch usage" });
      }
    }
  );

  /**
   * POST /api/telephony/settings
   * Update tenant telephony settings
   */
  app.post(
    "/api/telephony/settings",
    authenticate,
    authorize([PERMISSIONS.TENANT_UPDATE]),
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user!.tenantId;
        const settings = req.body;

        // In production, update tenant_settings table
        // For now, just return success
        res.json({ success: true, settings });
      } catch (error: any) {
        console.error("Error updating settings:", error);
        res.status(500).json({ error: error.message || "Failed to update settings" });
      }
    }
  );
}

