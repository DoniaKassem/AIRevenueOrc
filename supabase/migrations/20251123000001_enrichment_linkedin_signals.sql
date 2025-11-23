-- =============================================
-- ENRICHMENT, LINKEDIN AUTOMATION & SIGNAL EXTRACTION
-- Migration for workflow automation enhancements
-- Created: 2025-11-23
-- =============================================

-- =============================================
-- ENRICHMENT TABLES
-- =============================================

-- Enrichment Requests Log
CREATE TABLE IF NOT EXISTS public.enrichment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- clearbit, zoominfo, apollo, builtwith, newsapi
  entity_type VARCHAR(50) NOT NULL, -- prospect, company
  entity_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  credits_used INTEGER DEFAULT 0,
  response_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_provider CHECK (provider IN ('clearbit', 'zoominfo', 'apollo', 'builtwith', 'newsapi', 'other')),
  CONSTRAINT valid_entity_type CHECK (entity_type IN ('prospect', 'company')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Intent Signals
CREATE TABLE IF NOT EXISTS public.intent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  signal_type VARCHAR(50) NOT NULL, -- web_visit, content_download, search_query, tech_stack, job_posting, funding, news_mention
  category VARCHAR(50) NOT NULL, -- behavioral, technographic, firmographic, contextual
  strength VARCHAR(20) NOT NULL, -- weak, medium, strong, very_strong
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  description TEXT NOT NULL,
  evidence TEXT,
  source_type VARCHAR(50), -- website, news, job_posting, social, etc.
  source_url TEXT,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_signal_type CHECK (signal_type IN ('web_visit', 'content_download', 'search_query', 'tech_stack', 'job_posting', 'funding', 'news_mention')),
  CONSTRAINT valid_category CHECK (category IN ('behavioral', 'technographic', 'firmographic', 'contextual')),
  CONSTRAINT valid_strength CHECK (strength IN ('weak', 'medium', 'strong', 'very_strong'))
);

-- =============================================
-- LINKEDIN AUTOMATION TABLES
-- =============================================

-- LinkedIn Agent Configuration
CREATE TABLE IF NOT EXISTS public.linkedin_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  agent_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  daily_limits JSONB NOT NULL DEFAULT '{
    "profileViews": 50,
    "connectionRequests": 20,
    "messages": 30,
    "likes": 50,
    "comments": 10
  }'::jsonb,
  auto_message_templates JSONB DEFAULT '{}'::jsonb,
  target_criteria JSONB DEFAULT '{}'::jsonb,
  last_started_at TIMESTAMPTZ,
  last_stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Activities Log
CREATE TABLE IF NOT EXISTS public.linkedin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- profile_view, connection_request, message, post_like, post_comment, follow
  target_url TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  message TEXT,
  response TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_action_type CHECK (action_type IN ('profile_view', 'connection_request', 'message', 'post_like', 'post_comment', 'follow')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed'))
);

-- =============================================
-- COMPANY RESEARCH ENHANCEMENT TABLES
-- =============================================

-- Company Job Postings
CREATE TABLE IF NOT EXISTS public.company_job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  department VARCHAR(255),
  location VARCHAR(255),
  job_url TEXT,
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  source VARCHAR(100), -- linkedin, greenhouse, lever, etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company News Articles
CREATE TABLE IF NOT EXISTS public.company_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  source_name VARCHAR(255),
  author VARCHAR(255),
  published_at TIMESTAMPTZ,
  sentiment VARCHAR(20), -- positive, neutral, negative
  categories TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_sentiment CHECK (sentiment IN ('positive', 'neutral', 'negative', NULL))
);

-- =============================================
-- WORKFLOW ENHANCEMENT TABLES
-- =============================================

-- Integration Flow Executions (enhanced)
CREATE TABLE IF NOT EXISTS public.integration_flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES integration_flows(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  trigger_data JSONB DEFAULT '{}'::jsonb,
  execution_log JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Enrichment Provider Settings
CREATE TABLE IF NOT EXISTS public.enrichment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider_key VARCHAR(50) NOT NULL, -- clearbit, zoominfo, apollo, etc.
  provider_name VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  api_key_encrypted TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  credits_available INTEGER,
  credits_used INTEGER DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, provider_key)
);

-- =============================================
-- ADD COLUMNS TO EXISTING TABLES
-- =============================================

