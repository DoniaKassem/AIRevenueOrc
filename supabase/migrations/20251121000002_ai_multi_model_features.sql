-- AI Multi-Model Features Schema
-- Provides tracking and management for multiple AI models and agents

-- Track AI model performance across providers
CREATE TABLE IF NOT EXISTS ai_model_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'openai', 'claude', 'gemini'
  model_name TEXT NOT NULL,
  task_type TEXT NOT NULL, -- 'email-generation', 'deep-research', etc.
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store AI agent execution sessions
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL, -- 'research', 'outreach', 'scoring', 'analysis', 'automation', 'strategist'
  conversation_history JSONB DEFAULT '[]',
  actions_taken JSONB DEFAULT '[]', -- Array of agent actions and results
  outcome TEXT,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  execution_time_ms INTEGER,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store AI prompt templates
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'email', 'research', 'analysis', etc.
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- Array of variable names to fill in
  recommended_model TEXT,
  recommended_provider TEXT,
  usage_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store AI model configurations per team
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- Higher priority models used first
  cost_limit_daily DECIMAL(10,2), -- Daily spend limit for this model
  rate_limit_per_minute INTEGER, -- Max requests per minute
  configuration JSONB DEFAULT '{}', -- Provider-specific config (temperature, max_tokens, etc.)
  api_key_encrypted TEXT, -- Encrypted API key (team-specific keys)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, provider, model_name)
);

