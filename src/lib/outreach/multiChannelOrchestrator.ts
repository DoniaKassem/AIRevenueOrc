/**
 * Multi-Channel Orchestrator
 * Intelligently coordinates outreach across email, LinkedIn, and phone
 */

import { supabase } from '../supabase';
import { IntegratedOutreachEngine } from './integratedOutreachEngine';
import { LinkedInAutomationManager } from './linkedInAutomation';

export interface ChannelStrategy {
  channels: Array<{
    channel: 'email' | 'linkedin' | 'phone';
    priority: number;  // 1 = highest
    when: 'immediate' | 'after_no_response' | 'concurrent' | 'conditional';
    delayDays?: number;
    condition?: string;
  }>;
  maxTotalTouches: number;
  stopOnResponse: boolean;
}

export interface ChannelPerformance {
  channel: 'email' | 'linkedin' | 'phone';
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  meetings: number;
  openRate: number;
  replyRate: number;
  meetingRate: number;
}

export interface ChannelRecommendation {
  recommendedChannel: 'email' | 'linkedin' | 'phone';
  confidence: number;
  reasoning: string;
  alternativeChannels: Array<{
    channel: string;
    score: number;
    reason: string;
  }>;
}

/**
 * Multi-Channel Orchestrator
 * Coordinates outreach across multiple channels
 */
export class MultiChannelOrchestrator {
  private teamId: string;
  private userId: string;
  private outreachEngine: IntegratedOutreachEngine;
  private linkedInManager: LinkedInAutomationManager;

  constructor(teamId: string, userId: string) {
    this.teamId = teamId;
    this.userId = userId;
    this.outreachEngine = new IntegratedOutreachEngine(teamId, userId);
    this.linkedInManager = new LinkedInAutomationManager(teamId);
  }

  /**
   * Execute multi-channel campaign for a prospect
   */
  async executeCampaign(params: {
    prospectId: string;
    strategy: 'aggressive' | 'balanced' | 'patient';
    startImmediately?: boolean;
  }): Promise<{
    success: boolean;
    scheduledTouches: Array<{
      touchNumber: number;
      channel: string;
      scheduledFor: Date;
      taskId: string;
    }>;
  }> {
    const prospect = await this.getProspect(params.prospectId);
    const strategy = this.getChannelStrategy(params.strategy, prospect);

    const scheduledTouches: any[] = [];
    let touchNumber = 1;

    // Schedule touches according to strategy
    for (const channelConfig of strategy.channels) {
      const scheduledFor = this.calculateScheduleTime(
        touchNumber,
        channelConfig,
        params.startImmediately
      );

      // Create task
      const { data: task } = await supabase
        .from('bdr_tasks')
        .insert({
          team_id: this.teamId,
          prospect_id: params.prospectId,
          task_type: 'engage',
          status: 'pending',
          priority: channelConfig.priority,
          scheduled_for: scheduledFor.toISOString(),
          config: {
            channel: channelConfig.channel,
            touchNumber,
            strategyType: params.strategy,
            stopOnResponse: strategy.stopOnResponse,
          },
        })
        .select()
        .single();

      if (task) {
        scheduledTouches.push({
          touchNumber,
          channel: channelConfig.channel,
          scheduledFor,
          taskId: task.id,
        });
      }

      touchNumber++;

      // Stop if max touches reached
      if (touchNumber > strategy.maxTotalTouches) {
        break;
      }
    }

    return {
      success: scheduledTouches.length > 0,
      scheduledTouches,
    };
  }

  /**
   * Get recommended channel for next touch
   */
  async getChannelRecommendation(prospectId: string): Promise<ChannelRecommendation> {
    const prospect = await this.getProspect(prospectId);

    // Get historical performance for this prospect
    const prospectHistory = await this.getProspectChannelHistory(prospectId);

    // Get team-level channel performance
    const teamPerformance = await this.getChannelPerformance();

    // Analyze prospect behavior
    const behaviorScore = this.analyzeProspectBehavior(prospectHistory);

    // Calculate channel scores
    const scores: Record<string, number> = {
      email: 0,
      linkedin: 0,
      phone: 0,
    };

    // Email scoring
    scores.email = this.scoreEmailChannel(prospect, prospectHistory, teamPerformance.email);

    // LinkedIn scoring
    scores.linkedin = this.scoreLinkedInChannel(prospect, prospectHistory, teamPerformance.linkedin);

    // Phone scoring
    scores.phone = this.scorePhoneChannel(prospect, prospectHistory, teamPerformance.phone);

    // Get recommendation
    const sortedChannels = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([channel, score]) => ({ channel, score }));

