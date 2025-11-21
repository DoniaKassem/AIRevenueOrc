-- =============================================
-- Email Deliverability Infrastructure Schema
-- Priority 1 Launch Blocker Feature
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- EMAILS
-- =============================================

-- Main emails table
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Recipients (stored as JSONB arrays)
  "to" JSONB NOT NULL, -- [{ email, name }]
  cc JSONB, -- [{ email, name }]
  bcc JSONB, -- [{ email, name }]

  -- Content
  subject TEXT NOT NULL,
  html TEXT,
  "text" TEXT,

  -- Status
  status TEXT CHECK (status IN ('draft', 'scheduled', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed')) DEFAULT 'draft',

  -- Tracking
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,

  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,

  replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,

  bounced BOOLEAN DEFAULT FALSE,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,

  -- SendGrid
  sendgrid_message_id TEXT,

  -- Relationships
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  campaign_id UUID,

  -- Metadata
  metadata JSONB,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_org ON emails(organization_id);
CREATE INDEX idx_emails_user ON emails(user_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_prospect ON emails(prospect_id);
CREATE INDEX idx_emails_deal ON emails(deal_id);
CREATE INDEX idx_emails_campaign ON emails(campaign_id);
CREATE INDEX idx_emails_sent_at ON emails(sent_at DESC);
CREATE INDEX idx_emails_scheduled ON emails(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_emails_opened ON emails(opened) WHERE opened = TRUE;
CREATE INDEX idx_emails_clicked ON emails(clicked) WHERE clicked = TRUE;
CREATE INDEX idx_emails_bounced ON emails(bounced) WHERE bounced = TRUE;

-- GIN index for searching in recipients
CREATE INDEX idx_emails_to_gin ON emails USING gin("to");

-- =============================================
-- EMAIL TEMPLATES
-- =============================================

-- Reusable email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Template details
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  "text" TEXT,

  -- Variables (e.g. ['firstName', 'companyName'])
  variables TEXT[] DEFAULT '{}',

  -- Category
  category TEXT CHECK (category IN ('sales', 'marketing', 'support', 'transactional', 'custom')) DEFAULT 'custom',

  -- Visibility
  is_public BOOLEAN DEFAULT FALSE, -- Public templates available to all in org

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Creator
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON email_templates(organization_id);
CREATE INDEX idx_templates_category ON email_templates(category);
CREATE INDEX idx_templates_public ON email_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_templates_created_by ON email_templates(created_by);

-- =============================================
-- EMAIL TRACKING EVENTS
-- =============================================

-- Detailed event tracking
CREATE TABLE email_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'spam_reported', 'unsubscribed')) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,

  -- Event-specific metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_email ON email_tracking_events(email_id);
CREATE INDEX idx_tracking_type ON email_tracking_events(event_type);
CREATE INDEX idx_tracking_timestamp ON email_tracking_events(event_timestamp DESC);

-- =============================================
-- EMAIL BLACKLIST
-- =============================================

-- Invalid/bounced email addresses
CREATE TABLE email_blacklist (
  email TEXT PRIMARY KEY,
  reason TEXT CHECK (reason IN ('bounce', 'invalid', 'spam', 'manual')) NOT NULL,
  bounce_reason TEXT,
  blacklisted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blacklist_reason ON email_blacklist(reason);
CREATE INDEX idx_blacklist_date ON email_blacklist(blacklisted_at DESC);

-- =============================================
-- EMAIL UNSUBSCRIBES
-- =============================================

-- Unsubscribed email addresses
CREATE TABLE email_unsubscribes (
  email TEXT PRIMARY KEY,
  reason TEXT CHECK (reason IN ('manual', 'spam_report', 'bounced', 'other')) NOT NULL,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unsubscribes_reason ON email_unsubscribes(reason);
CREATE INDEX idx_unsubscribes_date ON email_unsubscribes(unsubscribed_at DESC);

-- =============================================
-- BULK EMAIL JOBS
-- =============================================

-- Bulk sending jobs
CREATE TABLE bulk_email_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID,

  -- Content
  subject TEXT NOT NULL,
  html TEXT,
  "text" TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,

  -- Progress
  total_emails INTEGER NOT NULL,
  sent_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  queued_emails INTEGER NOT NULL,

  -- Status
  status TEXT CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',

  -- Rate limiting
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_sent_at TIMESTAMPTZ,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_jobs_org ON bulk_email_jobs(organization_id);
CREATE INDEX idx_bulk_jobs_user ON bulk_email_jobs(user_id);
CREATE INDEX idx_bulk_jobs_campaign ON bulk_email_jobs(campaign_id);
CREATE INDEX idx_bulk_jobs_status ON bulk_email_jobs(status);
CREATE INDEX idx_bulk_jobs_created ON bulk_email_jobs(created_at DESC);

-- =============================================
-- BULK EMAIL QUEUE
-- =============================================

-- Queue for bulk sending
CREATE TABLE bulk_email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES bulk_email_jobs(id) ON DELETE CASCADE,

  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  variables JSONB, -- For template personalization
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  metadata JSONB,

  -- Status
  status TEXT CHECK (status IN ('queued', 'sending', 'sent', 'failed')) DEFAULT 'queued',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_job ON bulk_email_queue(job_id);
CREATE INDEX idx_queue_status ON bulk_email_queue(status);
CREATE INDEX idx_queue_prospect ON bulk_email_queue(prospect_id);
CREATE INDEX idx_queue_created ON bulk_email_queue(created_at);

-- Composite index for queue processing
CREATE INDEX idx_queue_processing ON bulk_email_queue(job_id, status, created_at)
  WHERE status = 'queued';

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if email is blacklisted
CREATE OR REPLACE FUNCTION is_email_blacklisted(email_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_blacklist WHERE email = email_address
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if email is unsubscribed
CREATE OR REPLACE FUNCTION is_email_unsubscribed(email_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_unsubscribes WHERE email = email_address
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get email engagement score (0-100)
CREATE OR REPLACE FUNCTION calculate_email_engagement_score(
  p_prospect_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_sent_count INTEGER;
  v_open_count INTEGER;
  v_click_count INTEGER;
  v_reply_count INTEGER;
  v_score INTEGER;
BEGIN
  -- Get counts
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE opened = TRUE),
    COUNT(*) FILTER (WHERE clicked = TRUE),
    COUNT(*) FILTER (WHERE replied = TRUE)
  INTO v_sent_count, v_open_count, v_click_count, v_reply_count
  FROM emails
  WHERE prospect_id = p_prospect_id
    AND sent_at >= NOW() - (p_days || ' days')::INTERVAL;

  -- Calculate score
  IF v_sent_count = 0 THEN
    RETURN 0;
  END IF;

  v_score := 0;

  -- Open rate (0-40 points)
  v_score := v_score + LEAST(40, (v_open_count::FLOAT / v_sent_count * 100)::INTEGER);

  -- Click rate (0-30 points)
  v_score := v_score + LEAST(30, (v_click_count::FLOAT / v_sent_count * 150)::INTEGER);

  -- Reply rate (0-30 points)
  v_score := v_score + LEAST(30, (v_reply_count::FLOAT / v_sent_count * 300)::INTEGER);

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on emails
CREATE TRIGGER trigger_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Auto-update updated_at on templates
CREATE TRIGGER trigger_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Auto-update updated_at on bulk jobs
CREATE TRIGGER trigger_bulk_jobs_updated_at
  BEFORE UPDATE ON bulk_email_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_email_queue ENABLE ROW LEVEL SECURITY;

-- Emails: Users can view emails in their organization
CREATE POLICY "Users can view org emails"
  ON emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = emails.organization_id
    )
  );

CREATE POLICY "Users can create emails"
  ON emails FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = emails.organization_id
    )
  );

CREATE POLICY "Users can update their own emails"
  ON emails FOR UPDATE
  USING (user_id = auth.uid());

-- Templates: Users can view their org's templates
CREATE POLICY "Users can view org templates"
  ON email_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = email_templates.organization_id
    )
  );

