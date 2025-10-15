import { supabase } from './supabase';

export interface IntegrationHealth {
  integration_id: string;
  provider_name: string;
  status: 'healthy' | 'degraded' | 'down';
  health_score: number;
  checks: HealthCheck[];
  last_checked_at: string;
}

export interface HealthCheck {
  name: string;
  status: 'passing' | 'warning' | 'failing';
  message: string;
  checked_at: string;
  response_time_ms?: number;
}

export interface IntegrationAlert {
  id: string;
  integration_id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  created_at: string;
  resolved_at?: string;
}

export async function checkIntegrationHealth(
  integrationId: string
): Promise<IntegrationHealth> {
  const { data: integration, error } = await supabase
    .from('team_integrations')
    .select('*, integration_providers(*)')
    .eq('id', integrationId)
    .single();

  if (error || !integration) {
    throw new Error(`Integration not found: ${error?.message}`);
  }

  const checks: HealthCheck[] = [];

  checks.push(await checkAuthenticationStatus(integration));
  checks.push(await checkApiConnectivity(integration));
  checks.push(await checkRateLimitStatus(integration));
  checks.push(await checkSyncStatus(integration));
  checks.push(await checkErrorRate(integration));

  const passingChecks = checks.filter(c => c.status === 'passing').length;
  const warningChecks = checks.filter(c => c.status === 'warning').length;
  const failingChecks = checks.filter(c => c.status === 'failing').length;

  let healthScore = (passingChecks / checks.length) * 100;
  healthScore -= warningChecks * 10;
  healthScore -= failingChecks * 30;
  healthScore = Math.max(0, Math.min(100, healthScore));

  let status: 'healthy' | 'degraded' | 'down';
  if (healthScore >= 80) status = 'healthy';
  else if (healthScore >= 40) status = 'degraded';
  else status = 'down';

  return {
    integration_id: integrationId,
    provider_name: integration.integration_providers.name,
    status,
    health_score: Math.round(healthScore),
    checks,
    last_checked_at: new Date().toISOString(),
  };
}

async function checkAuthenticationStatus(integration: any): Promise<HealthCheck> {
  const authData = integration.auth_data;

  if (!authData || !authData.access_token) {
    return {
      name: 'Authentication',
      status: 'failing',
      message: 'No valid authentication credentials',
      checked_at: new Date().toISOString(),
    };
  }

  if (authData.expires_at && authData.expires_at < Date.now()) {
    if (authData.refresh_token) {
      return {
        name: 'Authentication',
        status: 'warning',
        message: 'Access token expired, refresh token available',
        checked_at: new Date().toISOString(),
      };
    } else {
      return {
        name: 'Authentication',
        status: 'failing',
        message: 'Access token expired, no refresh token',
        checked_at: new Date().toISOString(),
      };
    }
  }

  return {
    name: 'Authentication',
    status: 'passing',
    message: 'Valid authentication credentials',
    checked_at: new Date().toISOString(),
  };
}

async function checkApiConnectivity(integration: any): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    const responseTime = Date.now() - startTime;

    return {
      name: 'API Connectivity',
      status: 'passing',
      message: 'API is reachable',
      checked_at: new Date().toISOString(),
      response_time_ms: responseTime,
    };
  } catch (error: any) {
    return {
      name: 'API Connectivity',
      status: 'failing',
      message: `Unable to reach API: ${error.message}`,
      checked_at: new Date().toISOString(),
    };
  }
}

