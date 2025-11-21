-- =============================================
-- Service Hub Database Schema
-- Complete support, ticketing, knowledge base, and live chat
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TICKETING SYSTEM
-- =============================================

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'open', 'pending', 'resolved', 'closed')) DEFAULT 'new',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  category TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Parties
  customer_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_team UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- SLA
  sla_id UUID,
  due_date TIMESTAMPTZ,
  first_response_time DECIMAL, -- in minutes
  resolution_time DECIMAL, -- in minutes
  sla_breached BOOLEAN DEFAULT FALSE,

  -- Communication
  channel TEXT CHECK (channel IN ('email', 'chat', 'phone', 'web', 'social')) DEFAULT 'web',
  last_reply_at TIMESTAMPTZ,
  last_reply_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Satisfaction
  satisfaction TEXT CHECK (satisfaction IN ('satisfied', 'neutral', 'dissatisfied')),
  satisfaction_comment TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);

-- Ticket replies table
CREATE TABLE ticket_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  attachments TEXT[],

  -- Author
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_type TEXT CHECK (author_type IN ('agent', 'customer', 'system')) DEFAULT 'agent',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);
CREATE INDEX idx_ticket_replies_created_at ON ticket_replies(created_at);

-- SLAs table
CREATE TABLE slas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Time targets (in minutes)
  first_response_target INTEGER NOT NULL,
  resolution_target INTEGER NOT NULL,

  -- Business hours
  business_hours_only BOOLEAN DEFAULT FALSE,
  business_hours JSONB,

  -- Escalation
  escalation_enabled BOOLEAN DEFAULT FALSE,
  escalation_after INTEGER, -- minutes
  escalate_to TEXT, -- team or user ID

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ticket routing rules table
CREATE TABLE ticket_routing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- lower = higher priority
  is_active BOOLEAN DEFAULT TRUE,

  -- Conditions
  conditions JSONB NOT NULL,

  -- Actions
  assign_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assign_to_team UUID REFERENCES teams(id) ON DELETE SET NULL,
  set_priority TEXT CHECK (set_priority IN ('low', 'normal', 'high', 'urgent')),
  set_category TEXT,
  add_tags TEXT[],
  apply_sla UUID REFERENCES slas(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Canned responses table
CREATE TABLE canned_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  shortcut TEXT UNIQUE,
  subject TEXT,
  content TEXT NOT NULL,
  category TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canned_responses_category ON canned_responses(category);

-- =============================================
-- KNOWLEDGE BASE
-- =============================================

-- Knowledge base categories table
CREATE TABLE knowledge_base_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES knowledge_base_categories(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  visibility TEXT CHECK (visibility IN ('public', 'internal', 'customer_portal')) DEFAULT 'public',
  article_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_categories_parent_id ON knowledge_base_categories(parent_id);

-- Knowledge base articles table
CREATE TABLE knowledge_base_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',

  -- Organization
  category_id UUID NOT NULL REFERENCES knowledge_base_categories(id) ON DELETE CASCADE,
  tags TEXT[] DEFAULT '{}',

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  -- Access Control
  visibility TEXT CHECK (visibility IN ('public', 'internal', 'customer_portal')) DEFAULT 'public',
  requires_authentication BOOLEAN DEFAULT FALSE,

  -- Analytics
  views INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  unhelpful_votes INTEGER DEFAULT 0,
  helpfulness_score DECIMAL(5, 2) DEFAULT 0,

  -- Author
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Related
  related_article_ids UUID[],

  -- Metadata
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_articles_category_id ON knowledge_base_articles(category_id);
CREATE INDEX idx_kb_articles_status ON knowledge_base_articles(status);
CREATE INDEX idx_kb_articles_slug ON knowledge_base_articles(slug);

-- Knowledge base views table
CREATE TABLE knowledge_base_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  session_id TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_views_article_id ON knowledge_base_views(article_id);

-- Knowledge base feedback table
CREATE TABLE knowledge_base_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_feedback_article_id ON knowledge_base_feedback(article_id);

-- Knowledge base attachments table
CREATE TABLE knowledge_base_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_attachments_article_id ON knowledge_base_attachments(article_id);

-- Knowledge base searches table (for analytics)
CREATE TABLE knowledge_base_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  results_count INTEGER,
  result_clicked_id UUID REFERENCES knowledge_base_articles(id) ON DELETE SET NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_searches_query ON knowledge_base_searches(query);

-- =============================================
-- LIVE CHAT
-- =============================================

-- Chat widgets table
CREATE TABLE chat_widgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,

  -- Appearance
  position TEXT CHECK (position IN ('bottom-right', 'bottom-left', 'top-right', 'top-left')) DEFAULT 'bottom-right',
  primary_color TEXT DEFAULT '#0078d4',
  accent_color TEXT DEFAULT '#ffffff',
  button_icon TEXT,
  button_text TEXT DEFAULT 'Chat with us',

  -- Welcome Message
  welcome_message TEXT NOT NULL,
  offline_message TEXT NOT NULL,
  pre_chat_form_enabled BOOLEAN DEFAULT FALSE,
  pre_chat_fields JSONB,

  -- Routing
  routing_strategy TEXT CHECK (routing_strategy IN ('round-robin', 'least-active', 'manual', 'ai-based')) DEFAULT 'round-robin',
  assign_to_team UUID REFERENCES teams(id) ON DELETE SET NULL,
  assign_to_users UUID[],

  -- Operating Hours
  business_hours_only BOOLEAN DEFAULT FALSE,
  business_hours JSONB,

  -- AI Settings
  enable_ai_assist BOOLEAN DEFAULT FALSE,
  ai_greeting TEXT,
  ai_handoff_triggers TEXT[],

  -- Security
  allowed_domains TEXT[],
  require_email_verification BOOLEAN DEFAULT FALSE,

  -- Analytics
  total_conversations INTEGER DEFAULT 0,
  avg_response_time DECIMAL DEFAULT 0,
  avg_rating DECIMAL(3, 2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat conversations table
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  status TEXT CHECK (status IN ('waiting', 'active', 'ended', 'missed')) DEFAULT 'waiting',

  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_team UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Context
  page_url TEXT NOT NULL,
  page_title TEXT,
  user_agent TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  country TEXT,
  city TEXT,

  -- UTM
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Session
  session_id TEXT NOT NULL,
  previous_visits INTEGER DEFAULT 0,

  -- Metadata
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  first_response_time DECIMAL, -- in seconds
  avg_response_time DECIMAL, -- in seconds

  -- Satisfaction
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,

  -- Tags
  tags TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX idx_chat_conversations_assigned_to ON chat_conversations(assigned_to);
CREATE INDEX idx_chat_conversations_started_at ON chat_conversations(started_at);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('text', 'image', 'file', 'system')) DEFAULT 'text',

  -- Sender
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('visitor', 'agent', 'bot', 'system')) DEFAULT 'visitor',

  -- Attachments
  attachments JSONB,

  -- AI
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_suggestion BOOLEAN DEFAULT FALSE,

  -- Metadata
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sent_at ON chat_messages(sent_at);

-- Agent status table
CREATE TABLE agent_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('online', 'away', 'offline')) DEFAULT 'offline',
  max_conversations INTEGER DEFAULT 5,
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Increment canned response usage
CREATE OR REPLACE FUNCTION increment_canned_response_usage(p_response_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE canned_responses
  SET usage_count = usage_count + 1
  WHERE id = p_response_id;
END;
$$ LANGUAGE plpgsql;

-- Increment article views
CREATE OR REPLACE FUNCTION increment_article_views(p_article_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE knowledge_base_articles
  SET views = views + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Increment post shares
CREATE OR REPLACE FUNCTION increment_post_shares(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE blog_posts
  SET shares = shares + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Increment post comments
CREATE OR REPLACE FUNCTION increment_post_comments(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE blog_posts
  SET comments = comments + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Increment form views
CREATE OR REPLACE FUNCTION increment_form_views(p_form_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE forms
  SET views = views + 1
  WHERE id = p_form_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update knowledge base category article count
CREATE OR REPLACE FUNCTION trigger_update_kb_category_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE knowledge_base_categories
    SET article_count = article_count + 1
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE knowledge_base_categories
    SET article_count = article_count - 1
    WHERE id = OLD.category_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.category_id != OLD.category_id THEN
    UPDATE knowledge_base_categories
    SET article_count = article_count - 1
    WHERE id = OLD.category_id;

    UPDATE knowledge_base_categories
    SET article_count = article_count + 1
    WHERE id = NEW.category_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kb_article_category_count
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_base_articles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_kb_category_count();

-- Update ticket updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets
CREATE POLICY "Users can view tickets in their organization"
  ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = tickets.created_by
      )
    )
  );

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update tickets in their organization"
  ON tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = tickets.created_by
      )
    )
  );