-- Track AI playground experiments
CREATE TABLE IF NOT EXISTS ai_playground_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  experiment_name TEXT,
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  models_tested JSONB NOT NULL, -- Array of {provider, model, response, latency, cost}
  winner_model TEXT,
  winner_reasoning TEXT,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track AI cost spending per team
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  total_requests INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, date, provider, model_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_performance_team_created ON ai_model_performance(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_provider_model ON ai_model_performance(provider, model_name);
CREATE INDEX IF NOT EXISTS idx_model_performance_task_type ON ai_model_performance(task_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_team ON ai_agent_sessions(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_type ON ai_agent_sessions(agent_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_team ON ai_prompt_templates(team_id) WHERE is_public = false;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON ai_prompt_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_model_configs_team ON ai_model_configs(team_id) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_playground_team ON ai_playground_experiments(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_team_date ON ai_cost_tracking(team_id, date DESC);

-- Enable Row Level Security
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_playground_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_model_performance
CREATE POLICY "Users can view their team's model performance"
  ON ai_model_performance FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their team's model performance"
  ON ai_model_performance FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_agent_sessions
CREATE POLICY "Users can view their team's agent sessions"
  ON ai_agent_sessions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's agent sessions"
  ON ai_agent_sessions FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_prompt_templates
CREATE POLICY "Users can view their team's prompts and public prompts"
  ON ai_prompt_templates FOR SELECT
  USING (
    is_public = true OR team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's prompts"
  ON ai_prompt_templates FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_model_configs
CREATE POLICY "Users can view their team's model configs"
  ON ai_model_configs FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's model configs"
  ON ai_model_configs FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_playground_experiments
CREATE POLICY "Users can view their team's playground experiments"
  ON ai_playground_experiments FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's playground experiments"
  ON ai_playground_experiments FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_cost_tracking
CREATE POLICY "Users can view their team's AI costs"
  ON ai_cost_tracking FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their team's AI costs"
  ON ai_cost_tracking FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Function to aggregate AI costs daily
CREATE OR REPLACE FUNCTION aggregate_ai_costs_daily()
RETURNS VOID AS $$
BEGIN
  INSERT INTO ai_cost_tracking (team_id, date, provider, model_name, total_requests, total_tokens, total_cost_usd)
  SELECT
    team_id,
    DATE(created_at) as date,
    provider,
    model_name,
    COUNT(*) as total_requests,
    SUM(prompt_tokens + completion_tokens) as total_tokens,
    SUM(cost_usd) as total_cost_usd
  FROM ai_model_performance
  WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
    AND success = true
  GROUP BY team_id, DATE(created_at), provider, model_name
  ON CONFLICT (team_id, date, provider, model_name) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    total_tokens = EXCLUDED.total_tokens,
    total_cost_usd = EXCLUDED.total_cost_usd;
END;
$$ LANGUAGE plpgsql;

-- Function to get AI cost summary for a team
CREATE OR REPLACE FUNCTION get_ai_cost_summary(
  p_team_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  provider TEXT,
  model_name TEXT,
  total_cost DECIMAL,
  total_requests INTEGER,
  avg_cost_per_request DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    act.provider,
    act.model_name,
    SUM(act.total_cost_usd) as total_cost,
    SUM(act.total_requests)::INTEGER as total_requests,
    (SUM(act.total_cost_usd) / NULLIF(SUM(act.total_requests), 0)) as avg_cost_per_request
  FROM ai_cost_tracking act
  WHERE act.team_id = p_team_id
    AND act.date BETWEEN p_start_date AND p_end_date
  GROUP BY act.provider, act.model_name
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get model performance comparison
CREATE OR REPLACE FUNCTION compare_model_performance(
  p_team_id UUID,
  p_task_type TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  provider TEXT,
  model_name TEXT,
  total_requests INTEGER,
  success_rate DECIMAL,
  avg_latency INTEGER,
  avg_cost DECIMAL,
  avg_rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    amp.provider,
    amp.model_name,
    COUNT(*)::INTEGER as total_requests,
    (SUM(CASE WHEN amp.success THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100) as success_rate,
    AVG(amp.latency_ms)::INTEGER as avg_latency,
    AVG(amp.cost_usd) as avg_cost,
    AVG(amp.user_rating) as avg_rating
  FROM ai_model_performance amp
  WHERE amp.team_id = p_team_id
    AND (p_task_type IS NULL OR amp.task_type = p_task_type)
    AND amp.created_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY amp.provider, amp.model_name
  ORDER BY success_rate DESC, avg_latency ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to track AI spend and enforce limits
CREATE OR REPLACE FUNCTION check_ai_cost_limit(
  p_team_id UUID,
  p_provider TEXT,
  p_model_name TEXT,
  p_estimated_cost DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_daily_limit DECIMAL;
  v_current_spend DECIMAL;
BEGIN
  -- Get the daily limit for this model
  SELECT cost_limit_daily
  INTO v_daily_limit
  FROM ai_model_configs
  WHERE team_id = p_team_id
    AND provider = p_provider
    AND model_name = p_model_name
    AND is_enabled = true;

  -- If no limit configured, allow
  IF v_daily_limit IS NULL THEN
    RETURN true;
  END IF;

  -- Get today's spend
  SELECT COALESCE(SUM(cost_usd), 0)
  INTO v_current_spend
  FROM ai_model_performance
  WHERE team_id = p_team_id
    AND provider = p_provider
    AND model_name = p_model_name
    AND DATE(created_at) = CURRENT_DATE
    AND success = true;

  -- Check if adding this cost would exceed the limit
  RETURN (v_current_spend + p_estimated_cost) <= v_daily_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert default model configurations for all teams
INSERT INTO ai_model_configs (team_id, provider, model_name, is_enabled, priority, cost_limit_daily)
SELECT
  t.id as team_id,
  unnest(ARRAY['openai', 'claude', 'gemini']) as provider,
  unnest(ARRAY['gpt-4o-mini', 'claude-3-haiku', 'gemini-flash']) as model_name,
  true as is_enabled,
  100 as priority,
  100.00 as cost_limit_daily
FROM teams t
ON CONFLICT (team_id, provider, model_name) DO NOTHING;

COMMENT ON TABLE ai_model_performance IS 'Tracks performance metrics for all AI model calls';
COMMENT ON TABLE ai_agent_sessions IS 'Records AI agent execution sessions and outcomes';
COMMENT ON TABLE ai_prompt_templates IS 'Stores reusable prompt templates';
COMMENT ON TABLE ai_model_configs IS 'Team-specific AI model configurations and limits';
COMMENT ON TABLE ai_playground_experiments IS 'A/B testing and experimentation with different models';
COMMENT ON TABLE ai_cost_tracking IS 'Daily aggregated AI spending by provider and model';
