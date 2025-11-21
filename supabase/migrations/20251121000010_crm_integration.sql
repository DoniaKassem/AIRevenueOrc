-- CRM Integration Schema
-- Supports Salesforce, HubSpot, and other CRM integrations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CRM Connections
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider info
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot', 'microsoft_dynamics', 'pipedrive', 'custom')),

  -- OAuth credentials
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- API credentials (for non-OAuth)
  api_key TEXT,
  api_secret TEXT,

  -- Instance info
  instance_url TEXT,
  domain TEXT,

  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT true,
  sync_strategy TEXT DEFAULT 'hourly' CHECK (sync_strategy IN ('real_time', 'hourly', 'daily', 'manual')),
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('pull', 'push', 'bidirectional')),
  last_sync_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'expired')),
  last_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  connected_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, provider)
);

-- =====================================================
-- Field Mappings
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Entity type
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'lead', 'account', 'opportunity', 'task', 'event', 'note')),

  -- Field mappings (JSONB: internal_field => crm_field)
  mappings JSONB NOT NULL DEFAULT '{}',

  -- Custom mappings with transformations
  custom_mappings JSONB, -- Array of {internalField, crmField, transform}

  -- Sync settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('pull', 'push', 'bidirectional')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(connection_id, entity_type)
);

-- =====================================================
-- Entity Mappings (Internal ID <-> CRM ID)
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_entity_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Entity info
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'lead', 'account', 'opportunity', 'task', 'event', 'note')),
  internal_id UUID NOT NULL, -- References prospects, accounts, opportunities, etc.
  crm_id TEXT NOT NULL, -- CRM's ID for this entity

  -- Sync tracking
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ, -- Track last modification for conflict detection

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(connection_id, entity_type, internal_id),
  UNIQUE(connection_id, entity_type, crm_id)
);

-- =====================================================
-- Sync Jobs
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Job info
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'lead', 'account', 'opportunity', 'task', 'event', 'note')),
  direction TEXT NOT NULL CHECK (direction IN ('pull', 'push', 'bidirectional')),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),

  -- Results (JSONB)
  result JSONB, -- {success, pulled, pushed, created, updated, deleted, failed, errors}

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Sync Log (Detailed logging)
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Event info
  entity_type TEXT CHECK (entity_type IN ('contact', 'lead', 'account', 'opportunity', 'task', 'event', 'note')),
  entity_id TEXT, -- CRM or internal ID
  action TEXT NOT NULL, -- sync_pull, sync_push, activity_logged, entity_created, entity_updated, entity_deleted

  -- Result
  success BOOLEAN NOT NULL,
  error TEXT,
  details JSONB, -- Additional context

  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Sync Conflicts
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Conflict info
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'lead', 'account', 'opportunity', 'task', 'event', 'note')),
  internal_id UUID NOT NULL,
  crm_id TEXT NOT NULL,

  -- Conflict type
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('update_conflict', 'delete_conflict')),

  -- Data
  internal_data JSONB NOT NULL, -- Current internal data
  crm_data JSONB NOT NULL, -- Current CRM data

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('use_internal', 'use_crm', 'manual')),
  resolved_by UUID REFERENCES users(id),

  -- Metadata
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CRM Webhook Events (for real-time sync)
-- =====================================================

CREATE TABLE IF NOT EXISTS crm_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES crm_connections(id) ON DELETE CASCADE,

  -- Event info
  event_type TEXT NOT NULL, -- created, updated, deleted
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL, -- CRM ID

  -- Payload
  payload JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,

  -- Metadata
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Accounts Table (for CRM Account/Company entities)
-- =====================================================

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,

  -- Details
  industry TEXT,
  employees INT,
  annual_revenue DECIMAL(15, 2),
  description TEXT,

  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,

  -- Social
  linkedin_url TEXT,
  twitter_url TEXT,

  -- CRM reference
  crm_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Search
  search_vector tsvector
);

-- =====================================================
-- Opportunities Table (for CRM Deal/Opportunity entities)
-- =====================================================

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  amount DECIMAL(15, 2),
  stage TEXT NOT NULL,
  probability INT CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,

  -- Relationships
  account_id UUID REFERENCES accounts(id),
  prospect_id UUID REFERENCES prospects(id),
  owner_id UUID REFERENCES users(id),

  -- Source
  source TEXT,
  lead_source TEXT,

  -- CRM reference
  crm_id TEXT,

  -- Status
  is_won BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  closed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- =====================================================
