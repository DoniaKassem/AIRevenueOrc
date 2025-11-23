-- Email Infrastructure and Team Management Schema
-- Email tracking, sync, and team hierarchies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Email Tracking Tables
-- =====================================================

-- Email Tracking Tokens (for tracking pixels and links)
CREATE TABLE IF NOT EXISTS email_tracking_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,

  -- Email reference
  email_id UUID NOT NULL, -- References bdr_activities(id)
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  -- Token type
  type TEXT NOT NULL CHECK (type IN ('open', 'click')),

  -- Original URL (for click tracking)
  original_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index
  INDEX idx_email_tracking_tokens_token (token),
  INDEX idx_email_tracking_tokens_email (email_id)
);

-- Email Tracking Events (opens, clicks, replies, bounces)
CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL, -- References bdr_activities(id)
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'reply', 'bounce')),

  -- Event details
  url TEXT, -- For clicks
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_reason TEXT,

  -- Device/Location info
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  location JSONB, -- {city, region, country}

  -- Flags
  is_first_open BOOLEAN DEFAULT false,

  -- Timestamp
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Sync Configs (IMAP/SMTP configurations)
CREATE TABLE IF NOT EXISTS email_sync_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Provider
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'office365', 'imap_smtp', 'exchange')),

  -- OAuth (for Gmail/Outlook)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- IMAP/SMTP settings
  imap_host TEXT,
  imap_port INT,
  imap_secure BOOLEAN DEFAULT true,
  smtp_host TEXT,
  smtp_port INT,
  smtp_secure BOOLEAN DEFAULT false,
  username TEXT,
  password TEXT, -- Encrypted

  -- Email address
  email_address TEXT NOT NULL,

  -- Sync settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_inbound BOOLEAN DEFAULT true,
  sync_outbound BOOLEAN DEFAULT true,
  sync_interval INT DEFAULT 15, -- minutes
  last_sync_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, email_address)
);

-- Email Sync State (track last synced message UIDs)
CREATE TABLE IF NOT EXISTS email_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES email_sync_configs(id) ON DELETE CASCADE,

  -- Folder
  folder TEXT NOT NULL CHECK (folder IN ('inbox', 'sent')),

  -- Last synced UID
  last_synced_uid INT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(config_id, folder)
);

-- =====================================================
-- Team Management Tables
-- =====================================================

-- Team Hierarchies
CREATE TABLE IF NOT EXISTS team_hierarchies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Team info
  name TEXT NOT NULL,
  description TEXT,
  team_type TEXT NOT NULL CHECK (team_type IN ('sales', 'marketing', 'customer_success', 'bdr', 'custom')),

  -- Hierarchy
  parent_team_id UUID REFERENCES team_hierarchies(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  level INT NOT NULL DEFAULT 0, -- 0 = root, 1 = child, etc.
  path TEXT NOT NULL, -- e.g., "sales/enterprise/west"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, path)
);

-- Team Members (many-to-many: users <-> teams)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE CASCADE,

  -- Role in team
  role TEXT NOT NULL CHECK (role IN ('member', 'manager', 'admin')),

  -- Reporting
  reports_to UUID REFERENCES users(id), -- User ID of manager

  -- Territory assignments
  territory_ids UUID[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(user_id, team_id)
);

-- Territories
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Territory info
  name TEXT NOT NULL,
  description TEXT,
  territory_type TEXT NOT NULL CHECK (territory_type IN ('geographic', 'account_based', 'industry', 'product', 'custom')),

  -- Geographic territories
  countries TEXT[],
  regions TEXT[],
  states TEXT[],
  cities TEXT[],
  postal_codes TEXT[],

  -- Account-based territories
  account_ids UUID[],
  account_tiers TEXT[], -- e.g., ['enterprise', 'mid_market', 'smb']
  revenue_range JSONB, -- {min: number, max: number}

  -- Industry-based territories
  industries TEXT[],

  -- Custom criteria
  custom_criteria JSONB,

  -- Assignments
  assigned_user_ids UUID[],
  assigned_team_ids UUID[],

  -- Rules
  is_exclusive BOOLEAN DEFAULT false,
  priority INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, name)
);

