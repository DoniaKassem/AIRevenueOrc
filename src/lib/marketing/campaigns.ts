/**
 * Marketing Campaigns
 * Email campaign management, segmentation, and sending
 */

import { supabase } from '../supabase';

export interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'landing_page' | 'social' | 'ads' | 'event';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'archived';

  // Email campaign specific
  subject?: string;
  preheader?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;

  // Content
  htmlContent?: string;
  textContent?: string;

  // Targeting
  segmentId?: string;
  contactListIds?: string[];
  excludeListIds?: string[];

  // Scheduling
  scheduledAt?: Date;
  sentAt?: Date;

  // Settings
  abTestEnabled: boolean;
  abTestVariants?: Array<{
    name: string;
    subject: string;
    content: string;
    percentage: number;
  }>;

  // Tracking
  trackOpens: boolean;
  trackClicks: boolean;

  // Stats
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    complained: number;
  };

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  contactCount: number;
  lastCalculated: Date;
}

export interface SegmentCriteria {
  conditions: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
    value: any;
  }>;
  logic: 'AND' | 'OR';
}

export interface EmailStats {
  campaignId: string;
  sent: number;
  delivered: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  complaintRate: number;

  topLinks: Array<{
    url: string;
    clicks: number;
  }>;

  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };

  locationBreakdown: Record<string, number>;
}

/**
 * Marketing Campaigns Service
 */
