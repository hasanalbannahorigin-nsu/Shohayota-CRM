-- Migration: Add Role Templates and Tenant Roles Tables
-- Supports per-tenant role customization with global templates

-- Role Templates table - Global role definitions
CREATE TABLE IF NOT EXISTS role_templates (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,
  is_system BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_role_templates_name ON role_templates(name);

-- Tenant Roles table - Per-tenant role customizations
CREATE TABLE IF NOT EXISTS tenant_roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100),
  permissions JSONB,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant ON tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_roles_name ON tenant_roles(role_name);

-- RLS Policy for tenant roles
ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tenant_roles ON tenant_roles
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- Insert default role templates
INSERT INTO role_templates (name, display_name, description, permissions, is_system) VALUES
('super_admin', 'Super Administrator', 'Full system access across all tenants', 
 '{"customers": {"read": true, "create": true, "update": true, "delete": true}, "tickets": {"read": true, "create": true, "update": true, "delete": true}, "users": {"read": true, "create": true, "update": true, "delete": true}, "settings": {"read": true, "update": true}, "analytics": {"read": true}}', 
 true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_templates (name, display_name, description, permissions, is_system) VALUES
('tenant_admin', 'Tenant Administrator', 'Full access within tenant', 
 '{"customers": {"read": true, "create": true, "update": true, "delete": true}, "tickets": {"read": true, "create": true, "update": true, "delete": true}, "users": {"read": true, "create": true, "update": true, "delete": false}, "settings": {"read": true, "update": true}, "analytics": {"read": true}}', 
 true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_templates (name, display_name, description, permissions, is_system) VALUES
('support_agent', 'Support Agent', 'Can manage customers and tickets', 
 '{"customers": {"read": true, "create": true, "update": true, "delete": false}, "tickets": {"read": true, "create": true, "update": true, "delete": false}, "users": {"read": true, "create": false, "update": false, "delete": false}, "settings": {"read": false, "update": false}, "analytics": {"read": true}}', 
 true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_templates (name, display_name, description, permissions, is_system) VALUES
('customer', 'Customer', 'Limited read-only access', 
 '{"customers": {"read": true, "create": false, "update": false, "delete": false}, "tickets": {"read": true, "create": true, "update": false, "delete": false}, "users": {"read": false, "create": false, "update": false, "delete": false}, "settings": {"read": false, "update": false}, "analytics": {"read": false}}', 
 true)
ON CONFLICT (name) DO NOTHING;

