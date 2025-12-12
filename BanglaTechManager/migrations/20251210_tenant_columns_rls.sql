-- Ensure tenant_id columns exist
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies (assumes app.current_tenant_id is set)
DROP POLICY IF EXISTS customers_tenant_policy ON customers;
CREATE POLICY customers_tenant_policy ON customers
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tickets_tenant_policy ON tickets;
CREATE POLICY tickets_tenant_policy ON tickets
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS messages_tenant_policy ON messages;
CREATE POLICY messages_tenant_policy ON messages
USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