-- Notes Table (for CRM Note entities)
-- =====================================================

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Content
  title TEXT,
  content TEXT NOT NULL,

  -- Relationships
  prospect_id UUID REFERENCES prospects(id),
  account_id UUID REFERENCES accounts(id),
  opportunity_id UUID REFERENCES opportunities(id),

  -- CRM reference
  crm_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- CRM Connections
CREATE INDEX idx_crm_connections_org ON crm_connections(organization_id);
CREATE INDEX idx_crm_connections_active ON crm_connections(organization_id, is_active);
CREATE INDEX idx_crm_connections_provider ON crm_connections(provider);

-- Field Mappings
CREATE INDEX idx_crm_field_mappings_connection ON crm_field_mappings(connection_id);
CREATE INDEX idx_crm_field_mappings_entity_type ON crm_field_mappings(connection_id, entity_type);

-- Entity Mappings
CREATE INDEX idx_crm_entity_mappings_connection ON crm_entity_mappings(connection_id);
CREATE INDEX idx_crm_entity_mappings_internal ON crm_entity_mappings(entity_type, internal_id);
CREATE INDEX idx_crm_entity_mappings_crm ON crm_entity_mappings(entity_type, crm_id);
CREATE INDEX idx_crm_entity_mappings_sync ON crm_entity_mappings(last_synced_at);

-- Sync Jobs
CREATE INDEX idx_crm_sync_jobs_connection ON crm_sync_jobs(connection_id);
CREATE INDEX idx_crm_sync_jobs_status ON crm_sync_jobs(status, started_at DESC);
CREATE INDEX idx_crm_sync_jobs_entity_type ON crm_sync_jobs(entity_type, started_at DESC);

-- Sync Log
CREATE INDEX idx_crm_sync_log_connection ON crm_sync_log(connection_id);
CREATE INDEX idx_crm_sync_log_timestamp ON crm_sync_log(timestamp DESC);
CREATE INDEX idx_crm_sync_log_entity ON crm_sync_log(entity_type, entity_id);
CREATE INDEX idx_crm_sync_log_success ON crm_sync_log(success, timestamp DESC);

