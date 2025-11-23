-- Outreach Quick Wins Schema
-- Email verification, LinkedIn automation, meeting scheduling, and reply classification

-- Email Verification Cache
CREATE TABLE IF NOT EXISTS email_verification_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  is_valid BOOLEAN NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'risky', 'unknown')),
  checks JSONB NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}',
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reply Classifications
CREATE TABLE IF NOT EXISTS email_reply_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  email_subject TEXT,
  email_body TEXT NOT NULL,

  -- Classification results
  category TEXT NOT NULL CHECK (category IN (
    'positive_interest', 'objection', 'question', 'meeting_request',
    'out_of_office', 'not_interested', 'wrong_person', 'unsubscribe',
    'neutral', 'unclear'
  )),

  -- Sentiment
  sentiment_score DECIMAL(3,2) NOT NULL, -- -1.00 to 1.00
  sentiment_label TEXT NOT NULL CHECK (sentiment_label IN (
    'very_negative', 'negative', 'neutral', 'positive', 'very_positive'
  )),

  -- Intent signals
  intents JSONB DEFAULT '[]',

  -- Objection details
  objection_type TEXT CHECK (objection_type IN ('price', 'timing', 'competition', 'no_need', 'decision_maker', 'other')),
  objection_severity TEXT CHECK (objection_severity IN ('soft', 'medium', 'hard')),

  -- Entities
  entities JSONB DEFAULT '{}',

  -- Suggested action
  suggested_action TEXT NOT NULL,
  suggested_reasoning TEXT,
  suggested_priority TEXT CHECK (suggested_priority IN ('low', 'medium', 'high', 'urgent')),
  suggested_response TEXT,

  -- Metadata
  requires_human_review BOOLEAN DEFAULT false,
  confidence DECIMAL(3,2) NOT NULL,
  processing_time INTEGER, -- milliseconds

  classified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Connections
CREATE TABLE IF NOT EXISTS linkedin_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  profile_url TEXT NOT NULL,
  connection_note TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'declined', 'withdrawn'
  )),

  sent_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Messages
CREATE TABLE IF NOT EXISTS linkedin_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  conversation_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN (
    'connection_request', 'inmail', 'follow_up', 'response'
  )),

  subject TEXT, -- For InMail

  sent_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  is_read BOOLEAN DEFAULT false,
  is_replied BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn Engagements
CREATE TABLE IF NOT EXISTS linkedin_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  engagement_type TEXT NOT NULL CHECK (engagement_type IN (
    'profile_view', 'like', 'comment', 'share'
  )),

  post_content TEXT,
  comment_content TEXT,

  engaged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Meetings
CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  calendar_event_id TEXT NOT NULL,

  title TEXT NOT NULL,
  description TEXT,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL, -- minutes

  attendees TEXT[] NOT NULL DEFAULT '{}',
  organizer TEXT NOT NULL,

  location TEXT,
  meeting_link TEXT,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN (
    'discovery', 'demo', 'follow_up', 'close', 'other'
  )),

  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'cancelled', 'no_show'
  )),

  -- Reminders
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,

  -- Completion
  completion_notes TEXT,
  completed_at TIMESTAMPTZ,

  -- Cancellation
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,

  -- No-show
  no_show_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Integrations
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  provider_type TEXT NOT NULL CHECK (provider_type IN ('google', 'outlook', 'office365', 'apple')),

  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  email TEXT NOT NULL,
  calendar_id TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider_type)
);

-- Send Time Analytics
CREATE TABLE IF NOT EXISTS send_time_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  sent_at TIMESTAMPTZ NOT NULL,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  time_to_open INTEGER, -- seconds
  time_to_click INTEGER, -- seconds
  time_to_reply INTEGER, -- seconds

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Suppression List
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  email TEXT NOT NULL,
  domain TEXT,

  suppression_type TEXT NOT NULL CHECK (suppression_type IN (
    'unsubscribe', 'bounce', 'complaint', 'manual'
  )),

  reason TEXT,
  source TEXT, -- 'user_request', 'bounce', 'complaint', 'admin'

  suppressed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, email)
);