export class MarketingCampaigns {
  /**
   * Create a new campaign
   */
  async createCampaign(campaign: Partial<Campaign>): Promise<Campaign> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        name: campaign.name,
        type: campaign.type || 'email',
        status: 'draft',
        subject: campaign.subject,
        preheader: campaign.preheader,
        from_name: campaign.fromName,
        from_email: campaign.fromEmail,
        reply_to: campaign.replyTo,
        html_content: campaign.htmlContent,
        text_content: campaign.textContent,
        segment_id: campaign.segmentId,
        contact_list_ids: campaign.contactListIds,
        exclude_list_ids: campaign.excludeListIds,
        ab_test_enabled: campaign.abTestEnabled || false,
        ab_test_variants: campaign.abTestVariants,
        track_opens: campaign.trackOpens !== false,
        track_clicks: campaign.trackClicks !== false,
        stats: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          complained: 0
        }
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCampaign(data);
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign> {
    const { data, error } = await supabase
      .from('marketing_campaigns')
      .update({
        name: updates.name,
        subject: updates.subject,
        preheader: updates.preheader,
        from_name: updates.fromName,
        from_email: updates.fromEmail,
        reply_to: updates.replyTo,
        html_content: updates.htmlContent,
        text_content: updates.textContent,
        segment_id: updates.segmentId,
        contact_list_ids: updates.contactListIds,
        exclude_list_ids: updates.excludeListIds,
        scheduled_at: updates.scheduledAt?.toISOString(),
        ab_test_enabled: updates.abTestEnabled,
        ab_test_variants: updates.abTestVariants,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return this.mapCampaign(data);
  }

  /**
   * Send campaign immediately or schedule
   */
  async sendCampaign(campaignId: string, scheduledAt?: Date): Promise<{
    success: boolean;
    recipientCount: number;
    message: string;
  }> {
    // Get campaign
    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get recipients
    const recipients = await this.getRecipients(campaign);

    if (recipients.length === 0) {
      throw new Error('No recipients found for this campaign');
    }

    // Update campaign status
    if (scheduledAt) {
      await supabase
        .from('marketing_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString()
        })
        .eq('id', campaignId);

      return {
        success: true,
        recipientCount: recipients.length,
        message: `Campaign scheduled for ${scheduledAt.toISOString()}`
      };
    } else {
      // Send immediately
      await supabase
        .from('marketing_campaigns')
        .update({
          status: 'sending',
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Queue emails for sending
      await this.queueEmails(campaignId, recipients);

      return {
        success: true,
        recipientCount: recipients.length,
        message: `Campaign sending to ${recipients.length} recipients`
      };
    }
  }

  /**
   * Get campaign recipients based on segment and lists
   */
  private async getRecipients(campaign: any): Promise<any[]> {
    let query = supabase
      .from('prospects')
      .select('id, email, first_name, last_name')
      .eq('email_unsubscribed', false);

    // Apply segment criteria
    if (campaign.segment_id) {
      const { data: segment } = await supabase
        .from('contact_segments')
        .select('criteria')
        .eq('id', campaign.segment_id)
        .single();

      if (segment?.criteria) {
        query = this.applySegmentCriteria(query, segment.criteria);
      }
    }

    // Include specific lists
    if (campaign.contact_list_ids?.length > 0) {
      query = query.in('id',
        supabase
          .from('contact_list_members')
          .select('prospect_id')
          .in('list_id', campaign.contact_list_ids)
      );
    }

    // Exclude specific lists
    if (campaign.exclude_list_ids?.length > 0) {
      query = query.not('id', 'in',
        supabase
          .from('contact_list_members')
          .select('prospect_id')
          .in('list_id', campaign.exclude_list_ids)
      );
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Apply segment criteria to query
   */
  private applySegmentCriteria(query: any, criteria: SegmentCriteria): any {
    criteria.conditions.forEach(condition => {
      switch (condition.operator) {
        case 'equals':
          query = query.eq(condition.field, condition.value);
          break;
        case 'not_equals':
          query = query.neq(condition.field, condition.value);
          break;
        case 'contains':
          query = query.ilike(condition.field, `%${condition.value}%`);
          break;
        case 'not_contains':
          query = query.not(condition.field, 'ilike', `%${condition.value}%`);
          break;
        case 'starts_with':
          query = query.ilike(condition.field, `${condition.value}%`);
          break;
        case 'ends_with':
          query = query.ilike(condition.field, `%${condition.value}`);
          break;
        case 'greater_than':
          query = query.gt(condition.field, condition.value);
          break;
        case 'less_than':
          query = query.lt(condition.field, condition.value);
          break;
        case 'is_empty':
          query = query.is(condition.field, null);
          break;
        case 'is_not_empty':
          query = query.not(condition.field, 'is', null);
          break;
      }
    });

    return query;
  }

  /**
   * Queue emails for sending
   */
  private async queueEmails(campaignId: string, recipients: any[]): Promise<void> {
    const emailRecords = recipients.map(recipient => ({
      campaign_id: campaignId,
      prospect_id: recipient.id,
      recipient_email: recipient.email,
      status: 'queued',
      queued_at: new Date().toISOString()
    }));

    // Insert in batches of 1000
    for (let i = 0; i < emailRecords.length; i += 1000) {
      const batch = emailRecords.slice(i, i + 1000);
      await supabase.from('campaign_emails').insert(batch);
    }
  }

  /**
   * Create contact segment
   */
  async createSegment(segment: Partial<ContactSegment>): Promise<ContactSegment> {
    const { data, error } = await supabase
      .from('contact_segments')
      .insert({
        name: segment.name,
        description: segment.description,
        criteria: segment.criteria
      })
      .select()
      .single();

    if (error) throw error;

    // Calculate contact count
    const count = await this.calculateSegmentSize(data.id, segment.criteria!);

    await supabase
      .from('contact_segments')
      .update({
        contact_count: count,
        last_calculated: new Date().toISOString()
      })
      .eq('id', data.id);

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      criteria: data.criteria,
      contactCount: count,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate segment size
   */
  async calculateSegmentSize(segmentId: string, criteria: SegmentCriteria): Promise<number> {
    let query = supabase
      .from('prospects')
      .select('id', { count: 'exact', head: true });

    query = this.applySegmentCriteria(query, criteria);

    const { count } = await query;
    return count || 0;
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<EmailStats> {
    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('stats')
      .eq('id', campaignId)
      .single();

    const stats = campaign?.stats || {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      complained: 0
    };

    // Calculate rates
    const openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0;
    const clickRate = stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0;
    const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0;
    const unsubscribeRate = stats.delivered > 0 ? (stats.unsubscribed / stats.delivered) * 100 : 0;
    const complaintRate = stats.delivered > 0 ? (stats.complained / stats.delivered) * 100 : 0;

    // Get top links
    const { data: clicks } = await supabase
      .from('campaign_email_clicks')
      .select('url')
      .eq('campaign_id', campaignId);

    const linkCounts: Record<string, number> = {};
    clicks?.forEach(click => {
      linkCounts[click.url] = (linkCounts[click.url] || 0) + 1;
    });

    const topLinks = Object.entries(linkCounts)
      .map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Get device breakdown
    const { data: events } = await supabase
      .from('campaign_email_events')
      .select('device_type')
      .eq('campaign_id', campaignId)
      .eq('event_type', 'open');

    const deviceBreakdown = {
      desktop: events?.filter(e => e.device_type === 'desktop').length || 0,
      mobile: events?.filter(e => e.device_type === 'mobile').length || 0,
      tablet: events?.filter(e => e.device_type === 'tablet').length || 0
    };

    return {
      campaignId,
      sent: stats.sent,
      delivered: stats.delivered,
      openRate,
      clickRate,
      bounceRate,
      unsubscribeRate,
      complaintRate,
      topLinks,
      deviceBreakdown,
      locationBreakdown: {} // Would aggregate from IP data
    };
  }

  /**
   * Test send campaign to specific emails
   */
  async testSend(campaignId: string, emails: string[]): Promise<{ success: boolean; message: string }> {
    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Queue test emails
    const testEmails = emails.map(email => ({
      campaign_id: campaignId,
      recipient_email: email,
      status: 'queued',
      is_test: true,
      queued_at: new Date().toISOString()
    }));

    await supabase.from('campaign_emails').insert(testEmails);

    return {
      success: true,
      message: `Test emails queued for ${emails.length} recipient(s)`
    };
  }

  /**
   * Pause sending campaign
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId);
  }

  /**
   * Resume sending campaign
   */
  async resumeCampaign(campaignId: string): Promise<void> {
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);
  }

  /**
   * Archive campaign
   */
  async archiveCampaign(campaignId: string): Promise<void> {
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'archived' })
      .eq('id', campaignId);
  }

  /**
   * Duplicate campaign
   */
  async duplicateCampaign(campaignId: string, newName: string): Promise<Campaign> {
    const { data: original } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!original) {
      throw new Error('Campaign not found');
    }

    return this.createCampaign({
      name: newName,
      type: original.type,
      subject: original.subject,
      preheader: original.preheader,
      fromName: original.from_name,
      fromEmail: original.from_email,
      replyTo: original.reply_to,
      htmlContent: original.html_content,
      textContent: original.text_content,
      segmentId: original.segment_id,
      contactListIds: original.contact_list_ids,
      excludeListIds: original.exclude_list_ids,
      abTestEnabled: original.ab_test_enabled,
      abTestVariants: original.ab_test_variants,
      trackOpens: original.track_opens,
      trackClicks: original.track_clicks
    });
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(filters?: {
    type?: Campaign['type'];
    status?: Campaign['status'];
    limit?: number;
    offset?: number;
  }): Promise<Campaign[]> {
    let query = supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapCampaign);
  }

  /**
   * Map database record to Campaign
   */
  private mapCampaign(data: any): Campaign {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      status: data.status,
      subject: data.subject,
      preheader: data.preheader,
      fromName: data.from_name,
      fromEmail: data.from_email,
      replyTo: data.reply_to,
      htmlContent: data.html_content,
      textContent: data.text_content,
      segmentId: data.segment_id,
      contactListIds: data.contact_list_ids,
      excludeListIds: data.exclude_list_ids,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      abTestEnabled: data.ab_test_enabled,
      abTestVariants: data.ab_test_variants,
      trackOpens: data.track_opens,
      trackClicks: data.track_clicks,
      stats: data.stats,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create Marketing Campaigns Service
 */
export function createMarketingCampaigns(): MarketingCampaigns {
  return new MarketingCampaigns();
}
