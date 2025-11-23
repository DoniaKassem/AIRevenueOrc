-- BDR Agent System Schema
-- Autonomous agent configuration, task management, and activity tracking

-- BDR Agent Configuration
-- Stores configuration for autonomous BDR agents
CREATE TABLE IF NOT EXISTS bdr_agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL DEFAULT 'BDR Agent',
  is_active BOOLEAN DEFAULT true,

  -- Agent behavior settings
  auto_approve_messages BOOLEAN DEFAULT false,
  require_human_review BOOLEAN DEFAULT true,
  max_daily_touches INTEGER DEFAULT 50,
  max_touches_per_prospect INTEGER DEFAULT 5,
  min_delay_between_touches_hours INTEGER DEFAULT 48,

  -- Discovery settings
  discovery_enabled BOOLEAN DEFAULT true,
  discovery_interval_minutes INTEGER DEFAULT 60,
  min_intent_score INTEGER DEFAULT 50,
  max_new_prospects_per_day INTEGER DEFAULT 20,

  -- Channel preferences
  preferred_channels TEXT[] DEFAULT ARRAY['email'],
  linkedin_enabled BOOLEAN DEFAULT false,
  phone_enabled BOOLEAN DEFAULT false,

  -- Qualification settings
  qualification_framework TEXT DEFAULT 'BANT',
  auto_qualify_threshold INTEGER DEFAULT 70,
  handoff_threshold INTEGER DEFAULT 90,

  -- Learning settings
  enable_learning BOOLEAN DEFAULT true,
  ab_testing_enabled BOOLEAN DEFAULT false,

  -- Working hours (JSON: { timezone, start_hour, end_hour, days })
  working_hours JSONB DEFAULT '{"timezone": "America/New_York", "start_hour": 9, "end_hour": 17, "days": [1,2,3,4,5]}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Task Queue
-- Manages all tasks for the autonomous agent
CREATE TABLE IF NOT EXISTS bdr_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,

  task_type TEXT NOT NULL CHECK (task_type IN (
    'discover', 'research', 'engage', 'follow_up',
    'respond', 'schedule', 'qualify', 'handoff'
  )),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  )),

  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

  -- Task configuration
  config JSONB DEFAULT '{}',

  -- Workflow tracking
  workflow_id TEXT,
  workflow_step INTEGER,

  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  result JSONB,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Activities Log
-- Comprehensive log of all agent activities
CREATE TABLE IF NOT EXISTS bdr_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES bdr_tasks(id) ON DELETE SET NULL,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'email_sent', 'email_received', 'email_opened', 'email_clicked',
    'linkedin_message', 'linkedin_connection', 'linkedin_view',
    'phone_call', 'voicemail_left',
    'meeting_scheduled', 'meeting_completed',
    'research_completed', 'qualification_updated',
    'handoff_created', 'status_changed'
  )),

  channel TEXT CHECK (channel IN ('email', 'linkedin', 'phone', 'system')),

  direction TEXT CHECK (direction IN ('outbound', 'inbound', 'internal')),

  -- Activity details
  subject TEXT,
  message_preview TEXT,
  full_content TEXT,
  metadata JSONB DEFAULT '{}',

  -- Tracking
  was_automated BOOLEAN DEFAULT true,
  required_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Context Memory
-- Maintains conversation context and prospect knowledge
CREATE TABLE IF NOT EXISTS bdr_context_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  -- Research context
  research_data JSONB DEFAULT '{}',

  -- Conversation history
  conversation_history JSONB DEFAULT '[]',

  -- Learned preferences
  preferences JSONB DEFAULT '{}',

  -- Objections and responses
  objections JSONB DEFAULT '[]',

  -- Intent signals
  intent_signals JSONB DEFAULT '[]',

  -- Relationship stage
  relationship_stage TEXT DEFAULT 'cold' CHECK (relationship_stage IN (
    'cold', 'contacted', 'engaged', 'interested', 'qualified', 'handoff'
  )),

  -- Last interactions
  last_contact_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  contact_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,

  -- Sentiment analysis
  sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
  engagement_score INTEGER CHECK (engagement_score BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(prospect_id)
);

