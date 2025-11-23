/**
 * AI Features Migration
 * Database schema for AI-powered features:
 * - Email generation
 * - Response suggestions
 * - Lead scoring
 * - Sentiment analysis
 * - Conversation intelligence
 */

-- AI Email Generations table
CREATE TABLE ai_email_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('cold_outreach', 'follow_up', 'meeting_request', 'check_in', 'proposal', 'custom', 'improvement')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_email_generations_prospect (prospect_id),
  INDEX idx_ai_email_generations_purpose (purpose),
  INDEX idx_ai_email_generations_generated_at (generated_at DESC)
);

-- AI Response Suggestions table
CREATE TABLE ai_response_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  email_subject TEXT NOT NULL,
  suggestions JSONB NOT NULL, -- Array of suggestion objects
  selected_suggestion_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_response_suggestions_prospect (prospect_id),
  INDEX idx_ai_response_suggestions_generated_at (generated_at DESC)
);

-- AI Lead Scores table
CREATE TABLE ai_lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  signals JSONB NOT NULL, -- {positive: [], negative: []}
  qualification JSONB NOT NULL, -- {budget, authority, need, timing}
  recommendations JSONB, -- Array of recommendation strings
  next_best_actions JSONB, -- Array of action objects
  predicted_close_date DATE,
  predicted_close_rate INTEGER CHECK (predicted_close_rate >= 0 AND predicted_close_rate <= 100),
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_lead_scores_prospect (prospect_id),
  INDEX idx_ai_lead_scores_score (score DESC),
  INDEX idx_ai_lead_scores_grade (grade),
  INDEX idx_ai_lead_scores_scored_at (scored_at DESC)
);

-- AI Conversation Insights table
CREATE TABLE ai_conversation_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_topics JSONB, -- Array of topic objects
  buying_signals JSONB, -- Array of buying signal objects
  objections JSONB, -- Array of objection objects
  questions JSONB, -- Array of question objects
  next_steps JSONB, -- Array of next step strings
  overall_sentiment JSONB, -- Sentiment analysis result
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  deal_momentum TEXT CHECK (deal_momentum IN ('accelerating', 'steady', 'slowing', 'stalled')),
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_conversation_insights_prospect (prospect_id),
  INDEX idx_ai_conversation_insights_analyzed_at (analyzed_at DESC),
  INDEX idx_ai_conversation_insights_deal_momentum (deal_momentum)
);

-- AI Call Analysis table
CREATE TABLE ai_call_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id TEXT NOT NULL UNIQUE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  duration INTEGER NOT NULL, -- seconds
  speaker_stats JSONB NOT NULL, -- Speaker statistics
  key_moments JSONB, -- Array of key moment objects
  action_items JSONB, -- Array of action item objects
  coaching_insights JSONB, -- Array of coaching insight objects
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_call_analysis_transcript (transcript_id),
  INDEX idx_ai_call_analysis_prospect (prospect_id),
  INDEX idx_ai_call_analysis_analyzed_at (analyzed_at DESC)
);

-- AI Sentiment Analysis table
CREATE TABLE ai_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('email', 'call', 'meeting', 'note')),
  entity_id UUID NOT NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  score DECIMAL(3, 2) NOT NULL CHECK (score >= -1 AND score <= 1), -- -1 to 1
  label TEXT NOT NULL CHECK (label IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  emotions JSONB, -- Array of emotion objects
  key_phrases TEXT[],
  tone TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_sentiment_analysis_entity (entity_type, entity_id),
  INDEX idx_ai_sentiment_analysis_prospect (prospect_id),
  INDEX idx_ai_sentiment_analysis_label (label),
  INDEX idx_ai_sentiment_analysis_analyzed_at (analyzed_at DESC)
);

-- AI Usage Metrics table (for tracking API usage and costs)
CREATE TABLE ai_usage_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES team_hierarchies(id) ON DELETE SET NULL,
  feature TEXT NOT NULL CHECK (feature IN ('email_writer', 'response_suggestions', 'lead_scoring', 'sentiment_analysis', 'conversation_intelligence', 'call_analysis')),
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6), -- Cost in USD
  request_metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_ai_usage_metrics_user (user_id),
  INDEX idx_ai_usage_metrics_team (team_id),
  INDEX idx_ai_usage_metrics_feature (feature),
  INDEX idx_ai_usage_metrics_timestamp (timestamp DESC)
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get prospect AI insights summary
 * Returns comprehensive AI insights for a prospect
 */
