CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  prompt text,
  result jsonb,
  created_at timestamptz DEFAULT now()
);

