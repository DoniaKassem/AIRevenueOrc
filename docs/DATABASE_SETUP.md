# Database Setup Guide

Complete guide to setting up the AIRevenueOrc database from scratch.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option 1: Supabase (Recommended)](#option-1-supabase-recommended)
3. [Option 2: Self-Hosted PostgreSQL](#option-2-self-hosted-postgresql)
4. [Running Migrations](#running-migrations)
5. [Database Schema Overview](#database-schema-overview)
6. [Seeding Test Data](#seeding-test-data)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- PostgreSQL 14+ (with extensions: `uuid-ossp`, `pg_trgm`, `vector`)
- OR Supabase account (includes all extensions)
- Node.js 18+ (for running migrations)
- psql CLI (optional, for direct database access)

---

## Option 1: Supabase (Recommended)

Supabase provides hosted PostgreSQL with all required extensions pre-installed.

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new organization (if needed)
4. Create a new project:
   - **Name**: AIRevenueOrc
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
5. Wait for project to be ready (~2 minutes)

### 2. Get Connection Credentials

From your Supabase dashboard:

1. Go to **Settings** ’ **API**
2. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon Key** (public key for client-side)
   - **Service Role Key** (secret key for server-side)

3. Add to your `.env` file:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

### 3. Install Supabase CLI (Optional but Recommended)

```bash
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref
```

### 4. Run Migrations

**Method A: Using Supabase CLI**
```bash
supabase db push
```

**Method B: Manual SQL Execution**
1. Go to Supabase Dashboard ’ **SQL Editor**
2. Create a new query
3. Copy content from `supabase/migrations/20251122170000_complete_schema_consolidation.sql`
4. Paste and click "Run"

### 5. Verify Setup

```bash
# Check tables were created
supabase db reset --linked

# Or manually check in SQL Editor:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## Option 2: Self-Hosted PostgreSQL

For self-hosted PostgreSQL installations.

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-14 postgresql-contrib-14
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)

### 2. Install Required Extensions

```bash
# Connect to PostgreSQL
psql -U postgres

# Install extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";  # For pgvector (semantic search)
```

**Installing pgvector:**
```bash
# Clone and install pgvector
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install  # May need sudo
```

### 3. Create Database

```bash
# As postgres user
createdb airevenueorcdb

# Or via psql
psql -U postgres
CREATE DATABASE airevenueorcdb;
```

### 4. Configure Environment

```bash
# Add to .env file
DATABASE_URL=postgresql://postgres:password@localhost:5432/airevenueorcdb
SUPABASE_URL=http://localhost:54321  # If using Supabase locally
```

### 5. Run Migrations

```bash
# Using psql
psql -U postgres -d airevenueorcdb -f supabase/migrations/20251122170000_complete_schema_consolidation.sql

# Verify
psql -U postgres -d airevenueorcdb -c "\dt"
```

---

## Running Migrations

### Migration Order

The migrations should be run in chronological order. The latest consolidated migration is:

**`20251122170000_complete_schema_consolidation.sql`** - Complete schema with all tables

This migration includes:
- All core tables (organizations, users, teams)
- CRM entities (prospects, deals, accounts)
- Outreach systems (cadences, emails, calls)
- AI features (agents, predictions, conversations)
- Knowledge base (documents, websites, research)
- Integrations (webhooks, flows, marketplace)
- SaaS features (API keys, billing, subscriptions)
- Indexes for performance
- RLS policies for security
- Functions and triggers

### Manual Migration Execution

```bash
# Navigate to project directory
cd AIRevenueOrc

# Run consolidated migration
psql -U postgres -d your_database -f supabase/migrations/20251122170000_complete_schema_consolidation.sql
```

### Supabase CLI Migration

```bash
# Push all migrations
supabase db push

# Or reset and reapply all migrations
supabase db reset
```

---

## Database Schema Overview

### Core Tables

#### **Organizations & Teams**
- `organizations` - Customer organizations
- `teams` - Teams within organizations
- `users` - User accounts with roles
- `profiles` - Extended user profiles

#### **CRM**
- `prospects` - Lead/contact records
- `accounts` - Company accounts
- `deals` - Sales opportunities
- `deal_contacts` - Deal-prospect relationships
- `company_profiles` - Company research data

#### **Outreach**
- `email_templates` - Email templates with variables
- `cadences` - Multi-touch sequences
- `cadence_steps` - Individual steps in cadences
- `cadence_enrollments` - Prospect enrollments in cadences
- `call_logs` - Call activity tracking
- `email_logs` - Email activity tracking
- `email_sends` - Detailed email delivery tracking

#### **AI & Intelligence**
- `ai_agent_sessions` - AI agent conversation logs
- `ai_playground_experiments` - Model comparison tests
- `ai_predictions` - ML predictions and scores
- `conversations` - Call recordings/transcripts
- `conversation_transcripts` - Detailed transcripts
- `conversation_insights` - AI-extracted insights

#### **Knowledge Base**
- `knowledge_documents` - Document embeddings for RAG
- `knowledge_websites` - Tracked websites for crawling
- `company_research_sources` - Research data sources
- `company_training_sessions` - Training interactions

#### **Integrations**
- `team_integrations` - Installed integrations
- `integration_flows` - Automation workflows
- `integration_marketplace` - Available integrations
- `integration_providers` - Provider configurations
- `webhook_endpoints` - Webhook URLs
- `webhook_logs` - Webhook execution logs

#### **Enrichment**
- `enrichment_providers` - Data enrichment services
- `enrichment_requests` - Enrichment request tracking

#### **BDR Agent System**
- `bdr_agent_configs` - BDR agent configurations
- `bdr_tasks` - Automated tasks
- `bdr_activities` - BDR activity logs
- `bdr_handoffs` - Lead handoff records
- `bdr_performance_metrics` - BDR performance tracking

#### **SaaS Features**
- `api_keys` - API key management
- `subscriptions` - Subscription plans
- `invoices` - Billing invoices
- `user_preferences` - User settings
- `team_invitations` - Team member invitations
- `sso_providers` - SSO configurations

#### **Analytics**
- `activities` - General activity tracking
- `activity_metrics` - Aggregated metrics
- `performance_metrics` - User performance data
- `search_analytics` - Search usage tracking
- `saved_searches` - Saved search queries

### Database Functions

#### **`match_knowledge_documents()`**
Vector similarity search for knowledge base
```sql
SELECT * FROM match_knowledge_documents(
  query_embedding := '[0.1, 0.2, ...]',
  match_threshold := 0.7,
  match_count := 10,
  p_company_profile_id := 'uuid-here'
);
```

#### **`get_daily_tasks()`**
Retrieve daily tasks for a user
```sql
SELECT * FROM get_daily_tasks(
  p_team_id := 'uuid-here',
  p_user_id := 'uuid-here',
  p_date := '2025-01-15'
);
```

#### **`analyze_pipeline_health()`**
Analyze deal pipeline health
```sql
SELECT * FROM analyze_pipeline_health(
  p_team_id := 'uuid-here',
  p_deal_id := 'uuid-here'
);
```

---

## Seeding Test Data

### Create First Organization and User

```sql
-- Insert organization
INSERT INTO public.organizations (id, name)
VALUES (
  'org-00000000-0000-0000-0000-000000000001',
  'Acme Corporation'
);

-- Insert team
INSERT INTO public.teams (id, name, organization_id)
VALUES (
  'team-00000000-0000-0000-0000-000000000001',
  'Sales Team',
  'org-00000000-0000-0000-0000-000000000001'
);

-- Insert admin user
INSERT INTO public.users (
  id,
  email,
  organization_id,
  team_id,
  role,
  name,
  status
)
VALUES (
  'user-00000000-0000-0000-0000-000000000001',
  'admin@acme.com',
  'org-00000000-0000-0000-0000-000000000001',
  'team-00000000-0000-0000-0000-000000000001',
  'admin',
  'Admin User',
  'active'
);

-- Insert subscription
INSERT INTO public.subscriptions (
  organization_id,
  plan,
  status
)
VALUES (
  'org-00000000-0000-0000-0000-000000000001',
  'pro',
  'active'
);
```

### Seed Sample Prospects

```sql
INSERT INTO public.prospects (team_id, first_name, last_name, email, company, title, status)
VALUES
  ('team-00000000-0000-0000-0000-000000000001', 'John', 'Doe', 'john@example.com', 'TechCorp', 'VP Sales', 'new'),
  ('team-00000000-0000-0000-0000-000000000001', 'Jane', 'Smith', 'jane@example.com', 'StartupXYZ', 'CTO', 'contacted'),
  ('team-00000000-0000-0000-0000-000000000001', 'Bob', 'Johnson', 'bob@example.com', 'Enterprise Inc', 'CEO', 'qualified');
```

---

## Troubleshooting

### Common Issues

#### **Error: extension "vector" does not exist**

**Solution:**
```bash
# Install pgvector extension
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

Then in psql:
```sql
CREATE EXTENSION vector;
```

#### **Error: permission denied for schema public**

**Solution:**
```sql
GRANT ALL ON SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

#### **Error: relation already exists**

The migration is idempotent - it uses `CREATE TABLE IF NOT EXISTS`. If you see this, it's safe to ignore or run:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

#### **Supabase: Insufficient permissions**

Make sure you're using the **Service Role Key** (not Anon Key) for migrations.

#### **Migration fails partway through**

Run migrations individually in order, or reset and start fresh:
```bash
# Supabase
supabase db reset

# Self-hosted
dropdb airevenueorcdb
createdb airevenueorcdb
psql -d airevenueorcdb -f supabase/migrations/20251122170000_complete_schema_consolidation.sql
```

### Verify Database Setup

```sql
-- Check all tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return 50+ tables

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### Reset Database

**Supabase:**
```bash
supabase db reset
```

**Self-hosted:**
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then re-run migrations.

---

## Performance Tuning

### Recommended PostgreSQL Settings

For production use, update your `postgresql.conf`:

```conf
# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 128MB
work_mem = 16MB

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200

# Write Performance
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

### Analyze Tables

After seeding data, analyze tables for better query planning:

```sql
ANALYZE;
VACUUM ANALYZE;
```

---

## Backup & Restore

### Backup

```bash
# Full database backup
pg_dump -U postgres -d airevenueorcdb > backup_$(date +%Y%m%d).sql

# Supabase backup
supabase db dump -f backup.sql
```

### Restore

```bash
# Restore from backup
psql -U postgres -d airevenueorcdb < backup_20250122.sql

# Supabase restore
supabase db reset
psql -h db.xxxxx.supabase.co -U postgres -d postgres < backup.sql
```

---

## Next Steps

After database setup is complete:

1. **Configure environment variables** - Ensure all `.env` variables are set
2. **Run the application** - `npm run dev` and `npm run dev:api`
3. **Create first user** - Register through the UI or insert via SQL
4. **Review security** - Check RLS policies for your use case
5. **Set up monitoring** - Configure logging and analytics

For application features and usage, see [**FEATURES.md**](./FEATURES.md).

---

**Questions or Issues?**

Check the [main README](../README.md) or open an issue on GitHub.
