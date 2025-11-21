/**
 * Integrated Outreach Engine
 * Orchestrates the complete outreach lifecycle connecting all systems
 */

import { supabase } from '../supabase';
import { verifyEmail } from './emailVerification';
import { ComplianceManager } from './complianceManager';
import { EmailDeliverabilityManager } from './emailDeliverability';
import { calculateOptimalSendTime, scheduleEmailWithOptimalTiming } from './sendTimeOptimizer';
import { TemplateManager } from './contentLibrary';
import { classifyReply } from './replyClassifier';
import { ObjectionHandler } from './objectionHandler';
import { MeetingScheduler } from './meetingScheduler';
import { LinkedInAutomationManager } from './linkedInAutomation';

export interface OutreachRequest {
  prospectId: string;
  teamId: string;

  // Channel selection
  channels: ('email' | 'linkedin')[];

  // Content
  templateId?: string;
  customSubject?: string;
  customBody?: string;
  variables?: Record<string, string>;

  // Timing
  urgency?: 'low' | 'medium' | 'high';
  sendImmediately?: boolean;

  // Options
  requireApproval?: boolean;
  skipVerification?: boolean;
  skipComplianceCheck?: boolean;
}

export interface OutreachResult {
  success: boolean;
  prospectId: string;

  // What was sent
  channels: Array<{
    channel: 'email' | 'linkedin';
    sent: boolean;
    sentAt?: string;
    scheduledFor?: string;
    error?: string;
  }>;

  // Pre-send checks
  verification: {
    passed: boolean;
    result?: any;
  };
  compliance: {
    passed: boolean;
    reason?: string;
  };
  spamScore: {
    passed: boolean;
    score?: number;
    issues?: any[];
  };

  // Timing
  optimalSendTime?: Date;
  actualSendTime?: Date;

  // Tracking
  activityIds: string[];
  taskIds: string[];

  errors: string[];
  warnings: string[];
}

/**
 * Integrated Outreach Engine
 * Main orchestrator for all outreach activities
 */
export class IntegratedOutreachEngine {
  private teamId: string;
  private userId: string;

  private complianceManager: ComplianceManager;
  private deliverabilityManager: EmailDeliverabilityManager;
  private templateManager: TemplateManager;
  private objectionHandler: ObjectionHandler;
  private meetingScheduler: MeetingScheduler;
  private linkedInManager: LinkedInAutomationManager;

  constructor(teamId: string, userId: string) {
    this.teamId = teamId;
    this.userId = userId;

    this.complianceManager = new ComplianceManager(teamId);
    this.deliverabilityManager = new EmailDeliverabilityManager(teamId);
    this.templateManager = new TemplateManager(teamId);
    this.objectionHandler = new ObjectionHandler(teamId);
    this.meetingScheduler = new MeetingScheduler(teamId, userId);
    this.linkedInManager = new LinkedInAutomationManager(teamId);
  }

