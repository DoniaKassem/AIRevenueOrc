-- Company Research Features Schema
-- Multi-source intelligence, scheduling, and quality tracking

-- Track research from multiple sources
CREATE TABLE IF NOT EXISTS company_research_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- 'crunchbase', 'news', 'reviews', 'social', 'financial', 'tech_stack'
  source_name TEXT NOT NULL,
  source_data JSONB NOT NULL DEFAULT '{}',
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_profile_id, source_type, source_name)
);

-- Monitor company changes over time
CREATE TABLE IF NOT EXISTS company_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- 'funding', 'acquisition', 'product_launch', 'leadership', 'hiring', 'news'
  change_description TEXT NOT NULL,
  change_data JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Research scheduling and automation
CREATE TABLE IF NOT EXISTS research_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_update_profile BOOLEAN DEFAULT true,
  notify_on_changes BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_profile_id)
);

-- Track research job executions
CREATE TABLE IF NOT EXISTS research_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  sources_gathered TEXT[], -- Array of source names that were successfully gathered
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store competitive intelligence
CREATE TABLE IF NOT EXISTS competitor_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE, -- Our customer/prospect
  competitor_name TEXT NOT NULL,
  competitor_website TEXT,
  relationship TEXT DEFAULT 'competitor', -- 'competitor', 'partner', 'acquired_by', 'acquiring'
  intelligence_data JSONB DEFAULT '{}',
  last_analyzed TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store intent signals from research
CREATE TABLE IF NOT EXISTS research_intent_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'funding', 'hiring', 'product_launch', 'expansion', 'tech_adoption'
  signal_source TEXT NOT NULL, -- 'news', 'linkedin', 'crunchbase', etc.
  signal_strength TEXT DEFAULT 'medium' CHECK (signal_strength IN ('low', 'medium', 'high')),
  signal_description TEXT,
  signal_data JSONB DEFAULT '{}',
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  expires_at TIMESTAMPTZ, -- When this signal is no longer relevant
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add research fields to company_profiles if they don't exist
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS research_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS research_quality_score INTEGER CHECK (research_quality_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS research_completeness INTEGER CHECK (research_completeness BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS research_freshness INTEGER CHECK (research_freshness BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS last_researched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buying_signals JSONB DEFAULT '[]';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_sources_company ON company_research_sources(company_profile_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_type ON company_research_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_change_log_company ON company_change_log(company_profile_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_type ON company_change_log(change_type);
CREATE INDEX IF NOT EXISTS idx_research_schedules_team ON research_schedules(team_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_research_schedules_next_run ON research_schedules(next_run) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_research_jobs_company ON research_jobs(company_profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_competitor_tracking_company ON competitor_tracking(company_profile_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_intent_signals_company ON research_intent_signals(company_profile_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_strength ON research_intent_signals(signal_strength) WHERE signal_strength IN ('high', 'medium');

-- Enable Row Level Security
ALTER TABLE company_research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_intent_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_research_sources
CREATE POLICY "Users can view their team's research sources"
  ON company_research_sources FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their team's research sources"
  ON company_research_sources FOR ALL
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for company_change_log
CREATE POLICY "Users can view their team's change log"
  ON company_change_log FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their team's change log"
  ON company_change_log FOR ALL
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for research_schedules
CREATE POLICY "Users can view their team's research schedules"
  ON research_schedules FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's research schedules"
  ON research_schedules FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for research_jobs
CREATE POLICY "Users can view their team's research jobs"
  ON research_jobs FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their team's research jobs"
  ON research_jobs FOR ALL
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for competitor_tracking
CREATE POLICY "Users can view their team's competitor tracking"
  ON competitor_tracking FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's competitor tracking"
  ON competitor_tracking FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for research_intent_signals
CREATE POLICY "Users can view their team's intent signals"
  ON research_intent_signals FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their team's intent signals"
  ON research_intent_signals FOR ALL
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to calculate research staleness
CREATE OR REPLACE FUNCTION calculate_research_freshness(p_last_researched_at TIMESTAMPTZ)
RETURNS INTEGER AS $$
DECLARE
  v_days_old INTEGER;
BEGIN
  IF p_last_researched_at IS NULL THEN
    RETURN 0;
  END IF;

  v_days_old := EXTRACT(DAY FROM NOW() - p_last_researched_at)::INTEGER;

  -- Calculate freshness score (100 = fresh, 0 = stale)
  CASE
    WHEN v_days_old < 1 THEN RETURN 100;
    WHEN v_days_old < 7 THEN RETURN 90;
    WHEN v_days_old < 30 THEN RETURN 70;
    WHEN v_days_old < 90 THEN RETURN 50;
    ELSE RETURN 30;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to get companies needing research refresh
CREATE OR REPLACE FUNCTION get_stale_companies(p_team_id UUID, p_days_threshold INTEGER DEFAULT 30)
RETURNS TABLE (
  company_profile_id UUID,
  company_name TEXT,
  days_since_research INTEGER,
  freshness_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.name,
    EXTRACT(DAY FROM NOW() - cp.last_researched_at)::INTEGER as days_since_research,
    calculate_research_freshness(cp.last_researched_at) as freshness_score
  FROM company_profiles cp
  WHERE cp.team_id = p_team_id
    AND (
      cp.last_researched_at IS NULL
      OR cp.last_researched_at < NOW() - (p_days_threshold || ' days')::INTERVAL
    )
  ORDER BY cp.last_researched_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate buying signals for a company
CREATE OR REPLACE FUNCTION aggregate_buying_signals(p_company_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_signals JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', signal_type,
      'source', signal_source,
      'strength', signal_strength,
      'description', signal_description,
      'confidence', confidence,
      'detected_at', detected_at
    ) ORDER BY detected_at DESC
  )
  INTO v_signals
  FROM research_intent_signals
  WHERE company_profile_id = p_company_profile_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND detected_at > NOW() - INTERVAL '90 days'
  LIMIT 20;

  RETURN COALESCE(v_signals, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to get research quality summary for team
CREATE OR REPLACE FUNCTION get_team_research_quality(p_team_id UUID)
RETURNS TABLE (
  total_companies INTEGER,
  researched_companies INTEGER,
  avg_quality_score DECIMAL,
  avg_completeness DECIMAL,
  avg_freshness DECIMAL,
  stale_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_companies,
    COUNT(cp.last_researched_at)::INTEGER as researched_companies,
    AVG(cp.research_quality_score) as avg_quality_score,
    AVG(cp.research_completeness) as avg_completeness,
    AVG(cp.research_freshness) as avg_freshness,
    COUNT(CASE WHEN cp.last_researched_at < NOW() - INTERVAL '30 days' OR cp.last_researched_at IS NULL THEN 1 END)::INTEGER as stale_count
  FROM company_profiles cp
  WHERE cp.team_id = p_team_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE company_research_sources IS 'Multi-source company intelligence data';
COMMENT ON TABLE company_change_log IS 'Track significant changes in company status';
COMMENT ON TABLE research_schedules IS 'Automated research scheduling';
COMMENT ON TABLE research_jobs IS 'Research execution tracking';
COMMENT ON TABLE competitor_tracking IS 'Competitive intelligence tracking';
COMMENT ON TABLE research_intent_signals IS 'Buying signals detected from research';
