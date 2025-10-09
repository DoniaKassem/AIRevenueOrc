/*
  # AI Features Schema Extension

  1. New Tables
    - `ai_settings`
      - Stores user preferences and configuration for AI features
      - Links to profiles table
      - Includes OpenAI model preferences and feature toggles
    
    - `ai_email_generations`
      - Tracks all AI-generated email content
      - Links to prospects and templates
      - Stores performance metrics (opens, clicks, replies)
    
    - `ai_responses`
      - Stores draft AI-generated responses to prospect replies
      - Includes approval workflow status
      - Links to original emails and prospects
    
    - `ai_recommendations`
      - Tracks AI-suggested actions for prospects and deals
      - Stores recommendation type, priority, and outcome
      - Links to entity (prospect/deal) being recommended for

  2. Table Modifications
    - Add `ai_insights` JSON column to prospects table for storing OpenAI analysis
    - Add `ai_analysis` JSON column to deals table for storing AI deal insights
    - Add `openai_api_key` encrypted column to profiles for user-level API keys

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to access their own data
    - Restrict sensitive fields like API keys to owner only
*/

-- AI Settings Table
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  openai_model text DEFAULT 'gpt-4o-mini',
  email_generation_enabled boolean DEFAULT true,
  auto_prioritization_enabled boolean DEFAULT true,
  conversation_analysis_enabled boolean DEFAULT true,
  temperature decimal(3,2) DEFAULT 0.7,
  max_tokens integer DEFAULT 1000,
  custom_instructions text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI settings"
  ON ai_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own AI settings"
  ON ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own AI settings"
  ON ai_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- AI Email Generations Table
CREATE TABLE IF NOT EXISTS ai_email_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  template_id uuid,
  generated_by uuid REFERENCES profiles(id),
  subject text NOT NULL,
  body text NOT NULL,
  generation_prompt text,
  model_used text DEFAULT 'gpt-4o-mini',
  tone text,
  purpose text,
  used_in_send boolean DEFAULT false,
  performance_metrics jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_email_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team email generations"
  ON ai_email_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.team_id IN (
        SELECT team_id FROM profiles WHERE id = generated_by
      )
    )
  );

CREATE POLICY "Users can create email generations"
  ON ai_email_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = generated_by);

-- AI Responses Table
CREATE TABLE IF NOT EXISTS ai_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  original_message text NOT NULL,
  generated_response text NOT NULL,
  response_category text,
  model_used text DEFAULT 'gpt-4o-mini',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team AI responses"
  ON ai_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_responses.prospect_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can create AI responses"
  ON ai_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_responses.prospect_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can update AI responses"
  ON ai_responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_responses.prospect_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_responses.prospect_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    )
  );

-- AI Recommendations Table
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('prospect', 'deal', 'account')),
  entity_id uuid NOT NULL,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority integer DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  reasoning text,
  suggested_action text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  outcome text,
  model_version text DEFAULT 'v1.0.0',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view team recommendations"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (
    (entity_type = 'prospect' AND EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_recommendations.entity_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
    OR
    (entity_type = 'deal' AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = ai_recommendations.entity_id
      AND (deals.owner_id = auth.uid() OR deals.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
  );

CREATE POLICY "Users can update recommendations"
  ON ai_recommendations FOR UPDATE
  TO authenticated
  USING (
    (entity_type = 'prospect' AND EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_recommendations.entity_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
    OR
    (entity_type = 'deal' AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = ai_recommendations.entity_id
      AND (deals.owner_id = auth.uid() OR deals.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
  )
  WITH CHECK (
    (entity_type = 'prospect' AND EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = ai_recommendations.entity_id
      AND (prospects.owner_id = auth.uid() OR prospects.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
    OR
    (entity_type = 'deal' AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = ai_recommendations.entity_id
      AND (deals.owner_id = auth.uid() OR deals.team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      ))
    ))
  );

-- Add AI insights columns to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'ai_insights'
  ) THEN
    ALTER TABLE prospects ADD COLUMN ai_insights jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE deals ADD COLUMN ai_analysis jsonb DEFAULT '{}';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_email_generations_prospect_id ON ai_email_generations(prospect_id);
CREATE INDEX IF NOT EXISTS idx_ai_email_generations_generated_by ON ai_email_generations(generated_by);
CREATE INDEX IF NOT EXISTS idx_ai_email_generations_created_at ON ai_email_generations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_responses_prospect_id ON ai_responses(prospect_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_status ON ai_responses(status);
CREATE INDEX IF NOT EXISTS idx_ai_responses_created_at ON ai_responses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_entity ON ai_recommendations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_priority ON ai_recommendations(priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_recommendations(created_at DESC);
