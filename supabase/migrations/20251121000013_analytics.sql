/**
 * Analytics & Forecasting Migration
 * Database schema for analytics, forecasting, and dashboards
 */

-- Revenue Forecasts table
CREATE TABLE revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES team_hierarchies(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Forecast values
  most_likely DECIMAL(15, 2) NOT NULL,
  best_case DECIMAL(15, 2) NOT NULL,
  worst_case DECIMAL(15, 2) NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),

  -- Breakdown
  committed DECIMAL(15, 2) NOT NULL DEFAULT 0,
  upside DECIMAL(15, 2) NOT NULL DEFAULT 0,
  pipeline_value DECIMAL(15, 2) NOT NULL DEFAULT 0,

  -- Analysis
  assumptions JSONB,
  risks JSONB,
  drivers JSONB,
  historical_accuracy DECIMAL(5, 2),

  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_revenue_forecasts_team (team_id),
  INDEX idx_revenue_forecasts_period (start_date, end_date),
  INDEX idx_revenue_forecasts_generated_at (generated_at DESC)
);

-- Deal Forecasts table
CREATE TABLE deal_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  -- Predictions
  predicted_close_date DATE NOT NULL,
  close_probability INTEGER CHECK (close_probability >= 0 AND close_probability <= 100),

  -- Confidence interval
  early_close_date DATE,
  late_close_date DATE,

  -- Analysis
  risk_factors JSONB,
  recommendations JSONB,

  -- Metadata
  forecasted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_deal_forecasts_prospect (prospect_id),
  INDEX idx_deal_forecasts_close_date (predicted_close_date),
  INDEX idx_deal_forecasts_probability (close_probability DESC)
);

-- Pipeline Forecasts table
CREATE TABLE pipeline_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES team_hierarchies(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Pipeline metrics
  current_pipeline DECIMAL(15, 2) NOT NULL,
  projected_pipeline DECIMAL(15, 2) NOT NULL,
  growth_rate DECIMAL(5, 2) NOT NULL,

  -- Predictions
  new_deals_projected INTEGER NOT NULL DEFAULT 0,
  expected_wins INTEGER NOT NULL DEFAULT 0,
  expected_losses INTEGER NOT NULL DEFAULT 0,

  -- Health
  pipeline_coverage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),

  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_pipeline_forecasts_team (team_id),
  INDEX idx_pipeline_forecasts_period (start_date, end_date)
);

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('team_performance', 'pipeline', 'forecast', 'activity', 'rep_scorecard', 'executive_summary')),

  -- Scope
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Data
  report_data JSONB NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'pdf')),

  -- Metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scheduled BOOLEAN DEFAULT FALSE,
  schedule_config JSONB, -- {frequency: 'daily'|'weekly'|'monthly', recipients: [...]}
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_reports_team (team_id),
  INDEX idx_reports_user (user_id),
  INDEX idx_reports_type (report_type),
  INDEX idx_reports_generated_at (generated_at DESC)
);

-- Dashboards table
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  user_role TEXT CHECK (user_role IN ('admin', 'manager', 'rep', 'executive', 'custom')),

  -- Configuration
  widgets JSONB NOT NULL, -- Array of widget configurations
  layout JSONB NOT NULL, -- Widget positions and sizes

  -- Sharing
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_dashboards_team (team_id),
  INDEX idx_dashboards_user (user_id),
  INDEX idx_dashboards_role (user_role)
);

-- Metrics Snapshots table (for historical tracking)
CREATE TABLE metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL,

  -- Scope
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Metrics
  metrics JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_metrics_snapshots_date (snapshot_date DESC),
  INDEX idx_metrics_snapshots_team (team_id, snapshot_date DESC),
  INDEX idx_metrics_snapshots_user (user_id, snapshot_date DESC),

  -- Unique constraint to prevent duplicate snapshots
  UNIQUE (team_id, user_id, snapshot_date)
);

-- Pipeline Stage History table (for velocity tracking)
CREATE TABLE pipeline_stage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  -- Stage transition
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,

  -- Timing
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_in_previous_stage INTEGER, -- days

  -- Metadata
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_pipeline_stage_history_prospect (prospect_id),
  INDEX idx_pipeline_stage_history_transitioned_at (transitioned_at DESC),
  INDEX idx_pipeline_stage_history_stages (from_stage, to_stage)
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get team metrics for a date range
 * Returns comprehensive team performance metrics
 */
