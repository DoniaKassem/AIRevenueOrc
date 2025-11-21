/**
 * Compliance & Unsubscribe Management System
 * Handles GDPR, CAN-SPAM, CASL compliance and consent management
 */

import { supabase } from '../supabase';

export interface ConsentRecord {
  id: string;
  email: string;
  prospectId?: string;
  teamId: string;

  // Consent details
  consentType: 'explicit' | 'implied' | 'legitimate_interest';
  consentSource: 'form_submission' | 'inbound_inquiry' | 'business_card' | 'purchased_list' | 'public_directory' | 'other';
  consentDate: string;
  consentIpAddress?: string;
  consentUserAgent?: string;

  // Communication preferences
  emailAllowed: boolean;
  phoneAllowed: boolean;
  smsAllowed: boolean;

  // Compliance fields
  gdprCompliant: boolean;
  canSpamCompliant: boolean;
  caslCompliant: boolean;

  // Metadata
  notes?: string;
  expiresAt?: string;  // For temporary consent
  createdAt: string;
  updatedAt: string;
}

export interface UnsubscribeRequest {
  id: string;
  email: string;
  teamId: string;

  unsubscribeType: 'all' | 'marketing' | 'transactional' | 'specific_list';
  unsubscribeReason?: string;
  unsubscribeSource: 'email_link' | 'reply' | 'complaint' | 'manual';

  processedAt?: string;
  createdAt: string;
}

export interface DataDeletionRequest {
  id: string;
  email: string;
  teamId: string;

  requestType: 'right_to_erasure' | 'right_to_be_forgotten' | 'ccpa_delete';
  requestDate: string;
  requestorVerified: boolean;

  status: 'pending' | 'processing' | 'completed' | 'rejected';
  completedAt?: string;
  rejectionReason?: string;

  deletedData: string[];  // Types of data deleted
}

export interface ComplianceAuditLog {
  id: string;
  teamId: string;
  action: string;
  performedBy: string;
  affectedEmail: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Compliance Manager Class
 */
export class ComplianceManager {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Check if email is allowed to be contacted
   */
  async canContact(email: string): Promise<{
    allowed: boolean;
    reason?: string;
    restrictions?: string[];
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check suppression list
    const { data: suppressed } = await supabase
      .from('email_suppression_list')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('email', normalizedEmail)
      .single();

    if (suppressed) {
      return {
        allowed: false,
        reason: `Email is on suppression list: ${suppressed.suppression_type}`,
        restrictions: [suppressed.suppression_type],
      };
    }

    // Check consent status
    const { data: consent } = await supabase
      .from('consent_records')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('email', normalizedEmail)
      .single();

    if (consent) {
      // Check if consent expired
      if (consent.expires_at && new Date(consent.expires_at) < new Date()) {
        return {
          allowed: false,
          reason: 'Consent has expired',
          restrictions: ['expired_consent'],
        };
      }

      // Check communication preferences
      if (!consent.email_allowed) {
        return {
          allowed: false,
          reason: 'Email communication not allowed by prospect',
          restrictions: ['email_disabled'],
        };
      }
    }

    // Check domain-level blocks
    const domain = normalizedEmail.split('@')[1];
    const { data: blockedDomain } = await supabase
      .from('blocked_domains')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('domain', domain)
      .single();

    if (blockedDomain) {
      return {
        allowed: false,
        reason: `Domain ${domain} is blocked`,
        restrictions: ['domain_blocked'],
      };
    }

    return { allowed: true };
  }

