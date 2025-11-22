# AIRevenueOrc - Complete Feature Documentation

**AI-Powered Revenue Orchestration Platform**

This document provides comprehensive documentation of all major features in AIRevenueOrc, including technical implementation details, database schemas, API endpoints, and usage instructions.

---

## Table of Contents

1. [CRM & Sales Features](#1-crm--sales-features)
2. [Outreach & Engagement](#2-outreach--engagement)
3. [AI & Automation](#3-ai--automation)
4. [Search & Knowledge Base](#4-search--knowledge-base)
5. [Integrations](#5-integrations)
6. [SaaS & Team Management](#6-saas--team-management)
7. [Analytics & Reporting](#7-analytics--reporting)
8. [Communication & Notifications](#8-communication--notifications)
9. [Marketing Hub](#9-marketing-hub)
10. [Service Hub](#10-service-hub)

---

## 1. CRM & Sales Features

### 1.1 Prospect Management

**Description:** Complete contact and prospect management system with enrichment, intent tracking, and AI-powered insights.

**Database Tables:**
- `prospects` - Main prospect records
- `accounts` - Company/account records
- `company_profiles` - Extended company information

**Key Fields:**
```sql
prospects (
  id, email, phone, linkedin_url,
  first_name, last_name, title, company,
  priority_score, intent_score, intent_tier,
  enrichment_data (JSONB), ai_insights (JSONB),
  status, owner_id, bdr_assigned,
  qualification_score, relationship_stage
)
```

**Features:**
- Multi-source data enrichment
- Intent signal tracking (website visits, LinkedIn engagement)
- AI-powered lead scoring
- Relationship stage tracking
- BDR automation integration
- Custom fields via JSONB

**API Endpoints:**
```
GET    /api/v1/prospects
POST   /api/v1/prospects
GET    /api/v1/prospects/:id
PUT    /api/v1/prospects/:id
DELETE /api/v1/prospects/:id
GET    /api/v1/prospects/:id/activities
GET    /api/v1/prospects/:id/insights
```

**UI Components:**
- `/src/components/dashboard/ProspectsView.tsx`
- Prospect detail modal with full activity history
- Bulk import/export functionality
- Advanced filtering and segmentation

**Configuration:**
```env
# Enrichment providers
CLEARBIT_API_KEY=your_key
ZOOMINFO_API_KEY=your_key
APOLLO_API_KEY=your_key
```

**Usage Example:**
```javascript
// Create a new prospect
const prospect = await fetch('/api/v1/prospects', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    email: 'john@acme.com',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Inc',
    enrichmentEnabled: true
  })
});
```

---

### 1.2 Deal Pipeline Management

**Description:** Full-featured deal pipeline with stages, forecasting, and AI-driven risk analysis.

**Database Tables:**
- `deals` - Deal records
- `deal_contacts` - Deal-to-prospect associations

**Key Fields:**
```sql
deals (
  id, name, amount, probability,
  stage, forecast_category,
  close_date, risk_score,
  account_id, owner_id, team_id,
  ai_analysis (JSONB), metadata (JSONB)
)
```

**Deal Stages:**
- Discovery
- Qualification
- Proposal
- Negotiation
- Closed Won
- Closed Lost

**Forecast Categories:**
- Pipeline (0-25% probability)
- Best Case (25-75% probability)
- Commit (75-90% probability)
- Closed (90-100% or won)

**Features:**
- Visual pipeline board
- Drag-and-drop stage management
- AI-powered risk scoring
- Pipeline forecasting
- Deal health monitoring
- Win/loss analysis

**API Endpoints:**
```
GET    /api/v1/deals
POST   /api/v1/deals
GET    /api/v1/deals/:id
PUT    /api/v1/deals/:id
DELETE /api/v1/deals/:id
GET    /api/v1/deals/:id/health
POST   /api/v1/deals/:id/contacts
```

**UI Components:**
- `/src/components/dashboard/PipelineView.tsx`
- `/src/components/dashboard/PipelineHealthView.tsx`
- `/src/components/dashboard/DealDetailModal.tsx`

**Database Functions:**
```sql
-- Analyze deal health
SELECT * FROM analyze_pipeline_health(
  p_team_id := 'team-uuid',
  p_deal_id := 'deal-uuid'
);
```

---

### 1.3 Account Management

**Description:** B2B account hierarchy with relationship tracking and multi-contact management.

**Database Tables:**
- `accounts` - Company accounts
- `company_profiles` - Extended company research

**Key Fields:**
```sql
accounts (
  id, name, domain, industry,
  employee_count, annual_revenue,
  owner_id, team_id
)
```

**Features:**
- Account hierarchy (parent/child relationships)
- Multi-contact management per account
- Account-level activity tracking
- Revenue tracking and forecasting
- Account health scoring

---

## 2. Outreach & Engagement

### 2.1 Email Sequences (Cadences)

**Description:** Multi-channel sales cadences with automated email, call, and LinkedIn touchpoints.

**Database Tables:**
- `cadences` - Sequence definitions
- `cadence_steps` - Individual steps in sequence
- `cadence_enrollments` - Prospect enrollment tracking

**Key Fields:**
```sql
cadences (
  id, name, description, is_active,
  settings (JSONB), team_id
)

cadence_steps (
  id, cadence_id, step_number,
  type (email|call|linkedin|sms|task),
  delay_days, delay_hours,
  template_id, content, conditions (JSONB)
)
```

**Step Types:**
- `email` - Automated email
- `call` - Manual call task
- `linkedin` - LinkedIn message/connection
- `sms` - SMS message
- `task` - Generic task

**Features:**
- Multi-channel sequences (email, call, LinkedIn, SMS)
- Conditional branching based on engagement
- A/B testing for email content
- Auto-pause on reply
- Time zone optimization
- Business hours enforcement
- Template variable substitution

**API Endpoints:**
```
GET    /api/v1/cadences
POST   /api/v1/cadences
GET    /api/v1/cadences/:id
PUT    /api/v1/cadences/:id
DELETE /api/v1/cadences/:id
POST   /api/v1/cadences/:id/enroll
POST   /api/v1/cadences/:id/steps
GET    /api/v1/cadences/:id/analytics
```

**UI Components:**
- `/src/components/dashboard/CadencesView.tsx`
- `/src/components/dashboard/CadenceDetailModal.tsx`

**Usage Example:**
```javascript
// Create a new cadence
const cadence = {
  name: "SDR Outreach - Tech Companies",
  description: "5-day sequence for tech prospects",
  steps: [
    {
      stepNumber: 1,
      type: "email",
      delayDays: 0,
      templateId: "welcome-email-uuid",
      subject: "Quick question about {{company}}",
      content: "Hi {{firstName}}, ..."
    },
    {
      stepNumber: 2,
      type: "call",
      delayDays: 2,
      content: "Follow-up call"
    },
    {
      stepNumber: 3,
      type: "email",
      delayDays: 3,
      templateId: "follow-up-uuid"
    }
  ]
};
```

---

### 2.2 Email Infrastructure

**Description:** Production-grade email delivery with SendGrid integration, tracking, and deliverability monitoring.

**Database Tables:**
- `emails` - Individual email records
- `email_templates` - Reusable templates
- `email_tracking_events` - Detailed event tracking
- `email_blacklist` - Bounced/invalid emails
- `email_unsubscribes` - Unsubscribe management
- `bulk_email_jobs` - Bulk sending jobs

**Key Fields:**
```sql
emails (
  id, organization_id, user_id,
  "to", cc, bcc (JSONB),
  subject, html, text,
  status, opened, clicked, bounced,
  sendgrid_message_id,
  prospect_id, deal_id, campaign_id,
  sent_at, delivered_at
)
```

**Features:**
- SendGrid integration for delivery
- Open tracking (pixel-based)
- Click tracking (link rewriting)
- Bounce management (soft/hard)
- Unsubscribe management
- Email authentication (SPF, DKIM, DMARC)
- Template variable substitution
- Bulk sending with rate limiting
- Scheduled sending
- Email warmup support

**API Endpoints:**
```
POST   /api/v1/emails/send
GET    /api/v1/emails/:id
GET    /api/v1/emails/:id/events
POST   /api/v1/emails/webhook/sendgrid
GET    /api/v1/email-templates
POST   /api/v1/email-templates
```

**Configuration:**
```env
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com
EMAIL_TRACKING_DOMAIN=track.yourdomain.com
```

**Usage Example:**
```javascript
// Send a templated email
await fetch('/api/v1/emails/send', {
  method: 'POST',
  body: JSON.stringify({
    to: [{ email: 'prospect@company.com', name: 'John Doe' }],
    templateId: 'template-uuid',
    variables: {
      firstName: 'John',
      company: 'Acme Inc',
      meetingLink: 'https://cal.com/meeting'
    },
    prospectId: 'prospect-uuid',
    trackOpens: true,
    trackClicks: true
  })
});
```

---

### 2.3 Call Logging

**Description:** Call activity tracking with disposition codes and note-taking.

**Database Tables:**
- `call_logs` - Call records

**Key Fields:**
```sql
call_logs (
  id, prospect_id, duration_seconds,
  disposition (answered|voicemail|no_answer|busy),
  notes, created_at
)
```

**Features:**
- Manual call logging
- Quick-log with disposition codes
- Duration tracking
- Notes and outcomes
- Integration with conversation intelligence

---

### 2.4 Activity Tracking

**Description:** Comprehensive activity log for all prospect interactions.

**Database Tables:**
- `activities` - All activity records
- `bdr_activities` - BDR agent activities

**Activity Types:**
- Email sent/received
- Call made/received
- Meeting scheduled/completed
- LinkedIn interaction
- Note added
- Status change
- Task completed

**Features:**
- Timeline view of all activities
- Activity filtering and search
- Automated activity creation
- Manual activity logging

---

## 3. AI & Automation

### 3.1 Autonomous BDR Agent System

**Description:** Fully autonomous AI agent that discovers, researches, engages, qualifies, and hands off prospects without human intervention.

**Database Tables:**
- `bdr_agent_configs` - Agent configuration
- `bdr_tasks` - Task queue
- `bdr_activities` - Activity log
- `bdr_context_memory` - Prospect context
- `bdr_decisions` - Decision tracking
- `bdr_handoffs` - Qualified handoffs
- `bdr_approval_queue` - Messages awaiting approval
- `bdr_workflow_executions` - Workflow state
- `bdr_performance_metrics` - Daily metrics

**Agent Workflow:**
1. **Discovery** - Find high-intent prospects
2. **Research** - Gather company/prospect intelligence
3. **Engage** - Send personalized outreach
4. **Follow-up** - Continue conversation
5. **Qualify** - Assess fit using BANT/MEDDIC
6. **Handoff** - Transfer qualified leads to humans

**Configuration:**
```sql
bdr_agent_configs (
  agent_name, is_active,
  auto_approve_messages (bool),
  require_human_review (bool),
  max_daily_touches,
  max_touches_per_prospect,
  min_delay_between_touches_hours,

  -- Discovery
  discovery_enabled, discovery_interval_minutes,
  min_intent_score, max_new_prospects_per_day,

  -- Channels
  preferred_channels (email|linkedin|phone),

  -- Qualification
  qualification_framework (BANT|MEDDIC|CHAMP),
  auto_qualify_threshold,
  handoff_threshold,

  -- Hours
  working_hours (JSONB)
)
```

**Features:**
- Autonomous prospect discovery based on intent signals
- AI-powered research from multiple sources
- Personalized message generation
- Multi-touch follow-up sequences
- Automatic qualification scoring
- Intelligent handoff to human reps
- Human-in-the-loop approval workflow
- Continuous learning from outcomes
- A/B testing of messaging strategies

**API Endpoints:**
```
GET    /api/v1/bdr/config
PUT    /api/v1/bdr/config
GET    /api/v1/bdr/tasks
GET    /api/v1/bdr/handoffs
POST   /api/v1/bdr/handoffs/:id/accept
GET    /api/v1/bdr/approvals
POST   /api/v1/bdr/approvals/:id/approve
GET    /api/v1/bdr/performance
```

**UI Components:**
- `/src/components/dashboard/AIAgentsView.tsx`

**Database Functions:**
```sql
-- Get pending tasks for execution
SELECT * FROM get_pending_bdr_tasks(
  p_team_id := 'team-uuid',
  p_limit := 10
);

-- Get high-intent prospects for discovery
SELECT * FROM get_high_intent_prospects(
  p_team_id := 'team-uuid',
  p_min_intent_score := 50,
  p_limit := 20
);

-- Get dashboard summary
SELECT * FROM get_bdr_dashboard_summary('team-uuid');
```

**Usage Example:**
```javascript
// Configure BDR agent
await fetch('/api/v1/bdr/config', {
  method: 'PUT',
  body: JSON.stringify({
    isActive: true,
    autoApproveMessages: false,
    maxDailyTouches: 50,
    maxTouchesPerProspect: 5,
    minDelayBetweenTouchesHours: 48,
    discoveryEnabled: true,
    minIntentScore: 60,
    qualificationFramework: 'BANT',
    handoffThreshold: 80,
    workingHours: {
      timezone: 'America/New_York',
      startHour: 9,
      endHour: 17,
      days: [1, 2, 3, 4, 5] // Mon-Fri
    }
  })
});
```

---

### 3.2 AI Email Writer

**Description:** Context-aware email generation with multi-model AI support and A/B testing.

**Features:**
- Multi-model routing (GPT-4, Claude Sonnet, Gemini)
- Context injection from prospect data
- Tone/style customization
- A/B variant generation
- Real-time preview
- Template learning from best performers

**AI Models Supported:**
- OpenAI GPT-4
- Anthropic Claude Sonnet
- Google Gemini Pro

**Configuration:**
```env
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_AI_API_KEY=your_key
```

---

### 3.3 Lead Scoring

**Description:** ML-powered lead scoring with real-time updates and custom scoring models.

**Database Tables:**
- `ai_predictions` - Prediction history

**Scoring Factors:**
- Demographic fit (title, company size, industry)
- Behavioral engagement (emails, website, content)
- Intent signals (website visits, research activity)
- Firmographic data (revenue, employee count)
- Technographic data (tech stack)

**Features:**
- Real-time score updates
- Historical score tracking
- Custom scoring models
- Score explainability
- Threshold-based automation

---

### 3.4 Conversation Intelligence

**Description:** AI-powered call transcription, sentiment analysis, and coaching insights.

**Database Tables:**
- `conversations` - Call/meeting records
- `conversation_transcripts` - Transcriptions
- `conversation_insights` - AI-generated insights

**Features:**
- Automatic call transcription
- Speaker identification
- Sentiment analysis per statement
- Key moment detection
- Talk/listen ratio
- Objection detection
- Next-best-action suggestions
- Coaching opportunities
- Competitor mentions

**UI Components:**
- `/src/components/dashboard/ConversationsView.tsx`

---

### 3.5 AI Playground

**Description:** Experiment with different AI models and prompts for custom use cases.

**Database Tables:**
- `ai_playground_experiments` - Experiment tracking
- `ai_agent_sessions` - Agent interaction logs

**Features:**
- Side-by-side model comparison
- Custom prompt engineering
- Response quality rating
- Cost tracking per model
- Experiment history
- Export to templates

**UI Components:**
- `/src/components/dashboard/AIPlayground.tsx`

---

### 3.6 Intent Signal Detection

**Description:** Multi-source intent tracking with spike detection and alerts.

**Database Tables:**
- `intent_signals` - Signal records
- `intent_score_history` - Historical scores
- `intent_alerts` - Alert notifications
- `website_visitors` - Website tracking
- `website_page_views` - Page view tracking
- `linkedin_engagements` - LinkedIn activity

**Signal Types:**
- Website visits (high-intent pages)
- LinkedIn profile views
- Job postings (hiring signals)
- Technographic changes
- Funding announcements
- News mentions

**Intent Tiers:**
- **Low** (0-25 score)
- **Warm** (26-50 score)
- **Hot** (51-75 score)
- **Burning** (76-100 score)

**Features:**
- Multi-source signal aggregation
- Real-time score calculation
- Trend analysis (increasing/stable/decreasing)
- Spike detection and alerts
- Company-level and contact-level tracking
- Automatic signal expiration
- Intent-based automation triggers

**Database Functions:**
```sql
-- Get team intent summary
SELECT * FROM get_team_intent_summary('team-uuid');

-- Get top intent prospects
SELECT * FROM get_top_intent_prospects('team-uuid', 10);

-- Calculate visitor intent score
SELECT aggregate_visitor_intent('visitor-uuid');
```

---

## 4. Search & Knowledge Base

### 4.1 Universal Search

**Description:** <50ms search across all entities powered by Typesense with semantic search capabilities.

**Database Tables:**
- `search_analytics` - Query tracking
- `saved_searches` - User saved searches
- `search_indexing_jobs` - Bulk indexing jobs
- `search_sync_queue` - Real-time sync queue
- `search_popular_queries` - Popular searches

**Searchable Entities:**
- Prospects
- Accounts
- Deals
- Tickets
- Emails
- Knowledge base articles
- Documents
- Campaigns

**Features:**
- Sub-50ms response time
- Typo tolerance
- Faceted filtering
- Semantic search
- Auto-suggest/autocomplete
- Result highlighting
- Saved searches
- Search analytics
- Query intent detection

**API Endpoints:**
```
GET    /api/v1/search?q={query}&types={types}&filters={filters}
GET    /api/v1/search/suggestions?q={query}
POST   /api/v1/search/saved
GET    /api/v1/search/analytics
```

**Configuration:**
```env
TYPESENSE_API_KEY=your_key
TYPESENSE_HOST=typesense.yourdomain.com
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
```

**Usage Example:**
```javascript
// Universal search
const results = await fetch('/api/v1/search?q=acme+inc&types=prospects,accounts,deals');

// Response
{
  "prospects": [...],
  "accounts": [...],
  "deals": [...],
  "totalResults": 15,
  "searchTime": 12 // milliseconds
}
```

---

### 4.2 Company Knowledge Base

**Description:** AI-powered company research and spokesperson training system.

**Database Tables:**
- `company_profiles` - Company data
- `knowledge_documents` - Research documents with embeddings
- `knowledge_websites` - Website sources
- `company_research_sources` - Research sources
- `company_training_sessions` - Training interactions

**Features:**
- Automated company research
- Website crawling and analysis
- Vector embeddings for semantic search
- AI spokesperson training
- Research quality scoring
- Buying signal detection
- Competitive intelligence
- News and event monitoring

**UI Components:**
- `/src/components/dashboard/KnowledgeBaseView.tsx`
- `/src/components/dashboard/ResearchCenter.tsx`

**Database Functions:**
```sql
-- Vector similarity search
SELECT * FROM match_knowledge_documents(
  query_embedding := '[...]',
  match_threshold := 0.8,
  match_count := 10,
  p_company_profile_id := 'company-uuid'
);
```

---

### 4.3 Knowledge Base (Support)

**Description:** Public and internal knowledge base for customer self-service and agent resources.

**Database Tables:**
- `knowledge_base_categories` - Article categories
- `knowledge_base_articles` - Help articles

**Features:**
- Hierarchical categories
- Rich text editor
- SEO optimization
- Public/internal/customer portal visibility
- Article versioning
- Helpful/unhelpful voting
- Related articles
- Search-optimized
- Analytics (views, helpfulness)

---

## 5. Integrations

### 5.1 Integration Control Center

**Description:** Comprehensive integration management with marketplace, usage tracking, and workflow automation.

**Database Tables:**
- `team_integrations` - Installed integrations
- `integration_marketplace` - Available integrations
- `integration_usage_analytics` - Usage metrics
- `integration_flows` - Workflow automations
- `integration_flow_executions` - Execution logs
- `integration_reviews` - User reviews

**Pre-built Integrations:**
- **CRM:** Salesforce, HubSpot, Pipedrive
- **Email:** Gmail, Outlook, SendGrid, Mailchimp
- **Calendar:** Google Calendar, Outlook Calendar, Calendly
- **Communication:** Slack, Twilio, Intercom
- **Enrichment:** Clearbit, ZoomInfo, Apollo.io
- **Social:** LinkedIn Sales Navigator
- **Payment:** Stripe
- **Automation:** Zapier
- **Analytics:** Segment, Mixpanel

**Integration Categories:**
- CRM
- Email
- Calendar
- Communication
- Enrichment
- Social
- Payment
- Automation
- Analytics

**Features:**
- OAuth 2.0 authentication
- API key management
- Real-time sync
- Webhook support
- Usage analytics
- Health monitoring
- Error tracking
- Cost tracking
- Rate limiting

**API Endpoints:**
```
GET    /api/v1/integrations/marketplace
POST   /api/v1/integrations/install
GET    /api/v1/integrations/:id/status
DELETE /api/v1/integrations/:id
GET    /api/v1/integrations/:id/analytics
POST   /api/v1/integrations/:id/sync
```

**UI Components:**
- `/src/components/dashboard/IntegrationMarketplace.tsx`
- `/src/components/dashboard/IntegrationControlCenter.tsx`

**Database Functions:**
```sql
-- Calculate integration health score
SELECT calculate_integration_health_score('integration-uuid');

-- Track API call
SELECT track_api_call(
  p_team_id := 'team-uuid',
  p_integration_id := 'integration-uuid',
  p_success := true,
  p_latency_ms := 150,
  p_cost_usd := 0.001
);
```

---

### 5.2 Integration Flow Builder

**Description:** Visual workflow builder for no-code automation between integrations.

**Database Tables:**
- `integration_flows` - Flow definitions
- `integration_flow_executions` - Execution history

**Trigger Types:**
- Webhook
- Schedule (cron)
- Manual
- Record change

**Action Types:**
- Create record
- Update record
- Send email
- Send notification
- HTTP request
- Data transformation
- Conditional logic
- Loops

**UI Components:**
- `/src/components/dashboard/IntegrationFlowBuilder.tsx`

**Usage Example:**
```javascript
// Create an automation flow
{
  name: "Sync won deals to Salesforce",
  trigger: {
    type: "record_change",
    table: "deals",
    event: "UPDATE",
    filters: { stage: "closed_won" }
  },
  actions: [
    {
      type: "salesforce_create_opportunity",
      integrationId: "sf-integration-id",
      mapping: {
        name: "{{deal.name}}",
        amount: "{{deal.amount}}",
        closeDate: "{{deal.close_date}}"
      }
    },
    {
      type: "send_notification",
      channel: "slack",
      message: "Deal {{deal.name}} won! <‰"
    }
  ]
}
```

---

### 5.3 Webhooks

**Description:** Event-driven automation with outbound webhooks.

**Database Tables:**
- `webhook_endpoints` - Webhook URLs
- `webhook_logs` - Delivery logs

**Supported Events:**
- prospect.created
- prospect.updated
- deal.created
- deal.stage_changed
- deal.won
- deal.lost
- email.opened
- email.clicked
- meeting.scheduled
- ticket.created
- ticket.resolved

**Features:**
- HMAC signature verification
- Automatic retry with exponential backoff
- Event filtering
- Batch delivery
- Delivery logs
- Health monitoring

---

### 5.4 Data Enrichment

**Description:** Multi-provider enrichment waterfall for prospect and company data.

**Database Tables:**
- `enrichment_providers` - Provider configs
- `enrichment_requests` - Request tracking

**Providers:**
- Clearbit
- ZoomInfo
- Apollo.io
- Hunter.io
- People Data Labs

**Enrichment Data:**
- Contact info (phone, email)
- Job title and seniority
- Company info
- Technographics
- Social profiles
- Company size and revenue

**UI Components:**
- `/src/components/dashboard/EnrichmentProvidersPanel.tsx`

---

## 6. SaaS & Team Management

### 6.1 Team Management

**Description:** Multi-tenant team organization with role-based access control.

**Database Tables:**
- `organizations` - Top-level organizations
- `teams` - Teams within organizations
- `users` - User accounts
- `profiles` - User profiles
- `team_invitations` - Pending invites

**Roles:**
- **Admin** - Full access, billing, team management
- **User** - Standard access, can create/edit records
- **Viewer** - Read-only access

**Features:**
- Team invitation via email
- Role-based permissions
- Team settings management
- User activity tracking
- Team member directory
- Invitation expiration

**API Endpoints:**
```
GET    /api/v1/team/members
POST   /api/v1/team/invite
DELETE /api/v1/team/members/:id
PUT    /api/v1/team/members/:id/role
GET    /api/v1/team/invitations
POST   /api/v1/team/invitations/:token/accept
```

**Configuration:**
```env
JWT_SECRET=your_secret_min_32_chars
JWT_EXPIRATION=7d
INVITATION_EXPIRATION_HOURS=72
```

---

### 6.2 API Key Management

**Description:** Scoped API keys for programmatic access with usage tracking.

**Database Tables:**
- `api_keys` - API key records

**Key Fields:**
```sql
api_keys (
  id, name, key_hash, prefix,
  scopes (text[]),
  organization_id, user_id,
  status (active|revoked|expired),
  request_count, last_used_at,
  expires_at
)
```

**Scopes:**
- `prospects:read`
- `prospects:write`
- `deals:read`
- `deals:write`
- `emails:send`
- `search:read`
- `webhooks:manage`

**Features:**
- Scoped permissions
- Usage tracking
- Rate limiting per key
- Automatic expiration
- Key rotation
- Prefix-based identification (e.g., `sk_live_...`)

**API Endpoints:**
```
GET    /api/v1/api-keys
POST   /api/v1/api-keys
DELETE /api/v1/api-keys/:id
PUT    /api/v1/api-keys/:id/rotate
GET    /api/v1/api-keys/:id/usage
```

---

### 6.3 Subscription & Billing

**Description:** Multi-tier subscription management with Stripe integration.

**Database Tables:**
- `subscriptions` - Subscription records
- `invoices` - Invoice history

**Plans:**
- **Free** - Limited features, 100 prospects
- **Starter** - $49/mo, 1,000 prospects
- **Pro** - $199/mo, 10,000 prospects
- **Enterprise** - Custom pricing, unlimited

**Features:**
- Stripe integration
- Automatic billing
- Invoice generation
- Plan upgrades/downgrades
- Usage-based billing
- Payment method management
- Billing portal

**API Endpoints:**
```
GET    /api/v1/billing/subscription
POST   /api/v1/billing/subscription/upgrade
POST   /api/v1/billing/subscription/cancel
GET    /api/v1/billing/invoices
POST   /api/v1/billing/payment-method
GET    /api/v1/billing/portal
```

**Configuration:**
```env
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
STRIPE_PUBLISHABLE_KEY=your_publishable_key
```

---

### 6.4 SSO & Enterprise Authentication

**Description:** Single Sign-On with SAML, OAuth, and OIDC support.

**Database Tables:**
- `sso_providers` - SSO configurations

**Supported Providers:**
- SAML 2.0
- OAuth 2.0
- OpenID Connect (OIDC)

**Features:**
- Just-in-time (JIT) provisioning
- Custom attribute mapping
- Multiple provider support
- Forced SSO enforcement
- Audit logging

---

### 6.5 User Preferences

**Description:** Personalized user settings and notification preferences.

**Database Tables:**
- `user_preferences` - User settings

**Settings:**
- Email notifications (on/off, frequency)
- Desktop notifications
- Weekly digest emails
- Time zone
- Language
- Theme (light/dark)

---

## 7. Analytics & Reporting

### 7.1 Performance Dashboard

**Description:** Real-time performance metrics and KPIs.

**Database Tables:**
- `performance_metrics` - User performance data
- `activity_metrics` - Activity aggregates

**Metrics:**
- **Activity Metrics**
  - Calls made
  - Emails sent
  - Meetings scheduled
  - LinkedIn messages

- **Pipeline Metrics**
  - Pipeline value
  - Win rate
  - Average deal size
  - Sales cycle length

- **Email Metrics**
  - Open rate
  - Click rate
  - Reply rate
  - Bounce rate

- **BDR Metrics**
  - Leads contacted
  - Meetings booked
  - Handoff rate
  - Response rate

**UI Components:**
- `/src/components/dashboard/PerformanceDashboardView.tsx`
- `/src/components/dashboard/AdvancedAnalyticsView.tsx`
- `/src/components/dashboard/AnalyticsView.tsx`

**Database Functions:**
```sql
-- Get daily tasks
SELECT * FROM get_daily_tasks(
  p_team_id := 'team-uuid',
  p_user_id := 'user-uuid',
  p_date := CURRENT_DATE
);
```

---

### 7.2 Pipeline Forecasting

**Description:** AI-powered deal forecasting with probability-based projections.

**Features:**
- Forecast by category (pipeline, best case, commit)
- Historical accuracy tracking
- Individual deal probability
- Team forecasting
- Time-based projections (this month, quarter, year)

**UI Components:**
- `/src/components/dashboard/PipelineView.tsx`

---

### 7.3 Outreach Analytics

**Description:** Detailed analytics for outreach campaigns and cadences.

**Features:**
- Cadence performance
- Email performance by template
- Best time to send
- Response time analysis
- Channel effectiveness
- A/B test results

**UI Components:**
- `/src/components/dashboard/OutreachAnalyticsDashboard.tsx`

---

### 7.4 Search Analytics

**Description:** Search query analysis and optimization.

**Database Tables:**
- `search_analytics` - Search queries
- `search_popular_queries` - Trending searches

**Metrics:**
- Top searches
- Zero-result searches
- Click-through rate by position
- Average search time
- Query refinements

---

## 8. Communication & Notifications

### 8.1 Real-time Notification System

**Description:** Multi-channel notification delivery with WebSocket support.

**Database Tables:**
- `notifications` - Notification records
- `notification_preferences` - User preferences
- `notification_deliveries` - Delivery tracking
- `notification_batches` - Digest batches
- `push_subscriptions` - Web push subscriptions
- `user_presence` - Online/offline status

**Notification Types:**
- In-app notifications
- Email notifications
- Push notifications (web push)
- SMS notifications (via Twilio)

**Channels:**
```sql
notification_preferences.channels (JSONB):
{
  "inApp": {
    "enabled": true,
    "sound": false,
    "desktop": false
  },
  "email": {
    "enabled": true,
    "frequency": "daily",
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  },
  "push": {
    "enabled": false
  },
  "sms": {
    "enabled": false
  }
}
```

**Priority Levels:**
- Low
- Medium
- High
- Urgent

**Event Types (40+ events):**
- prospect.qualified
- deal.stage_changed
- deal.won
- meeting.scheduled
- email.replied
- bdr.handoff_ready
- intent.spike_detected
- ticket.assigned
- task.due_soon

**Features:**
- WebSocket real-time delivery
- Notification grouping/collapsing
- Snooze functionality
- Mark as read/unread
- Archive old notifications
- Quiet hours
- Email digest (hourly/daily/weekly)
- Priority filtering
- Action buttons
- Rich notifications with images

**API Endpoints:**
```
GET    /api/v1/notifications
PUT    /api/v1/notifications/:id/read
DELETE /api/v1/notifications/:id
POST   /api/v1/notifications/mark-all-read
GET    /api/v1/notifications/preferences
PUT    /api/v1/notifications/preferences
POST   /api/v1/notifications/push/subscribe
```

**WebSocket Events:**
```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://api.yourdomain.com/ws');

// Listen for notifications
ws.on('notification', (notification) => {
  // Display notification
  showToast(notification);
});

// User presence
ws.on('presence.update', (presence) => {
  // Update user status
});
```

**Configuration:**
```env
WEBSOCKET_PORT=3001
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
VAPID_PUBLIC_KEY=your_vapid_public
VAPID_PRIVATE_KEY=your_vapid_private
```

**Database Functions:**
```sql
-- Auto-archive old notifications
SELECT auto_archive_notifications();

-- Clean up expired notifications
SELECT cleanup_expired_notifications();

-- Unsnooze notifications
SELECT unsnooze_notifications();
```

---

### 8.2 Email Bounce Management

**Description:** Automatic handling of email bounces and invalid addresses.

**Database Tables:**
- `email_blacklist` - Bounced emails
- `email_bounces` - Bounce tracking

**Bounce Types:**
- Hard bounce (permanent failure)
- Soft bounce (temporary failure)
- Spam complaint

**Features:**
- Automatic blacklist management
- Bounce notification
- Re-engagement campaigns
- List cleaning

---

## 9. Marketing Hub

### 9.1 Marketing Campaigns

**Description:** Multi-channel marketing campaign management.

**Database Tables:**
- `marketing_campaigns` - Campaign records
- `campaign_emails` - Individual sends
- `campaign_email_events` - Event tracking

**Campaign Types:**
- Email campaigns
- Landing pages
- Social media
- Paid ads
- Events

**Features:**
- Email campaign builder
- A/B testing
- Audience segmentation
- Send-time optimization
- Performance tracking
- UTM parameter generation

**Campaign Statuses:**
- Draft
- Scheduled
- Sending
- Sent
- Paused
- Archived

---

### 9.2 Contact Segmentation

**Description:** Dynamic and static contact list management.

**Database Tables:**
- `contact_segments` - Segment definitions
- `contact_lists` - Contact lists
- `contact_list_members` - List membership

**Segment Criteria:**
- Demographic filters
- Behavioral filters
- Engagement filters
- Custom field filters

**List Types:**
- Static (manually managed)
- Dynamic (auto-updating based on criteria)

---

### 9.3 Marketing Automation

**Description:** Workflow-based marketing automation.

**Database Tables:**
- `marketing_workflows` - Workflow definitions

**Workflow Actions:**
- Send email
- Add to list
- Remove from list
- Update field
- Wait/delay
- If/then conditional
- Goal tracking

---

## 10. Service Hub

### 10.1 Ticketing System

**Description:** Full-featured customer support ticketing with SLA management.

**Database Tables:**
- `tickets` - Ticket records
- `ticket_replies` - Ticket responses
- `slas` - SLA policies
- `ticket_routing_rules` - Auto-assignment rules
- `canned_responses` - Response templates

**Ticket Statuses:**
- New
- Open
- Pending
- Resolved
- Closed

**Priority Levels:**
- Low
- Normal
- High
- Urgent

**Features:**
- Email-to-ticket
- SLA tracking and alerts
- Automatic routing
- Canned responses
- Internal notes
- Satisfaction surveys
- Response time tracking
- Resolution time tracking
- SLA breach alerts

**API Endpoints:**
```
GET    /api/v1/tickets
POST   /api/v1/tickets
GET    /api/v1/tickets/:id
PUT    /api/v1/tickets/:id
POST   /api/v1/tickets/:id/replies
PUT    /api/v1/tickets/:id/assign
```

---

### 10.2 Live Chat

**Description:** Real-time customer chat with agent routing.

**Features:**
- Visitor tracking
- Proactive chat triggers
- Chat routing
- Canned responses
- File sharing
- Chat transcripts
- Satisfaction ratings

---

### 10.3 Customer Portal

**Description:** Self-service portal for customers.

**Features:**
- Knowledge base access
- Ticket submission
- Ticket tracking
- Account management
- Download center

---

## Database Schema Overview

### Core Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `organizations` | Companies | Top-level tenant |
| `teams` | Teams | Sub-organizations |
| `users` | User accounts | Authentication |
| `profiles` | User profiles | Extended user data |
| `prospects` | Contacts | Lead/contact management |
| `accounts` | Companies | B2B accounts |
| `deals` | Opportunities | Sales pipeline |

### Outreach Tables

| Table | Purpose |
|-------|---------|
| `cadences` | Email sequences |
| `cadence_steps` | Sequence steps |
| `cadence_enrollments` | Prospect enrollments |
| `emails` | Email records |
| `email_templates` | Reusable templates |
| `call_logs` | Call records |

### AI & Automation Tables

| Table | Purpose |
|-------|---------|
| `bdr_agent_configs` | Agent settings |
| `bdr_tasks` | Agent task queue |
| `bdr_activities` | Agent actions |
| `bdr_handoffs` | Qualified handoffs |
| `ai_predictions` | ML predictions |
| `conversations` | Call intelligence |

### Integration Tables

| Table | Purpose |
|-------|---------|
| `team_integrations` | Installed integrations |
| `integration_marketplace` | Available integrations |
| `integration_flows` | Automation workflows |
| `webhook_endpoints` | Webhook configs |

### Analytics Tables

| Table | Purpose |
|-------|---------|
| `search_analytics` | Search queries |
| `performance_metrics` | User metrics |
| `activity_metrics` | Activity aggregates |

---

## API Architecture

### Base URL
```
https://api.yourdomain.com/api/v1
```

### Authentication
All API requests require authentication via:
- **Bearer Token** (JWT) in `Authorization` header
- **API Key** in `X-API-Key` header

### Rate Limiting
- **General**: 1000 requests/hour per user
- **Auth endpoints**: 10 requests/minute per IP
- **Search**: 100 requests/minute per user

Headers returned:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1635724800
```

### Error Handling
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### Pagination
```
GET /api/v1/prospects?page=1&limit=50

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "pages": 10
  }
}
```

---

## Configuration Reference

### Required Environment Variables

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Authentication
JWT_SECRET=your-secret-min-32-chars
JWT_EXPIRATION=7d

# Redis (Rate Limiting & Caching)
REDIS_URL=redis://localhost:6379

# Email
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_VERIFIED_SENDER=noreply@yourdomain.com

# Search
TYPESENSE_API_KEY=your-typesense-key
TYPESENSE_HOST=typesense.yourdomain.com
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https

# AI
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-key
```

### Optional Environment Variables

```env
# Monitoring
SENTRY_DSN=your-sentry-dsn

# Integrations
SALESFORCE_CLIENT_ID=your-client-id
SALESFORCE_CLIENT_SECRET=your-client-secret
HUBSPOT_API_KEY=your-hubspot-key
CLEARBIT_API_KEY=your-clearbit-key
ZOOMINFO_API_KEY=your-zoominfo-key
APOLLO_API_KEY=your-apollo-key

# Notifications
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
VAPID_PUBLIC_KEY=your-vapid-public
VAPID_PRIVATE_KEY=your-vapid-private

# Payment
STRIPE_SECRET_KEY=your-stripe-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# Server
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://app.yourdomain.com
```

---

## Getting Started

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/AIRevenueOrc.git
cd AIRevenueOrc

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npx supabase migration up

# Start development servers
npm run dev          # Frontend (port 5173)
npm run dev:api      # API (port 3000)
```

### 2. Create First User

```sql
-- Run in Supabase SQL editor
INSERT INTO organizations (id, name) VALUES
  ('org-uuid', 'My Company');

INSERT INTO teams (id, name, organization_id) VALUES
  ('team-uuid', 'Sales Team', 'org-uuid');

INSERT INTO users (id, email, organization_id, team_id, role) VALUES
  ('user-uuid', 'admin@company.com', 'org-uuid', 'team-uuid', 'admin');
```

### 3. Configure Integrations

1. Navigate to Settings ’ Integrations
2. Connect email provider (Gmail/SendGrid)
3. Connect calendar (Google/Outlook)
4. Add enrichment providers (Clearbit, ZoomInfo)
5. Configure webhooks if needed

### 4. Import Prospects

```bash
# Via UI: Upload CSV
# Via API:
curl -X POST https://api.yourdomain.com/api/v1/prospects/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@prospects.csv"
```

### 5. Create First Cadence

1. Navigate to Cadences
2. Click "New Cadence"
3. Add steps (emails, calls, tasks)
4. Configure timing and conditions
5. Activate cadence
6. Enroll prospects

---

## Advanced Usage

### Custom AI Workflows

```javascript
// Create custom AI agent workflow
const workflow = {
  name: "Enterprise Lead Qualification",
  steps: [
    {
      type: "research",
      sources: ["linkedin", "company_website", "news"],
      duration: 300 // seconds
    },
    {
      type: "qualify",
      framework: "MEDDIC",
      requiredFields: ["budget", "authority", "need", "timeline"]
    },
    {
      type: "personalize",
      template: "enterprise-intro",
      tone: "professional",
      model: "gpt-4"
    },
    {
      type: "send",
      channel: "email",
      requireApproval: true
    }
  ]
};
```

### Vector Search in Knowledge Base

```javascript
// Semantic search using embeddings
const results = await fetch('/api/v1/knowledge/search', {
  method: 'POST',
  body: JSON.stringify({
    query: "How do I configure SSO?",
    threshold: 0.8,
    limit: 5
  })
});
```

### Real-time Sync Setup

```javascript
// Subscribe to real-time changes
supabase
  .channel('prospects')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'prospects' },
    (payload) => {
      console.log('Prospect changed:', payload);
      // Update UI or trigger sync
    }
  )
  .subscribe();
```

---

## Support & Resources

- **Documentation**: https://docs.airevenueorc.com
- **API Reference**: https://api.airevenueorc.com/docs
- **GitHub**: https://github.com/yourusername/AIRevenueOrc
- **Community**: https://community.airevenueorc.com
- **Support**: support@airevenueorc.com

---

**Last Updated:** 2025-11-22
**Version:** 1.0.0
**Status:** Production Ready
