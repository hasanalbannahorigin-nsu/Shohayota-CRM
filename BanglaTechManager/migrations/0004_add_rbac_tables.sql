-- Migration: Add RBAC (Role-Based Access Control) Tables
-- Implements tenant-scoped users, roles, permissions, teams, invites, and MFA

-- ==================== Update Users Table ====================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- ==================== Permissions Table ====================
CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);

-- ==================== Roles Table ====================
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ==================== Role Permissions Junction ====================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(36) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- ==================== User Roles Junction ====================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by VARCHAR(36) REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ==================== User Permission Overrides ====================
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id VARCHAR(36) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  allow BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by VARCHAR(36) REFERENCES users(id),
  UNIQUE(user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_permission ON user_permission_overrides(permission_id);

-- ==================== Teams Table ====================
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);

-- ==================== Team Members Junction ====================
CREATE TABLE IF NOT EXISTS team_members (
  team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ==================== Team Roles Junction ====================
CREATE TABLE IF NOT EXISTS team_roles (
  team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role_id VARCHAR(36) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (team_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_team_roles_team ON team_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_team_roles_role ON team_roles(role_id);

-- ==================== Invite Tokens Table ====================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(150) NOT NULL,
  role_id VARCHAR(36) REFERENCES roles(id),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_by VARCHAR(36) NOT NULL REFERENCES users(id),
  used BOOLEAN DEFAULT false NOT NULL,
  used_at TIMESTAMP,
  used_by VARCHAR(36) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_tenant ON invite_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token_hash ON invite_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON invite_tokens(expires_at);

-- ==================== Sessions Table ====================
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT false NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked);

-- ==================== Revoked Tokens Table ====================
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token_hash ON revoked_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

-- ==================== RLS Policies ====================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy for roles (tenant-scoped or global)
CREATE POLICY tenant_isolation_roles ON roles
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR tenant_id IS NULL -- Global/system roles
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for role_permissions
CREATE POLICY tenant_isolation_role_permissions ON role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id
      AND (
        r.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR r.tenant_id IS NULL
        OR current_setting('app.user_role', true) = 'super_admin'
      )
    )
  );

-- RLS Policy for user_roles
CREATE POLICY tenant_isolation_user_roles ON user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_roles.user_id
      AND u.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for user_permission_overrides
CREATE POLICY tenant_isolation_user_permission_overrides ON user_permission_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_permission_overrides.user_id
      AND u.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for teams
CREATE POLICY tenant_isolation_teams ON teams
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for team_members
CREATE POLICY tenant_isolation_team_members ON team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
      AND t.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for team_roles
CREATE POLICY tenant_isolation_team_roles ON team_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_roles.team_id
      AND t.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for invite_tokens
CREATE POLICY tenant_isolation_invite_tokens ON invite_tokens
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for sessions
CREATE POLICY tenant_isolation_sessions ON sessions
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- RLS Policy for revoked_tokens
CREATE POLICY tenant_isolation_revoked_tokens ON revoked_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = revoked_tokens.user_id
      AND u.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR current_setting('app.user_role', true) = 'super_admin'
  );

-- Permissions are global (no tenant isolation needed)
-- But we can add a policy for consistency
CREATE POLICY global_permissions ON permissions
  FOR ALL
  USING (true); -- Permissions are global, accessible to all

-- ==================== Seed Default Permissions ====================
-- This will be done by the application on startup
-- See server/db/seed-permissions.ts

-- ==================== Notes ====================
-- 1. All tenant-scoped tables have RLS policies
-- 2. Global roles have tenant_id = NULL
-- 3. Permissions are global (no tenant_id)
-- 4. Token hashes are stored (not plain tokens)
-- 5. MFA secrets should be encrypted in application layer
-- 6. Sessions track refresh tokens for revocation
-- 7. Revoked tokens table provides alternative revocation mechanism

