-- Outreach Infrastructure Schema
-- Email deliverability, objection handling, and compliance management

-- Sending Domains (Email Deliverability)
CREATE TABLE IF NOT EXISTS sending_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,

  -- Health & Reputation
  health_score INTEGER DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  reputation_score INTEGER DEFAULT 50 CHECK (reputation_score BETWEEN 0 AND 100),

  -- Volume Management
  daily_limit INTEGER DEFAULT 10,
  current_daily_count INTEGER DEFAULT 0,
  warmup_stage TEXT DEFAULT 'new' CHECK (warmup_stage IN ('new', 'warming', 'warm', 'established')),

  -- Authentication
  spf_valid BOOLEAN DEFAULT false,
  dkim_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,

  -- Bounce Tracking
  hard_bounce_rate DECIMAL(5,2) DEFAULT 0,
  soft_bounce_rate DECIMAL(5,2) DEFAULT 0,
  complaint_rate DECIMAL(5,2) DEFAULT 0,

  -- Engagement
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'warming', 'paused', 'blacklisted')),

  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, domain)
);

-- Email Send Log (for warmup tracking)
CREATE TABLE IF NOT EXISTS email_send_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL,

  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Bounces
CREATE TABLE IF NOT EXISTS email_bounces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL,

  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft')),
  reason TEXT,

  bounced_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Complaints
CREATE TABLE IF NOT EXISTS email_complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  recipient TEXT NOT NULL,

  complaint_type TEXT DEFAULT 'spam',
  feedback_loop_id TEXT,

  complained_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain Warmup Log
CREATE TABLE IF NOT EXISTS domain_warmup_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,

  day INTEGER NOT NULL,
  target_volume INTEGER NOT NULL,
  actual_sent INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Objection Log
CREATE TABLE IF NOT EXISTS objection_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  objection_type TEXT NOT NULL CHECK (objection_type IN (
    'price', 'timing', 'competition', 'no_need', 'decision_maker', 'other'
  )),
  objection_severity TEXT NOT NULL CHECK (objection_severity IN ('soft', 'medium', 'hard')),
  objection_text TEXT NOT NULL,

  suggested_response TEXT,
  actual_response TEXT,

  was_overcome BOOLEAN,
  outcome TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consent Records (GDPR/Compliance)
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  email TEXT NOT NULL,

  -- Consent Details
  consent_type TEXT NOT NULL CHECK (consent_type IN ('explicit', 'implied', 'legitimate_interest')),
  consent_source TEXT NOT NULL CHECK (consent_source IN (
    'form_submission', 'inbound_inquiry', 'business_card', 'purchased_list',
    'public_directory', 'other'
  )),
  consent_date TIMESTAMPTZ NOT NULL,
  consent_ip_address TEXT,
  consent_user_agent TEXT,

  -- Communication Preferences
  email_allowed BOOLEAN DEFAULT true,
  phone_allowed BOOLEAN DEFAULT false,
  sms_allowed BOOLEAN DEFAULT false,
  communication_frequency TEXT CHECK (communication_frequency IN ('daily', 'weekly', 'monthly', 'never')),
  communication_topics TEXT[],

  -- Compliance
  gdpr_compliant BOOLEAN DEFAULT false,
  can_spam_compliant BOOLEAN DEFAULT true,
  casl_compliant BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, email)
);

-- Unsubscribe Requests
CREATE TABLE IF NOT EXISTS unsubscribe_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  unsubscribe_type TEXT NOT NULL CHECK (unsubscribe_type IN (
    'all', 'marketing', 'transactional', 'specific_list'
  )),
  unsubscribe_reason TEXT,
  unsubscribe_source TEXT NOT NULL CHECK (unsubscribe_source IN (
    'email_link', 'reply', 'complaint', 'manual'
  )),

  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data Deletion Requests (GDPR Right to Erasure)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  request_type TEXT NOT NULL CHECK (request_type IN (
    'right_to_erasure', 'right_to_be_forgotten', 'ccpa_delete'
  )),
  request_date TIMESTAMPTZ NOT NULL,
  requestor_verified BOOLEAN DEFAULT false,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),

  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  deleted_data TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Audit Log
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  affected_email TEXT NOT NULL,

  details JSONB DEFAULT '{}',

  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Domains
