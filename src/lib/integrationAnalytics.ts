/**
 * Integration Analytics Service
 * Tracks and reports on API usage, performance, and costs across all integrations
 */

import { supabase } from './supabase';

export interface IntegrationUsageMetrics {
  integrationId: string;
  integrationName: string;
  providerKey: string;
  date: string;
  apiCallsCount: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  costUsd: number;
  healthScore: number;
}

export interface IntegrationHealthStatus {
  integrationId: string;
  integrationName: string;
  providerKey: string;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  healthScore: number;
  lastSyncAt: string | null;
  errorCount24h: number;
  successRate24h: number;
  avgLatencyMs: number;
  issues: string[];
}

export interface UsageAnalyticsSummary {
  totalApiCalls: number;
  totalSuccessfulCalls: number;
  totalFailedCalls: number;
  totalCostUsd: number;
  avgSuccessRate: number;
  activeIntegrations: number;
}

/**
 * Track a single API call for analytics
 */
export async function trackApiCall(
  teamId: string,
  integrationId: string,
  success: boolean,
  latencyMs: number,
  costUsd: number = 0
): Promise<void> {
  try {
    const { error } = await supabase.rpc('track_api_call', {
      p_team_id: teamId,
      p_integration_id: integrationId,
      p_success: success,
      p_latency_ms: latencyMs,
      p_cost_usd: costUsd,
    });

    if (error) {
      console.error('Error tracking API call:', error);
    }
  } catch (err) {
    console.error('Failed to track API call:', err);
  }
}

/**
 * Get usage metrics for a specific integration over a date range
 */
export async function getIntegrationUsageMetrics(
  teamId: string,
  integrationId: string,
  startDate: string,
  endDate: string
): Promise<IntegrationUsageMetrics[]> {
  const { data, error } = await supabase
    .from('integration_usage_analytics')
    .select(`
      *,
      integration:team_integrations!inner(
        id,
        provider_key,
        integration_providers!inner(
          name
        )
      )
    `)
    .eq('team_id', teamId)
    .eq('integration_id', integrationId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching usage metrics:', error);
    return [];
  }

  return (data || []).map((record: any) => ({
    integrationId: record.integration_id,
    integrationName: record.integration.integration_providers.name,
    providerKey: record.integration.provider_key,
    date: record.date,
    apiCallsCount: record.api_calls_count,
    successCount: record.success_count,
    errorCount: record.error_count,
    successRate: record.api_calls_count > 0
      ? (record.success_count / record.api_calls_count) * 100
      : 100,
    avgLatencyMs: record.avg_latency_ms,
    costUsd: parseFloat(record.cost_usd || 0),
    healthScore: 0, // Will be calculated
  }));
}

/**
 * Get health status for all integrations in a team
 */
export async function getIntegrationHealthStatus(
  teamId: string
): Promise<IntegrationHealthStatus[]> {
  // Get all team integrations
  const { data: integrations, error: intError } = await supabase
    .from('team_integrations')
    .select(`
      id,
      provider_key,
      last_sync_at,
      integration_providers!inner(
        name
      )
    `)
    .eq('team_id', teamId)
    .eq('is_active', true);

  if (intError || !integrations) {
    console.error('Error fetching integrations:', intError);
    return [];
  }

  // Get usage data for last 24 hours for each integration
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const healthStatuses: IntegrationHealthStatus[] = [];

  for (const integration of integrations) {
    const { data: analytics } = await supabase
      .from('integration_usage_analytics')
      .select('*')
      .eq('integration_id', integration.id)
      .gte('date', yesterdayStr)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    const errorCount = analytics?.error_count || 0;
    const successCount = analytics?.success_count || 0;
    const totalCalls = analytics?.api_calls_count || 0;
    const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 100;
    const avgLatency = analytics?.avg_latency_ms || 0;

    // Calculate health score
    const { data: healthData } = await supabase.rpc(
      'calculate_integration_health_score',
      { p_integration_id: integration.id }
    );
    const healthScore = healthData || 100;

    // Determine status and issues
    let status: IntegrationHealthStatus['status'] = 'healthy';
    const issues: string[] = [];

    if (healthScore < 30) {
      status = 'critical';
    } else if (healthScore < 60) {
      status = 'degraded';
    }

    if (successRate < 90 && totalCalls > 0) {
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
    }
    if (avgLatency > 2000) {
      issues.push(`High latency: ${avgLatency}ms`);
    }
    if (errorCount > 10) {
      issues.push(`High error count: ${errorCount} errors in 24h`);
    }
    if (!integration.last_sync_at) {
      issues.push('Never synced');
    } else {
      const lastSync = new Date(integration.last_sync_at);
      const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSync > 24) {
        issues.push(`No sync in ${Math.floor(hoursSinceSync)} hours`);
      }
    }

    if (issues.length > 0 && status === 'healthy') {
      status = 'degraded';
    }

    healthStatuses.push({
      integrationId: integration.id,
      integrationName: integration.integration_providers.name,
      providerKey: integration.provider_key,
      status,
      healthScore,
      lastSyncAt: integration.last_sync_at,
      errorCount24h: errorCount,
      successRate24h: successRate,
      avgLatencyMs: avgLatency,
      issues,
    });
  }

  return healthStatuses;
}

/**
 * Get usage analytics summary for a team over a date range
 */
