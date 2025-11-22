/**
 * Billing & Subscription Service
 *
 * Handles billing operations:
 * - Get subscription info
 * - Get usage metrics
 * - Change subscription plan
 * - Get billing history
 * - Cancel subscription
 */

import { supabase } from '../supabase';

// =============================================
// TYPES
// =============================================

export interface Subscription {
  id: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  organizationId: string;
}

export interface UsageMetrics {
  aiTokens: { used: number; limit: number };
  searchQueries: { used: number; limit: number };
  emailsSent: { used: number; limit: number };
  teamMembers: { used: number; limit: number };
  storage: { used: number; limit: number };
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl: string;
}

// Plan limits
const PLAN_LIMITS = {
  free: {
    aiTokens: 100,
    searchQueries: 1000,
    emailsSent: 500,
    teamMembers: 3,
    storage: 1, // GB
  },
  starter: {
    aiTokens: 10000,
    searchQueries: 10000,
    emailsSent: 5000,
    teamMembers: 10,
    storage: 10,
  },
  pro: {
    aiTokens: 100000,
    searchQueries: 0, // unlimited
    emailsSent: 50000,
    teamMembers: 50,
    storage: 100,
  },
  enterprise: {
    aiTokens: 0, // unlimited
    searchQueries: 0,
    emailsSent: 0,
    emailsSent: 0,
    teamMembers: 0,
    storage: 0,
  },
};

// =============================================
// SERVICE
// =============================================

export class BillingService {
  /**
   * Get subscription for an organization
   */
  async getSubscription(organizationId: string): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      // If no subscription exists, return free plan
      return {
        id: '',
        plan: 'free',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        organizationId,
      };
    }

    return {
      id: data.id,
      plan: data.plan,
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end || false,
      organizationId: data.organization_id,
    };
  }

  /**
   * Get usage metrics for an organization
   */
  async getUsageMetrics(organizationId: string): Promise<UsageMetrics> {
    const subscription = await this.getSubscription(organizationId);
    const limits = PLAN_LIMITS[subscription.plan];

    // Get current period start/end
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);

    // Get AI token usage
    const { data: aiUsage } = await supabase
      .from('ai_usage_tracking')
      .select('tokens_used')
      .eq('organization_id', organizationId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const aiTokensUsed = (aiUsage || []).reduce((sum, record) => sum + (record.tokens_used || 0), 0);

    // Get search query count
    const { count: searchCount } = await supabase
      .from('search_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    // Get email count
    const { count: emailCount } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    // Get team member count
    const { count: memberCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    // Get storage usage (placeholder - would need to calculate from actual file storage)
    const storageUsed = 0.5; // GB

    return {
      aiTokens: { used: aiTokensUsed, limit: limits.aiTokens },
      searchQueries: { used: searchCount || 0, limit: limits.searchQueries },
      emailsSent: { used: emailCount || 0, limit: limits.emailsSent },
      teamMembers: { used: memberCount || 1, limit: limits.teamMembers },
      storage: { used: storageUsed, limit: limits.storage },
    };
  }

  /**
   * Change subscription plan
   */
  async changePlan(organizationId: string, newPlan: 'free' | 'starter' | 'pro' | 'enterprise'): Promise<void> {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .single();

    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month subscription

    if (existing) {
      // Update existing subscription
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan: newPlan,
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        })
        .eq('organization_id', organizationId);

      if (error) throw error;
    } else {
      // Create new subscription
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          organization_id: organizationId,
          plan: newPlan,
          status: 'active',
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        });

      if (error) throw error;
    }

    // TODO: Integrate with Stripe to create/update subscription
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(organizationId: string): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('organization_id', organizationId);

    if (error) throw error;

    // TODO: Integrate with Stripe to cancel subscription
  }

  /**
   * Get billing history (invoices)
   */
  async getInvoices(organizationId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) return [];

    return (data || []).map((invoice) => ({
      id: invoice.id,
      date: invoice.created_at,
      amount: invoice.amount,
      status: invoice.status,
      invoiceUrl: invoice.invoice_url || '#',
    }));
  }

  /**
   * Check if organization has reached usage limit
   */
  async checkUsageLimit(
    organizationId: string,
    type: 'aiTokens' | 'searchQueries' | 'emailsSent' | 'teamMembers'
  ): Promise<{ allowed: boolean; remaining: number }> {
    const usage = await this.getUsageMetrics(organizationId);
    const metric = usage[type];

    if (metric.limit === 0) {
      // Unlimited
      return { allowed: true, remaining: -1 };
    }

    const remaining = metric.limit - metric.used;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
    };
  }
}

export const billingService = new BillingService();
