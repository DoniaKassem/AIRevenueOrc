/**
 * Email Tracking System
 * Tracks email opens, clicks, replies, and bounces
 */

import crypto from 'crypto';
import { supabase } from '../supabase';

export interface EmailTrackingData {
  emailId: string;
  prospectId: string;
  teamId: string;
  trackingEnabled: boolean;
  openTrackingUrl?: string;
  linkTrackingUrls?: Map<string, string>;
}

export interface EmailOpenEvent {
  emailId: string;
  prospectId: string;
  openedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

export interface EmailClickEvent {
  emailId: string;
  prospectId: string;
  url: string;
  clickedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
}

export interface EmailReplyEvent {
  emailId: string;
  prospectId: string;
  repliedAt: Date;
  subject: string;
  body: string;
  threadId?: string;
}

export interface EmailBounceEvent {
  emailId: string;
  prospectId: string;
  bounceType: 'hard' | 'soft' | 'complaint';
  bounceReason: string;
  bouncedAt: Date;
}

/**
 * Email Tracking Manager
 */
export class EmailTrackingManager {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  /**
   * Generate tracking data for email
   */
  async generateTrackingData(params: {
    emailId: string;
    prospectId: string;
    teamId: string;
    emailBody: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
  }): Promise<EmailTrackingData> {
    const trackingData: EmailTrackingData = {
      emailId: params.emailId,
      prospectId: params.prospectId,
      teamId: params.teamId,
      trackingEnabled: params.trackOpens || params.trackClicks || false,
    };

    // Generate open tracking pixel URL
    if (params.trackOpens) {
      trackingData.openTrackingUrl = await this.generateOpenTrackingUrl(
        params.emailId,
        params.prospectId
      );
    }

    // Generate link tracking URLs
    if (params.trackClicks) {
      trackingData.linkTrackingUrls = await this.generateLinkTrackingUrls(
        params.emailId,
        params.prospectId,
        params.emailBody
      );
    }

    return trackingData;
  }

  /**
   * Inject tracking into email HTML
   */
  injectTracking(emailHtml: string, trackingData: EmailTrackingData): string {
    let trackedHtml = emailHtml;

    // Inject open tracking pixel
    if (trackingData.openTrackingUrl) {
      const trackingPixel = `<img src="${trackingData.openTrackingUrl}" width="1" height="1" alt="" style="display:block; border:0; outline:none;" />`;

      // Insert before closing body tag if exists, otherwise append
      if (trackedHtml.includes('</body>')) {
        trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);
      } else {
        trackedHtml += trackingPixel;
      }
    }

    // Replace links with tracked links
    if (trackingData.linkTrackingUrls && trackingData.linkTrackingUrls.size > 0) {
      trackingData.linkTrackingUrls.forEach((trackedUrl, originalUrl) => {
        const urlPattern = new RegExp(`href=["']${this.escapeRegex(originalUrl)}["']`, 'g');
        trackedHtml = trackedHtml.replace(urlPattern, `href="${trackedUrl}"`);
      });
    }

    return trackedHtml;
  }

  /**
   * Record email open event
   */
  async recordOpen(params: {
    emailId: string;
    prospectId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Check if already opened (prevent duplicate counting of initial open)
      const { data: existing } = await supabase
        .from('email_tracking_events')
        .select('id')
        .eq('email_id', params.emailId)
        .eq('event_type', 'open')
        .single();

      const isFirstOpen = !existing;

      // Record open event
      await supabase.from('email_tracking_events').insert({
        email_id: params.emailId,
        prospect_id: params.prospectId,
        event_type: 'open',
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        device_type: this.detectDeviceType(params.userAgent),
        is_first_open: isFirstOpen,
        occurred_at: new Date().toISOString(),
      });

      // Update email record
      await this.updateEmailStatus(params.emailId, 'opened');

      // Create activity
      await this.createActivity({
        prospectId: params.prospectId,
        activityType: 'email_opened',
        emailId: params.emailId,
      });

      console.log(`[EmailTracking] Recorded open for email ${params.emailId}`);
    } catch (error) {
      console.error('[EmailTracking] Failed to record open:', error);
    }
  }

  /**
   * Record email click event
   */
  async recordClick(params: {
    emailId: string;
    prospectId: string;
    url: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Record click event
      await supabase.from('email_tracking_events').insert({
        email_id: params.emailId,
        prospect_id: params.prospectId,
        event_type: 'click',
        url: params.url,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        device_type: this.detectDeviceType(params.userAgent),
        occurred_at: new Date().toISOString(),
      });

      // Update email record
      await this.updateEmailStatus(params.emailId, 'clicked');

      // Create activity
      await this.createActivity({
        prospectId: params.prospectId,
        activityType: 'email_clicked',
        emailId: params.emailId,
        metadata: { url: params.url },
      });

      console.log(`[EmailTracking] Recorded click for email ${params.emailId}, URL: ${params.url}`);
    } catch (error) {
      console.error('[EmailTracking] Failed to record click:', error);
    }
  }

