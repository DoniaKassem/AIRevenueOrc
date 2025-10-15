import { supabase } from './supabase';

export interface Quota {
  id: string;
  user_id: string;
  organization_id: string;
  quota_type: string;
  limit_value: number;
  used_value: number;
  period: 'daily' | 'weekly' | 'monthly';
  reset_at: string;
}

export interface QuotaUsage {
  quota_type: string;
  limit: number;
  used: number;
  remaining: number;
  percentage_used: number;
  resets_at: string;
}

export const QUOTA_TYPES = {
  API_CALLS: 'api_calls',
  EMAIL_SENDS: 'email_sends',
  AI_REQUESTS: 'ai_requests',
  STORAGE_MB: 'storage_mb',
  PROSPECTS_CREATED: 'prospects_created',
  DEALS_CREATED: 'deals_created',
  EXPORTS: 'exports',
  BULK_IMPORTS: 'bulk_imports',
};

export const DEFAULT_QUOTAS: Record<string, { daily?: number; monthly?: number }> = {
  [QUOTA_TYPES.API_CALLS]: { daily: 10000 },
  [QUOTA_TYPES.EMAIL_SENDS]: { daily: 500 },
  [QUOTA_TYPES.AI_REQUESTS]: { daily: 1000 },
  [QUOTA_TYPES.STORAGE_MB]: { monthly: 10240 },
  [QUOTA_TYPES.PROSPECTS_CREATED]: { daily: 100 },
  [QUOTA_TYPES.DEALS_CREATED]: { daily: 50 },
  [QUOTA_TYPES.EXPORTS]: { daily: 20 },
  [QUOTA_TYPES.BULK_IMPORTS]: { daily: 5 },
};

export async function initializeUserQuotas(
  userId: string,
  organizationId: string
): Promise<void> {
  const quotas = [];

  for (const [quotaType, limits] of Object.entries(DEFAULT_QUOTAS)) {
    if (limits.daily) {
      quotas.push({
        user_id: userId,
        organization_id: organizationId,
        quota_type: quotaType,
        limit_value: limits.daily,
        period: 'daily',
        reset_at: getNextResetDate('daily'),
      });
    }

    if (limits.monthly) {
      quotas.push({
        user_id: userId,
        organization_id: organizationId,
        quota_type: quotaType,
        limit_value: limits.monthly,
        period: 'monthly',
        reset_at: getNextResetDate('monthly'),
      });
    }
  }

  const { error } = await supabase.from('user_quotas').insert(quotas);

  if (error) {
    console.error('Failed to initialize user quotas:', error);
  }
}

function getNextResetDate(period: 'daily' | 'weekly' | 'monthly'): string {
  const now = new Date();

  switch (period) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + (7 - now.getDay()));
      now.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      break;
  }

  return now.toISOString();
}

export async function checkQuota(
  userId: string,
  quotaType: string,
  amount: number = 1
): Promise<{ allowed: boolean; remaining: number; resets_at: string }> {
  const { data: quota, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('quota_type', quotaType)
    .maybeSingle();

  if (error || !quota) {
    return { allowed: true, remaining: 999999, resets_at: new Date().toISOString() };
  }

  if (new Date(quota.reset_at) <= new Date()) {
    await resetQuota(quota.id, quota.period);
    return { allowed: true, remaining: quota.limit_value - amount, resets_at: quota.reset_at };
  }

  const remaining = quota.limit_value - quota.used_value;
  const allowed = remaining >= amount;

  return {
    allowed,
    remaining: Math.max(0, remaining - amount),
    resets_at: quota.reset_at,
  };
}

export async function incrementQuota(
  userId: string,
  quotaType: string,
  amount: number = 1
): Promise<void> {
  const { data: quota } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('quota_type', quotaType)
    .maybeSingle();

  if (!quota) {
    return;
  }

  if (new Date(quota.reset_at) <= new Date()) {
    await resetQuota(quota.id, quota.period);
  }

  await supabase
    .from('user_quotas')
    .update({ used_value: quota.used_value + amount })
    .eq('id', quota.id);
}

async function resetQuota(quotaId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
  await supabase
    .from('user_quotas')
    .update({
      used_value: 0,
      reset_at: getNextResetDate(period),
    })
    .eq('id', quotaId);
}

export async function executeWithQuota<T>(
  userId: string,
  quotaType: string,
  operation: () => Promise<T>,
  amount: number = 1
): Promise<T> {
  const quotaCheck = await checkQuota(userId, quotaType, amount);

  if (!quotaCheck.allowed) {
    throw new Error(
      `Quota exceeded for ${quotaType}. Resets at ${new Date(quotaCheck.resets_at).toLocaleString()}`
    );
  }

  await incrementQuota(userId, quotaType, amount);

  return await operation();
}

export async function getUserQuotaUsage(userId: string): Promise<QuotaUsage[]> {
  const { data: quotas, error } = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId);

  if (error || !quotas) {
    return [];
  }

  return quotas.map(quota => {
    const remaining = Math.max(0, quota.limit_value - quota.used_value);
    const percentageUsed = (quota.used_value / quota.limit_value) * 100;

    return {
      quota_type: quota.quota_type,
      limit: quota.limit_value,
      used: quota.used_value,
      remaining,
      percentage_used: Math.min(100, Math.round(percentageUsed)),
      resets_at: quota.reset_at,
    };
  });
}