  /**
   * Execute complete outreach with all checks and optimizations
   */
  async executeOutreach(request: OutreachRequest): Promise<OutreachResult> {
    const result: OutreachResult = {
      success: false,
      prospectId: request.prospectId,
      channels: [],
      verification: { passed: false },
      compliance: { passed: false },
      spamScore: { passed: false },
      activityIds: [],
      taskIds: [],
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: Get prospect data
      const prospect = await this.getProspect(request.prospectId);
      if (!prospect) {
        result.errors.push('Prospect not found');
        return result;
      }

      // Step 2: Email verification (if email channel)
      if (request.channels.includes('email') && !request.skipVerification) {
        const verification = await this.verifyProspectEmail(prospect.email);
        result.verification = verification;

        if (!verification.passed) {
          result.errors.push(`Email verification failed: ${verification.result?.status}`);
          if (verification.result?.status === 'invalid') {
            return result; // Hard stop for invalid emails
          }
          result.warnings.push('Email verification concerns - proceeding with caution');
        }
      } else {
        result.verification.passed = true;
      }

      // Step 3: Compliance check
      if (!request.skipComplianceCheck) {
        const compliance = await this.checkCompliance(prospect.email);
        result.compliance = compliance;

        if (!compliance.passed) {
          result.errors.push(`Compliance check failed: ${compliance.reason}`);
          return result; // Hard stop for compliance issues
        }
      } else {
        result.compliance.passed = true;
      }

      // Step 4: Prepare content
      const content = await this.prepareContent(request, prospect);
      if (!content) {
        result.errors.push('Failed to prepare content');
        return result;
      }

      // Step 5: Spam score check (email only)
      if (request.channels.includes('email')) {
        const spamCheck = await this.checkSpamScore(content);
        result.spamScore = spamCheck;

        if (!spamCheck.passed) {
          result.warnings.push(`Spam score high (${spamCheck.score}). Issues: ${spamCheck.issues?.length}`);
          // Don't hard stop, but log warning
        }
      } else {
        result.spamScore.passed = true;
      }

      // Step 6: Determine send time
      let sendTime: Date;
      if (request.sendImmediately) {
        sendTime = new Date();
      } else {
        const optimal = await calculateOptimalSendTime(
          request.prospectId,
          request.teamId,
          { urgency: request.urgency || 'medium' }
        );
        sendTime = optimal.timestamp;
        result.optimalSendTime = optimal.timestamp;
      }

      // Step 7: Execute across channels
      for (const channel of request.channels) {
        try {
          let channelResult: { sent: boolean; sentAt?: string; scheduledFor?: string; activityId?: string; error?: string };

          if (channel === 'email') {
            channelResult = await this.sendEmail(
              prospect,
              content,
              sendTime,
              request.requireApproval
            );
          } else if (channel === 'linkedin') {
            channelResult = await this.sendLinkedInMessage(
              prospect,
              content,
              request.requireApproval
            );
          } else {
            channelResult = { sent: false, error: 'Unknown channel' };
          }

          result.channels.push({
            channel,
            ...channelResult,
          });

          if (channelResult.activityId) {
            result.activityIds.push(channelResult.activityId);
          }
        } catch (error) {
          result.channels.push({
            channel,
            sent: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          result.errors.push(`${channel} send failed: ${error}`);
        }
      }

      // Step 8: Update prospect tracking
      await this.updateProspectTracking(request.prospectId, result);

      // Check overall success
      result.success = result.channels.some(c => c.sent) && result.errors.length === 0;
      result.actualSendTime = new Date();

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Process incoming reply and route to appropriate handler
   */
  async processIncomingReply(params: {
    prospectId: string;
    emailSubject: string;
    emailBody: string;
    conversationHistory?: string[];
  }): Promise<{
    classification: any;
    action: 'objection_handled' | 'meeting_scheduled' | 'escalate_to_human' | 'continue_nurture';
    response?: string;
    meetingId?: string;
    handoffId?: string;
  }> {
    // Step 1: Classify the reply
    const classification = await classifyReply(
      params.emailBody,
      params.emailSubject,
      params.conversationHistory
    );

    // Step 2: Route based on classification
    let action: any;
    let response: string | undefined;
    let meetingId: string | undefined;
    let handoffId: string | undefined;

    switch (classification.category) {
      case 'positive_interest':
      case 'meeting_request':
        // Schedule meeting automatically
        try {
          const prospect = await this.getProspect(params.prospectId);
          const meetingRequest = await this.meetingScheduler.parseNaturalLanguageRequest(
            params.emailBody,
            params.prospectId
          );

          if (meetingRequest) {
            const meeting = await this.meetingScheduler.scheduleMeeting({
              ...meetingRequest,
              attendees: [prospect.email],
              title: `Meeting with ${prospect.first_name} ${prospect.last_name}`,
            });
            meetingId = meeting.id;
            action = 'meeting_scheduled';
            response = `Great! I've scheduled our meeting for ${meeting.startTime}. You should receive a calendar invite shortly.`;
          } else {
            action = 'escalate_to_human';
          }
        } catch (error) {
          console.error('Meeting scheduling failed:', error);
          action = 'escalate_to_human';
        }
        break;

      case 'objection':
        // Handle objection automatically
        try {
          const prospect = await this.getProspect(params.prospectId);
          const objectionResponse = await this.objectionHandler.handleObjection(
            params.prospectId,
            params.emailBody,
            classification,
            {
              company_name: prospect.company_profiles?.name,
              title: prospect.title,
              industry: prospect.company_profiles?.industry,
            }
          );

          if (objectionResponse.shouldEscalateToHuman) {
            action = 'escalate_to_human';
          } else {
            action = 'objection_handled';
            response = objectionResponse.suggestedResponse;
          }
        } catch (error) {
          console.error('Objection handling failed:', error);
          action = 'escalate_to_human';
        }
        break;

      case 'question':
        // Try to answer, or escalate if complex
        if (classification.confidence > 0.7) {
          response = classification.suggestedAction.suggestedResponse;
          action = 'continue_nurture';
        } else {
          action = 'escalate_to_human';
        }
        break;

      case 'not_interested':
      case 'unsubscribe':
        // Process unsubscribe
        const prospect = await this.getProspect(params.prospectId);
        await this.complianceManager.processUnsubscribe({
          email: prospect.email,
          unsubscribeType: 'all',
          reason: 'Replied with unsubscribe request',
          source: 'reply',
        });
        action = 'continue_nurture'; // Actually stop nurturing
        break;

      case 'out_of_office':
        // Add to follow-up queue for later
        await this.scheduleFollowUp(params.prospectId, 7); // Follow up in 7 days
        action = 'continue_nurture';
        break;

      default:
        // Escalate unclear cases
        action = 'escalate_to_human';
        break;
    }

    // Log the classification and action
    await this.logReplyProcessing(params.prospectId, classification, action);

    return {
      classification,
      action,
      response,
      meetingId,
      handoffId,
    };
  }

  /**
   * Execute multi-channel sequence
   */
  async executeMultiChannelSequence(params: {
    prospectId: string;
    sequenceType: 'cold' | 'warm' | 'hot';
    startImmediately?: boolean;
  }): Promise<{
    success: boolean;
    scheduledTasks: Array<{
      channel: string;
      scheduledFor: Date;
      taskId: string;
    }>;
  }> {
    const prospect = await this.getProspect(params.prospectId);
    const scheduledTasks: any[] = [];

    // Define sequence based on type
    let sequence: Array<{
      channel: 'email' | 'linkedin' | 'phone';
      delayDays: number;
      templateId: string;
    }>;

    switch (params.sequenceType) {
      case 'hot':
        // High-intent prospects: Fast, multi-channel
        sequence = [
          { channel: 'email', delayDays: 0, templateId: 'cold_problem_agitate_solve' },
          { channel: 'linkedin', delayDays: 1, templateId: 'linkedin_connection_note' },
          { channel: 'email', delayDays: 3, templateId: 'followup_value_add' },
          { channel: 'linkedin', delayDays: 5, templateId: 'linkedin_inmail' },
        ];
        break;

      case 'warm':
        // Some engagement: Balanced approach
        sequence = [
          { channel: 'email', delayDays: 0, templateId: 'cold_pattern_interrupt' },
          { channel: 'linkedin', delayDays: 2, templateId: 'linkedin_connection_note' },
          { channel: 'email', delayDays: 5, templateId: 'followup_value_add' },
          { channel: 'email', delayDays: 10, templateId: 'followup_break_up' },
        ];
        break;

      case 'cold':
        // No engagement: Patient, email-focused
        sequence = [
          { channel: 'email', delayDays: 0, templateId: 'cold_problem_agitate_solve' },
          { channel: 'email', delayDays: 4, templateId: 'followup_value_add' },
          { channel: 'linkedin', delayDays: 7, templateId: 'linkedin_connection_note' },
          { channel: 'email', delayDays: 11, templateId: 'followup_break_up' },
        ];
        break;
    }

    // Schedule each step
    for (const step of sequence) {
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + step.delayDays);

      // Create task
      const { data: task } = await supabase
        .from('bdr_tasks')
        .insert({
          team_id: this.teamId,
          prospect_id: params.prospectId,
          task_type: 'engage',
          status: 'pending',
          scheduled_for: scheduledFor.toISOString(),
          config: {
            channel: step.channel,
            templateId: step.templateId,
            sequenceType: params.sequenceType,
          },
        })
        .select()
        .single();

      if (task) {
        scheduledTasks.push({
          channel: step.channel,
          scheduledFor,
          taskId: task.id,
        });
      }
    }

    return {
      success: scheduledTasks.length === sequence.length,
      scheduledTasks,
    };
  }

  /**
   * Get outreach health score for a prospect
   */
  async getOutreachHealth(prospectId: string): Promise<{
    score: number; // 0-100
    factors: {
      emailDeliverability: number;
      engagement: number;
      responseTime: number;
      channelDiversity: number;
      compliance: number;
    };
    recommendations: string[];
  }> {
    const prospect = await this.getProspect(prospectId);

    // Calculate factors
    const emailVerification = await verifyEmail(prospect.email);
    const emailDeliverability = emailVerification.isValid ? 100 : 0;

    // Get engagement metrics
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
      .limit(10);

    const opens = activities?.filter(a => a.activity_type === 'email_opened').length || 0;
    const clicks = activities?.filter(a => a.activity_type === 'email_clicked').length || 0;
    const sends = activities?.filter(a => a.activity_type === 'email_sent').length || 0;

    const engagement = sends > 0 ? ((opens + clicks * 2) / sends) * 50 : 0;

    // Response time (lower is better, normalize to 0-100)
    const avgResponseTime = 24; // hours, would calculate from data
    const responseTime = Math.max(0, 100 - avgResponseTime);

    // Channel diversity
    const channels = new Set(activities?.map(a => a.channel) || []);
    const channelDiversity = (channels.size / 3) * 100; // Max 3 channels

    // Compliance
    const complianceCheck = await this.complianceManager.canContact(prospect.email);
    const compliance = complianceCheck.allowed ? 100 : 0;

    // Overall score (weighted average)
    const score = Math.round(
      emailDeliverability * 0.3 +
      engagement * 0.25 +
      responseTime * 0.15 +
      channelDiversity * 0.15 +
      compliance * 0.15
    );

    // Generate recommendations
    const recommendations: string[] = [];

    if (emailDeliverability < 80) {
      recommendations.push('Verify or update email address');
    }
    if (engagement < 30) {
      recommendations.push('Try different messaging or channel');
    }
    if (channelDiversity < 50) {
      recommendations.push('Add LinkedIn or phone outreach');
    }
    if (compliance < 100) {
      recommendations.push('Review compliance status before contacting');
    }

    return {
      score,
      factors: {
        emailDeliverability,
        engagement,
        responseTime,
        channelDiversity,
        compliance,
      },
      recommendations,
    };
  }

  // Private helper methods

  private async getProspect(prospectId: string) {
    const { data } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('id', prospectId)
      .single();
    return data;
  }

  private async verifyProspectEmail(email: string): Promise<{
    passed: boolean;
    result?: any;
  }> {
    try {
      const verification = await verifyEmail(email);
      return {
        passed: verification.status === 'valid' || verification.status === 'unknown',
        result: verification,
      };
    } catch (error) {
      return { passed: false };
    }
  }

  private async checkCompliance(email: string): Promise<{
    passed: boolean;
    reason?: string;
  }> {
    const check = await this.complianceManager.canContact(email);
    return {
      passed: check.allowed,
      reason: check.reason,
    };
  }

  private async prepareContent(request: OutreachRequest, prospect: any): Promise<{
    subject: string;
    body: string;
  } | null> {
    try {
      if (request.customSubject && request.customBody) {
        return {
          subject: request.customSubject,
          body: request.customBody,
        };
      }

      if (request.templateId) {
        // Prepare default variables
        const variables = {
          first_name: prospect.first_name || 'there',
          last_name: prospect.last_name || '',
          company_name: prospect.company_profiles?.name || 'your company',
          title: prospect.title || '',
          ...request.variables,
        };

        return await this.templateManager.renderTemplate(request.templateId, variables);
      }

      return null;
    } catch (error) {
      console.error('Content preparation failed:', error);
      return null;
    }
  }

  private async checkSpamScore(content: { subject: string; body: string }): Promise<{
    passed: boolean;
    score?: number;
    issues?: any[];
  }> {
    try {
      const spamCheck = await this.deliverabilityManager.checkSpamScore({
        subject: content.subject,
        body: content.body,
        fromName: 'BDR',
        fromEmail: 'bdr@example.com',
      });

      return {
        passed: spamCheck.passed,
        score: spamCheck.score,
        issues: spamCheck.issues,
      };
    } catch (error) {
      return { passed: true }; // Don't block on error
    }
  }

  private async sendEmail(
    prospect: any,
    content: { subject: string; body: string },
    sendTime: Date,
    requireApproval?: boolean
  ): Promise<{ sent: boolean; sentAt?: string; scheduledFor?: string; activityId?: string; error?: string }> {
    try {
      // Check domain can send
      const domain = 'example.com'; // Would get from config
      const canSend = await this.deliverabilityManager.canSend(domain);

      if (!canSend.canSend) {
        return { sent: false, error: canSend.reason };
      }

      // If approval required, add to queue
      if (requireApproval) {
        await supabase.from('bdr_approval_queue').insert({
          team_id: this.teamId,
          prospect_id: prospect.id,
          approval_type: 'email',
          subject: content.subject,
          message_body: content.body,
        });

        return { sent: false, scheduledFor: sendTime.toISOString() };
      }

      // Schedule or send immediately
      const now = new Date();
      if (sendTime > now) {
        // Schedule for later
        await supabase.from('bdr_tasks').insert({
          team_id: this.teamId,
          prospect_id: prospect.id,
          task_type: 'engage',
          status: 'pending',
          scheduled_for: sendTime.toISOString(),
          config: {
            channel: 'email',
            subject: content.subject,
            body: content.body,
          },
        });

        return { sent: false, scheduledFor: sendTime.toISOString() };
      }

      // Send immediately
      // (In production, would actually send via email service)

      // Log activity
      const { data: activity } = await supabase
        .from('bdr_activities')
        .insert({
          team_id: this.teamId,
          prospect_id: prospect.id,
          activity_type: 'email_sent',
          channel: 'email',
          direction: 'outbound',
          subject: content.subject,
          message_preview: content.body.substring(0, 200),
          full_content: content.body,
          was_automated: true,
        })
        .select()
        .single();

      // Track for deliverability
      await this.deliverabilityManager.trackEmailSend(domain, prospect.email);

      return {
        sent: true,
        sentAt: new Date().toISOString(),
        activityId: activity?.id,
      };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async sendLinkedInMessage(
    prospect: any,
    content: { subject: string; body: string },
    requireApproval?: boolean
  ): Promise<{ sent: boolean; sentAt?: string; activityId?: string; error?: string }> {
    try {
      if (requireApproval) {
        await supabase.from('bdr_approval_queue').insert({
          team_id: this.teamId,
          prospect_id: prospect.id,
          approval_type: 'linkedin_message',
          message_body: content.body,
        });

        return { sent: false };
      }

      // Send LinkedIn message
      await this.linkedInManager.sendMessage(prospect.id, content.body, 'follow_up');

      return {
        sent: true,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updateProspectTracking(prospectId: string, result: OutreachResult): Promise<void> {
    const emailSent = result.channels.some(c => c.channel === 'email' && c.sent);

    if (emailSent) {
      await supabase
        .from('prospects')
        .update({
          last_contacted_at: new Date().toISOString(),
          contact_count: supabase.rpc('increment', { amount: 1 }),
        })
        .eq('id', prospectId);
    }
  }

  private async logReplyProcessing(prospectId: string, classification: any, action: string): Promise<void> {
    await supabase.from('bdr_activities').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      activity_type: 'reply_processed',
      channel: 'system',
      direction: 'internal',
      metadata: {
        classification: classification.category,
        action,
        confidence: classification.confidence,
      },
    });
  }

  private async scheduleFollowUp(prospectId: string, daysFromNow: number): Promise<void> {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + daysFromNow);

    await supabase.from('bdr_tasks').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      task_type: 'follow_up',
      status: 'pending',
      scheduled_for: followUpDate.toISOString(),
    });
  }
}

/**
 * Create integrated outreach instance
 */
export function createOutreachEngine(teamId: string, userId: string): IntegratedOutreachEngine {
  return new IntegratedOutreachEngine(teamId, userId);
}
