/**
 * Bulk Email Sending Service
 *
 * Handles sending large volumes of emails with:
 * - Rate limiting to prevent spam flags
 * - Queue management
 * - Retry logic for failures
 * - Progress tracking
 * - Pause/resume functionality
 *
 * Priority 1 Launch Blocker Feature
 */

import { createClient } from '@supabase/supabase-js';
import { createEmailService, SendEmailParams } from './emailService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const emailService = createEmailService();

// =============================================
// TYPES & INTERFACES
// =============================================

export interface BulkEmailRecipient {
  email: string;
  name?: string;
  variables?: Record<string, any>; // For template personalization
  prospectId?: string;
  metadata?: Record<string, any>;
}

export interface CreateBulkSendParams {
  organizationId: string;
  userId: string;
  campaignId?: string;

  // Content
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;

  // Recipients
  recipients: BulkEmailRecipient[];

  // Rate limiting
  rateLimitPerHour?: number; // Default: 1000/hour
  sendImmediately?: boolean; // If false, requires manual start

  // Tracking
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface BulkSendJob {
  id: string;
  organizationId: string;
  userId: string;
  campaignId?: string;

  // Content
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;

  // Progress
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  queuedEmails: number;

  // Status
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

  // Rate limiting
  rateLimitPerHour: number;
  lastSentAt?: Date;

  // Timing
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface BulkEmailQueueItem {
  id: string;
  jobId: string;
  recipient: BulkEmailRecipient;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  lastError?: string;
  sentAt?: Date;
  createdAt: Date;
}

// =============================================
// BULK EMAIL SERVICE
// =============================================

export class BulkEmailService {
  private defaultRateLimitPerHour = 1000;
  private maxRetries = 3;
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Create a bulk send job
   */
  async createBulkSend(params: CreateBulkSendParams): Promise<BulkSendJob> {
    // Validate recipients
    if (!params.recipients || params.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('bulk_email_jobs')
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        campaign_id: params.campaignId,
        subject: params.subject,
        html: params.html,
        text: params.text,
        template_id: params.templateId,
        total_emails: params.recipients.length,
        sent_emails: 0,
        failed_emails: 0,
        queued_emails: params.recipients.length,
        status: params.sendImmediately ? 'pending' : 'paused',
        rate_limit_per_hour: params.rateLimitPerHour || this.defaultRateLimitPerHour,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create bulk send job');
    }

    // Queue all recipients
    const queueItems = params.recipients.map(recipient => ({
      job_id: job.id,
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      variables: recipient.variables,
      prospect_id: recipient.prospectId,
      metadata: recipient.metadata,
      status: 'queued',
      attempts: 0,
    }));

    const { error: queueError } = await supabase
      .from('bulk_email_queue')
      .insert(queueItems);

    if (queueError) {
      throw new Error('Failed to queue recipients');
    }

    // If immediate send, start processing
    if (params.sendImmediately) {
      this.processJob(job.id).catch(console.error);
    }

    return this.mapJob(job);
  }

  /**
   * Start processing a bulk send job
   */
  async startJob(jobId: string): Promise<void> {
    await supabase
      .from('bulk_email_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    this.processJob(jobId).catch(console.error);
  }

  /**
   * Pause a running job
   */
  async pauseJob(jobId: string): Promise<void> {
    await supabase
      .from('bulk_email_jobs')
      .update({
        status: 'paused',
      })
      .eq('id', jobId);
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    await supabase
      .from('bulk_email_jobs')
      .update({
        status: 'running',
      })
      .eq('id', jobId);

    this.processJob(jobId).catch(console.error);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    await supabase
      .from('bulk_email_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  /**
   * Process a bulk send job (sends emails with rate limiting)
   */
  private async processJob(jobId: string): Promise<void> {
    // Get job details
    const { data: job } = await supabase
      .from('bulk_email_jobs')
      .select()
      .eq('id', jobId)
      .single();

    if (!job || job.status !== 'running') {
      return;
    }

    // Calculate delay between emails to respect rate limit
    const delayMs = (3600 * 1000) / job.rate_limit_per_hour; // Convert per hour to milliseconds

    while (true) {
      // Check if job is still running
      const { data: currentJob } = await supabase
        .from('bulk_email_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (!currentJob || currentJob.status !== 'running') {
        break;
      }

      // Get next queued email
      const { data: queueItems } = await supabase
        .from('bulk_email_queue')
        .select()
        .eq('job_id', jobId)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1);

      if (!queueItems || queueItems.length === 0) {
        // No more emails to send, mark job as completed
        await this.completeJob(jobId);
        break;
      }

      const queueItem = queueItems[0];

      try {
        // Mark as sending
        await supabase
          .from('bulk_email_queue')
          .update({
            status: 'sending',
            attempts: queueItem.attempts + 1,
          })
          .eq('id', queueItem.id);

        // Send email
        await emailService.sendEmail({
          organizationId: job.organization_id,
          userId: job.user_id,
          to: {
            email: queueItem.recipient_email,
            name: queueItem.recipient_name,
          },
          subject: job.subject,
          html: job.html,
          text: job.text,
          templateId: job.template_id,
          templateVariables: queueItem.variables,
          campaignId: job.campaign_id,
          prospectId: queueItem.prospect_id,
          metadata: queueItem.metadata,
        });

        // Mark as sent
        await supabase
          .from('bulk_email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', queueItem.id);

        // Update job progress
        await supabase
          .from('bulk_email_jobs')
          .update({
            sent_emails: supabase.sql`sent_emails + 1`,
            queued_emails: supabase.sql`queued_emails - 1`,
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      } catch (error: any) {
        console.error(`Failed to send email in bulk job ${jobId}:`, error);

        // Check if should retry
        if (queueItem.attempts < this.maxRetries) {
          // Mark as queued for retry
          await supabase
            .from('bulk_email_queue')
            .update({
              status: 'queued',
              last_error: error.message,
            })
            .eq('id', queueItem.id);
        } else {
          // Mark as failed
          await supabase
            .from('bulk_email_queue')
            .update({
              status: 'failed',
              last_error: error.message,
            })
            .eq('id', queueItem.id);

          // Update job failed count
          await supabase
            .from('bulk_email_jobs')
            .update({
              failed_emails: supabase.sql`failed_emails + 1`,
              queued_emails: supabase.sql`queued_emails - 1`,
            })
            .eq('id', jobId);
        }
      }

      // Wait before sending next email (rate limiting)
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Complete a bulk send job
   */
  private async completeJob(jobId: string): Promise<void> {
    await supabase
      .from('bulk_email_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<BulkSendJob> {
    const { data: job } = await supabase
      .from('bulk_email_jobs')
      .select()
      .eq('id', jobId)
      .single();

    if (!job) {
      throw new Error('Job not found');
    }

    // Calculate estimated completion time
    let estimatedCompletionAt: Date | undefined;

    if (job.status === 'running' && job.sent_emails > 0 && job.last_sent_at) {
      const emailsRemaining = job.total_emails - job.sent_emails;
      const msPerEmail = (3600 * 1000) / job.rate_limit_per_hour;
      const msRemaining = emailsRemaining * msPerEmail;

      estimatedCompletionAt = new Date(Date.now() + msRemaining);
    }

    return this.mapJob({ ...job, estimated_completion_at: estimatedCompletionAt });
  }

  /**
   * Get jobs for organization
   */
  async getJobs(params: {
    organizationId: string;
    userId?: string;
    status?: BulkSendJob['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: BulkSendJob[]; total: number }> {
    let query = supabase
      .from('bulk_email_jobs')
      .select('*', { count: 'exact' })
      .eq('organization_id', params.organizationId);

    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      jobs: (data || []).map(this.mapJob),
      total: count || 0,
    };
  }

  /**
   * Get failed emails for a job
   */
  async getFailedEmails(jobId: string): Promise<BulkEmailQueueItem[]> {
    const { data } = await supabase
      .from('bulk_email_queue')
      .select()
      .eq('job_id', jobId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapQueueItem);
  }

  /**
   * Retry failed emails in a job
   */
  async retryFailedEmails(jobId: string): Promise<void> {
    // Reset failed emails to queued
    await supabase
      .from('bulk_email_queue')
      .update({
        status: 'queued',
        attempts: 0,
        last_error: null,
      })
      .eq('job_id', jobId)
      .eq('status', 'failed');

    // Update job counts
    const { data: job } = await supabase
      .from('bulk_email_jobs')
      .select()
      .eq('id', jobId)
      .single();

    if (job) {
      await supabase
        .from('bulk_email_jobs')
        .update({
          queued_emails: supabase.sql`queued_emails + failed_emails`,
          failed_emails: 0,
          status: 'running',
        })
        .eq('id', jobId);

      // Restart processing
      this.processJob(jobId).catch(console.error);
    }
  }

  /**
   * Start background job processor (called on server startup)
   */
  startBackgroundProcessor(): void {
    if (this.processingInterval) {
      return; // Already running
    }

    // Check for running jobs every minute
    this.processingInterval = setInterval(async () => {
      const { data: runningJobs } = await supabase
        .from('bulk_email_jobs')
        .select('id')
        .eq('status', 'running');

      if (runningJobs) {
        for (const job of runningJobs) {
          this.processJob(job.id).catch(console.error);
        }
      }
    }, 60000); // 1 minute

    console.log('Bulk email background processor started');
  }

  /**
   * Stop background processor
   */
  stopBackgroundProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Bulk email background processor stopped');
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private mapJob(data: any): BulkSendJob {
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      campaignId: data.campaign_id,
      subject: data.subject,
      html: data.html,
      text: data.text,
      templateId: data.template_id,
      totalEmails: data.total_emails,
      sentEmails: data.sent_emails,
      failedEmails: data.failed_emails,
      queuedEmails: data.queued_emails,
      status: data.status,
      rateLimitPerHour: data.rate_limit_per_hour,
      lastSentAt: data.last_sent_at ? new Date(data.last_sent_at) : undefined,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      estimatedCompletionAt: data.estimated_completion_at
        ? new Date(data.estimated_completion_at)
        : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }

  private mapQueueItem(data: any): BulkEmailQueueItem {
    return {
      id: data.id,
      jobId: data.job_id,
      recipient: {
        email: data.recipient_email,
        name: data.recipient_name,
        variables: data.variables,
        prospectId: data.prospect_id,
        metadata: data.metadata,
      },
      status: data.status,
      attempts: data.attempts,
      lastError: data.last_error,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  }
}

// =============================================
// FACTORY
// =============================================

let bulkEmailServiceInstance: BulkEmailService | null = null;

export function createBulkEmailService(): BulkEmailService {
  if (!bulkEmailServiceInstance) {
    bulkEmailServiceInstance = new BulkEmailService();
  }
  return bulkEmailServiceInstance;
}
