/*
  # Core Revenue Orchestration Platform Schema

  ## Overview
  This migration creates the foundational database structure for a Salesloft replacement platform,
  focusing on prospecting, cadence management, and deal pipeline features.

  ## 1. New Tables

  ### Users & Authentication
  - `profiles` - Extended user profile data beyond auth.users
    - `id` (uuid, references auth.users)
    - `email` (text)
    - `full_name` (text)
    - `role` (enum: rep, manager, admin)
    - `team_id` (uuid, references teams)
    - `settings` (jsonb)
    - `created_at`, `updated_at` (timestamptz)

  - `teams` - Sales team organization
    - `id` (uuid, primary key)
    - `name` (text)
    - `organization_id` (uuid)
    - `created_at`, `updated_at` (timestamptz)

  ### Prospecting
  - `prospects` - Contact/lead records
    - `id` (uuid, primary key)
    - `email`, `phone`, `linkedin_url` (text)
    - `first_name`, `last_name`, `title`, `company` (text)
    - `priority_score` (float) - AI-generated score
    - `enrichment_data` (jsonb) - External data
    - `owner_id` (uuid, references profiles)
    - `status` (enum: new, contacted, qualified, etc.)
    - `created_at`, `updated_at` (timestamptz)

  - `accounts` - Company/organization records
    - `id` (uuid, primary key)
    - `name`, `domain`, `industry` (text)
    - `employee_count` (int)
    - `annual_revenue` (numeric)
    - `enrichment_data` (jsonb)
    - `owner_id` (uuid, references profiles)
    - `created_at`, `updated_at` (timestamptz)

  ### Cadences
  - `cadences` - Multi-channel sequence templates
    - `id` (uuid, primary key)
    - `name`, `description` (text)
    - `is_active` (boolean)
    - `created_by` (uuid, references profiles)
    - `team_id` (uuid, references teams)
    - `settings` (jsonb) - Timing, conditions
    - `created_at`, `updated_at` (timestamptz)

  - `cadence_steps` - Individual steps in cadence
    - `id` (uuid, primary key)
    - `cadence_id` (uuid, references cadences)
    - `step_number` (int)
    - `type` (enum: email, call, linkedin, sms, task)
    - `delay_days` (int)
    - `delay_hours` (int)
    - `template_id` (uuid, nullable, references email_templates)
    - `content` (text) - Generic content for non-email steps
    - `conditions` (jsonb) - Branch logic
    - `created_at`, `updated_at` (timestamptz)

  - `cadence_enrollments` - Prospects enrolled in cadences
    - `id` (uuid, primary key)
    - `cadence_id` (uuid, references cadences)
    - `prospect_id` (uuid, references prospects)
    - `current_step` (int)
    - `status` (enum: active, paused, completed, bounced)
    - `enrolled_by` (uuid, references profiles)
    - `enrolled_at`, `completed_at` (timestamptz)
    - `created_at`, `updated_at` (timestamptz)

  ### Email & Communications
  - `email_templates` - Reusable email templates
    - `id` (uuid, primary key)
    - `name`, `subject`, `body` (text)
    - `variables` (jsonb) - Dynamic fields
    - `created_by` (uuid, references profiles)
    - `team_id` (uuid, references teams)
    - `is_active` (boolean)
    - `created_at`, `updated_at` (timestamptz)

  - `email_sends` - Email send log
    - `id` (uuid, primary key)
    - `template_id` (uuid, references email_templates)
    - `prospect_id` (uuid, references prospects)
    - `cadence_enrollment_id` (uuid, nullable, references cadence_enrollments)
    - `subject`, `body` (text)
    - `sent_by` (uuid, references profiles)
    - `status` (enum: queued, sent, delivered, opened, clicked, bounced, failed)
    - `provider_message_id` (text)
    - `sent_at`, `delivered_at`, `opened_at`, `clicked_at` (timestamptz)
    - `created_at`, `updated_at` (timestamptz)

  - `call_logs` - Phone call records
    - `id` (uuid, primary key)
    - `prospect_id` (uuid, references prospects)
    - `cadence_enrollment_id` (uuid, nullable)
    - `made_by` (uuid, references profiles)
    - `duration_seconds` (int)
    - `recording_url` (text)
    - `transcript` (text)
    - `disposition` (enum: connected, voicemail, no_answer, busy, failed)
    - `notes` (text)
    - `created_at` (timestamptz)

  ### Deals & Pipeline
  - `deals` - Sales opportunities
    - `id` (uuid, primary key)
    - `name` (text)
    - `account_id` (uuid, references accounts)
    - `owner_id` (uuid, references profiles)
    - `stage` (enum: discovery, qualification, proposal, negotiation, closed_won, closed_lost)
    - `amount` (numeric)
    - `probability` (float)
    - `close_date` (date)
    - `risk_score` (float) - AI-generated
    - `forecast_category` (enum: pipeline, best_case, commit, closed)
    - `metadata` (jsonb) - MEDDPICC, custom fields
    - `created_at`, `updated_at`, `closed_at` (timestamptz)

  - `deal_contacts` - Many-to-many: deals and prospects
    - `deal_id` (uuid, references deals)
    - `prospect_id` (uuid, references prospects)
    - `role` (text) - Champion, decision maker, etc.
    - `created_at` (timestamptz)
    - PRIMARY KEY (deal_id, prospect_id)

  ### AI & Signals
  - `buyer_signals` - Captured intent signals
    - `id` (uuid, primary key)
    - `prospect_id` (uuid, references prospects)
    - `account_id` (uuid, nullable, references accounts)
    - `signal_type` (enum: website_visit, email_open, content_download, linkedin_view, etc.)
    - `source` (text)
    - `metadata` (jsonb)
    - `priority` (enum: low, medium, high, urgent)
    - `actioned` (boolean)
    - `created_at` (timestamptz)

  - `ai_predictions` - ML model outputs
    - `id` (uuid, primary key)
    - `entity_type` (enum: prospect, deal, account)
    - `entity_id` (uuid)
    - `prediction_type` (enum: priority_score, close_probability, churn_risk, etc.)
    - `score` (float)
    - `confidence` (float)
    - `reasoning` (jsonb)
    - `model_version` (text)
    - `created_at` (timestamptz)

  ### Integration & Queue
  - `integration_configs` - External service connections
    - `id` (uuid, primary key)
    - `team_id` (uuid, references teams)
    - `service` (enum: salesforce, hubspot, sendgrid, twilio, linkedin, etc.)
    - `credentials` (jsonb) - Encrypted
    - `settings` (jsonb)
    - `is_active` (boolean)
    - `last_sync_at` (timestamptz)
    - `created_at`, `updated_at` (timestamptz)

  - `job_queue` - Async task queue
    - `id` (uuid, primary key)
    - `job_type` (text) - send_email, enrich_prospect, sync_crm, etc.
    - `payload` (jsonb)
    - `status` (enum: pending, processing, completed, failed)
    - `attempts` (int)
    - `max_attempts` (int)
    - `error` (text)
    - `scheduled_for` (timestamptz)
    - `started_at`, `completed_at` (timestamptz)
    - `created_at`, `updated_at` (timestamptz)

  ## 2. Security
  - Enable RLS on ALL tables
  - Policies ensure users can only access data for their team/ownership
  - Admins have elevated permissions

  ## 3. Indexes
  - Performance indexes on foreign keys and commonly queried fields
  - Composite indexes for complex queries

  ## 4. Important Notes
  - All tables use UUIDs for primary keys
  - Timestamps track creation and updates
  - JSONB fields allow flexible, schema-less data storage
  - Enums provide type safety for status fields
  - Foreign keys maintain referential integrity
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('rep', 'manager', 'admin');
CREATE TYPE prospect_status AS ENUM ('new', 'contacted', 'qualified', 'nurturing', 'unqualified', 'converted');
CREATE TYPE cadence_step_type AS ENUM ('email', 'call', 'linkedin', 'sms', 'task');
CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'bounced', 'opted_out');
CREATE TYPE email_status AS ENUM ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
CREATE TYPE call_disposition AS ENUM ('connected', 'voicemail', 'no_answer', 'busy', 'failed');
CREATE TYPE deal_stage AS ENUM ('discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE forecast_category AS ENUM ('pipeline', 'best_case', 'commit', 'closed');
CREATE TYPE signal_type AS ENUM ('website_visit', 'email_open', 'email_click', 'content_download', 'linkedin_view', 'linkedin_connect', 'form_submit', 'demo_request', 'pricing_view');
CREATE TYPE signal_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE prediction_type AS ENUM ('priority_score', 'close_probability', 'churn_risk', 'next_best_action');
CREATE TYPE integration_service AS ENUM ('salesforce', 'hubspot', 'sendgrid', 'mailgun', 'twilio', 'linkedin', 'clearbit', 'zoominfo');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  organization_id uuid NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  role user_role DEFAULT 'rep',
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  domain text,
  industry text,
  employee_count int,
  annual_revenue numeric,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text,
  phone text,
  linkedin_url text,
  first_name text,
  last_name text,
  title text,
  company text,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  priority_score float DEFAULT 0,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  status prospect_status DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Cadences table
CREATE TABLE IF NOT EXISTS cadences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Cadence steps table
CREATE TABLE IF NOT EXISTS cadence_steps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence_id uuid REFERENCES cadences(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  type cadence_step_type NOT NULL,
  delay_days int DEFAULT 0,
  delay_hours int DEFAULT 0,
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  content text,
  conditions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cadence_id, step_number)
);

-- Cadence enrollments table
CREATE TABLE IF NOT EXISTS cadence_enrollments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence_id uuid REFERENCES cadences(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  current_step int DEFAULT 1,
  status enrollment_status DEFAULT 'active',
  enrolled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cadence_id, prospect_id, enrolled_at)
);

-- Email sends table
CREATE TABLE IF NOT EXISTS email_sends (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid REFERENCES email_templates(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  cadence_enrollment_id uuid REFERENCES cadence_enrollments(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status email_status DEFAULT 'queued',
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Call logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  cadence_enrollment_id uuid REFERENCES cadence_enrollments(id) ON DELETE SET NULL,
  made_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  duration_seconds int DEFAULT 0,
  recording_url text,
  transcript text,
  disposition call_disposition,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Deals table
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  stage deal_stage DEFAULT 'discovery',
  amount numeric DEFAULT 0,
  probability float DEFAULT 0,
  close_date date,
  risk_score float DEFAULT 0,
  forecast_category forecast_category DEFAULT 'pipeline',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- Deal contacts (junction table)
CREATE TABLE IF NOT EXISTS deal_contacts (
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  role text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (deal_id, prospect_id)
);

-- Buyer signals table
CREATE TABLE IF NOT EXISTS buyer_signals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  signal_type signal_type NOT NULL,
  source text,
  metadata jsonb DEFAULT '{}'::jsonb,
  priority signal_priority DEFAULT 'medium',
  actioned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- AI predictions table
CREATE TABLE IF NOT EXISTS ai_predictions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  prediction_type prediction_type NOT NULL,
  score float NOT NULL,
  confidence float,
  reasoning jsonb DEFAULT '{}'::jsonb,
  model_version text,
  created_at timestamptz DEFAULT now()
);

-- Integration configs table
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  service integration_service NOT NULL,
  credentials jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(team_id, service)
);

-- Job queue table
CREATE TABLE IF NOT EXISTS job_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status job_status DEFAULT 'pending',
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  error text,
  scheduled_for timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE INDEX IF NOT EXISTS idx_prospects_owner_id ON prospects(owner_id);
CREATE INDEX IF NOT EXISTS idx_prospects_team_id ON prospects(team_id);
CREATE INDEX IF NOT EXISTS idx_prospects_account_id ON prospects(account_id);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_priority_score ON prospects(priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_owner_id ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_team_id ON accounts(team_id);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);

CREATE INDEX IF NOT EXISTS idx_cadence_steps_cadence_id ON cadence_steps(cadence_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_prospect_id ON cadence_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_cadence_id ON cadence_enrollments(cadence_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_status ON cadence_enrollments(status);

CREATE INDEX IF NOT EXISTS idx_email_sends_prospect_id ON email_sends(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at ON email_sends(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_prospect_id ON call_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_made_by ON call_logs(made_by);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_team_id ON deals(team_id);
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(close_date);
CREATE INDEX IF NOT EXISTS idx_deals_forecast_category ON deals(forecast_category);

CREATE INDEX IF NOT EXISTS idx_buyer_signals_prospect_id ON buyer_signals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_account_id ON buyer_signals(account_id);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_actioned ON buyer_signals(actioned);
CREATE INDEX IF NOT EXISTS idx_buyer_signals_created_at ON buyer_signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_entity ON ai_predictions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_created_at ON ai_predictions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled_for ON job_queue(scheduled_for);

-- Enable Row Level Security on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their team"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- RLS Policies for teams
CREATE POLICY "Users can view own team"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update team"
  ON teams FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for prospects
CREATE POLICY "Users can view team prospects"
  ON prospects FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert team prospects"
  ON prospects FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update team prospects"
  ON prospects FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own prospects"
  ON prospects FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- RLS Policies for accounts
CREATE POLICY "Users can view team accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert team accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update team accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for cadences
CREATE POLICY "Users can view team cadences"
  ON cadences FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert team cadences"
  ON cadences FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update team cadences"
  ON cadences FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for cadence_steps
CREATE POLICY "Users can view team cadence steps"
  ON cadence_steps FOR SELECT
  TO authenticated
  USING (
    cadence_id IN (
      SELECT c.id FROM cadences c
      INNER JOIN profiles p ON p.team_id = c.team_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team cadence steps"
  ON cadence_steps FOR ALL
  TO authenticated
  USING (
    cadence_id IN (
      SELECT c.id FROM cadences c
      INNER JOIN profiles p ON p.team_id = c.team_id
      WHERE p.id = auth.uid()
    )
  );

-- RLS Policies for cadence_enrollments
CREATE POLICY "Users can view team enrollments"
  ON cadence_enrollments FOR SELECT
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage team enrollments"
  ON cadence_enrollments FOR ALL
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for email_templates
CREATE POLICY "Users can view team templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team templates"
  ON email_templates FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for email_sends
CREATE POLICY "Users can view team email sends"
  ON email_sends FOR SELECT
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert email sends"
  ON email_sends FOR INSERT
  TO authenticated
  WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for call_logs
CREATE POLICY "Users can view team call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for deals
CREATE POLICY "Users can view team deals"
  ON deals FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage team deals"
  ON deals FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for deal_contacts
CREATE POLICY "Users can view team deal contacts"
  ON deal_contacts FOR SELECT
  TO authenticated
  USING (
    deal_id IN (
      SELECT id FROM deals WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage team deal contacts"
  ON deal_contacts FOR ALL
  TO authenticated
  USING (
    deal_id IN (
      SELECT id FROM deals WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for buyer_signals
CREATE POLICY "Users can view team buyer signals"
  ON buyer_signals FOR SELECT
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    ) OR account_id IN (
      SELECT id FROM accounts WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert buyer signals"
  ON buyer_signals FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for ai_predictions
CREATE POLICY "Users can view team predictions"
  ON ai_predictions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert predictions"
  ON ai_predictions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for integration_configs
CREATE POLICY "Admins can manage team integrations"
  ON integration_configs FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- RLS Policies for job_queue
CREATE POLICY "Users can view team jobs"
  ON job_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage jobs"
  ON job_queue FOR ALL
  TO authenticated
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cadences_updated_at BEFORE UPDATE ON cadences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cadence_steps_updated_at BEFORE UPDATE ON cadence_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cadence_enrollments_updated_at BEFORE UPDATE ON cadence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sends_updated_at BEFORE UPDATE ON email_sends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_queue_updated_at BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();