-- BDR Decisions Log
-- Tracks all autonomous decisions made by the agent
CREATE TABLE IF NOT EXISTS bdr_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES bdr_tasks(id) ON DELETE SET NULL,

  decision_type TEXT NOT NULL,
  decision_context JSONB NOT NULL DEFAULT '{}',

  -- AI-generated decision
  recommended_action TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  alternatives JSONB DEFAULT '[]',

  -- Execution
  was_executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMPTZ,

  -- Outcome tracking
  outcome TEXT CHECK (outcome IN ('successful', 'failed', 'neutral', 'unknown')),
  outcome_data JSONB DEFAULT '{}',

  -- Learning
  feedback_score INTEGER CHECK (feedback_score BETWEEN 1 AND 5),
  human_override BOOLEAN DEFAULT false,
  override_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Handoffs
-- Queue of prospects ready for human takeover
CREATE TABLE IF NOT EXISTS bdr_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  company_profile_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,

  handoff_type TEXT NOT NULL CHECK (handoff_type IN (
    'qualified', 'high_intent', 'requested_meeting', 'needs_help', 'unresponsive_high_value'
  )),

  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Qualification data
  qualification_score INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
  bant_breakdown JSONB DEFAULT '{}',

  -- Handoff brief
  executive_summary TEXT NOT NULL,
  key_insights JSONB DEFAULT '[]',
  conversation_summary TEXT,
  suggested_next_steps JSONB DEFAULT '[]',

  -- Assignment
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'contacted', 'completed', 'rejected'
  )),

  handled_at TIMESTAMPTZ,
  handler_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Approval Queue
-- Messages/actions awaiting human approval
CREATE TABLE IF NOT EXISTS bdr_approval_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES bdr_tasks(id) ON DELETE CASCADE,

  approval_type TEXT NOT NULL CHECK (approval_type IN (
    'email', 'linkedin_message', 'phone_call', 'meeting_invite', 'handoff'
  )),

  -- Content to approve
  subject TEXT,
  message_body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- AI context
  ai_reasoning TEXT,
  ai_confidence DECIMAL(3,2),

  -- Approval status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'modified', 'expired'
  )),

  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Modified content (if status = 'modified')
  modified_content TEXT,

  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Workflow Executions
-- Tracks execution of pre-defined workflows
CREATE TABLE IF NOT EXISTS bdr_workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,

  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL,

  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'failed', 'cancelled'
  )),

  -- Execution state
  execution_context JSONB DEFAULT '{}',
  completed_steps INTEGER[] DEFAULT ARRAY[]::INTEGER[],

  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  total_touches INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BDR Performance Metrics
-- Aggregate performance metrics for the agent
CREATE TABLE IF NOT EXISTS bdr_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  agent_config_id UUID REFERENCES bdr_agent_configs(id) ON DELETE CASCADE,

  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Activity metrics
  prospects_discovered INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  linkedin_messages INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,

  -- Response metrics
  email_opens INTEGER DEFAULT 0,
  email_clicks INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,

  -- Engagement metrics
  conversations_started INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,

  -- Qualification metrics
  prospects_qualified INTEGER DEFAULT 0,
  prospects_handed_off INTEGER DEFAULT 0,
  avg_qualification_score DECIMAL(5,2),

  -- Efficiency metrics
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  avg_task_duration_seconds INTEGER,

  -- Outcome metrics
  pipeline_generated_usd DECIMAL(12,2) DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  revenue_generated_usd DECIMAL(12,2) DEFAULT 0,

  -- Response rates
  email_response_rate DECIMAL(5,2),
  linkedin_response_rate DECIMAL(5,2),
  overall_response_rate DECIMAL(5,2),

  -- Learning metrics
  decision_accuracy DECIMAL(5,2),
  human_overrides INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, agent_config_id, metric_date)
);

