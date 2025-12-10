CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE,
  status text DEFAULT 'active',
  plan text DEFAULT 'free',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  target_tenant_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  tenant_id uuid NOT NULL,
  flag_key text NOT NULL,
  enabled boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, flag_key)
);

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY['user']::text[];

CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_actor_id ON mcp_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_target_tenant_id ON mcp_audit_logs(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_created_at ON mcp_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant_id ON tenant_feature_flags(tenant_id);

