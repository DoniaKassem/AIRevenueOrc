/**
 * Analytics Engine
 * Core analytics and metrics calculation for sales performance
 */

import { supabase } from '../supabase';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  period: DateRange;
  metrics: {
    // Pipeline metrics
    pipelineValue: number;
    pipelineCount: number;
    avgDealSize: number;
    weightedPipeline: number;

    // Activity metrics
    totalActivities: number;
    emailsSent: number;
    callsMade: number;
    meetingsHeld: number;

    // Conversion metrics
    leadsCreated: number;
    leadsQualified: number;
    opportunitiesCreated: number;
    dealsWon: number;
    dealsLost: number;

    // Revenue metrics
    revenueWon: number;
    revenueTarget: number;
    revenueAttainment: number; // percentage

    // Efficiency metrics
    avgSalesCycle: number; // days
    winRate: number; // percentage
    lossRate: number; // percentage
    velocityScore: number; // deals moving forward per day

    // Engagement metrics
    avgResponseTime: number; // hours
    emailOpenRate: number; // percentage
    emailClickRate: number; // percentage
    meetingBookedRate: number; // percentage
  };
  trends: {
    pipelineGrowth: number; // percentage change
    activityGrowth: number;
    revenueGrowth: number;
    winRateChange: number;
  };
}

export interface RepMetrics extends Omit<TeamMetrics, 'teamId' | 'teamName'> {
  userId: string;
  userName: string;
  role: string;
  ranking: number;
  quotaAttainment: number;
}

export interface PipelineStageMetrics {
  stage: string;
  count: number;
  value: number;
  avgDealSize: number;
  avgTimeInStage: number; // days
  conversionRate: number; // to next stage, percentage
  velocityScore: number;
  historicalWinRate: number;
}

export interface ConversionFunnel {
  stage: string;
  count: number;
  value: number;
  conversionRate: number; // from previous stage
  dropoffRate: number;
}

/**
 * Analytics Engine Service
 */
export class AnalyticsEngine {
  /**
   * Get team metrics for a period
   */
  async getTeamMetrics(teamId: string, period: DateRange): Promise<TeamMetrics> {
    // Get previous period for trend calculation
    const periodLength = period.endDate.getTime() - period.startDate.getTime();
    const previousPeriod: DateRange = {
      startDate: new Date(period.startDate.getTime() - periodLength),
      endDate: period.startDate
    };

    // Calculate current metrics
    const metrics = await this.calculateMetrics(teamId, period);
    const previousMetrics = await this.calculateMetrics(teamId, previousPeriod);

    // Calculate trends
    const trends = this.calculateTrends(metrics, previousMetrics);

    // Get team name
    const { data: team } = await supabase
      .from('team_hierarchies')
      .select('name')
      .eq('id', teamId)
      .single();

    return {
      teamId,
      teamName: team?.name || 'Unknown Team',
      period,
      metrics,
      trends
    };
  }

