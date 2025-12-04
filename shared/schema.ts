import { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, jsonb, serial, vector, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =============================================
// ORGANIZATIONS & TEAMS
// =============================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique(),
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
  configuration: jsonb('configuration').notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').default(true),
  lastUsed: timestamp('last_used', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const ssoSessions = pgTable('sso_sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  sessionIndex: text('session_index'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const ssoAuditLog = pgTable('sso_audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id'),
  userId: uuid('user_id'),
  provider: text('provider').notNull(),
  action: text('action').notNull(),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// RBAC (Role-Based Access Control)
// =============================================

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  permissions: text('permissions').array().notNull().default(sql`ARRAY[]::text[]`),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').references(() => roles.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).default(sql`NOW()`),
});

export const rbacAuditLog = pgTable('rbac_audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id'),
  roleId: uuid('role_id'),
  action: text('action').notNull(),
  performedBy: uuid('performed_by').notNull().references(() => users.id),
  changes: jsonb('changes'),
  timestamp: timestamp('timestamp', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// MFA (Multi-Factor Authentication)
// =============================================

export const mfaConfigurations = pgTable('mfa_configurations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  secret: text('secret'),
  phoneNumber: text('phone_number'),
  backupCodes: text('backup_codes').array(),
  isEnabled: boolean('is_enabled').default(false),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});

export const mfaSmsCodes = pgTable('mfa_sms_codes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const mfaAuditLog = pgTable('mfa_audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  action: text('action').notNull(),
  success: boolean('success').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// SECURITY
// =============================================

export const securityAuditLog = pgTable('security_audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp', { withTimezone: true }).default(sql`NOW()`),
});

export const failedLoginAttempts = pgTable('failed_login_attempts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  reason: text('reason').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).default(sql`NOW()`),
});

