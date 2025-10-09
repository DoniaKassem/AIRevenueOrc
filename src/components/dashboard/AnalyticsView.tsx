import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart3,
  TrendingUp,
  Users,
  Mail,
  Phone,
  Target,
  DollarSign,
  Calendar,
} from 'lucide-react';

interface Analytics {
  prospects: {
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  };
  cadences: {
    active: number;
    enrollments: number;
    completionRate: number;
  };
  emails: {
    sent: number;
    openRate: number;
    clickRate: number;
    responseRate: number;
  };
  calls: {
    total: number;
    avgDuration: number;
    connected: number;
  };
  deals: {
    total: number;
    totalValue: number;
    byStage: Record<string, { count: number; value: number }>;
    avgDealSize: number;
    conversionRate: number;
  };
}

export default function AnalyticsView() {
  const [analytics, setAnalytics] = useState<Analytics>({
    prospects: { total: 0, byStatus: {}, bySource: {} },
    cadences: { active: 0, enrollments: 0, completionRate: 0 },
    emails: { sent: 0, openRate: 0, clickRate: 0, responseRate: 0 },
    calls: { total: 0, avgDuration: 0, connected: 0 },
    deals: {
      total: 0,
      totalValue: 0,
      byStage: {},
      avgDealSize: 0,
      conversionRate: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  async function loadAnalytics() {
    try {
      const [
        prospectsRes,
        cadencesRes,
        enrollmentsRes,
        emailsRes,
        callsRes,
        dealsRes,
      ] = await Promise.all([
        supabase.from('prospects').select('status'),
        supabase.from('cadences').select('is_active').eq('is_active', true),
        supabase.from('cadence_enrollments').select('status'),
        supabase.from('email_sends').select('status, opened_at, clicked_at'),
        supabase.from('call_logs').select('duration_seconds, disposition'),
        supabase.from('deals').select('stage, amount'),
      ]);

      const prospects = prospectsRes.data || [];
      const emails = emailsRes.data || [];
      const calls = callsRes.data || [];
      const deals = dealsRes.data || [];
      const enrollments = enrollmentsRes.data || [];

      const prospectsByStatus: Record<string, number> = {};
      prospects.forEach((p) => {
        prospectsByStatus[p.status] = (prospectsByStatus[p.status] || 0) + 1;
      });

      const dealsByStage: Record<string, { count: number; value: number }> = {};
      deals.forEach((d) => {
        if (!dealsByStage[d.stage]) {
          dealsByStage[d.stage] = { count: 0, value: 0 };
        }
        dealsByStage[d.stage].count++;
        dealsByStage[d.stage].value += d.amount;
      });

      const emailsOpened = emails.filter((e) => e.opened_at).length;
      const emailsClicked = emails.filter((e) => e.clicked_at).length;

      const callsConnected = calls.filter((c) => c.disposition === 'connected')
        .length;
      const avgCallDuration =
        calls.length > 0
          ? calls.reduce((sum, c) => sum + c.duration_seconds, 0) / calls.length
          : 0;

      const totalDealValue = deals.reduce((sum, d) => sum + d.amount, 0);
      const completedEnrollments = enrollments.filter(
        (e) => e.status === 'completed'
      ).length;

      setAnalytics({
        prospects: {
          total: prospects.length,
          byStatus: prospectsByStatus,
          bySource: {},
        },
        cadences: {
          active: cadencesRes.data?.length || 0,
          enrollments: enrollments.length,
          completionRate:
            enrollments.length > 0
              ? (completedEnrollments / enrollments.length) * 100
              : 0,
        },
        emails: {
          sent: emails.length,
          openRate: emails.length > 0 ? (emailsOpened / emails.length) * 100 : 0,
          clickRate: emails.length > 0 ? (emailsClicked / emails.length) * 100 : 0,
          responseRate: 0,
        },
        calls: {
          total: calls.length,
          avgDuration: avgCallDuration,
          connected: callsConnected,
        },
        deals: {
          total: deals.length,
          totalValue: totalDealValue,
          byStage: dealsByStage,
          avgDealSize: deals.length > 0 ? totalDealValue / deals.length : 0,
          conversionRate: 0,
        },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">
            Comprehensive insights into your revenue operations
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Total Prospects',
            value: analytics.prospects.total,
            icon: Users,
            color: 'blue',
          },
          {
            label: 'Active Cadences',
            value: analytics.cadences.active,
            icon: Target,
            color: 'green',
          },
          {
            label: 'Emails Sent',
            value: analytics.emails.sent,
            icon: Mail,
            color: 'purple',
          },
          {
            label: 'Calls Made',
            value: analytics.calls.total,
            icon: Phone,
            color: 'orange',
          },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className={`bg-${stat.color}-100 p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Email Performance
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Open Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {analytics.emails.openRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${analytics.emails.openRate}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Click Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {analytics.emails.clickRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${analytics.emails.clickRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Call Metrics
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Calls</span>
              <span className="text-2xl font-bold text-slate-900">
                {analytics.calls.total}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Connected</span>
              <span className="text-2xl font-bold text-green-600">
                {analytics.calls.connected}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg Duration</span>
              <span className="text-2xl font-bold text-slate-900">
                {Math.round(analytics.calls.avgDuration / 60)}m
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">
          Pipeline by Stage
        </h2>
        <div className="space-y-4">
          {Object.entries(analytics.deals.byStage).map(([stage, data]) => (
            <div key={stage}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-700 capitalize">
                  {stage.replace('_', ' ')}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-600">{data.count} deals</span>
                  <span className="text-sm font-semibold text-slate-900">
                    ${(data.value / 1000).toFixed(0)}K
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 h-3 rounded-full"
                  style={{
                    width: `${
                      analytics.deals.totalValue > 0
                        ? (data.value / analytics.deals.totalValue) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Prospects by Status
          </h2>
          <div className="space-y-3">
            {Object.entries(analytics.prospects.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 capitalize">{status}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Cadence Performance
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Active Enrollments</span>
              <span className="text-2xl font-bold text-slate-900">
                {analytics.cadences.enrollments}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Completion Rate</span>
              <span className="text-2xl font-bold text-green-600">
                {analytics.cadences.completionRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Deal Metrics
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Value</span>
              <span className="text-2xl font-bold text-slate-900">
                ${(analytics.deals.totalValue / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg Deal Size</span>
              <span className="text-2xl font-bold text-blue-600">
                ${(analytics.deals.avgDealSize / 1000).toFixed(0)}K
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
