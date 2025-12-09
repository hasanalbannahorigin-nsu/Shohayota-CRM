/**
 * AI Routes
 * Endpoints for transcription, NLU, bot, RAG, NLQ, and agent assist
 */

import { Express, Request, Response } from "express";
import { authenticate } from "../auth";
import { authorize } from "../middleware/authorize";
import { PERMISSIONS } from "../config/permissions";
import { TranscriptionService } from "../service/transcription-service";
import { NLUService } from "../service/nlu-service";
import { BotService } from "../service/bot-service";
import { AgentAssistService } from "../service/agent-assist-service";
import { NLQService } from "../service/nlq-service";

const transcriptionService = new TranscriptionService();
const nluService = new NLUService();
const botService = new BotService();
const assistService = new AgentAssistService();
const nlqService = new NLQService();

export function registerAIRoutes(app: Express): void {
  // ==================== Transcription ====================

  /**
   * POST /api/ai/transcriptions
   * Start transcription job
   */
  app.post(
    "/api/ai/transcriptions",
    authenticate,
    authorize([PERMISSIONS.CALLS_READ, PERMISSIONS.CALLS_RECORD]),
    async (req: Request, res: Response) => {
      try {
        const { recordingUrl, language, diarize, redactPii } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!recordingUrl) {
          return res.status(400).json({ error: "recordingUrl is required" });
        }

        const jobId = await transcriptionService.startTranscription(tenantId, recordingUrl, {
          language,
          diarize,
          redactPii,
          userId,
        });

        res.json({ jobId, status: "pending" });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * GET /api/ai/transcriptions/:jobId
   * Get transcription job status and result
   */
  app.get(
    "/api/ai/transcriptions/:jobId",
    authenticate,
    authorize([PERMISSIONS.CALLS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { jobId } = req.params;
        const tenantId = req.user!.tenantId;

        const job = await transcriptionService.getJobStatus(jobId, tenantId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }

        if (job.status === "completed" && job.transcriptId) {
          const transcript = await transcriptionService.getTranscript(job.transcriptId, tenantId);
          return res.json({ ...job, transcript });
        }

        res.json(job);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * DELETE /api/ai/transcriptions/:jobId
   * Delete transcription
   */
  app.delete(
    "/api/ai/transcriptions/:transcriptId",
    authenticate,
    authorize([PERMISSIONS.CALLS_RECORD]),
    async (req: Request, res: Response) => {
      try {
        const { transcriptId } = req.params;
        const tenantId = req.user!.tenantId;

        await transcriptionService.deleteTranscript(transcriptId, tenantId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // ==================== NLU ====================

  /**
   * POST /api/ai/nlu/parse
   * Parse text for intents and entities
   */
  app.post(
    "/api/ai/nlu/parse",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { text, sourceType, sourceId } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!text) {
          return res.status(400).json({ error: "text is required" });
        }

        const result = await nluService.parseText(
          tenantId,
          text,
          sourceType || "message",
          sourceId,
          userId
        );

        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/ai/nlu/batch
   * Batch classify messages
   */
  app.post(
    "/api/ai/nlu/batch",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { texts } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!Array.isArray(texts)) {
          return res.status(400).json({ error: "texts must be an array" });
        }

        const results = await nluService.batchClassify(tenantId, texts, userId);
        res.json({ results });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );


  // ==================== Bot / Conversational ====================

  /**
   * POST /api/ai/bot/session
   * Create bot session
   */
  app.post(
    "/api/ai/bot/session",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { customerId, ticketId, channel } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!channel) {
          return res.status(400).json({ error: "channel is required" });
        }

        const sessionId = await botService.createSession(tenantId, {
          customerId,
          ticketId,
          channel,
          userId,
        });

        res.json({ sessionId });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * GET /api/ai/bot/session/:id
   * Get bot session
   */
  app.get(
    "/api/ai/bot/session/:id",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const tenantId = req.user!.tenantId;

        const session = await botService.getSession(id, tenantId);
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }

        const messages = await botService.getSessionMessages(id, tenantId);

        res.json({ ...session, messages });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/ai/bot/message
   * Send message to bot
   */
  app.post(
    "/api/ai/bot/message",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { sessionId, message } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!sessionId || !message) {
          return res.status(400).json({ error: "sessionId and message are required" });
        }

        const response = await botService.processMessage(tenantId, sessionId, message, userId);
        res.json(response);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // ==================== Agent Assist ====================

  /**
   * POST /api/ai/assist
   * Get assist suggestions
   */
  app.post(
    "/api/ai/assist",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { messages, ticketId, customerId, context } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: "messages array is required" });
        }

        const suggestions = await assistService.getSuggestions(
          tenantId,
          {
            messages,
            ticketId,
            customerId,
            context,
          },
          userId
        );

        res.json({ suggestions });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/ai/summarize
   * Generate summary
   */
  app.post(
    "/api/ai/summarize",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { sourceType, sourceId, content } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!sourceType || !sourceId || !content) {
          return res.status(400).json({ error: "sourceType, sourceId, and content are required" });
        }

        const summary = await assistService.generateSummary(
          tenantId,
          sourceType,
          sourceId,
          content,
          userId
        );

        res.json({ summary });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  /**
   * POST /api/ai/actions/extract
   * Extract actionable tasks
   */
  app.post(
    "/api/ai/actions/extract",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { sourceType, sourceId, text } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!sourceType || !sourceId || !text) {
          return res.status(400).json({ error: "sourceType, sourceId, and text are required" });
        }

        const actions = await assistService.extractActions(tenantId, sourceType, sourceId, text, userId);
        res.json({ actions });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // ==================== NLQ (Natural Language Query) ====================

  /**
   * POST /api/ai/nlq
   * Parse and execute natural language query
   */
  app.post(
    "/api/ai/nlq",
    authenticate,
    authorize([PERMISSIONS.TICKETS_READ]),
    async (req: Request, res: Response) => {
      try {
        const { question, execute } = req.body;
        const tenantId = req.user!.tenantId;
        const userId = req.user!.id;

        if (!question) {
          return res.status(400).json({ error: "question is required" });
        }

        const queryPlan = await nlqService.parseQuery(tenantId, question, userId);

        if (execute && queryPlan.type === "read" && queryPlan.riskLevel === "low" && !queryPlan.requiresConfirmation) {
          const result = await nlqService.executeQuery(tenantId, queryPlan, userId);
          return res.json(result);
        }

        // Return query plan for confirmation
        res.json({
          queryPlan,
          clarificationPrompts: queryPlan.requiresConfirmation
            ? nlqService.getClarificationPrompts(question)
            : undefined,
        });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  // ==================== AI Models ====================

  /**
   * GET /api/ai/models
   * List available models
   */
  app.get(
    "/api/ai/models",
    authenticate,
    authorize([PERMISSIONS.TENANT_READ]),
    async (req: Request, res: Response) => {
      try {
        const models = [
          { provider: "openai", name: "gpt-4", description: "GPT-4" },
          { provider: "openai", name: "gpt-3.5-turbo", description: "GPT-3.5 Turbo" },
          { provider: "anthropic", name: "claude-3-opus", description: "Claude 3 Opus" },
          { provider: "local", name: "local-model", description: "Local/On-premise model" },
        ];

        res.json({ models });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

}

