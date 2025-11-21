/**
 * Marketing Hub Migration
 * Database schema for Marketing Hub features: campaigns, automation, forms, landing pages
 */

-- Marketing Campaigns table
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'landing_page', 'social', 'ads', 'event')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused', 'archived')),

  -- Email campaign fields
  subject TEXT,
  preheader TEXT,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,

  -- Content
  html_content TEXT,
  text_content TEXT,

  -- Targeting
  segment_id UUID REFERENCES contact_segments(id) ON DELETE SET NULL,
  contact_list_ids UUID[],
  exclude_list_ids UUID[],

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT FALSE,
  ab_test_variants JSONB,

  -- Tracking
  track_opens BOOLEAN DEFAULT TRUE,
  track_clicks BOOLEAN DEFAULT TRUE,

  -- Statistics
  stats JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0, "complained": 0}'::jsonb,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_marketing_campaigns_type (type),
  INDEX idx_marketing_campaigns_status (status),
  INDEX idx_marketing_campaigns_created_at (created_at DESC)
);

-- Contact Segments table
CREATE TABLE contact_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL, -- {conditions: [...], logic: 'AND'|'OR'}
  contact_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_contact_segments_name (name)
);

-- Contact Lists table
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT CHECK (list_type IN ('static', 'dynamic')),
  segment_id UUID REFERENCES contact_segments(id) ON DELETE SET NULL,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_contact_lists_name (name)
);

-- Contact List Members table
CREATE TABLE contact_list_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_contact_list_members_list (list_id),
  INDEX idx_contact_list_members_prospect (prospect_id),
  UNIQUE (list_id, prospect_id)
);

-- Campaign Emails table (for tracking individual sends)
CREATE TABLE campaign_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'bounced', 'failed')),
  bounce_type TEXT CHECK (bounce_type IN ('hard', 'soft', 'complaint')),
  bounce_reason TEXT,

  -- Tracking
  is_test BOOLEAN DEFAULT FALSE,
  opened BOOLEAN DEFAULT FALSE,
  clicked BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,

  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_campaign_emails_campaign (campaign_id),
  INDEX idx_campaign_emails_prospect (prospect_id),
  INDEX idx_campaign_emails_status (status)
);

-- Campaign Email Events table (opens, clicks)
CREATE TABLE campaign_email_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  campaign_email_id UUID NOT NULL REFERENCES campaign_emails(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click', 'unsubscribe', 'complaint')),
  url TEXT, -- For clicks
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  location_country TEXT,
  location_city TEXT,

  -- Timestamp
  occurred_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_campaign_email_events_campaign (campaign_id),
  INDEX idx_campaign_email_events_email (campaign_email_id),
  INDEX idx_campaign_email_events_type (event_type),
  INDEX idx_campaign_email_events_occurred_at (occurred_at DESC)
);

-- Campaign Email Clicks table (for link tracking)
CREATE TABLE campaign_email_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  campaign_email_id UUID NOT NULL REFERENCES campaign_emails(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_campaign_email_clicks_campaign (campaign_id),
  INDEX idx_campaign_email_clicks_url (url)
);

-- Marketing Workflows table
CREATE TABLE marketing_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')) DEFAULT 'paused',

  -- Configuration
  trigger JSONB NOT NULL, -- {type, config, filters}
  actions JSONB NOT NULL, -- Array of workflow actions

  -- Settings
  allow_multiple_enrollments BOOLEAN DEFAULT FALSE,
  remove_on_goal_achievement BOOLEAN DEFAULT FALSE,
  goal_criteria JSONB,

  -- Statistics
  stats JSONB DEFAULT '{"enrolled": 0, "active": 0, "completed": 0, "goalAchieved": 0}'::jsonb,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_marketing_workflows_status (status),
  INDEX idx_marketing_workflows_created_at (created_at DESC)
);

-- Workflow Enrollments table
CREATE TABLE workflow_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES marketing_workflows(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'removed')) DEFAULT 'active',
  current_action_id TEXT,

  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_workflow_enrollments_workflow (workflow_id),
  INDEX idx_workflow_enrollments_prospect (prospect_id),
  INDEX idx_workflow_enrollments_status (status)
);

