CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"industry" varchar(255),
	"employee_count" integer,
	"annual_revenue" numeric(15, 2),
	"team_id" uuid,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "agent_status" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'offline',
	"max_conversations" integer DEFAULT 5,
	"last_seen_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ai_agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"agent_type" varchar(50) NOT NULL,
	"conversation_history" jsonb DEFAULT '[]'::jsonb,
	"actions_taken" jsonb DEFAULT '[]'::jsonb,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ai_playground_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"user_id" uuid NOT NULL,
	"experiment_name" varchar(255) NOT NULL,
	"prompt" text NOT NULL,
	"system_prompt" text,
	"models_tested" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ai_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"prospect_id" uuid,
	"prediction_type" varchar(100) NOT NULL,
	"score" numeric(5, 2),
	"confidence" numeric(5, 2),
	"reasoning" jsonb DEFAULT '{}'::jsonb,
	"model_version" varchar(50),
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"prefix" varchar(20) NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"request_count" integer DEFAULT 0,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "bdr_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"task_id" uuid,
	"activity_type" text NOT NULL,
	"channel" text,
	"direction" text,
	"subject" text,
	"message_preview" text,
	"full_content" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"was_automated" boolean DEFAULT true,
	"required_approval" boolean DEFAULT false,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"agent_name" text DEFAULT 'BDR Agent' NOT NULL,
	"is_active" boolean DEFAULT true,
	"auto_approve_messages" boolean DEFAULT false,
	"require_human_review" boolean DEFAULT true,
	"max_daily_touches" integer DEFAULT 50,
	"max_touches_per_prospect" integer DEFAULT 5,
	"min_delay_between_touches_hours" integer DEFAULT 48,
	"discovery_enabled" boolean DEFAULT true,
	"discovery_interval_minutes" integer DEFAULT 60,
	"min_intent_score" integer DEFAULT 50,
	"max_new_prospects_per_day" integer DEFAULT 20,
	"preferred_channels" text[] DEFAULT ARRAY['email'],
	"linkedin_enabled" boolean DEFAULT false,
	"phone_enabled" boolean DEFAULT false,
	"qualification_framework" text DEFAULT 'BANT',
	"auto_qualify_threshold" integer DEFAULT 70,
	"handoff_threshold" integer DEFAULT 90,
	"enable_learning" boolean DEFAULT true,
	"ab_testing_enabled" boolean DEFAULT false,
	"working_hours" jsonb DEFAULT '{"timezone": "America/New_York", "start_hour": 9, "end_hour": 17, "days": [1,2,3,4,5]}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_approval_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"task_id" uuid,
	"approval_type" text NOT NULL,
	"subject" text,
	"message_body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ai_reasoning" text,
	"ai_confidence" numeric(3, 2),
	"status" text DEFAULT 'pending',
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"modified_content" text,
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '24 hours',
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_context_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"research_data" jsonb DEFAULT '{}'::jsonb,
	"conversation_history" jsonb DEFAULT '[]'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"objections" jsonb DEFAULT '[]'::jsonb,
	"intent_signals" jsonb DEFAULT '[]'::jsonb,
	"relationship_stage" text DEFAULT 'cold',
	"last_contact_at" timestamp with time zone,
	"last_response_at" timestamp with time zone,
	"contact_count" integer DEFAULT 0,
	"response_count" integer DEFAULT 0,
	"sentiment_score" numeric(3, 2),
	"engagement_score" integer,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "bdr_context_memory_prospect_id_unique" UNIQUE("prospect_id")
);
--> statement-breakpoint
CREATE TABLE "bdr_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"task_id" uuid,
	"decision_type" text NOT NULL,
	"decision_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommended_action" text NOT NULL,
	"reasoning" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb,
	"was_executed" boolean DEFAULT false,
	"executed_at" timestamp with time zone,
	"outcome" text,
	"outcome_data" jsonb DEFAULT '{}'::jsonb,
	"feedback_score" integer,
	"human_override" boolean DEFAULT false,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"company_profile_id" uuid,
	"handoff_type" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"qualification_score" integer,
	"bant_breakdown" jsonb DEFAULT '{}'::jsonb,
	"executive_summary" text NOT NULL,
	"key_insights" jsonb DEFAULT '[]'::jsonb,
	"conversation_summary" text,
	"suggested_next_steps" jsonb DEFAULT '[]'::jsonb,
	"assigned_to" uuid,
	"assigned_at" timestamp with time zone,
	"status" text DEFAULT 'pending',
	"handled_at" timestamp with time zone,
	"handler_notes" text,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"agent_config_id" uuid,
	"metric_date" date DEFAULT CURRENT_DATE NOT NULL,
	"prospects_discovered" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"linkedin_messages" integer DEFAULT 0,
	"phone_calls" integer DEFAULT 0,
	"email_opens" integer DEFAULT 0,
	"email_clicks" integer DEFAULT 0,
	"replies_received" integer DEFAULT 0,
	"conversations_started" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"prospects_qualified" integer DEFAULT 0,
	"prospects_handed_off" integer DEFAULT 0,
	"avg_qualification_score" numeric(5, 2),
	"tasks_completed" integer DEFAULT 0,
	"tasks_failed" integer DEFAULT 0,
	"avg_task_duration_seconds" integer,
	"pipeline_generated_usd" numeric(12, 2) DEFAULT '0',
	"deals_closed" integer DEFAULT 0,
	"revenue_generated_usd" numeric(12, 2) DEFAULT '0',
	"email_response_rate" numeric(5, 2),
	"linkedin_response_rate" numeric(5, 2),
	"overall_response_rate" numeric(5, 2),
	"decision_accuracy" numeric(5, 2),
	"human_overrides" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"company_profile_id" uuid,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5,
	"config" jsonb DEFAULT '{}'::jsonb,
	"workflow_id" text,
	"workflow_step" integer,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result" jsonb,
	"error" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "bdr_workflow_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"prospect_id" uuid,
	"workflow_id" text NOT NULL,
	"workflow_name" text NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"total_steps" integer NOT NULL,
	"status" text DEFAULT 'active',
	"execution_context" jsonb DEFAULT '{}'::jsonb,
	"completed_steps" integer[] DEFAULT ARRAY[]::integer[],
	"started_at" timestamp with time zone DEFAULT NOW(),
	"last_executed_at" timestamp with time zone,
	"next_execution_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"total_touches" integer DEFAULT 0,
	"responses_received" integer DEFAULT 0,
	"meetings_scheduled" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "cadence_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cadence_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"current_step" integer DEFAULT 0,
	"enrolled_at" timestamp with time zone DEFAULT NOW(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cadence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cadence_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"delay_days" integer DEFAULT 0,
	"delay_hours" integer DEFAULT 0,
	"template_id" uuid,
	"content" text,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "cadences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_by" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"duration_seconds" integer DEFAULT 0,
	"disposition" varchar(50),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "campaign_email_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_email_id" uuid NOT NULL,
	"url" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "campaign_email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"campaign_email_id" uuid NOT NULL,
	"prospect_id" uuid,
	"event_type" text NOT NULL,
	"url" text,
	"ip_address" text,
	"user_agent" text,
	"device_type" text,
	"location_country" text,
	"location_city" text,
	"occurred_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "campaign_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"prospect_id" uuid,
	"recipient_email" text NOT NULL,
	"status" text NOT NULL,
	"bounce_type" text,
	"bounce_reason" text,
	"is_test" boolean DEFAULT false,
	"opened" boolean DEFAULT false,
	"clicked" boolean DEFAULT false,
	"opened_at" timestamp with time zone,
	"first_clicked_at" timestamp with time zone,
	"queued_at" timestamp with time zone DEFAULT NOW(),
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "canned_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"shortcut" text,
	"subject" text,
	"content" text NOT NULL,
	"category" text,
	"is_public" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "canned_responses_shortcut_unique" UNIQUE("shortcut")
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"visitor_name" text,
	"visitor_email" text,
	"status" text DEFAULT 'waiting',
	"assigned_to" uuid,
	"assigned_team" uuid,
	"page_url" text NOT NULL,
	"page_title" text,
	"user_agent" text NOT NULL,
	"ip_address" text NOT NULL,
	"country" text,
	"city" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"session_id" text NOT NULL,
	"previous_visits" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT NOW(),
	"ended_at" timestamp with time zone,
	"duration" integer,
	"first_response_time" numeric,
	"avg_response_time" numeric,
	"rating" integer,
	"feedback" text,
	"tags" text[] DEFAULT '{}'::text[]
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'text',
	"sender_id" uuid,
	"sender_name" text NOT NULL,
	"sender_type" text DEFAULT 'visitor',
	"attachments" jsonb,
	"is_ai_generated" boolean DEFAULT false,
	"ai_suggestion" boolean DEFAULT false,
	"sent_at" timestamp with time zone DEFAULT NOW(),
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chat_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"position" text DEFAULT 'bottom-right',
	"primary_color" text DEFAULT '#0078d4',
	"accent_color" text DEFAULT '#ffffff',
	"button_icon" text,
	"button_text" text DEFAULT 'Chat with us',
	"welcome_message" text NOT NULL,
	"offline_message" text NOT NULL,
	"pre_chat_form_enabled" boolean DEFAULT false,
	"pre_chat_fields" jsonb,
	"routing_strategy" text DEFAULT 'round-robin',
	"assign_to_team" uuid,
	"assign_to_users" uuid[],
	"business_hours_only" boolean DEFAULT false,
	"business_hours" jsonb,
	"enable_ai_assist" boolean DEFAULT false,
	"ai_greeting" text,
	"ai_handoff_triggers" text[],
	"allowed_domains" text[],
	"require_email_verification" boolean DEFAULT false,
	"total_conversations" integer DEFAULT 0,
	"avg_response_time" numeric DEFAULT '0',
	"avg_rating" numeric(3, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"industry" varchar(255),
	"website_url" text,
	"company_description" text,
	"mission_statement" text,
	"target_customers" text,
	"spokesperson_enabled" boolean DEFAULT false,
	"intent_score" integer,
	"research_data" jsonb DEFAULT '{}'::jsonb,
	"research_quality_score" integer,
	"buying_signals" jsonb DEFAULT '[]'::jsonb,
	"last_researched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "contact_list_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "contact_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"list_type" text,
	"segment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "contact_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"criteria" jsonb NOT NULL,
	"contact_count" integer DEFAULT 0,
	"last_calculated" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "conversation_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"summary" text,
	"sentiment_score" numeric(5, 2),
	"engagement_score" numeric(5, 2),
	"talk_ratio" jsonb,
	"key_points" text[],
	"action_items" text[],
	"questions_asked" text[],
	"objections" text[],
	"next_steps" text[],
	"meddpicc" jsonb,
	"topics" text[],
	"keywords" text[],
	"pricing_discussed" boolean,
	"budget_mentioned" boolean,
	"ai_recommendations" text[],
	"model_version" varchar(50),
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "conversation_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"segment_number" integer,
	"speaker_role" varchar(50),
	"speaker_name" varchar(255),
	"text" text NOT NULL,
	"start_time" numeric(10, 2),
	"end_time" numeric(10, 2),
	"sentiment" varchar(50),
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"title" varchar(500) NOT NULL,
	"type" varchar(50),
	"duration_seconds" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"analysis_status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "deal_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"role" varchar(255),
	"influence_level" varchar(50),
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"account_id" uuid,
	"owner_id" uuid,
	"team_id" uuid,
	"stage" varchar(50) DEFAULT 'discovery',
	"amount" numeric(15, 2) DEFAULT '0',
	"probability" integer DEFAULT 0,
	"close_date" date,
	"risk_score" integer DEFAULT 0,
	"forecast_category" varchar(50) DEFAULT 'pipeline',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ai_analysis" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_fingerprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"fingerprint_hash" text NOT NULL,
	"device_type" text,
	"browser" text,
	"os" text,
	"is_trusted" boolean DEFAULT false,
	"trusted_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT NOW(),
	"last_ip_address" text,
	"first_seen_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "email_bounces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"bounce_type" text DEFAULT 'hard',
	"reason" text,
	"bounced_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"template_id" uuid,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(50) DEFAULT 'sent',
	"sent_at" timestamp with time zone DEFAULT NOW(),
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"template_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "failed_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"reason" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"prospect_id" uuid,
	"data" jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"page_url" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"submitted_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft',
	"fields" jsonb NOT NULL,
	"submit_button_text" text DEFAULT 'Submit',
	"success_message" text,
	"redirect_url" text,
	"enable_recaptcha" boolean DEFAULT false,
	"require_email_confirmation" boolean DEFAULT false,
	"send_notification" boolean DEFAULT false,
	"notification_recipients" text[],
	"custom_css" text,
	"theme" text,
	"submissions" integer DEFAULT 0,
	"views" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"status" varchar(50) DEFAULT 'pending',
	"invoice_url" text,
	"stripe_invoice_id" varchar(255),
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ip_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"ip_address" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"status" text DEFAULT 'draft',
	"category_id" uuid NOT NULL,
	"tags" text[] DEFAULT '{}'::text[],
	"meta_title" text,
	"meta_description" text,
	"visibility" text DEFAULT 'public',
	"requires_authentication" boolean DEFAULT false,
	"views" integer DEFAULT 0,
	"helpful_votes" integer DEFAULT 0,
	"unhelpful_votes" integer DEFAULT 0,
	"helpfulness_score" numeric(5, 2) DEFAULT '0',
	"author_id" uuid NOT NULL,
	"related_article_ids" uuid[],
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "knowledge_base_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"parent_id" uuid,
	"order" integer DEFAULT 0,
	"visibility" text DEFAULT 'public',
	"article_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "knowledge_base_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"is_helpful" boolean NOT NULL,
	"comment" text,
	"user_id" uuid,
	"email" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"results_count" integer,
	"result_clicked_id" uuid,
	"searched_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"session_id" text,
	"user_id" uuid,
	"ip_address" text,
	"viewed_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" uuid NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "knowledge_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" uuid NOT NULL,
	"url" text NOT NULL,
	"last_crawled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"status" text DEFAULT 'draft',
	"slug" text NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"content" jsonb NOT NULL,
	"custom_html" text,
	"custom_css" text,
	"custom_js" text,
	"template_id" uuid,
	"form_id" uuid,
	"enable_ab_test" boolean DEFAULT false,
	"ab_test_variants" jsonb,
	"views" integer DEFAULT 0,
	"unique_visitors" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2),
	"canonical_url" text,
	"robots_meta" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	"published_at" timestamp with time zone,
	CONSTRAINT "landing_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"subject" text,
	"preheader" text,
	"from_name" text,
	"from_email" text,
	"reply_to" text,
	"html_content" text,
	"text_content" text,
	"segment_id" uuid,
	"contact_list_ids" uuid[],
	"exclude_list_ids" uuid[],
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"ab_test_enabled" boolean DEFAULT false,
	"ab_test_variants" jsonb,
	"track_opens" boolean DEFAULT true,
	"track_clicks" boolean DEFAULT true,
	"stats" jsonb DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0, "complained": 0}'::jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "marketing_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'paused' NOT NULL,
	"trigger" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"allow_multiple_enrollments" boolean DEFAULT false,
	"remove_on_goal_achievement" boolean DEFAULT false,
	"goal_criteria" jsonb,
	"stats" jsonb DEFAULT '{"enrolled": 0, "active": 0, "completed": 0, "goalAchieved": 0}'::jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "mfa_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"method" text NOT NULL,
	"action" text NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "mfa_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"method" text NOT NULL,
	"secret" text,
	"phone_number" text,
	"backup_codes" text[],
	"is_enabled" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mfa_sms_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"phone_number" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "notification_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"notification_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'pending',
	"scheduled_for" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending',
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0,
	"last_error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"channels" jsonb DEFAULT '{"inApp": {"enabled": true}}'::jsonb NOT NULL,
	"min_priority" text DEFAULT 'low',
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_id" uuid,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"icon" text,
	"image_url" text,
	"priority" text DEFAULT 'medium',
	"action_url" text,
	"action_label" text,
	"group_key" text,
	"status" text DEFAULT 'unread',
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"prospect_id" uuid,
	"session_id" text,
	"is_unique" boolean DEFAULT false,
	"ip_address" text,
	"user_agent" text,
	"referrer" text,
	"device_type" text,
	"browser" text,
	"os" text,
	"country" text,
	"city" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"viewed_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"role" varchar(50) DEFAULT 'rep',
	"team_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"email" varchar(255),
	"phone" varchar(50),
	"linkedin_url" text,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"title" varchar(255),
	"company" varchar(255),
	"account_id" uuid,
	"priority_score" integer DEFAULT 0,
	"intent_score" integer,
	"intent_tier" varchar(50),
	"qualification_score" integer,
	"bant_data" jsonb DEFAULT '{}'::jsonb,
	"enrichment_data" jsonb DEFAULT '{}'::jsonb,
	"owner_id" uuid,
	"status" varchar(50) DEFAULT 'new',
	"bdr_assigned" uuid,
	"bdr_workflow_id" text,
	"relationship_stage" varchar(50) DEFAULT 'new',
	"last_contacted_at" timestamp with time zone,
	"last_responded_at" timestamp with time zone,
	"contact_count" integer DEFAULT 0,
	"response_count" integer DEFAULT 0,
	"ai_insights" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"device_name" text,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "rbac_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role_id" uuid,
	"action" text NOT NULL,
	"performed_by" uuid NOT NULL,
	"changes" jsonb,
	"timestamp" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"last_used_at" timestamp with time zone,
	"use_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "search_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"search_time" integer,
	"filters" jsonb,
	"clicked_result_id" text,
	"clicked_result_type" text,
	"clicked_position" integer,
	"searched_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "search_indexing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"total_records" integer DEFAULT 0,
	"indexed_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "search_popular_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"query" text NOT NULL,
	"search_count" integer DEFAULT 1,
	"last_searched_at" timestamp with time zone DEFAULT NOW(),
	"avg_result_count" numeric
);
--> statement-breakpoint
CREATE TABLE "search_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" text NOT NULL,
	"event_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending',
	"retry_count" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "security_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"resource_type" text,
	"resource_id" text,
	"success" boolean NOT NULL,
	"error_message" text,
	"timestamp" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_token" text NOT NULL,
	"refresh_token" text,
	"device_id" text,
	"device_name" text,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"country" text,
	"city" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT NOW(),
	"created_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "slas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"priority" text NOT NULL,
	"first_response_target" integer NOT NULL,
	"resolution_target" integer NOT NULL,
	"business_hours_only" boolean DEFAULT false,
	"business_hours" jsonb,
	"escalation_enabled" boolean DEFAULT false,
	"escalation_after" integer,
	"escalate_to" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "sso_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"action" text NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider_type" varchar(50) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "sso_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"provider" text NOT NULL,
	"session_index" text,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"current_period_start" timestamp with time zone DEFAULT NOW() NOT NULL,
	"current_period_end" timestamp with time zone DEFAULT NOW() + INTERVAL '30 days' NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"token" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "team_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"attachments" text[],
	"author_id" uuid,
	"author_name" text NOT NULL,
	"author_email" text NOT NULL,
	"author_type" text DEFAULT 'agent',
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "ticket_routing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"conditions" jsonb NOT NULL,
	"assign_to" uuid,
	"assign_to_team" uuid,
	"set_priority" text,
	"set_category" text,
	"add_tags" text[],
	"apply_sla" uuid,
	"created_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[],
	"customer_id" uuid,
	"customer_email" text NOT NULL,
	"customer_name" text NOT NULL,
	"assigned_to" uuid,
	"assigned_team" uuid,
	"sla_id" uuid,
	"due_date" timestamp with time zone,
	"first_response_time" numeric,
	"resolution_time" numeric,
	"sla_breached" boolean DEFAULT false,
	"channel" text DEFAULT 'web',
	"last_reply_at" timestamp with time zone,
	"last_reply_by" uuid,
	"satisfaction" text,
	"satisfaction_comment" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"desktop_notifications" boolean DEFAULT true,
	"weekly_digest" boolean DEFAULT true,
	"timezone" varchar(100) DEFAULT 'UTC',
	"language" varchar(10) DEFAULT 'en',
	"theme" varchar(20) DEFAULT 'auto',
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'offline',
	"last_seen" timestamp with time zone DEFAULT NOW(),
	"connections" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role_id" uuid,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"role" varchar(50) DEFAULT 'user',
	"name" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"password_hash" varchar(255),
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" varchar(255),
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW(),
	"updated_at" timestamp with time zone DEFAULT NOW(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflow_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid,
	"enrollment_id" uuid,
	"prospect_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"queued_at" timestamp with time zone DEFAULT NOW(),
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"prospect_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_action_id" text,
	"enrolled_at" timestamp with time zone DEFAULT NOW(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_scheduled_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"prospect_id" uuid NOT NULL,
	"action_id" text NOT NULL,
	"execute_at" timestamp with time zone NOT NULL,
	"executed" boolean DEFAULT false,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_sessions" ADD CONSTRAINT "ai_agent_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_playground_experiments" ADD CONSTRAINT "ai_playground_experiments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_playground_experiments" ADD CONSTRAINT "ai_playground_experiments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_activities" ADD CONSTRAINT "bdr_activities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_activities" ADD CONSTRAINT "bdr_activities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_activities" ADD CONSTRAINT "bdr_activities_task_id_bdr_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."bdr_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_activities" ADD CONSTRAINT "bdr_activities_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_agent_configs" ADD CONSTRAINT "bdr_agent_configs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_approval_queue" ADD CONSTRAINT "bdr_approval_queue_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_approval_queue" ADD CONSTRAINT "bdr_approval_queue_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_approval_queue" ADD CONSTRAINT "bdr_approval_queue_task_id_bdr_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."bdr_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_approval_queue" ADD CONSTRAINT "bdr_approval_queue_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_context_memory" ADD CONSTRAINT "bdr_context_memory_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_context_memory" ADD CONSTRAINT "bdr_context_memory_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_decisions" ADD CONSTRAINT "bdr_decisions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_decisions" ADD CONSTRAINT "bdr_decisions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_decisions" ADD CONSTRAINT "bdr_decisions_task_id_bdr_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."bdr_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_handoffs" ADD CONSTRAINT "bdr_handoffs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_handoffs" ADD CONSTRAINT "bdr_handoffs_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_handoffs" ADD CONSTRAINT "bdr_handoffs_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_handoffs" ADD CONSTRAINT "bdr_handoffs_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_performance_metrics" ADD CONSTRAINT "bdr_performance_metrics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_performance_metrics" ADD CONSTRAINT "bdr_performance_metrics_agent_config_id_bdr_agent_configs_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."bdr_agent_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_tasks" ADD CONSTRAINT "bdr_tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_tasks" ADD CONSTRAINT "bdr_tasks_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_tasks" ADD CONSTRAINT "bdr_tasks_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_workflow_executions" ADD CONSTRAINT "bdr_workflow_executions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bdr_workflow_executions" ADD CONSTRAINT "bdr_workflow_executions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_enrollments" ADD CONSTRAINT "cadence_enrollments_cadence_id_cadences_id_fk" FOREIGN KEY ("cadence_id") REFERENCES "public"."cadences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_enrollments" ADD CONSTRAINT "cadence_enrollments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_steps" ADD CONSTRAINT "cadence_steps_cadence_id_cadences_id_fk" FOREIGN KEY ("cadence_id") REFERENCES "public"."cadences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadence_steps" ADD CONSTRAINT "cadence_steps_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadences" ADD CONSTRAINT "cadences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cadences" ADD CONSTRAINT "cadences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_email_clicks" ADD CONSTRAINT "campaign_email_clicks_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_email_clicks" ADD CONSTRAINT "campaign_email_clicks_campaign_email_id_campaign_emails_id_fk" FOREIGN KEY ("campaign_email_id") REFERENCES "public"."campaign_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_email_events" ADD CONSTRAINT "campaign_email_events_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_email_events" ADD CONSTRAINT "campaign_email_events_campaign_email_id_campaign_emails_id_fk" FOREIGN KEY ("campaign_email_id") REFERENCES "public"."campaign_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_email_events" ADD CONSTRAINT "campaign_email_events_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_emails" ADD CONSTRAINT "campaign_emails_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_emails" ADD CONSTRAINT "campaign_emails_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_team_teams_id_fk" FOREIGN KEY ("assigned_team") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_widgets" ADD CONSTRAINT "chat_widgets_assign_to_team_teams_id_fk" FOREIGN KEY ("assign_to_team") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_list_id_contact_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."contact_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_segment_id_contact_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."contact_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_segments" ADD CONSTRAINT "contact_segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_transcripts" ADD CONSTRAINT "conversation_transcripts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_contacts" ADD CONSTRAINT "deal_contacts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_whitelist" ADD CONSTRAINT "ip_whitelist_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ip_whitelist" ADD CONSTRAINT "ip_whitelist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_category_id_knowledge_base_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_base_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_attachments" ADD CONSTRAINT "knowledge_base_attachments_article_id_knowledge_base_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_base_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_attachments" ADD CONSTRAINT "knowledge_base_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_categories" ADD CONSTRAINT "knowledge_base_categories_parent_id_knowledge_base_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."knowledge_base_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_feedback" ADD CONSTRAINT "knowledge_base_feedback_article_id_knowledge_base_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_base_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_feedback" ADD CONSTRAINT "knowledge_base_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_searches" ADD CONSTRAINT "knowledge_base_searches_result_clicked_id_knowledge_base_articles_id_fk" FOREIGN KEY ("result_clicked_id") REFERENCES "public"."knowledge_base_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_views" ADD CONSTRAINT "knowledge_base_views_article_id_knowledge_base_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_base_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_views" ADD CONSTRAINT "knowledge_base_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_websites" ADD CONSTRAINT "knowledge_websites_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_contact_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."contact_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_workflows" ADD CONSTRAINT "marketing_workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_audit_log" ADD CONSTRAINT "mfa_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_configurations" ADD CONSTRAINT "mfa_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_sms_codes" ADD CONSTRAINT "mfa_sms_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_batches" ADD CONSTRAINT "notification_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_bdr_assigned_users_id_fk" FOREIGN KEY ("bdr_assigned") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_audit_log" ADD CONSTRAINT "rbac_audit_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_popular_queries" ADD CONSTRAINT "search_popular_queries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_log" ADD CONSTRAINT "security_audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_log" ADD CONSTRAINT "security_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_routing_rules" ADD CONSTRAINT "ticket_routing_rules_assign_to_users_id_fk" FOREIGN KEY ("assign_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_routing_rules" ADD CONSTRAINT "ticket_routing_rules_assign_to_team_teams_id_fk" FOREIGN KEY ("assign_to_team") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_routing_rules" ADD CONSTRAINT "ticket_routing_rules_apply_sla_slas_id_fk" FOREIGN KEY ("apply_sla") REFERENCES "public"."slas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_prospects_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_team_teams_id_fk" FOREIGN KEY ("assigned_team") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_id_slas_id_fk" FOREIGN KEY ("sla_id") REFERENCES "public"."slas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_last_reply_by_users_id_fk" FOREIGN KEY ("last_reply_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_emails" ADD CONSTRAINT "workflow_emails_workflow_id_marketing_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."marketing_workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_emails" ADD CONSTRAINT "workflow_emails_enrollment_id_workflow_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."workflow_enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_emails" ADD CONSTRAINT "workflow_emails_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_workflow_id_marketing_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."marketing_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_enrollments" ADD CONSTRAINT "workflow_enrollments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_scheduled_actions" ADD CONSTRAINT "workflow_scheduled_actions_workflow_id_marketing_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."marketing_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_scheduled_actions" ADD CONSTRAINT "workflow_scheduled_actions_enrollment_id_workflow_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."workflow_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_scheduled_actions" ADD CONSTRAINT "workflow_scheduled_actions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;