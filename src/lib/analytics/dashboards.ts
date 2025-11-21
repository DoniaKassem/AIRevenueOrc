/**
 * Dashboards & Reporting
 * Pre-configured dashboards and report generation
 */

import { supabase } from '../supabase';
import { AnalyticsEngine, DateRange } from './engine';
import { ForecastingService, ForecastPeriod } from './forecasting';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'leaderboard' | 'forecast';
  title: string;
  data: any;
  config?: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'funnel';
    timeRange?: DateRange;
    refreshInterval?: number; // seconds
    size?: 'small' | 'medium' | 'large';
  };
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  userRole: 'admin' | 'manager' | 'rep' | 'executive';
  widgets: DashboardWidget[];
  layout: Array<{
    widgetId: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
}

export interface Report {
  id: string;
  name: string;
  type: 'team_performance' | 'pipeline' | 'forecast' | 'activity' | 'rep_scorecard';
  generatedAt: Date;
  period: DateRange;
  data: any;
  format: 'json' | 'csv' | 'pdf';
}

/**
 * Dashboard Service
 */
export class DashboardService {
  private analytics: AnalyticsEngine;
  private forecasting: ForecastingService;

  constructor(openaiApiKey?: string) {
    this.analytics = new AnalyticsEngine();
    if (openaiApiKey) {
      this.forecasting = new ForecastingService(openaiApiKey);
    }
  }

  /**
   * Get executive dashboard
   */
  async getExecutiveDashboard(teamId: string, period: DateRange): Promise<Dashboard> {
    const metrics = await this.analytics.getTeamMetrics(teamId, period);
    const pipelineStages = await this.analytics.getPipelineStageMetrics(teamId);
    const leaderboard = await this.analytics.getTeamLeaderboard(teamId, period, 5);

    let forecast = null;
    if (this.forecasting) {
      const forecastPeriod: ForecastPeriod = {
        period: 'quarter',
        startDate: period.startDate,
        endDate: new Date(period.startDate.getTime() + 90 * 24 * 60 * 60 * 1000)
      };
      forecast = await this.forecasting.generateRevenueForecast(teamId, forecastPeriod);
    }

    const widgets: DashboardWidget[] = [
      // Key metrics row
      {
        id: 'revenue',
        type: 'metric',
        title: 'Revenue',
        data: {
          value: metrics.metrics.revenueWon,
          format: 'currency',
          trend: metrics.trends.revenueGrowth,
          target: metrics.metrics.revenueTarget,
          attainment: metrics.metrics.revenueAttainment
        },
        config: { size: 'small' }
      },
      {
        id: 'pipeline',
        type: 'metric',
        title: 'Pipeline',
        data: {
          value: metrics.metrics.pipelineValue,
          format: 'currency',
          trend: metrics.trends.pipelineGrowth,
          weighted: metrics.metrics.weightedPipeline
        },
        config: { size: 'small' }
      },
      {
        id: 'win_rate',
        type: 'metric',
        title: 'Win Rate',
        data: {
          value: metrics.metrics.winRate,
          format: 'percentage',
          trend: metrics.trends.winRateChange
        },
        config: { size: 'small' }
      },
      {
        id: 'avg_deal_size',
        type: 'metric',
        title: 'Avg Deal Size',
        data: {
          value: metrics.metrics.avgDealSize,
          format: 'currency'
        },
        config: { size: 'small' }
      },

      // Pipeline funnel
      {
        id: 'pipeline_funnel',
        type: 'funnel',
        title: 'Pipeline Funnel',
        data: {
          stages: pipelineStages.map(s => ({
            name: s.stage,
            value: s.value,
            count: s.count
          }))
        },
        config: { chartType: 'funnel', size: 'large' }
      },

      // Revenue forecast
      {
        id: 'forecast',
        type: 'forecast',
        title: 'Revenue Forecast',
        data: forecast,
        config: { size: 'medium' }
      },

      // Team leaderboard
      {
        id: 'leaderboard',
        type: 'leaderboard',
        title: 'Top Performers',
        data: {
          reps: leaderboard.map(rep => ({
            name: rep.userName,
            revenue: rep.metrics.revenueWon,
            attainment: rep.quotaAttainment,
            deals: rep.metrics.dealsWon
          }))
        },
        config: { size: 'medium' }
      },

      // Activity metrics
      {
        id: 'activity_breakdown',
        type: 'chart',
        title: 'Activity Breakdown',
        data: {
          labels: ['Emails', 'Calls', 'Meetings'],
          values: [
            metrics.metrics.emailsSent,
            metrics.metrics.callsMade,
            metrics.metrics.meetingsHeld
          ]
        },
        config: { chartType: 'pie', size: 'small' }
      }
    ];

    return {
      id: `exec_dashboard_${teamId}`,
      name: 'Executive Dashboard',
      description: 'High-level overview of team performance and pipeline health',
      userRole: 'executive',
      widgets,
      layout: this.generateDefaultLayout(widgets)
    };
  }

