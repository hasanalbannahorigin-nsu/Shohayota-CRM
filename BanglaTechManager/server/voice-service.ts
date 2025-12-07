// Voice call service for managing phone calls and transcripts
import { storage, MemStorage } from "./storage";
import { v4 as uuidv4 } from "uuid";

export interface CallRecord {
  id: string;
  tenantId: string;
  customerId: string;
  userId: string;
  ticketId?: string;
  status: "incoming" | "outgoing" | "missed" | "completed" | "failed";
  duration?: number;
  transcript?: string;
  recordingUrl?: string;
  callStartTime?: Date;
  callEndTime?: Date;
  createdAt: Date;
}

export class VoiceService {
  // Initialize call
  async initiateCall(
    tenantId: string,
    customerId: string,
    userId: string,
    direction: "incoming" | "outgoing"
  ): Promise<CallRecord> {
    const call: CallRecord = {
      id: uuidv4(),
      tenantId,
      customerId,
      userId,
      status: direction === "incoming" ? "incoming" : "outgoing",
      callStartTime: new Date(),
      createdAt: new Date(),
    };

    const memStorage = storage as MemStorage;
    if (!memStorage.phoneCalls) {
      (memStorage as any).phoneCalls = new Map();
    }
    (memStorage as any).phoneCalls.set(call.id, call);

    console.log(
      `📞 ${direction === "incoming" ? "Incoming" : "Outgoing"} call initiated: ${call.id}`
    );
    return call;
  }

  // End call with transcript
  async endCall(
    callId: string,
    transcript?: string,
    recordingUrl?: string
  ): Promise<CallRecord | null> {
    const memStorage = storage as MemStorage;
    const phoneCalls = (memStorage as any).phoneCalls || new Map();
    const call = phoneCalls.get(callId) as CallRecord | undefined;

    if (!call) {
      console.error(`Call ${callId} not found`);
      return null;
    }

    const endTime = new Date();
    const duration = call.callStartTime
      ? Math.round((endTime.getTime() - call.callStartTime.getTime()) / 1000)
      : undefined;

    const updatedCall: CallRecord = {
      ...call,
      status: "completed",
      callEndTime: endTime,
      duration,
      transcript,
      recordingUrl,
    };

    phoneCalls.set(callId, updatedCall);
    console.log(`✅ Call completed: ${callId} (Duration: ${duration}s)`);
    if (transcript) {
      console.log(`📝 Transcript: ${transcript}`);
    }

    return updatedCall;
  }

  // Get call history for customer
  async getCallHistory(
    tenantId: string,
    customerId: string
  ): Promise<CallRecord[]> {
    const memStorage = storage as MemStorage;
    const phoneCalls = (memStorage as any).phoneCalls || new Map();

    return Array.from(phoneCalls.values()).filter(
      (call: CallRecord) =>
        call.tenantId === tenantId && call.customerId === customerId
    );
  }

  // Process transcript (mock AI transcription)
  async processTranscript(audioUrl: string): Promise<string> {
    // In production, would use Twilio or Google Speech-to-Text API
    console.log(`🎙️  Processing transcript from: ${audioUrl}`);
    return "Transcript processed: [Customer inquiry about account status. Agent provided information. Customer satisfied.]";
  }

  // Link call to ticket
  async linkCallToTicket(
    callId: string,
    ticketId: string
  ): Promise<CallRecord | null> {
    const memStorage = storage as MemStorage;
    const phoneCalls = (memStorage as any).phoneCalls || new Map();
    const call = phoneCalls.get(callId) as CallRecord | undefined;

    if (!call) {
      console.error(`Call ${callId} not found`);
      return null;
    }

    const updated = { ...call, ticketId };
    phoneCalls.set(callId, updated);
    console.log(`🔗 Call ${callId} linked to ticket ${ticketId}`);

    return updated;
  }
}

export const voiceService = new VoiceService();
