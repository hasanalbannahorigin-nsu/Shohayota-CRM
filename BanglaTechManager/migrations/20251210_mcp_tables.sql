-- migrations/20251210_mcp_tables.sql
-- MCP (Master Control Plane) Tables
-- Adds tables for MCP audit logs and tenant feature flags

-- Ensure tenants table exists with required fields
-- Note: tenants table should already exist from previous migrations
-- This migration only adds MCP-specific tables

-- MCP Audit Logs table
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_actor_id ON mcp_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_target_tenant_id ON mcp_audit_logs(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_action ON mcp_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_created_at ON mcp_audit_logs(created_at DESC);

-- Tenant Feature Flags table
CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean DEFAULT false NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (tenant_id, flag_key)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant_id ON tenant_feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_flag_key ON tenant_feature_flags(flag_key);

