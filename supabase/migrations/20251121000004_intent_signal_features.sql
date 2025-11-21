-- Intent Signal Features Schema
-- Multi-source intent tracking, aggregation, and alerting

-- Store intent signals from all sources
CREATE TABLE IF NOT EXISTS intent_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'website_visit', 'linkedin_profile_view', 'hiring_signal', etc.
  signal_source TEXT NOT NULL, -- 'clearbit', 'linkedin', 'job_postings', etc.
  signal_strength TEXT DEFAULT 'medium' CHECK (signal_strength IN ('low', 'medium', 'high')),
  signal_description TEXT NOT NULL,
  signal_data JSONB DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.80, -- 0.00 to 1.00
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (company_profile_id IS NOT NULL OR prospect_id IS NOT NULL)
);

-- Store historical intent scores for trend analysis
CREATE TABLE IF NOT EXISTS intent_score_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  tier TEXT CHECK (tier IN ('low', 'warm', 'hot', 'burning')),
  score_breakdown JSONB DEFAULT '{}', -- Breakdown by category
  trend TEXT CHECK (trend IN ('increasing', 'stable', 'decreasing')),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (company_profile_id IS NOT NULL OR prospect_id IS NOT NULL)
);

-- Store intent alerts
CREATE TABLE IF NOT EXISTS intent_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('intent_spike', 'high_intent', 'new_signal', 'threshold_crossed')),
  alert_severity TEXT DEFAULT 'medium' CHECK (alert_severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  current_score INTEGER,
  previous_score INTEGER,
  signal_ids UUID[], -- Array of signal IDs that triggered the alert
  is_read BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (company_profile_id IS NOT NULL OR prospect_id IS NOT NULL)
);

-- Track website visitor activity
CREATE TABLE IF NOT EXISTS website_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  visitor_ip TEXT,
  visitor_company_name TEXT,
  visitor_domain TEXT,
  visitor_location JSONB, -- {city, country, region}
  first_visit_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  page_views INTEGER DEFAULT 0,
  total_time_on_site INTEGER DEFAULT 0, -- in seconds
  high_intent_pages_viewed TEXT[], -- Array of high-intent page URLs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track website page views for intent scoring
