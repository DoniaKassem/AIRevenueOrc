# AIRevenueOrc - Replit Migration Summary

## Project Overview
AIRevenueOrc is a comprehensive AI-powered sales and BDR (Business Development Representative) platform featuring CRM, AI agents, multi-channel outreach automation, conversation intelligence, marketing hub, service hub, and extensive integrations. This is an enterprise-grade SaaS solution.

## Migration Status: In Progress

### Completed
- **Database Setup**: PostgreSQL (Neon) with pgvector extension - 94 tables fully deployed
- **Drizzle ORM Schema**: Complete enterprise schema covering all platform features
- **Server Setup**: Express + Vite integration on port 5000
- **Core AI Features Migrated**: 3 of 6 Edge Functions converted to Express routes

### In Progress
- **OpenAI API Key**: Needs to be configured for full AI functionality
- **Frontend Integration**: Update to use Express API instead of Supabase client

### Pending
- Additional AI Functions (email sending, document processing, deep research, website crawling)
- Authentication middleware (JWT, SSO/SAML, MFA implementation)
- Rate Limiting and security middleware
- Testing and production deployment

## Database Schema (94 Tables)

### Core CRM (11 tables)
- `organizations` - Multi-tenant organization management
- `teams` - Team management within organizations
- `users` - User authentication and profile
- `profiles` - Extended user profile information
- `prospects` - Lead and prospect management
- `deals` - Sales pipeline and deal tracking
- `accounts` - Customer account management
- `company_profiles` - Company research and enrichment data
- `deal_contacts` - Deal-to-contact relationships
- `team_invitations` - Team invitation management
- `user_preferences` - User settings and preferences

### BDR Agent System (9 tables)
- `bdr_agent_configs` - AI agent configuration
- `bdr_tasks` - Task queue for automated workflows
- `bdr_activities` - Activity tracking for all BDR actions
- `bdr_context_memory` - Persistent memory for prospect context
- `bdr_decisions` - AI decision audit trail
- `bdr_handoffs` - Qualified lead handoff management
- `bdr_approval_queue` - Human-in-the-loop approval queue
- `bdr_workflow_executions` - Multi-step workflow tracking
- `bdr_performance_metrics` - Performance analytics and KPIs

### Outreach & Engagement (7 tables)
- `cadences` - Multi-touch outreach sequences
- `cadence_steps` - Individual steps in cadences
- `cadence_enrollments` - Prospect enrollment in cadences
- `email_templates` - Reusable email templates
- `email_logs` - Email delivery tracking
- `email_sends` - Email campaign management
- `call_logs` - Phone call tracking

### AI & Conversation Intelligence (5 tables)
- `conversations` - Sales conversation tracking
- `conversation_transcripts` - Call transcripts with speaker diarization
- `conversation_insights` - AI-extracted insights from calls
- `ai_agent_sessions` - AI agent session management
- `ai_predictions` - ML model predictions

### AI Playground (1 table)
- `ai_playground_experiments` - Experiment tracking for AI testing

### Knowledge Management (2 tables)
- `knowledge_documents` - Document storage with embeddings
- `knowledge_websites` - Crawled website content

### Marketing Hub (15 tables)
- `contact_segments` - Dynamic contact segmentation
- `marketing_campaigns` - Email marketing campaigns
- `contact_lists` - Static contact lists
- `contact_list_members` - List membership
- `campaign_emails` - Individual campaign emails
- `campaign_email_events` - Open/click tracking
- `campaign_email_clicks` - Click analytics
- `marketing_workflows` - Automated marketing sequences
- `workflow_enrollments` - Workflow enrollment tracking
- `workflow_emails` - Workflow email delivery
- `workflow_scheduled_actions` - Scheduled workflow actions
- `forms` - Lead capture forms
- `form_submissions` - Form submission data
- `landing_pages` - Landing page management
- `page_views` - Page analytics

### Service Hub (15 tables)
- `slas` - Service level agreements
- `tickets` - Support ticket management
- `ticket_replies` - Ticket conversation threads
- `ticket_routing_rules` - Automatic ticket routing
- `canned_responses` - Template responses
- `knowledge_base_categories` - KB categories
- `knowledge_base_articles` - Help center articles
- `knowledge_base_views` - Article view analytics
- `knowledge_base_feedback` - Article helpfulness ratings
- `knowledge_base_attachments` - Article file attachments
- `knowledge_base_searches` - Search analytics
- `chat_widgets` - Live chat widget configuration
- `chat_conversations` - Chat session management
- `chat_messages` - Chat message storage
- `agent_status` - Agent availability tracking