CREATE TABLE IF NOT EXISTS blocked_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  domain TEXT NOT NULL,
  reason TEXT,
  blocked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, domain)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_sending_domains_team ON sending_domains(team_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sending_domains_warmup ON sending_domains(warmup_stage);

CREATE INDEX IF NOT EXISTS idx_email_send_log_team_domain ON email_send_log(team_id, domain, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_date ON email_send_log(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_bounces_team ON email_bounces(team_id, bounced_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_bounces_domain ON email_bounces(domain, bounce_type);
CREATE INDEX IF NOT EXISTS idx_email_bounces_recipient ON email_bounces(recipient);

CREATE INDEX IF NOT EXISTS idx_email_complaints_team ON email_complaints(team_id, complained_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_complaints_domain ON email_complaints(domain);

CREATE INDEX IF NOT EXISTS idx_objection_log_team ON objection_log(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objection_log_prospect ON objection_log(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_objection_log_type ON objection_log(objection_type, objection_severity);

CREATE INDEX IF NOT EXISTS idx_consent_records_team_email ON consent_records(team_id, email);
CREATE INDEX IF NOT EXISTS idx_consent_records_expires ON consent_records(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_requests_team ON unsubscribe_requests(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_requests_email ON unsubscribe_requests(email);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_team ON data_deletion_requests(team_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_pending ON data_deletion_requests(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_team ON compliance_audit_log(team_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_log_email ON compliance_audit_log(affected_email);

CREATE INDEX IF NOT EXISTS idx_blocked_domains_team ON blocked_domains(team_id);

-- Enable Row Level Security
ALTER TABLE sending_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_warmup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscribe_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies (team-based access)
CREATE POLICY "Users can manage their team's sending domains"
  ON sending_domains FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their team's email logs"
  ON email_send_log FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's objections"
  ON objection_log FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's consent records"
  ON consent_records FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their team's compliance logs"
  ON compliance_audit_log FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Helper Functions

-- Function to increment daily send count
CREATE OR REPLACE FUNCTION increment_domain_daily_count(
  p_domain TEXT,
  p_team_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE sending_domains
  SET current_daily_count = current_daily_count + 1,
      updated_at = NOW()
  WHERE domain = p_domain
    AND team_id = p_team_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily counts (run via cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_send_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE sending_domains
  SET current_daily_count = 0,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update template performance
CREATE OR REPLACE FUNCTION update_template_performance(
  p_template_id TEXT,
  p_opened BOOLEAN,
  p_replied BOOLEAN,
  p_meeting BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE outreach_templates
  SET times_used = times_used + 1,
      open_rate = CASE
        WHEN p_opened THEN ((open_rate * times_used) + 100) / (times_used + 1)
        ELSE (open_rate * times_used) / (times_used + 1)
      END,
      reply_rate = CASE
        WHEN p_replied THEN ((reply_rate * times_used) + 100) / (times_used + 1)
        ELSE (reply_rate * times_used) / (times_used + 1)
      END,
      meeting_rate = CASE
        WHEN p_meeting THEN ((meeting_rate * times_used) + 100) / (times_used + 1)
        ELSE (meeting_rate * times_used) / (times_used + 1)
      END,
      updated_at = NOW()
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if domain can send
CREATE OR REPLACE FUNCTION can_domain_send(
  p_domain TEXT,
  p_team_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_domain RECORD;
BEGIN
  SELECT * INTO v_domain
  FROM sending_domains
  WHERE domain = p_domain
    AND team_id = p_team_id;

  IF v_domain IS NULL THEN
    RETURN false;
  END IF;

  -- Check status
  IF v_domain.status NOT IN ('active', 'warming') THEN
    RETURN false;
  END IF;

  -- Check daily limit
  IF v_domain.current_daily_count >= v_domain.daily_limit THEN
    RETURN false;
  END IF;

  -- Check health score
  IF v_domain.health_score < 50 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get deliverability stats
CREATE OR REPLACE FUNCTION get_deliverability_stats(
  p_team_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_sent INTEGER,
  hard_bounces INTEGER,
  soft_bounces INTEGER,
  complaints INTEGER,
  hard_bounce_rate DECIMAL,
  complaint_rate DECIMAL
) AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  v_since := NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM email_send_log WHERE team_id = p_team_id AND sent_at >= v_since) as total_sent,
    (SELECT COUNT(*)::INTEGER FROM email_bounces WHERE team_id = p_team_id AND bounce_type = 'hard' AND bounced_at >= v_since) as hard_bounces,
    (SELECT COUNT(*)::INTEGER FROM email_bounces WHERE team_id = p_team_id AND bounce_type = 'soft' AND bounced_at >= v_since) as soft_bounces,
    (SELECT COUNT(*)::INTEGER FROM email_complaints WHERE team_id = p_team_id AND complained_at >= v_since) as complaints,
    (SELECT COUNT(*)::DECIMAL FROM email_bounces WHERE team_id = p_team_id AND bounce_type = 'hard' AND bounced_at >= v_since) /
      NULLIF((SELECT COUNT(*) FROM email_send_log WHERE team_id = p_team_id AND sent_at >= v_since), 0) * 100 as hard_bounce_rate,
    (SELECT COUNT(*)::DECIMAL FROM email_complaints WHERE team_id = p_team_id AND complained_at >= v_since) /
      NULLIF((SELECT COUNT(*) FROM email_send_log WHERE team_id = p_team_id AND sent_at >= v_since), 0) * 100 as complaint_rate;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE sending_domains IS 'Manages email domain health and warmup';
COMMENT ON TABLE email_send_log IS 'Logs all emails sent for volume tracking';
COMMENT ON TABLE email_bounces IS 'Tracks email bounces';
COMMENT ON TABLE email_complaints IS 'Tracks spam complaints';
COMMENT ON TABLE objection_log IS 'Logs sales objections and responses';
COMMENT ON TABLE consent_records IS 'Stores GDPR/CAN-SPAM consent';
COMMENT ON TABLE unsubscribe_requests IS 'Tracks unsubscribe requests';
COMMENT ON TABLE data_deletion_requests IS 'GDPR Right to Erasure requests';
COMMENT ON TABLE compliance_audit_log IS 'Audit trail for compliance actions';
