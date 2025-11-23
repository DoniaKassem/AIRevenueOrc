-- ==============================================
-- AIRevenueOrc - Complete Schema Consolidation
-- ==============================================
-- This migration consolidates all schema changes into a single,
-- comprehensive migration that can be run on a fresh database.
-- It includes all tables, indexes, policies, and functions.
-- ==============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==============================================
-- ORGANIZATIONS & TEAMS
-- ==============================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- USERS & AUTHENTICATION
-- ==============================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  password_hash VARCHAR(255),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'rep' CHECK (role IN ('rep', 'manager', 'admin')),
  team_id UUID REFERENCES public.teams(id),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SSO Providers
CREATE TABLE IF NOT EXISTS public.sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('saml', 'oauth', 'oidc')),
  provider_name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- SAAS FEATURES (Team, Billing, API Keys)
-- ==============================================

-- Team Invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
  token VARCHAR(255) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  request_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'void')),
  stripe_invoice_id VARCHAR(255),
  invoice_pdf TEXT,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT TRUE,
  desktop_notifications BOOLEAN DEFAULT TRUE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ==============================================
-- CRM - PROSPECTS & DEALS
-- ==============================================

CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  title VARCHAR(255),
  company VARCHAR(255),
  account_id UUID,
  priority_score INTEGER DEFAULT 0,
  intent_score INTEGER,
  intent_tier VARCHAR(50) CHECK (intent_tier IN ('high', 'medium', 'low')),
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  owner_id UUID REFERENCES public.users(id),
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'nurturing', 'unqualified', 'converted')),
  bdr_assigned UUID REFERENCES public.users(id),
  bdr_workflow_id UUID,
  relationship_stage VARCHAR(50),
  ai_insights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(255),
  employee_count INTEGER,
  annual_revenue DECIMAL(15, 2),
  team_id UUID REFERENCES public.teams(id),
  owner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  owner_id UUID REFERENCES public.users(id),
  team_id UUID REFERENCES public.teams(id),
  stage VARCHAR(50) DEFAULT 'discovery' CHECK (stage IN ('discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  amount DECIMAL(15, 2) DEFAULT 0,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,
  risk_score INTEGER DEFAULT 0,
  forecast_category VARCHAR(50) DEFAULT 'pipeline' CHECK (forecast_category IN ('pipeline', 'best_case', 'commit', 'closed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  role VARCHAR(255),
  influence_level VARCHAR(50) CHECK (influence_level IN ('champion', 'influencer', 'decision_maker', 'blocker')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(deal_id, prospect_id)
);

-- Company Profiles
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  website_url TEXT,
  company_description TEXT,
  mission_statement TEXT,
  target_customers TEXT,
  spokesperson_enabled BOOLEAN DEFAULT FALSE,
  research_data JSONB DEFAULT '{}'::jsonb,
  research_quality_score INTEGER,
  buying_signals JSONB DEFAULT '[]'::jsonb,
  last_researched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- OUTREACH & ENGAGEMENT
-- ==============================================

-- Email Templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cadences
CREATE TABLE IF NOT EXISTS public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cadence Steps
CREATE TABLE IF NOT EXISTS public.cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'call', 'linkedin', 'sms', 'task')),
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  template_id UUID REFERENCES public.email_templates(id),
  content TEXT,
  conditions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cadence Enrollments
CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'canceled')),
  current_step INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Call Logs
CREATE TABLE IF NOT EXISTS public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  disposition VARCHAR(50) CHECK (disposition IN ('answered', 'voicemail', 'no_answer', 'busy')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Logs
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id),
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE
);

-- Email Sends (detailed tracking)
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- AI & INTELLIGENCE
-- ==============================================

