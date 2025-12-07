-- Migration: Add Files/Attachments Table
-- Supports tenant-scoped file storage

CREATE TABLE IF NOT EXISTS files (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- ticket, customer, message, etc.
  resource_id VARCHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT NOT NULL,
  storage_path VARCHAR(500) NOT NULL, -- Tenant-prefixed path: tenants/{tenant_id}/files/{file_id}
  storage_provider VARCHAR(50) DEFAULT 'local' NOT NULL, -- local, s3, azure, etc.
  uploaded_by VARCHAR(36) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_resource ON files(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);

-- RLS Policy for files
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_files ON files
  FOR ALL
  USING (tenant_id = current_tenant_id() OR current_setting('app.user_role', true) = 'super_admin');

-- Note: Storage path should follow pattern: tenants/{tenant_id}/files/{file_id}/{filename}
-- This ensures tenant isolation at the storage layer