-- Outreach Templates
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'cold_email', 'follow_up', 'meeting_request', 'objection_handling',
    'linkedin_connection', 'linkedin_message', 'case_study', 'value_prop'
  )),

  subject_line TEXT,
  email_body TEXT,

  -- Targeting
  target_persona TEXT[], -- ['C-Level', 'VP/Director', etc.]
  target_industry TEXT[], -- ['Technology', 'Finance', etc.]

  -- Variables available
  variables TEXT[] DEFAULT '{}', -- ['first_name', 'company_name', etc.]

  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  meeting_rate DECIMAL(5,2) DEFAULT 0,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B Test Experiments
CREATE TABLE IF NOT EXISTS ab_test_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  test_type TEXT NOT NULL CHECK (test_type IN (
    'subject_line', 'email_body', 'cta', 'send_time', 'from_name'
  )),

  -- Variants
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  variant_c JSONB, -- Optional third variant

  -- Results
  variant_a_sends INTEGER DEFAULT 0,
  variant_a_opens INTEGER DEFAULT 0,
  variant_a_clicks INTEGER DEFAULT 0,
  variant_a_replies INTEGER DEFAULT 0,

  variant_b_sends INTEGER DEFAULT 0,
  variant_b_opens INTEGER DEFAULT 0,
  variant_b_clicks INTEGER DEFAULT 0,
  variant_b_replies INTEGER DEFAULT 0,

  variant_c_sends INTEGER DEFAULT 0,
  variant_c_opens INTEGER DEFAULT 0,
  variant_c_clicks INTEGER DEFAULT 0,
  variant_c_replies INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'paused', 'completed'
  )),

  winner TEXT CHECK (winner IN ('variant_a', 'variant_b', 'variant_c', 'inconclusive')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verification_cache_email ON email_verification_cache(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_cache_status ON email_verification_cache(status);

CREATE INDEX IF NOT EXISTS idx_reply_classifications_team ON email_reply_classifications(team_id, classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_classifications_prospect ON email_reply_classifications(prospect_id, classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_classifications_category ON email_reply_classifications(category);
CREATE INDEX IF NOT EXISTS idx_reply_classifications_review ON email_reply_classifications(requires_human_review) WHERE requires_human_review = true;

CREATE INDEX IF NOT EXISTS idx_linkedin_connections_team ON linkedin_connections(team_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_prospect ON linkedin_connections(prospect_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_connections_status ON linkedin_connections(status);

CREATE INDEX IF NOT EXISTS idx_linkedin_messages_team ON linkedin_messages(team_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_prospect ON linkedin_messages(prospect_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_unread ON linkedin_messages(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_linkedin_engagements_team ON linkedin_engagements(team_id, engaged_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_engagements_prospect ON linkedin_engagements(prospect_id, engaged_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_team ON scheduled_meetings(team_id, start_time ASC);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_prospect ON scheduled_meetings(prospect_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_status ON scheduled_meetings(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_upcoming ON scheduled_meetings(start_time ASC) WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user ON calendar_integrations(user_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_send_time_analytics_team ON send_time_analytics(team_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_time_analytics_prospect ON send_time_analytics(prospect_id);
CREATE INDEX IF NOT EXISTS idx_send_time_analytics_hour ON send_time_analytics(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_send_time_analytics_day ON send_time_analytics(day_of_week);

CREATE INDEX IF NOT EXISTS idx_suppression_list_team_email ON email_suppression_list(team_id, email);
CREATE INDEX IF NOT EXISTS idx_suppression_list_domain ON email_suppression_list(domain);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_team ON outreach_templates(team_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_outreach_templates_category ON outreach_templates(category);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_team ON ab_test_experiments(team_id, status);

-- Enable Row Level Security
ALTER TABLE email_verification_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reply_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_time_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_experiments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified - can be expanded based on requirements)
-- Email verification cache is public within the system
CREATE POLICY "Anyone can read email verification cache"
  ON email_verification_cache FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert to email verification cache"
  ON email_verification_cache FOR INSERT
  WITH CHECK (true);

-- Team-based access for other tables
CREATE POLICY "Users can view their team's reply classifications"
  ON email_reply_classifications FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's LinkedIn connections"
  ON linkedin_connections FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's LinkedIn messages"
  ON linkedin_messages FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's meetings"
  ON scheduled_meetings FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their own calendar integrations"
  ON calendar_integrations FOR ALL
  USING (user_id = auth.uid());

-- Helper Functions

-- Function to check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(p_team_id UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM email_suppression_list
    WHERE team_id = p_team_id
    AND email = LOWER(p_email)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal send time stats
CREATE OR REPLACE FUNCTION get_optimal_send_hours(p_team_id UUID)
RETURNS TABLE (
  hour_of_day INTEGER,
  total_sent INTEGER,
  total_opened INTEGER,
  total_replied INTEGER,
  open_rate DECIMAL,
  reply_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sta.hour_of_day,
    COUNT(*)::INTEGER as total_sent,
    COUNT(sta.opened_at)::INTEGER as total_opened,
    COUNT(sta.replied_at)::INTEGER as total_replied,
    (COUNT(sta.opened_at)::DECIMAL / COUNT(*) * 100) as open_rate,
    (COUNT(sta.replied_at)::DECIMAL / COUNT(*) * 100) as reply_rate
  FROM send_time_analytics sta
  WHERE sta.team_id = p_team_id
  GROUP BY sta.hour_of_day
  ORDER BY reply_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get LinkedIn performance
CREATE OR REPLACE FUNCTION get_linkedin_performance(p_team_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  connections_sent INTEGER,
  connections_accepted INTEGER,
  acceptance_rate DECIMAL,
  messages_sent INTEGER,
  messages_replied INTEGER,
  response_rate DECIMAL
) AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  v_since := NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT lc.id)::INTEGER as connections_sent,
    COUNT(DISTINCT CASE WHEN lc.status = 'accepted' THEN lc.id END)::INTEGER as connections_accepted,
    (COUNT(DISTINCT CASE WHEN lc.status = 'accepted' THEN lc.id END)::DECIMAL /
      NULLIF(COUNT(DISTINCT lc.id), 0) * 100) as acceptance_rate,
    COUNT(DISTINCT lm.id)::INTEGER as messages_sent,
    COUNT(DISTINCT CASE WHEN lm.is_replied THEN lm.id END)::INTEGER as messages_replied,
    (COUNT(DISTINCT CASE WHEN lm.is_replied THEN lm.id END)::DECIMAL /
      NULLIF(COUNT(DISTINCT lm.id), 0) * 100) as response_rate
  FROM linkedin_connections lc
  FULL OUTER JOIN linkedin_messages lm ON lc.team_id = lm.team_id
  WHERE (lc.team_id = p_team_id OR lm.team_id = p_team_id)
    AND (lc.sent_at >= v_since OR lm.sent_at >= v_since);
END;
$$ LANGUAGE plpgsql;

-- Function to get meeting stats
CREATE OR REPLACE FUNCTION get_meeting_statistics(p_team_id UUID, p_days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  total_scheduled INTEGER,
  total_completed INTEGER,
  total_no_shows INTEGER,
  completion_rate DECIMAL,
  no_show_rate DECIMAL,
  avg_duration DECIMAL
) AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  v_since := NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_scheduled,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as total_completed,
    COUNT(CASE WHEN status = 'no_show' THEN 1 END)::INTEGER as total_no_shows,
    (COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as completion_rate,
    (COUNT(CASE WHEN status = 'no_show' THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as no_show_rate,
    AVG(duration) as avg_duration
  FROM scheduled_meetings
  WHERE team_id = p_team_id
    AND created_at >= v_since;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE email_verification_cache IS 'Caches email verification results';
COMMENT ON TABLE email_reply_classifications IS 'AI-powered email reply classification';
COMMENT ON TABLE linkedin_connections IS 'LinkedIn connection request tracking';
COMMENT ON TABLE linkedin_messages IS 'LinkedIn message outreach';
COMMENT ON TABLE linkedin_engagements IS 'LinkedIn content engagement tracking';
COMMENT ON TABLE scheduled_meetings IS 'Calendar-integrated meeting scheduling';
COMMENT ON TABLE calendar_integrations IS 'User calendar API integrations';
COMMENT ON TABLE send_time_analytics IS 'Email send time optimization data';
COMMENT ON TABLE email_suppression_list IS 'Unsubscribe and bounce management';
COMMENT ON TABLE outreach_templates IS 'Reusable email and message templates';
COMMENT ON TABLE ab_test_experiments IS 'A/B testing for email optimization';