-- RLS policies for knowledge base (public articles)
CREATE POLICY "Anyone can view published public articles"
  ON knowledge_base_articles FOR SELECT
  USING (
    status = 'published' AND visibility = 'public'
  );

CREATE POLICY "Users can manage articles in their organization"
  ON knowledge_base_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = (
        SELECT organization_id FROM users WHERE id = knowledge_base_articles.author_id
      )
    )
  );

-- RLS policies for chat
CREATE POLICY "Agents can view conversations in their organization"
  ON chat_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        chat_conversations.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = chat_conversations.assigned_team
          AND team_members.user_id = auth.uid()
        )
      )
    )
  );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Additional indexes for common queries
CREATE INDEX idx_tickets_sla_breached ON tickets(sla_breached) WHERE sla_breached = TRUE;
CREATE INDEX idx_kb_articles_published ON knowledge_base_articles(status, published_at) WHERE status = 'published';
CREATE INDEX idx_chat_conversations_active ON chat_conversations(status, assigned_to) WHERE status IN ('waiting', 'active');

-- Full-text search indexes
CREATE INDEX idx_kb_articles_search ON knowledge_base_articles USING gin(to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_tickets_search ON tickets USING gin(to_tsvector('english', subject || ' ' || description));

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default SLAs
INSERT INTO slas (name, description, priority, first_response_target, resolution_target, is_active) VALUES
  ('Low Priority', 'Standard response for low priority tickets', 'low', 240, 2880, TRUE),
  ('Normal Priority', 'Standard response for normal priority tickets', 'normal', 120, 1440, TRUE),
  ('High Priority', 'Fast response for high priority tickets', 'high', 60, 480, TRUE),
  ('Urgent Priority', 'Immediate response for urgent tickets', 'urgent', 15, 120, TRUE);

-- Insert default knowledge base category
INSERT INTO knowledge_base_categories (name, slug, description, visibility) VALUES
  ('Getting Started', 'getting-started', 'Articles to help you get started', 'public'),
  ('FAQ', 'faq', 'Frequently Asked Questions', 'public'),
  ('Troubleshooting', 'troubleshooting', 'Common issues and solutions', 'public'),
  ('API Documentation', 'api-documentation', 'API reference and guides', 'public');