-- Sync Conflicts
CREATE INDEX idx_crm_sync_conflicts_connection ON crm_sync_conflicts(connection_id);
CREATE INDEX idx_crm_sync_conflicts_unresolved ON crm_sync_conflicts(connection_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_crm_sync_conflicts_entity ON crm_sync_conflicts(entity_type, internal_id);

-- Webhook Events
CREATE INDEX idx_crm_webhook_events_connection ON crm_webhook_events(connection_id);
CREATE INDEX idx_crm_webhook_events_unprocessed ON crm_webhook_events(connection_id) WHERE processed = false;
CREATE INDEX idx_crm_webhook_events_received ON crm_webhook_events(received_at DESC);

-- Accounts
CREATE INDEX idx_accounts_team ON accounts(team_id);
CREATE INDEX idx_accounts_domain ON accounts(domain);
CREATE INDEX idx_accounts_crm_id ON accounts(crm_id);
CREATE INDEX idx_accounts_search ON accounts USING gin(search_vector);

-- Opportunities
CREATE INDEX idx_opportunities_team ON opportunities(team_id);
CREATE INDEX idx_opportunities_account ON opportunities(account_id);
CREATE INDEX idx_opportunities_prospect ON opportunities(prospect_id);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_opportunities_close_date ON opportunities(close_date);
CREATE INDEX idx_opportunities_crm_id ON opportunities(crm_id);

-- Notes
CREATE INDEX idx_notes_team ON notes(team_id);
CREATE INDEX idx_notes_prospect ON notes(prospect_id);
CREATE INDEX idx_notes_account ON notes(account_id);
CREATE INDEX idx_notes_opportunity ON notes(opportunity_id);
CREATE INDEX idx_notes_created ON notes(created_at DESC);
CREATE INDEX idx_notes_crm_id ON notes(crm_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get connection status
CREATE OR REPLACE FUNCTION get_connection_status(p_connection_id UUID)
RETURNS TABLE (
  provider TEXT,
  is_active BOOLEAN,
  last_sync_at TIMESTAMPTZ,
  sync_jobs_completed INT,
  sync_jobs_failed INT,
  entities_synced INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.provider,
    c.is_active,
    c.last_sync_at,
    (SELECT COUNT(*) FROM crm_sync_jobs WHERE connection_id = p_connection_id AND status = 'completed')::INT,
    (SELECT COUNT(*) FROM crm_sync_jobs WHERE connection_id = p_connection_id AND status = 'failed')::INT,
    (SELECT COUNT(*) FROM crm_entity_mappings WHERE connection_id = p_connection_id)::INT
  FROM crm_connections c
  WHERE c.id = p_connection_id;
END;
$$ LANGUAGE plpgsql;

-- Get sync statistics
CREATE OR REPLACE FUNCTION get_sync_stats(
  p_connection_id UUID,
  p_days_back INT DEFAULT 30
)
RETURNS TABLE (
  entity_type TEXT,
  total_synced INT,
  pull_count INT,
  push_count INT,
  success_count INT,
  failed_count INT,
  last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.entity_type,
    COUNT(*)::INT as total_synced,
    COUNT(*) FILTER (WHERE j.direction IN ('pull', 'bidirectional'))::INT as pull_count,
    COUNT(*) FILTER (WHERE j.direction IN ('push', 'bidirectional'))::INT as push_count,
    COUNT(*) FILTER (WHERE j.status = 'completed')::INT as success_count,
    COUNT(*) FILTER (WHERE j.status = 'failed')::INT as failed_count,
    MAX(j.completed_at) as last_sync_at
  FROM crm_sync_jobs j
  WHERE j.connection_id = p_connection_id
    AND j.started_at > NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY j.entity_type;
END;
$$ LANGUAGE plpgsql;

-- Get unresolved conflicts
CREATE OR REPLACE FUNCTION get_unresolved_conflicts(p_connection_id UUID)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  internal_id UUID,
  crm_id TEXT,
  conflict_type TEXT,
  detected_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.entity_type,
    c.internal_id,
    c.crm_id,
    c.conflict_type,
    c.detected_at
  FROM crm_sync_conflicts c
  WHERE c.connection_id = p_connection_id
    AND c.resolved_at IS NULL
  ORDER BY c.detected_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Update account search vector
CREATE OR REPLACE FUNCTION update_account_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.domain, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for account search vector
CREATE TRIGGER trigger_update_account_search_vector
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_account_search_vector();

-- Log sync event
CREATE OR REPLACE FUNCTION log_sync_event(
  p_connection_id UUID,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_action TEXT,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO crm_sync_log (
    connection_id,
    entity_type,
    entity_id,
    action,
    success,
    error,
    timestamp
  ) VALUES (
    p_connection_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_success,
    p_error,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Cleanup old sync logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM crm_sync_log
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- CRM Connections: Admins only
CREATE POLICY crm_connections_policy ON crm_connections
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND user_has_permission(auth.uid(), 'integrations:crm')
  );

-- Accounts: View own organization
CREATE POLICY accounts_view_policy ON accounts
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Opportunities: View own organization
CREATE POLICY opportunities_view_policy ON opportunities
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Notes: View own organization
CREATE POLICY notes_view_policy ON notes
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE crm_connections IS 'CRM connection configurations (Salesforce, HubSpot, etc.)';
COMMENT ON TABLE crm_field_mappings IS 'Field mappings between internal and CRM fields';
COMMENT ON TABLE crm_entity_mappings IS 'Mappings between internal IDs and CRM IDs';
COMMENT ON TABLE crm_sync_jobs IS 'Sync job queue and history';
COMMENT ON TABLE crm_sync_log IS 'Detailed sync event logging';
COMMENT ON TABLE crm_sync_conflicts IS 'Sync conflicts requiring resolution';
COMMENT ON TABLE accounts IS 'Company/Account entities from CRM';
COMMENT ON TABLE opportunities IS 'Deal/Opportunity entities from CRM';
COMMENT ON TABLE notes IS 'Note entities from CRM';