  /**
   * Get rep metrics for a period
   */
  async getRepMetrics(userId: string, period: DateRange): Promise<RepMetrics> {
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('email, role')
      .eq('id', userId)
      .single();

    // Calculate metrics (using null as teamId to get user-specific)
    const metrics = await this.calculateMetrics(null, period, userId);
    const previousPeriod: DateRange = {
      startDate: new Date(period.startDate.getTime() - (period.endDate.getTime() - period.startDate.getTime())),
      endDate: period.startDate
    };
    const previousMetrics = await this.calculateMetrics(null, previousPeriod, userId);
    const trends = this.calculateTrends(metrics, previousMetrics);

    // Get quota attainment
    const { data: quota } = await supabase
      .from('quotas')
      .select('target, current_value, attainment')
      .eq('user_id', userId)
      .eq('quota_type', 'revenue')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      userId,
      userName: user?.email || 'Unknown',
      role: user?.role || 'rep',
      period,
      metrics,
      trends,
      ranking: 0, // Will be calculated separately
      quotaAttainment: quota?.attainment || 0
    };
  }

  /**
   * Get pipeline stage metrics
   */
  async getPipelineStageMetrics(teamId: string): Promise<PipelineStageMetrics[]> {
    const stages = [
      'lead',
      'qualified',
      'meeting_scheduled',
      'meeting_completed',
      'proposal_sent',
      'negotiation',
      'verbal_commit',
      'closed_won',
      'closed_lost'
    ];

    const metrics: PipelineStageMetrics[] = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const nextStage = i < stages.length - 1 ? stages[i + 1] : null;

      // Get current prospects in this stage
      const { data: prospects, count } = await supabase
        .from('prospects')
        .select('*, accounts(*)', { count: 'exact' })
        .eq('team_id', teamId)
        .eq('stage', stage);

      const totalValue = prospects?.reduce((sum, p) => sum + (p.accounts?.revenue || 0), 0) || 0;
      const avgDealSize = count ? totalValue / count : 0;

      // Calculate avg time in stage
      const avgTimeInStage = await this.calculateAvgTimeInStage(teamId, stage);

      // Calculate conversion rate to next stage
      let conversionRate = 0;
      if (nextStage) {
        const { count: currentCount } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('stage', stage);

        const { count: nextCount } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId)
          .eq('stage', nextStage);

        conversionRate = currentCount ? (nextCount || 0) / currentCount * 100 : 0;
      }

      // Calculate velocity score (deals moving per day)
      const velocityScore = avgTimeInStage > 0 ? (count || 0) / avgTimeInStage : 0;

      // Calculate historical win rate from this stage
      const historicalWinRate = await this.calculateHistoricalWinRate(teamId, stage);

      metrics.push({
        stage,
        count: count || 0,
        value: totalValue,
        avgDealSize,
        avgTimeInStage,
        conversionRate,
        velocityScore,
        historicalWinRate
      });
    }

    return metrics;
  }

  /**
   * Get conversion funnel
   */
  async getConversionFunnel(teamId: string, period: DateRange): Promise<ConversionFunnel[]> {
    const stages = [
      { name: 'Lead', stage: 'lead' },
      { name: 'Qualified', stage: 'qualified' },
      { name: 'Meeting', stage: 'meeting_completed' },
      { name: 'Proposal', stage: 'proposal_sent' },
      { name: 'Negotiation', stage: 'negotiation' },
      { name: 'Closed Won', stage: 'closed_won' }
    ];

    const funnel: ConversionFunnel[] = [];
    let previousCount = 0;

    for (let i = 0; i < stages.length; i++) {
      const { name, stage } = stages[i];

      const { data: prospects, count } = await supabase
        .from('prospects')
        .select('*, accounts(*)', { count: 'exact' })
        .eq('team_id', teamId)
        .eq('stage', stage)
        .gte('created_at', period.startDate.toISOString())
        .lte('created_at', period.endDate.toISOString());

      const totalValue = prospects?.reduce((sum, p) => sum + (p.accounts?.revenue || 0), 0) || 0;

      const conversionRate = previousCount > 0 ? ((count || 0) / previousCount) * 100 : 100;
      const dropoffRate = 100 - conversionRate;

      funnel.push({
        stage: name,
        count: count || 0,
        value: totalValue,
        conversionRate,
        dropoffRate
      });

      previousCount = count || 0;
    }

    return funnel;
  }

  /**
   * Get team leaderboard
   */
  async getTeamLeaderboard(teamId: string, period: DateRange, limit: number = 10): Promise<RepMetrics[]> {
    // Get all team members
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    if (!members || members.length === 0) {
      return [];
    }

    // Get metrics for each member
    const repMetrics = await Promise.all(
      members.map(m => this.getRepMetrics(m.user_id, period))
    );

    // Sort by revenue won and assign rankings
    repMetrics.sort((a, b) => b.metrics.revenueWon - a.metrics.revenueWon);
    repMetrics.forEach((rep, index) => {
      rep.ranking = index + 1;
    });

    return repMetrics.slice(0, limit);
  }

  /**
   * Get activity breakdown
   */
  async getActivityBreakdown(
    teamId: string,
    period: DateRange
  ): Promise<Record<string, number>> {
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('activity_type, prospect_id')
      .in('prospect_id',
        supabase
          .from('prospects')
          .select('id')
          .eq('team_id', teamId)
      )
      .gte('created_at', period.startDate.toISOString())
      .lte('created_at', period.endDate.toISOString());

    const breakdown: Record<string, number> = {
      email: 0,
      call: 0,
      meeting: 0,
      note: 0,
      task: 0
    };

    activities?.forEach(activity => {
      if (breakdown[activity.activity_type] !== undefined) {
        breakdown[activity.activity_type]++;
      }
    });

    return breakdown;
  }

  /**
   * Calculate metrics for a team or user
   */
  private async calculateMetrics(
    teamId: string | null,
    period: DateRange,
    userId?: string
  ): Promise<TeamMetrics['metrics']> {
    // Build base query
    let prospectsQuery = supabase
      .from('prospects')
      .select('*, accounts(*), bdr_activities(*)');

    if (teamId) {
      prospectsQuery = prospectsQuery.eq('team_id', teamId);
    }

    if (userId) {
      prospectsQuery = prospectsQuery.eq('owner_id', userId);
    }

    const { data: prospects } = await prospectsQuery;

    // Pipeline metrics
    const pipelineProspects = prospects?.filter(p =>
      !['closed_won', 'closed_lost', 'disqualified'].includes(p.stage)
    ) || [];

    const pipelineValue = pipelineProspects.reduce((sum, p) =>
      sum + (p.accounts?.revenue || 0), 0
    );
    const pipelineCount = pipelineProspects.length;
    const avgDealSize = pipelineCount > 0 ? pipelineValue / pipelineCount : 0;

    // Weighted pipeline (using stage probability)
    const stageProbabilities: Record<string, number> = {
      lead: 0.1,
      qualified: 0.2,
      meeting_scheduled: 0.3,
      meeting_completed: 0.4,
      proposal_sent: 0.6,
      negotiation: 0.8,
      verbal_commit: 0.9
    };

    const weightedPipeline = pipelineProspects.reduce((sum, p) => {
      const probability = stageProbabilities[p.stage] || 0;
      return sum + (p.accounts?.revenue || 0) * probability;
    }, 0);

    // Activity metrics (within period)
    const activities = prospects?.flatMap(p =>
      p.bdr_activities?.filter((a: any) => {
        const activityDate = new Date(a.created_at);
        return activityDate >= period.startDate && activityDate <= period.endDate;
      }) || []
    ) || [];

    const totalActivities = activities.length;
    const emailsSent = activities.filter((a: any) => a.activity_type === 'email').length;
    const callsMade = activities.filter((a: any) => a.activity_type === 'call').length;
    const meetingsHeld = activities.filter((a: any) => a.activity_type === 'meeting').length;

    // Conversion metrics (created in period)
    const prospectsInPeriod = prospects?.filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt >= period.startDate && createdAt <= period.endDate;
    }) || [];

    const leadsCreated = prospectsInPeriod.filter(p => p.stage === 'lead').length;
    const leadsQualified = prospectsInPeriod.filter(p =>
      ['qualified', 'meeting_scheduled', 'meeting_completed', 'proposal_sent', 'negotiation', 'verbal_commit', 'closed_won'].includes(p.stage)
    ).length;
    const opportunitiesCreated = prospectsInPeriod.filter(p =>
      ['meeting_completed', 'proposal_sent', 'negotiation', 'verbal_commit', 'closed_won'].includes(p.stage)
    ).length;
    const dealsWon = prospectsInPeriod.filter(p => p.stage === 'closed_won').length;
    const dealsLost = prospectsInPeriod.filter(p => p.stage === 'closed_lost').length;

    // Revenue metrics
    const revenueWon = prospectsInPeriod
      .filter(p => p.stage === 'closed_won')
      .reduce((sum, p) => sum + (p.accounts?.revenue || 0), 0);

    // Get quota target
    let revenueTarget = 0;
    if (userId) {
      const { data: quota } = await supabase
        .from('quotas')
        .select('target')
        .eq('user_id', userId)
        .eq('quota_type', 'revenue')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      revenueTarget = quota?.target || 0;
    }

    const revenueAttainment = revenueTarget > 0 ? (revenueWon / revenueTarget) * 100 : 0;

    // Efficiency metrics
    const closedDeals = prospectsInPeriod.filter(p =>
      ['closed_won', 'closed_lost'].includes(p.stage)
    );
    const avgSalesCycle = closedDeals.length > 0
      ? closedDeals.reduce((sum, p) => {
          const created = new Date(p.created_at).getTime();
          const closed = new Date(p.updated_at).getTime();
          return sum + (closed - created) / (1000 * 60 * 60 * 24);
        }, 0) / closedDeals.length
      : 0;

    const totalClosed = dealsWon + dealsLost;
    const winRate = totalClosed > 0 ? (dealsWon / totalClosed) * 100 : 0;
    const lossRate = totalClosed > 0 ? (dealsLost / totalClosed) * 100 : 0;

    const velocityScore = avgSalesCycle > 0 ? dealsWon / avgSalesCycle : 0;

    // Engagement metrics
    const emailActivities = activities.filter((a: any) => a.activity_type === 'email');
    const emailOpens = emailActivities.filter((a: any) => a.metadata?.opened).length;
    const emailClicks = emailActivities.filter((a: any) => a.metadata?.clicked).length;
    const emailOpenRate = emailsSent > 0 ? (emailOpens / emailsSent) * 100 : 0;
    const emailClickRate = emailsSent > 0 ? (emailClicks / emailsSent) * 100 : 0;

    const meetingBookedRate = emailsSent > 0 ? (meetingsHeld / emailsSent) * 100 : 0;

    // Calculate avg response time
    const responseTimes: number[] = [];
    for (const prospect of prospects || []) {
      const prospectActivities = (prospect.bdr_activities || [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < prospectActivities.length - 1; i++) {
        if (prospectActivities[i].direction === 'outbound' &&
            prospectActivities[i + 1].direction === 'inbound') {
          const diff = new Date(prospectActivities[i + 1].created_at).getTime() -
                      new Date(prospectActivities[i].created_at).getTime();
          responseTimes.push(diff / (1000 * 60 * 60)); // hours
        }
      }
    }
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      pipelineValue,
      pipelineCount,
      avgDealSize,
      weightedPipeline,
      totalActivities,
      emailsSent,
      callsMade,
      meetingsHeld,
      leadsCreated,
      leadsQualified,
      opportunitiesCreated,
      dealsWon,
      dealsLost,
      revenueWon,
      revenueTarget,
      revenueAttainment,
      avgSalesCycle,
      winRate,
      lossRate,
      velocityScore,
      avgResponseTime,
      emailOpenRate,
      emailClickRate,
      meetingBookedRate
    };
  }

  /**
   * Calculate trends between two periods
   */
  private calculateTrends(
    current: TeamMetrics['metrics'],
    previous: TeamMetrics['metrics']
  ): TeamMetrics['trends'] {
    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    return {
      pipelineGrowth: calculateGrowth(current.pipelineValue, previous.pipelineValue),
      activityGrowth: calculateGrowth(current.totalActivities, previous.totalActivities),
      revenueGrowth: calculateGrowth(current.revenueWon, previous.revenueWon),
      winRateChange: current.winRate - previous.winRate
    };
  }

  /**
   * Calculate average time in stage
   */
  private async calculateAvgTimeInStage(teamId: string, stage: string): Promise<number> {
    const { data: prospects } = await supabase
      .from('prospects')
      .select('created_at, updated_at, stage')
      .eq('team_id', teamId)
      .eq('stage', stage);

    if (!prospects || prospects.length === 0) {
      return 0;
    }

    const totalDays = prospects.reduce((sum, p) => {
      const created = new Date(p.created_at).getTime();
      const updated = new Date(p.updated_at).getTime();
      return sum + (updated - created) / (1000 * 60 * 60 * 24);
    }, 0);

    return totalDays / prospects.length;
  }

  /**
   * Calculate historical win rate from a stage
   */
  private async calculateHistoricalWinRate(teamId: string, stage: string): Promise<number> {
    // Get all prospects that were ever in this stage
    const { data: allProspects } = await supabase
      .from('prospects')
      .select('stage')
      .eq('team_id', teamId);

    if (!allProspects || allProspects.length === 0) {
      return 0;
    }

    // For simplicity, calculate based on current stage distribution
    const inStage = allProspects.filter(p => p.stage === stage).length;
    const won = allProspects.filter(p => p.stage === 'closed_won').length;

    return inStage > 0 ? (won / inStage) * 100 : 0;
  }
}

/**
 * Create Analytics Engine
 */
export function createAnalyticsEngine(): AnalyticsEngine {
  return new AnalyticsEngine();
}
