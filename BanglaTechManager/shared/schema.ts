import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, pgEnum, boolean, jsonb, bigint, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["super_admin", "tenant_admin", "support_agent", "customer"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["new", "open", "pending", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["support", "bug", "feature"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive"]);
export const callStatusEnum = pgEnum("call_status", ["ringing", "in_progress", "completed", "missed", "failed", "busy", "no_answer", "cancelled"]);
export const callDispositionEnum = pgEnum("call_disposition", ["answered", "busy", "no_answer", "voicemail", "dropped", "transferred", "on_hold"]);
export const phoneNumberStatusEnum = pgEnum("phone_number_status", ["active", "pending", "suspended", "released"]);
export const recordingStatusEnum = pgEnum("recording_status", ["pending", "recording", "completed", "failed", "deleted"]);
export const telephonyProviderEnum = pgEnum("telephony_provider", ["twilio", "vonage", "plivo", "asterisk", "freeswitch", "custom"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageTypeEnum = pgEnum("message_type", ["message", "internal_note"]);
export const ticketTypeEnum = pgEnum("ticket_type", ["issue", "request", "question", "complaint"]);
export const ticketChannelEnum = pgEnum("ticket_channel", ["email", "phone", "whatsapp", "telegram", "chat", "api", "ui"]);
export const notificationTypeEnum = pgEnum("notification_type", ["email", "sms", "telegram", "in_app"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "trialing", "suspended", "canceled", "deleted"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete", "login", "logout", "impersonate", "export", "import", "quota_exceeded", "quota_warning", "permission_denied", "role_assign", "role_revoke", "password_reset", "session_revoke"]);

// Tenants table - Enhanced with lifecycle, configuration, and quotas
export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-friendly identifier
  contactEmail: varchar("contact_email", { length: 150 }).notNull(),
  status: tenantStatusEnum("status").default("active").notNull(),
  plan: varchar("plan", { length: 50 }).default("basic").notNull(), // basic, pro, enterprise
  // Configuration stored as JSONB for flexibility
  settings: jsonb("settings").$type<{
    branding?: { logo?: string; primaryColor?: string; secondaryColor?: string };
    features?: { voice?: boolean; whatsapp?: boolean; analytics?: boolean; ai?: boolean };
    customFields?: Record<string, any>;
    notificationChannels?: string[];
  }>().default({}),
  // Quotas and limits
  quotaMaxUsers: integer("quota_max_users").default(10),
  quotaMaxCustomers: integer("quota_max_customers").default(1000),
  quotaMaxStorage: bigint("quota_max_storage", { mode: "number" }).default(10737418240), // 10GB in bytes
  quotaMaxApiCalls: integer("quota_max_api_calls").default(10000), // per month
  // Billing
  billingState: varchar("billing_state", { length: 50 }).default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// Users table - Enhanced with active status
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(), // Legacy field, kept for backward compatibility
  isActive: boolean("is_active").default(true).notNull(),
  // Customer relationship - if role is "customer", this links to customers table
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
  // Metadata
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customers table - Enhanced with multiple contacts, custom fields, tags
export const customers = pgTable("customers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  // Primary contact (legacy fields for backward compatibility)
  email: varchar("email", { length: 150 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  // Multiple contact channels (stored as JSONB arrays)
  phones: jsonb("phones").$type<string[]>().default([]), // Array of phone numbers
  emails: jsonb("emails").$type<string[]>().default([]), // Array of email addresses
  primaryPhone: varchar("primary_phone", { length: 20 }), // Index of primary phone in phones array
  primaryEmail: varchar("primary_email", { length: 150 }), // Index of primary email in emails array
  // Contact information
  company: varchar("company", { length: 150 }),
  title: varchar("title", { length: 100 }),
  source: varchar("source", { length: 50 }), // How customer was acquired
  status: customerStatusEnum("status").default("active").notNull(),
  // Custom fields (tenant-defined schema stored as JSONB)
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
  // Metadata
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  userId: varchar("user_id", { length: 36 }).references(() => users.id), // Link to user account if customer has login
  telegramId: varchar("telegram_id", { length: 100 }),
  // Soft delete
  deletedAt: timestamp("deleted_at"),
  customerDeletedAt: timestamp("customer_deleted_at"), // For orphaned tickets
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tickets table - Enhanced with SLA, tags, custom fields, linking
export const tickets = pgTable("tickets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
  assigneeId: varchar("assignee_id", { length: 36 }).references(() => users.id), // Current assignee
  // Ticket details
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(), // Initial message
  type: ticketTypeEnum("type").default("issue").notNull(),
  category: ticketCategoryEnum("category").notNull(),
  status: ticketStatusEnum("status").default("new").notNull(),
  priority: ticketPriorityEnum("priority").default("medium").notNull(),
  channel: ticketChannelEnum("channel").default("ui").notNull(),
  // Labels
  labels: jsonb("labels").$type<string[]>().default([]), // Array of label names
  // Custom fields
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
  // Ticket linking
  parentTicketId: varchar("parent_ticket_id", { length: 36 }), // For parent-child relationships (self-reference)
  duplicateOfTicketId: varchar("duplicate_of_ticket_id", { length: 36 }), // For duplicate tracking (self-reference)
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Channel metadata, thread IDs, etc.
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id).notNull(),
  // Soft delete
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"), // When ticket was resolved
  closedAt: timestamp("closed_at"), // When ticket was closed
});

// Messages table - Enhanced with direction, type, attachments
export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id).notNull(),
  senderId: varchar("sender_id", { length: 36 }).references(() => users.id), // Nullable for external senders
  authorRef: varchar("author_ref", { length: 100 }), // User ID or external identifier
  body: text("body").notNull(), // Message content
  direction: messageDirectionEnum("direction").default("outbound").notNull(),
  type: messageTypeEnum("type").default("message").notNull(), // message or internal_note
  // Attachments
  attachments: jsonb("attachments").$type<string[]>().default([]), // Array of attachment IDs
  // External channel metadata
  channelId: varchar("channel_id", { length: 100 }), // Channel-specific message ID
  channelMessageId: varchar("channel_message_id", { length: 100 }), // External message ID
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phone Numbers table - Provisioned phone numbers per tenant
export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  provider: telephonyProviderEnum("provider").notNull(),
  number: varchar("number", { length: 20 }).notNull(), // E.164 format
  providerNumberId: varchar("provider_number_id", { length: 100 }), // Provider's ID for this number
  region: varchar("region", { length: 50 }), // Country/region code
  capabilities: jsonb("capabilities").$type<{
    inbound: boolean;
    outbound: boolean;
    sms: boolean;
    mms: boolean;
  }>().default({ inbound: true, outbound: true, sms: false, mms: false }),
  status: phoneNumberStatusEnum("status").default("active").notNull(),
  webhookUrl: varchar("webhook_url", { length: 500 }), // Platform webhook endpoint for this number
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phone Calls table - Enhanced with recording, transcript links, and provider integration
export const phoneCalls = pgTable("phone_calls", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 36 }).references(() => phoneNumbers.id), // Provisioned number used
  externalCallId: varchar("external_call_id", { length: 100 }), // Provider's call ID (e.g., Twilio CallSid)
  // Participants
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id), // Optional: matched customer
  agentId: varchar("agent_id", { length: 36 }).references(() => users.id), // Agent who handled call
  userId: varchar("user_id", { length: 36 }).references(() => users.id), // Legacy field
  ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id),
  // Call details
  direction: varchar("direction", { length: 20 }).notNull(), // "inbound" or "outbound"
  fromNumber: varchar("from_number", { length: 20 }).notNull(), // Caller number (E.164)
  toNumber: varchar("to_number", { length: 20 }).notNull(), // Called number (E.164)
  status: callStatusEnum("status").default("ringing").notNull(),
  disposition: callDispositionEnum("disposition"),
  // Timing
  startTime: timestamp("start_time").notNull(),
  answeredTime: timestamp("answered_time"), // When call was answered
  endTime: timestamp("end_time"),
  duration: integer("duration"), // in seconds
  // Recording and transcript
  recordingId: varchar("recording_id", { length: 36 }), // Reference to Recording record
  transcriptId: varchar("transcript_id", { length: 36 }), // Reference to Transcript record
  recordingUrl: varchar("recording_url", { length: 500 }), // Legacy: direct URL (deprecated, use recordingId)
  transcriptRef: varchar("transcript_ref", { length: 36 }), // Legacy: transcript reference
  transcript: text("transcript"), // Legacy: direct transcript text
  // Notes and metadata
  notes: text("notes"), // Agent notes about the call
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Transfer, hold, mute events, provider data
  callStartTime: timestamp("call_start_time"), // Legacy field
  callEndTime: timestamp("call_end_time"), // Legacy field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Recordings table - Call recordings stored per tenant
export const recordings = pgTable("recordings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  callId: varchar("call_id", { length: 36 }).references(() => phoneCalls.id).notNull(),
  providerRecordingId: varchar("provider_recording_id", { length: 100 }), // Provider's recording ID
  storagePath: varchar("storage_path", { length: 500 }).notNull(), // Tenant-prefixed storage path
  format: varchar("format", { length: 20 }).default("mp3"), // mp3, wav, etc.
  sizeBytes: bigint("size_bytes", { mode: "number" }), // File size
  duration: integer("duration"), // Recording duration in seconds
  encryptionKeyRef: varchar("encryption_key_ref", { length: 100 }), // KMS key reference
  status: recordingStatusEnum("status").default("pending").notNull(),
  providerUrl: varchar("provider_url", { length: 500 }), // Original provider URL (temporary)
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  downloadedAt: timestamp("downloaded_at"), // When recording was fetched from provider
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// Call Logs table - Call lifecycle events for timeline and audit
export const callLogs = pgTable("call_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  callId: varchar("call_id", { length: 36 }).references(() => phoneCalls.id).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // "ringing", "answered", "hold", "transfer", "mute", "ended"
  userId: varchar("user_id", { length: 36 }).references(() => users.id), // User who triggered event (if applicable)
  description: text("description"), // Human-readable description
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}), // Event-specific data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Integration Credentials table - Per-tenant external service credentials
export const integrationCredentials = pgTable("integration_credentials", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // gmail, twilio, whatsapp, etc.
  encryptedCredentials: text("encrypted_credentials").notNull(), // Encrypted JSON
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Logs table - Track all tenant-scoped actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  action: auditActionEnum("action").notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // customer, ticket, user, etc.
  resourceId: varchar("resource_id", { length: 36 }),
  details: jsonb("details").$type<Record<string, any>>(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  impersonatedBy: varchar("impersonated_by", { length: 36 }).references(() => users.id), // For super-admin impersonation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tenant Usage Metrics table - Track usage per tenant for quota enforcement
export const tenantUsageMetrics = pgTable("tenant_usage_metrics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  period: varchar("period", { length: 10 }).notNull(), // YYYY-MM format
  // Counts
  apiCalls: integer("api_calls").default(0),
  activeUsers: integer("active_users").default(0),
  storageUsed: bigint("storage_used", { mode: "number" }).default(0), // bytes
  callMinutes: integer("call_minutes").default(0),
  messagesSent: integer("messages_sent").default(0),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Files/Attachments table - Per-tenant file storage
export const files = pgTable("files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // ticket, customer, message, etc.
  resourceId: varchar("resource_id", { length: 36 }).notNull(), // ID of the resource this file belongs to
  filename: varchar("filename", { length: 255 }).notNull(),
  originalFilename: varchar("original_filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  size: bigint("size", { mode: "number" }).notNull(), // File size in bytes
  storagePath: varchar("storage_path", { length: 500 }).notNull(), // Tenant-prefixed storage path
  storageProvider: varchar("storage_provider", { length: 50 }).default("local").notNull(), // local, s3, azure, etc.
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ticket Feedback table - Customer feedback on resolved tickets
export const ticketFeedback = pgTable("ticket_feedback", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id).notNull(),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"), // Optional feedback text
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Role Templates table - Global role definitions with default permissions
export const roleTemplates = pgTable("role_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(), // tenant_admin, support_agent, etc.
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<{
    customers?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    tickets?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    users?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    settings?: { read: boolean; update: boolean };
    analytics?: { read: boolean };
  }>().notNull(),
  isSystem: boolean("is_system").default(false).notNull(), // System roles cannot be deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tenant Roles table - Per-tenant role customizations (overrides global templates)
export const tenantRoles = pgTable("tenant_roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  roleName: varchar("role_name", { length: 50 }).notNull(), // References role_templates.name
  displayName: varchar("display_name", { length: 100 }),
  permissions: jsonb("permissions").$type<{
    customers?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    tickets?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    users?: { read: boolean; create: boolean; update: boolean; delete: boolean };
    settings?: { read: boolean; update: boolean };
    analytics?: { read: boolean };
  }>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTenantRole: unique().on(table.tenantId, table.roleName),
}));

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).extend({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertPhoneCallSchema = createInsertSchema(phoneCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecordingSchema = createInsertSchema(recordings).omit({
  id: true,
  createdAt: true,
  downloadedAt: true,
  deletedAt: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export const insertIntegrationCredentialSchema = createInsertSchema(integrationCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTenantUsageMetricSchema = createInsertSchema(tenantUsageMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertTicketFeedbackSchema = createInsertSchema(ticketFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertRoleTemplateSchema = createInsertSchema(roleTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantRoleSchema = createInsertSchema(tenantRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type PhoneCall = typeof phoneCalls.$inferSelect;
export type InsertPhoneCall = z.infer<typeof insertPhoneCallSchema>;

export type PhoneNumber = typeof phoneNumbers.$inferSelect;
export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;

export type Recording = typeof recordings.$inferSelect;
export type InsertRecording = z.infer<typeof insertRecordingSchema>;

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type IntegrationCredential = typeof integrationCredentials.$inferSelect;
export type InsertIntegrationCredential = z.infer<typeof insertIntegrationCredentialSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type TenantUsageMetric = typeof tenantUsageMetrics.$inferSelect;
export type InsertTenantUsageMetric = z.infer<typeof insertTenantUsageMetricSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type TicketFeedback = typeof ticketFeedback.$inferSelect;
export type InsertTicketFeedback = z.infer<typeof insertTicketFeedbackSchema>;

export type RoleTemplate = typeof roleTemplates.$inferSelect;
export type InsertRoleTemplate = z.infer<typeof insertRoleTemplateSchema>;

export type TenantRole = typeof tenantRoles.$inferSelect;
export type InsertTenantRole = z.infer<typeof insertTenantRoleSchema>;

// ==================== Feature 3: CRM Core Entities ====================



// Activity / Timeline Entry table - Unified activity feed
export const activities = pgTable("activities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  entityRef: varchar("entity_ref", { length: 36 }).notNull(), // ID of customer, ticket, call, etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // customer, ticket, call, message
  action: varchar("action", { length: 50 }).notNull(), // created, updated, assigned, replied, etc.
  actorRef: varchar("actor_ref", { length: 36 }), // User ID or system
  actorType: varchar("actor_type", { length: 20 }).default("user"), // user, system, external
  // Details stored as JSONB (before/after snapshots, change descriptions)
  details: jsonb("details").$type<Record<string, any>>().default({}),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ticket Assignment History table - Track assignment changes
export const ticketAssignments = pgTable("ticket_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  assigneeId: varchar("assignee_id", { length: 36 }).references(() => users.id), // User or null (unassigned)
  teamId: varchar("team_id", { length: 36 }), // Team assignment (if using teams)
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  unassignedAt: timestamp("unassigned_at"), // When this assignment ended
  isCurrent: boolean("is_current").default(true).notNull(), // Current assignment flag
});

// Insert schemas for new tables


export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export const insertTicketAssignmentSchema = createInsertSchema(ticketAssignments).omit({
  id: true,
  assignedAt: true,
  unassignedAt: true,
});

// Types for new tables


export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type TicketAssignment = typeof ticketAssignments.$inferSelect;
export type InsertTicketAssignment = z.infer<typeof insertTicketAssignmentSchema>;

// ==================== RBAC Tables ====================

// Permissions table - Canonical list of permissions
export const permissions = pgTable("permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 100 }).notNull().unique(), // e.g., "users.read", "customers.create"
  description: text("description"),
  category: varchar("category", { length: 50 }), // e.g., "users", "customers", "tickets"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Roles table - Tenant-scoped or global (tenant_id nullable for super-admin roles)
export const roles = pgTable("roles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id), // NULL for global/system roles
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Admin", "Manager", "Agent", "Viewer"
  description: text("description"),
  isSystemDefault: boolean("is_system_default").default(false).notNull(), // System roles cannot be deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueTenantRole: unique().on(table.tenantId, table.name),
}));

// Role Permissions junction table
export const rolePermissions = pgTable("role_permissions", {
  roleId: varchar("role_id", { length: 36 }).references(() => roles.id).notNull(),
  permissionId: varchar("permission_id", { length: 36 }).references(() => permissions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: unique().on(table.roleId, table.permissionId),
}));

// User Roles junction table
export const userRoles = pgTable("user_roles", {
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  roleId: varchar("role_id", { length: 36 }).references(() => roles.id).notNull(),
  assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (table) => ({
  pk: unique().on(table.userId, table.roleId),
}));

// User Permission Overrides - Allow/deny specific permissions for users
export const userPermissionOverrides = pgTable("user_permission_overrides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  permissionId: varchar("permission_id", { length: 36 }).references(() => permissions.id).notNull(),
  allow: boolean("allow").notNull(), // true = allow, false = deny (deny takes precedence)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
}, (table) => ({
  uniqueUserPermission: unique().on(table.userId, table.permissionId),
}));

// Teams table - Groups of users within a tenant
export const teams = pgTable("teams", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Team Members junction table
export const teamMembers = pgTable("team_members", {
  teamId: varchar("team_id", { length: 36 }).references(() => teams.id).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  pk: unique().on(table.teamId, table.userId),
}));

// Team Roles junction table - Roles assigned to teams
export const teamRoles = pgTable("team_roles", {
  teamId: varchar("team_id", { length: 36 }).references(() => teams.id).notNull(),
  roleId: varchar("role_id", { length: 36 }).references(() => roles.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (table) => ({
  pk: unique().on(table.teamId, table.roleId),
}));


// Sessions table - For token/session revocation
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(), // Hashed refresh token
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revoked Tokens table - For tracking revoked tokens (alternative to sessions table)
export const revokedTokens = pgTable("revoked_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  revokedAt: timestamp("revoked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Original token expiry
});

// MCP (Master Control Plane) Tables
export const mcpAuditLogs = pgTable("mcp_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id", { length: 36 }).references(() => users.id).onDelete("set null"),
  actorRole: varchar("actor_role", { length: 50 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetTenantId: varchar("target_tenant_id", { length: 36 }).references(() => tenants.id).onDelete("set null"),
  payload: jsonb("payload").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tenantFeatureFlags = pgTable("tenant_feature_flags", {
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).onDelete("cascade").notNull(),
  flagKey: varchar("flag_key", { length: 100 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pk: unique().on(table.tenantId, table.flagKey),
}));

// Insert schemas for RBAC tables
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  assignedAt: true,
});

export const insertUserPermissionOverrideSchema = createInsertSchema(userPermissionOverrides).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  joinedAt: true,
});

export const insertTeamRoleSchema = createInsertSchema(teamRoles).omit({
  assignedAt: true,
});


export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  revoked: true,
  revokedAt: true,
});

export const insertRevokedTokenSchema = createInsertSchema(revokedTokens).omit({
  id: true,
  revokedAt: true,
});

// Types for RBAC tables
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = z.infer<typeof insertUserPermissionOverrideSchema>;

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;

export type TeamRole = typeof teamRoles.$inferSelect;
export type InsertTeamRole = z.infer<typeof insertTeamRoleSchema>;


export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type RevokedToken = typeof revokedTokens.$inferSelect;
export type InsertRevokedToken = z.infer<typeof insertRevokedTokenSchema>;

// ==================== Feature 4: AI Layer & Conversational Intelligence ====================

// AI Model Configuration enum
export const aiModelProviderEnum = pgEnum("ai_model_provider", ["openai", "anthropic", "azure", "local", "custom"]);
export const aiJobStatusEnum = pgEnum("ai_job_status", ["pending", "processing", "completed", "failed", "cancelled"]);
export const aiIntentEnum = pgEnum("ai_intent", ["billing_inquiry", "password_reset", "product_issue", "feature_request", "complaint", "general_question", "technical_support", "account_management", "other"]);
export const aiEntityTypeEnum = pgEnum("ai_entity_type", ["phone", "email", "order_id", "appointment_time", "amount", "date", "person_name", "company_name", "product_name", "other"]);

// Transcripts table - Speech transcription results
export const transcripts = pgTable("transcripts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  callId: varchar("call_id", { length: 36 }).references(() => phoneCalls.id), // Optional: link to call
  recordingUrl: varchar("recording_url", { length: 500 }).notNull(), // Source audio
  // Transcript content
  fullText: text("full_text").notNull(), // Full transcript text
  segments: jsonb("segments").$type<Array<{
    start: number; // seconds
    end: number;
    speaker?: string; // speaker ID or "agent"/"customer"
    text: string;
    confidence: number; // 0-1
    words?: Array<{ word: string; start: number; end: number; confidence: number }>;
  }>>().default([]),
  // Metadata
  language: varchar("language", { length: 10 }).default("en"),
  diarized: boolean("diarized").default(false), // Speaker diarization applied
  piiRedacted: boolean("pii_redacted").default(false), // PII redaction applied
  confidence: integer("confidence"), // Overall confidence (0-100)
  duration: integer("duration"), // Audio duration in seconds
  // Job tracking
  jobId: varchar("job_id", { length: 100 }), // External job ID
  status: aiJobStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// NLU Results table - Intent and entity extraction results
export const nluResults = pgTable("nlu_results", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  // Source reference
  sourceType: varchar("source_type", { length: 50 }).notNull(), // "message", "transcript", "call"
  sourceId: varchar("source_id", { length: 36 }), // Message ID, transcript ID, etc.
  sourceText: text("source_text").notNull(), // Original text analyzed
  // Intent classification
  primaryIntent: aiIntentEnum("primary_intent"),
  intents: jsonb("intents").$type<Array<{
    intent: string;
    confidence: number; // 0-1
  }>>().default([]),
  // Entity extraction
  entities: jsonb("entities").$type<Array<{
    type: string;
    value: string;
    start: number; // Character offset
    end: number;
    confidence: number;
  }>>().default([]),
  // Sentiment & classification
  sentiment: varchar("sentiment", { length: 20 }), // "positive", "negative", "neutral"
  sentimentScore: integer("sentiment_score"), // -100 to 100
  // Metadata
  modelUsed: varchar("model_used", { length: 100 }),
  processingTime: integer("processing_time"), // milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bot Sessions table - Conversational bot state
export const botSessions = pgTable("bot_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  // Session context
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
  ticketId: varchar("ticket_id", { length: 36 }).references(() => tickets.id),
  channel: varchar("channel", { length: 50 }).notNull(), // "chat", "whatsapp", "email"
  // State management
  state: varchar("state", { length: 50 }).default("idle"), // Current conversation state
  slots: jsonb("slots").$type<Record<string, any>>().default({}), // Filled slots for multi-turn
  context: jsonb("context").$type<Record<string, any>>().default({}), // Additional context
  // Handover tracking
  handoverToAgent: boolean("handover_to_agent").default(false),
  handoverReason: text("handover_reason"),
  handoverAt: timestamp("handover_at"),
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
});

// Bot Messages table - Bot conversation history
export const botMessages = pgTable("bot_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id", { length: 36 }).references(() => botSessions.id).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  // Message content
  role: varchar("role", { length: 20 }).notNull(), // "user", "bot", "system"
  content: text("content").notNull(),
  // Bot-specific fields
  intent: varchar("intent", { length: 100 }),
  entities: jsonb("entities").$type<Record<string, any>>().default({}),
  suggestedActions: jsonb("suggested_actions").$type<Array<{
    type: string;
    label: string;
    payload: Record<string, any>;
  }>>().default([]),
  // Metadata
  confidence: integer("confidence"), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// AI Summaries table - Generated summaries for calls, tickets, conversations
export const aiSummaries = pgTable("ai_summaries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  // Source reference
  sourceType: varchar("source_type", { length: 50 }).notNull(), // "call", "ticket", "conversation"
  sourceId: varchar("source_id", { length: 36 }).notNull(), // Call ID, ticket ID, etc.
  // Summary content
  summary: text("summary").notNull(), // Short summary (1-3 sentences)
  actionItems: jsonb("action_items").$type<Array<{
    text: string;
    priority?: string;
    assignee?: string;
  }>>().default([]),
  // Extracted information
  extractedData: jsonb("extracted_data").$type<Record<string, any>>().default({}),
  // Metadata
  modelUsed: varchar("model_used", { length: 100 }),
  confidence: integer("confidence"), // 0-100
  evidence: jsonb("evidence").$type<Array<{
    type: string; // "message", "transcript_segment"
    id: string;
    text: string;
    timestamp?: number;
  }>>().default([]), // Source evidence with links
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Action Suggestions table - Extracted actionable tasks
export const aiActionSuggestions = pgTable("ai_action_suggestions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  // Source reference
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  // Action details
  actionType: varchar("action_type", { length: 100 }).notNull(), // "create_ticket", "send_refund", "schedule_callback", etc.
  parameters: jsonb("parameters").$type<Record<string, any>>().default({}),
  description: text("description"), // Human-readable description
  // Status
  status: varchar("status", { length: 50 }).default("suggested"), // "suggested", "accepted", "rejected", "executed"
  acceptedBy: varchar("accepted_by", { length: 36 }).references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  executedAt: timestamp("executed_at"),
  // Metadata
  confidence: integer("confidence"), // 0-100
  modelUsed: varchar("model_used", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Operation Logs table - Audit trail for all AI operations
export const aiOperationLogs = pgTable("ai_operation_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  // Operation details
  operationType: varchar("operation_type", { length: 50 }).notNull(), // "transcription", "nlu", "bot", "rag", "nlq", "summarize", "assist"
  modelProvider: varchar("model_provider", { length: 100 }),
  modelName: varchar("model_name", { length: 100 }),
  // Input/Output references
  inputRef: varchar("input_ref", { length: 500 }), // Pointer to input (URL, ID, etc.)
  inputHash: varchar("input_hash", { length: 64 }), // Hash of input for privacy
  outputRef: varchar("output_ref", { length: 500 }), // Pointer to output (transcript ID, summary ID, etc.)
  // Prompt & configuration
  promptTemplate: varchar("prompt_template", { length: 200 }), // Template identifier
  promptHash: varchar("prompt_hash", { length: 64 }), // Hash of actual prompt
  // Metrics
  tokensUsed: integer("tokens_used"), // Input + output tokens
  cost: integer("cost"), // Cost in cents
  latency: integer("latency"), // Milliseconds
  confidence: integer("confidence"), // 0-100
  // Status
  status: varchar("status", { length: 50 }).default("completed"), // "completed", "failed", "cancelled"
  errorMessage: text("error_message"),
  // User feedback
  userFeedback: varchar("user_feedback", { length: 20 }), // "positive", "negative", "neutral"
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// Insert schemas for AI tables
export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertNluResultSchema = createInsertSchema(nluResults).omit({
  id: true,
  createdAt: true,
});

export const insertBotSessionSchema = createInsertSchema(botSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivityAt: true,
});

export const insertBotMessageSchema = createInsertSchema(botMessages).omit({
  id: true,
  createdAt: true,
});


export const insertAiSummarySchema = createInsertSchema(aiSummaries).omit({
  id: true,
  createdAt: true,
});

export const insertAiActionSuggestionSchema = createInsertSchema(aiActionSuggestions).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
  executedAt: true,
});

export const insertAiOperationLogSchema = createInsertSchema(aiOperationLogs).omit({
  id: true,
  createdAt: true,
});


// Types for AI tables
export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;

export type NluResult = typeof nluResults.$inferSelect;
export type InsertNluResult = z.infer<typeof insertNluResultSchema>;

export type BotSession = typeof botSessions.$inferSelect;
export type InsertBotSession = z.infer<typeof insertBotSessionSchema>;

export type BotMessage = typeof botMessages.$inferSelect;
export type InsertBotMessage = z.infer<typeof insertBotMessageSchema>;


export type AiSummary = typeof aiSummaries.$inferSelect;
export type InsertAiSummary = z.infer<typeof insertAiSummarySchema>;

export type AiActionSuggestion = typeof aiActionSuggestions.$inferSelect;
export type InsertAiActionSuggestion = z.infer<typeof insertAiActionSuggestionSchema>;

export type AiOperationLog = typeof aiOperationLogs.$inferSelect;
export type InsertAiOperationLog = z.infer<typeof insertAiOperationLogSchema>;


// ==================== Feature 7: Third-Party Integrations & Connector Framework ====================

export const connectorStatusEnum = pgEnum("connector_status", ["active", "inactive", "deprecated", "beta"]);
export const integrationStatusEnum = pgEnum("integration_status", ["connected", "disconnected", "auth_failed", "error", "syncing", "paused"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "running", "completed", "failed", "cancelled"]);
export const syncDirectionEnum = pgEnum("sync_direction", ["inbound", "outbound", "bidirectional"]);
export const webhookStatusEnum = pgEnum("webhook_status", ["pending", "processed", "failed", "duplicate"]);

// Connectors table - Registry of available connectors
export const connectors = pgTable("connectors", {
  id: varchar("id", { length: 50 }).primaryKey(), // e.g., "gmail", "telegram", "slack"
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // "email", "calendar", "messaging", "telephony", "dev_tools", "payments"
  icon: varchar("icon", { length: 255 }), // URL or icon identifier
  // OAuth configuration
  oauthEnabled: boolean("oauth_enabled").default(false).notNull(),
  oauthAuthUrl: varchar("oauth_auth_url", { length: 500 }),
  oauthTokenUrl: varchar("oauth_token_url", { length: 500 }),
  oauthScopes: jsonb("oauth_scopes").$type<string[]>().default([]),
  // API configuration
  apiKeyRequired: boolean("api_key_required").default(false).notNull(),
  webhookSupported: boolean("webhook_supported").default(false).notNull(),
  webhookDocsUrl: varchar("webhook_docs_url", { length: 500 }),
  // Capabilities
  capabilities: jsonb("capabilities").$type<{
    inbound?: boolean;
    outbound?: boolean;
    bidirectional?: boolean;
    webhooks?: boolean;
    polling?: boolean;
    attachments?: boolean;
  }>().default({}),
  // Status
  status: connectorStatusEnum("status").default("active").notNull(),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integrations table - Tenant-scoped connector instances
export const integrations = pgTable("integrations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  connectorId: varchar("connector_id", { length: 50 }).references(() => connectors.id).notNull(),
  displayName: varchar("display_name", { length: 150 }),
  // Credentials reference (encrypted)
  encryptedCredentialsRef: varchar("encrypted_credentials_ref", { length: 100 }).notNull(), // Reference to encrypted storage
  // Configuration
  config: jsonb("config").$type<{
    webhookSecret?: string; // For webhook validation
    webhookUrl?: string; // Tenant-specific webhook endpoint
    mapping?: Record<string, any>; // Field mappings
    syncSettings?: {
      enabled?: boolean;
      direction?: "inbound" | "outbound" | "bidirectional";
      frequency?: string; // cron expression or interval
      lastSyncCursor?: string; // Provider-specific cursor/token
    };
    testMode?: boolean; // Mock/test mode flag
  }>().default({}),
  // Status & health
  status: integrationStatusEnum("status").default("connected").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastEventAt: timestamp("last_event_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  // Token metadata (for OAuth)
  tokenExpiresAt: timestamp("token_expires_at"),
  tokenScopes: jsonb("token_scopes").$type<string[]>().default([]),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  uniqueTenantConnector: unique().on(table.tenantId, table.connectorId),
}));

// Integration Webhooks table - Webhook events received from providers
export const integrationWebhooks = pgTable("integration_webhooks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).references(() => integrations.id).notNull(),
  connectorId: varchar("connector_id", { length: 50 }).notNull(),
  // Provider event details
  providerEventId: varchar("provider_event_id", { length: 255 }).notNull(), // For idempotency
  providerEventType: varchar("provider_event_type", { length: 100 }).notNull(), // e.g., "email.received", "message.sent"
  // Raw payload (encrypted or sanitized)
  rawPayload: jsonb("raw_payload").$type<Record<string, any>>().notNull(),
  // Normalized event
  normalizedEvent: jsonb("normalized_event").$type<{
    type: string;
    data: Record<string, any>;
    timestamp: string;
  }>(),
  // Processing status
  status: webhookStatusEnum("status").default("pending").notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  // Security
  signatureValid: boolean("signature_valid").default(false).notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProviderEvent: unique().on(table.tenantId, table.connectorId, table.providerEventId),
}));

// Integration Sync Jobs table - Scheduled or manual sync operations
export const integrationSyncJobs = pgTable("integration_sync_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).references(() => integrations.id).notNull(),
  connectorId: varchar("connector_id", { length: 50 }).notNull(),
  // Sync configuration
  direction: syncDirectionEnum("direction").notNull(),
  syncType: varchar("sync_type", { length: 50 }).notNull(), // "full", "incremental", "backfill"
  // Status
  status: syncStatusEnum("status").default("pending").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  // Results
  itemsProcessed: integer("items_processed").default(0),
  itemsCreated: integer("items_created").default(0),
  itemsUpdated: integer("items_updated").default(0),
  itemsFailed: integer("items_failed").default(0),
  errorMessage: text("error_message"),
  // Cursor/token for incremental syncs
  syncCursor: varchar("sync_cursor", { length: 500 }),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration Mappings table - Field mapping configurations per integration
export const integrationMappings = pgTable("integration_mappings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).references(() => integrations.id).notNull(),
  // Mapping configuration
  sourceType: varchar("source_type", { length: 50 }).notNull(), // "provider_field", "static", "transform"
  sourceField: varchar("source_field", { length: 100 }),
  targetType: varchar("target_type", { length: 50 }).notNull(), // "ticket", "customer", "message", "custom_field"
  targetField: varchar("target_field", { length: 100 }).notNull(),
  // Transform rules (JSONB for flexibility)
  transform: jsonb("transform").$type<{
    type?: "regex" | "static" | "expression" | "lookup";
    pattern?: string;
    replacement?: string;
    expression?: string; // Sandboxed JS expression
    defaultValue?: any;
  }>(),
  // Priority for conflict resolution
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Integration Logs table - Detailed logs for debugging and observability
export const integrationLogs = pgTable("integration_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).references(() => tenants.id).notNull(),
  integrationId: varchar("integration_id", { length: 36 }).references(() => integrations.id),
  connectorId: varchar("connector_id", { length: 50 }).notNull(),
  // Log details
  level: varchar("level", { length: 20 }).notNull(), // "info", "warn", "error", "debug"
  message: text("message").notNull(),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  // Context
  operation: varchar("operation", { length: 50 }), // "webhook", "sync", "oauth", "api_call"
  duration: integer("duration"), // milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for connector framework tables
export const insertConnectorSchema = createInsertSchema(connectors).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const insertIntegrationWebhookSchema = createInsertSchema(integrationWebhooks).omit({
  id: true,
  createdAt: true,
  receivedAt: true,
});

export const insertIntegrationSyncJobSchema = createInsertSchema(integrationSyncJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationMappingSchema = createInsertSchema(integrationMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationLogSchema = createInsertSchema(integrationLogs).omit({
  id: true,
  createdAt: true,
});

// Types for connector framework tables
export type Connector = typeof connectors.$inferSelect;
export type InsertConnector = z.infer<typeof insertConnectorSchema>;

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;
export type InsertIntegrationWebhook = z.infer<typeof insertIntegrationWebhookSchema>;

export type IntegrationSyncJob = typeof integrationSyncJobs.$inferSelect;
export type InsertIntegrationSyncJob = z.infer<typeof insertIntegrationSyncJobSchema>;

export type IntegrationMapping = typeof integrationMappings.$inferSelect;
export type InsertIntegrationMapping = z.infer<typeof insertIntegrationMappingSchema>;

export type IntegrationLog = typeof integrationLogs.$inferSelect;
export type InsertIntegrationLog = z.infer<typeof insertIntegrationLogSchema>;

// Insert schemas for MCP tables
export const insertMcpAuditLogSchema = createInsertSchema(mcpAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTenantFeatureFlagSchema = createInsertSchema(tenantFeatureFlags).omit({
  updatedAt: true,
});

// Types for MCP tables
export type McpAuditLog = typeof mcpAuditLogs.$inferSelect;
export type InsertMcpAuditLog = z.infer<typeof insertMcpAuditLogSchema>;

export type TenantFeatureFlag = typeof tenantFeatureFlags.$inferSelect;
export type InsertTenantFeatureFlag = z.infer<typeof insertTenantFeatureFlagSchema>;