-- Quotas
CREATE TABLE IF NOT EXISTS quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Assignment (user OR team)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE CASCADE,

  -- Quota details
  name TEXT NOT NULL,
  quota_type TEXT NOT NULL CHECK (quota_type IN ('revenue', 'pipeline', 'meetings', 'calls', 'emails', 'opportunities', 'custom')),

  -- Target
  target DECIMAL(15, 2) NOT NULL,
  unit TEXT NOT NULL, -- e.g., 'USD', 'count'

  -- Time period
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Progress
  current_value DECIMAL(15, 2) DEFAULT 0,
  attainment DECIMAL(5, 2) DEFAULT 0, -- Percentage

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CHECK (user_id IS NOT NULL OR team_id IS NOT NULL),
  CHECK (target > 0),
  CHECK (end_date > start_date)
);

-- Quota History (track daily/weekly progress)
CREATE TABLE IF NOT EXISTS quota_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quota_id UUID REFERENCES quotas(id) ON DELETE CASCADE,

  -- Snapshot
  value DECIMAL(15, 2) NOT NULL,
  attainment DECIMAL(5, 2) NOT NULL,
  snapshot_date DATE NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(quota_id, snapshot_date)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Email Tracking Events
CREATE INDEX idx_email_tracking_events_email ON email_tracking_events(email_id);
CREATE INDEX idx_email_tracking_events_prospect ON email_tracking_events(prospect_id);
CREATE INDEX idx_email_tracking_events_type ON email_tracking_events(event_type, occurred_at DESC);
CREATE INDEX idx_email_tracking_events_occurred ON email_tracking_events(occurred_at DESC);

-- Email Sync Configs
CREATE INDEX idx_email_sync_configs_user ON email_sync_configs(user_id);
CREATE INDEX idx_email_sync_configs_team ON email_sync_configs(team_id);
CREATE INDEX idx_email_sync_configs_enabled ON email_sync_configs(sync_enabled) WHERE sync_enabled = true;
CREATE INDEX idx_email_sync_configs_provider ON email_sync_configs(provider);

-- Email Sync State
CREATE INDEX idx_email_sync_state_config ON email_sync_state(config_id);

-- Team Hierarchies
CREATE INDEX idx_team_hierarchies_org ON team_hierarchies(organization_id);
CREATE INDEX idx_team_hierarchies_parent ON team_hierarchies(parent_team_id);
CREATE INDEX idx_team_hierarchies_manager ON team_hierarchies(manager_id);
CREATE INDEX idx_team_hierarchies_path ON team_hierarchies(path);
CREATE INDEX idx_team_hierarchies_level ON team_hierarchies(organization_id, level);

-- Team Members
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_active ON team_members(team_id, is_active) WHERE is_active = true;
CREATE INDEX idx_team_members_reports_to ON team_members(reports_to);

-- Territories
CREATE INDEX idx_territories_org ON territories(organization_id);
CREATE INDEX idx_territories_type ON territories(territory_type);
CREATE INDEX idx_territories_priority ON territories(organization_id, priority DESC);
CREATE INDEX idx_territories_assigned_users ON territories USING gin(assigned_user_ids);
CREATE INDEX idx_territories_assigned_teams ON territories USING gin(assigned_team_ids);

-- Quotas
CREATE INDEX idx_quotas_org ON quotas(organization_id);
CREATE INDEX idx_quotas_user ON quotas(user_id);
CREATE INDEX idx_quotas_team ON quotas(team_id);
CREATE INDEX idx_quotas_period ON quotas(period, end_date);
CREATE INDEX idx_quotas_active ON quotas(organization_id) WHERE end_date >= CURRENT_DATE;