  /**
   * Get manager dashboard
   */
  async getManagerDashboard(teamId: string, period: DateRange): Promise<Dashboard> {
    const metrics = await this.analytics.getTeamMetrics(teamId, period);
    const pipelineStages = await this.analytics.getPipelineStageMetrics(teamId);
    const leaderboard = await this.analytics.getTeamLeaderboard(teamId, period, 10);
    const conversionFunnel = await this.analytics.getConversionFunnel(teamId, period);

    const widgets: DashboardWidget[] = [
      // Team metrics
      {
        id: 'team_revenue',
        type: 'metric',
        title: 'Team Revenue',
        data: {
          value: metrics.metrics.revenueWon,
          format: 'currency',
          trend: metrics.trends.revenueGrowth,
          target: metrics.metrics.revenueTarget,
          attainment: metrics.metrics.revenueAttainment
        }
      },
      {
        id: 'team_pipeline',
        type: 'metric',
        title: 'Team Pipeline',
        data: {
          value: metrics.metrics.pipelineValue,
          format: 'currency',
          count: metrics.metrics.pipelineCount
        }
      },
      {
        id: 'team_activities',
        type: 'metric',
        title: 'Total Activities',
        data: {
          value: metrics.metrics.totalActivities,
          trend: metrics.trends.activityGrowth,
          breakdown: {
            emails: metrics.metrics.emailsSent,
            calls: metrics.metrics.callsMade,
            meetings: metrics.metrics.meetingsHeld
          }
        }
      },

      // Conversion funnel
      {
        id: 'conversion_funnel',
        type: 'funnel',
        title: 'Conversion Funnel',
        data: { stages: conversionFunnel },
        config: { chartType: 'funnel', size: 'large' }
      },

      // Pipeline by stage
      {
        id: 'pipeline_by_stage',
        type: 'chart',
        title: 'Pipeline by Stage',
        data: {
          labels: pipelineStages.map(s => s.stage),
          values: pipelineStages.map(s => s.value)
        },
        config: { chartType: 'bar', size: 'medium' }
      },

      // Team leaderboard
      {
        id: 'team_leaderboard',
        type: 'leaderboard',
        title: 'Team Leaderboard',
        data: {
          reps: leaderboard.map((rep, idx) => ({
            rank: idx + 1,
            name: rep.userName,
            revenue: rep.metrics.revenueWon,
            quota: rep.metrics.revenueTarget,
            attainment: rep.quotaAttainment,
            deals: rep.metrics.dealsWon,
            pipeline: rep.metrics.pipelineValue
          }))
        },
        config: { size: 'large' }
      },

      // Win rate trends
      {
        id: 'win_rate_trend',
        type: 'chart',
        title: 'Win Rate Trend',
        data: {
          current: metrics.metrics.winRate,
          change: metrics.trends.winRateChange
        },
        config: { chartType: 'line', size: 'medium' }
      },

      // Stage velocity
      {
        id: 'stage_velocity',
        type: 'table',
        title: 'Stage Velocity',
        data: {
          headers: ['Stage', 'Deals', 'Avg Time', 'Conversion', 'Velocity'],
          rows: pipelineStages.map(s => [
            s.stage,
            s.count,
            `${s.avgTimeInStage.toFixed(1)} days`,
            `${s.conversionRate.toFixed(1)}%`,
            s.velocityScore.toFixed(2)
          ])
        },
        config: { size: 'large' }
      }
    ];

    return {
      id: `manager_dashboard_${teamId}`,
      name: 'Manager Dashboard',
      description: 'Detailed team performance and pipeline management',
      userRole: 'manager',
      widgets,
      layout: this.generateDefaultLayout(widgets)
    };
  }

