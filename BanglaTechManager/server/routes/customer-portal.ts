/**
 * Customer Portal Routes
 * All endpoints under /api/customers/me/* for customer-specific operations
 * Enforces tenant isolation and customer role validation
 */

import { Express, Request, Response } from "express";
import { authenticate, requireCustomer } from "../auth";
import { storage } from "../storage";
import { insertTicketSchema, insertMessageSchema } from "@shared/schema";
import { emailService } from "../email-service";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logAuditEvent } from "../audit-service";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    // Note: req.user is set by authenticate middleware which runs before multer
    // So we can safely access it here
    const tenantId = (req as any).user?.tenantId || (req as any).user?.tenant_id || "default";
    const tenantDir = path.join(uploadDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename to prevent path traversal
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const upload = multer({
  storage: storageConfig,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Invalid file type. Allowed: images, PDF, documents"));
  },
});

// SSE connections map: userId -> Response
const sseConnections = new Map<string, Response>();

/**
 * Push event to customer via SSE
 */
export function pushEventToCustomer(userId: string, event: { type: string; data: any }) {
  const res = sseConnections.get(userId);
  if (res) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function registerCustomerPortalRoutes(app: Express) {
  // Middleware to ensure JSON responses for all customer portal routes
  const ensureJsonResponse = (req: Request, res: Response, next: any) => {
    res.setHeader("Content-Type", "application/json");
    next();
  };

  // Get customer profile
  app.get("/api/customers/me", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      
      const customer = await storage.getCustomer(customerId, tenantId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Get customer's ticket stats
      const tickets = await storage.listCustomerTicketsForUser(tenantId, customerId);
      const openTickets = tickets.filter((t) => t.status === "open" || t.status === "new" || t.status === "pending");
      const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

      res.json({
        ...customer,
        stats: {
          totalTickets: tickets.length,
          openTickets: openTickets.length,
          resolvedTickets: resolvedTickets.length,
        },
      });
    } catch (error: any) {
      console.error("Error fetching customer profile:", error);
      res.status(500).json({ error: "Failed to fetch customer profile" });
    }
  });

  // List customer tickets
  app.get("/api/customers/me/tickets", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;

      const tickets = await storage.listCustomerTicketsForUser(tenantId, customerId, {
        status,
        priority,
      });

      // Get messages count for each ticket
      const ticketsWithMessages = await Promise.all(
        tickets.map(async (ticket) => {
          const messages = await storage.listMessages(tenantId, ticket.id);
          return {
            ...ticket,
            messageCount: messages.length,
            lastMessageAt: messages.length > 0 ? messages[messages.length - 1].createdAt : ticket.createdAt,
          };
        })
      );

      res.json(ticketsWithMessages);
    } catch (error: any) {
      console.error("Error fetching customer tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // Create ticket
  app.post("/api/customers/me/tickets", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {

      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const userId = req.user!.id;

      console.log("[CUSTOMER PORTAL] Creating ticket:", { tenantId, customerId, userId, body: req.body });

      const { title, description, category, priority, type, attachmentIds } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: "Title and description are required" });
      }

      if (!tenantId || !customerId || !userId) {
        console.error("[CUSTOMER PORTAL] Missing required fields:", { tenantId, customerId, userId });
        return res.status(400).json({ error: "Invalid user context" });
      }

      const ticket = await storage.createTicketForCustomer(
        tenantId,
        customerId,
        userId,
        {
          title: title.trim(),
          description: description.trim(),
          category: category || "support",
          priority: priority || "medium",
          type: type || "issue",
        }
      );

      console.log("[CUSTOMER PORTAL] Ticket created:", ticket.id);

      // Create initial message (ticket description is the first message)
      try {
        await storage.addMessageByCustomer(tenantId, ticket.id, userId, description.trim(), attachmentIds || []);
        console.log("[CUSTOMER PORTAL] Initial message created");
      } catch (msgError: any) {
        console.error("[CUSTOMER PORTAL] Failed to create initial message:", msgError);
        // Continue even if message creation fails
      }

      // Notify tenant admin/agents
      try {
        await emailService.sendTicketCreatedNotification(ticket);
      } catch (emailError) {
        console.error("Failed to send ticket notification:", emailError);
        // Continue even if email fails
      }

      // Push SSE event
      try {
        pushEventToCustomer(userId, {
          type: "ticket_created",
          data: { ticketId: ticket.id, title: ticket.title },
        });
      } catch (sseError) {
        console.error("Failed to push SSE event:", sseError);
        // Continue even if SSE fails
      }

      console.log("[CUSTOMER PORTAL] Ticket creation successful:", ticket.id);
      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("[CUSTOMER PORTAL] Error creating ticket:", error);
      console.error("[CUSTOMER PORTAL] Error stack:", error.stack);
      
      // Ensure we return JSON error, not HTML
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ 
        error: "Failed to create ticket",
        message: error.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  });

  // Get single ticket with messages
  app.get("/api/customers/me/tickets/:ticketId", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const { ticketId } = req.params;

      const ticket = await storage.getCustomerTicketForUser(tenantId, ticketId, customerId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Get messages
      const messages = await storage.listMessages(tenantId, ticketId);

      // Get attachments
      const memStorage = storage as any;
      const files = memStorage.files
        ? Array.from(memStorage.files.values()).filter(
            (f: any) => f.resourceType === "ticket" && f.resourceId === ticketId && f.tenantId === tenantId
          )
        : [];

      // Get feedback if exists
      const feedback = memStorage.ticketFeedback
        ? Array.from(memStorage.ticketFeedback.values()).find(
            (f: any) => f.ticketId === ticketId && f.customerId === customerId
          )
        : null;

      res.json({
        ...ticket,
        messages,
        attachments: files,
        feedback,
      });
    } catch (error: any) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // Add message to ticket
  app.post("/api/customers/me/tickets/:ticketId/messages", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const userId = req.user!.id;
      const { ticketId } = req.params;
      const { body, attachmentIds } = req.body;

      if (!body || body.trim().length === 0) {
        return res.status(400).json({ error: "Message body is required" });
      }

      // Verify ticket ownership
      const ticket = await storage.getCustomerTicketForUser(tenantId, ticketId, customerId);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const message = await storage.addMessageByCustomer(
        tenantId,
        ticketId,
        userId,
        body,
        attachmentIds || []
      );

      // Notify assigned agent
      if (ticket.assigneeId) {
        try {
          await emailService.sendMessageNotification(ticket, message);
        } catch (emailError) {
          console.error("Failed to send message notification:", emailError);
        }
      }

      // Push SSE event
      pushEventToCustomer(userId, {
        type: "new_message",
        data: { ticketId, messageId: message.id },
      });

      res.status(201).json(message);
    } catch (error: any) {
      console.error("Error adding message:", error);
      res.status(500).json({ error: "Failed to add message" });
    }
  });

  // Upload attachment
  app.post(
    "/api/customers/me/tickets/:ticketId/attachments",
    authenticate,
    requireCustomer,
    (req, res, next) => {
      // Multer middleware - single file upload
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          return res.status(400).json({ error: err.message || "File upload failed" });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const tenantId = req.user!.tenant_id!;
        const customerId = req.user!.customerId!;
        const userId = req.user!.id;
        const { ticketId } = req.params;

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Verify ticket ownership
        const ticket = await storage.getCustomerTicketForUser(tenantId, ticketId, customerId);
        if (!ticket) {
          // Delete uploaded file if ticket not found
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "Ticket not found" });
        }

        // Store relative path for portability
        const relativePath = path.relative(process.cwd(), req.file.path);
        const file = await storage.addAttachment(tenantId, userId, ticketId, {
          filename: req.file.filename,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: relativePath, // Store relative path
          storageProvider: "local",
        });

        res.status(201).json({
          ...file,
          url: `/api/files/${file.id}`,
        });
      } catch (error: any) {
        console.error("Error uploading attachment:", error);
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Failed to upload attachment" });
      }
    }
  );

  // Create call request
  app.post("/api/customers/me/calls", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const userId = req.user!.id;
      const { ticketId, scheduledAt, note } = req.body;

      const call = await storage.createCallRequestForCustomer(
        tenantId,
        ticketId || null,
        customerId,
        userId,
        scheduledAt ? new Date(scheduledAt) : undefined,
        note
      );

      // Notify agents
      try {
        await emailService.sendCallRequestNotification(call);
      } catch (emailError) {
        console.error("Failed to send call notification:", emailError);
      }

      // Push SSE event
      pushEventToCustomer(userId, {
        type: "call_requested",
        data: { callId: call.id },
      });

      res.status(201).json(call);
    } catch (error: any) {
      console.error("Error creating call request:", error);
      res.status(500).json({ error: "Failed to create call request" });
    }
  });

  // Get notifications
  app.get("/api/customers/me/notifications", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const userId = req.user!.id;

      const notifications = await storage.listNotificationsForUser(tenantId, userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Submit feedback
  app.post("/api/customers/me/feedback", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const customerId = req.user!.customerId!;
      const { ticketId, rating, comment } = req.body;

      if (!ticketId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Ticket ID and rating (1-5) are required" });
      }

      const feedback = await storage.submitTicketFeedback(tenantId, ticketId, customerId, rating, comment);

      // Notify tenant admin
      try {
        const ticket = await storage.getTicket(ticketId, tenantId);
        if (ticket) {
          await emailService.sendFeedbackNotification(ticket, feedback);
        }
      } catch (emailError) {
        console.error("Failed to send feedback notification:", emailError);
      }

      res.status(201).json(feedback);
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: error.message || "Failed to submit feedback" });
    }
  });

  // Knowledge base search (stub)
  app.get("/api/customers/me/kb", authenticate, requireCustomer, ensureJsonResponse, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      
      // Stub implementation - return empty or seeded articles
      const articles = [
        {
          id: "1",
          title: "How to create a support ticket",
          content: "You can create a support ticket by clicking the 'New Ticket' button...",
          category: "Getting Started",
        },
        {
          id: "2",
          title: "How to track your ticket status",
          content: "You can view all your tickets in the 'My Tickets' section...",
          category: "Tickets",
        },
      ].filter((article) =>
        query ? article.title.toLowerCase().includes(query.toLowerCase()) : true
      );

      res.json({ articles, query });
    } catch (error: any) {
      console.error("Error searching KB:", error);
      res.status(500).json({ error: "Failed to search knowledge base" });
    }
  });

  // Serve uploaded files
  app.get("/api/files/:fileId", authenticate, requireCustomer, async (req, res) => {
    try {
      const tenantId = req.user!.tenant_id!;
      const { fileId } = req.params;

      const memStorage = storage as any;
      if (!memStorage.files) {
        return res.status(404).json({ error: "File not found" });
      }

      const file = memStorage.files.get(fileId);
      if (!file || file.tenantId !== tenantId) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify user has access to the resource
      if (file.resourceType === "ticket") {
        const ticket = await storage.getCustomerTicketForUser(tenantId, file.resourceId, req.user!.customerId!);
        if (!ticket) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Resolve file path (handle both absolute and relative paths)
      const filePath = path.isAbsolute(file.storagePath) 
        ? file.storagePath 
        : path.resolve(process.cwd(), file.storagePath);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${file.originalFilename}"`);
      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // SSE endpoint for real-time events
  app.get("/api/customers/me/events", authenticate, requireCustomer, (req, res) => {
    const userId = req.user!.id;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Store connection
    sseConnections.set(userId, res);

    // Handle client disconnect
    req.on("close", () => {
      sseConnections.delete(userId);
      res.end();
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      if (!sseConnections.has(userId)) {
        clearInterval(heartbeat);
        return;
      }
      try {
        res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
      } catch (error) {
        clearInterval(heartbeat);
        sseConnections.delete(userId);
        res.end();
      }
    }, 30000); // Every 30 seconds
  });
}

