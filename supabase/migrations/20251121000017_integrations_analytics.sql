-- =============================================
-- Integrations, Analytics & Data Quality Schema
-- Marketplace, advanced analytics, and data management
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- INTEGRATION MARKETPLACE
-- =============================================

-- Integrations table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  category TEXT CHECK (category IN ('crm', 'email', 'calendar', 'marketing', 'sales', 'support', 'analytics', 'productivity', 'communication', 'other')) DEFAULT 'other',
  icon TEXT NOT NULL,
  screenshots TEXT[],

  -- Publisher
  publisher JSONB NOT NULL,

  -- Capabilities
  capabilities JSONB NOT NULL,
  scopes TEXT[] DEFAULT '{}',

  -- Configuration
  config_fields JSONB,
  webhook_url TEXT,
  oauth_config JSONB,

  -- Status
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'deprecated')) DEFAULT 'pending_review',
  is_official BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN DEFAULT FALSE,

  -- Pricing
  pricing JSONB,

  -- Analytics
  install_count INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,

  -- Metadata
  version TEXT NOT NULL,
  min_platform_version TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrations_category ON integrations(category);
CREATE INDEX idx_integrations_status ON integrations(status);
CREATE INDEX idx_integrations_slug ON integrations(slug);

-- Integration installations table
CREATE TABLE integration_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Configuration
  config JSONB,

  -- OAuth
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Status
  status TEXT CHECK (status IN ('active', 'paused', 'error', 'disconnected')) DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,

  -- Analytics
  sync_count INTEGER DEFAULT 0,
  records_synced INTEGER DEFAULT 0,

  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_installations_org ON integration_installations(organization_id);
CREATE INDEX idx_integration_installations_integration ON integration_installations(integration_id);

-- Integration logs table
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installation_id UUID NOT NULL REFERENCES integration_installations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
  status TEXT CHECK (status IN ('success', 'error')) NOT NULL,
  record_count INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  error TEXT,
  metadata JSONB,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_logs_installation ON integration_logs(installation_id);
CREATE INDEX idx_integration_logs_executed_at ON integration_logs(executed_at);

-- Integration reviews table
CREATE TABLE integration_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  title TEXT NOT NULL,
  comment TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(integration_id, user_id)
);

CREATE INDEX idx_integration_reviews_integration ON integration_reviews(integration_id);

-- =============================================
-- API MANAGEMENT
-- =============================================

-- API keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Permissions
  scopes TEXT[] DEFAULT '{}',
  ip_whitelist TEXT[],

  -- Rate limiting
  rate_limit JSONB NOT NULL DEFAULT '{"requests": 100, "period": "minute"}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,

  -- Analytics
  request_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);

-- API usage table
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time INTEGER NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_key ON api_usage(api_key_id);
CREATE INDEX idx_api_usage_requested_at ON api_usage(requested_at);

-- =============================================
-- ADVANCED ANALYTICS
-- =============================================