  /**
   * Get rep dashboard
   */
  async getRepDashboard(userId: string, period: DateRange): Promise<Dashboard> {
    const metrics = await this.analytics.getRepMetrics(userId, period);

    // Get rep's prospects by stage
    const { data: prospects } = await supabase
      .from('prospects')
      .select('stage, accounts(*)')
      .eq('owner_id', userId)
      .not('stage', 'in', '(closed_won,closed_lost,disqualified)');

    const pipelineByStage = prospects?.reduce((acc, p) => {
      acc[p.stage] = (acc[p.stage] || 0) + (p.accounts?.revenue || 0);
      return acc;
    }, {} as Record<string, number>) || {};

    // Get top deals
    const topDeals = prospects
      ?.sort((a, b) => (b.accounts?.revenue || 0) - (a.accounts?.revenue || 0))
      .slice(0, 5) || [];

    const widgets: DashboardWidget[] = [
      // Personal metrics
      {
        id: 'my_revenue',
        type: 'metric',
        title: 'My Revenue',
        data: {
          value: metrics.metrics.revenueWon,
          format: 'currency',
          target: metrics.metrics.revenueTarget,
          attainment: metrics.quotaAttainment,
          trend: metrics.trends.revenueGrowth
        }
      },
      {
        id: 'my_pipeline',
        type: 'metric',
        title: 'My Pipeline',
        data: {
          value: metrics.metrics.pipelineValue,
          format: 'currency',
          count: metrics.metrics.pipelineCount
        }
      },
      {
        id: 'my_quota',
        type: 'metric',
        title: 'Quota Attainment',
        data: {
          value: metrics.quotaAttainment,
          format: 'percentage',
          target: 100
        }
      },
      {
        id: 'my_win_rate',
        type: 'metric',
        title: 'My Win Rate',
        data: {
          value: metrics.metrics.winRate,
          format: 'percentage',
          trend: metrics.trends.winRateChange
        }
      },

      // Activity summary
      {
        id: 'my_activities',
        type: 'chart',
        title: 'My Activities',
        data: {
          labels: ['Emails', 'Calls', 'Meetings'],
          values: [
            metrics.metrics.emailsSent,
            metrics.metrics.callsMade,
            metrics.metrics.meetingsHeld
          ]
        },
        config: { chartType: 'bar', size: 'medium' }
      },

      // Pipeline by stage
      {
        id: 'my_pipeline_stages',
        type: 'chart',
        title: 'Pipeline by Stage',
        data: {
          labels: Object.keys(pipelineByStage),
          values: Object.values(pipelineByStage)
        },
        config: { chartType: 'bar', size: 'medium' }
      },

      // Top deals
      {
        id: 'top_deals',
        type: 'table',
        title: 'Top Deals',
        data: {
          headers: ['Prospect', 'Stage', 'Value'],
          rows: topDeals.map(d => [
            `${d.first_name} ${d.last_name}`,
            d.stage,
            `$${(d.accounts?.revenue || 0).toLocaleString()}`
          ])
        },
        config: { size: 'medium' }
      },

      // Performance vs target
      {
        id: 'performance_gauge',
        type: 'metric',
        title: 'Performance vs Target',
        data: {
          current: metrics.metrics.revenueWon,
          target: metrics.metrics.revenueTarget,
          percentage: metrics.quotaAttainment
        },
        config: { size: 'small' }
      }
    ];

    return {
      id: `rep_dashboard_${userId}`,
      name: 'My Dashboard',
      description: 'Personal performance and pipeline overview',
      userRole: 'rep',
      widgets,
      layout: this.generateDefaultLayout(widgets)
    };
  }

