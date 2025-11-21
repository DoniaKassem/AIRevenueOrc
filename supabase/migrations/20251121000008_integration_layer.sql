-- Integration Layer Schema
-- Incoming replies, response routing, and performance tracking

-- Incoming Replies (Email/LinkedIn messages received)
CREATE TABLE IF NOT EXISTS incoming_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  -- Message details
  from_address TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,

  -- Thread context
  thread_id TEXT,
  in_reply_to TEXT,
  conversation_history JSONB DEFAULT '[]',

  -- Classification (after processing)
  category TEXT,
  sentiment_score DECIMAL(3,2),
  intents JSONB DEFAULT '[]',

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_result JSONB,

  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Response Routing Decisions
CREATE TABLE IF NOT EXISTS response_routing_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES incoming_replies(id) ON DELETE CASCADE,

  -- Classification
  category TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  intents JSONB DEFAULT '[]',

  -- Routing
  routed_to TEXT NOT NULL CHECK (routed_to IN (
    'objection_handler', 'meeting_scheduler', 'human', 'auto_responder', 'suppression'
  )),
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,

  -- Action taken
  action_taken TEXT NOT NULL,
  response_generated TEXT,
  response_sent BOOLEAN DEFAULT false,
  requires_human_review BOOLEAN DEFAULT false,

  -- Results
  meeting_scheduled BOOLEAN DEFAULT false,
  objection_handled BOOLEAN DEFAULT false,
  escalated_to_human BOOLEAN DEFAULT false,

  processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outreach Campaigns (Multi-channel sequences)
CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Strategy
  strategy_type TEXT NOT NULL CHECK (strategy_type IN ('aggressive', 'balanced', 'patient')),
  channels TEXT[] NOT NULL,
  max_touches INTEGER DEFAULT 5,
  stop_on_response BOOLEAN DEFAULT true,

  -- Targeting
  target_persona TEXT[],
  target_industry TEXT[],
  target_company_size TEXT[],
  min_intent_score INTEGER,

  -- Performance
  prospects_enrolled INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  linkedin_sent INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Enrollments
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Progress
  current_touch_number INTEGER DEFAULT 0,
  total_touches_sent INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'responded', 'unsubscribed'
  )),

  -- Results
  replied BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  meeting_scheduled BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false,

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, prospect_id)
);

-- Channel Performance Tracking
CREATE TABLE IF NOT EXISTS channel_performance_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  date DATE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'phone')),

  -- Volume
  sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  bounced INTEGER DEFAULT 0,

  -- Engagement
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,

  -- Outcomes
  meetings_scheduled INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,

  -- Rates
  delivery_rate DECIMAL(5,2) DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  meeting_rate DECIMAL(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, date, channel)
);

