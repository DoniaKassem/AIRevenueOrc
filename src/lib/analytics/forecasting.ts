/**
 * Forecasting System
 * AI-powered revenue and pipeline forecasting
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';
import { DateRange } from './engine';

export interface ForecastPeriod {
  period: 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
}

export interface RevenueForecast {
  teamId: string;
  period: ForecastPeriod;
  forecast: {
    mostLikely: number;
    best_case: number;
    worst_case: number;
    confidence: number; // 0-100
  };
  breakdown: {
    committed: number; // Deals in final stages
    upside: number; // Deals earlier in pipeline
    pipeline: number; // Total weighted pipeline
  };
  assumptions: string[];
  risks: Array<{
    risk: string;
    impact: 'high' | 'medium' | 'low';
    mitigation: string;
  }>;
  drivers: Array<{
    factor: string;
    contribution: number; // percentage
  }>;
  historicalAccuracy?: number; // percentage
}

export interface DealForecast {
  prospectId: string;
  prospectName: string;
  currentStage: string;
  dealValue: number;
  predictedCloseDate: Date;
  closeProbability: number; // 0-100
  confidenceInterval: {
    early: Date;
    late: Date;
  };
  riskFactors: string[];
  recommendations: string[];
}

export interface PipelineForecast {
  teamId: string;
  period: ForecastPeriod;
  pipelineGrowth: {
    current: number;
    projected: number;
    growthRate: number; // percentage
  };
  newDealsProjected: number;
  expectedWins: number;
  expectedLosses: number;
  pipelineCoverage: number; // pipeline / target ratio
  healthScore: number; // 0-100
}

/**
 * Forecasting Service
 */
export class ForecastingService {
  private openai: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate revenue forecast for a period
   */
  async generateRevenueForecast(
    teamId: string,
    period: ForecastPeriod
  ): Promise<RevenueForecast> {
    // Get historical data for training
    const historicalData = await this.getHistoricalData(teamId, period);

    // Get current pipeline
    const { data: pipeline } = await supabase
      .from('prospects')
      .select('*, accounts(*)')
      .eq('team_id', teamId)
      .not('stage', 'in', '(closed_won,closed_lost,disqualified)');

    // Calculate baseline forecast using historical patterns
    const baselineForecast = this.calculateBaselineForecast(historicalData, pipeline || []);

    // Use AI to analyze patterns and adjust forecast
    const aiAdjustments = await this.getAIForecastAdjustments(
      historicalData,
      pipeline || [],
      period
    );

    // Calculate final forecast
    const mostLikely = baselineForecast.mostLikely * (1 + aiAdjustments.adjustment);
    const best_case = mostLikely * 1.3; // 30% upside
    const worst_case = mostLikely * 0.7; // 30% downside

    // Calculate breakdown
    const committed = this.calculateCommitted(pipeline || []);
    const upside = this.calculateUpside(pipeline || []);
    const pipelineValue = committed + upside;

    // Get historical forecast accuracy
    const historicalAccuracy = await this.calculateForecastAccuracy(teamId, period);

    return {
      teamId,
      period,
      forecast: {
        mostLikely,
        best_case,
        worst_case,
        confidence: aiAdjustments.confidence
      },
      breakdown: {
        committed,
        upside,
        pipeline: pipelineValue
      },
      assumptions: aiAdjustments.assumptions,
      risks: aiAdjustments.risks,
      drivers: aiAdjustments.drivers,
      historicalAccuracy
    };
  }