CREATE OR REPLACE FUNCTION get_team_metrics_summary(
  p_team_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pipeline', (
      SELECT jsonb_build_object(
        'value', COALESCE(SUM(a.revenue), 0),
        'count', COUNT(p.id)
      )
      FROM prospects p
      LEFT JOIN accounts a ON p.account_id = a.id
      WHERE p.team_id = p_team_id
        AND p.stage NOT IN ('closed_won', 'closed_lost', 'disqualified')
    ),
    'revenue', (
      SELECT jsonb_build_object(
        'won', COALESCE(SUM(a.revenue), 0),
        'deals', COUNT(p.id)
      )
      FROM prospects p
      LEFT JOIN accounts a ON p.account_id = a.id
      WHERE p.team_id = p_team_id
        AND p.stage = 'closed_won'
        AND p.updated_at BETWEEN p_start_date AND p_end_date
    ),
    'activities', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'emails', COUNT(*) FILTER (WHERE activity_type = 'email'),
        'calls', COUNT(*) FILTER (WHERE activity_type = 'call'),
        'meetings', COUNT(*) FILTER (WHERE activity_type = 'meeting')
      )
      FROM bdr_activities
      WHERE prospect_id IN (
        SELECT id FROM prospects WHERE team_id = p_team_id
      )
      AND created_at BETWEEN p_start_date AND p_end_date
    ),
    'conversion', (
      SELECT jsonb_build_object(
        'leads_created', COUNT(*) FILTER (WHERE stage = 'lead'),
        'leads_qualified', COUNT(*) FILTER (WHERE stage IN ('qualified', 'meeting_scheduled', 'meeting_completed')),
        'deals_won', COUNT(*) FILTER (WHERE stage = 'closed_won'),
        'deals_lost', COUNT(*) FILTER (WHERE stage = 'closed_lost')
      )
      FROM prospects
      WHERE team_id = p_team_id
        AND created_at BETWEEN p_start_date AND p_end_date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get rep leaderboard for a period
 * Returns ranked list of reps by revenue
 */
CREATE OR REPLACE FUNCTION get_rep_leaderboard(
  p_team_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  user_email TEXT,
  revenue DECIMAL(15, 2),
  deals_won INTEGER,
  quota_attainment DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(a.revenue), 0) DESC)::INTEGER AS rank,
    u.id,
    u.email,
    COALESCE(SUM(a.revenue), 0) AS revenue,
    COUNT(p.id) FILTER (WHERE p.stage = 'closed_won')::INTEGER AS deals_won,
    CASE
      WHEN q.target > 0 THEN (q.current_value / q.target * 100)
      ELSE 0
    END AS quota_attainment
  FROM users u
  LEFT JOIN prospects p ON p.owner_id = u.id
    AND p.stage = 'closed_won'
    AND p.updated_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN accounts a ON p.account_id = a.id
  LEFT JOIN LATERAL (
    SELECT target, current_value
    FROM quotas
    WHERE user_id = u.id
      AND quota_type = 'revenue'
    ORDER BY created_at DESC
    LIMIT 1
  ) q ON TRUE
  WHERE u.id IN (
    SELECT user_id FROM team_members WHERE team_id = p_team_id
  )
  GROUP BY u.id, u.email, q.target, q.current_value
  ORDER BY revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Calculate stage conversion rates
 * Returns conversion rates between stages
 */
CREATE OR REPLACE FUNCTION calculate_stage_conversions(
  p_team_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  from_stage TEXT,
  to_stage TEXT,
  count INTEGER,
  conversion_rate DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.from_stage,
    h.to_stage,
    COUNT(*)::INTEGER AS count,
    (COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY h.from_stage), 0))::DECIMAL(5, 2) AS conversion_rate
  FROM pipeline_stage_history h
  WHERE h.prospect_id IN (
    SELECT id FROM prospects WHERE team_id = p_team_id
  )
  AND h.transitioned_at BETWEEN p_start_date AND p_end_date
  GROUP BY h.from_stage, h.to_stage
  ORDER BY h.from_stage, count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get pipeline health score
 * Returns 0-100 score based on multiple factors
 */
