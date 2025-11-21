/**
 * Analytics Service
 * Fetches and calculates outreach performance metrics
 */

import { supabase } from '../supabase';

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  strategy: string;

  // Volume metrics
  prospectsEnrolled: number;
  totalTouches: number;
  emailsSent: number;
  linkedInSent: number;
  phoneCallsMade: number;

  // Engagement metrics
  emailsOpened: number;
  emailsClicked: number;
  repliesReceived: number;

  // Outcome metrics
  meetingsScheduled: number;
  opportunitiesCreated: number;

  // Rates
  openRate: number;
  clickRate: number;
  replyRate: number;
  meetingRate: number;
  opportunityRate: number;

  // Status
  isActive: boolean;
  startedAt: string;

  // ROI
  estimatedRevenue?: number;
  costPerMeeting?: number;
}

export interface ChannelPerformance {
  channel: 'email' | 'linkedin' | 'phone';

  // Volume
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;

  // Engagement
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;

  // Outcomes
  meetingsScheduled: number;
  opportunitiesCreated: number;

  // Rates
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  meetingRate: number;

  // Trend (vs previous period)
  replyRateTrend: number; // percentage change
  meetingRateTrend: number;
}

export interface TemplatePerformance {
  templateId: string;
  templateName: string;
  category: string;

  timesSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  meetingRate: number;

  avgTimeToReply?: number; // hours
  sentimentScore?: number;
}

export interface AgentPerformance {
  // Overall activity
  totalProspectsContacted: number;
  totalTouches: number;
  totalRepliesProcessed: number;

  // Automation rates
  automatedResponsesRate: number;
  humanEscalationRate: number;
  autoApprovalRate: number;

  // Effectiveness
  objectionHandlingSuccessRate: number;
  meetingSchedulingSuccessRate: number;
  avgResponseTime: number; // minutes

  // By routing destination
  routingBreakdown: {
    objectionHandler: number;
    meetingScheduler: number;
    autoResponder: number;
    human: number;
    suppression: number;
  };

  // Quality metrics
  avgConfidence: number;
  falsePositiveRate?: number;
}

export interface ResponseTrend {
  date: string;
  totalSent: number;
  totalReplies: number;
  totalMeetings: number;
  replyRate: number;
  meetingRate: number;
}

export interface SendTimeAnalysis {
  hour: number;
  dayOfWeek: string;

  totalSent: number;
  openRate: number;
  replyRate: number;
  meetingRate: number;

  score: number; // 0-100
}

export interface ObjectionAnalysis {
  objectionType: string;
  count: number;
  percentage: number;

  severity: {
    soft: number;
    medium: number;
    hard: number;
  };

  handledSuccessfully: number;
  escalatedToHuman: number;
  avgResolutionTime?: number; // hours
}

export interface OutreachROI {
  totalCost: number;
  totalRevenue: number;
  roi: number; // percentage

  costBreakdown: {
    toolSubscriptions: number;
    timeInvested: number;
    dataEnrichment: number;
  };

  revenueBreakdown: {
    pipelineGenerated: number;
    closedWonRevenue: number;
    expectedRevenue: number;
  };

  metrics: {
    costPerProspect: number;
    costPerMeeting: number;
    costPerOpportunity: number;
    revenuePerProspect: number;
  };
}

/**
 * Analytics Service
 */