    const recommended = sortedChannels[0];
    const alternatives = sortedChannels.slice(1);

    return {
      recommendedChannel: recommended.channel as any,
      confidence: recommended.score / 100,
      reasoning: this.explainRecommendation(recommended.channel, prospect, prospectHistory),
      alternativeChannels: alternatives.map(alt => ({
        channel: alt.channel,
        score: alt.score,
        reason: this.explainRecommendation(alt.channel, prospect, prospectHistory),
      })),
    };
  }

  /**
   * Get channel performance analytics
   */
  async getChannelPerformance(daysBack: number = 30): Promise<{
    email: ChannelPerformance;
    linkedin: ChannelPerformance;
    phone: ChannelPerformance;
    overall: {
      bestChannel: string;
      worstChannel: string;
      avgResponseRate: number;
    };
  }> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('created_at', since.toISOString());

    // Calculate performance per channel
    const email = this.calculateChannelPerformance(activities || [], 'email');
    const linkedin = this.calculateChannelPerformance(activities || [], 'linkedin');
    const phone = this.calculateChannelPerformance(activities || [], 'phone');

    // Overall stats
    const avgResponseRate = (email.replyRate + linkedin.replyRate + phone.replyRate) / 3;

    const performanceMap = { email, linkedin, phone };
    const bestChannel = Object.entries(performanceMap)
      .sort(([, a], [, b]) => b.replyRate - a.replyRate)[0][0];
    const worstChannel = Object.entries(performanceMap)
      .sort(([, a], [, b]) => a.replyRate - b.replyRate)[0][0];

    return {
      email,
      linkedin,
      phone,
      overall: {
        bestChannel,
        worstChannel,
        avgResponseRate,
      },
    };
  }

  /**
   * Optimize channel mix based on performance
   */
  async optimizeChannelMix(): Promise<{
    recommendations: Array<{
      change: string;
      reasoning: string;
      expectedImpact: string;
    }>;
    proposedStrategy: ChannelStrategy;
  }> {
    const performance = await this.getChannelPerformance();
    const recommendations: any[] = [];

    // Analyze each channel
    if (performance.email.replyRate < 3) {
      recommendations.push({
        change: 'Reduce email frequency',
        reasoning: `Email reply rate is low (${performance.email.replyRate}%). May be over-sending or poor targeting.`,
        expectedImpact: 'Improve sender reputation and reduce unsubscribes',
      });
    }

    if (performance.linkedin.replyRate > performance.email.replyRate * 1.5) {
      recommendations.push({
        change: 'Increase LinkedIn touch points',
        reasoning: `LinkedIn performing ${((performance.linkedin.replyRate / performance.email.replyRate - 1) * 100).toFixed(0)}% better than email`,
        expectedImpact: `Potential ${(performance.linkedin.replyRate - performance.email.replyRate).toFixed(1)}% increase in response rate`,
      });
    }

    if (performance.phone.replied > 0 && performance.phone.replyRate > 10) {
      recommendations.push({
        change: 'Add phone calls to high-value prospects',
        reasoning: `Phone has ${performance.phone.replyRate}% connection rate`,
        expectedImpact: 'Faster qualification and higher meeting booking rate',
      });
    }

    // Build optimized strategy
    const bestChannel = performance.overall.bestChannel as 'email' | 'linkedin' | 'phone';
    const proposedStrategy: ChannelStrategy = {
      channels: [
        { channel: bestChannel, priority: 1, when: 'immediate' },
        {
          channel: bestChannel === 'email' ? 'linkedin' : 'email',
          priority: 2,
          when: 'after_no_response',
          delayDays: 3,
        },
        {
          channel: 'phone',
          priority: 3,
          when: 'conditional',
          condition: 'high_value_prospect',
          delayDays: 7,
        },
      ],
      maxTotalTouches: 6,
      stopOnResponse: true,
    };

    return {
      recommendations,
      proposedStrategy,
    };
  }

  /**
   * Check if should switch channels for a prospect
   */
  async shouldSwitchChannel(prospectId: string): Promise<{
    shouldSwitch: boolean;
    currentChannel: string;
    recommendedChannel: string;
    reasoning: string;
  }> {
    const history = await this.getProspectChannelHistory(prospectId);

    // Get most recent channel used
    const recentActivities = history
      .filter(h => h.direction === 'outbound')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (recentActivities.length === 0) {
      return {
        shouldSwitch: false,
        currentChannel: 'email',
        recommendedChannel: 'email',
        reasoning: 'No previous outreach',
      };
    }

    const currentChannel = recentActivities[0].channel;
    const touchesOnCurrentChannel = recentActivities.filter(a => a.channel === currentChannel).length;

    // Check for response on current channel
    const hasResponded = history.some(h =>
      h.channel === currentChannel && h.direction === 'inbound'
    );

    // Switch if:
    // 1. No response after 3 touches on same channel
    // 2. Or email bounced/failed
    const shouldSwitch =
      (!hasResponded && touchesOnCurrentChannel >= 3) ||
      recentActivities[0].activity_type === 'email_bounced';

    if (!shouldSwitch) {
      return {
        shouldSwitch: false,
        currentChannel,
        recommendedChannel: currentChannel,
        reasoning: 'Continue with current channel',
      };
    }

    // Get recommendation for next channel
    const recommendation = await this.getChannelRecommendation(prospectId);

    return {
      shouldSwitch: true,
      currentChannel,
      recommendedChannel: recommendation.recommendedChannel,
      reasoning: `No response after ${touchesOnCurrentChannel} ${currentChannel} touches. ${recommendation.reasoning}`,
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

  private async getProspectChannelHistory(prospectId: string) {
    const { data } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  private getChannelStrategy(
    strategyType: 'aggressive' | 'balanced' | 'patient',
    prospect: any
  ): ChannelStrategy {
    switch (strategyType) {
      case 'aggressive':
        return {
          channels: [
            { channel: 'email', priority: 1, when: 'immediate' },
            { channel: 'linkedin', priority: 1, when: 'concurrent', delayDays: 1 },
            { channel: 'email', priority: 2, when: 'after_no_response', delayDays: 2 },
            { channel: 'phone', priority: 2, when: 'after_no_response', delayDays: 3 },
            { channel: 'email', priority: 3, when: 'after_no_response', delayDays: 5 },
            { channel: 'linkedin', priority: 3, when: 'after_no_response', delayDays: 6 },
          ],
          maxTotalTouches: 6,
          stopOnResponse: true,
        };

      case 'balanced':
        return {
          channels: [
            { channel: 'email', priority: 1, when: 'immediate' },
            { channel: 'linkedin', priority: 2, when: 'after_no_response', delayDays: 3 },
            { channel: 'email', priority: 2, when: 'after_no_response', delayDays: 5 },
            { channel: 'email', priority: 3, when: 'after_no_response', delayDays: 10 },
          ],
          maxTotalTouches: 5,
          stopOnResponse: true,
        };

      case 'patient':
        return {
          channels: [
            { channel: 'email', priority: 1, when: 'immediate' },
            { channel: 'email', priority: 2, when: 'after_no_response', delayDays: 7 },
            { channel: 'linkedin', priority: 2, when: 'after_no_response', delayDays: 14 },
            { channel: 'email', priority: 3, when: 'after_no_response', delayDays: 21 },
          ],
          maxTotalTouches: 4,
          stopOnResponse: true,
        };
    }
  }

  private calculateScheduleTime(
    touchNumber: number,
    channelConfig: any,
    startImmediately?: boolean
  ): Date {
    const now = new Date();

    if (touchNumber === 1 && (startImmediately || channelConfig.when === 'immediate')) {
      return now;
    }

    const delayDays = channelConfig.delayDays || 0;
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + delayDays);

    return scheduledFor;
  }

  private calculateChannelPerformance(
    activities: any[],
    channel: string
  ): ChannelPerformance {
    const sent = activities.filter(a =>
      a.channel === channel && a.activity_type.includes('sent')
    ).length;

    const opened = activities.filter(a =>
      a.channel === channel && a.activity_type.includes('opened')
    ).length;

    const clicked = activities.filter(a =>
      a.channel === channel && a.activity_type.includes('clicked')
    ).length;

    const replied = activities.filter(a =>
      a.channel === channel && a.activity_type.includes('received')
    ).length;

    const meetings = activities.filter(a =>
      a.channel === channel && a.activity_type.includes('meeting_scheduled')
    ).length;

    return {
      channel: channel as any,
      sent,
      opened,
      clicked,
      replied,
      meetings,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      replyRate: sent > 0 ? (replied / sent) * 100 : 0,
      meetingRate: sent > 0 ? (meetings / sent) * 100 : 0,
    };
  }

  private scoreEmailChannel(prospect: any, history: any[], performance: ChannelPerformance): number {
    let score = 50; // Base score

    // Historical performance
    if (performance.replyRate > 5) score += 20;
    else if (performance.replyRate > 3) score += 10;
    else if (performance.replyRate < 2) score -= 10;

    // Prospect specific
    const emailOpens = history.filter(h => h.activity_type === 'email_opened').length;
    if (emailOpens > 0) score += 15;

    const emailBounces = history.filter(h => h.activity_type === 'email_bounced').length;
    if (emailBounces > 0) score -= 30;

    // Company size (email works better for SMB)
    const companySize = prospect.company_profiles?.employee_count || 0;
    if (companySize < 50) score += 10;
    else if (companySize > 1000) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private scoreLinkedInChannel(prospect: any, history: any[], performance: ChannelPerformance): number {
    let score = 50; // Base score

    // Historical performance
    if (performance.replyRate > 8) score += 25;
    else if (performance.replyRate > 5) score += 15;

    // LinkedIn presence (would check if has LinkedIn profile)
    const hasLinkedInActivity = history.some(h => h.channel === 'linkedin');
    if (hasLinkedInActivity) score += 10;

    // Seniority (LinkedIn works better for executives)
    const title = prospect.title?.toLowerCase() || '';
    if (/ceo|cto|cfo|vp|director|head of/.test(title)) {
      score += 20;
    }

    // Industry (B2B tech responds well on LinkedIn)
    const industry = prospect.company_profiles?.industry?.toLowerCase() || '';
    if (/technology|saas|software/.test(industry)) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private scorePhoneChannel(prospect: any, history: any[], performance: ChannelPerformance): number {
    let score = 30; // Lower base score (more intrusive)

    // Historical performance
    if (performance.replyRate > 15) score += 30;
    else if (performance.replyRate > 10) score += 20;

    // High-value prospects
    const dealValue = prospect.estimated_deal_value || 0;
    if (dealValue > 50000) score += 25;
    else if (dealValue > 25000) score += 15;

    // Hot prospects
    const intentScore = prospect.intent_score || 0;
    if (intentScore > 75) score += 20;

    // Previous engagement
    const hasEngaged = history.some(h => h.direction === 'inbound');
    if (hasEngaged) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private analyzeProspectBehavior(history: any[]): {
    preferredChannel?: string;
    avgResponseTime?: number;
    engagementLevel: 'low' | 'medium' | 'high';
  } {
    const responses = history.filter(h => h.direction === 'inbound');
    const preferredChannel = responses.length > 0 ? responses[0].channel : undefined;

    let engagementLevel: 'low' | 'medium' | 'high' = 'low';
    const opens = history.filter(h => h.activity_type.includes('opened')).length;
    const clicks = history.filter(h => h.activity_type.includes('clicked')).length;

    if (responses.length > 0 || clicks > 2) engagementLevel = 'high';
    else if (opens > 2) engagementLevel = 'medium';

    return {
      preferredChannel,
      engagementLevel,
    };
  }

  private explainRecommendation(channel: string, prospect: any, history: any[]): string {
    switch (channel) {
      case 'email':
        return 'Email is recommended due to proven team performance and prospect company size';
      case 'linkedin':
        return 'LinkedIn is recommended for this senior-level prospect in tech industry';
      case 'phone':
        return 'Phone call recommended due to high deal value and strong intent signals';
      default:
        return '';
    }
  }
}

/**
 * Create multi-channel orchestrator
 */
export function createMultiChannelOrchestrator(
  teamId: string,
  userId: string
): MultiChannelOrchestrator {
  return new MultiChannelOrchestrator(teamId, userId);
}
