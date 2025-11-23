/**
 * Billing & Subscription Component
 *
 * SaaS billing management with:
 * - Current plan display
 * - Usage metrics
 * - Upgrade/downgrade plans
 * - Billing history
 * - Payment method management
 * - Usage limits
 */

import { useState, useEffect } from 'react';
import apiClient from '../../lib/api-client';
import {
  CreditCard,
  TrendingUp,
  Check,
  Zap,
  Users,
  Database,
  Mail,
  Search,
  Download,
  Calendar,
  DollarSign,
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface Subscription {
  id: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface UsageMetrics {
  aiTokens: { used: number; limit: number };
  searchQueries: { used: number; limit: number };
  emailsSent: { used: number; limit: number };
  teamMembers: { used: number; limit: number };
  storage: { used: number; limit: number }; // in GB
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl: string;
}

// =============================================
// COMPONENT
// =============================================

export default function BillingSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      billingPeriod: 'forever',
      features: [
        '100 AI tokens/month',
        '1,000 search queries/month',
        '500 emails/month',
        '3 team members',
        '1 GB storage',
        'Basic support',
      ],
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 49,
      billingPeriod: 'month',
      features: [
        '10,000 AI tokens/month',
        '10,000 search queries/month',
        '5,000 emails/month',
        '10 team members',
        '10 GB storage',
        'Email support',
        'API access',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 199,
      billingPeriod: 'month',
      popular: true,
      features: [
        '100,000 AI tokens/month',
        'Unlimited search queries',
        '50,000 emails/month',
        '50 team members',
        '100 GB storage',
        'Priority support',
        'API access',
        'Advanced analytics',
        'Custom integrations',
      ],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: null,
      billingPeriod: 'custom',
      features: [
        'Unlimited AI tokens',
        'Unlimited search queries',
        'Unlimited emails',
        'Unlimited team members',
        'Unlimited storage',
        '24/7 dedicated support',
        'API access',
        'Advanced analytics',
        'Custom integrations',
        'SLA guarantee',
        'Custom contracts',
      ],
    },
  ];

  useEffect(() => {
    loadBillingData();
  }, []);

  async function loadBillingData() {
    setLoading(true);
    try {
      const [subData, usageData, invoicesData] = await Promise.all([
        apiClient.get<Subscription>('/billing/subscription'),
        apiClient.get<UsageMetrics>('/billing/usage'),
        apiClient.get<Invoice[]>('/billing/invoices'),
      ]);

      setSubscription(subData);
      setUsage(usageData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePlan(planId: string) {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@airevenueorc.com?subject=Enterprise Plan Inquiry';
      return;
    }

    try {
      await apiClient.post('/billing/change-plan', { plan: planId });
      await loadBillingData();
      alert('Plan changed successfully!');
    } catch (error) {
      console.error('Failed to change plan:', error);
      alert('Failed to change plan');
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your billing period.')) {
      return;
    }

    try {
      await apiClient.post('/billing/cancel');
      await loadBillingData();
      alert('Subscription canceled. You will have access until the end of your billing period.');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription');
    }
  }

  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading billing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Billing & Subscription</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-90">Current Plan</p>
            <h3 className="text-3xl font-bold mt-1 capitalize">{subscription?.plan || 'Free'}</h3>
            {subscription && subscription.plan !== 'free' && (
              <p className="text-sm opacity-90 mt-2">
                {subscription.cancelAtPeriodEnd ? (
                  <>Cancels on {formatDate(subscription.currentPeriodEnd)}</>
                ) : (
                  <>Renews on {formatDate(subscription.currentPeriodEnd)}</>
                )}
              </p>
            )}
          </div>
          <TrendingUp className="w-12 h-12 opacity-90" />
        </div>
      </div>

      {/* Usage Metrics */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Tokens</span>
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {usage.aiTokens.used.toLocaleString()} / {usage.aiTokens.limit.toLocaleString()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUsageColor(getUsagePercentage(usage.aiTokens.used, usage.aiTokens.limit))}`}>
                  {getUsagePercentage(usage.aiTokens.used, usage.aiTokens.limit).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.aiTokens.used, usage.aiTokens.limit)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Search Queries</span>
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {usage.searchQueries.used.toLocaleString()} / {usage.searchQueries.limit === 0 ? '∞' : usage.searchQueries.limit.toLocaleString()}
                </span>
                {usage.searchQueries.limit > 0 && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUsageColor(getUsagePercentage(usage.searchQueries.used, usage.searchQueries.limit))}`}>
                    {getUsagePercentage(usage.searchQueries.used, usage.searchQueries.limit).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: usage.searchQueries.limit === 0 ? '100%' : `${getUsagePercentage(usage.searchQueries.used, usage.searchQueries.limit)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Emails Sent</span>
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {usage.emailsSent.used.toLocaleString()} / {usage.emailsSent.limit.toLocaleString()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUsageColor(getUsagePercentage(usage.emailsSent.used, usage.emailsSent.limit))}`}>
                  {getUsagePercentage(usage.emailsSent.used, usage.emailsSent.limit).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.emailsSent.used, usage.emailsSent.limit)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Team Members</span>
              <Users className="w-5 h-5 text-cyan-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {usage.teamMembers.used} / {usage.teamMembers.limit}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUsageColor(getUsagePercentage(usage.teamMembers.used, usage.teamMembers.limit))}`}>
                  {getUsagePercentage(usage.teamMembers.used, usage.teamMembers.limit).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-cyan-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.teamMembers.used, usage.teamMembers.limit)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Storage</span>
              <Database className="w-5 h-5 text-orange-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  {usage.storage.used.toFixed(1)} GB / {usage.storage.limit} GB
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUsageColor(getUsagePercentage(usage.storage.used, usage.storage.limit))}`}>
                  {getUsagePercentage(usage.storage.used, usage.storage.limit).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all"
                  style={{ width: `${getUsagePercentage(usage.storage.used, usage.storage.limit)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-slate-800 rounded-lg border-2 p-6 relative ${
                plan.popular
                  ? 'border-blue-600'
                  : subscription?.plan === plan.id
                  ? 'border-green-600'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                    Most Popular
                  </span>
                </div>
              )}
              {subscription?.plan === plan.id && (
                <div className="absolute -top-3 right-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Current</span>
                  </span>
                </div>
              )}

              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h4>
              <div className="mb-4">
                {plan.price !== null ? (
                  <>
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">${plan.price}</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">/{plan.billingPeriod}</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">Contact Sales</span>
                )}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChangePlan(plan.id)}
                disabled={subscription?.plan === plan.id}
                className={`w-full py-2 rounded-lg font-medium transition ${
                  subscription?.plan === plan.id
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : plan.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900'
                }`}
              >
                {subscription?.plan === plan.id ? 'Current Plan' : plan.price === null ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History */}
      {invoices.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Billing History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                      ${invoice.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status === 'pending'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-end space-x-1"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel Subscription */}
      {subscription && subscription.plan !== 'free' && !subscription.cancelAtPeriodEnd && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Cancel Subscription</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
          </p>
          <button
            onClick={handleCancelSubscription}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            Cancel Subscription
          </button>
        </div>
      )}
    </div>
  );
}
