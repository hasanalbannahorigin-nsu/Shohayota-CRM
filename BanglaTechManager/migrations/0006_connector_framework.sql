-- Migration: Feature 7 - Third-Party Integrations & Connector Framework
-- Adds connector registry, integrations, webhooks, sync jobs, mappings, and logs

-- Create enum types
CREATE TYPE connector_status AS ENUM ('active', 'inactive', 'deprecated', 'beta');
CREATE TYPE integration_status AS ENUM ('connected', 'disconnected', 'auth_failed', 'error', 'syncing', 'paused');
CREATE TYPE sync_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE sync_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
CREATE TYPE webhook_status AS ENUM ('pending', 'processed', 'failed', 'duplicate');

-- Connectors table - Registry of available connectors
CREATE TABLE IF NOT EXISTS connectors (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  icon VARCHAR(255),
  oauth_enabled BOOLEAN DEFAULT false NOT NULL,
  oauth_auth_url VARCHAR(500),
  oauth_token_url VARCHAR(500),
  oauth_scopes JSONB DEFAULT '[]',
  api_key_required BOOLEAN DEFAULT false NOT NULL,
  webhook_supported BOOLEAN DEFAULT false NOT NULL,
  webhook_docs_url VARCHAR(500),
  capabilities JSONB DEFAULT '{}',
  status connector_status DEFAULT 'active' NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Integrations table - Tenant-scoped connector instances
CREATE TABLE IF NOT EXISTS integrations (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id VARCHAR(50) NOT NULL REFERENCES connectors(id),
  display_name VARCHAR(150),
  encrypted_credentials_ref VARCHAR(100) NOT NULL,
  config JSONB DEFAULT '{}',
  status integration_status DEFAULT 'connected' NOT NULL,
  last_sync_at TIMESTAMP,
  last_event_at TIMESTAMP,
  last_error TEXT,
  last_error_at TIMESTAMP,
  token_expires_at TIMESTAMP,
  token_scopes JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  deleted_at TIMESTAMP,
  UNIQUE(tenant_id, connector_id)
);

-- Integration Webhooks table
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id VARCHAR(36) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  connector_id VARCHAR(50) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  provider_event_type VARCHAR(100) NOT NULL,
  raw_payload JSONB NOT NULL,
  normalized_event JSONB,
  status webhook_status DEFAULT 'pending' NOT NULL,
  processed_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  signature_valid BOOLEAN DEFAULT false NOT NULL,
  received_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, connector_id, provider_event_id)
);

-- Integration Sync Jobs table
CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id VARCHAR(36) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  connector_id VARCHAR(50) NOT NULL,
  direction sync_direction NOT NULL,
  sync_type VARCHAR(50) NOT NULL,
  status sync_status DEFAULT 'pending' NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  sync_cursor VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Integration Mappings table
CREATE TABLE IF NOT EXISTS integration_mappings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id VARCHAR(36) NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_field VARCHAR(100),
  target_type VARCHAR(50) NOT NULL,
  target_field VARCHAR(100) NOT NULL,
  transform JSONB,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Integration Logs table
CREATE TABLE IF NOT EXISTS integration_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id VARCHAR(36) REFERENCES integrations(id) ON DELETE CASCADE,
  connector_id VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  operation VARCHAR(50),
  duration INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_connector ON integrations(connector_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_tenant ON integration_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_integration ON integration_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_status ON integration_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_tenant ON integration_sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_integration ON integration_sync_jobs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_jobs_status ON integration_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_integration_mappings_tenant ON integration_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_mappings_integration ON integration_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_tenant ON integration_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at);

-- Seed connector registry (basic connectors)
INSERT INTO connectors (id, display_name, description, category, icon, oauth_enabled, api_key_required, webhook_supported, capabilities, status) VALUES
  ('gmail', 'Gmail', 'Connect Gmail to receive emails as tickets and send replies', 'email', '📧', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "polling": true, "attachments": true}', 'active'),
  ('google_calendar', 'Google Calendar', 'Sync calendar events and create reminders for tickets', 'calendar', '📅', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "polling": true}', 'active'),
  ('telegram', 'Telegram', 'Connect Telegram bot to receive and send messages', 'messaging', '💬', false, true, true, '{"inbound": true, "outbound": true, "webhooks": true, "attachments": true}', 'active'),
  ('slack', 'Slack', 'Connect Slack workspace for team notifications and messages', 'messaging', '💼', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "attachments": true}', 'active'),
  ('whatsapp', 'WhatsApp Business', 'Connect WhatsApp Business API via Twilio or Meta', 'messaging', '📱', false, true, true, '{"inbound": true, "outbound": true, "webhooks": true, "attachments": true}', 'active'),
  ('twilio', 'Twilio', 'Phone calls, SMS, and WhatsApp via Twilio', 'telephony', '☎️', false, true, true, '{"inbound": true, "outbound": true, "webhooks": true}', 'active'),
  ('github', 'GitHub', 'Link GitHub issues and pull requests to tickets', 'dev_tools', '🐙', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "bidirectional": true}', 'active'),
  ('jira', 'Jira', 'Sync tickets with Jira issues', 'dev_tools', '🎯', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "bidirectional": true}', 'active'),
  ('stripe', 'Stripe', 'Receive payment webhooks and link invoices to tickets', 'payments', '💳', false, true, true, '{"inbound": true, "webhooks": true}', 'active'),
  ('paypal', 'PayPal', 'Receive PayPal payment webhooks', 'payments', '💰', true, false, true, '{"inbound": true, "webhooks": true}', 'active'),
  ('google_drive', 'Google Drive', 'Sync file attachments with Google Drive', 'storage', '📁', true, false, true, '{"inbound": true, "outbound": true, "webhooks": true, "attachments": true}', 'active'),
  ('generic_webhook', 'Generic Webhook', 'Receive webhooks from any service', 'other', '🔗', false, false, true, '{"inbound": true, "webhooks": true}', 'active')
ON CONFLICT (id) DO NOTHING;