export async function getUsageAnalyticsSummary(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<UsageAnalyticsSummary> {
  const { data, error } = await supabase
    .from('integration_usage_analytics')
    .select('*')
    .eq('team_id', teamId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) {
    console.error('Error fetching usage summary:', error);
    return {
      totalApiCalls: 0,
      totalSuccessfulCalls: 0,
      totalFailedCalls: 0,
      totalCostUsd: 0,
      avgSuccessRate: 0,
      activeIntegrations: 0,
    };
  }

  const totalApiCalls = data.reduce((sum, r) => sum + (r.api_calls_count || 0), 0);
  const totalSuccessfulCalls = data.reduce((sum, r) => sum + (r.success_count || 0), 0);
  const totalFailedCalls = data.reduce((sum, r) => sum + (r.error_count || 0), 0);
  const totalCostUsd = data.reduce((sum, r) => sum + parseFloat(r.cost_usd || 0), 0);
  const avgSuccessRate = totalApiCalls > 0 ? (totalSuccessfulCalls / totalApiCalls) * 100 : 0;

  // Count unique integration IDs
  const activeIntegrations = new Set(data.map(r => r.integration_id)).size;

  return {
    totalApiCalls,
    totalSuccessfulCalls,
    totalFailedCalls,
    totalCostUsd,
    avgSuccessRate,
    activeIntegrations,
  };
}

/**
 * Get cost breakdown by integration
 */
export async function getCostBreakdown(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ integrationName: string; providerKey: string; totalCost: number }>> {
  const { data, error } = await supabase
    .from('integration_usage_analytics')
    .select(`
      cost_usd,
      integration:team_integrations!inner(
        provider_key,
        integration_providers!inner(
          name
        )
      )
    `)
    .eq('team_id', teamId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !data) {
    console.error('Error fetching cost breakdown:', error);
    return [];
  }

  // Group by integration and sum costs
  const costMap = new Map<string, { name: string; key: string; cost: number }>();

  data.forEach((record: any) => {
    const key = record.integration.provider_key;
    const name = record.integration.integration_providers.name;
    const cost = parseFloat(record.cost_usd || 0);

    if (costMap.has(key)) {
      const existing = costMap.get(key)!;
      existing.cost += cost;
    } else {
      costMap.set(key, { name, key, cost });
    }
  });

  return Array.from(costMap.values())
    .map(({ name, key, cost }) => ({
      integrationName: name,
      providerKey: key,
      totalCost: cost,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Get API call trends over time
 */
export async function getApiCallTrends(
  teamId: string,
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' | 'month' = 'day'
): Promise<Array<{ date: string; apiCalls: number; successRate: number }>> {
  const { data, error } = await supabase
    .from('integration_usage_analytics')
    .select('date, api_calls_count, success_count')
    .eq('team_id', teamId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error || !data) {
    console.error('Error fetching API call trends:', error);
    return [];
  }

  // Group data by date
  const trendMap = new Map<string, { calls: number; successes: number }>();

  data.forEach(record => {
    const date = record.date;
    const calls = record.api_calls_count || 0;
    const successes = record.success_count || 0;

    if (trendMap.has(date)) {
      const existing = trendMap.get(date)!;
      existing.calls += calls;
      existing.successes += successes;
    } else {
      trendMap.set(date, { calls, successes });
    }
  });

  return Array.from(trendMap.entries())
    .map(([date, { calls, successes }]) => ({
      date,
      apiCalls: calls,
      successRate: calls > 0 ? (successes / calls) * 100 : 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Detect anomalies in API usage
 */
export async function detectUsageAnomalies(
  teamId: string,
  integrationId: string
): Promise<Array<{ date: string; anomalyType: string; severity: 'low' | 'medium' | 'high'; description: string }>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  const metrics = await getIntegrationUsageMetrics(teamId, integrationId, startDate, endDate);

  if (metrics.length < 7) {
    return []; // Need at least 7 days of data
  }

  const anomalies: Array<{ date: string; anomalyType: string; severity: 'low' | 'medium' | 'high'; description: string }> = [];

  // Calculate baseline averages
  const avgCalls = metrics.reduce((sum, m) => sum + m.apiCallsCount, 0) / metrics.length;
  const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;
  const avgLatency = metrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / metrics.length;

  // Check each day for anomalies
  metrics.forEach(metric => {
    // Spike in API calls
    if (metric.apiCallsCount > avgCalls * 3) {
      anomalies.push({
        date: metric.date,
        anomalyType: 'call_spike',
        severity: 'medium',
        description: `Unusual spike in API calls: ${metric.apiCallsCount} (avg: ${Math.round(avgCalls)})`,
      });
    }

    // Drop in success rate
    if (metric.successRate < avgSuccessRate - 20) {
      anomalies.push({
        date: metric.date,
        anomalyType: 'low_success_rate',
        severity: metric.successRate < 50 ? 'high' : 'medium',
        description: `Low success rate: ${metric.successRate.toFixed(1)}% (avg: ${avgSuccessRate.toFixed(1)}%)`,
      });
    }

    // High latency
    if (metric.avgLatencyMs > avgLatency * 2 && metric.avgLatencyMs > 1000) {
      anomalies.push({
        date: metric.date,
        anomalyType: 'high_latency',
        severity: metric.avgLatencyMs > 5000 ? 'high' : 'medium',
        description: `High latency: ${metric.avgLatencyMs}ms (avg: ${Math.round(avgLatency)}ms)`,
      });
    }

    // High error count
    if (metric.errorCount > 50) {
      anomalies.push({
        date: metric.date,
        anomalyType: 'high_errors',
        severity: metric.errorCount > 100 ? 'high' : 'medium',
        description: `High error count: ${metric.errorCount} errors`,
      });
    }
  });

  return anomalies;
}
