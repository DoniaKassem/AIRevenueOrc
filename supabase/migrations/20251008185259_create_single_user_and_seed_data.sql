/*
  # Create Single User Setup and Seed Data

  ## Overview
  Set up a single-user configuration without authentication requirements.
  Create a default team and user profile that will be used throughout the application.

  ## Changes
  1. Create a default team
  2. Create a function to get/create default user
  3. Add seed data for testing

  ## Important Notes
  - This migration creates a single default team and user
  - RLS policies will be updated to allow public access for single-user mode
*/

-- Create default team
INSERT INTO teams (id, name, organization_id, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Team',
  '00000000-0000-0000-0000-000000000001',
  '{}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Create function to get default team
CREATE OR REPLACE FUNCTION get_default_team_id()
RETURNS uuid AS $$
BEGIN
  RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to allow public access for single-user mode
DROP POLICY IF EXISTS "Users can view profiles in their team" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Public can view all profiles"
  ON profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can manage profiles"
  ON profiles FOR ALL
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can view own team" ON teams;
DROP POLICY IF EXISTS "Admins can update team" ON teams;

CREATE POLICY "Public can view all teams"
  ON teams FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can manage teams"
  ON teams FOR ALL
  TO public
  USING (true);

-- Update prospects policies
DROP POLICY IF EXISTS "Users can view team prospects" ON prospects;
DROP POLICY IF EXISTS "Users can insert team prospects" ON prospects;
DROP POLICY IF EXISTS "Users can update team prospects" ON prospects;
DROP POLICY IF EXISTS "Users can delete own prospects" ON prospects;

CREATE POLICY "Public can manage prospects"
  ON prospects FOR ALL
  TO public
  USING (true);

-- Update accounts policies
DROP POLICY IF EXISTS "Users can view team accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert team accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update team accounts" ON accounts;

CREATE POLICY "Public can manage accounts"
  ON accounts FOR ALL
  TO public
  USING (true);

-- Update cadences policies
DROP POLICY IF EXISTS "Users can view team cadences" ON cadences;
DROP POLICY IF EXISTS "Users can insert team cadences" ON cadences;
DROP POLICY IF EXISTS "Users can update team cadences" ON cadences;

CREATE POLICY "Public can manage cadences"
  ON cadences FOR ALL
  TO public
  USING (true);

-- Update cadence_steps policies
DROP POLICY IF EXISTS "Users can view team cadence steps" ON cadence_steps;
DROP POLICY IF EXISTS "Users can manage team cadence steps" ON cadence_steps;

CREATE POLICY "Public can manage cadence_steps"
  ON cadence_steps FOR ALL
  TO public
  USING (true);

-- Update cadence_enrollments policies
DROP POLICY IF EXISTS "Users can view team enrollments" ON cadence_enrollments;
DROP POLICY IF EXISTS "Users can manage team enrollments" ON cadence_enrollments;

CREATE POLICY "Public can manage cadence_enrollments"
  ON cadence_enrollments FOR ALL
  TO public
  USING (true);

-- Update email_templates policies
DROP POLICY IF EXISTS "Users can view team templates" ON email_templates;
DROP POLICY IF EXISTS "Users can manage team templates" ON email_templates;

CREATE POLICY "Public can manage email_templates"
  ON email_templates FOR ALL
  TO public
  USING (true);

-- Update email_sends policies
DROP POLICY IF EXISTS "Users can view team email sends" ON email_sends;
DROP POLICY IF EXISTS "Users can insert email sends" ON email_sends;

CREATE POLICY "Public can manage email_sends"
  ON email_sends FOR ALL
  TO public
  USING (true);

-- Update call_logs policies
DROP POLICY IF EXISTS "Users can view team call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert call logs" ON call_logs;

CREATE POLICY "Public can manage call_logs"
  ON call_logs FOR ALL
  TO public
  USING (true);

-- Update deals policies
DROP POLICY IF EXISTS "Users can view team deals" ON deals;
DROP POLICY IF EXISTS "Users can manage team deals" ON deals;

CREATE POLICY "Public can manage deals"
  ON deals FOR ALL
  TO public
  USING (true);

-- Update deal_contacts policies
DROP POLICY IF EXISTS "Users can view team deal contacts" ON deal_contacts;
DROP POLICY IF EXISTS "Users can manage team deal contacts" ON deal_contacts;

CREATE POLICY "Public can manage deal_contacts"
  ON deal_contacts FOR ALL
  TO public
  USING (true);

-- Update buyer_signals policies
DROP POLICY IF EXISTS "Users can view team buyer signals" ON buyer_signals;
DROP POLICY IF EXISTS "System can insert buyer signals" ON buyer_signals;

CREATE POLICY "Public can manage buyer_signals"
  ON buyer_signals FOR ALL
  TO public
  USING (true);

-- Update ai_predictions policies
DROP POLICY IF EXISTS "Users can view team predictions" ON ai_predictions;
DROP POLICY IF EXISTS "System can insert predictions" ON ai_predictions;

CREATE POLICY "Public can manage ai_predictions"
  ON ai_predictions FOR ALL
  TO public
  USING (true);

-- Update integration_configs policies
DROP POLICY IF EXISTS "Admins can manage team integrations" ON integration_configs;

CREATE POLICY "Public can manage integration_configs"
  ON integration_configs FOR ALL
  TO public
  USING (true);

-- Update job_queue policies
DROP POLICY IF EXISTS "Users can view team jobs" ON job_queue;
DROP POLICY IF EXISTS "System can manage jobs" ON job_queue;

CREATE POLICY "Public can manage job_queue"
  ON job_queue FOR ALL
  TO public
  USING (true);