-- Analytics dashboards table
CREATE TABLE analytics_dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('sales', 'marketing', 'service', 'executive', 'custom')) DEFAULT 'custom',
  widgets JSONB NOT NULL,
  layout JSONB NOT NULL,
  filters JSONB,
  refresh_interval INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  shared_with UUID[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dashboards_created_by ON analytics_dashboards(created_by);

-- Analytics insights table
CREATE TABLE analytics_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('trend', 'anomaly', 'prediction', 'recommendation', 'alert')) NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metric TEXT NOT NULL,
  value JSONB,
  change DECIMAL,
  recommendation TEXT,
  action_url TEXT,
  dismissed_by UUID[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_created_at ON analytics_insights(created_at);
CREATE INDEX idx_insights_expires_at ON analytics_insights(expires_at);

-- Attribution table
CREATE TABLE attributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  touchpoints JSONB NOT NULL,
  model TEXT CHECK (model IN ('first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'w_shaped')) NOT NULL,
  revenue DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attributions_prospect ON attributions(prospect_id);
CREATE INDEX idx_attributions_deal ON attributions(deal_id);

-- =============================================
-- DATA QUALITY
-- =============================================

-- Data quality rules table
CREATE TABLE data_quality_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  object TEXT CHECK (object IN ('prospect', 'account', 'deal', 'custom')) NOT NULL,
  rule_type TEXT CHECK (rule_type IN ('validation', 'format', 'completeness', 'consistency', 'accuracy')) NOT NULL,
  severity TEXT CHECK (severity IN ('error', 'warning', 'info')) DEFAULT 'warning',

  -- Condition
  condition JSONB NOT NULL,

  -- Action
  action TEXT CHECK (action IN ('flag', 'fix', 'block', 'notify')) DEFAULT 'flag',
  fix_value JSONB,
  notify_users UUID[],

  is_active BOOLEAN DEFAULT TRUE,
  violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quality_rules_object ON data_quality_rules(object);

-- Data quality violations table
CREATE TABLE data_quality_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES data_quality_rules(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  field TEXT NOT NULL,
  current_value JSONB,
  suggested_value JSONB,
  severity TEXT CHECK (severity IN ('error', 'warning', 'info')) NOT NULL,
  status TEXT CHECK (status IN ('open', 'fixed', 'ignored')) DEFAULT 'open',
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quality_violations_rule ON data_quality_violations(rule_id);
CREATE INDEX idx_quality_violations_object ON data_quality_violations(object_type, object_id);
CREATE INDEX idx_quality_violations_status ON data_quality_violations(status);

-- Duplicate detections table
CREATE TABLE duplicate_detections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object TEXT CHECK (object IN ('prospect', 'account', 'deal')) NOT NULL,
  master_record UUID NOT NULL,
  duplicate_records UUID[] NOT NULL,
  match_score INTEGER NOT NULL,
  match_fields TEXT[] NOT NULL,
  status TEXT CHECK (status IN ('pending', 'merged', 'ignored')) DEFAULT 'pending',
  merged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_duplicates_object ON duplicate_detections(object);
CREATE INDEX idx_duplicates_status ON duplicate_detections(status);

-- Data enrichments table
CREATE TABLE data_enrichments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT CHECK (provider IN ('clearbit', 'fullcontact', 'zoominfo', 'apollo', 'custom')) NOT NULL,
  object TEXT CHECK (object IN ('prospect', 'account')) NOT NULL,
  object_id UUID NOT NULL,
  enriched_fields TEXT[] NOT NULL,
  enriched_data JSONB NOT NULL,
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100) NOT NULL,
  cost DECIMAL NOT NULL,
  status TEXT CHECK (status IN ('success', 'failed', 'partial')) DEFAULT 'success',
  error TEXT,
  enriched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrichments_object ON data_enrichments(object, object_id);

-- Data quality scores table
CREATE TABLE data_quality_scores (
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  score INTEGER CHECK (score >= 0 AND score <= 100) NOT NULL,
  breakdown JSONB NOT NULL,
  missing_fields TEXT[],
  invalid_fields TEXT[],
  last_calculated TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (object_type, object_id)
);

CREATE INDEX idx_quality_scores_score ON data_quality_scores(score);

-- Data cleaning jobs table
CREATE TABLE data_cleaning_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('deduplicate', 'validate', 'enrich', 'normalize', 'custom')) NOT NULL,
  object TEXT NOT NULL,
  filters JSONB,
  config JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  records_processed INTEGER DEFAULT 0,
  records_affected INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cleaning_jobs_status ON data_cleaning_jobs(status);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Increment counter (generic)
CREATE OR REPLACE FUNCTION increment(x INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN x + 1;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update integration installation timestamp
CREATE TRIGGER trigger_integration_installations_updated_at
  BEFORE UPDATE ON integration_installations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Update dashboard timestamp
CREATE TRIGGER trigger_dashboards_updated_at
  BEFORE UPDATE ON analytics_dashboards
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_cleaning_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for integrations (anyone can view approved)
CREATE POLICY "Anyone can view approved integrations"
  ON integrations FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can manage their integrations"
  ON integrations FOR ALL
  USING (auth.uid() = created_by);

-- RLS policies for integration installations
CREATE POLICY "Users can manage installations in their organization"
  ON integration_installations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = integration_installations.organization_id
    )
  );

-- RLS policies for API keys
CREATE POLICY "Users can manage API keys in their organization"
  ON api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = api_keys.organization_id
    )
  );

-- RLS policies for dashboards
CREATE POLICY "Users can view public or shared dashboards"
  ON analytics_dashboards FOR SELECT
  USING (
    is_public = TRUE
    OR created_by = auth.uid()
    OR auth.uid() = ANY(shared_with)
  );

CREATE POLICY "Users can manage their own dashboards"
  ON analytics_dashboards FOR ALL
  USING (auth.uid() = created_by);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Full-text search for integrations
CREATE INDEX idx_integrations_search ON integrations USING gin(to_tsvector('english', name || ' ' || description));

-- Composite indexes for common queries
CREATE INDEX idx_installations_org_status ON integration_installations(organization_id, status);
CREATE INDEX idx_api_usage_key_date ON api_usage(api_key_id, requested_at);

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert example official integration
INSERT INTO integrations (name, slug, description, category, icon, publisher, capabilities, scopes, status, is_official, version) VALUES
  (
    'Google Calendar',
    'google-calendar',
    'Sync meetings and events with Google Calendar',
    'calendar',
    'https://www.google.com/calendar/images/logo.png',
    '{"name": "Google", "website": "https://calendar.google.com", "supportEmail": "support@google.com"}'::jsonb,
    '[{"type": "sync", "name": "Calendar Sync", "description": "Two-way sync of meetings and events"}]'::jsonb,
    ARRAY['calendar.read', 'calendar.write'],
    'approved',
    TRUE,
    '1.0.0'
  ),
  (
    'Slack',
    'slack',
    'Get notifications and updates in Slack',
    'communication',
    'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack.png',
    '{"name": "Slack Technologies", "website": "https://slack.com", "supportEmail": "support@slack.com"}'::jsonb,
    '[{"type": "webhook", "name": "Notifications", "description": "Send notifications to Slack channels"}]'::jsonb,
    ARRAY['webhook:write'],
    'approved',
    TRUE,
    '1.0.0'
  );
