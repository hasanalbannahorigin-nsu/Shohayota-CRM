-- Migration: Multi-Tenant System Enhancements
-- Adds tenant lifecycle, configuration, quotas, audit logs, and integration credentials

-- Add new enum types
CREATE TYPE tenant_status AS ENUM ('active', 'trialing', 'suspended', 'canceled', 'deleted');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'impersonate', 'export', 'import');

-- Alter tenants table to add new columns
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS status tenant_status DEFAULT 'active' NOT NULL,
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'basic' NOT NULL,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quota_max_users INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS quota_max_customers INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS quota_max_storage BIGINT DEFAULT 10737418240,
  ADD COLUMN IF NOT EXISTS quota_max_api_calls INTEGER DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS billing_state VARCHAR(50) DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Integration Credentials table
CREATE TABLE IF NOT EXISTS integration_credentials (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_tenant ON integration_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_provider ON integration_credentials(provider);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(36),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  impersonated_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Tenant Usage Metrics table
CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period VARCHAR(10) NOT NULL, -- YYYY-MM format
  api_calls INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  storage_used BIGINT DEFAULT 0,
  call_minutes INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant ON tenant_usage_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON tenant_usage_metrics(period);

-- Row-Level Security (RLS) Policies for defense in depth
-- Note: This requires PostgreSQL 9.5+ and proper role setup

-- Enable RLS on all tenant-scoped tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_metrics ENABLE ROW LEVEL SECURITY;

-- Create a function to get current tenant_id from JWT (application will set this)
-- This is a placeholder - in production, you'd use a proper session variable
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS VARCHAR(36) AS $$
  SELECT current_setting('app.current_tenant_id', true)::VARCHAR(36);
$$ LANGUAGE sql STABLE;

-- RLS Policy: Users can only see their tenant's customers
CREATE POLICY tenant_isolation_customers ON customers
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's tickets
CREATE POLICY tenant_isolation_tickets ON tickets
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's messages
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's phone calls
CREATE POLICY tenant_isolation_phone_calls ON phone_calls
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's notifications
CREATE POLICY tenant_isolation_notifications ON notifications
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's integration credentials
CREATE POLICY tenant_isolation_integrations ON integration_credentials
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's audit logs
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- RLS Policy: Users can only see their tenant's usage metrics
CREATE POLICY tenant_isolation_usage_metrics ON tenant_usage_metrics
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- Note: In production, you would:
-- 1. Use PostgreSQL roles and SECURITY DEFINER functions
-- 2. Set session variables from application layer before queries
-- 3. Use connection pooling with per-tenant connections if needed
-- 4. Consider using separate schemas for very large tenants