-- Workflow Emails table (emails sent by workflows)
CREATE TABLE workflow_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES marketing_workflows(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES workflow_enrollments(id) ON DELETE SET NULL,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  -- Email content
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')) DEFAULT 'queued',
  error_message TEXT,

  -- Timestamps
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_workflow_emails_workflow (workflow_id),
  INDEX idx_workflow_emails_prospect (prospect_id),
  INDEX idx_workflow_emails_status (status)
);

-- Workflow Scheduled Actions table (for delays)
CREATE TABLE workflow_scheduled_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES marketing_workflows(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES workflow_enrollments(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,

  -- Execution
  execute_at TIMESTAMPTZ NOT NULL,
  executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_workflow_scheduled_actions_execute_at (execute_at),
  INDEX idx_workflow_scheduled_actions_executed (executed),
  INDEX idx_workflow_scheduled_actions_workflow (workflow_id)
);

-- Forms table
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',

  -- Configuration
  fields JSONB NOT NULL, -- Array of form fields
  submit_button_text TEXT DEFAULT 'Submit',
  success_message TEXT,
  redirect_url TEXT,

  -- Settings
  enable_recaptcha BOOLEAN DEFAULT FALSE,
  require_email_confirmation BOOLEAN DEFAULT FALSE,
  send_notification BOOLEAN DEFAULT FALSE,
  notification_recipients TEXT[],

  -- Styling
  custom_css TEXT,
  theme TEXT,

  -- Statistics
  submissions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2),

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_forms_status (status),
  INDEX idx_forms_created_at (created_at DESC)
);

-- Form Submissions table
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,

  -- Submission data
  data JSONB NOT NULL, -- Form field values
  ip_address TEXT,
  user_agent TEXT,
  page_url TEXT,

  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,

  -- Timestamp
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_form_submissions_form (form_id),
  INDEX idx_form_submissions_prospect (prospect_id),
  INDEX idx_form_submissions_submitted_at (submitted_at DESC)
);

-- Landing Pages table
CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',

  -- URL
  slug TEXT NOT NULL UNIQUE,
  meta_title TEXT,
  meta_description TEXT,

  -- Content
  content JSONB NOT NULL, -- Page builder content/modules
  custom_html TEXT,
  custom_css TEXT,
  custom_js TEXT,

  -- Settings
  template_id UUID,
  form_id UUID REFERENCES forms(id) ON DELETE SET NULL,
  enable_ab_test BOOLEAN DEFAULT FALSE,
  ab_test_variants JSONB,

  -- Analytics
  views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2),

  -- SEO
  canonical_url TEXT,
  robots_meta TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_landing_pages_slug (slug),
  INDEX idx_landing_pages_status (status),
  INDEX idx_landing_pages_created_at (created_at DESC)
);

-- Page Views table (analytics)
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,

  -- Session
  session_id TEXT,
  is_unique BOOLEAN DEFAULT FALSE,

  -- Details
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,

  -- Location
  country TEXT,
  city TEXT,

  -- UTM
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Timestamp
  viewed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_page_views_page (page_id),
  INDEX idx_page_views_prospect (prospect_id),
  INDEX idx_page_views_viewed_at (viewed_at DESC),
  INDEX idx_page_views_session (session_id)
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get campaign performance metrics
 */
CREATE OR REPLACE FUNCTION get_campaign_metrics(p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'sent', COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')),
    'delivered', COUNT(*) FILTER (WHERE status = 'delivered'),
    'bounced', COUNT(*) FILTER (WHERE status = 'bounced'),
    'opened', COUNT(*) FILTER (WHERE opened = TRUE),
    'clicked', COUNT(*) FILTER (WHERE clicked = TRUE),
    'open_rate', (COUNT(*) FILTER (WHERE opened = TRUE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status = 'delivered'), 0) * 100),
    'click_rate', (COUNT(*) FILTER (WHERE clicked = TRUE)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status = 'delivered'), 0) * 100)
  ) INTO v_result
  FROM campaign_emails
  WHERE campaign_id = p_campaign_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get workflow performance metrics
 */
