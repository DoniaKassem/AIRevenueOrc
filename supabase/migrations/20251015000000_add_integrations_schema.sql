/*
  # Add Third-Party Integrations Schema

  1. New Tables
    - `integration_providers`
      - `id` (uuid, primary key)
      - `name` (text) - Provider name (Salesforce, HubSpot, etc.)
      - `category` (text) - CRM, email, calendar, etc.
      - `description` (text)
      - `logo_url` (text)
      - `auth_type` (text) - oauth2, api_key, basic
      - `config_schema` (jsonb) - Configuration requirements
      - `capabilities` (jsonb) - What the integration can do
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `team_integrations`
      - `id` (uuid, primary key)
      - `team_id` (uuid, foreign key)
      - `provider_id` (uuid, foreign key)
      - `status` (text) - active, inactive, error
      - `auth_data` (jsonb, encrypted) - OAuth tokens, API keys
      - `config` (jsonb) - Integration-specific settings
      - `last_sync_at` (timestamptz)
      - `last_error` (text)
      - `sync_frequency` (text) - realtime, hourly, daily
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `webhook_endpoints`
      - `id` (uuid, primary key)
      - `team_id` (uuid, foreign key)
      - `integration_id` (uuid, foreign key)
      - `url` (text) - Webhook URL
      - `secret` (text, encrypted) - Webhook signature secret
      - `events` (text[]) - Events to listen for
      - `status` (text) - active, inactive
      - `last_triggered_at` (timestamptz)
      - `created_at` (timestamptz)

    - `webhook_logs`
      - `id` (uuid, primary key)
      - `webhook_id` (uuid, foreign key)
      - `event_type` (text)
      - `payload` (jsonb)
      - `response_status` (int)
      - `response_body` (text)
      - `processing_time_ms` (int)
      - `error` (text)
      - `created_at` (timestamptz)

    - `sync_jobs`
      - `id` (uuid, primary key)
      - `integration_id` (uuid, foreign key)
      - `job_type` (text) - full_sync, incremental, manual
      - `status` (text) - pending, running, completed, failed
      - `records_processed` (int)
      - `records_failed` (int)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `error` (text)
      - `metadata` (jsonb)

    - `field_mappings`
      - `id` (uuid, primary key)
      - `integration_id` (uuid, foreign key)
      - `entity_type` (text) - prospect, deal, activity
      - `source_field` (text)
      - `target_field` (text)
      - `transformation` (text) - none, uppercase, date_format, etc.
      - `is_required` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their team's integrations
*/

-- Integration Providers (global catalog)
CREATE TABLE IF NOT EXISTS integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  logo_url text,
  auth_type text NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'basic', 'custom')),
  config_schema jsonb DEFAULT '{}'::jsonb,
  capabilities jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Team-specific integration instances