  /**
   * Forecast individual deal close probability and date
   */
  async forecastDeal(prospectId: string): Promise<DealForecast> {
    // Get prospect data
    const { data: prospect } = await supabase
      .from('prospects')
      .select(`
        *,
        accounts (*),
        bdr_activities (*)
      `)
      .eq('id', prospectId)
      .single();

    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // Get AI lead score
    const { data: leadScore } = await supabase
      .from('ai_lead_scores')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('scored_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate close probability based on multiple factors
    const closeProbability = await this.calculateCloseProbability(prospect, leadScore);

    // Predict close date
    const predictedCloseDate = await this.predictCloseDate(prospect);

    // Calculate confidence interval (±2 weeks)
    const confidenceInterval = {
      early: new Date(predictedCloseDate.getTime() - 14 * 24 * 60 * 60 * 1000),
      late: new Date(predictedCloseDate.getTime() + 14 * 24 * 60 * 60 * 1000)
    };

    // Identify risk factors
    const riskFactors = await this.identifyDealRisks(prospect);

    // Generate recommendations
    const recommendations = await this.generateDealRecommendations(prospect, riskFactors);

    return {
      prospectId,
      prospectName: `${prospect.first_name} ${prospect.last_name}`,
      currentStage: prospect.stage,
      dealValue: prospect.accounts?.revenue || 0,
      predictedCloseDate,
      closeProbability,
      confidenceInterval,
      riskFactors,
      recommendations
    };
  }

  /**
   * Generate pipeline forecast
   */
  async generatePipelineForecast(
    teamId: string,
    period: ForecastPeriod
  ): Promise<PipelineForecast> {
    // Get current pipeline value
    const { data: currentPipeline } = await supabase
      .from('prospects')
      .select('accounts(*)')
      .eq('team_id', teamId)
      .not('stage', 'in', '(closed_won,closed_lost,disqualified)');

    const current = currentPipeline?.reduce((sum, p) =>
      sum + (p.accounts?.revenue || 0), 0
    ) || 0;

    // Get historical growth rate
    const historicalGrowth = await this.getHistoricalPipelineGrowth(teamId, period);

    // Project pipeline growth
    const projected = current * (1 + historicalGrowth);
    const growthRate = historicalGrowth * 100;

    // Calculate new deals projection
    const { data: historicalNewDeals } = await supabase
      .from('prospects')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    const avgNewDealsPerDay = (historicalNewDeals || 0) / 90;
    const periodDays = (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const newDealsProjected = Math.round(avgNewDealsPerDay * periodDays);

    // Calculate expected wins/losses based on historical win rate
    const { data: historicalDeals } = await supabase
      .from('prospects')
      .select('stage')
      .eq('team_id', teamId)
      .in('stage', ['closed_won', 'closed_lost']);

    const totalClosed = historicalDeals?.length || 0;
    const won = historicalDeals?.filter(d => d.stage === 'closed_won').length || 0;
    const winRate = totalClosed > 0 ? won / totalClosed : 0.3;

    const expectedWins = Math.round(newDealsProjected * winRate);
    const expectedLosses = Math.round(newDealsProjected * (1 - winRate));

    // Get target for coverage calculation
    const { data: quota } = await supabase
      .from('quotas')
      .select('target')
      .eq('team_id', teamId)
      .eq('quota_type', 'revenue')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const target = quota?.target || projected;
    const pipelineCoverage = target > 0 ? (projected / target) * 100 : 0;

    // Calculate pipeline health score
    const healthScore = this.calculatePipelineHealth({
      pipelineCoverage,
      growthRate,
      winRate: winRate * 100,
      avgDealAge: 30 // Placeholder
    });

    return {
      teamId,
      period,
      pipelineGrowth: {
        current,
        projected,
        growthRate
      },
      newDealsProjected,
      expectedWins,
      expectedLosses,
      pipelineCoverage,
      healthScore
    };
  }

  /**
   * Forecast team attainment
   */
  async forecastQuotaAttainment(
    teamId: string,
    period: ForecastPeriod
  ): Promise<{
    teamId: string;
    quota: number;
    currentAttainment: number;
    projectedAttainment: number;
    onTrack: boolean;
    gap: number;
    recommendations: string[];
  }> {
    // Get team quota
    const { data: quota } = await supabase
      .from('quotas')
      .select('target, current_value, attainment')
      .eq('team_id', teamId)
      .eq('quota_type', 'revenue')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const quotaTarget = quota?.target || 0;
    const currentValue = quota?.current_value || 0;
    const currentAttainment = quota?.attainment || 0;

    // Generate revenue forecast
    const revenueForecast = await this.generateRevenueForecast(teamId, period);

    // Project attainment
    const projectedRevenue = currentValue + revenueForecast.forecast.mostLikely;
    const projectedAttainment = quotaTarget > 0 ? (projectedRevenue / quotaTarget) * 100 : 0;

    const onTrack = projectedAttainment >= 90; // 90% is considered on track
    const gap = quotaTarget - projectedRevenue;

    // Generate recommendations
    const recommendations: string[] = [];
    if (!onTrack) {
      if (gap > 0) {
        recommendations.push(`Need to close an additional $${gap.toLocaleString()} to reach quota`);
        recommendations.push('Focus on high-value deals in late stages');
        recommendations.push('Increase activity levels by 20%');
      }
      recommendations.push('Review pipeline coverage and add more opportunities');
      recommendations.push('Accelerate deal velocity in middle stages');
    } else {
      recommendations.push('On track to meet quota - maintain current pace');
      recommendations.push('Continue focusing on qualified opportunities');
    }

    return {
      teamId,
      quota: quotaTarget,
      currentAttainment,
      projectedAttainment,
      onTrack,
      gap: Math.max(0, gap),
      recommendations
    };
  }

  /**
   * Get historical data for forecasting
   */
  private async getHistoricalData(teamId: string, period: ForecastPeriod): Promise<any[]> {
    const periodLength = period.endDate.getTime() - period.startDate.getTime();
    const lookbackPeriods = 4; // Look back 4 periods

    const historicalData = [];

    for (let i = 1; i <= lookbackPeriods; i++) {
      const periodStart = new Date(period.startDate.getTime() - (periodLength * i));
      const periodEnd = new Date(period.endDate.getTime() - (periodLength * i));

      const { data: deals } = await supabase
        .from('prospects')
        .select('*, accounts(*)')
        .eq('team_id', teamId)
        .eq('stage', 'closed_won')
        .gte('updated_at', periodStart.toISOString())
        .lte('updated_at', periodEnd.toISOString());

      const revenue = deals?.reduce((sum, d) => sum + (d.accounts?.revenue || 0), 0) || 0;

      historicalData.push({
        periodStart,
        periodEnd,
        revenue,
        deals: deals?.length || 0
      });
    }

    return historicalData;
  }

  /**
   * Calculate baseline forecast using historical averages
   */
  private calculateBaselineForecast(
    historicalData: any[],
    currentPipeline: any[]
  ): { mostLikely: number } {
    // Calculate average historical revenue
    const avgHistoricalRevenue = historicalData.reduce((sum, p) => sum + p.revenue, 0) / historicalData.length;

    // Calculate weighted pipeline value
    const stageProbabilities: Record<string, number> = {
      qualified: 0.2,
      meeting_scheduled: 0.3,
      meeting_completed: 0.4,
      proposal_sent: 0.6,
      negotiation: 0.8,
      verbal_commit: 0.9
    };

    const weightedPipeline = currentPipeline.reduce((sum, p) => {
      const probability = stageProbabilities[p.stage] || 0.1;
      return sum + (p.accounts?.revenue || 0) * probability;
    }, 0);

    // Blend historical average with weighted pipeline (70/30 split)
    const mostLikely = (avgHistoricalRevenue * 0.7) + (weightedPipeline * 0.3);

    return { mostLikely };
  }

  /**
   * Get AI-powered forecast adjustments
   */
  private async getAIForecastAdjustments(
    historicalData: any[],
    currentPipeline: any[],
    period: ForecastPeriod
  ): Promise<{
    adjustment: number;
    confidence: number;
    assumptions: string[];
    risks: Array<{ risk: string; impact: string; mitigation: string }>;
    drivers: Array<{ factor: string; contribution: number }>;
  }> {
    const systemPrompt = 'You are an expert sales forecasting analyst. Analyze the data and provide forecast adjustments.';

    const userPrompt = `
Analyze this sales data and provide forecast insights:

Historical Revenue (last 4 periods):
${historicalData.map(p => `- ${p.revenue.toLocaleString()}`).join('\n')}

Current Pipeline:
- Total deals: ${currentPipeline.length}
- Total value: $${currentPipeline.reduce((s, p) => s + (p.accounts?.revenue || 0), 0).toLocaleString()}
- By stage: ${JSON.stringify(this.groupByStage(currentPipeline))}

Provide analysis in JSON format:
{
  "adjustment": -0.1 to 0.1 (percentage adjustment to baseline forecast),
  "confidence": 0-100,
  "assumptions": ["array", "of", "assumptions"],
  "risks": [
    {"risk": "description", "impact": "high|medium|low", "mitigation": "how to address"}
  ],
  "drivers": [
    {"factor": "name", "contribution": 0-100 (percentage)}
  ]
}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      return {
        adjustment: 0,
        confidence: 75,
        assumptions: ['Based on historical averages'],
        risks: [],
        drivers: []
      };
    }
  }

  /**
   * Calculate committed revenue (late-stage deals)
   */
  private calculateCommitted(pipeline: any[]): number {
    const commitedStages = ['negotiation', 'verbal_commit'];
    return pipeline
      .filter(p => commitedStages.includes(p.stage))
      .reduce((sum, p) => sum + (p.accounts?.revenue || 0), 0);
  }

  /**
   * Calculate upside revenue (early/mid-stage deals)
   */
  private calculateUpside(pipeline: any[]): number {
    const upsideStages = ['qualified', 'meeting_scheduled', 'meeting_completed', 'proposal_sent'];
    const stageProbabilities: Record<string, number> = {
      qualified: 0.2,
      meeting_scheduled: 0.3,
      meeting_completed: 0.4,
      proposal_sent: 0.6
    };

    return pipeline
      .filter(p => upsideStages.includes(p.stage))
      .reduce((sum, p) => {
        const probability = stageProbabilities[p.stage] || 0.2;
        return sum + (p.accounts?.revenue || 0) * probability;
      }, 0);
  }

  /**
   * Calculate historical forecast accuracy
   */
  private async calculateForecastAccuracy(teamId: string, period: ForecastPeriod): Promise<number> {
    // For now, return a placeholder
    // In production, would compare previous forecasts to actual results
    return 85; // 85% accuracy
  }

  /**
   * Calculate close probability for a deal
   */
  private async calculateCloseProbability(prospect: any, leadScore: any): Promise<number> {
    let probability = 30; // Base probability

    // Stage-based probability
    const stageProbabilities: Record<string, number> = {
      lead: 10,
      qualified: 20,
      meeting_scheduled: 30,
      meeting_completed: 40,
      proposal_sent: 60,
      negotiation: 80,
      verbal_commit: 90
    };
    probability = stageProbabilities[prospect.stage] || 30;

    // Adjust based on AI lead score
    if (leadScore) {
      if (leadScore.grade === 'A') probability += 15;
      else if (leadScore.grade === 'B') probability += 10;
      else if (leadScore.grade === 'C') probability += 5;
      else if (leadScore.grade === 'D') probability -= 5;
      else if (leadScore.grade === 'F') probability -= 10;
    }

    // Adjust based on engagement
    const activities = prospect.bdr_activities || [];
    const meetings = activities.filter((a: any) => a.activity_type === 'meeting').length;
    if (meetings >= 3) probability += 10;
    else if (meetings >= 2) probability += 5;

    return Math.max(0, Math.min(100, probability));
  }

  /**
   * Predict close date for a deal
   */
  private async predictCloseDate(prospect: any): Promise<Date> {
    // Calculate average sales cycle for this stage
    const avgSalesCycle = 45; // days, placeholder

    // Calculate days in current stage
    const daysInStage = Math.floor(
      (Date.now() - new Date(prospect.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Estimate remaining days
    const remainingDays = Math.max(7, avgSalesCycle - daysInStage);

    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + remainingDays);

    return closeDate;
  }

  /**
   * Identify risks for a deal
   */
  private async identifyDealRisks(prospect: any): Promise<string[]> {
    const risks: string[] = [];

    // Check for stalled deal
    const daysInStage = Math.floor(
      (Date.now() - new Date(prospect.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysInStage > 30) {
      risks.push('Deal has been in current stage for over 30 days');
    }

    // Check for low engagement
    const activities = prospect.bdr_activities || [];
    const recentActivities = activities.filter((a: any) => {
      const daysAgo = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo < 14;
    });

    if (recentActivities.length < 2) {
      risks.push('Low recent engagement (< 2 activities in last 14 days)');
    }

    // Check for missing contact info
    if (!prospect.phone && !prospect.email) {
      risks.push('Missing contact information');
    }

    return risks;
  }

  /**
   * Generate recommendations for a deal
   */
  private async generateDealRecommendations(prospect: any, risks: string[]): Promise<string[]> {
    const recommendations: string[] = [];

    if (risks.some(r => r.includes('stalled') || r.includes('stage'))) {
      recommendations.push('Schedule a call to re-engage and understand current priorities');
      recommendations.push('Send value-add content or case study');
    }

    if (risks.some(r => r.includes('engagement'))) {
      recommendations.push('Increase touchpoint frequency');
      recommendations.push('Try different communication channels');
    }

    if (prospect.stage === 'proposal_sent') {
      recommendations.push('Follow up on proposal questions');
      recommendations.push('Schedule walkthrough of proposal');
    }

    if (prospect.stage === 'negotiation') {
      recommendations.push('Address any remaining objections');
      recommendations.push('Work toward mutual close plan');
    }

    return recommendations;
  }

  /**
   * Get historical pipeline growth rate
   */
  private async getHistoricalPipelineGrowth(teamId: string, period: ForecastPeriod): Promise<number> {
    // Placeholder - would calculate actual growth rate from historical data
    return 0.15; // 15% growth
  }

  /**
   * Calculate pipeline health score
   */
  private calculatePipelineHealth(metrics: {
    pipelineCoverage: number;
    growthRate: number;
    winRate: number;
    avgDealAge: number;
  }): number {
    let score = 50; // Base score

    // Pipeline coverage (0-30 points)
    if (metrics.pipelineCoverage >= 300) score += 30;
    else if (metrics.pipelineCoverage >= 200) score += 20;
    else if (metrics.pipelineCoverage >= 100) score += 10;
    else score -= 10;

    // Growth rate (0-25 points)
    if (metrics.growthRate >= 20) score += 25;
    else if (metrics.growthRate >= 10) score += 15;
    else if (metrics.growthRate >= 0) score += 5;
    else score -= 10;

    // Win rate (0-25 points)
    if (metrics.winRate >= 30) score += 25;
    else if (metrics.winRate >= 20) score += 15;
    else if (metrics.winRate >= 10) score += 5;

    // Deal age (0-20 points)
    if (metrics.avgDealAge <= 30) score += 20;
    else if (metrics.avgDealAge <= 45) score += 10;
    else score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Group pipeline by stage
   */
  private groupByStage(pipeline: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    pipeline.forEach(p => {
      grouped[p.stage] = (grouped[p.stage] || 0) + 1;
    });
    return grouped;
  }
}

/**
 * Create Forecasting Service
 */
export function createForecastingService(apiKey?: string): ForecastingService {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new ForecastingService(key);
}