-- Add LinkedIn fields to prospects table
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS linkedin_connection_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS linkedin_last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seniority VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Add constraint for LinkedIn connection status
DO $$ BEGIN
  ALTER TABLE public.prospects
    ADD CONSTRAINT valid_linkedin_connection_status
    CHECK (linkedin_connection_status IN ('pending', 'connected', 'not_connected', NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add signal tracking fields to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS intent_score INTEGER DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  ADD COLUMN IF NOT EXISTS intent_tier VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_signal_extraction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signal_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS technologies TEXT[] DEFAULT '{}';

-- Add constraint for intent tier
DO $$ BEGIN
  ALTER TABLE public.company_profiles
    ADD CONSTRAINT valid_intent_tier
    CHECK (intent_tier IN ('hot', 'warm', 'lukewarm', 'cold', NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Enrichment Requests
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_team_id ON enrichment_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_entity ON enrichment_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_provider ON enrichment_requests(provider);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_status ON enrichment_requests(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_requests_created_at ON enrichment_requests(created_at DESC);

-- Intent Signals
CREATE INDEX IF NOT EXISTS idx_intent_signals_company_profile_id ON intent_signals(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_team_id ON intent_signals(team_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_type ON intent_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_intent_signals_category ON intent_signals(category);
CREATE INDEX IF NOT EXISTS idx_intent_signals_strength ON intent_signals(strength);
CREATE INDEX IF NOT EXISTS idx_intent_signals_confidence ON intent_signals(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_detected_at ON intent_signals(detected_at DESC);

-- LinkedIn Activities
CREATE INDEX IF NOT EXISTS idx_linkedin_activities_team_id ON linkedin_activities(team_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_activities_prospect_id ON linkedin_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_activities_action_type ON linkedin_activities(action_type);
CREATE INDEX IF NOT EXISTS idx_linkedin_activities_status ON linkedin_activities(status);
CREATE INDEX IF NOT EXISTS idx_linkedin_activities_created_at ON linkedin_activities(created_at DESC);

-- Company Job Postings
CREATE INDEX IF NOT EXISTS idx_company_job_postings_company_profile_id ON company_job_postings(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_company_job_postings_team_id ON company_job_postings(team_id);
CREATE INDEX IF NOT EXISTS idx_company_job_postings_is_active ON company_job_postings(is_active);
CREATE INDEX IF NOT EXISTS idx_company_job_postings_posted_at ON company_job_postings(posted_at DESC);

-- Company News
CREATE INDEX IF NOT EXISTS idx_company_news_company_profile_id ON company_news(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_company_news_team_id ON company_news(team_id);
CREATE INDEX IF NOT EXISTS idx_company_news_published_at ON company_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_news_sentiment ON company_news(sentiment);

-- Integration Flow Executions
CREATE INDEX IF NOT EXISTS idx_integration_flow_executions_flow_id ON integration_flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_integration_flow_executions_status ON integration_flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_integration_flow_executions_started_at ON integration_flow_executions(started_at DESC);

-- Enrichment Providers
CREATE INDEX IF NOT EXISTS idx_enrichment_providers_team_id ON enrichment_providers(team_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_providers_enabled ON enrichment_providers(is_enabled);

-- Prospects - LinkedIn fields
CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_url ON prospects(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_connection_status ON prospects(linkedin_connection_status);
CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_last_contacted_at ON prospects(linkedin_last_contacted_at DESC);

-- Company Profiles - Intent fields
CREATE INDEX IF NOT EXISTS idx_company_profiles_intent_score ON company_profiles(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_company_profiles_intent_tier ON company_profiles(intent_tier);
CREATE INDEX IF NOT EXISTS idx_company_profiles_signal_count ON company_profiles(signal_count DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE enrichment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Enrichment Requests
CREATE POLICY "Users can view team enrichment requests"
  ON enrichment_requests FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create team enrichment requests"
  ON enrichment_requests FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Intent Signals
CREATE POLICY "Users can view team intent signals"
  ON intent_signals FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create team intent signals"
  ON intent_signals FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies: LinkedIn Agent Configs
CREATE POLICY "Users can view team linkedin config"
  ON linkedin_agent_configs FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage linkedin config"
  ON linkedin_agent_configs FOR ALL
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies: LinkedIn Activities
CREATE POLICY "Users can view team linkedin activities"
  ON linkedin_activities FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create team linkedin activities"
  ON linkedin_activities FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Company Job Postings
CREATE POLICY "Users can view team company job postings"
  ON company_job_postings FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage team company job postings"
  ON company_job_postings FOR ALL
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Company News
CREATE POLICY "Users can view team company news"
  ON company_news FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage team company news"
  ON company_news FOR ALL
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Integration Flow Executions
CREATE POLICY "Users can view team flow executions"
  ON integration_flow_executions FOR SELECT
  USING (
    flow_id IN (
      SELECT id FROM integration_flows
      WHERE team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
    )
  );

-- RLS Policies: Enrichment Providers
CREATE POLICY "Users can view team enrichment providers"
  ON enrichment_providers FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage enrichment providers"
  ON enrichment_providers FOR ALL
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- =============================================
-- TRIGGERS
-- =============================================

-- Updated_at trigger for linkedin_agent_configs
CREATE OR REPLACE FUNCTION update_linkedin_agent_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_linkedin_agent_configs_updated_at
  BEFORE UPDATE ON linkedin_agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_agent_configs_updated_at();

-- Updated_at trigger for company_job_postings
CREATE OR REPLACE FUNCTION update_company_job_postings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_job_postings_updated_at
  BEFORE UPDATE ON company_job_postings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_job_postings_updated_at();

-- Updated_at trigger for enrichment_providers
CREATE OR REPLACE FUNCTION update_enrichment_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrichment_providers_updated_at
  BEFORE UPDATE ON enrichment_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_enrichment_providers_updated_at();

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to get enrichment provider credits
CREATE OR REPLACE FUNCTION get_enrichment_provider_credits(
  p_team_id UUID,
  p_provider_key VARCHAR
)
RETURNS TABLE (
  provider_key VARCHAR,
  credits_available INTEGER,
  credits_used INTEGER,
  credits_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ep.provider_key,
    ep.credits_available,
    ep.credits_used,
    (ep.credits_available - ep.credits_used) AS credits_remaining
  FROM enrichment_providers ep
  WHERE ep.team_id = p_team_id
    AND ep.provider_key = p_provider_key
    AND ep.is_enabled = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get company intent signals summary
CREATE OR REPLACE FUNCTION get_company_intent_signals_summary(
  p_company_profile_id UUID
)
RETURNS TABLE (
  total_signals INTEGER,
  signals_by_category JSONB,
  signals_by_type JSONB,
  avg_confidence NUMERIC,
  strong_signals_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_signals,
    jsonb_object_agg(category, category_count) AS signals_by_category,
    jsonb_object_agg(signal_type, type_count) AS signals_by_type,
    AVG(confidence)::NUMERIC(5,2) AS avg_confidence,
    COUNT(*) FILTER (WHERE strength IN ('strong', 'very_strong'))::INTEGER AS strong_signals_count
  FROM (
    SELECT
      category,
      COUNT(*) AS category_count,
      signal_type,
      COUNT(*) AS type_count,
      confidence,
      strength
    FROM intent_signals
    WHERE company_profile_id = p_company_profile_id
    GROUP BY category, signal_type, confidence, strength
  ) AS aggregated;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE enrichment_requests IS 'Log of all enrichment API requests';
COMMENT ON TABLE intent_signals IS 'Buying intent signals extracted from various sources';
COMMENT ON TABLE linkedin_agent_configs IS 'Configuration for LinkedIn automation agents';
COMMENT ON TABLE linkedin_activities IS 'Log of all LinkedIn automation activities';
COMMENT ON TABLE company_job_postings IS 'Job postings scraped from company career pages';
COMMENT ON TABLE company_news IS 'News articles about companies';
COMMENT ON TABLE enrichment_providers IS 'Configuration for external enrichment providers';
COMMENT ON TABLE integration_flow_executions IS 'Execution history of integration workflows';

COMMENT ON COLUMN intent_signals.category IS 'behavioral: user actions, technographic: tech stack, firmographic: company data, contextual: indirect signals';
COMMENT ON COLUMN intent_signals.strength IS 'Signal strength: weak < medium < strong < very_strong';
COMMENT ON COLUMN intent_signals.confidence IS 'Confidence score 0-100';
