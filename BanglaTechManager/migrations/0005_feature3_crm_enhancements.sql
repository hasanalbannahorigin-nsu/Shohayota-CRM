-- Migration: Feature 3 - CRM Core Entities Enhancements
-- Adds tags, SLA policies, activities, assignment history, and enhanced fields

-- ==================== Update Enums ====================
-- Add new ticket statuses
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'resolved';

-- Create new enums
CREATE TYPE call_disposition AS ENUM('answered', 'busy', 'no_answer', 'voicemail', 'dropped', 'transferred', 'on_hold');
CREATE TYPE message_direction AS ENUM('inbound', 'outbound');
CREATE TYPE message_type AS ENUM('message', 'internal_note');
CREATE TYPE ticket_type AS ENUM('issue', 'request', 'question', 'complaint');
CREATE TYPE ticket_channel AS ENUM('email', 'phone', 'whatsapp', 'telegram', 'chat', 'api', 'ui');
CREATE TYPE sla_state AS ENUM('on_track', 'at_risk', 'breached');

-- ==================== Enhance Customers Table ====================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS primary_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS title VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS customer_deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- ==================== Enhance Tickets Table ====================
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS type ticket_type DEFAULT 'issue' NOT NULL,
  ADD COLUMN IF NOT EXISTS channel ticket_channel DEFAULT 'ui' NOT NULL,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_policy_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS sla_state sla_state DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_ticket_id VARCHAR(36) REFERENCES tickets(id),
  ADD COLUMN IF NOT EXISTS duplicate_of_ticket_id VARCHAR(36) REFERENCES tickets(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Update default status to 'new'
ALTER TABLE tickets ALTER COLUMN status SET DEFAULT 'new';

-- ==================== Enhance Messages Table ====================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS author_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS direction message_direction DEFAULT 'outbound' NOT NULL,
  ADD COLUMN IF NOT EXISTS type message_type DEFAULT 'message' NOT NULL,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS channel_message_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Migrate content to body if body is null
UPDATE messages SET body = content WHERE body IS NULL;

-- Make ticket_id NOT NULL (messages must belong to a ticket)
ALTER TABLE messages ALTER COLUMN ticket_id SET NOT NULL;

-- ==================== Enhance Phone Calls Table ====================
ALTER TABLE phone_calls
  ADD COLUMN IF NOT EXISTS agent_ref VARCHAR(36) REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS external_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS disposition call_disposition,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS transcript_ref VARCHAR(36),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Migrate legacy fields
UPDATE phone_calls SET start_time = call_start_time WHERE start_time IS NULL AND call_start_time IS NOT NULL;
UPDATE phone_calls SET end_time = call_end_time WHERE end_time IS NULL AND call_end_time IS NOT NULL;
UPDATE phone_calls SET agent_ref = user_id WHERE agent_ref IS NULL;

-- ==================== Create Tags Table ====================
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6',
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

-- ==================== Create SLA Policies Table ====================
CREATE TABLE IF NOT EXISTS sla_policies (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  target_resolution_minutes INTEGER NOT NULL,
  escalation_flow JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_tenant ON sla_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(is_active);

-- Add foreign key to tickets
ALTER TABLE tickets ADD CONSTRAINT fk_tickets_sla_policy FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id);

-- ==================== Create Activities Table ====================
CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_ref VARCHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_ref VARCHAR(36),
  actor_type VARCHAR(20) DEFAULT 'user',
  details JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_ref, entity_type);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);

-- ==================== Create Ticket Assignments Table ====================
CREATE TABLE IF NOT EXISTS ticket_assignments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id VARCHAR(36) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignee_id VARCHAR(36) REFERENCES users(id),
  team_id VARCHAR(36),
  assigned_by VARCHAR(36) NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  unassigned_at TIMESTAMP,
  is_current BOOLEAN DEFAULT true NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_tenant ON ticket_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_assignee ON ticket_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_current ON ticket_assignments(is_current);

-- ==================== RLS Policies ====================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tags
CREATE POLICY tenant_isolation_tags ON tags
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy for sla_policies
CREATE POLICY tenant_isolation_sla_policies ON sla_policies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy for activities
CREATE POLICY tenant_isolation_activities ON activities
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy for ticket_assignments
CREATE POLICY tenant_isolation_ticket_assignments ON ticket_assignments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin');

-- ==================== Notes ====================
-- 1. All new tables have tenant isolation via RLS
-- 2. Tags support categorization (customer, ticket, or both)
-- 3. SLA policies support priority-based and business-hours rules
-- 4. Activities provide unified timeline for all entities
-- 5. Ticket assignments track full history of assignment changes
-- 6. Enhanced fields support multiple contacts, custom fields, and metadata