CREATE OR REPLACE FUNCTION calculate_pipeline_health(
  p_team_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 50;
  v_coverage DECIMAL;
  v_win_rate DECIMAL;
  v_velocity DECIMAL;
BEGIN
  -- Calculate pipeline coverage
  SELECT
    (SUM(a.revenue) / NULLIF(q.target, 0)) * 100
  INTO v_coverage
  FROM prospects p
  LEFT JOIN accounts a ON p.account_id = a.id
  LEFT JOIN LATERAL (
    SELECT target FROM quotas
    WHERE team_id = p_team_id AND quota_type = 'revenue'
    ORDER BY created_at DESC LIMIT 1
  ) q ON TRUE
  WHERE p.team_id = p_team_id
    AND p.stage NOT IN ('closed_won', 'closed_lost', 'disqualified');

  -- Adjust score based on coverage
  IF v_coverage >= 300 THEN v_score := v_score + 30;
  ELSIF v_coverage >= 200 THEN v_score := v_score + 20;
  ELSIF v_coverage >= 100 THEN v_score := v_score + 10;
  ELSE v_score := v_score - 10;
  END IF;

  -- Calculate win rate
  SELECT
    (COUNT(*) FILTER (WHERE stage = 'closed_won') * 100.0 /
     NULLIF(COUNT(*) FILTER (WHERE stage IN ('closed_won', 'closed_lost')), 0))
  INTO v_win_rate
  FROM prospects
  WHERE team_id = p_team_id;

  -- Adjust score based on win rate
  IF v_win_rate >= 30 THEN v_score := v_score + 20;
  ELSIF v_win_rate >= 20 THEN v_score := v_score + 10;
  END IF;

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Create daily metrics snapshot
 * Captures daily metrics for historical tracking
 */
CREATE OR REPLACE FUNCTION create_daily_metrics_snapshot()
RETURNS VOID AS $$
BEGIN
  -- Snapshot team metrics
  INSERT INTO metrics_snapshots (snapshot_date, team_id, metrics)
  SELECT
    CURRENT_DATE,
    t.id,
    jsonb_build_object(
      'pipeline_value', COALESCE(SUM(a.revenue), 0),
      'pipeline_count', COUNT(p.id),
      'revenue_mtd', (
        SELECT COALESCE(SUM(a2.revenue), 0)
        FROM prospects p2
        LEFT JOIN accounts a2 ON p2.account_id = a2.id
        WHERE p2.team_id = t.id
          AND p2.stage = 'closed_won'
          AND p2.updated_at >= DATE_TRUNC('month', CURRENT_DATE)
      )
    )
  FROM team_hierarchies t
  LEFT JOIN prospects p ON p.team_id = t.id
    AND p.stage NOT IN ('closed_won', 'closed_lost', 'disqualified')
  LEFT JOIN accounts a ON p.account_id = a.id
  GROUP BY t.id
  ON CONFLICT (team_id, user_id, snapshot_date)
  DO UPDATE SET metrics = EXCLUDED.metrics;

  -- Snapshot user metrics
  INSERT INTO metrics_snapshots (snapshot_date, user_id, metrics)
  SELECT
    CURRENT_DATE,
    u.id,
    jsonb_build_object(
      'pipeline_value', COALESCE(SUM(a.revenue), 0),
      'pipeline_count', COUNT(p.id),
      'activities_today', (
        SELECT COUNT(*)
        FROM bdr_activities ba
        WHERE ba.user_id = u.id
          AND ba.created_at >= CURRENT_DATE
      )
    )
  FROM users u
  LEFT JOIN prospects p ON p.owner_id = u.id
    AND p.stage NOT IN ('closed_won', 'closed_lost', 'disqualified')
  LEFT JOIN accounts a ON p.account_id = a.id
  GROUP BY u.id
  ON CONFLICT (team_id, user_id, snapshot_date)
  DO UPDATE SET metrics = EXCLUDED.metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

/**
 * Track pipeline stage changes
 * Automatically log stage transitions for velocity analysis
 */
CREATE OR REPLACE FUNCTION track_stage_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO pipeline_stage_history (
      prospect_id,
      from_stage,
      to_stage,
      time_in_previous_stage
    ) VALUES (
      NEW.id,
      OLD.stage,
      NEW.stage,
      EXTRACT(DAY FROM (NOW() - OLD.updated_at))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_stage_changes
  AFTER UPDATE ON prospects
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION track_stage_changes();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY revenue_forecasts_select ON revenue_forecasts FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY revenue_forecasts_insert ON revenue_forecasts FOR INSERT WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY deal_forecasts_select ON deal_forecasts FOR SELECT USING (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
CREATE POLICY deal_forecasts_insert ON deal_forecasts FOR INSERT WITH CHECK (TRUE);

CREATE POLICY pipeline_forecasts_select ON pipeline_forecasts FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY pipeline_forecasts_insert ON pipeline_forecasts FOR INSERT WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY reports_select ON reports FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR user_id = auth.uid());
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR user_id = auth.uid());

CREATE POLICY dashboards_select ON dashboards FOR SELECT USING (is_public = TRUE OR user_id = auth.uid() OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY dashboards_insert ON dashboards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY dashboards_update ON dashboards FOR UPDATE USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY metrics_snapshots_select ON metrics_snapshots FOR SELECT USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR user_id = auth.uid());

CREATE POLICY pipeline_stage_history_select ON pipeline_stage_history FOR SELECT USING (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));

-- ============================================================================
-- SCHEDULED JOBS (via pg_cron or external scheduler)
-- ============================================================================

COMMENT ON FUNCTION create_daily_metrics_snapshot IS 'Run daily to capture metrics snapshots. Schedule with: SELECT cron.schedule(''daily-metrics'', ''0 0 * * *'', ''SELECT create_daily_metrics_snapshot()'');';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE revenue_forecasts IS 'Stores revenue forecasts with confidence intervals';
COMMENT ON TABLE deal_forecasts IS 'Stores individual deal close predictions';
COMMENT ON TABLE pipeline_forecasts IS 'Stores pipeline growth projections';
COMMENT ON TABLE reports IS 'Stores generated reports for teams and users';
COMMENT ON TABLE dashboards IS 'Stores custom dashboard configurations';
COMMENT ON TABLE metrics_snapshots IS 'Daily snapshots of key metrics for trending';
COMMENT ON TABLE pipeline_stage_history IS 'Tracks stage transitions for velocity analysis';
