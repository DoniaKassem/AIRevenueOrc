-- Integration Control Center Schema
-- Provides comprehensive tracking and management for API integrations

-- Track API usage analytics across all integrations
CREATE TABLE IF NOT EXISTS integration_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES team_integrations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  api_calls_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,2) DEFAULT 0,
  data_synced_records INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, date)
);

-- Store integration workflows/automations
CREATE TABLE IF NOT EXISTS integration_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_integration_id UUID REFERENCES team_integrations(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL, -- 'webhook', 'schedule', 'manual', 'record_change'
  trigger_config JSONB DEFAULT '{}',
  flow_definition JSONB NOT NULL, -- Stores the visual flow structure (nodes, edges)
  is_active BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track individual flow executions
CREATE TABLE IF NOT EXISTS integration_flow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES integration_flows(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
  trigger_data JSONB,
  execution_log JSONB DEFAULT '[]', -- Array of step executions with timestamps
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Store integration marketplace catalog
CREATE TABLE IF NOT EXISTS integration_marketplace (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'crm', 'email', 'calendar', 'communication', etc.
  logo_url TEXT,
  website_url TEXT,
  documentation_url TEXT,
  setup_complexity TEXT DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  pricing_tier TEXT, -- 'free', 'freemium', 'paid'
  required_scopes TEXT[], -- OAuth scopes needed
  supported_features JSONB DEFAULT '{}', -- {'sync': true, 'webhooks': true, etc.}
  is_featured BOOLEAN DEFAULT false,
  install_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track user ratings and reviews
CREATE TABLE IF NOT EXISTS integration_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_analytics_team_date ON integration_usage_analytics(team_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_integration ON integration_usage_analytics(integration_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_flows_team ON integration_flows(team_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_flow_executions_flow ON integration_flow_executions(flow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON integration_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON integration_reviews(provider_key);

-- Enable Row Level Security
ALTER TABLE integration_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_usage_analytics
CREATE POLICY "Users can view their team's usage analytics"
  ON integration_usage_analytics FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their team's usage analytics"
  ON integration_usage_analytics FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for integration_flows
CREATE POLICY "Users can view their team's flows"
  ON integration_flows FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's flows"
  ON integration_flows FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for integration_flow_executions
CREATE POLICY "Users can view their team's flow executions"
  ON integration_flow_executions FOR SELECT
  USING (
    flow_id IN (
      SELECT id FROM integration_flows WHERE team_id IN (
        SELECT team_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for integration_marketplace (public read)
CREATE POLICY "Anyone can view marketplace"
  ON integration_marketplace FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for integration_reviews
CREATE POLICY "Users can view all reviews"
  ON integration_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own reviews"
  ON integration_reviews FOR ALL
  USING (created_by = auth.uid());

-- Insert initial marketplace data
INSERT INTO integration_marketplace (provider_key, name, description, category, setup_complexity, supported_features, is_featured) VALUES
  ('salesforce', 'Salesforce', 'World''s #1 CRM platform for sales, service, and marketing', 'crm', 'medium', '{"sync": true, "webhooks": true, "realtime": true}', true),
  ('hubspot', 'HubSpot', 'All-in-one CRM platform for marketing, sales, and customer service', 'crm', 'easy', '{"sync": true, "webhooks": true, "realtime": true}', true),
  ('gmail', 'Gmail', 'Send and receive emails through your Gmail account', 'email', 'easy', '{"send": true, "receive": true, "tracking": true}', true),
  ('outlook', 'Outlook', 'Microsoft Outlook email integration', 'email', 'easy', '{"send": true, "receive": true, "tracking": true}', true),
  ('google_calendar', 'Google Calendar', 'Schedule and manage meetings with Google Calendar', 'calendar', 'easy', '{"sync": true, "webhooks": true, "availability": true}', true),
  ('slack', 'Slack', 'Team communication and notifications via Slack', 'communication', 'easy', '{"notifications": true, "bot": true, "webhooks": true}', true),
  ('twilio', 'Twilio', 'SMS and voice call capabilities', 'communication', 'medium', '{"sms": true, "voice": true, "webhooks": true}', false),
  ('zoominfo', 'ZoomInfo', 'B2B contact and company data enrichment', 'enrichment', 'medium', '{"enrichment": true, "search": true}', true),
  ('clearbit', 'Clearbit', 'Real-time business intelligence and enrichment', 'enrichment', 'easy', '{"enrichment": true, "reveal": true}', true),
  ('linkedin', 'LinkedIn Sales Navigator', 'Professional networking and lead generation', 'social', 'hard', '{"search": true, "messaging": true}', true),
  ('stripe', 'Stripe', 'Payment processing and subscription management', 'payment', 'medium', '{"payments": true, "webhooks": true, "subscriptions": true}', false),
  ('zapier', 'Zapier', 'Connect to 5000+ apps through Zapier', 'automation', 'easy', '{"webhooks": true, "triggers": true, "actions": true}', false),
  ('intercom', 'Intercom', 'Customer messaging and support platform', 'communication', 'medium', '{"messaging": true, "webhooks": true, "support": true}', false),
  ('pipedrive', 'Pipedrive', 'Sales CRM and pipeline management', 'crm', 'easy', '{"sync": true, "webhooks": true, "deals": true}', false),
  ('apollo', 'Apollo.io', 'B2B database and sales engagement platform', 'enrichment', 'medium', '{"enrichment": true, "search": true, "sequences": true}', true),
  ('calendly', 'Calendly', 'Meeting scheduling automation', 'calendar', 'easy', '{"scheduling": true, "webhooks": true, "availability": true}', false),
  ('segment', 'Segment', 'Customer data platform and analytics', 'analytics', 'medium', '{"tracking": true, "webhooks": true, "audiences": true}', false),
  ('mixpanel', 'Mixpanel', 'Product analytics and user behavior tracking', 'analytics', 'medium', '{"tracking": true, "analysis": true, "funnels": true}', false),
  ('mailchimp', 'Mailchimp', 'Email marketing automation', 'email', 'easy', '{"campaigns": true, "lists": true, "automation": true}', false),
  ('sendgrid', 'SendGrid', 'Email delivery and marketing platform', 'email', 'easy', '{"send": true, "templates": true, "webhooks": true}', false)
ON CONFLICT (provider_key) DO NOTHING;

-- Function to update integration health scores
CREATE OR REPLACE FUNCTION calculate_integration_health_score(p_integration_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_success_rate DECIMAL;
  v_avg_latency INTEGER;
  v_recent_errors INTEGER;
  v_health_score INTEGER;
BEGIN
  -- Get metrics from last 7 days
  SELECT
    CASE WHEN api_calls_count > 0 THEN (success_count::DECIMAL / api_calls_count) * 100 ELSE 100 END,
    avg_latency_ms,
    api_calls_count - success_count
  INTO v_success_rate, v_avg_latency, v_recent_errors
  FROM integration_usage_analytics
  WHERE integration_id = p_integration_id
    AND date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY date DESC
  LIMIT 1;

  -- Calculate health score (0-100)
  -- Success rate: 60% weight, Latency: 20% weight, Recent errors: 20% weight
  v_health_score := GREATEST(0, LEAST(100,
    (v_success_rate * 0.6) +
    (CASE WHEN v_avg_latency < 500 THEN 20 WHEN v_avg_latency < 1000 THEN 15 WHEN v_avg_latency < 2000 THEN 10 ELSE 5 END) +
    (CASE WHEN v_recent_errors = 0 THEN 20 WHEN v_recent_errors < 5 THEN 15 WHEN v_recent_errors < 10 THEN 10 ELSE 5 END)
  ));

  RETURN v_health_score;
END;
$$ LANGUAGE plpgsql;

-- Function to track API call
CREATE OR REPLACE FUNCTION track_api_call(
  p_team_id UUID,
  p_integration_id UUID,
  p_success BOOLEAN,
  p_latency_ms INTEGER,
  p_cost_usd DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO integration_usage_analytics (
    team_id,
    integration_id,
    date,
    api_calls_count,
    success_count,
    error_count,
    avg_latency_ms,
    cost_usd
  ) VALUES (
    p_team_id,
    p_integration_id,
    CURRENT_DATE,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_latency_ms,
    p_cost_usd
  )
  ON CONFLICT (integration_id, date) DO UPDATE SET
    api_calls_count = integration_usage_analytics.api_calls_count + 1,
    success_count = integration_usage_analytics.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    error_count = integration_usage_analytics.error_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    avg_latency_ms = ((integration_usage_analytics.avg_latency_ms * integration_usage_analytics.api_calls_count) + p_latency_ms) / (integration_usage_analytics.api_calls_count + 1),
    cost_usd = integration_usage_analytics.cost_usd + p_cost_usd,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE integration_usage_analytics IS 'Tracks API usage, performance, and costs for each integration';
COMMENT ON TABLE integration_flows IS 'Stores integration workflow definitions for automation';
COMMENT ON TABLE integration_flow_executions IS 'Logs all flow execution attempts and their results';
COMMENT ON TABLE integration_marketplace IS 'Catalog of available integrations users can install';
COMMENT ON TABLE integration_reviews IS 'User ratings and reviews for integrations';