  /**
   * Record email reply event
   */
  async recordReply(params: EmailReplyEvent): Promise<void> {
    try {
      // Record reply event
      await supabase.from('email_tracking_events').insert({
        email_id: params.emailId,
        prospect_id: params.prospectId,
        event_type: 'reply',
        occurred_at: params.repliedAt.toISOString(),
      });

      // Update email record
      await this.updateEmailStatus(params.emailId, 'replied');

      // Create activity
      await this.createActivity({
        prospectId: params.prospectId,
        activityType: 'email_replied',
        emailId: params.emailId,
        metadata: {
          subject: params.subject,
          threadId: params.threadId,
        },
      });

      // Create incoming reply record
      await supabase.from('incoming_replies').insert({
        prospect_id: params.prospectId,
        from_address: '', // Would be populated by email sync
        subject: params.subject,
        body: params.body,
        thread_id: params.threadId,
        received_at: params.repliedAt.toISOString(),
        processed: false,
      });

      console.log(`[EmailTracking] Recorded reply for email ${params.emailId}`);
    } catch (error) {
      console.error('[EmailTracking] Failed to record reply:', error);
    }
  }

  /**
   * Record email bounce event
   */
  async recordBounce(params: EmailBounceEvent): Promise<void> {
    try {
      // Record bounce event
      await supabase.from('email_tracking_events').insert({
        email_id: params.emailId,
        prospect_id: params.prospectId,
        event_type: 'bounce',
        bounce_type: params.bounceType,
        bounce_reason: params.bounceReason,
        occurred_at: params.bouncedAt.toISOString(),
      });

      // Update email record
      await this.updateEmailStatus(params.emailId, 'bounced');

      // If hard bounce, add to suppression list
      if (params.bounceType === 'hard' || params.bounceType === 'complaint') {
        await this.addToSuppressionList(params.prospectId, params.bounceType);
      }

      console.log(`[EmailTracking] Recorded ${params.bounceType} bounce for email ${params.emailId}`);
    } catch (error) {
      console.error('[EmailTracking] Failed to record bounce:', error);
    }
  }

  /**
   * Get email tracking statistics
   */
  async getEmailStats(emailId: string): Promise<{
    sent: boolean;
    opened: boolean;
    clicked: boolean;
    replied: boolean;
    bounced: boolean;
    openCount: number;
    clickCount: number;
    firstOpenedAt?: Date;
    lastOpenedAt?: Date;
    clicks: Array<{ url: string; clickedAt: Date }>;
  }> {
    const { data: events } = await supabase
      .from('email_tracking_events')
      .select('*')
      .eq('email_id', emailId)
      .order('occurred_at', { ascending: true });

    const opens = events?.filter(e => e.event_type === 'open') || [];
    const clicks = events?.filter(e => e.event_type === 'click') || [];
    const replies = events?.filter(e => e.event_type === 'reply') || [];
    const bounces = events?.filter(e => e.event_type === 'bounce') || [];

    return {
      sent: true,
      opened: opens.length > 0,
      clicked: clicks.length > 0,
      replied: replies.length > 0,
      bounced: bounces.length > 0,
      openCount: opens.length,
      clickCount: clicks.length,
      firstOpenedAt: opens[0] ? new Date(opens[0].occurred_at) : undefined,
      lastOpenedAt: opens[opens.length - 1] ? new Date(opens[opens.length - 1].occurred_at) : undefined,
      clicks: clicks.map(c => ({
        url: c.url,
        clickedAt: new Date(c.occurred_at),
      })),
    };
  }

