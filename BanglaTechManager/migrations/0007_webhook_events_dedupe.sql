-- Migration: Add webhook_events table for deduplication
-- This table stores webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider_event_id VARCHAR(255) NOT NULL,
  connector_id VARCHAR(50) NOT NULL,
  integration_id VARCHAR(36) REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  received_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, connector_id, provider_event_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant ON webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_integration ON webhook_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_connector ON webhook_events(connector_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id ON webhook_events(provider_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at);

