import { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, jsonb, serial, vector, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =============================================
// ORGANIZATIONS & TEAMS
// =============================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  settings: jsonb('settings').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// USERS & AUTHENTICATION
// =============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  role: varchar('role', { length: 50 }).default('user'),
  name: varchar('name', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'),
  passwordHash: varchar('password_hash', { length: 255 }),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('rep'),
  teamId: uuid('team_id').references(() => teams.id),
  settings: jsonb('settings').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const ssoProviders = pgTable('sso_providers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  providerType: varchar('provider_type', { length: 50 }).notNull(),
  providerName: varchar('provider_name', { length: 255 }).notNull(),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// SAAS FEATURES
// =============================================

export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
  prefix: varchar('prefix', { length: 20 }).notNull(),
  scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('active'),
  requestCount: integer('request_count').default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  status: varchar('status', { length: 50 }).default('active'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull().default(sql`NOW()`),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull().default(sql`NOW() + INTERVAL '30 days'`),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD'),
  status: varchar('status', { length: 50 }).default('unpaid'),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  invoicePdf: text('invoice_pdf'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  emailNotifications: boolean('email_notifications').default(true),
  desktopNotifications: boolean('desktop_notifications').default(true),
  weeklyDigest: boolean('weekly_digest').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// CRM - PROSPECTS & DEALS
// =============================================

export const prospects = pgTable('prospects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  linkedinUrl: text('linkedin_url'),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  title: varchar('title', { length: 255 }),
  company: varchar('company', { length: 255 }),
  accountId: uuid('account_id'),
  priorityScore: integer('priority_score').default(0),
  intentScore: integer('intent_score'),
  intentTier: varchar('intent_tier', { length: 50 }),
  enrichmentData: jsonb('enrichment_data').default(sql`'{}'::jsonb`),
  ownerId: uuid('owner_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('new'),
  bdrAssigned: uuid('bdr_assigned').references(() => users.id),
  bdrWorkflowId: uuid('bdr_workflow_id'),
  relationshipStage: varchar('relationship_stage', { length: 50 }),
  aiInsights: jsonb('ai_insights').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  industry: varchar('industry', { length: 255 }),
  employeeCount: integer('employee_count'),
  annualRevenue: decimal('annual_revenue', { precision: 15, scale: 2 }),
  teamId: uuid('team_id').references(() => teams.id),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id),
  ownerId: uuid('owner_id').references(() => users.id),
  teamId: uuid('team_id').references(() => teams.id),
  stage: varchar('stage', { length: 50 }).default('discovery'),
  amount: decimal('amount', { precision: 15, scale: 2 }).default('0'),
  probability: integer('probability').default(0),
  closeDate: date('close_date'),
  riskScore: integer('risk_score').default(0),
  forecastCategory: varchar('forecast_category', { length: 50 }).default('pipeline'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  aiAnalysis: jsonb('ai_analysis').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const dealContacts = pgTable('deal_contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 255 }),
  influenceLevel: varchar('influence_level', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 255 }),
  websiteUrl: text('website_url'),
  companyDescription: text('company_description'),
  missionStatement: text('mission_statement'),
  targetCustomers: text('target_customers'),
  spokespersonEnabled: boolean('spokesperson_enabled').default(false),
  researchData: jsonb('research_data').default(sql`'{}'::jsonb`),
  researchQualityScore: integer('research_quality_score'),
  buyingSignals: jsonb('buying_signals').default(sql`'[]'::jsonb`),
  lastResearchedAt: timestamp('last_researched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// OUTREACH & ENGAGEMENT
// =============================================

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const cadences = pgTable('cadences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdBy: uuid('created_by').references(() => users.id),
  settings: jsonb('settings').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const cadenceSteps = pgTable('cadence_steps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  cadenceId: uuid('cadence_id').notNull().references(() => cadences.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  delayDays: integer('delay_days').default(0),
  delayHours: integer('delay_hours').default(0),
  templateId: uuid('template_id').references(() => emailTemplates.id),
  content: text('content'),
  conditions: jsonb('conditions').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const cadenceEnrollments = pgTable('cadence_enrollments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  cadenceId: uuid('cadence_id').notNull().references(() => cadences.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('active'),
  currentStep: integer('current_step').default(0),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).default(sql`NOW()`),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const callLogs = pgTable('call_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  durationSeconds: integer('duration_seconds').default(0),
  disposition: varchar('disposition', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const emailLogs = pgTable('email_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => emailTemplates.id),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 50 }).default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).default(sql`NOW()`),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
});

export const emailSends = pgTable('email_sends', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => emailTemplates.id),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// AI & INTELLIGENCE
// =============================================

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  type: varchar('type', { length: 50 }),
  durationSeconds: integer('duration_seconds').default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  analysisStatus: varchar('analysis_status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const conversationTranscripts = pgTable('conversation_transcripts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  segmentNumber: integer('segment_number'),
  speakerRole: varchar('speaker_role', { length: 50 }),
  speakerName: varchar('speaker_name', { length: 255 }),
  text: text('text').notNull(),
  startTime: decimal('start_time', { precision: 10, scale: 2 }),
  endTime: decimal('end_time', { precision: 10, scale: 2 }),
  sentiment: varchar('sentiment', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const conversationInsights = pgTable('conversation_insights', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  summary: text('summary'),
  sentimentScore: decimal('sentiment_score', { precision: 5, scale: 2 }),
  engagementScore: decimal('engagement_score', { precision: 5, scale: 2 }),
  talkRatio: jsonb('talk_ratio'),
  keyPoints: text('key_points').array(),
  actionItems: text('action_items').array(),
  questionsAsked: text('questions_asked').array(),
  objections: text('objections').array(),
  nextSteps: text('next_steps').array(),
  meddpicc: jsonb('meddpicc'),
  topics: text('topics').array(),
  keywords: text('keywords').array(),
  pricingDiscussed: boolean('pricing_discussed'),
  budgetMentioned: boolean('budget_mentioned'),
  aiRecommendations: text('ai_recommendations').array(),
  modelVersion: varchar('model_version', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const aiAgentSessions = pgTable('ai_agent_sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  conversationHistory: jsonb('conversation_history').default(sql`'[]'::jsonb`),
  actionsTaken: jsonb('actions_taken').default(sql`'[]'::jsonb`),
  outcome: text('outcome'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const aiPlaygroundExperiments = pgTable('ai_playground_experiments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  experimentName: varchar('experiment_name', { length: 255 }).notNull(),
  prompt: text('prompt').notNull(),
  systemPrompt: text('system_prompt'),
  modelsTested: jsonb('models_tested').default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const aiPredictions = pgTable('ai_predictions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: uuid('entity_id'),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  predictionType: varchar('prediction_type', { length: 100 }).notNull(),
  score: decimal('score', { precision: 5, scale: 2 }),
  confidence: decimal('confidence', { precision: 5, scale: 2 }),
  reasoning: jsonb('reasoning').default(sql`'{}'::jsonb`),
  modelVersion: varchar('model_version', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// KNOWLEDGE BASE
// =============================================

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: uuid('company_profile_id').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeWebsites = pgTable('knowledge_websites', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: uuid('company_profile_id').notNull().references(() => companyProfiles.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  lastCrawledAt: timestamp('last_crawled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

// Export insert schemas using drizzle-zod
export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProspectSchema = createInsertSchema(prospects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCadenceSchema = createInsertSchema(cadences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });

// Export types
export type Organization = typeof organizations.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type Cadence = typeof cadences.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsight = typeof conversationInsights.$inferSelect;
export type AiPrediction = typeof aiPredictions.$inferSelect;

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type InsertCadence = z.infer<typeof insertCadenceSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
