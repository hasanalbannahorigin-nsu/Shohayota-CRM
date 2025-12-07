/**
 * Telephony Service
 * Manages calls, recordings, transcriptions, and phone numbers
 */

import { db } from "../db";
import { storage } from "../storage";
import { phoneCalls, phoneNumbers, recordings, callLogs, transcripts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { createProviderAdapter, type TelephonyWebhookEvent } from "./telephony-provider-adapter";
import { TranscriptionService } from "./transcription-service";
import { logAuditEvent } from "../audit-service";
import crypto from "crypto";

export interface CallRecordingSettings {
  recordingEnabled: boolean;
  recordInbound: boolean;
  recordOutbound: boolean;
  recordAgentOnly: boolean;
  onAnswerRecording: boolean;
  consentRequired: boolean;
  redactPii: boolean;
  transcriptionEnabled: boolean;
  transcriptionProvider: string;
  diarization: boolean;
  transcriptionLanguage: string;
  recordingRetentionDays: number;
}

export class TelephonyService {
  private transcriptionService: TranscriptionService;

  constructor() {
    this.transcriptionService = new TranscriptionService();
  }

  /**
   * Get tenant telephony settings
   */
  async getTenantSettings(tenantId: string): Promise<CallRecordingSettings> {
    // In production, fetch from tenant_settings table
    // For now, return defaults
    return {
      recordingEnabled: true,
      recordInbound: true,
      recordOutbound: true,
      recordAgentOnly: false,
      onAnswerRecording: true,
      consentRequired: false,
      redactPii: false,
      transcriptionEnabled: true,
      transcriptionProvider: "openai",
      diarization: true,
      transcriptionLanguage: "auto",
      recordingRetentionDays: 90,
    };
  }

  /**
   * Provision phone number
   */
  async provisionNumber(
    tenantId: string,
    provider: string,
    credentials: Record<string, string>,
    options: {
      areaCode?: string;
      region?: string;
      capabilities: { inbound: boolean; outbound: boolean; sms?: boolean; mms?: boolean };
    }
  ): Promise<{ id: string; number: string }> {
    const adapter = createProviderAdapter(provider, credentials);
    const result = await adapter.provisionNumber(options);

    const webhookUrl = `${process.env.API_BASE_URL || "http://localhost:5000"}/api/telephony/webhooks/${tenantId}/${crypto.randomBytes(16).toString("hex")}`;
    await adapter.configureWebhook(result.numberId, webhookUrl);

    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.phoneNumbers) memStorage.phoneNumbers = new Map();
      const phoneNumber = {
        id: crypto.randomUUID(),
        tenantId,
        provider,
        number: result.number,
        providerNumberId: result.numberId,
        region: result.region,
        capabilities: result.capabilities,
        status: "active",
        webhookUrl,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memStorage.phoneNumbers.set(phoneNumber.id, phoneNumber);
      return { id: phoneNumber.id, number: phoneNumber.number };
    }

    const [phoneNumber] = await db
      .insert(phoneNumbers)
      .values({
        tenantId,
        provider,
        number: result.number,
        providerNumberId: result.numberId,
        region: result.region,
        capabilities: result.capabilities,
        status: "active",
        webhookUrl,
      })
      .returning();

    await logAuditEvent({
      tenantId,
      userId: undefined,
      action: "create",
      resourceType: "phone_number",
      resourceId: phoneNumber.id,
      details: { number: result.number, provider },
    });

    return { id: phoneNumber.id, number: phoneNumber.number };
  }

  /**
   * Handle incoming call webhook
   */
  async handleIncomingCall(
    tenantId: string,
    event: TelephonyWebhookEvent
  ): Promise<{ callId: string }> {
    const { fromNumber, toNumber } = event.data;

    // Find phone number by toNumber
    const phoneNumber = await this.findPhoneNumberByNumber(tenantId, toNumber);
    if (!phoneNumber) {
      throw new Error(`Phone number not found: ${toNumber}`);
    }

    // Match customer by phone number
    const customer = await this.findCustomerByPhone(tenantId, fromNumber);

    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.phoneCalls) memStorage.phoneCalls = new Map();
      const call = {
        id: crypto.randomUUID(),
        tenantId,
        phoneNumberId: phoneNumber.id,
        externalCallId: event.externalCallId,
        customerId: customer?.id || null,
        direction: "inbound",
        fromNumber,
        toNumber,
        status: "ringing",
        startTime: event.timestamp,
        metadata: event.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memStorage.phoneCalls.set(call.id, call);
      await this.logCallEvent(tenantId, call.id, "ringing", undefined, "Incoming call");
      return { callId: call.id };
    }

    const [call] = await db
      .insert(phoneCalls)
      .values({
        tenantId,
        phoneNumberId: phoneNumber.id,
        externalCallId: event.externalCallId,
        customerId: customer?.id || null,
        direction: "inbound",
        fromNumber,
        toNumber,
        status: "ringing",
        startTime: event.timestamp,
        metadata: event.data,
      })
      .returning();

    await this.logCallEvent(tenantId, call.id, "ringing", undefined, "Incoming call");

    return { callId: call.id };
  }

  /**
   * Handle call answered
   */
  async handleCallAnswered(
    tenantId: string,
    callId: string,
    agentId?: string
  ): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      const call = memStorage.phoneCalls?.get(callId);
      if (call && call.tenantId === tenantId) {
        call.status = "in_progress";
        call.agentId = agentId;
        call.answeredTime = new Date();
        call.updatedAt = new Date();
        await this.logCallEvent(tenantId, callId, "answered", agentId, "Call answered");
      }
      return;
    }

    await db
      .update(phoneCalls)
      .set({
        status: "in_progress",
        agentId,
        answeredTime: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(phoneCalls.id, callId), eq(phoneCalls.tenantId, tenantId)));

    await this.logCallEvent(tenantId, callId, "answered", agentId, "Call answered");
  }

  /**
   * Handle call completed
   */
  async handleCallCompleted(
    tenantId: string,
    event: TelephonyWebhookEvent
  ): Promise<void> {
    const externalCallId = event.externalCallId;
    const duration = event.data.Duration ? parseInt(event.data.Duration) : undefined;

    if (!db) {
      const memStorage = storage as any;
      const call = Array.from(memStorage.phoneCalls?.values() || [])
        .find((c: any) => c.externalCallId === externalCallId && c.tenantId === tenantId);
      
      if (call) {
        call.status = "completed";
        call.endTime = event.timestamp;
        call.duration = duration;
        call.updatedAt = new Date();
        await this.logCallEvent(tenantId, call.id, "completed", call.agentId, "Call completed");
        
        // Trigger post-call processing
        this.processPostCall(tenantId, call.id).catch(console.error);
      }
      return;
    }

    const [call] = await db
      .select()
      .from(phoneCalls)
      .where(and(
        eq(phoneCalls.externalCallId, externalCallId),
        eq(phoneCalls.tenantId, tenantId)
      ))
      .limit(1);

    if (call) {
      await db
        .update(phoneCalls)
        .set({
          status: "completed",
          endTime: event.timestamp,
          duration,
          updatedAt: new Date(),
        })
        .where(eq(phoneCalls.id, call.id));

      await this.logCallEvent(tenantId, call.id, "completed", call.agentId, "Call completed");
      
      // Trigger post-call processing
      this.processPostCall(tenantId, call.id).catch(console.error);
    }
  }

  /**
   * Process post-call actions (recording, transcription)
   */
  private async processPostCall(tenantId: string, callId: string): Promise<void> {
    const settings = await this.getTenantSettings(tenantId);
    
    // If recording enabled and available, fetch and store
    // If transcription enabled, start transcription job
    // This would be handled by background workers
    console.log(`[Telephony] Post-call processing for call ${callId}`);
  }

  /**
   * Initiate outbound call
   */
  async initiateOutboundCall(
    tenantId: string,
    fromNumberId: string,
    toNumber: string,
    agentId?: string
  ): Promise<{ callId: string }> {
    const phoneNumber = await this.getPhoneNumber(tenantId, fromNumberId);
    if (!phoneNumber) {
      throw new Error("Phone number not found");
    }

    // Get provider credentials (encrypted)
    const credentials = await this.getProviderCredentials(tenantId, phoneNumber.provider);
    const adapter = createProviderAdapter(phoneNumber.provider, credentials);

    const webhookUrl = `${process.env.API_BASE_URL || "http://localhost:5000"}/api/telephony/webhooks/${tenantId}`;
    const result = await adapter.initiateCall({
      fromNumber: phoneNumber.number,
      toNumber,
      webhookUrl,
    });

    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.phoneCalls) memStorage.phoneCalls = new Map();
      const call = {
        id: crypto.randomUUID(),
        tenantId,
        phoneNumberId: fromNumberId,
        externalCallId: result.callId,
        agentId,
        direction: "outbound",
        fromNumber: phoneNumber.number,
        toNumber,
        status: "ringing",
        startTime: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memStorage.phoneCalls.set(call.id, call);
      await this.logCallEvent(tenantId, call.id, "ringing", agentId, "Outbound call initiated");
      return { callId: call.id };
    }

    const [call] = await db
      .insert(phoneCalls)
      .values({
        tenantId,
        phoneNumberId: fromNumberId,
        externalCallId: result.callId,
        agentId,
        direction: "outbound",
        fromNumber: phoneNumber.number,
        toNumber,
        status: "ringing",
        startTime: new Date(),
      })
      .returning();

    await this.logCallEvent(tenantId, call.id, "ringing", agentId, "Outbound call initiated");

    return { callId: call.id };
  }

  /**
   * Store recording
   */
  async storeRecording(
    tenantId: string,
    callId: string,
    providerRecordingId: string,
    provider: string
  ): Promise<{ recordingId: string }> {
    const storagePath = `tenant/${tenantId}/telephony/recordings/${crypto.randomUUID()}.mp3`;

    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.recordings) memStorage.recordings = new Map();
      const recording = {
        id: crypto.randomUUID(),
        tenantId,
        callId,
        providerRecordingId,
        storagePath,
        format: "mp3",
        status: "pending",
        metadata: { provider },
        createdAt: new Date(),
      };
      memStorage.recordings.set(recording.id, recording);
      
      // Update call with recording ID
      const call = memStorage.phoneCalls?.get(callId);
      if (call) {
        call.recordingId = recording.id;
      }
      
      return { recordingId: recording.id };
    }

    const [recording] = await db
      .insert(recordings)
      .values({
        tenantId,
        callId,
        providerRecordingId,
        storagePath,
        format: "mp3",
        status: "pending",
        metadata: { provider },
      })
      .returning();

    // Update call with recording ID
    await db
      .update(phoneCalls)
      .set({ recordingId: recording.id })
      .where(eq(phoneCalls.id, callId));

    return { recordingId: recording.id };
  }

  /**
   * Start transcription for recording
   */
  async startTranscription(
    tenantId: string,
    recordingId: string,
    options?: {
      language?: string;
      diarize?: boolean;
      redactPii?: boolean;
    }
  ): Promise<{ jobId: string }> {
    const recording = await this.getRecording(tenantId, recordingId);
    if (!recording) {
      throw new Error("Recording not found");
    }

    const settings = await this.getTenantSettings(tenantId);
    if (!settings.transcriptionEnabled) {
      throw new Error("Transcription not enabled for tenant");
    }

    // Use transcription service from Feature 4
    const jobId = await this.transcriptionService.startTranscription(
      tenantId,
      recording.storagePath, // In production, would be signed URL
      {
        language: options?.language || settings.transcriptionLanguage,
        diarize: options?.diarize ?? settings.diarization,
        redactPii: options?.redactPii ?? settings.redactPii,
      }
    );

    return { jobId };
  }

  /**
   * Convert call to ticket
   */
  async convertCallToTicket(
    tenantId: string,
    callId: string,
    ticketData: {
      title: string;
      description?: string;
      priority?: "low" | "medium" | "high";
      category?: "support" | "bug" | "feature";
    }
  ): Promise<{ ticketId: string }> {
    const call = await this.getCall(tenantId, callId);
    if (!call) {
      throw new Error("Call not found");
    }

    // Create ticket with call transcript attached
    // This would use the ticket service
    const ticketId = crypto.randomUUID(); // Mock
    
    // Link ticket to call
    if (!db) {
      const memStorage = storage as any;
      const callRecord = memStorage.phoneCalls?.get(callId);
      if (callRecord) {
        callRecord.ticketId = ticketId;
      }
    } else {
      await db
        .update(phoneCalls)
        .set({ ticketId })
        .where(eq(phoneCalls.id, callId));
    }

    return { ticketId };
  }

  // Helper methods
  private async findPhoneNumberByNumber(tenantId: string, number: string) {
    if (!db) {
      const memStorage = storage as any;
      return Array.from(memStorage.phoneNumbers?.values() || [])
        .find((pn: any) => pn.tenantId === tenantId && pn.number === number);
    }
    const [phoneNumber] = await db
      .select()
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.tenantId, tenantId), eq(phoneNumbers.number, number)))
      .limit(1);
    return phoneNumber || null;
  }

  private async findCustomerByPhone(tenantId: string, phone: string) {
    if (!db) {
      const memStorage = storage as any;
      return Array.from(memStorage.customers?.values() || [])
        .find((c: any) => c.tenantId === tenantId && (c.phone === phone || c.phones?.includes(phone)));
    }
    // In production, search customers by phone
    return null;
  }

  private async getPhoneNumber(tenantId: string, phoneNumberId: string) {
    if (!db) {
      const memStorage = storage as any;
      const pn = memStorage.phoneNumbers?.get(phoneNumberId);
      return pn && pn.tenantId === tenantId ? pn : null;
    }
    const [phoneNumber] = await db
      .select()
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.tenantId, tenantId)))
      .limit(1);
    return phoneNumber || null;
  }

  private async getCall(tenantId: string, callId: string) {
    if (!db) {
      const memStorage = storage as any;
      const call = memStorage.phoneCalls?.get(callId);
      return call && call.tenantId === tenantId ? call : null;
    }
    const [call] = await db
      .select()
      .from(phoneCalls)
      .where(and(eq(phoneCalls.id, callId), eq(phoneCalls.tenantId, tenantId)))
      .limit(1);
    return call || null;
  }

  private async getRecording(tenantId: string, recordingId: string) {
    if (!db) {
      const memStorage = storage as any;
      const recording = memStorage.recordings?.get(recordingId);
      return recording && recording.tenantId === tenantId ? recording : null;
    }
    const [recording] = await db
      .select()
      .from(recordings)
      .where(and(eq(recordings.id, recordingId), eq(recordings.tenantId, tenantId)))
      .limit(1);
    return recording || null;
  }

  private async getProviderCredentials(tenantId: string, provider: string): Promise<Record<string, string>> {
    // In production, fetch encrypted credentials from integration_credentials table
    // For now, return mock
    return {
      accountSid: "mock",
      authToken: "mock",
    };
  }

  private async logCallEvent(
    tenantId: string,
    callId: string,
    eventType: string,
    userId?: string,
    description?: string
  ): Promise<void> {
    if (!db) {
      const memStorage = storage as any;
      if (!memStorage.callLogs) memStorage.callLogs = new Map();
      const log = {
        id: crypto.randomUUID(),
        tenantId,
        callId,
        eventType,
        userId,
        description,
        timestamp: new Date(),
        createdAt: new Date(),
      };
      memStorage.callLogs.set(log.id, log);
      return;
    }

    await db.insert(callLogs).values({
      tenantId,
      callId,
      eventType,
      userId,
      description,
      timestamp: new Date(),
    });
  }
}