-- Add BDR-related fields to prospects table
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS qualification_score INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS bant_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bdr_assigned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bdr_workflow_id TEXT,
  ADD COLUMN IF NOT EXISTS relationship_stage TEXT DEFAULT 'new' CHECK (relationship_stage IN (
    'new', 'contacted', 'engaged', 'qualified', 'opportunity', 'customer', 'unresponsive', 'disqualified'
  ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bdr_agent_configs_team ON bdr_agent_configs(team_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bdr_tasks_team_status ON bdr_tasks(team_id, status);
CREATE INDEX IF NOT EXISTS idx_bdr_tasks_prospect ON bdr_tasks(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bdr_tasks_scheduled ON bdr_tasks(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bdr_tasks_workflow ON bdr_tasks(workflow_id, prospect_id);

CREATE INDEX IF NOT EXISTS idx_bdr_activities_team ON bdr_activities(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bdr_activities_prospect ON bdr_activities(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bdr_activities_type ON bdr_activities(activity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bdr_context_memory_team ON bdr_context_memory(team_id);
CREATE INDEX IF NOT EXISTS idx_bdr_context_memory_stage ON bdr_context_memory(relationship_stage);
CREATE INDEX IF NOT EXISTS idx_bdr_context_memory_last_contact ON bdr_context_memory(last_contact_at DESC);

CREATE INDEX IF NOT EXISTS idx_bdr_decisions_team ON bdr_decisions(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bdr_decisions_prospect ON bdr_decisions(prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bdr_decisions_type ON bdr_decisions(decision_type);

CREATE INDEX IF NOT EXISTS idx_bdr_handoffs_team_status ON bdr_handoffs(team_id, status);
CREATE INDEX IF NOT EXISTS idx_bdr_handoffs_priority ON bdr_handoffs(priority, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bdr_handoffs_assigned ON bdr_handoffs(assigned_to) WHERE status IN ('assigned', 'contacted');

CREATE INDEX IF NOT EXISTS idx_bdr_approval_queue_team_status ON bdr_approval_queue(team_id, status);
CREATE INDEX IF NOT EXISTS idx_bdr_approval_queue_expires ON bdr_approval_queue(expires_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_bdr_workflow_executions_team ON bdr_workflow_executions(team_id, status);
CREATE INDEX IF NOT EXISTS idx_bdr_workflow_executions_prospect ON bdr_workflow_executions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_bdr_workflow_executions_next ON bdr_workflow_executions(next_execution_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_bdr_performance_team_date ON bdr_performance_metrics(team_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_prospects_bdr_assigned ON prospects(team_id) WHERE bdr_assigned = true;
CREATE INDEX IF NOT EXISTS idx_prospects_qualification ON prospects(qualification_score DESC NULLS LAST) WHERE qualification_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_relationship_stage ON prospects(relationship_stage);

-- Enable Row Level Security
ALTER TABLE bdr_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_context_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bdr_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bdr_agent_configs
CREATE POLICY "Users can view their team's BDR configs"
  ON bdr_agent_configs FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's BDR configs"
  ON bdr_agent_configs FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_tasks
CREATE POLICY "Users can view their team's BDR tasks"
  ON bdr_tasks FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's BDR tasks"
  ON bdr_tasks FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_activities
CREATE POLICY "Users can view their team's BDR activities"
  ON bdr_activities FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can create BDR activities"
  ON bdr_activities FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_context_memory
CREATE POLICY "Users can view their team's BDR context"
  ON bdr_context_memory FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's BDR context"
  ON bdr_context_memory FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_decisions
CREATE POLICY "Users can view their team's BDR decisions"
  ON bdr_decisions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can create BDR decisions"
  ON bdr_decisions FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_handoffs
CREATE POLICY "Users can view their team's BDR handoffs"
  ON bdr_handoffs FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's BDR handoffs"
  ON bdr_handoffs FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_approval_queue
CREATE POLICY "Users can view their team's approval queue"
  ON bdr_approval_queue FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's approval queue"
  ON bdr_approval_queue FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_workflow_executions
CREATE POLICY "Users can view their team's workflow executions"
  ON bdr_workflow_executions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their team's workflow executions"
  ON bdr_workflow_executions FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for bdr_performance_metrics
CREATE POLICY "Users can view their team's BDR metrics"
  ON bdr_performance_metrics FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can manage BDR metrics"
  ON bdr_performance_metrics FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Functions for BDR agent operations

-- Function to get pending tasks for execution
CREATE OR REPLACE FUNCTION get_pending_bdr_tasks(
  p_team_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  task_id UUID,
  prospect_id UUID,
  task_type TEXT,
  priority INTEGER,
  scheduled_for TIMESTAMPTZ,
  config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.prospect_id,
    t.task_type,
    t.priority,
    t.scheduled_for,
    t.config
  FROM bdr_tasks t
  WHERE t.team_id = p_team_id
    AND t.status = 'pending'
    AND (t.scheduled_for IS NULL OR t.scheduled_for <= NOW())
    AND t.retry_count < t.max_retries
  ORDER BY t.priority DESC, t.scheduled_for ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get high-intent prospects for discovery
CREATE OR REPLACE FUNCTION get_high_intent_prospects(
  p_team_id UUID,
  p_min_intent_score INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  prospect_id UUID,
  company_profile_id UUID,
  intent_score INTEGER,
  contact_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.company_profile_id,
    COALESCE(cp.intent_score, 0) as intent_score,
    COALESCE(p.contact_count, 0) as contact_count
  FROM prospects p
  LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
  WHERE p.team_id = p_team_id
    AND p.bdr_assigned = false
    AND COALESCE(cp.intent_score, 0) >= p_min_intent_score
    AND (p.last_contacted_at IS NULL OR p.last_contacted_at < NOW() - INTERVAL '30 days')
    AND p.relationship_stage IN ('new', 'contacted')
  ORDER BY COALESCE(cp.intent_score, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate daily BDR performance
CREATE OR REPLACE FUNCTION calculate_daily_bdr_performance(
  p_team_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
  v_agent_config_id UUID;
  v_metrics RECORD;
BEGIN
  -- Get agent config
  SELECT id INTO v_agent_config_id
  FROM bdr_agent_configs
  WHERE team_id = p_team_id AND is_active = true
  LIMIT 1;

  IF v_agent_config_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate metrics
  SELECT
    COUNT(DISTINCT CASE WHEN t.task_type = 'discover' AND t.status = 'completed' THEN t.prospect_id END) as prospects_discovered,
    COUNT(CASE WHEN a.activity_type = 'email_sent' THEN 1 END) as emails_sent,
    COUNT(CASE WHEN a.activity_type = 'linkedin_message' THEN 1 END) as linkedin_messages,
    COUNT(CASE WHEN a.activity_type = 'phone_call' THEN 1 END) as phone_calls,
    COUNT(CASE WHEN a.activity_type = 'email_opened' THEN 1 END) as email_opens,
    COUNT(CASE WHEN a.activity_type = 'email_clicked' THEN 1 END) as email_clicks,
    COUNT(CASE WHEN a.activity_type = 'email_received' THEN 1 END) as replies_received,
    COUNT(CASE WHEN a.activity_type = 'meeting_scheduled' THEN 1 END) as meetings_scheduled,
    COUNT(CASE WHEN t.task_type = 'qualify' AND t.status = 'completed' THEN 1 END) as prospects_qualified,
    COUNT(CASE WHEN h.id IS NOT NULL THEN 1 END) as prospects_handed_off,
    AVG(h.qualification_score) as avg_qualification_score,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as tasks_completed,
    COUNT(CASE WHEN t.status = 'failed' THEN 1 END) as tasks_failed
  INTO v_metrics
  FROM bdr_activities a
  LEFT JOIN bdr_tasks t ON a.task_id = t.id
  LEFT JOIN bdr_handoffs h ON a.prospect_id = h.prospect_id AND DATE(h.created_at) = p_date
  WHERE a.team_id = p_team_id
    AND DATE(a.created_at) = p_date;

  -- Upsert metrics
  INSERT INTO bdr_performance_metrics (
    team_id,
    agent_config_id,
    metric_date,
    prospects_discovered,
    emails_sent,
    linkedin_messages,
    phone_calls,
    email_opens,
    email_clicks,
    replies_received,
    meetings_scheduled,
    prospects_qualified,
    prospects_handed_off,
    avg_qualification_score,
    tasks_completed,
    tasks_failed,
    email_response_rate,
    overall_response_rate,
    updated_at
  ) VALUES (
    p_team_id,
    v_agent_config_id,
    p_date,
    v_metrics.prospects_discovered,
    v_metrics.emails_sent,
    v_metrics.linkedin_messages,
    v_metrics.phone_calls,
    v_metrics.email_opens,
    v_metrics.email_clicks,
    v_metrics.replies_received,
    v_metrics.meetings_scheduled,
    v_metrics.prospects_qualified,
    v_metrics.prospects_handed_off,
    v_metrics.avg_qualification_score,
    v_metrics.tasks_completed,
    v_metrics.tasks_failed,
    CASE WHEN v_metrics.emails_sent > 0 THEN (v_metrics.replies_received::DECIMAL / v_metrics.emails_sent * 100) ELSE 0 END,
    CASE WHEN (v_metrics.emails_sent + v_metrics.linkedin_messages) > 0
      THEN (v_metrics.replies_received::DECIMAL / (v_metrics.emails_sent + v_metrics.linkedin_messages) * 100)
      ELSE 0 END,
    NOW()
  )
  ON CONFLICT (team_id, agent_config_id, metric_date)
  DO UPDATE SET
    prospects_discovered = EXCLUDED.prospects_discovered,
    emails_sent = EXCLUDED.emails_sent,
    linkedin_messages = EXCLUDED.linkedin_messages,
    phone_calls = EXCLUDED.phone_calls,
    email_opens = EXCLUDED.email_opens,
    email_clicks = EXCLUDED.email_clicks,
    replies_received = EXCLUDED.replies_received,
    meetings_scheduled = EXCLUDED.meetings_scheduled,
    prospects_qualified = EXCLUDED.prospects_qualified,
    prospects_handed_off = EXCLUDED.prospects_handed_off,
    avg_qualification_score = EXCLUDED.avg_qualification_score,
    tasks_completed = EXCLUDED.tasks_completed,
    tasks_failed = EXCLUDED.tasks_failed,
    email_response_rate = EXCLUDED.email_response_rate,
    overall_response_rate = EXCLUDED.overall_response_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get BDR dashboard summary
CREATE OR REPLACE FUNCTION get_bdr_dashboard_summary(p_team_id UUID)
RETURNS TABLE (
  active_prospects INTEGER,
  pending_tasks INTEGER,
  pending_approvals INTEGER,
  pending_handoffs INTEGER,
  today_emails_sent INTEGER,
  today_replies_received INTEGER,
  today_meetings_scheduled INTEGER,
  week_response_rate DECIMAL,
  avg_qualification_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Active prospects
    (SELECT COUNT(*) FROM prospects WHERE team_id = p_team_id AND bdr_assigned = true AND relationship_stage NOT IN ('customer', 'disqualified', 'unresponsive'))::INTEGER,

    -- Pending tasks
    (SELECT COUNT(*) FROM bdr_tasks WHERE team_id = p_team_id AND status = 'pending')::INTEGER,

    -- Pending approvals
    (SELECT COUNT(*) FROM bdr_approval_queue WHERE team_id = p_team_id AND status = 'pending')::INTEGER,

    -- Pending handoffs
    (SELECT COUNT(*) FROM bdr_handoffs WHERE team_id = p_team_id AND status = 'pending')::INTEGER,

    -- Today's emails sent
    (SELECT COUNT(*) FROM bdr_activities WHERE team_id = p_team_id AND activity_type = 'email_sent' AND DATE(created_at) = CURRENT_DATE)::INTEGER,

    -- Today's replies
    (SELECT COUNT(*) FROM bdr_activities WHERE team_id = p_team_id AND activity_type = 'email_received' AND DATE(created_at) = CURRENT_DATE)::INTEGER,

    -- Today's meetings
    (SELECT COUNT(*) FROM bdr_activities WHERE team_id = p_team_id AND activity_type = 'meeting_scheduled' AND DATE(created_at) = CURRENT_DATE)::INTEGER,

    -- Week response rate
    (SELECT
      CASE
        WHEN SUM(emails_sent) > 0 THEN (SUM(replies_received)::DECIMAL / SUM(emails_sent) * 100)
        ELSE 0
      END
     FROM bdr_performance_metrics
     WHERE team_id = p_team_id AND metric_date >= CURRENT_DATE - INTERVAL '7 days'),

    -- Avg qualification score
    (SELECT AVG(qualification_score) FROM prospects WHERE team_id = p_team_id AND qualification_score IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE bdr_agent_configs IS 'Configuration for autonomous BDR agents';
COMMENT ON TABLE bdr_tasks IS 'Task queue for BDR agent operations';
COMMENT ON TABLE bdr_activities IS 'Comprehensive log of all BDR agent activities';
COMMENT ON TABLE bdr_context_memory IS 'Maintains conversation context and prospect knowledge';
COMMENT ON TABLE bdr_decisions IS 'Tracks autonomous decisions made by the agent';
COMMENT ON TABLE bdr_handoffs IS 'Queue of prospects ready for human takeover';
COMMENT ON TABLE bdr_approval_queue IS 'Messages/actions awaiting human approval';
COMMENT ON TABLE bdr_workflow_executions IS 'Tracks execution of pre-defined workflows';
COMMENT ON TABLE bdr_performance_metrics IS 'Daily aggregate performance metrics';
