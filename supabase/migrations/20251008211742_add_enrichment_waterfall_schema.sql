/*
  # Add Contact Enrichment Waterfall Schema

  ## Overview
  This migration adds support for a waterfall enrichment strategy that tries multiple data providers
  in sequence until successful enrichment is achieved.

  ## New Tables

  ### `enrichment_providers`
  Stores configuration for different enrichment providers (Clearbit, ZoomInfo, Apollo, etc.)
  - `id` (uuid, primary key)
  - `provider_name` (text) - Provider identifier (e.g., 'clearbit', 'zoominfo')
  - `display_name` (text) - Human-readable name
  - `api_endpoint` (text) - API endpoint URL
  - `priority_order` (integer) - Order in waterfall (lower = higher priority)
  - `is_enabled` (boolean) - Whether provider is active
  - `credits_remaining` (integer) - Available API credits
  - `credits_used_this_month` (integer) - Monthly usage tracking
  - `rate_limit_per_minute` (integer) - API rate limits
  - `success_rate` (numeric) - Historical success percentage
  - `avg_response_time_ms` (integer) - Average response time
  - `config` (jsonb) - Provider-specific configuration
  - `created_at`, `updated_at` (timestamps)

  ### `enrichment_requests`
  Tracks individual enrichment attempts across the waterfall
  - `id` (uuid, primary key)
  - `prospect_id` (uuid, foreign key) - Target prospect
  - `team_id` (uuid, foreign key) - Team making request
  - `enrichment_type` (text) - Type: 'email', 'phone', 'company', 'full_profile'
  - `input_data` (jsonb) - Data used for enrichment (email, name, domain, etc.)
  - `waterfall_status` (text) - 'pending', 'in_progress', 'completed', 'failed'
  - `attempts_count` (integer) - Number of providers tried
  - `final_provider_used` (text) - Provider that succeeded
  - `enriched_data` (jsonb) - Final enriched data
  - `waterfall_log` (jsonb) - Detailed log of each provider attempt
  - `total_duration_ms` (integer) - Total time for waterfall
  - `credits_consumed` (integer) - Total credits used
  - `created_at`, `completed_at` (timestamps)

  ### `enrichment_provider_attempts`
  Logs each individual provider attempt within a waterfall request
  - `id` (uuid, primary key)
  - `enrichment_request_id` (uuid, foreign key)
  - `provider_id` (uuid, foreign key)
  - `attempt_order` (integer) - Position in waterfall
  - `status` (text) - 'success', 'failed', 'skipped', 'rate_limited'
  - `response_data` (jsonb) - Raw provider response
  - `error_message` (text) - Error details if failed
  - `duration_ms` (integer) - Response time
  - `credits_used` (integer) - Credits consumed
  - `data_quality_score` (numeric) - Quality of returned data (0-100)
  - `fields_enriched` (text[]) - Which fields were populated
  - `created_at` (timestamp)

  ## Security
  - Enable RLS on all tables
  - Only authenticated users can access their team's enrichment data
  - Provider configuration restricted to authenticated users
*/

-- Create enrichment_providers table
CREATE TABLE IF NOT EXISTS enrichment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  api_endpoint text,
  priority_order integer NOT NULL DEFAULT 999,
  is_enabled boolean DEFAULT true,
  credits_remaining integer DEFAULT 0,
  credits_used_this_month integer DEFAULT 0,
  rate_limit_per_minute integer DEFAULT 60,
  success_rate numeric(5,2) DEFAULT 0.00,
  avg_response_time_ms integer DEFAULT 0,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE enrichment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enrichment providers"
  ON enrichment_providers FOR SELECT
  TO authenticated
  USING (true);

-- Create enrichment_requests table
CREATE TABLE IF NOT EXISTS enrichment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  enrichment_type text NOT NULL,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  waterfall_status text DEFAULT 'pending',
  attempts_count integer DEFAULT 0,
  final_provider_used text,
  enriched_data jsonb DEFAULT '{}'::jsonb,
  waterfall_log jsonb DEFAULT '[]'::jsonb,
  total_duration_ms integer,
  credits_consumed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE enrichment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team's enrichment requests"
  ON enrichment_requests FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create enrichment requests for their team"
  ON enrichment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their team's enrichment requests"
  ON enrichment_requests FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Create enrichment_provider_attempts table
CREATE TABLE IF NOT EXISTS enrichment_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrichment_request_id uuid REFERENCES enrichment_requests(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES enrichment_providers(id) ON DELETE SET NULL,
  attempt_order integer NOT NULL,
  status text NOT NULL,
  response_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  credits_used integer DEFAULT 0,
  data_quality_score numeric(5,2),
  fields_enriched text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE enrichment_provider_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attempts for their team's requests"
  ON enrichment_provider_attempts FOR SELECT
  TO authenticated
  USING (
    enrichment_request_id IN (
      SELECT id FROM enrichment_requests
      WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrichment_providers_priority ON enrichment_providers(priority_order) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_prospect ON enrichment_requests(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_team ON enrichment_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_status ON enrichment_requests(waterfall_status);
CREATE INDEX IF NOT EXISTS idx_enrichment_attempts_request ON enrichment_provider_attempts(enrichment_request_id);

-- Insert default providers (mock providers for demonstration)
INSERT INTO enrichment_providers (provider_name, display_name, priority_order, is_enabled, credits_remaining, config) VALUES
  ('clearbit', 'Clearbit', 1, true, 1000, '{"api_key_required": true, "supports": ["email", "company", "full_profile"]}'::jsonb),
  ('zoominfo', 'ZoomInfo', 2, true, 500, '{"api_key_required": true, "supports": ["email", "phone", "company", "full_profile"]}'::jsonb),
  ('apollo', 'Apollo.io', 3, true, 2000, '{"api_key_required": true, "supports": ["email", "phone", "full_profile"]}'::jsonb),
  ('hunter', 'Hunter.io', 4, true, 1500, '{"api_key_required": true, "supports": ["email"]}'::jsonb),
  ('pdl', 'People Data Labs', 5, true, 800, '{"api_key_required": true, "supports": ["email", "phone", "company", "full_profile"]}'::jsonb)
ON CONFLICT (provider_name) DO NOTHING;