  /**
   * Get prospect email engagement summary
   */
  async getProspectEngagement(prospectId: string): Promise<{
    emailsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    emailsReplied: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    lastEngaged?: Date;
  }> {
    const { data: sentEmails } = await supabase
      .from('bdr_activities')
      .select('id')
      .eq('prospect_id', prospectId)
      .eq('activity_type', 'email_sent');

    const emailsSent = sentEmails?.length || 0;

    const { data: events } = await supabase
      .from('email_tracking_events')
      .select('*')
      .eq('prospect_id', prospectId);

    const openedEmails = new Set(events?.filter(e => e.event_type === 'open').map(e => e.email_id));
    const clickedEmails = new Set(events?.filter(e => e.event_type === 'click').map(e => e.email_id));
    const repliedEmails = new Set(events?.filter(e => e.event_type === 'reply').map(e => e.email_id));

    const lastEvent = events?.[events.length - 1];
    const lastEngaged = lastEvent ? new Date(lastEvent.occurred_at) : undefined;

    return {
      emailsSent,
      emailsOpened: openedEmails.size,
      emailsClicked: clickedEmails.size,
      emailsReplied: repliedEmails.size,
      openRate: emailsSent > 0 ? (openedEmails.size / emailsSent) * 100 : 0,
      clickRate: emailsSent > 0 ? (clickedEmails.size / emailsSent) * 100 : 0,
      replyRate: emailsSent > 0 ? (repliedEmails.size / emailsSent) * 100 : 0,
      lastEngaged,
    };
  }

  // Private helper methods

  private async generateOpenTrackingUrl(emailId: string, prospectId: string): Promise<string> {
    const token = this.generateTrackingToken(emailId, prospectId);

    // Store token mapping
    await supabase.from('email_tracking_tokens').insert({
      token,
      email_id: emailId,
      prospect_id: prospectId,
      type: 'open',
      created_at: new Date().toISOString(),
    });

    return `${this.baseUrl}/api/track/open/${token}`;
  }

  private async generateLinkTrackingUrls(
    emailId: string,
    prospectId: string,
    emailBody: string
  ): Promise<Map<string, string>> {
    const linkMap = new Map<string, string>();

    // Extract all URLs from email body
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const urls = emailBody.match(urlRegex) || [];

    for (const url of urls) {
      const token = this.generateTrackingToken(emailId, prospectId);

      // Store token mapping with original URL
      await supabase.from('email_tracking_tokens').insert({
        token,
        email_id: emailId,
        prospect_id: prospectId,
        type: 'click',
        original_url: url,
        created_at: new Date().toISOString(),
      });

      const trackedUrl = `${this.baseUrl}/api/track/click/${token}`;
      linkMap.set(url, trackedUrl);
    }

    return linkMap;
  }

  private generateTrackingToken(emailId: string, prospectId: string): string {
    const data = `${emailId}:${prospectId}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private detectDeviceType(userAgent?: string): 'desktop' | 'mobile' | 'tablet' | null {
    if (!userAgent) return null;

    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile')) return 'mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
    return 'desktop';
  }

  private async updateEmailStatus(emailId: string, status: 'opened' | 'clicked' | 'replied' | 'bounced'): Promise<void> {
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status === 'opened') {
      updates.opened_at = new Date().toISOString();
    } else if (status === 'clicked') {
      updates.clicked_at = new Date().toISOString();
    } else if (status === 'replied') {
      updates.replied_at = new Date().toISOString();
    } else if (status === 'bounced') {
      updates.bounced_at = new Date().toISOString();
    }

    await supabase
      .from('bdr_activities')
      .update(updates)
      .eq('id', emailId);
  }

  private async createActivity(params: {
    prospectId: string;
    activityType: string;
    emailId: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await supabase.from('bdr_activities').insert({
      prospect_id: params.prospectId,
      activity_type: params.activityType,
      direction: 'inbound',
      metadata: {
        ...params.metadata,
        email_id: params.emailId,
      },
      created_at: new Date().toISOString(),
    });
  }

  private async addToSuppressionList(prospectId: string, reason: 'hard' | 'complaint'): Promise<void> {
    // Get prospect email
    const { data: prospect } = await supabase
      .from('prospects')
      .select('email')
      .eq('id', prospectId)
      .single();

    if (!prospect?.email) return;

    await supabase.from('email_suppression_list').insert({
      email: prospect.email,
      suppression_type: reason === 'hard' ? 'bounce' : 'complaint',
      reason: reason === 'hard' ? 'Hard bounce' : 'Spam complaint',
      suppressed_at: new Date().toISOString(),
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Create email tracking manager instance
 */
export function createEmailTrackingManager(): EmailTrackingManager {
  return new EmailTrackingManager();
}

/**
 * Verify tracking token and get email/prospect IDs
 */
export async function verifyTrackingToken(token: string): Promise<{
  valid: boolean;
  emailId?: string;
  prospectId?: string;
  originalUrl?: string;
} | null> {
  const { data } = await supabase
    .from('email_tracking_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (!data) {
    return { valid: false };
  }

  return {
    valid: true,
    emailId: data.email_id,
    prospectId: data.prospect_id,
    originalUrl: data.original_url,
  };
}