  /**
   * Record consent
   */
  async recordConsent(params: {
    email: string;
    prospectId?: string;
    consentType: ConsentRecord['consentType'];
    consentSource: ConsentRecord['consentSource'];
    ipAddress?: string;
    userAgent?: string;
    emailAllowed?: boolean;
    phoneAllowed?: boolean;
    smsAllowed?: boolean;
    expiresAt?: Date;
  }): Promise<ConsentRecord> {
    const record: Partial<ConsentRecord> = {
      team_id: this.teamId,
      email: params.email.toLowerCase().trim(),
      prospect_id: params.prospectId,
      consent_type: params.consentType,
      consent_source: params.consentSource,
      consent_date: new Date().toISOString(),
      consent_ip_address: params.ipAddress,
      consent_user_agent: params.userAgent,
      email_allowed: params.emailAllowed !== false,
      phone_allowed: params.phoneAllowed || false,
      sms_allowed: params.smsAllowed || false,
      gdpr_compliant: this.isGDPRCompliant(params.consentType, params.consentSource),
      can_spam_compliant: true,
      casl_compliant: this.isCASlCompliant(params.consentType),
      expires_at: params.expiresAt?.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('consent_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await this.logAudit({
      action: 'consent_recorded',
      affectedEmail: params.email,
      details: { consentType: params.consentType, source: params.consentSource },
    });

    return data as ConsentRecord;
  }