CREATE TABLE IF NOT EXISTS website_page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visitor_id UUID REFERENCES website_visitors(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  page_title TEXT,
  page_category TEXT, -- 'pricing', 'demo', 'features', etc.
  time_on_page INTEGER, -- in seconds
  referrer TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track LinkedIn engagement
CREATE TABLE IF NOT EXISTS linkedin_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('profile_view', 'post_like', 'post_comment', 'post_share', 'connection_request', 'message')),
  engager_name TEXT,
  engager_title TEXT,
  engager_company TEXT,
  engager_profile_url TEXT,
  engagement_data JSONB DEFAULT '{}',
  engaged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add intent fields to prospects table if they don't exist
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS intent_score INTEGER CHECK (intent_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS intent_tier TEXT CHECK (intent_tier IN ('low', 'warm', 'hot', 'burning')),
  ADD COLUMN IF NOT EXISTS intent_trend TEXT CHECK (intent_trend IN ('increasing', 'stable', 'decreasing')),
  ADD COLUMN IF NOT EXISTS intent_last_updated TIMESTAMPTZ;

-- Add intent fields to company_profiles table if they don't exist
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS intent_score INTEGER CHECK (intent_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS intent_tier TEXT CHECK (intent_tier IN ('low', 'warm', 'hot', 'burning')),
  ADD COLUMN IF NOT EXISTS intent_trend TEXT CHECK (intent_trend IN ('increasing', 'stable', 'decreasing')),
  ADD COLUMN IF NOT EXISTS intent_last_updated TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_intent_signals_company ON intent_signals(company_profile_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_prospect ON intent_signals(prospect_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_type ON intent_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_intent_signals_strength ON intent_signals(signal_strength) WHERE signal_strength IN ('high', 'medium');
CREATE INDEX IF NOT EXISTS idx_intent_signals_expires ON intent_signals(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intent_score_history_company ON intent_score_history(company_profile_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_score_history_prospect ON intent_score_history(prospect_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_alerts_team ON intent_alerts(team_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_intent_alerts_company ON intent_alerts(company_profile_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_intent_alerts_prospect ON intent_alerts(prospect_id) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_website_visitors_company ON website_visitors(company_profile_id, last_visit_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_visitors_domain ON website_visitors(visitor_domain);

CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON website_page_views(visitor_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_category ON website_page_views(page_category);

CREATE INDEX IF NOT EXISTS idx_linkedin_engagements_prospect ON linkedin_engagements(prospect_id, engaged_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_engagements_company ON linkedin_engagements(company_profile_id, engaged_at DESC);

-- Enable Row Level Security
ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_engagements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for intent_signals
CREATE POLICY "Users can view their team's intent signals"
  ON intent_signals FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's intent signals"
  ON intent_signals FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for intent_score_history
CREATE POLICY "Users can view their team's intent score history"
  ON intent_score_history FOR SELECT
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their team's intent score history"
  ON intent_score_history FOR ALL
  USING (
    company_profile_id IN (
      SELECT id FROM company_profiles WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
    OR prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for intent_alerts
CREATE POLICY "Users can view their team's intent alerts"
  ON intent_alerts FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's intent alerts"
  ON intent_alerts FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for website_visitors
CREATE POLICY "Users can view their team's website visitors"
  ON website_visitors FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's website visitors"
  ON website_visitors FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for website_page_views
CREATE POLICY "Users can view their team's page views"
  ON website_page_views FOR SELECT
  USING (
    visitor_id IN (
      SELECT id FROM website_visitors WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for linkedin_engagements
CREATE POLICY "Users can view their team's LinkedIn engagements"
  ON linkedin_engagements FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's LinkedIn engagements"
  ON linkedin_engagements FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to clean up expired signals
CREATE OR REPLACE FUNCTION cleanup_expired_intent_signals()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM intent_signals
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get intent summary for a team
CREATE OR REPLACE FUNCTION get_team_intent_summary(p_team_id UUID)
RETURNS TABLE (
  total_signals INTEGER,
  high_intent_count INTEGER,
  burning_tier_count INTEGER,
  hot_tier_count INTEGER,
  unread_alerts INTEGER,
  avg_intent_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT is2.id)::INTEGER as total_signals,
    COUNT(DISTINCT CASE WHEN is2.signal_strength = 'high' THEN is2.id END)::INTEGER as high_intent_count,
    COUNT(DISTINCT CASE WHEN p.intent_tier = 'burning' THEN p.id END)::INTEGER as burning_tier_count,
    COUNT(DISTINCT CASE WHEN p.intent_tier = 'hot' THEN p.id END)::INTEGER as hot_tier_count,
    COUNT(DISTINCT CASE WHEN ia.is_read = false THEN ia.id END)::INTEGER as unread_alerts,
    AVG(p.intent_score) as avg_intent_score
  FROM intent_signals is2
  LEFT JOIN prospects p ON is2.prospect_id = p.id
  LEFT JOIN intent_alerts ia ON ia.team_id = p_team_id AND ia.is_read = false
  WHERE is2.team_id = p_team_id
    AND is2.detected_at >= NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get top intent prospects
CREATE OR REPLACE FUNCTION get_top_intent_prospects(p_team_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  prospect_id UUID,
  prospect_name TEXT,
  prospect_email TEXT,
  company_name TEXT,
  intent_score INTEGER,
  intent_tier TEXT,
  intent_trend TEXT,
  signal_count INTEGER,
  last_signal_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name || ' ' || p.last_name as prospect_name,
    p.email,
    p.company,
    p.intent_score,
    p.intent_tier,
    p.intent_trend,
    COUNT(is2.id)::INTEGER as signal_count,
    MAX(is2.detected_at) as last_signal_date
  FROM prospects p
  LEFT JOIN intent_signals is2 ON is2.prospect_id = p.id
  WHERE p.team_id = p_team_id
    AND p.intent_score IS NOT NULL
  GROUP BY p.id, p.first_name, p.last_name, p.email, p.company, p.intent_score, p.intent_tier, p.intent_trend
  ORDER BY p.intent_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate website visitor data
CREATE OR REPLACE FUNCTION aggregate_visitor_intent(p_visitor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_intent_score INTEGER;
  v_high_intent_pages INTEGER;
  v_total_time INTEGER;
  v_visit_count INTEGER;
BEGIN
  SELECT
    COUNT(CASE WHEN page_category IN ('pricing', 'demo', 'contact') THEN 1 END),
    SUM(time_on_page),
    (SELECT visit_count FROM website_visitors WHERE id = p_visitor_id)
  INTO v_high_intent_pages, v_total_time, v_visit_count
  FROM website_page_views
  WHERE visitor_id = p_visitor_id;

  -- Calculate intent score (0-100)
  v_intent_score := LEAST(100,
    (v_high_intent_pages * 20) +
    (LEAST(v_total_time / 60, 30)) + -- Cap at 30 points for time
    (LEAST(v_visit_count * 10, 20)) -- Cap at 20 points for visits
  );

  RETURN v_intent_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE intent_signals IS 'Multi-source intent signals from all tracking sources';
COMMENT ON TABLE intent_score_history IS 'Historical intent scores for trend analysis';
COMMENT ON TABLE intent_alerts IS 'Intent spike alerts and notifications';
COMMENT ON TABLE website_visitors IS 'Companies visiting the website (identified by IP)';
COMMENT ON TABLE website_page_views IS 'Individual page views for intent scoring';
COMMENT ON TABLE linkedin_engagements IS 'LinkedIn profile views and engagement tracking';