### Notification System (7 tables)
- `notifications` - In-app notifications
- `notification_preferences` - User notification settings
- `notification_deliveries` - Delivery tracking (email, push, SMS)
- `notification_batches` - Digest batching
- `push_subscriptions` - Web push subscriptions
- `email_bounces` - Email deliverability tracking
- `user_presence` - Real-time presence tracking

### Search System (5 tables)
- `search_analytics` - Search query analytics
- `saved_searches` - User saved searches
- `search_indexing_jobs` - Background indexing jobs
- `search_sync_queue` - Real-time sync queue
- `search_popular_queries` - Popular search tracking

### Enterprise Auth & Security (14 tables)
- `sso_providers` - SSO/SAML configuration
- `sso_sessions` - SSO session management
- `sso_audit_log` - SSO audit trail
- `roles` - RBAC role definitions
- `user_roles` - User-role assignments
- `rbac_audit_log` - Permission change audit
- `mfa_configurations` - MFA setup per user
- `mfa_sms_codes` - SMS verification codes
- `mfa_audit_log` - MFA usage audit
- `security_audit_log` - Comprehensive security logs
- `failed_login_attempts` - Brute force protection
- `ip_whitelist` - IP-based access control
- `sessions` - Session management
- `device_fingerprints` - Device recognition

### SaaS Infrastructure (3 tables)
- `subscriptions` - Subscription management
- `invoices` - Billing invoices
- `api_keys` - API key management

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (configured)
- `OPENAI_API_KEY` - OpenAI API key (needs configuration)
- `SENTRY_DSN` - Sentry error tracking (optional)
- `STRIPE_API_KEY` - Stripe for billing (optional)

## Tech Stack
- **Backend**: Express.js + TypeScript
- **Frontend**: React + Vite + TanStack Query
- **Database**: PostgreSQL (Neon) + Drizzle ORM + pgvector
- **AI**: OpenAI API (gpt-4o-mini) with rule-based fallbacks
- **Validation**: Zod
- **Styling**: TailwindCSS + shadcn/ui

## API Endpoints

### AI Features
- `POST /api/ai/conversation/analyze` - Analyze sales call transcripts
- `POST /api/ai/deal/analyze` - Analyze deal health and risk
- `POST /api/ai/prioritize` - Prioritize prospects with AI scoring

### Health Check
- `GET /api/health` - Server health status

## Key Files
- `shared/schema.ts` - Complete database schema (94 tables)
- `server/db.ts` - Database connection and Drizzle client
- `server/routes/ai.ts` - AI API endpoints
- `server/index.ts` - Express server setup
- `drizzle.config.ts` - Drizzle configuration

## Architecture Notes

### AI Features
- All AI features have rule-based fallback logic when OpenAI API is unavailable
- Uses gpt-4o-mini model for cost-effective AI processing
- Structured output validation with Zod schemas

### Database
- Uses UUID primary keys with `gen_random_uuid()` for new records
- pgvector extension for embedding-based search
- Optimized for multi-tenant SaaS with organization/team hierarchy

### Migration from Supabase
- Edge Functions → Express.js API routes
- Supabase Auth → Custom JWT/session management (pending)
- Supabase Realtime → WebSocket implementation (pending)
- Database unchanged (PostgreSQL compatible)

## Recent Changes
- **Dec 2024**: Complete database schema deployment (94 tables)
- **Dec 2024**: Migrated 3 AI Edge Functions to Express
- **Dec 2024**: Added comprehensive validation and error handling
- **Dec 2024**: Fixed deal analyzer activity lookups
- **Dec 2024**: Improved JSON parsing with error guards
- **Dec 2024**: Created Express API routes for prospects (CRUD operations)
- **Dec 2024**: Created Express API routes for notifications with error handling
- **Dec 2024**: Updated frontend API client base URL to '/api'
- **Dec 2024**: Updated ProspectsView to use Express API instead of Supabase client
- **Dec 2024**: Added graceful error handling for Neon driver empty table edge cases

## Next Steps
1. Configure OpenAI API key for full AI functionality
2. Implement authentication middleware (JWT + sessions)
3. Migrate remaining Edge Functions (email, document processing)
4. Continue frontend migration (remaining Supabase calls)
5. Implement rate limiting and security middleware
6. Add comprehensive testing
7. Set up production deployment configuration