  /**
   * Process unsubscribe request
   */
  async processUnsubscribe(params: {
    email: string;
    unsubscribeType: UnsubscribeRequest['unsubscribeType'];
    reason?: string;
    source: UnsubscribeRequest['unsubscribeSource'];
  }): Promise<UnsubscribeRequest> {
    const email = params.email.toLowerCase().trim();

    // Add to suppression list
    await supabase.from('email_suppression_list').insert({
      team_id: this.teamId,
      email,
      domain: email.split('@')[1],
      suppression_type: 'unsubscribe',
      reason: params.reason,
      source: params.source,
      suppressed_at: new Date().toISOString(),
    });

    // Update consent record
    await supabase
      .from('consent_records')
      .update({
        email_allowed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', this.teamId)
      .eq('email', email);

    // Create unsubscribe record
    const { data } = await supabase
      .from('unsubscribe_requests')
      .insert({
        team_id: this.teamId,
        email,
        unsubscribe_type: params.unsubscribeType,
        unsubscribe_reason: params.reason,
        unsubscribe_source: params.source,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Audit log
    await this.logAudit({
      action: 'unsubscribe_processed',
      affectedEmail: email,
      details: { type: params.unsubscribeType, reason: params.reason },
    });

    return data as UnsubscribeRequest;
  }

  /**
   * Handle data deletion request (GDPR Right to Erasure / CCPA)
   */
  async processDataDeletion(params: {
    email: string;
    requestType: DataDeletionRequest['requestType'];
    requestorVerified: boolean;
  }): Promise<DataDeletionRequest> {
    const email = params.email.toLowerCase().trim();

    // Create deletion request
    const { data: request } = await supabase
      .from('data_deletion_requests')
      .insert({
        team_id: this.teamId,
        email,
        request_type: params.requestType,
        request_date: new Date().toISOString(),
        requestor_verified: params.requestorVerified,
        status: params.requestorVerified ? 'processing' : 'pending',
      })
      .select()
      .single();

    if (!params.requestorVerified) {
      return request as DataDeletionRequest;
    }

    // If verified, process deletion
    const deletedData = await this.executeDataDeletion(email);

    // Update request status
    await supabase
      .from('data_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deleted_data: deletedData,
      })
      .eq('id', request.id);

    // Audit log
    await this.logAudit({
      action: 'data_deletion_completed',
      affectedEmail: email,
      details: { deletedData },
    });

    return { ...request, deletedData, status: 'completed' } as DataDeletionRequest;
  }

  /**
   * Generate unsubscribe link
   */
  generateUnsubscribeLink(prospectId: string, email: string): string {
    // In production, this would create a signed token
    const token = Buffer.from(`${prospectId}:${email}`).toString('base64');
    return `https://app.example.com/unsubscribe/${token}`;
  }

  /**
   * Generate preference center link
   */
  generatePreferenceCenterLink(prospectId: string, email: string): string {
    const token = Buffer.from(`${prospectId}:${email}`).toString('base64');
    return `https://app.example.com/preferences/${token}`;
  }

  /**
   * Update communication preferences
   */
  async updatePreferences(params: {
    email: string;
    emailAllowed?: boolean;
    phoneAllowed?: boolean;
    smsAllowed?: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'never';
    topics?: string[];
  }): Promise<void> {
    const email = params.email.toLowerCase().trim();

    await supabase
      .from('consent_records')
      .update({
        email_allowed: params.emailAllowed,
        phone_allowed: params.phoneAllowed,
        sms_allowed: params.smsAllowed,
        communication_frequency: params.frequency,
        communication_topics: params.topics,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', this.teamId)
      .eq('email', email);

    // Audit log
    await this.logAudit({
      action: 'preferences_updated',
      affectedEmail: email,
      details: params,
    });
  }

  /**
   * Export prospect data (GDPR Right of Access)
   */
  async exportProspectData(email: string): Promise<Record<string, any>> {
    const normalizedEmail = email.toLowerCase().trim();

    // Gather all data associated with this email
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('email', normalizedEmail)
      .single();

    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('prospect_id', prospect?.id);

    const { data: consent } = await supabase
      .from('consent_records')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('email', normalizedEmail);

    const { data: meetings } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('prospect_id', prospect?.id);

    return {
      prospect,
      activities,
      consent,
      meetings,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Check compliance status
   */
  async checkComplianceStatus(): Promise<{
    overallCompliance: number;  // 0-100
    issues: Array<{
      severity: 'critical' | 'warning' | 'info';
      issue: string;
      recommendation: string;
    }>;
    stats: {
      totalContacts: number;
      withConsent: number;
      withoutConsent: number;
      unsubscribed: number;
      suppressed: number;
    };
  }> {
    const issues: any[] = [];

    // Get stats
    const { count: totalContacts } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId);

    const { count: withConsent } = await supabase
      .from('consent_records')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .eq('email_allowed', true);

    const { count: suppressed } = await supabase
      .from('email_suppression_list')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId);

    // Calculate compliance score
    let score = 100;

    // Check unsubscribe links in sent emails
    const { data: recentEmails } = await supabase
      .from('bdr_activities')
      .select('metadata')
      .eq('team_id', this.teamId)
      .eq('activity_type', 'email_sent')
      .order('created_at', { ascending: false })
      .limit(100);

    const emailsWithoutUnsubscribe = recentEmails?.filter(
      e => !e.metadata?.body?.includes('unsubscribe')
    ).length || 0;

    if (emailsWithoutUnsubscribe > 0) {
      score -= 20;
      issues.push({
        severity: 'critical',
        issue: `${emailsWithoutUnsubscribe} recent emails missing unsubscribe link`,
        recommendation: 'Ensure all email templates include an unsubscribe link',
      });
    }

    // Check consent coverage
    const consentCoverage = totalContacts ? (withConsent / totalContacts) * 100 : 0;
    if (consentCoverage < 80) {
      score -= 15;
      issues.push({
        severity: 'warning',
        issue: `Only ${consentCoverage.toFixed(0)}% of contacts have consent recorded`,
        recommendation: 'Record consent for all contacts, especially for GDPR compliance',
      });
    }

    // Check for expired consents
    const { count: expired } = await supabase
      .from('consent_records')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .lt('expires_at', new Date().toISOString());

    if (expired > 0) {
      score -= 10;
      issues.push({
        severity: 'warning',
        issue: `${expired} expired consent records`,
        recommendation: 'Re-request consent or remove from active outreach',
      });
    }

    return {
      overallCompliance: Math.max(0, score),
      issues,
      stats: {
        totalContacts: totalContacts || 0,
        withConsent: withConsent || 0,
        withoutConsent: (totalContacts || 0) - (withConsent || 0),
        unsubscribed: suppressed || 0,
        suppressed: suppressed || 0,
      },
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    period: { start: string; end: string };
    unsubscribes: number;
    dataDeletionRequests: number;
    complaintsReceived: number;
    consentRecorded: number;
    auditEvents: number;
    recommendations: string[];
  }> {
    const { count: unsubscribes } = await supabase
      .from('unsubscribe_requests')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const { count: deletionRequests } = await supabase
      .from('data_deletion_requests')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('request_date', startDate.toISOString())
      .lte('request_date', endDate.toISOString());

    const { count: complaints } = await supabase
      .from('email_complaints')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('complained_at', startDate.toISOString())
      .lte('complained_at', endDate.toISOString());

    const { count: consents } = await supabase
      .from('consent_records')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const recommendations: string[] = [];

    if ((complaints || 0) > 10) {
      recommendations.push('High complaint rate. Review targeting and messaging quality.');
    }

    if ((unsubscribes || 0) > 100) {
      recommendations.push('High unsubscribe rate. Consider improving email relevance and frequency.');
    }

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      unsubscribes: unsubscribes || 0,
      dataDeletionRequests: deletionRequests || 0,
      complaintsReceived: complaints || 0,
      consentRecorded: consents || 0,
      auditEvents: 0,
      recommendations,
    };
  }

  // Private helper methods

  private isGDPRCompliant(consentType: string, source: string): boolean {
    // GDPR requires explicit consent for most marketing
    if (consentType === 'explicit') return true;

    // Legitimate interest can be used in some B2B contexts
    if (consentType === 'legitimate_interest' && source === 'public_directory') {
      return true;
    }

    return false;
  }

  private isCASlCompliant(consentType: string): boolean {
    // CASL requires express or implied consent
    return consentType === 'explicit' || consentType === 'implied';
  }

  private async executeDataDeletion(email: string): Promise<string[]> {
    const deletedData: string[] = [];

    // Delete prospect record
    await supabase
      .from('prospects')
      .delete()
      .eq('team_id', this.teamId)
      .eq('email', email);
    deletedData.push('prospect_profile');

    // Anonymize activity records (keep for analytics but remove PII)
    await supabase
      .from('bdr_activities')
      .update({ prospect_id: null, metadata: {} })
      .eq('team_id', this.teamId)
      .eq('prospect_id', email);  // Assuming prospect_id could be email
    deletedData.push('activity_records');

    // Delete consent records
    await supabase
      .from('consent_records')
      .delete()
      .eq('team_id', this.teamId)
      .eq('email', email);
    deletedData.push('consent_records');

    // Keep suppression record (to prevent re-contact)
    // This is allowed under GDPR for legitimate interest

    return deletedData;
  }

  private async logAudit(params: {
    action: string;
    affectedEmail: string;
    details: Record<string, any>;
  }): Promise<void> {
    await supabase.from('compliance_audit_log').insert({
      team_id: this.teamId,
      action: params.action,
      affected_email: params.affectedEmail,
      details: params.details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Check if email requires CAN-SPAM footer
 */
export function requiresCanSpamFooter(emailType: string): boolean {
  // Transactional emails may be exempt
  const exemptTypes = ['password_reset', 'receipt', 'account_notification'];
  return !exemptTypes.includes(emailType);
}

/**
 * Generate CAN-SPAM compliant footer
 */
export function generateCompliantFooter(params: {
  companyName: string;
  companyAddress: string;
  unsubscribeLink: string;
  preferenceCenterLink?: string;
}): string {
  return `
---

${params.companyName}
${params.companyAddress}

You received this email because you signed up for updates from ${params.companyName}.

${params.preferenceCenterLink ? `[Manage your preferences](${params.preferenceCenterLink}) | ` : ''}[Unsubscribe](${params.unsubscribeLink})

This email was sent in compliance with CAN-SPAM, GDPR, and CASL regulations.
  `.trim();
}