CREATE POLICY "Users can create templates"
  ON email_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = email_templates.organization_id
    )
  );

CREATE POLICY "Users can update their own templates"
  ON email_templates FOR UPDATE
  USING (created_by = auth.uid());

-- Tracking events: Service role only
CREATE POLICY "Service can manage tracking events"
  ON email_tracking_events FOR ALL
  USING (true);

-- Blacklist: Service role only
CREATE POLICY "Service can manage blacklist"
  ON email_blacklist FOR ALL
  USING (true);

-- Unsubscribes: Service role only
CREATE POLICY "Service can manage unsubscribes"
  ON email_unsubscribes FOR ALL
  USING (true);

-- Bulk jobs: Users can view their org's jobs
CREATE POLICY "Users can view org bulk jobs"
  ON bulk_email_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = bulk_email_jobs.organization_id
    )
  );

CREATE POLICY "Users can create bulk jobs"
  ON bulk_email_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = bulk_email_jobs.organization_id
    )
  );

CREATE POLICY "Users can update their own bulk jobs"
  ON bulk_email_jobs FOR UPDATE
  USING (user_id = auth.uid());

-- Queue: Service role only
CREATE POLICY "Service can manage queue"
  ON bulk_email_queue FOR ALL
  USING (true);

-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================

-- Email performance by user
CREATE VIEW email_performance_by_user AS
SELECT
  user_id,
  organization_id,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  COUNT(*) FILTER (WHERE opened = TRUE) as opened,
  COUNT(*) FILTER (WHERE clicked = TRUE) as clicked,
  COUNT(*) FILTER (WHERE replied = TRUE) as replied,
  COUNT(*) FILTER (WHERE bounced = TRUE) as bounced,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'delivered') > 0
    THEN (COUNT(*) FILTER (WHERE opened = TRUE)::FLOAT / COUNT(*) FILTER (WHERE status = 'delivered') * 100)
    ELSE 0
  END as open_rate,
  CASE
    WHEN COUNT(*) FILTER (WHERE opened = TRUE) > 0
    THEN (COUNT(*) FILTER (WHERE clicked = TRUE)::FLOAT / COUNT(*) FILTER (WHERE opened = TRUE) * 100)
    ELSE 0
  END as click_rate,
  CASE
    WHEN COUNT(*) > 0
    THEN (COUNT(*) FILTER (WHERE bounced = TRUE)::FLOAT / COUNT(*) * 100)
    ELSE 0
  END as bounce_rate