CREATE OR REPLACE FUNCTION get_prospect_ai_insights(
  p_prospect_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lead_score', (
      SELECT jsonb_build_object(
        'score', score,
        'grade', grade,
        'confidence', confidence,
        'predicted_close_date', predicted_close_date,
        'predicted_close_rate', predicted_close_rate,
        'scored_at', scored_at
      )
      FROM ai_lead_scores
      WHERE prospect_id = p_prospect_id
      ORDER BY scored_at DESC
      LIMIT 1
    ),
    'conversation_insights', (
      SELECT jsonb_build_object(
        'summary', summary,
        'engagement_score', engagement_score,
        'deal_momentum', deal_momentum,
        'buying_signals_count', jsonb_array_length(COALESCE(buying_signals, '[]'::jsonb)),
        'objections_count', jsonb_array_length(COALESCE(objections, '[]'::jsonb)),
        'analyzed_at', analyzed_at
      )
      FROM ai_conversation_insights
      WHERE prospect_id = p_prospect_id
      ORDER BY analyzed_at DESC
      LIMIT 1
    ),
    'sentiment', (
      SELECT jsonb_build_object(
        'average_score', AVG(score),
        'trend', CASE
          WHEN AVG(CASE WHEN analyzed_at > NOW() - INTERVAL '7 days' THEN score ELSE NULL END) >
               AVG(CASE WHEN analyzed_at <= NOW() - INTERVAL '7 days' THEN score ELSE NULL END)
          THEN 'improving'
          WHEN AVG(CASE WHEN analyzed_at > NOW() - INTERVAL '7 days' THEN score ELSE NULL END) <
               AVG(CASE WHEN analyzed_at <= NOW() - INTERVAL '7 days' THEN score ELSE NULL END)
          THEN 'declining'
          ELSE 'stable'
        END,
        'latest_label', (
          SELECT label
          FROM ai_sentiment_analysis
          WHERE prospect_id = p_prospect_id
          ORDER BY analyzed_at DESC
          LIMIT 1
        )
      )
      FROM ai_sentiment_analysis
      WHERE prospect_id = p_prospect_id
    ),
    'ai_generated_emails', (
      SELECT COUNT(*)
      FROM ai_email_generations
      WHERE prospect_id = p_prospect_id
    ),
    'ai_suggestions_used', (
      SELECT COUNT(*)
      FROM ai_response_suggestions
      WHERE prospect_id = p_prospect_id AND used = TRUE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get team AI usage summary
 * Returns AI usage metrics for a team
 */
CREATE OR REPLACE FUNCTION get_team_ai_usage(
  p_team_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total_tokens', COALESCE(SUM(tokens_used), 0),
      'total_cost', COALESCE(SUM(estimated_cost), 0),
      'by_feature', jsonb_object_agg(
        feature,
        jsonb_build_object(
          'tokens', SUM(tokens_used),
          'cost', SUM(estimated_cost),
          'requests', COUNT(*)
        )
      )
    )
    FROM ai_usage_metrics
    WHERE team_id = p_team_id
      AND timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY team_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get top scored prospects
 * Returns prospects with highest AI lead scores
 */
CREATE OR REPLACE FUNCTION get_top_scored_prospects(
  p_team_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  prospect_id UUID,
  prospect_name TEXT,
  company TEXT,
  score INTEGER,
  grade TEXT,
  predicted_close_rate INTEGER,
  engagement_score INTEGER,
  deal_momentum TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    CONCAT(p.first_name, ' ', p.last_name),
    p.company,
    s.score,
    s.grade,
    s.predicted_close_rate,
    ci.engagement_score,
    ci.deal_momentum
  FROM prospects p
  LEFT JOIN LATERAL (
    SELECT score, grade, predicted_close_rate
    FROM ai_lead_scores
    WHERE prospect_id = p.id
    ORDER BY scored_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT engagement_score, deal_momentum
    FROM ai_conversation_insights
    WHERE prospect_id = p.id
    ORDER BY analyzed_at DESC
    LIMIT 1
  ) ci ON TRUE
  WHERE p.team_id = p_team_id
    AND s.score IS NOT NULL
  ORDER BY s.score DESC, ci.engagement_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get at-risk deals
 * Identifies deals that may need attention based on AI insights
 */
CREATE OR REPLACE FUNCTION get_at_risk_deals(
  p_team_id UUID
)
RETURNS TABLE (
  prospect_id UUID,
  prospect_name TEXT,
  company TEXT,
  stage TEXT,
  risk_factors TEXT[],
  days_in_stage INTEGER,
  days_since_activity INTEGER,
  sentiment_trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    CONCAT(p.first_name, ' ', p.last_name),
    p.company,
    p.stage,
    ARRAY[
      CASE WHEN EXTRACT(DAY FROM NOW() - p.updated_at) > 30 THEN 'Stalled in stage 30+ days' END,
      CASE WHEN EXTRACT(DAY FROM NOW() - latest_activity.last_activity) > 14 THEN 'No activity in 14+ days' END,
      CASE WHEN ci.deal_momentum = 'slowing' OR ci.deal_momentum = 'stalled' THEN 'Deal momentum declining' END,
      CASE WHEN sa.trend = 'declining' THEN 'Sentiment trending negative' END
    ]::TEXT[],
    EXTRACT(DAY FROM NOW() - p.updated_at)::INTEGER,
    EXTRACT(DAY FROM NOW() - COALESCE(latest_activity.last_activity, p.updated_at))::INTEGER,
    sa.trend
  FROM prospects p
  LEFT JOIN LATERAL (
    SELECT MAX(completed_at) AS last_activity
    FROM bdr_activities
    WHERE prospect_id = p.id
  ) latest_activity ON TRUE
  LEFT JOIN LATERAL (
    SELECT deal_momentum
    FROM ai_conversation_insights
    WHERE prospect_id = p.id
    ORDER BY analyzed_at DESC
    LIMIT 1
  ) ci ON TRUE
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN AVG(CASE WHEN analyzed_at > NOW() - INTERVAL '7 days' THEN score ELSE NULL END) <
           AVG(CASE WHEN analyzed_at <= NOW() - INTERVAL '7 days' THEN score ELSE NULL END)
      THEN 'declining'
      ELSE 'stable'
    END AS trend
    FROM ai_sentiment_analysis
    WHERE prospect_id = p.id
  ) sa ON TRUE
  WHERE p.team_id = p_team_id
    AND p.stage IN ('proposal_sent', 'negotiation', 'verbal_commit')
    AND (
      EXTRACT(DAY FROM NOW() - p.updated_at) > 30
      OR EXTRACT(DAY FROM NOW() - COALESCE(latest_activity.last_activity, p.updated_at)) > 14
      OR ci.deal_momentum IN ('slowing', 'stalled')
      OR sa.trend = 'declining'
    )
  ORDER BY
    EXTRACT(DAY FROM NOW() - COALESCE(latest_activity.last_activity, p.updated_at)) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all AI tables
ALTER TABLE ai_email_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_email_generations
CREATE POLICY ai_email_generations_select ON ai_email_generations
  FOR SELECT USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY ai_email_generations_insert ON ai_email_generations
  FOR INSERT WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for ai_response_suggestions
CREATE POLICY ai_response_suggestions_select ON ai_response_suggestions
  FOR SELECT USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY ai_response_suggestions_insert ON ai_response_suggestions
  FOR INSERT WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for ai_lead_scores
CREATE POLICY ai_lead_scores_select ON ai_lead_scores
  FOR SELECT USING (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY ai_lead_scores_insert ON ai_lead_scores
  FOR INSERT WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Similar policies for other AI tables
CREATE POLICY ai_conversation_insights_select ON ai_conversation_insights FOR SELECT USING (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
CREATE POLICY ai_conversation_insights_insert ON ai_conversation_insights FOR INSERT WITH CHECK (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));

CREATE POLICY ai_call_analysis_select ON ai_call_analysis FOR SELECT USING (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
CREATE POLICY ai_call_analysis_insert ON ai_call_analysis FOR INSERT WITH CHECK (TRUE); -- Anyone can insert, filtered on select

CREATE POLICY ai_sentiment_analysis_select ON ai_sentiment_analysis FOR SELECT USING (prospect_id IN (SELECT id FROM prospects WHERE team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())));
CREATE POLICY ai_sentiment_analysis_insert ON ai_sentiment_analysis FOR INSERT WITH CHECK (TRUE); -- Anyone can insert, filtered on select

CREATE POLICY ai_usage_metrics_select ON ai_usage_metrics FOR SELECT USING (user_id = auth.uid() OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));
CREATE POLICY ai_usage_metrics_insert ON ai_usage_metrics FOR INSERT WITH CHECK (TRUE);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_email_generations IS 'Stores AI-generated emails';
COMMENT ON TABLE ai_response_suggestions IS 'Stores AI-generated response suggestions';
COMMENT ON TABLE ai_lead_scores IS 'Stores AI-powered lead scores and predictions';
COMMENT ON TABLE ai_conversation_insights IS 'Stores AI analysis of entire conversations';
COMMENT ON TABLE ai_call_analysis IS 'Stores AI analysis of call transcriptions';
COMMENT ON TABLE ai_sentiment_analysis IS 'Stores sentiment analysis results';
COMMENT ON TABLE ai_usage_metrics IS 'Tracks AI API usage and costs';

COMMENT ON FUNCTION get_prospect_ai_insights IS 'Returns comprehensive AI insights for a prospect';
COMMENT ON FUNCTION get_team_ai_usage IS 'Returns AI usage metrics for a team';
COMMENT ON FUNCTION get_top_scored_prospects IS 'Returns prospects with highest AI lead scores';
COMMENT ON FUNCTION get_at_risk_deals IS 'Identifies at-risk deals based on AI insights';