export class AnalyticsService {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Get campaign performance for all campaigns
   */
  async getCampaignPerformance(daysBack: number = 30): Promise<CampaignPerformance[]> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: campaigns } = await supabase
      .from('outreach_campaigns')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (!campaigns) return [];

    const performance: CampaignPerformance[] = [];

    for (const campaign of campaigns) {
      // Get enrollment stats
      const { data: enrollments } = await supabase
        .from('campaign_enrollments')
        .select('*')
        .eq('campaign_id', campaign.id);

      // Get activity stats
      const { data: activities } = await supabase
        .from('bdr_activities')
        .select('*')
        .eq('team_id', this.teamId)
        .contains('metadata', { campaign_id: campaign.id });

      const emailsSent = activities?.filter(a => a.activity_type === 'email_sent').length || 0;
      const linkedInSent = activities?.filter(a => a.activity_type === 'linkedin_message_sent').length || 0;
      const phoneCallsMade = activities?.filter(a => a.activity_type === 'phone_call_made').length || 0;
      const emailsOpened = activities?.filter(a => a.activity_type === 'email_opened').length || 0;
      const emailsClicked = activities?.filter(a => a.activity_type === 'email_clicked').length || 0;
      const repliesReceived = activities?.filter(a => a.activity_type === 'email_received').length || 0;
      const meetingsScheduled = enrollments?.filter(e => e.meeting_scheduled).length || 0;

      const totalTouches = emailsSent + linkedInSent + phoneCallsMade;

      performance.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        strategy: campaign.strategy_type,
        prospectsEnrolled: campaign.prospects_enrolled || 0,
        totalTouches,
        emailsSent,
        linkedInSent,
        phoneCallsMade,
        emailsOpened,
        emailsClicked,
        repliesReceived,
        meetingsScheduled,
        opportunitiesCreated: 0, // Would need CRM integration
        openRate: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0,
        clickRate: emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0,
        replyRate: totalTouches > 0 ? (repliesReceived / totalTouches) * 100 : 0,
        meetingRate: totalTouches > 0 ? (meetingsScheduled / totalTouches) * 100 : 0,
        opportunityRate: 0,
        isActive: campaign.is_active,
        startedAt: campaign.started_at || campaign.created_at,
        costPerMeeting: meetingsScheduled > 0 ? 50 : undefined, // Placeholder
      });
    }

    return performance;
  }

  /**
   * Get channel performance comparison
   */
  async getChannelPerformance(daysBack: number = 30): Promise<ChannelPerformance[]> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const previousPeriodSince = new Date(since.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const channels: Array<'email' | 'linkedin' | 'phone'> = ['email', 'linkedin', 'phone'];
    const performance: ChannelPerformance[] = [];

    for (const channel of channels) {
      // Current period
      const { data: current } = await supabase
        .from('channel_performance_daily')
        .select('*')
        .eq('team_id', this.teamId)
        .eq('channel', channel)
        .gte('date', since.toISOString().split('T')[0]);

      // Previous period for trend
      const { data: previous } = await supabase
        .from('channel_performance_daily')
        .select('*')
        .eq('team_id', this.teamId)
        .eq('channel', channel)
        .gte('date', previousPeriodSince.toISOString().split('T')[0])
        .lt('date', since.toISOString().split('T')[0]);

      const currentStats = this.aggregateChannelStats(current || []);
      const previousStats = this.aggregateChannelStats(previous || []);

      performance.push({
        channel,
        totalSent: currentStats.sent,
        totalDelivered: currentStats.delivered,
        totalBounced: currentStats.bounced,
        totalOpened: currentStats.opened,
        totalClicked: currentStats.clicked,
        totalReplied: currentStats.replied,
        meetingsScheduled: currentStats.meetings,
        opportunitiesCreated: 0,
        deliveryRate: currentStats.sent > 0 ? (currentStats.delivered / currentStats.sent) * 100 : 0,
        openRate: currentStats.sent > 0 ? (currentStats.opened / currentStats.sent) * 100 : 0,
        clickRate: currentStats.sent > 0 ? (currentStats.clicked / currentStats.sent) * 100 : 0,
        replyRate: currentStats.sent > 0 ? (currentStats.replied / currentStats.sent) * 100 : 0,
        meetingRate: currentStats.sent > 0 ? (currentStats.meetings / currentStats.sent) * 100 : 0,
        replyRateTrend: this.calculateTrend(currentStats.replyRate, previousStats.replyRate),
        meetingRateTrend: this.calculateTrend(currentStats.meetingRate, previousStats.meetingRate),
      });
    }

    return performance;
  }

  /**
   * Get template performance leaderboard
   */
  async getTemplatePerformance(limit: number = 10): Promise<TemplatePerformance[]> {
    const { data: templates } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('team_id', this.teamId)
      .order('times_used', { ascending: false })
      .limit(limit);

    if (!templates) return [];

    return templates.map(t => ({
      templateId: t.id,
      templateName: t.name,
      category: t.category,
      timesSent: t.times_used || 0,
      openRate: t.open_rate || 0,
      clickRate: t.click_rate || 0,
      replyRate: t.reply_rate || 0,
      meetingRate: t.meeting_rate || 0,
      avgTimeToReply: t.avg_time_to_reply,
      sentimentScore: t.avg_sentiment_score,
    }));
  }

  /**
   * Get BDR agent performance metrics
   */
  async getAgentPerformance(daysBack: number = 30): Promise<AgentPerformance> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get routing decisions
    const { data: decisions } = await supabase
      .from('response_routing_decisions')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('processed_at', since.toISOString());

    // Get activities
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('created_at', since.toISOString());

    const totalRepliesProcessed = decisions?.length || 0;
    const automatedResponses = decisions?.filter(d => d.response_sent && !d.requires_human_review).length || 0;
    const humanEscalations = decisions?.filter(d => d.escalated_to_human).length || 0;
    const objectionHandling = decisions?.filter(d => d.routed_to === 'objection_handler').length || 0;
    const objectionSuccess = decisions?.filter(d => d.objection_handled).length || 0;
    const meetingScheduling = decisions?.filter(d => d.routed_to === 'meeting_scheduler').length || 0;
    const meetingSuccess = decisions?.filter(d => d.meeting_scheduled).length || 0;

    // Routing breakdown
    const routingBreakdown = {
      objectionHandler: decisions?.filter(d => d.routed_to === 'objection_handler').length || 0,
      meetingScheduler: decisions?.filter(d => d.routed_to === 'meeting_scheduler').length || 0,
      autoResponder: decisions?.filter(d => d.routed_to === 'auto_responder').length || 0,
      human: decisions?.filter(d => d.routed_to === 'human').length || 0,
      suppression: decisions?.filter(d => d.routed_to === 'suppression').length || 0,
    };

    // Calculate avg confidence
    const totalConfidence = decisions?.reduce((sum, d) => sum + (d.confidence || 0), 0) || 0;
    const avgConfidence = totalRepliesProcessed > 0 ? totalConfidence / totalRepliesProcessed : 0;

    // Count unique prospects contacted
    const uniqueProspects = new Set(activities?.map(a => a.prospect_id) || []).size;

    return {
      totalProspectsContacted: uniqueProspects,
      totalTouches: activities?.filter(a => a.direction === 'outbound').length || 0,
      totalRepliesProcessed,
      automatedResponsesRate: totalRepliesProcessed > 0 ? (automatedResponses / totalRepliesProcessed) * 100 : 0,
      humanEscalationRate: totalRepliesProcessed > 0 ? (humanEscalations / totalRepliesProcessed) * 100 : 0,
      autoApprovalRate: totalRepliesProcessed > 0 ? (automatedResponses / totalRepliesProcessed) * 100 : 0,
      objectionHandlingSuccessRate: objectionHandling > 0 ? (objectionSuccess / objectionHandling) * 100 : 0,
      meetingSchedulingSuccessRate: meetingScheduling > 0 ? (meetingSuccess / meetingScheduling) * 100 : 0,
      avgResponseTime: 15, // Placeholder - would need to track actual times
      routingBreakdown,
      avgConfidence: avgConfidence * 100,
    };
  }

  /**
   * Get response trends over time
   */
  async getResponseTrends(daysBack: number = 30): Promise<ResponseTrend[]> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (!activities) return [];

    // Group by date
    const byDate: Record<string, any> = {};

    for (const activity of activities) {
      const date = activity.created_at.split('T')[0];
      if (!byDate[date]) {
        byDate[date] = {
          totalSent: 0,
          totalReplies: 0,
          totalMeetings: 0,
        };
      }

      if (activity.direction === 'outbound') {
        byDate[date].totalSent++;
      }
      if (activity.direction === 'inbound') {
        byDate[date].totalReplies++;
      }
      if (activity.activity_type === 'meeting_scheduled') {
        byDate[date].totalMeetings++;
      }
    }

    const trends: ResponseTrend[] = Object.entries(byDate).map(([date, stats]) => ({
      date,
      totalSent: stats.totalSent,
      totalReplies: stats.totalReplies,
      totalMeetings: stats.totalMeetings,
      replyRate: stats.totalSent > 0 ? (stats.totalReplies / stats.totalSent) * 100 : 0,
      meetingRate: stats.totalSent > 0 ? (stats.totalMeetings / stats.totalSent) * 100 : 0,
    }));

    return trends;
  }

  /**
   * Get best performing send times
   */
  async getSendTimeAnalysis(): Promise<SendTimeAnalysis[]> {
    const { data: analytics } = await supabase
      .from('send_time_analytics')
      .select('*')
      .eq('team_id', this.teamId);

    if (!analytics) return [];

    return analytics.map(a => ({
      hour: a.hour_of_day,
      dayOfWeek: this.getDayName(a.day_of_week),
      totalSent: a.total_sent || 0,
      openRate: a.open_rate || 0,
      replyRate: a.reply_rate || 0,
      meetingRate: a.meeting_rate || 0,
      score: this.calculateSendTimeScore(a),
    }));
  }

  /**
   * Get objection breakdown
   */
  async getObjectionAnalysis(daysBack: number = 30): Promise<ObjectionAnalysis[]> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: objections } = await supabase
      .from('objection_log')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('detected_at', since.toISOString());

    if (!objections) return [];

    // Group by type
    const byType: Record<string, any> = {};
    const total = objections.length;

    for (const objection of objections) {
      if (!byType[objection.objection_type]) {
        byType[objection.objection_type] = {
          count: 0,
          soft: 0,
          medium: 0,
          hard: 0,
          handled: 0,
          escalated: 0,
        };
      }

      byType[objection.objection_type].count++;
      byType[objection.objection_type][objection.severity]++;
      if (objection.resolution_status === 'handled') byType[objection.objection_type].handled++;
      if (objection.escalated_to_human) byType[objection.objection_type].escalated++;
    }

    return Object.entries(byType).map(([type, stats]) => ({
      objectionType: type,
      count: stats.count,
      percentage: (stats.count / total) * 100,
      severity: {
        soft: stats.soft,
        medium: stats.medium,
        hard: stats.hard,
      },
      handledSuccessfully: stats.handled,
      escalatedToHuman: stats.escalated,
    }));
  }

  /**
   * Calculate ROI
   */
  async calculateROI(params: {
    toolCosts: number;
    hourlyRate: number;
    hoursInvested: number;
    dataEnrichmentCost: number;
    avgDealSize: number;
    closedWonCount: number;
    pipelineCount: number;
  }): Promise<OutreachROI> {
    const totalCost =
      params.toolCosts +
      params.hourlyRate * params.hoursInvested +
      params.dataEnrichmentCost;

    const closedWonRevenue = params.avgDealSize * params.closedWonCount;
    const pipelineRevenue = params.avgDealSize * params.pipelineCount * 0.25; // Assume 25% close rate
    const totalRevenue = closedWonRevenue + pipelineRevenue;

    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

    // Get metrics from recent performance
    const agentPerf = await this.getAgentPerformance(30);
    const channelPerf = await this.getChannelPerformance(30);
    const totalMeetings = channelPerf.reduce((sum, c) => sum + c.meetingsScheduled, 0);

    return {
      totalCost,
      totalRevenue,
      roi,
      costBreakdown: {
        toolSubscriptions: params.toolCosts,
        timeInvested: params.hourlyRate * params.hoursInvested,
        dataEnrichment: params.dataEnrichmentCost,
      },
      revenueBreakdown: {
        pipelineGenerated: pipelineRevenue,
        closedWonRevenue,
        expectedRevenue: totalRevenue,
      },
      metrics: {
        costPerProspect: agentPerf.totalProspectsContacted > 0 ? totalCost / agentPerf.totalProspectsContacted : 0,
        costPerMeeting: totalMeetings > 0 ? totalCost / totalMeetings : 0,
        costPerOpportunity: params.pipelineCount > 0 ? totalCost / params.pipelineCount : 0,
        revenuePerProspect: agentPerf.totalProspectsContacted > 0 ? totalRevenue / agentPerf.totalProspectsContacted : 0,
      },
    };
  }

  // Private helper methods

  private aggregateChannelStats(records: any[]): {
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
    meetings: number;
    replyRate: number;
    meetingRate: number;
  } {
    const stats = {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      meetings: 0,
      replyRate: 0,
      meetingRate: 0,
    };

    for (const record of records) {
      stats.sent += record.sent || 0;
      stats.delivered += record.delivered || 0;
      stats.bounced += record.bounced || 0;
      stats.opened += record.opened || 0;
      stats.clicked += record.clicked || 0;
      stats.replied += record.replied || 0;
      stats.meetings += record.meetings_scheduled || 0;
    }

    stats.replyRate = stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0;
    stats.meetingRate = stats.sent > 0 ? (stats.meetings / stats.sent) * 100 : 0;

    return stats;
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private calculateSendTimeScore(analytics: any): number {
    // Weight factors: reply rate (50%), meeting rate (30%), open rate (20%)
    const replyScore = (analytics.reply_rate || 0) * 0.5;
    const meetingScore = (analytics.meeting_rate || 0) * 0.3;
    const openScore = (analytics.open_rate || 0) * 0.2;

    return Math.min(100, replyScore + meetingScore + openScore);
  }

  private getDayName(dayNumber: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  }
}

/**
 * Create analytics service instance
 */
export function createAnalyticsService(teamId: string): AnalyticsService {
  return new AnalyticsService(teamId);
}
