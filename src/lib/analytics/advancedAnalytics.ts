/**
 * Advanced Analytics Engine
 * Cross-hub analytics, insights, and predictive analytics
 */

import { supabase } from '../supabase';

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  type: 'sales' | 'marketing' | 'service' | 'executive' | 'custom';
  widgets: DashboardWidget[];
  layout: {
    columns: number;
    widgets: Array<{
      widgetId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
  filters?: GlobalFilter[];
  refreshInterval?: number; // in seconds
  isPublic: boolean;
  sharedWith?: string[]; // user IDs
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  name: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'map' | 'list' | 'custom';
  dataSource: DataSource;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'scatter' | 'heatmap';
    xAxis?: string;
    yAxis?: string;
    groupBy?: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    format?: string;
  };
  filters?: WidgetFilter[];
  refreshInterval?: number;
}

export interface DataSource {
  object: 'prospect' | 'deal' | 'account' | 'activity' | 'campaign' | 'ticket' | 'form' | 'page' | 'custom';
  metric: string;
  timeRange?: {
    type: 'relative' | 'absolute';
    value?: string; // 'last_7_days', 'last_30_days', 'this_month', etc.
    start?: Date;
    end?: Date;
  };
  groupBy?: string;
  filters?: WidgetFilter[];
}

export interface WidgetFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'between';
  value: any;
}

export interface GlobalFilter {
  name: string;
  field: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text';
  defaultValue?: any;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  type: 'revenue' | 'pipeline' | 'activity' | 'marketing' | 'service' | 'custom';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
    recipients: string[];
  };
  sections: ReportSection[];
  filters?: GlobalFilter[];
  format: 'pdf' | 'excel' | 'csv' | 'json';
  lastGeneratedAt?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface ReportSection {
  id: string;
  title: string;
  description?: string;
  widgets: DashboardWidget[];
  pageBreak?: boolean;
}

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'prediction' | 'recommendation' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: any;
  change?: number; // percentage change
  recommendation?: string;
  actionUrl?: string;
  dismissedBy?: string[];
  expiresAt?: Date;
  createdAt: Date;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'lead_scoring' | 'churn_prediction' | 'revenue_forecast' | 'deal_close_probability' | 'custom';
  features: string[]; // Fields used for prediction
  targetVariable: string;
  algorithm: 'linear_regression' | 'logistic_regression' | 'random_forest' | 'neural_network' | 'gradient_boosting';
  accuracy?: number;
  lastTrainedAt?: Date;
  trainingDataCount?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Attribution {
  id: string;
  dealId?: string;
  prospectId: string;
  touchpoints: AttributionTouchpoint[];
  model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'u_shaped' | 'w_shaped';
  revenue?: number;
  createdAt: Date;
}

export interface AttributionTouchpoint {
  id: string;
  type: 'email' | 'form' | 'page_view' | 'ad_click' | 'social' | 'event' | 'call' | 'meeting';
  source: string;
  medium?: string;
  campaign?: string;
  credit: number; // Attribution credit (0-100%)
  occurredAt: Date;
}

/**
 * Advanced Analytics Service
 */