-- Quota History
CREATE INDEX idx_quota_history_quota ON quota_history(quota_id);
CREATE INDEX idx_quota_history_date ON quota_history(snapshot_date DESC);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get email engagement stats for prospect
CREATE OR REPLACE FUNCTION get_prospect_email_stats(p_prospect_id UUID)
RETURNS TABLE (
  emails_sent INT,
  emails_opened INT,
  emails_clicked INT,
  emails_replied INT,
  open_rate DECIMAL(5, 2),
  click_rate DECIMAL(5, 2),
  reply_rate DECIMAL(5, 2),
  last_engaged_at TIMESTAMPTZ
) AS $$
DECLARE
  v_sent INT;
  v_opened INT;
  v_clicked INT;
  v_replied INT;
BEGIN
  -- Count sent emails
  SELECT COUNT(*)
  INTO v_sent
  FROM bdr_activities
  WHERE prospect_id = p_prospect_id
    AND activity_type = 'email_sent';

  -- Count unique opened emails
  SELECT COUNT(DISTINCT email_id)
  INTO v_opened
  FROM email_tracking_events
  WHERE prospect_id = p_prospect_id
    AND event_type = 'open';

  -- Count unique clicked emails
  SELECT COUNT(DISTINCT email_id)
  INTO v_clicked
  FROM email_tracking_events
  WHERE prospect_id = p_prospect_id
    AND event_type = 'click';

  -- Count replied emails
  SELECT COUNT(DISTINCT email_id)
  INTO v_replied
  FROM email_tracking_events
  WHERE prospect_id = p_prospect_id
    AND event_type = 'reply';

  -- Return stats
  RETURN QUERY SELECT
    v_sent,
    v_opened,
    v_clicked,
    v_replied,
    CASE WHEN v_sent > 0 THEN (v_opened::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_clicked::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_replied::DECIMAL / v_sent * 100) ELSE 0 END,
    (SELECT MAX(occurred_at) FROM email_tracking_events WHERE prospect_id = p_prospect_id);
END;
$$ LANGUAGE plpgsql;

-- Get team hierarchy (recursive)
CREATE OR REPLACE FUNCTION get_team_hierarchy(p_team_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INT,
  parent_team_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: the specified team
    SELECT
      t.id,
      t.name,
      t.level,
      t.parent_team_id
    FROM team_hierarchies t
    WHERE t.id = p_team_id

    UNION ALL

    -- Recursive case: child teams
    SELECT
      t.id,
      t.name,
      t.level,
      t.parent_team_id
    FROM team_hierarchies t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.id
  )
  SELECT * FROM team_tree
  ORDER BY level, name;
END;
$$ LANGUAGE plpgsql;

