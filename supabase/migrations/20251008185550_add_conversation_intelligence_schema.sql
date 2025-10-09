/*
  # Add Conversation Intelligence Schema

  ## Overview
  Extends the database to support conversation intelligence features including
  meeting recordings, transcriptions, AI analysis, and insights extraction.

  ## 1. New Tables

  ### conversations
  - Stores meeting/call metadata and recordings
  - Links to prospects and deals
  - Tracks AI analysis status

  ### conversation_transcripts
  - Stores full transcripts with speaker diarization
  - Timestamps for each segment
  - Searchable text content

  ### conversation_insights
  - AI-generated insights and summaries
  - Key moments and action items
  - Sentiment and engagement scores
  - MEDDPICC extraction

  ### conversation_scorecards
  - Performance evaluation metrics
  - Manager feedback and coaching notes
  - Skill assessments

  ## 2. Security
  - RLS enabled on all tables
  - Public access for single-user mode

  ## 3. Indexes
  - Full-text search on transcripts
  - Query optimization indexes
*/

-- Create conversation types
CREATE TYPE conversation_type AS ENUM ('call', 'meeting', 'demo', 'discovery', 'negotiation', 'followup');
CREATE TYPE analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE speaker_role AS ENUM ('rep', 'prospect', 'champion', 'decision_maker', 'unknown');

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  type conversation_type DEFAULT 'call',
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  conducted_by uuid,
  duration_seconds int DEFAULT 0,
  recording_url text,
  video_url text,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  analysis_status analysis_status DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversation transcripts table
CREATE TABLE IF NOT EXISTS conversation_transcripts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  segment_number int NOT NULL,
  speaker_name text,
  speaker_role speaker_role DEFAULT 'unknown',
  start_time float NOT NULL,
  end_time float NOT NULL,
  text text NOT NULL,
  confidence float DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, segment_number)
);

-- Conversation insights table
CREATE TABLE IF NOT EXISTS conversation_insights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  summary text,
  key_points jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  questions_asked jsonb DEFAULT '[]'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  next_steps jsonb DEFAULT '[]'::jsonb,
  sentiment_score float DEFAULT 0,
  engagement_score float DEFAULT 0,
  talk_ratio jsonb DEFAULT '{"rep": 0, "prospect": 0}'::jsonb,
  meddpicc jsonb DEFAULT '{}'::jsonb,
  topics jsonb DEFAULT '[]'::jsonb,
  keywords jsonb DEFAULT '[]'::jsonb,
  competitive_mentions jsonb DEFAULT '[]'::jsonb,
  pricing_discussed boolean DEFAULT false,
  decision_timeline text,
  budget_mentioned boolean DEFAULT false,
  ai_recommendations jsonb DEFAULT '[]'::jsonb,
  model_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversation scorecards table
CREATE TABLE IF NOT EXISTS conversation_scorecards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  evaluated_by uuid,
  overall_score float DEFAULT 0,
  criteria_scores jsonb DEFAULT '{}'::jsonb,
  strengths jsonb DEFAULT '[]'::jsonb,
  improvements jsonb DEFAULT '[]'::jsonb,
  coaching_notes text,
  follow_up_actions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_prospect_id ON conversations(prospect_id);
CREATE INDEX IF NOT EXISTS idx_conversations_deal_id ON conversations(deal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_analysis_status ON conversations(analysis_status);

CREATE INDEX IF NOT EXISTS idx_transcripts_conversation_id ON conversation_transcripts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_segment ON conversation_transcripts(conversation_id, segment_number);

CREATE INDEX IF NOT EXISTS idx_insights_conversation_id ON conversation_insights(conversation_id);

CREATE INDEX IF NOT EXISTS idx_scorecards_conversation_id ON conversation_scorecards(conversation_id);

-- Full-text search on transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_text_search ON conversation_transcripts USING gin(to_tsvector('english', text));

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_scorecards ENABLE ROW LEVEL SECURITY;

-- RLS Policies (public access for single-user mode)
CREATE POLICY "Public can manage conversations"
  ON conversations FOR ALL
  TO public
  USING (true);

CREATE POLICY "Public can manage conversation_transcripts"
  ON conversation_transcripts FOR ALL
  TO public
  USING (true);

CREATE POLICY "Public can manage conversation_insights"
  ON conversation_insights FOR ALL
  TO public
  USING (true);

CREATE POLICY "Public can manage conversation_scorecards"
  ON conversation_scorecards FOR ALL
  TO public
  USING (true);

-- Triggers
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_insights_updated_at BEFORE UPDATE ON conversation_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_scorecards_updated_at BEFORE UPDATE ON conversation_scorecards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();