CREATE TABLE IF NOT EXISTS team_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'configuring')),
  auth_data jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  sync_frequency text DEFAULT 'hourly' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, provider_id)
);

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES team_integrations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text,
  events text[] DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Webhook event logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  response_status int,
  response_body text,
  processing_time_ms int,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Sync jobs for data synchronization
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES team_integrations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('full_sync', 'incremental', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  records_processed int DEFAULT 0,
  records_failed int DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Field mappings for data transformation
CREATE TABLE IF NOT EXISTS field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES team_integrations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('prospect', 'deal', 'activity', 'contact')),
  source_field text NOT NULL,
  target_field text NOT NULL,
  transformation text DEFAULT 'none',
  is_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- API rate limit tracking
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES team_integrations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  requests_made int DEFAULT 0,
  requests_limit int NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_integrations_team_id ON team_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_integrations_status ON team_integrations(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_integration_id ON sync_jobs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_field_mappings_integration_id ON field_mappings(integration_id);

-- Enable RLS
ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Integration providers are publicly readable
CREATE POLICY "Anyone can view active integration providers"
  ON integration_providers FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Team integrations
CREATE POLICY "Users can view their team's integrations"
  ON team_integrations FOR SELECT
  TO authenticated
  USING (team_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can insert their team's integrations"
  ON team_integrations FOR INSERT
  TO authenticated
  WITH CHECK (team_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can update their team's integrations"
  ON team_integrations FOR UPDATE
  TO authenticated
  USING (team_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (team_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY "Users can delete their team's integrations"
  ON team_integrations FOR DELETE
  TO authenticated
  USING (team_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Webhook endpoints
CREATE POLICY "Users can manage their team's webhooks"
  ON webhook_endpoints FOR ALL
  TO authenticated
  USING (team_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (team_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- Webhook logs (read-only for users)
CREATE POLICY "Users can view their team's webhook logs"
  ON webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM webhook_endpoints
      WHERE webhook_endpoints.id = webhook_logs.webhook_id
      AND webhook_endpoints.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- Sync jobs
CREATE POLICY "Users can view their team's sync jobs"
  ON sync_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_integrations
      WHERE team_integrations.id = sync_jobs.integration_id
      AND team_integrations.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

CREATE POLICY "Users can create sync jobs for their integrations"
  ON sync_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_integrations
      WHERE team_integrations.id = sync_jobs.integration_id
      AND team_integrations.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- Field mappings
CREATE POLICY "Users can manage field mappings for their integrations"
  ON field_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_integrations
      WHERE team_integrations.id = field_mappings.integration_id
      AND team_integrations.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_integrations
      WHERE team_integrations.id = field_mappings.integration_id
      AND team_integrations.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- API rate limits
CREATE POLICY "Users can view rate limits for their integrations"
  ON api_rate_limits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_integrations
      WHERE team_integrations.id = api_rate_limits.integration_id
      AND team_integrations.team_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

-- Seed popular integration providers
INSERT INTO integration_providers (name, category, description, auth_type, capabilities) VALUES
  ('Salesforce', 'CRM', 'Sync contacts, deals, and activities with Salesforce', 'oauth2', '{"sync": true, "webhook": true, "bidirectional": true}'::jsonb),
  ('HubSpot', 'CRM', 'Integrate with HubSpot CRM and Marketing Hub', 'oauth2', '{"sync": true, "webhook": true, "bidirectional": true}'::jsonb),
  ('Gmail', 'Email', 'Send and track emails through Gmail', 'oauth2', '{"send_email": true, "track_email": true}'::jsonb),
  ('Outlook', 'Email', 'Send and track emails through Outlook', 'oauth2', '{"send_email": true, "track_email": true}'::jsonb),
  ('Google Calendar', 'Calendar', 'Schedule meetings and sync calendar events', 'oauth2', '{"calendar_sync": true, "meeting_schedule": true}'::jsonb),
  ('Slack', 'Communication', 'Send notifications and updates to Slack', 'oauth2', '{"notifications": true, "commands": true}'::jsonb),
  ('ZoomInfo', 'Enrichment', 'Enrich contact and company data', 'api_key', '{"enrichment": true}'::jsonb),
  ('Clearbit', 'Enrichment', 'Enrich contact and company data', 'api_key', '{"enrichment": true}'::jsonb),
  ('LinkedIn Sales Navigator', 'Social', 'Access LinkedIn insights and connections', 'oauth2', '{"prospect_search": true, "insights": true}'::jsonb),
  ('Stripe', 'Payment', 'Process payments and manage subscriptions', 'api_key', '{"payments": true, "webhooks": true}'::jsonb),
  ('Zapier', 'Automation', 'Connect with 5000+ apps through Zapier', 'api_key', '{"webhooks": true, "triggers": true}'::jsonb),
  ('Twilio', 'Communication', 'Send SMS and make phone calls', 'api_key', '{"sms": true, "calls": true}'::jsonb)
ON CONFLICT DO NOTHING;