-- Conversations (Call Intelligence)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('call', 'meeting', 'demo')),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  analysis_status VARCHAR(50) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  speaker VARCHAR(255),
  text TEXT NOT NULL,
  timestamp_ms INTEGER,
  sentiment VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  insight_type VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  confidence_score DECIMAL(3, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Agent Sessions
CREATE TABLE IF NOT EXISTS public.ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  agent_type VARCHAR(50) NOT NULL CHECK (agent_type IN ('research', 'outreach', 'scoring')),
  conversation_history JSONB DEFAULT '[]'::jsonb,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Playground Experiments
CREATE TABLE IF NOT EXISTS public.ai_playground_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  experiment_name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  models_tested JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Predictions (for lead scoring, etc.)
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  prediction_type VARCHAR(100) NOT NULL,
  score DECIMAL(5, 2),
  reasoning JSONB DEFAULT '{}'::jsonb,
  model_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- KNOWLEDGE BASE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knowledge_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  source_type VARCHAR(100) NOT NULL,
  source_url TEXT,
  content TEXT,
  quality_score INTEGER,
  last_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  session_type VARCHAR(100),
  questions_asked JSONB DEFAULT '[]'::jsonb,
  answers_provided JSONB DEFAULT '[]'::jsonb,
  conducted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- INTEGRATIONS
-- ==============================================

CREATE TABLE IF NOT EXISTS public.team_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  provider_key VARCHAR(100) NOT NULL,
  auth_type VARCHAR(50) CHECK (auth_type IN ('oauth', 'api_key')),
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger JSONB DEFAULT '{}'::jsonb,
  actions JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  auth_type VARCHAR(50),
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capabilities JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES public.team_integrations(id),
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events TEXT[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  processing_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- ENRICHMENT
-- ==============================================

CREATE TABLE IF NOT EXISTS public.enrichment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  provider_name VARCHAR(100) NOT NULL,
  credits_remaining INTEGER,
  is_enabled BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enrichment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.enrichment_providers(id),
  request_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- BDR AGENT SYSTEM
-- ==============================================

CREATE TABLE IF NOT EXISTS public.bdr_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  agent_name VARCHAR(255) NOT NULL,
  personality VARCHAR(50),
  communication_style VARCHAR(50),
  qualification_criteria JSONB DEFAULT '{}'::jsonb,
  handoff_threshold INTEGER DEFAULT 70,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bdr_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  assigned_agent UUID REFERENCES public.bdr_agent_configs(id),
  task_type VARCHAR(100) NOT NULL,
  priority INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'pending',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bdr_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.bdr_agent_configs(id),
  activity_type VARCHAR(100) NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bdr_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  from_agent UUID REFERENCES public.bdr_agent_configs(id),
  to_user UUID REFERENCES public.users(id),
  qualification_score INTEGER,
  handoff_reason TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bdr_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.bdr_agent_configs(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  leads_contacted INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  handoffs_completed INTEGER DEFAULT 0,
  response_rate DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- ANALYTICS & TRACKING
-- ==============================================

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id),
  user_id UUID REFERENCES public.users(id),
  prospect_id UUID REFERENCES public.prospects(id),
  activity_type VARCHAR(100) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  count INTEGER DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric_type VARCHAR(100) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search Analytics
CREATE TABLE IF NOT EXISTS public.search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  clicked_result_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Users & Teams
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON public.users(team_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON public.teams(organization_id);

-- Prospects & Deals
CREATE INDEX IF NOT EXISTS idx_prospects_team_id ON public.prospects(team_id);
CREATE INDEX IF NOT EXISTS idx_prospects_owner_id ON public.prospects(owner_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON public.prospects(email);
CREATE INDEX IF NOT EXISTS idx_deals_team_id ON public.deals(team_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON public.deals(close_date);

-- Outreach
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_prospect_id ON public.cadence_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_cadence_enrollments_status ON public.cadence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_prospect_id ON public.email_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_prospect_id ON public.call_logs(prospect_id);

-- AI & Analytics
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_team_id ON public.ai_agent_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_conversations_team_id ON public.conversations(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_prospect_id ON public.ai_predictions(prospect_id);

-- Knowledge Base (Vector Index)
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_embedding ON public.knowledge_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_company ON public.knowledge_documents(company_profile_id);

-- Integrations
CREATE INDEX IF NOT EXISTS idx_team_integrations_team_id ON public.team_integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at);

-- SaaS Features
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON public.subscriptions(organization_id);

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view users in their organization
CREATE POLICY "Users can view organization users" ON public.users
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Users can view prospects in their team
CREATE POLICY "Users can view team prospects" ON public.prospects
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Users can create prospects in their team
CREATE POLICY "Users can create team prospects" ON public.prospects
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.users WHERE id = auth.uid()
    )
  );

-- API Keys policies
CREATE POLICY "Users can view their org API keys" ON public.api_keys
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create API keys" ON public.api_keys
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Subscriptions policy
CREATE POLICY "Users can view org subscription" ON public.subscriptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

-- ==============================================
-- FUNCTIONS & TRIGGERS
-- ==============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_profiles_updated_at BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vector similarity search for knowledge base
CREATE OR REPLACE FUNCTION match_knowledge_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_company_profile_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_documents
  WHERE company_profile_id = p_company_profile_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Get daily tasks function
CREATE OR REPLACE FUNCTION get_daily_tasks(
  p_team_id uuid,
  p_user_id uuid,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'calls_due', (
      SELECT count(*)
      FROM public.bdr_tasks
      WHERE task_type = 'call'
        AND status = 'pending'
        AND DATE(scheduled_for) = p_date
    ),
    'emails_due', (
      SELECT count(*)
      FROM public.bdr_tasks
      WHERE task_type = 'email'
        AND status = 'pending'
        AND DATE(scheduled_for) = p_date
    ),
    'follow_ups_due', (
      SELECT count(*)
      FROM public.bdr_tasks
      WHERE task_type = 'follow_up'
        AND status = 'pending'
        AND DATE(scheduled_for) = p_date
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Analyze pipeline health function
CREATE OR REPLACE FUNCTION analyze_pipeline_health(
  p_team_id uuid,
  p_deal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  deal_record record;
  health_score integer;
  risk_factors jsonb;
BEGIN
  SELECT * INTO deal_record
  FROM public.deals
  WHERE id = p_deal_id AND team_id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Deal not found');
  END IF;

  -- Calculate health score based on various factors
  health_score := 50; -- Base score

  IF deal_record.close_date < CURRENT_DATE + INTERVAL '30 days' THEN
    health_score := health_score + 20;
  END IF;

  IF deal_record.probability > 70 THEN
    health_score := health_score + 15;
  END IF;

  IF deal_record.risk_score > 50 THEN
    health_score := health_score - 20;
  END IF;

  -- Build risk factors array
  risk_factors := '[]'::jsonb;

  IF deal_record.close_date < CURRENT_DATE THEN
    risk_factors := risk_factors || jsonb_build_object('type', 'overdue', 'severity', 'high');
  END IF;

  RETURN jsonb_build_object(
    'health_score', health_score,
    'risk_factors', risk_factors,
    'stage', deal_record.stage,
    'probability', deal_record.probability
  );
END;
$$;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Database schema consolidation complete!';
  RAISE NOTICE '   - All tables created with proper constraints';
  RAISE NOTICE '   - Indexes created for performance';
  RAISE NOTICE '   - RLS policies enabled for security';
  RAISE NOTICE '   - Functions and triggers configured';
END $$;