-- Outreach Health Scores
CREATE TABLE IF NOT EXISTS outreach_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Overall health
  health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),

  -- Factor scores
  email_deliverability_score INTEGER CHECK (email_deliverability_score BETWEEN 0 AND 100),
  engagement_score INTEGER CHECK (engagement_score BETWEEN 0 AND 100),
  response_time_score INTEGER CHECK (response_time_score BETWEEN 0 AND 100),
  channel_diversity_score INTEGER CHECK (channel_diversity_score BETWEEN 0 AND 100),
  compliance_score INTEGER CHECK (compliance_score BETWEEN 0 AND 100),

  -- Recommendations
  recommendations JSONB DEFAULT '[]',

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(prospect_id)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_incoming_replies_team ON incoming_replies(team_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_replies_prospect ON incoming_replies(prospect_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_incoming_replies_unprocessed ON incoming_replies(processed) WHERE processed = false;

CREATE INDEX IF NOT EXISTS idx_response_routing_team ON response_routing_decisions(team_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_routing_prospect ON response_routing_decisions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_response_routing_category ON response_routing_decisions(category);
CREATE INDEX IF NOT EXISTS idx_response_routing_routed_to ON response_routing_decisions(routed_to);
CREATE INDEX IF NOT EXISTS idx_response_routing_human_review ON response_routing_decisions(requires_human_review) WHERE requires_human_review = true;

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_team ON outreach_campaigns(team_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_strategy ON outreach_campaigns(strategy_type);

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign ON campaign_enrollments(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_prospect ON campaign_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_active ON campaign_enrollments(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_channel_performance_team_date ON channel_performance_daily(team_id, date DESC, channel);

CREATE INDEX IF NOT EXISTS idx_outreach_health_prospect ON outreach_health_scores(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_health_score ON outreach_health_scores(health_score DESC);

-- Enable Row Level Security
ALTER TABLE incoming_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_health_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their team's incoming replies"
  ON incoming_replies FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert incoming replies"
  ON incoming_replies FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's routing decisions"
  ON response_routing_decisions FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage their team's campaigns"
  ON outreach_campaigns FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their team's campaign enrollments"
  ON campaign_enrollments FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their team's channel performance"
  ON channel_performance_daily FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Helper Functions

-- Calculate daily channel performance
CREATE OR REPLACE FUNCTION calculate_channel_performance_daily(
  p_team_id UUID,
  p_date DATE,
  p_channel TEXT
)
RETURNS VOID AS $$
DECLARE
  v_sent INTEGER;
  v_opened INTEGER;
  v_clicked INTEGER;
  v_replied INTEGER;
  v_meetings INTEGER;
BEGIN
  -- Count activities for the day
  SELECT
    COUNT(CASE WHEN activity_type LIKE '%_sent' THEN 1 END),
    COUNT(CASE WHEN activity_type LIKE '%_opened' THEN 1 END),
    COUNT(CASE WHEN activity_type LIKE '%_clicked' THEN 1 END),
    COUNT(CASE WHEN activity_type LIKE '%_received' THEN 1 END),
    COUNT(CASE WHEN activity_type = 'meeting_scheduled' THEN 1 END)
  INTO v_sent, v_opened, v_clicked, v_replied, v_meetings
  FROM bdr_activities
  WHERE team_id = p_team_id
    AND channel = p_channel
    AND DATE(created_at) = p_date;

  -- Upsert performance record
  INSERT INTO channel_performance_daily (
    team_id,
    date,
    channel,
    sent,
    opened,
    clicked,
    replied,
    meetings_scheduled,
    open_rate,
    click_rate,
    reply_rate,
    meeting_rate
  ) VALUES (
    p_team_id,
    p_date,
    p_channel,
    v_sent,
    v_opened,
    v_clicked,
    v_replied,
    v_meetings,
    CASE WHEN v_sent > 0 THEN (v_opened::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_clicked::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_replied::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_sent > 0 THEN (v_meetings::DECIMAL / v_sent * 100) ELSE 0 END
  )
  ON CONFLICT (team_id, date, channel)
  DO UPDATE SET
    sent = EXCLUDED.sent,
    opened = EXCLUDED.opened,
    clicked = EXCLUDED.clicked,
    replied = EXCLUDED.replied,
    meetings_scheduled = EXCLUDED.meetings_scheduled,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    reply_rate = EXCLUDED.reply_rate,
    meeting_rate = EXCLUDED.meeting_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get campaign performance
CREATE OR REPLACE FUNCTION get_campaign_performance(p_campaign_id UUID)
RETURNS TABLE (
  total_enrolled INTEGER,
  active INTEGER,
  completed INTEGER,
  responded INTEGER,
  response_rate DECIMAL,
  meetings_scheduled INTEGER,
  meeting_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_enrolled,
    COUNT(CASE WHEN status = 'active' THEN 1 END)::INTEGER as active,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER as completed,
    COUNT(CASE WHEN replied = true THEN 1 END)::INTEGER as responded,
    (COUNT(CASE WHEN replied = true THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as response_rate,
    COUNT(CASE WHEN meeting_scheduled = true THEN 1 END)::INTEGER as meetings_scheduled,
    (COUNT(CASE WHEN meeting_scheduled = true THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100) as meeting_rate
  FROM campaign_enrollments
  WHERE campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Get overall outreach stats
CREATE OR REPLACE FUNCTION get_outreach_stats(
  p_team_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_prospects_contacted INTEGER,
  total_touches INTEGER,
  total_replies INTEGER,
  total_meetings INTEGER,
  overall_response_rate DECIMAL,
  overall_meeting_rate DECIMAL,
  best_performing_channel TEXT,
  avg_health_score INTEGER
) AS $$
DECLARE
  v_since TIMESTAMPTZ;
BEGIN
  v_since := NOW() - (p_days_back || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT prospect_id)::INTEGER as total_prospects_contacted,
    COUNT(*)::INTEGER as total_touches,
    COUNT(CASE WHEN direction = 'inbound' THEN 1 END)::INTEGER as total_replies,
    COUNT(CASE WHEN activity_type = 'meeting_scheduled' THEN 1 END)::INTEGER as total_meetings,
    (COUNT(CASE WHEN direction = 'inbound' THEN 1 END)::DECIMAL /
      NULLIF(COUNT(CASE WHEN direction = 'outbound' THEN 1 END), 0) * 100) as overall_response_rate,
    (COUNT(CASE WHEN activity_type = 'meeting_scheduled' THEN 1 END)::DECIMAL /
      NULLIF(COUNT(CASE WHEN direction = 'outbound' THEN 1 END), 0) * 100) as overall_meeting_rate,
    (
      SELECT channel
      FROM bdr_activities a
      WHERE a.team_id = p_team_id
        AND a.created_at >= v_since
        AND a.direction = 'inbound'
      GROUP BY channel
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) as best_performing_channel,
    (
      SELECT AVG(health_score)::INTEGER
      FROM outreach_health_scores
      WHERE team_id = p_team_id
    ) as avg_health_score
  FROM bdr_activities
  WHERE team_id = p_team_id
    AND created_at >= v_since;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE incoming_replies IS 'Tracks incoming email/LinkedIn replies from prospects';
COMMENT ON TABLE response_routing_decisions IS 'Logs routing decisions for automated reply handling';
COMMENT ON TABLE outreach_campaigns IS 'Multi-channel outreach campaigns';
COMMENT ON TABLE campaign_enrollments IS 'Prospects enrolled in campaigns';
COMMENT ON TABLE channel_performance_daily IS 'Daily performance metrics by channel';
COMMENT ON TABLE outreach_health_scores IS 'Health scores for prospect outreach effectiveness';