export async function updateQuotaLimit(
  userId: string,
  quotaType: string,
  newLimit: number
): Promise<void> {
  const { error } = await supabase
    .from('user_quotas')
    .update({ limit_value: newLimit })
    .eq('user_id', userId)
    .eq('quota_type', quotaType);

  if (error) {
    throw new Error(`Failed to update quota limit: ${error.message}`);
  }
}

export async function getOrganizationQuotaUsage(
  organizationId: string
): Promise<{
  total_by_type: Record<string, number>;
  top_users: Array<{ user_id: string; total_usage: number }>;
}> {
  const { data: quotas, error } = await supabase
    .from('user_quotas')
    .select('user_id, quota_type, used_value')
    .eq('organization_id', organizationId);

  if (error || !quotas) {
    return { total_by_type: {}, top_users: [] };
  }

  const totalByType: Record<string, number> = {};
  const userTotals: Record<string, number> = {};

  quotas.forEach(quota => {
    totalByType[quota.quota_type] = (totalByType[quota.quota_type] || 0) + quota.used_value;
    userTotals[quota.user_id] = (userTotals[quota.user_id] || 0) + quota.used_value;
  });

  const topUsers = Object.entries(userTotals)
    .map(([user_id, total_usage]) => ({ user_id, total_usage }))
    .sort((a, b) => b.total_usage - a.total_usage)
    .slice(0, 10);

  return { total_by_type: totalByType, top_users: topUsers };
}

export function formatQuotaType(quotaType: string): string {
  return quotaType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getQuotaWarningLevel(percentageUsed: number): 'safe' | 'warning' | 'critical' {
  if (percentageUsed >= 90) return 'critical';
  if (percentageUsed >= 75) return 'warning';
  return 'safe';
}

export async function getQuotaAlerts(userId: string): Promise<
  Array<{
    quota_type: string;
    message: string;
    level: 'warning' | 'critical';
  }>
> {
  const usage = await getUserQuotaUsage(userId);
  const alerts: Array<{ quota_type: string; message: string; level: 'warning' | 'critical' }> = [];

  usage.forEach(quota => {
    if (quota.percentage_used >= 90) {
      alerts.push({
        quota_type: quota.quota_type,
        message: `${formatQuotaType(quota.quota_type)} usage is at ${quota.percentage_used}%. Only ${quota.remaining} remaining.`,
        level: 'critical',
      });
    } else if (quota.percentage_used >= 75) {
      alerts.push({
        quota_type: quota.quota_type,
        message: `${formatQuotaType(quota.quota_type)} usage is at ${quota.percentage_used}%.`,
        level: 'warning',
      });
    }
  });

  return alerts;
}

export async function resetAllUserQuotas(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_quotas')
    .update({ used_value: 0 })
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Failed to reset quotas:', error);
  }
}