export const ipWhitelist = pgTable('ip_whitelist', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  createdBy: uuid('created_by').references(() => users.id),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  refreshToken: text('refresh_token').unique(),
  deviceId: text('device_id'),
  deviceName: text('device_name'),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  country: text('country'),
  city: text('city'),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).default(sql`NOW()`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const deviceFingerprints = pgTable('device_fingerprints', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fingerprintHash: text('fingerprint_hash').notNull(),
  deviceType: text('device_type'),
  browser: text('browser'),
  os: text('os'),
  isTrusted: boolean('is_trusted').default(false),
  trustedAt: timestamp('trusted_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).default(sql`NOW()`),
  lastIpAddress: text('last_ip_address'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).default(sql`NOW()`),
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
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
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
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
  status: varchar('status', { length: 50 }).default('pending'),
  invoiceUrl: text('invoice_url'),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  emailNotifications: boolean('email_notifications').default(true),
  desktopNotifications: boolean('desktop_notifications').default(true),
  weeklyDigest: boolean('weekly_digest').default(true),
  timezone: varchar('timezone', { length: 100 }).default('UTC'),
  language: varchar('language', { length: 10 }).default('en'),
  theme: varchar('theme', { length: 20 }).default('auto'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// CRM - PROSPECTS & DEALS
// =============================================

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
  accountId: uuid('account_id').references(() => accounts.id),
  priorityScore: integer('priority_score').default(0),
  intentScore: integer('intent_score'),
  intentTier: varchar('intent_tier', { length: 50 }),
  qualificationScore: integer('qualification_score'),
  bantData: jsonb('bant_data').default(sql`'{}'::jsonb`),
  enrichmentData: jsonb('enrichment_data').default(sql`'{}'::jsonb`),
  ownerId: uuid('owner_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('new'),
  bdrAssigned: uuid('bdr_assigned').references(() => users.id),
  bdrWorkflowId: text('bdr_workflow_id'),
  relationshipStage: varchar('relationship_stage', { length: 50 }).default('new'),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  lastRespondedAt: timestamp('last_responded_at', { withTimezone: true }),
  contactCount: integer('contact_count').default(0),
  responseCount: integer('response_count').default(0),
  aiInsights: jsonb('ai_insights').default(sql`'{}'::jsonb`),
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
  intentScore: integer('intent_score'),
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
// BDR AGENT SYSTEM
// =============================================

export const bdrAgentConfigs = pgTable('bdr_agent_configs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  agentName: text('agent_name').notNull().default('BDR Agent'),
  isActive: boolean('is_active').default(true),
  autoApproveMessages: boolean('auto_approve_messages').default(false),
  requireHumanReview: boolean('require_human_review').default(true),
  maxDailyTouches: integer('max_daily_touches').default(50),
  maxTouchesPerProspect: integer('max_touches_per_prospect').default(5),
  minDelayBetweenTouchesHours: integer('min_delay_between_touches_hours').default(48),
  discoveryEnabled: boolean('discovery_enabled').default(true),
  discoveryIntervalMinutes: integer('discovery_interval_minutes').default(60),
  minIntentScore: integer('min_intent_score').default(50),
  maxNewProspectsPerDay: integer('max_new_prospects_per_day').default(20),
  preferredChannels: text('preferred_channels').array().default(sql`ARRAY['email']`),
  linkedinEnabled: boolean('linkedin_enabled').default(false),
  phoneEnabled: boolean('phone_enabled').default(false),
  qualificationFramework: text('qualification_framework').default('BANT'),
  autoQualifyThreshold: integer('auto_qualify_threshold').default(70),
  handoffThreshold: integer('handoff_threshold').default(90),
  enableLearning: boolean('enable_learning').default(true),
  abTestingEnabled: boolean('ab_testing_enabled').default(false),
  workingHours: jsonb('working_hours').default(sql`'{"timezone": "America/New_York", "start_hour": 9, "end_hour": 17, "days": [1,2,3,4,5]}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrTasks = pgTable('bdr_tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  companyProfileId: uuid('company_profile_id').references(() => companyProfiles.id, { onDelete: 'cascade' }),
  taskType: text('task_type').notNull(),
  status: text('status').notNull().default('pending'),
  priority: integer('priority').default(5),
  config: jsonb('config').default(sql`'{}'::jsonb`),
  workflowId: text('workflow_id'),
  workflowStep: integer('workflow_step'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  result: jsonb('result'),
  error: text('error'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrActivities = pgTable('bdr_activities', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => bdrTasks.id, { onDelete: 'set null' }),
  activityType: text('activity_type').notNull(),
  channel: text('channel'),
  direction: text('direction'),
  subject: text('subject'),
  messagePreview: text('message_preview'),
  fullContent: text('full_content'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  wasAutomated: boolean('was_automated').default(true),
  requiredApproval: boolean('required_approval').default(false),
  approvedBy: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrContextMemory = pgTable('bdr_context_memory', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }).unique(),
  researchData: jsonb('research_data').default(sql`'{}'::jsonb`),
  conversationHistory: jsonb('conversation_history').default(sql`'[]'::jsonb`),
  preferences: jsonb('preferences').default(sql`'{}'::jsonb`),
  objections: jsonb('objections').default(sql`'[]'::jsonb`),
  intentSignals: jsonb('intent_signals').default(sql`'[]'::jsonb`),
  relationshipStage: text('relationship_stage').default('cold'),
  lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
  lastResponseAt: timestamp('last_response_at', { withTimezone: true }),
  contactCount: integer('contact_count').default(0),
  responseCount: integer('response_count').default(0),
  sentimentScore: decimal('sentiment_score', { precision: 3, scale: 2 }),
  engagementScore: integer('engagement_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrDecisions = pgTable('bdr_decisions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => bdrTasks.id, { onDelete: 'set null' }),
  decisionType: text('decision_type').notNull(),
  decisionContext: jsonb('decision_context').notNull().default(sql`'{}'::jsonb`),
  recommendedAction: text('recommended_action').notNull(),
  reasoning: text('reasoning').notNull(),
  confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(),
  alternatives: jsonb('alternatives').default(sql`'[]'::jsonb`),
  wasExecuted: boolean('was_executed').default(false),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  outcome: text('outcome'),
  outcomeData: jsonb('outcome_data').default(sql`'{}'::jsonb`),
  feedbackScore: integer('feedback_score'),
  humanOverride: boolean('human_override').default(false),
  overrideReason: text('override_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrHandoffs = pgTable('bdr_handoffs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  companyProfileId: uuid('company_profile_id').references(() => companyProfiles.id, { onDelete: 'cascade' }),
  handoffType: text('handoff_type').notNull(),
  priority: text('priority').default('medium'),
  qualificationScore: integer('qualification_score'),
  bantBreakdown: jsonb('bant_breakdown').default(sql`'{}'::jsonb`),
  executiveSummary: text('executive_summary').notNull(),
  keyInsights: jsonb('key_insights').default(sql`'[]'::jsonb`),
  conversationSummary: text('conversation_summary'),
  suggestedNextSteps: jsonb('suggested_next_steps').default(sql`'[]'::jsonb`),
  assignedTo: uuid('assigned_to').references(() => profiles.id, { onDelete: 'set null' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  status: text('status').default('pending'),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  handlerNotes: text('handler_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrApprovalQueue = pgTable('bdr_approval_queue', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => bdrTasks.id, { onDelete: 'cascade' }),
  approvalType: text('approval_type').notNull(),
  subject: text('subject'),
  messageBody: text('message_body').notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  aiReasoning: text('ai_reasoning'),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  status: text('status').default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  modifiedContent: text('modified_content'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(sql`NOW() + INTERVAL '24 hours'`),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrWorkflowExecutions = pgTable('bdr_workflow_executions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'cascade' }),
  workflowId: text('workflow_id').notNull(),
  workflowName: text('workflow_name').notNull(),
  currentStep: integer('current_step').notNull().default(1),
  totalSteps: integer('total_steps').notNull(),
  status: text('status').default('active'),
  executionContext: jsonb('execution_context').default(sql`'{}'::jsonb`),
  completedSteps: integer('completed_steps').array().default(sql`ARRAY[]::integer[]`),
  startedAt: timestamp('started_at', { withTimezone: true }).default(sql`NOW()`),
  lastExecutedAt: timestamp('last_executed_at', { withTimezone: true }),
  nextExecutionAt: timestamp('next_execution_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalTouches: integer('total_touches').default(0),
  responsesReceived: integer('responses_received').default(0),
  meetingsScheduled: integer('meetings_scheduled').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const bdrPerformanceMetrics = pgTable('bdr_performance_metrics', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  agentConfigId: uuid('agent_config_id').references(() => bdrAgentConfigs.id, { onDelete: 'cascade' }),
  metricDate: date('metric_date').notNull().default(sql`CURRENT_DATE`),
  prospectsDiscovered: integer('prospects_discovered').default(0),
  emailsSent: integer('emails_sent').default(0),
  linkedinMessages: integer('linkedin_messages').default(0),
  phoneCalls: integer('phone_calls').default(0),
  emailOpens: integer('email_opens').default(0),
  emailClicks: integer('email_clicks').default(0),
  repliesReceived: integer('replies_received').default(0),
  conversationsStarted: integer('conversations_started').default(0),
  meetingsScheduled: integer('meetings_scheduled').default(0),
  prospectsQualified: integer('prospects_qualified').default(0),
  prospectsHandedOff: integer('prospects_handed_off').default(0),
  avgQualificationScore: decimal('avg_qualification_score', { precision: 5, scale: 2 }),
  tasksCompleted: integer('tasks_completed').default(0),
  tasksFailed: integer('tasks_failed').default(0),
  avgTaskDurationSeconds: integer('avg_task_duration_seconds'),
  pipelineGeneratedUsd: decimal('pipeline_generated_usd', { precision: 12, scale: 2 }).default('0'),
  dealsClosed: integer('deals_closed').default(0),
  revenueGeneratedUsd: decimal('revenue_generated_usd', { precision: 12, scale: 2 }).default('0'),
  emailResponseRate: decimal('email_response_rate', { precision: 5, scale: 2 }),
  linkedinResponseRate: decimal('linkedin_response_rate', { precision: 5, scale: 2 }),
  overallResponseRate: decimal('overall_response_rate', { precision: 5, scale: 2 }),
  decisionAccuracy: decimal('decision_accuracy', { precision: 5, scale: 2 }),
  humanOverrides: integer('human_overrides').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
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

// =============================================
// MARKETING HUB
// =============================================

export const contactSegments = pgTable('contact_segments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(),
  contactCount: integer('contact_count').default(0),
  lastCalculated: timestamp('last_calculated', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  subject: text('subject'),
  preheader: text('preheader'),
  fromName: text('from_name'),
  fromEmail: text('from_email'),
  replyTo: text('reply_to'),
  htmlContent: text('html_content'),
  textContent: text('text_content'),
  segmentId: uuid('segment_id').references(() => contactSegments.id, { onDelete: 'set null' }),
  contactListIds: uuid('contact_list_ids').array(),
  excludeListIds: uuid('exclude_list_ids').array(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  abTestEnabled: boolean('ab_test_enabled').default(false),
  abTestVariants: jsonb('ab_test_variants'),
  trackOpens: boolean('track_opens').default(true),
  trackClicks: boolean('track_clicks').default(true),
  stats: jsonb('stats').default(sql`'{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "unsubscribed": 0, "complained": 0}'::jsonb`),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const contactLists = pgTable('contact_lists', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  listType: text('list_type'),
  segmentId: uuid('segment_id').references(() => contactSegments.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const contactListMembers = pgTable('contact_list_members', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  listId: uuid('list_id').notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).default(sql`NOW()`),
});

export const campaignEmails = pgTable('campaign_emails', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  campaignId: uuid('campaign_id').notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  recipientEmail: text('recipient_email').notNull(),
  status: text('status').notNull(),
  bounceType: text('bounce_type'),
  bounceReason: text('bounce_reason'),
  isTest: boolean('is_test').default(false),
  opened: boolean('opened').default(false),
  clicked: boolean('clicked').default(false),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  firstClickedAt: timestamp('first_clicked_at', { withTimezone: true }),
  queuedAt: timestamp('queued_at', { withTimezone: true }).default(sql`NOW()`),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
});

export const campaignEmailEvents = pgTable('campaign_email_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  campaignId: uuid('campaign_id').notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  campaignEmailId: uuid('campaign_email_id').notNull().references(() => campaignEmails.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  url: text('url'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceType: text('device_type'),
  locationCountry: text('location_country'),
  locationCity: text('location_city'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).default(sql`NOW()`),
});

export const campaignEmailClicks = pgTable('campaign_email_clicks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  campaignId: uuid('campaign_id').notNull().references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  campaignEmailId: uuid('campaign_email_id').notNull().references(() => campaignEmails.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  clickedAt: timestamp('clicked_at', { withTimezone: true }).default(sql`NOW()`),
});

export const marketingWorkflows = pgTable('marketing_workflows', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('paused'),
  trigger: jsonb('trigger').notNull(),
  actions: jsonb('actions').notNull(),
  allowMultipleEnrollments: boolean('allow_multiple_enrollments').default(false),
  removeOnGoalAchievement: boolean('remove_on_goal_achievement').default(false),
  goalCriteria: jsonb('goal_criteria'),
  stats: jsonb('stats').default(sql`'{"enrolled": 0, "active": 0, "completed": 0, "goalAchieved": 0}'::jsonb`),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const workflowEnrollments = pgTable('workflow_enrollments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: uuid('workflow_id').notNull().references(() => marketingWorkflows.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  currentActionId: text('current_action_id'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).default(sql`NOW()`),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const workflowEmails = pgTable('workflow_emails', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: uuid('workflow_id').references(() => marketingWorkflows.id, { onDelete: 'set null' }),
  enrollmentId: uuid('enrollment_id').references(() => workflowEnrollments.id, { onDelete: 'set null' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'),
  status: text('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  queuedAt: timestamp('queued_at', { withTimezone: true }).default(sql`NOW()`),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

export const workflowScheduledActions = pgTable('workflow_scheduled_actions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  workflowId: uuid('workflow_id').notNull().references(() => marketingWorkflows.id, { onDelete: 'cascade' }),
  enrollmentId: uuid('enrollment_id').references(() => workflowEnrollments.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').notNull().references(() => prospects.id, { onDelete: 'cascade' }),
  actionId: text('action_id').notNull(),
  executeAt: timestamp('execute_at', { withTimezone: true }).notNull(),
  executed: boolean('executed').default(false),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});

export const forms = pgTable('forms', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').default('draft'),
  fields: jsonb('fields').notNull(),
  submitButtonText: text('submit_button_text').default('Submit'),
  successMessage: text('success_message'),
  redirectUrl: text('redirect_url'),
  enableRecaptcha: boolean('enable_recaptcha').default(false),
  requireEmailConfirmation: boolean('require_email_confirmation').default(false),
  sendNotification: boolean('send_notification').default(false),
  notificationRecipients: text('notification_recipients').array(),
  customCss: text('custom_css'),
  theme: text('theme'),
  submissions: integer('submissions').default(0),
  views: integer('views').default(0),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  formId: uuid('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  data: jsonb('data').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  pageUrl: text('page_url'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'),
  utmTerm: text('utm_term'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).default(sql`NOW()`),
});

export const landingPages = pgTable('landing_pages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  title: text('title'),
  description: text('description'),
  status: text('status').default('draft'),
  slug: text('slug').notNull().unique(),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  content: jsonb('content').notNull(),
  customHtml: text('custom_html'),
  customCss: text('custom_css'),
  customJs: text('custom_js'),
  templateId: uuid('template_id'),
  formId: uuid('form_id').references(() => forms.id, { onDelete: 'set null' }),
  enableAbTest: boolean('enable_ab_test').default(false),
  abTestVariants: jsonb('ab_test_variants'),
  views: integer('views').default(0),
  uniqueVisitors: integer('unique_visitors').default(0),
  conversions: integer('conversions').default(0),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  canonicalUrl: text('canonical_url'),
  robotsMeta: text('robots_meta'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});

export const pageViews = pgTable('page_views', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  pageId: uuid('page_id').notNull().references(() => landingPages.id, { onDelete: 'cascade' }),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  sessionId: text('session_id'),
  isUnique: boolean('is_unique').default(false),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  referrer: text('referrer'),
  deviceType: text('device_type'),
  browser: text('browser'),
  os: text('os'),
  country: text('country'),
  city: text('city'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// SERVICE HUB
// =============================================

export const slas = pgTable('slas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  priority: text('priority').notNull(),
  firstResponseTarget: integer('first_response_target').notNull(),
  resolutionTarget: integer('resolution_target').notNull(),
  businessHoursOnly: boolean('business_hours_only').default(false),
  businessHours: jsonb('business_hours'),
  escalationEnabled: boolean('escalation_enabled').default(false),
  escalationAfter: integer('escalation_after'),
  escalateTo: text('escalate_to'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text('ticket_number').unique().notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('new'),
  priority: text('priority').notNull().default('normal'),
  category: text('category'),
  tags: text('tags').array().default(sql`'{}'::text[]`),
  customerId: uuid('customer_id').references(() => prospects.id, { onDelete: 'set null' }),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  assignedTeam: uuid('assigned_team').references(() => teams.id, { onDelete: 'set null' }),
  slaId: uuid('sla_id').references(() => slas.id),
  dueDate: timestamp('due_date', { withTimezone: true }),
  firstResponseTime: decimal('first_response_time'),
  resolutionTime: decimal('resolution_time'),
  slaBreached: boolean('sla_breached').default(false),
  channel: text('channel').default('web'),
  lastReplyAt: timestamp('last_reply_at', { withTimezone: true }),
  lastReplyBy: uuid('last_reply_by').references(() => users.id, { onDelete: 'set null' }),
  satisfaction: text('satisfaction'),
  satisfactionComment: text('satisfaction_comment'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const ticketReplies = pgTable('ticket_replies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').default(false),
  attachments: text('attachments').array(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  authorType: text('author_type').default('agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const ticketRoutingRules = pgTable('ticket_routing_rules', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  priority: integer('priority').default(0),
  isActive: boolean('is_active').default(true),
  conditions: jsonb('conditions').notNull(),
  assignTo: uuid('assign_to').references(() => users.id, { onDelete: 'set null' }),
  assignToTeam: uuid('assign_to_team').references(() => teams.id, { onDelete: 'set null' }),
  setPriority: text('set_priority'),
  setCategory: text('set_category'),
  addTags: text('add_tags').array(),
  applySla: uuid('apply_sla').references(() => slas.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const cannedResponses = pgTable('canned_responses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  shortcut: text('shortcut').unique(),
  subject: text('subject'),
  content: text('content').notNull(),
  category: text('category'),
  isPublic: boolean('is_public').default(true),
  usageCount: integer('usage_count').default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseCategories = pgTable('knowledge_base_categories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  icon: text('icon'),
  parentId: uuid('parent_id').references((): any => knowledgeBaseCategories.id, { onDelete: 'cascade' }),
  order: integer('order').default(0),
  visibility: text('visibility').default('public'),
  articleCount: integer('article_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseArticles = pgTable('knowledge_base_articles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  slug: text('slug').unique().notNull(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  status: text('status').default('draft'),
  categoryId: uuid('category_id').notNull().references(() => knowledgeBaseCategories.id, { onDelete: 'cascade' }),
  tags: text('tags').array().default(sql`'{}'::text[]`),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  visibility: text('visibility').default('public'),
  requiresAuthentication: boolean('requires_authentication').default(false),
  views: integer('views').default(0),
  helpfulVotes: integer('helpful_votes').default(0),
  unhelpfulVotes: integer('unhelpful_votes').default(0),
  helpfulnessScore: decimal('helpfulness_score', { precision: 5, scale: 2 }).default('0'),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  relatedArticleIds: uuid('related_article_ids').array(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseViews = pgTable('knowledge_base_views', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  articleId: uuid('article_id').notNull().references(() => knowledgeBaseArticles.id, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseFeedback = pgTable('knowledge_base_feedback', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  articleId: uuid('article_id').notNull().references(() => knowledgeBaseArticles.id, { onDelete: 'cascade' }),
  isHelpful: boolean('is_helpful').notNull(),
  comment: text('comment'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseAttachments = pgTable('knowledge_base_attachments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  articleId: uuid('article_id').notNull().references(() => knowledgeBaseArticles.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const knowledgeBaseSearches = pgTable('knowledge_base_searches', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  query: text('query').notNull(),
  resultsCount: integer('results_count'),
  resultClickedId: uuid('result_clicked_id').references(() => knowledgeBaseArticles.id, { onDelete: 'set null' }),
  searchedAt: timestamp('searched_at', { withTimezone: true }).default(sql`NOW()`),
});

export const chatWidgets = pgTable('chat_widgets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true),
  position: text('position').default('bottom-right'),
  primaryColor: text('primary_color').default('#0078d4'),
  accentColor: text('accent_color').default('#ffffff'),
  buttonIcon: text('button_icon'),
  buttonText: text('button_text').default('Chat with us'),
  welcomeMessage: text('welcome_message').notNull(),
  offlineMessage: text('offline_message').notNull(),
  preChatFormEnabled: boolean('pre_chat_form_enabled').default(false),
  preChatFields: jsonb('pre_chat_fields'),
  routingStrategy: text('routing_strategy').default('round-robin'),
  assignToTeam: uuid('assign_to_team').references(() => teams.id, { onDelete: 'set null' }),
  assignToUsers: uuid('assign_to_users').array(),
  businessHoursOnly: boolean('business_hours_only').default(false),
  businessHours: jsonb('business_hours'),
  enableAiAssist: boolean('enable_ai_assist').default(false),
  aiGreeting: text('ai_greeting'),
  aiHandoffTriggers: text('ai_handoff_triggers').array(),
  allowedDomains: text('allowed_domains').array(),
  requireEmailVerification: boolean('require_email_verification').default(false),
  totalConversations: integer('total_conversations').default(0),
  avgResponseTime: decimal('avg_response_time').default('0'),
  avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  prospectId: uuid('prospect_id').references(() => prospects.id, { onDelete: 'set null' }),
  visitorName: text('visitor_name'),
  visitorEmail: text('visitor_email'),
  status: text('status').default('waiting'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  assignedTeam: uuid('assigned_team').references(() => teams.id, { onDelete: 'set null' }),
  pageUrl: text('page_url').notNull(),
  pageTitle: text('page_title'),
  userAgent: text('user_agent').notNull(),
  ipAddress: text('ip_address').notNull(),
  country: text('country'),
  city: text('city'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  sessionId: text('session_id').notNull(),
  previousVisits: integer('previous_visits').default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).default(sql`NOW()`),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  duration: integer('duration'),
  firstResponseTime: decimal('first_response_time'),
  avgResponseTime: decimal('avg_response_time'),
  rating: integer('rating'),
  feedback: text('feedback'),
  tags: text('tags').array().default(sql`'{}'::text[]`),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').default('text'),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  senderName: text('sender_name').notNull(),
  senderType: text('sender_type').default('visitor'),
  attachments: jsonb('attachments'),
  isAiGenerated: boolean('is_ai_generated').default(false),
  aiSuggestion: boolean('ai_suggestion').default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }).default(sql`NOW()`),
  readAt: timestamp('read_at', { withTimezone: true }),
});

export const agentStatus = pgTable('agent_status', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('offline'),
  maxConversations: integer('max_conversations').default(5),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// NOTIFICATION SYSTEM
// =============================================

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventId: uuid('event_id'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  icon: text('icon'),
  imageUrl: text('image_url'),
  priority: text('priority').default('medium'),
  actionUrl: text('action_url'),
  actionLabel: text('action_label'),
  groupKey: text('group_key'),
  status: text('status').default('unread'),
  readAt: timestamp('read_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  channels: jsonb('channels').notNull().default(sql`'{"inApp": {"enabled": true}}'::jsonb`),
  minPriority: text('min_priority').default('low'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  status: text('status').default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  attempts: integer('attempts').default(0),
  lastError: text('last_error'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const notificationBatches = pgTable('notification_batches', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  frequency: text('frequency').notNull(),
  notificationIds: uuid('notification_ids').array().notNull().default(sql`'{}'::uuid[]`),
  status: text('status').default('pending'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  keys: jsonb('keys').notNull(),
  userAgent: text('user_agent'),
  deviceName: text('device_name'),
  isActive: boolean('is_active').default(true),
  lastUsed: timestamp('last_used', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const emailBounces = pgTable('email_bounces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  bounceType: text('bounce_type').default('hard'),
  reason: text('reason'),
  bouncedAt: timestamp('bounced_at', { withTimezone: true }).default(sql`NOW()`),
});

export const userPresence = pgTable('user_presence', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  status: text('status').default('offline'),
  lastSeen: timestamp('last_seen', { withTimezone: true }).default(sql`NOW()`),
  connections: integer('connections').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

// =============================================
// SEARCH SYSTEM
// =============================================

export const searchAnalytics = pgTable('search_analytics', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  resultCount: integer('result_count').notNull(),
  searchTime: integer('search_time'),
  filters: jsonb('filters'),
  clickedResultId: text('clicked_result_id'),
  clickedResultType: text('clicked_result_type'),
  clickedPosition: integer('clicked_position'),
  searchedAt: timestamp('searched_at', { withTimezone: true }).default(sql`NOW()`),
});

export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  query: jsonb('query').notNull(),
  isPinned: boolean('is_pinned').default(false),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  useCount: integer('use_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`NOW()`),
});

export const searchIndexingJobs = pgTable('search_indexing_jobs', {
  id: text('id').primaryKey(),
  collectionName: text('collection_name').notNull(),
  type: text('type').notNull(),
  status: text('status').default('pending'),
  totalRecords: integer('total_records').default(0),
  indexedRecords: integer('indexed_records').default(0),
  failedRecords: integer('failed_records').default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
});

export const searchSyncQueue = pgTable('search_sync_queue', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tableName: text('table_name').notNull(),
  eventType: text('event_type').notNull(),
  recordId: uuid('record_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').default('pending'),
  retryCount: integer('retry_count').default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`NOW()`),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const searchPopularQueries = pgTable('search_popular_queries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  searchCount: integer('search_count').default(1),
  lastSearchedAt: timestamp('last_searched_at', { withTimezone: true }).default(sql`NOW()`),
  avgResultCount: decimal('avg_result_count'),
});

// =============================================
// INSERT SCHEMAS (Drizzle-Zod)
// =============================================

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProspectSchema = createInsertSchema(prospects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCadenceSchema = createInsertSchema(cadences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true });
export const insertFormSchema = createInsertSchema(forms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLandingPageSchema = createInsertSchema(landingPages).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });

// =============================================
// TYPE EXPORTS
// =============================================

export type Organization = typeof organizations.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type Cadence = typeof cadences.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsight = typeof conversationInsights.$inferSelect;
export type AiPrediction = typeof aiPredictions.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Form = typeof forms.$inferSelect;
export type LandingPage = typeof landingPages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type BdrAgentConfig = typeof bdrAgentConfigs.$inferSelect;
export type BdrTask = typeof bdrTasks.$inferSelect;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

// Insert Types
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type InsertCadence = z.infer<typeof insertCadenceSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;