export class AdvancedAnalyticsService {
  /**
   * Create dashboard
   */
  async createDashboard(dashboard: Partial<AnalyticsDashboard>): Promise<AnalyticsDashboard> {
    const { data, error } = await supabase
      .from('analytics_dashboards')
      .insert({
        name: dashboard.name,
        description: dashboard.description,
        type: dashboard.type || 'custom',
        widgets: dashboard.widgets || [],
        layout: dashboard.layout || { columns: 12, widgets: [] },
        filters: dashboard.filters,
        refresh_interval: dashboard.refreshInterval,
        is_public: dashboard.isPublic || false,
        shared_with: dashboard.sharedWith,
        created_by: dashboard.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapDashboard(data);
  }

  /**
   * Update dashboard
   */
  async updateDashboard(dashboardId: string, updates: Partial<AnalyticsDashboard>): Promise<AnalyticsDashboard> {
    const { data, error } = await supabase
      .from('analytics_dashboards')
      .update({
        name: updates.name,
        description: updates.description,
        widgets: updates.widgets,
        layout: updates.layout,
        filters: updates.filters,
        refresh_interval: updates.refreshInterval,
        is_public: updates.isPublic,
        shared_with: updates.sharedWith,
        updated_at: new Date().toISOString()
      })
      .eq('id', dashboardId)
      .select()
      .single();

    if (error) throw error;
    return this.mapDashboard(data);
  }

  /**
   * Get dashboard
   */
  async getDashboard(dashboardId: string): Promise<AnalyticsDashboard> {
    const { data, error } = await supabase
      .from('analytics_dashboards')
      .select('*')
      .eq('id', dashboardId)
      .single();

    if (error) throw error;
    return this.mapDashboard(data);
  }

  /**
   * Get dashboards
   */
  async getDashboards(filters?: {
    type?: AnalyticsDashboard['type'];
    userId?: string;
  }): Promise<AnalyticsDashboard[]> {
    let query = supabase
      .from('analytics_dashboards')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.userId) {
      query = query.or(`created_by.eq.${filters.userId},shared_with.cs.{${filters.userId}},is_public.eq.true`);
    }

    const { data } = await query;
    return (data || []).map(this.mapDashboard);
  }

  /**
   * Execute widget query
   */
  async executeWidget(widget: DashboardWidget, globalFilters?: GlobalFilter[]): Promise<any> {
    const { dataSource } = widget;

    // Build query based on data source
    let query = supabase.from(this.getTableName(dataSource.object));

    // Apply time range
    if (dataSource.timeRange) {
      const { start, end } = this.getTimeRange(dataSource.timeRange);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    }

    // Apply filters
    if (dataSource.filters) {
      query = this.applyFilters(query, dataSource.filters);
    }

    if (globalFilters) {
      query = this.applyFilters(query, globalFilters);
    }

    // Execute query
    const { data, error } = await query.select('*');

    if (error) throw error;

    // Apply aggregation
    return this.aggregateData(data || [], widget.visualization);
  }

  /**
   * Generate insights
   */
  async generateInsights(organizationId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Analyze deal pipeline
    const pipelineInsights = await this.analyzePipeline(organizationId);
    insights.push(...pipelineInsights);

    // Analyze marketing performance
    const marketingInsights = await this.analyzeMarketing(organizationId);
    insights.push(...marketingInsights);

    // Analyze service metrics
    const serviceInsights = await this.analyzeService(organizationId);
    insights.push(...serviceInsights);

    // Save insights
    for (const insight of insights) {
      await supabase.from('analytics_insights').insert({
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        metric: insight.metric,
        value: insight.value,
        change: insight.change,
        recommendation: insight.recommendation,
        action_url: insight.actionUrl,
        expires_at: insight.expiresAt?.toISOString()
      });
    }

    return insights;
  }

  /**
   * Get insights
   */
  async getInsights(filters?: {
    type?: Insight['type'];
    severity?: Insight['severity'];
    limit?: number;
  }): Promise<Insight[]> {
    let query = supabase
      .from('analytics_insights')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }

    // Don't show expired or dismissed insights
    query = query.or('expires_at.is.null,expires_at.gt.now()');

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data } = await query;
    return (data || []).map(this.mapInsight);
  }

  /**
   * Calculate attribution
   */
  async calculateAttribution(
    prospectId: string,
    model: Attribution['model'] = 'linear'
  ): Promise<Attribution> {
    // Get all touchpoints for prospect
    const touchpoints = await this.getTouchpoints(prospectId);

    // Calculate credit based on model
    const creditedTouchpoints = this.applyCreditModel(touchpoints, model);

    // Save attribution
    const { data, error } = await supabase
      .from('attributions')
      .insert({
        prospect_id: prospectId,
        touchpoints: creditedTouchpoints,
        model
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAttribution(data);
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(params: {
    cohortBy: 'signup_date' | 'first_purchase' | 'custom';
    metric: 'retention' | 'revenue' | 'activity';
    period: 'daily' | 'weekly' | 'monthly';
    startDate: Date;
    endDate: Date;
  }): Promise<any> {
    // This would implement cohort analysis
    // For now, return placeholder
    return {
      cohorts: [],
      periods: [],
      data: []
    };
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(steps: Array<{
    name: string;
    event: string;
    filters?: WidgetFilter[];
  }>): Promise<{
    steps: Array<{
      name: string;
      count: number;
      percentage: number;
      dropoff: number;
    }>;
    totalEntered: number;
    totalCompleted: number;
    conversionRate: number;
  }> {
    // This would implement funnel analysis
    // For now, return placeholder
    return {
      steps: [],
      totalEntered: 0,
      totalCompleted: 0,
      conversionRate: 0
    };
  }

  /**
   * Analyze pipeline
   */
  private async analyzePipeline(organizationId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Get deals aging in pipeline
    const { data: deals } = await supabase
      .from('deals')
      .select('*')
      .eq('status', 'open')
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (deals && deals.length > 5) {
      insights.push({
        id: '',
        type: 'alert',
        severity: 'warning',
        title: 'Aging Deals in Pipeline',
        description: `${deals.length} deals have been in pipeline for over 30 days`,
        metric: 'pipeline_age',
        value: deals.length,
        recommendation: 'Review these deals and take action to move them forward or close them',
        actionUrl: '/deals?filter=aging',
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze marketing
   */
  private async analyzeMarketing(organizationId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Get campaigns with low open rates
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('status', 'sent')
      .lt('stats->>opened', '20'); // Less than 20% open rate

    if (campaigns && campaigns.length > 0) {
      insights.push({
        id: '',
        type: 'recommendation',
        severity: 'info',
        title: 'Low Email Open Rates',
        description: `${campaigns.length} recent campaigns have open rates below 20%`,
        metric: 'email_open_rate',
        value: campaigns.length,
        recommendation: 'Consider A/B testing subject lines and send times',
        actionUrl: '/campaigns',
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Analyze service
   */
  private async analyzeService(organizationId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Get tickets breaching SLA
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('sla_breached', true)
      .eq('status', 'open');

    if (tickets && tickets.length > 0) {
      insights.push({
        id: '',
        type: 'alert',
        severity: 'critical',
        title: 'SLA Breaches',
        description: `${tickets.length} open tickets have breached their SLA`,
        metric: 'sla_breach_count',
        value: tickets.length,
        recommendation: 'Prioritize these tickets immediately',
        actionUrl: '/tickets?filter=sla_breached',
        createdAt: new Date()
      });
    }

    return insights;
  }

  /**
   * Get touchpoints
   */
  private async getTouchpoints(prospectId: string): Promise<AttributionTouchpoint[]> {
    // This would query activities, form submissions, page views, etc.
    // For now, return placeholder
    return [];
  }

  /**
   * Apply credit model
   */
  private applyCreditModel(
    touchpoints: AttributionTouchpoint[],
    model: Attribution['model']
  ): AttributionTouchpoint[] {
    const count = touchpoints.length;
    if (count === 0) return [];

    return touchpoints.map((tp, index) => {
      let credit = 0;

      switch (model) {
        case 'first_touch':
          credit = index === 0 ? 100 : 0;
          break;
        case 'last_touch':
          credit = index === count - 1 ? 100 : 0;
          break;
        case 'linear':
          credit = 100 / count;
          break;
        case 'time_decay':
          // More recent touchpoints get more credit
          const decayRate = 0.5;
          const daysSince = (Date.now() - tp.occurredAt.getTime()) / (1000 * 60 * 60 * 24);
          credit = Math.pow(decayRate, daysSince / 7) * (100 / count);
          break;
        case 'u_shaped':
          // 40% to first, 40% to last, 20% distributed among middle
          if (index === 0 || index === count - 1) {
            credit = 40;
          } else {
            credit = 20 / Math.max(1, count - 2);
          }
          break;
        case 'w_shaped':
          // 30% first, 30% last, 30% to opportunity creation, 10% to others
          if (index === 0 || index === count - 1) {
            credit = 30;
          } else if (index === Math.floor(count / 2)) {
            credit = 30;
          } else {
            credit = 10 / Math.max(1, count - 3);
          }
          break;
      }

      return { ...tp, credit };
    });
  }

  /**
   * Get time range
   */
  private getTimeRange(timeRange: DataSource['timeRange']): { start: Date; end: Date } {
    const now = new Date();
    const end = timeRange?.end || now;
    let start = timeRange?.start || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (timeRange?.type === 'relative' && timeRange.value) {
      const match = timeRange.value.match(/last_(\d+)_(days|weeks|months)/);
      if (match) {
        const amount = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
          case 'days':
            start = new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
            break;
          case 'weeks':
            start = new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
            break;
          case 'months':
            start = new Date(now.getFullYear(), now.getMonth() - amount, now.getDate());
            break;
        }
      }
    }

    return { start, end };
  }

  /**
   * Apply filters
   */
  private applyFilters(query: any, filters: WidgetFilter[]): any {
    for (const filter of filters) {
      switch (filter.operator) {
        case 'equals':
          query = query.eq(filter.field, filter.value);
          break;
        case 'not_equals':
          query = query.neq(filter.field, filter.value);
          break;
        case 'greater_than':
          query = query.gt(filter.field, filter.value);
          break;
        case 'less_than':
          query = query.lt(filter.field, filter.value);
          break;
        case 'contains':
          query = query.ilike(filter.field, `%${filter.value}%`);
          break;
        case 'in':
          query = query.in(filter.field, filter.value);
          break;
      }
    }
    return query;
  }

  /**
   * Aggregate data
   */
  private aggregateData(data: any[], visualization: DashboardWidget['visualization']): any {
    if (!visualization.aggregation) return data;

    const { aggregation, groupBy } = visualization;

    if (!groupBy) {
      // Single value aggregation
      const values = data.map(d => d[visualization.yAxis || 'value']);
      switch (aggregation) {
        case 'sum':
          return values.reduce((a, b) => a + b, 0);
        case 'avg':
          return values.reduce((a, b) => a + b, 0) / values.length;
        case 'count':
          return values.length;
        case 'min':
          return Math.min(...values);
        case 'max':
          return Math.max(...values);
      }
    }

    // Group by aggregation
    const groups: Record<string, any[]> = {};
    data.forEach(item => {
      const key = item[groupBy];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return Object.entries(groups).map(([key, items]) => ({
      [groupBy]: key,
      value: this.aggregateData(items, { ...visualization, groupBy: undefined })
    }));
  }

  /**
   * Get table name
   */
  private getTableName(object: DataSource['object']): string {
    const tableMap: Record<string, string> = {
      prospect: 'prospects',
      deal: 'deals',
      account: 'accounts',
      activity: 'activities',
      campaign: 'marketing_campaigns',
      ticket: 'tickets',
      form: 'forms',
      page: 'cms_pages'
    };
    return tableMap[object] || object;
  }

  /**
   * Map database record to AnalyticsDashboard
   */
  private mapDashboard(data: any): AnalyticsDashboard {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      type: data.type,
      widgets: data.widgets,
      layout: data.layout,
      filters: data.filters,
      refreshInterval: data.refresh_interval,
      isPublic: data.is_public,
      sharedWith: data.shared_with,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to Insight
   */
  private mapInsight(data: any): Insight {
    return {
      id: data.id,
      type: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      metric: data.metric,
      value: data.value,
      change: data.change,
      recommendation: data.recommendation,
      actionUrl: data.action_url,
      dismissedBy: data.dismissed_by,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to Attribution
   */
  private mapAttribution(data: any): Attribution {
    return {
      id: data.id,
      dealId: data.deal_id,
      prospectId: data.prospect_id,
      touchpoints: data.touchpoints,
      model: data.model,
      revenue: data.revenue,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Advanced Analytics Service
 */
export function createAdvancedAnalyticsService(): AdvancedAnalyticsService {
  return new AdvancedAnalyticsService();
}