  /**
   * Generate team performance report
   */
  async generateTeamPerformanceReport(
    teamId: string,
    period: DateRange,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<Report> {
    const metrics = await this.analytics.getTeamMetrics(teamId, period);
    const pipelineStages = await this.analytics.getPipelineStageMetrics(teamId);
    const leaderboard = await this.analytics.getTeamLeaderboard(teamId, period);
    const activityBreakdown = await this.analytics.getActivityBreakdown(teamId, period);

    const reportData = {
      summary: {
        teamName: metrics.teamName,
        period,
        generatedAt: new Date()
      },
      metrics: metrics.metrics,
      trends: metrics.trends,
      pipelineAnalysis: {
        stages: pipelineStages,
        totalValue: metrics.metrics.pipelineValue,
        weightedValue: metrics.metrics.weightedPipeline,
        dealCount: metrics.metrics.pipelineCount
      },
      teamPerformance: {
        topPerformers: leaderboard.slice(0, 5),
        avgPerformance: {
          revenuePerRep: metrics.metrics.revenueWon / Math.max(leaderboard.length, 1),
          activitiesPerRep: metrics.metrics.totalActivities / Math.max(leaderboard.length, 1)
        }
      },
      activities: activityBreakdown,
      recommendations: this.generateRecommendations(metrics.metrics, metrics.trends)
    };

    if (format === 'csv') {
      // Convert to CSV format
      return {
        id: `report_${Date.now()}`,
        name: 'Team Performance Report',
        type: 'team_performance',
        generatedAt: new Date(),
        period,
        data: this.convertToCSV(reportData),
        format: 'csv'
      };
    }

    return {
      id: `report_${Date.now()}`,
      name: 'Team Performance Report',
      type: 'team_performance',
      generatedAt: new Date(),
      period,
      data: reportData,
      format
    };
  }

  /**
   * Generate rep scorecard
   */
  async generateRepScorecard(
    userId: string,
    period: DateRange
  ): Promise<Report> {
    const metrics = await this.analytics.getRepMetrics(userId, period);

    // Get AI lead scores for rep's prospects
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id, first_name, last_name, stage, score')
      .eq('owner_id', userId);

    const avgLeadScore = prospects?.reduce((sum, p) => sum + (p.score || 0), 0) /
      Math.max(prospects?.length || 1, 1);

    const reportData = {
      rep: {
        userId,
        name: metrics.userName,
        role: metrics.role
      },
      period,
      performance: {
        revenue: metrics.metrics.revenueWon,
        quota: metrics.metrics.revenueTarget,
        attainment: metrics.quotaAttainment,
        ranking: metrics.ranking
      },
      activities: {
        total: metrics.metrics.totalActivities,
        emails: metrics.metrics.emailsSent,
        calls: metrics.metrics.callsMade,
        meetings: metrics.metrics.meetingsHeld
      },
      pipeline: {
        value: metrics.metrics.pipelineValue,
        count: metrics.metrics.pipelineCount,
        avgDealSize: metrics.metrics.avgDealSize
      },
      efficiency: {
        winRate: metrics.metrics.winRate,
        avgSalesCycle: metrics.metrics.avgSalesCycle,
        velocityScore: metrics.metrics.velocityScore,
        emailOpenRate: metrics.metrics.emailOpenRate,
        emailClickRate: metrics.metrics.emailClickRate
      },
      leadQuality: {
        avgLeadScore,
        dealsWon: metrics.metrics.dealsWon,
        dealsLost: metrics.metrics.dealsLost
      },
      strengths: this.identifyStrengths(metrics.metrics),
      areasForImprovement: this.identifyImprovementAreas(metrics.metrics),
      recommendations: this.generateRepRecommendations(metrics.metrics)
    };

    return {
      id: `scorecard_${userId}_${Date.now()}`,
      name: 'Rep Scorecard',
      type: 'rep_scorecard',
      generatedAt: new Date(),
      period,
      data: reportData,
      format: 'json'
    };
  }

  /**
   * Generate default layout for widgets
   */
  private generateDefaultLayout(widgets: DashboardWidget[]): Dashboard['layout'] {
    const layout: Dashboard['layout'] = [];
    let x = 0;
    let y = 0;

    widgets.forEach(widget => {
      const size = widget.config?.size || 'medium';
      const width = size === 'small' ? 3 : size === 'medium' ? 6 : 12;
      const height = size === 'small' ? 2 : size === 'medium' ? 4 : 6;

      layout.push({
        widgetId: widget.id,
        position: { x, y },
        size: { width, height }
      });

      x += width;
      if (x >= 12) {
        x = 0;
        y += height;
      }
    });

    return layout;
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    metrics: any,
    trends: any
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.revenueAttainment < 70) {
      recommendations.push('Revenue attainment is below target. Focus on closing late-stage deals and increasing activity levels.');
    }

    if (metrics.winRate < 20) {
      recommendations.push('Win rate is below average. Review qualification criteria and focus on higher-quality leads.');
    }

    if (metrics.avgSalesCycle > 60) {
      recommendations.push('Sales cycle is longer than optimal. Identify and remove bottlenecks in the sales process.');
    }

    if (metrics.emailOpenRate < 30) {
      recommendations.push('Email open rates are low. Improve subject lines and personalization.');
    }

    if (trends.pipelineGrowth < 0) {
      recommendations.push('Pipeline is shrinking. Increase prospecting activities and lead generation efforts.');
    }

    if (metrics.meetingsHeld < 10) {
      recommendations.push('Meeting volume is low. Focus on booking more qualified meetings.');
    }

    return recommendations;
  }