-- Get user's territory coverage
CREATE OR REPLACE FUNCTION get_user_territory_coverage(p_user_id UUID)
RETURNS TABLE (
  territory_id UUID,
  territory_name TEXT,
  territory_type TEXT,
  coverage_details JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.territory_type,
    jsonb_build_object(
      'countries', t.countries,
      'states', t.states,
      'cities', t.cities,
      'industries', t.industries,
      'accountTiers', t.account_tiers
    )
  FROM territories t
  WHERE p_user_id = ANY(t.assigned_user_ids)
  ORDER BY t.priority DESC, t.name;
END;
$$ LANGUAGE plpgsql;

-- Calculate quota attainment
CREATE OR REPLACE FUNCTION calculate_quota_attainment(p_quota_id UUID)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
  v_quota RECORD;
  v_current_value DECIMAL(15, 2);
  v_attainment DECIMAL(5, 2);
BEGIN
  -- Get quota details
  SELECT * INTO v_quota
  FROM quotas
  WHERE id = p_quota_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate current value based on quota type
  CASE v_quota.quota_type
    WHEN 'meetings' THEN
      SELECT COUNT(*)
      INTO v_current_value
      FROM bdr_activities
      WHERE (user_id = v_quota.user_id OR team_id = v_quota.team_id)
        AND activity_type = 'meeting_scheduled'
        AND created_at BETWEEN v_quota.start_date AND v_quota.end_date;

    WHEN 'calls' THEN
      SELECT COUNT(*)
      INTO v_current_value
      FROM bdr_activities
      WHERE (user_id = v_quota.user_id OR team_id = v_quota.team_id)
        AND activity_type = 'phone_call_made'
        AND created_at BETWEEN v_quota.start_date AND v_quota.end_date;

    WHEN 'emails' THEN
      SELECT COUNT(*)
      INTO v_current_value
      FROM bdr_activities
      WHERE (user_id = v_quota.user_id OR team_id = v_quota.team_id)
        AND activity_type = 'email_sent'
        AND created_at BETWEEN v_quota.start_date AND v_quota.end_date;

    ELSE
      v_current_value := v_quota.current_value;
  END CASE;

  -- Calculate attainment
  v_attainment := (v_current_value / v_quota.target) * 100;

  -- Update quota
  UPDATE quotas
  SET current_value = v_current_value,
      attainment = v_attainment,
      updated_at = NOW()
  WHERE id = p_quota_id;

  RETURN v_attainment;
END;
$$ LANGUAGE plpgsql;

-- Snapshot quota progress (for history tracking)
CREATE OR REPLACE FUNCTION snapshot_quota_progress()
RETURNS void AS $$
BEGIN
  INSERT INTO quota_history (quota_id, value, attainment, snapshot_date)
  SELECT
    id,
    current_value,
    attainment,
    CURRENT_DATE
  FROM quotas
  WHERE end_date >= CURRENT_DATE
  ON CONFLICT (quota_id, snapshot_date)
  DO UPDATE SET
    value = EXCLUDED.value,
    attainment = EXCLUDED.attainment;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE email_tracking_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_hierarchies ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_history ENABLE ROW LEVEL SECURITY;

-- Email sync configs: Users can only access their own
CREATE POLICY email_sync_configs_policy ON email_sync_configs
  FOR ALL
  USING (user_id = auth.uid());

-- Team hierarchies: View org teams
CREATE POLICY team_hierarchies_view_policy ON team_hierarchies
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Team members: View own team
CREATE POLICY team_members_view_policy ON team_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Quotas: View own quotas or team quotas
CREATE POLICY quotas_view_policy ON quotas
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update quota attainment on activity creation
CREATE OR REPLACE FUNCTION trigger_update_quota_on_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_quota_id UUID;
BEGIN
  -- Find matching quota
  FOR v_quota_id IN
    SELECT id FROM quotas
    WHERE (user_id = NEW.user_id OR team_id = NEW.team_id)
      AND (
        (quota_type = 'meetings' AND NEW.activity_type = 'meeting_scheduled')
        OR (quota_type = 'calls' AND NEW.activity_type = 'phone_call_made')
        OR (quota_type = 'emails' AND NEW.activity_type = 'email_sent')
      )
      AND NEW.created_at BETWEEN start_date AND end_date
  LOOP
    PERFORM calculate_quota_attainment(v_quota_id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quota_on_activity
  AFTER INSERT ON bdr_activities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_quota_on_activity();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE email_tracking_tokens IS 'Tracking tokens for email opens and clicks';
COMMENT ON TABLE email_tracking_events IS 'Email engagement events (opens, clicks, replies, bounces)';
COMMENT ON TABLE email_sync_configs IS 'Email sync configurations (IMAP/SMTP/OAuth)';
COMMENT ON TABLE email_sync_state IS 'Email sync state tracking (last synced UIDs)';
COMMENT ON TABLE team_hierarchies IS 'Organizational team structure and hierarchies';
COMMENT ON TABLE team_members IS 'Team membership and role assignments';
COMMENT ON TABLE territories IS 'Sales territory definitions and assignments';
COMMENT ON TABLE quotas IS 'Sales quotas and targets';
COMMENT ON TABLE quota_history IS 'Historical quota progress snapshots';