CREATE OR REPLACE FUNCTION get_workflow_metrics(p_workflow_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'enrolled', COUNT(*),
      'active', COUNT(*) FILTER (WHERE status = 'active'),
      'completed', COUNT(*) FILTER (WHERE status = 'completed'),
      'average_completion_time', AVG(EXTRACT(EPOCH FROM (completed_at - enrolled_at)) / 3600) FILTER (WHERE completed_at IS NOT NULL)
    )
    FROM workflow_enrollments
    WHERE workflow_id = p_workflow_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Update campaign statistics
 */
CREATE OR REPLACE FUNCTION update_campaign_stats(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
  v_stats JSONB;
BEGIN
  v_stats := get_campaign_metrics(p_campaign_id);

  UPDATE marketing_campaigns
  SET stats = v_stats
  WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Calculate segment size
 */
CREATE OR REPLACE FUNCTION calculate_segment_size(p_segment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- This is a simplified version
  -- In practice, would parse and apply criteria from the segment
  SELECT COUNT(*)
  INTO v_count
  FROM prospects;

  UPDATE contact_segments
  SET contact_count = v_count,
      last_calculated = NOW()
  WHERE id = p_segment_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

/**
 * Update campaign stats on email event
 */
CREATE OR REPLACE FUNCTION trigger_update_campaign_stats_on_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'open' THEN
    UPDATE campaign_emails
    SET opened = TRUE,
        opened_at = COALESCE(opened_at, NEW.occurred_at)
    WHERE id = NEW.campaign_email_id;
  ELSIF NEW.event_type = 'click' THEN
    UPDATE campaign_emails
    SET clicked = TRUE,
        first_clicked_at = COALESCE(first_clicked_at, NEW.occurred_at)
    WHERE id = NEW.campaign_email_id;
  END IF;

  -- Schedule async stats update
  PERFORM update_campaign_stats(NEW.campaign_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_campaign_email_event
  AFTER INSERT ON campaign_email_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_campaign_stats_on_event();

/**
 * Increment form submissions count
 */
CREATE OR REPLACE FUNCTION trigger_increment_form_submissions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forms
  SET submissions = submissions + 1
  WHERE id = NEW.form_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_form_submission
  AFTER INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_increment_form_submissions();

/**
 * Increment page views
 */
CREATE OR REPLACE FUNCTION trigger_increment_page_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE landing_pages
  SET views = views + 1,
      unique_visitors = CASE WHEN NEW.is_unique THEN unique_visitors + 1 ELSE unique_visitors END
  WHERE id = NEW.page_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_page_view
  AFTER INSERT ON page_views
  FOR EACH ROW
  EXECUTE FUNCTION trigger_increment_page_views();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (team-based access)
CREATE POLICY marketing_campaigns_select ON marketing_campaigns FOR SELECT USING (TRUE);
CREATE POLICY marketing_campaigns_insert ON marketing_campaigns FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY marketing_campaigns_update ON marketing_campaigns FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY contact_segments_select ON contact_segments FOR SELECT USING (TRUE);
CREATE POLICY contact_segments_insert ON contact_segments FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY marketing_workflows_select ON marketing_workflows FOR SELECT USING (TRUE);
CREATE POLICY marketing_workflows_insert ON marketing_workflows FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY marketing_workflows_update ON marketing_workflows FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY forms_select ON forms FOR SELECT USING (TRUE); -- Public forms are viewable
CREATE POLICY forms_insert ON forms FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY forms_update ON forms FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY landing_pages_select ON landing_pages FOR SELECT USING (TRUE); -- Public pages viewable
CREATE POLICY landing_pages_insert ON landing_pages FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY landing_pages_update ON landing_pages FOR UPDATE USING (created_by = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE marketing_campaigns IS 'Email and marketing campaigns';
COMMENT ON TABLE contact_segments IS 'Dynamic contact segmentation';
COMMENT ON TABLE marketing_workflows IS 'Marketing automation workflows';
COMMENT ON TABLE forms IS 'Lead capture forms';
COMMENT ON TABLE landing_pages IS 'Landing pages with analytics';