  /**
   * Identify rep strengths
   */
  private identifyStrengths(metrics: any): string[] {
    const strengths: string[] = [];

    if (metrics.winRate > 30) strengths.push('High win rate');
    if (metrics.emailOpenRate > 40) strengths.push('Strong email engagement');
    if (metrics.avgSalesCycle < 45) strengths.push('Fast sales cycle');
    if (metrics.meetingBookedRate > 10) strengths.push('Effective at booking meetings');

    return strengths;
  }

  /**
   * Identify improvement areas
   */
  private identifyImprovementAreas(metrics: any): string[] {
    const areas: string[] = [];

    if (metrics.winRate < 20) areas.push('Win rate needs improvement');
    if (metrics.emailOpenRate < 25) areas.push('Email engagement is low');
    if (metrics.avgSalesCycle > 60) areas.push('Sales cycle is too long');
    if (metrics.totalActivities < 50) areas.push('Activity levels are low');

    return areas;
  }

  /**
   * Generate rep-specific recommendations
   */
  private generateRepRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.emailOpenRate < 30) {
      recommendations.push('Use AI email writer to improve email quality and open rates');
    }

    if (metrics.winRate < 25) {
      recommendations.push('Focus on better lead qualification using AI lead scoring');
    }

    if (metrics.avgResponseTime > 24) {
      recommendations.push('Reduce response time to prospect emails for better engagement');
    }

    return recommendations;
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simple CSV conversion
    // In production, would use a proper CSV library
    return JSON.stringify(data);
  }
}

/**
 * Create Dashboard Service
 */
export function createDashboardService(openaiApiKey?: string): DashboardService {
  return new DashboardService(openaiApiKey);
}
