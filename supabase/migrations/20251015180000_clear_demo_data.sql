/*
  # Clear Demo/Seed Data

  This migration removes all demo and seed data from the database to provide
  a clean starting point for production use.

  ## Changes
  1. Delete all demo prospects, deals, and related records
  2. Keep only the default team structure
  3. Remove any hardcoded test data

  ## Important Notes
  - This does NOT delete the default team (required for single-user mode)
  - This does NOT modify table schemas or policies
  - This only removes data records
*/

-- Clear all prospect-related data
DELETE FROM cadence_enrollments;
DELETE FROM deal_contacts;
DELETE FROM buyer_signals;
DELETE FROM ai_predictions WHERE entity_type = 'prospect';
DELETE FROM email_sends;
DELETE FROM call_logs;
DELETE FROM prospects;

-- Clear all deal-related data
DELETE FROM ai_predictions WHERE entity_type = 'deal';
DELETE FROM deals;

-- Clear all cadence-related data
DELETE FROM cadence_steps;
DELETE FROM cadences;

-- Clear all template and configuration data
DELETE FROM email_templates;

-- Clear all account data
DELETE FROM accounts;

-- Clear job queue
DELETE FROM job_queue;

-- Clear integration configurations (keep providers but remove team configs)
DELETE FROM team_integrations;
DELETE FROM webhook_endpoints;
DELETE FROM webhook_logs;
DELETE FROM sync_jobs;
DELETE FROM field_mappings;
DELETE FROM api_rate_limits;

-- Clear enrichment data
DELETE FROM enrichment_provider_attempts;
DELETE FROM enrichment_requests;

-- Clear knowledge base data
DELETE FROM knowledge_base_chunks;
DELETE FROM knowledge_base_documents;

-- Clear conversation intelligence data
DELETE FROM conversation_insights;
DELETE FROM conversation_transcripts;

-- Clear audit logs (optional - you may want to keep these)
-- DELETE FROM audit_logs;

-- Note: We keep the default team and integration_providers catalog
-- The default team (id: 00000000-0000-0000-0000-000000000001) is required for single-user mode