FROM emails
WHERE sent_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, organization_id;

-- Email engagement by prospect
CREATE VIEW email_engagement_by_prospect AS
SELECT
  prospect_id,
  COUNT(*) as emails_sent,
  COUNT(*) FILTER (WHERE opened = TRUE) as emails_opened,
  COUNT(*) FILTER (WHERE clicked = TRUE) as emails_clicked,
  COUNT(*) FILTER (WHERE replied = TRUE) as emails_replied,
  MAX(sent_at) as last_email_sent,
  MAX(opened_at) as last_email_opened,
  MAX(replied_at) as last_email_replied,
  calculate_email_engagement_score(prospect_id) as engagement_score
FROM emails
WHERE prospect_id IS NOT NULL
  AND sent_at >= NOW() - INTERVAL '30 days'
GROUP BY prospect_id;

-- Template performance
CREATE VIEW template_performance AS
SELECT
  et.id as template_id,
  et.name as template_name,
  et.category,
  et.use_count,
  COUNT(e.id) as emails_sent,
  COUNT(e.id) FILTER (WHERE e.opened = TRUE) as emails_opened,
  COUNT(e.id) FILTER (WHERE e.clicked = TRUE) as emails_clicked,
  CASE
    WHEN COUNT(e.id) > 0
    THEN (COUNT(e.id) FILTER (WHERE e.opened = TRUE)::FLOAT / COUNT(e.id) * 100)
    ELSE 0
  END as open_rate
FROM email_templates et
LEFT JOIN emails e ON e.metadata->>'templateId' = et.id::TEXT
WHERE e.sent_at >= NOW() - INTERVAL '30 days' OR e.sent_at IS NULL
GROUP BY et.id, et.name, et.category, et.use_count;

-- =============================================
-- INITIAL DATA
-- =============================================

-- No initial data needed

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE emails IS 'All sent and scheduled emails';
COMMENT ON TABLE email_templates IS 'Reusable email templates';
COMMENT ON TABLE email_tracking_events IS 'Detailed event tracking for emails';
COMMENT ON TABLE email_blacklist IS 'Invalid or bounced email addresses';
COMMENT ON TABLE email_unsubscribes IS 'Unsubscribed email addresses';
COMMENT ON TABLE bulk_email_jobs IS 'Bulk sending jobs for campaigns';
COMMENT ON TABLE bulk_email_queue IS 'Queue for bulk email sending';

COMMENT ON COLUMN emails.sendgrid_message_id IS 'SendGrid message ID for tracking';
COMMENT ON COLUMN emails.open_count IS 'Number of times email was opened (multiple opens)';
COMMENT ON COLUMN emails.click_count IS 'Number of times links were clicked';
COMMENT ON COLUMN email_templates.variables IS 'Template variable names (e.g. firstName, companyName)';
COMMENT ON COLUMN bulk_email_jobs.rate_limit_per_hour IS 'Maximum emails to send per hour';