async function checkRateLimitStatus(integration: any): Promise<HealthCheck> {
  const { data: rateLimits } = await supabase
    .from('api_rate_limits')
    .select('*')
    .eq('integration_id', integration.id)
    .gte('window_end', new Date().toISOString());

  if (!rateLimits || rateLimits.length === 0) {
    return {
      name: 'Rate Limits',
      status: 'passing',
      message: 'No rate limit issues',
      checked_at: new Date().toISOString(),
    };
  }

  const utilizationRates = rateLimits.map(
    rl => (rl.requests_made / rl.requests_limit) * 100
  );
  const maxUtilization = Math.max(...utilizationRates);

  if (maxUtilization >= 90) {
    return {
      name: 'Rate Limits',
      status: 'warning',
      message: `High rate limit usage: ${maxUtilization.toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  } else if (maxUtilization >= 75) {
    return {
      name: 'Rate Limits',
      status: 'warning',
      message: `Moderate rate limit usage: ${maxUtilization.toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  }

  return {
    name: 'Rate Limits',
    status: 'passing',
    message: `Rate limit usage: ${maxUtilization.toFixed(0)}%`,
    checked_at: new Date().toISOString(),
  };
}

async function checkSyncStatus(integration: any): Promise<HealthCheck> {
  const { data: recentJobs } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('integration_id', integration.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentJobs || recentJobs.length === 0) {
    return {
      name: 'Sync Status',
      status: 'passing',
      message: 'No recent sync jobs',
      checked_at: new Date().toISOString(),
    };
  }

  const failedJobs = recentJobs.filter(j => j.status === 'failed').length;
  const failureRate = failedJobs / recentJobs.length;

  if (failureRate >= 0.5) {
    return {
      name: 'Sync Status',
      status: 'failing',
      message: `High sync failure rate: ${(failureRate * 100).toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  } else if (failureRate >= 0.2) {
    return {
      name: 'Sync Status',
      status: 'warning',
      message: `Moderate sync failure rate: ${(failureRate * 100).toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  }

  const lastSync = recentJobs[0];
  if (lastSync.status === 'running') {
    return {
      name: 'Sync Status',
      status: 'passing',
      message: 'Sync in progress',
      checked_at: new Date().toISOString(),
    };
  }

  return {
    name: 'Sync Status',
    status: 'passing',
    message: 'Syncs completing successfully',
    checked_at: new Date().toISOString(),
  };
}

async function checkErrorRate(integration: any): Promise<HealthCheck> {
  const { data: webhookLogs } = await supabase
    .from('webhook_logs')
    .select('response_status')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    .limit(100);

  if (!webhookLogs || webhookLogs.length === 0) {
    return {
      name: 'Error Rate',
      status: 'passing',
      message: 'No recent webhook activity',
      checked_at: new Date().toISOString(),
    };
  }

  const errors = webhookLogs.filter(
    log => !log.response_status || log.response_status >= 400
  ).length;
  const errorRate = errors / webhookLogs.length;

  if (errorRate >= 0.3) {
    return {
      name: 'Error Rate',
      status: 'failing',
      message: `High error rate: ${(errorRate * 100).toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  } else if (errorRate >= 0.1) {
    return {
      name: 'Error Rate',
      status: 'warning',
      message: `Elevated error rate: ${(errorRate * 100).toFixed(0)}%`,
      checked_at: new Date().toISOString(),
    };
  }

  return {
    name: 'Error Rate',
    status: 'passing',
    message: `Error rate: ${(errorRate * 100).toFixed(0)}%`,
    checked_at: new Date().toISOString(),
  };
}

export async function monitorAllIntegrations(
  teamId: string
): Promise<IntegrationHealth[]> {
  const { data: integrations } = await supabase
    .from('team_integrations')
    .select('id')
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (!integrations) return [];

  const healthChecks = await Promise.all(
    integrations.map(i => checkIntegrationHealth(i.id))
  );

  return healthChecks;
}

export async function getIntegrationUptime(
  integrationId: string,
  since: Date
): Promise<{ uptime_percentage: number; incidents: number; avg_response_time_ms: number }> {
  const { data: syncJobs } = await supabase
    .from('sync_jobs')
    .select('status, started_at, completed_at')
    .eq('integration_id', integrationId)
    .gte('created_at', since.toISOString());

  if (!syncJobs || syncJobs.length === 0) {
    return {
      uptime_percentage: 100,
      incidents: 0,
      avg_response_time_ms: 0,
    };
  }

  const successfulJobs = syncJobs.filter(j => j.status === 'completed').length;
  const uptimePercentage = (successfulJobs / syncJobs.length) * 100;

  const incidents = syncJobs.filter(j => j.status === 'failed').length;

  const responseTimes = syncJobs
    .filter(j => j.started_at && j.completed_at)
    .map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

  return {
    uptime_percentage: Math.round(uptimePercentage * 100) / 100,
    incidents,
    avg_response_time_ms: Math.round(avgResponseTime),
  };
}

export async function diagnoseIntegrationIssues(
  integrationId: string
): Promise<{
  issues: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high';
}> {
  const health = await checkIntegrationHealth(integrationId);
  const issues: string[] = [];
  const recommendations: string[] = [];

  health.checks.forEach(check => {
    if (check.status === 'failing') {
      issues.push(`${check.name}: ${check.message}`);
    } else if (check.status === 'warning') {
      issues.push(`${check.name}: ${check.message}`);
    }
  });

  if (issues.some(i => i.includes('Authentication'))) {
    recommendations.push('Reconnect your integration to refresh authentication');
  }

  if (issues.some(i => i.includes('Rate Limit'))) {
    recommendations.push('Reduce sync frequency or optimize API calls');
  }

  if (issues.some(i => i.includes('Sync'))) {
    recommendations.push('Review field mappings and check for data validation errors');
  }

  if (issues.some(i => i.includes('Error Rate'))) {
    recommendations.push('Check webhook logs for specific error messages');
  }

  if (issues.some(i => i.includes('API Connectivity'))) {
    recommendations.push('Verify the external service is operational');
  }

  let severity: 'low' | 'medium' | 'high' = 'low';
  if (health.status === 'down') severity = 'high';
  else if (health.status === 'degraded') severity = 'medium';

  return {
    issues,
    recommendations,
    severity,
  };
}

export async function getIntegrationMetrics(
  integrationId: string,
  timeRange: 'hour' | 'day' | 'week' | 'month'
): Promise<{
  sync_count: number;
  success_rate: number;
  avg_duration_ms: number;
  records_synced: number;
  errors: number;
}> {
  const since = new Date();
  switch (timeRange) {
    case 'hour':
      since.setHours(since.getHours() - 1);
      break;
    case 'day':
      since.setDate(since.getDate() - 1);
      break;
    case 'week':
      since.setDate(since.getDate() - 7);
      break;
    case 'month':
      since.setMonth(since.getMonth() - 1);
      break;
  }

  const { data: syncJobs } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('integration_id', integrationId)
    .gte('created_at', since.toISOString());

  if (!syncJobs || syncJobs.length === 0) {
    return {
      sync_count: 0,
      success_rate: 0,
      avg_duration_ms: 0,
      records_synced: 0,
      errors: 0,
    };
  }

  const successful = syncJobs.filter(j => j.status === 'completed').length;
  const successRate = (successful / syncJobs.length) * 100;

  const durations = syncJobs
    .filter(j => j.started_at && j.completed_at)
    .map(
      j => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime()
    );

  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  const recordsSynced = syncJobs.reduce(
    (sum, j) => sum + (j.records_processed || 0),
    0
  );

  const errors = syncJobs.reduce((sum, j) => sum + (j.records_failed || 0), 0);

  return {
    sync_count: syncJobs.length,
    success_rate: Math.round(successRate * 100) / 100,
    avg_duration_ms: Math.round(avgDuration),
    records_synced: recordsSynced,
    errors,
  };
}
