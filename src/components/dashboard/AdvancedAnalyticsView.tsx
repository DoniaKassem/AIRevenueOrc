import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  DollarSign,
  Target,
  Users,
  Mail,
  Phone,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Calendar,
  Award,
  Zap
} from 'lucide-react';

interface AnalyticsData {
  totalDeals: number;
  totalValue: number;
  avgDealSize: number;
  winRate: number;
  pipelineVelocity: number;
  conversionRates: Record<string, number>;
  stageMetrics: Array<{
    stage: string;
    count: number;
    value: number;
    avgDaysInStage: number;
  }>;
  prospectMetrics: {
    total: number;
    byStatus: Record<string, number>;
    avgPriorityScore: number;
  };
  cadenceMetrics: {
    active: number;
    totalEnrollments: number;
    avgSteps: number;
  };
  activityMetrics: {
    emails: number;
    calls: number;
    totalActivities: number;
  };
}

export default function AdvancedAnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const dateFilter = getDateFilter(timeRange);

      const [dealsData, prospectsData, cadencesData, activitiesData] = await Promise.all([
        supabase.from('deals').select('*').gte('created_at', dateFilter),
        supabase.from('prospects').select('*'),
        supabase.from('cadences').select('*, cadence_steps(*)'),
        supabase.from('activities').select('*').gte('created_at', dateFilter),
      ]);

      const deals = dealsData.data || [];
      const prospects = prospectsData.data || [];
      const cadences = cadencesData.data || [];
      const activities = activitiesData.data || [];

      const closedWon = deals.filter(d => d.stage === 'closed_won');
      const closedLost = deals.filter(d => d.stage === 'closed_lost');
      const totalClosed = closedWon.length + closedLost.length;

      const stageGroups = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
      const stageMetrics = stageGroups.map(stage => {
        const stageDeals = deals.filter(d => d.stage === stage);
        return {
          stage,
          count: stageDeals.length,
          value: stageDeals.reduce((sum, d) => sum + d.amount, 0),
          avgDaysInStage: calculateAvgDaysInStage(stageDeals),
        };
      });

      const conversionRates: Record<string, number> = {};
      for (let i = 0; i < stageGroups.length - 1; i++) {
        const current = stageMetrics[i].count;
        const next = stageMetrics[i + 1].count;
        if (current > 0) {
          conversionRates[`${stageGroups[i]}_to_${stageGroups[i + 1]}`] = (next / current) * 100;
        }
      }

      const prospectsByStatus: Record<string, number> = {};
      prospects.forEach(p => {
        prospectsByStatus[p.status] = (prospectsByStatus[p.status] || 0) + 1;
      });

      const emailActivities = activities.filter(a => a.activity_type === 'email');
      const callActivities = activities.filter(a => a.activity_type === 'call');

      setAnalytics({
        totalDeals: deals.length,
        totalValue: deals.reduce((sum, d) => sum + d.amount, 0),
        avgDealSize: deals.length > 0 ? deals.reduce((sum, d) => sum + d.amount, 0) / deals.length : 0,
        winRate: totalClosed > 0 ? (closedWon.length / totalClosed) * 100 : 0,
        pipelineVelocity: calculateVelocity(deals),
        conversionRates,
        stageMetrics,
        prospectMetrics: {
          total: prospects.length,
          byStatus: prospectsByStatus,
          avgPriorityScore: prospects.length > 0
            ? prospects.reduce((sum, p) => sum + (p.priority_score || 0), 0) / prospects.length
            : 0,
        },
        cadenceMetrics: {
          active: cadences.filter(c => c.is_active).length,
          totalEnrollments: 0,
          avgSteps: cadences.length > 0
            ? cadences.reduce((sum, c) => sum + (c.cadence_steps?.length || 0), 0) / cadences.length
            : 0,
        },
        activityMetrics: {
          emails: emailActivities.length,
          calls: callActivities.length,
          totalActivities: activities.length,
        },
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDateFilter(range: string): string {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return '2020-01-01T00:00:00Z';
    }
  }

  function calculateAvgDaysInStage(deals: any[]): number {
    if (deals.length === 0) return 0;
    const now = new Date();
    const totalDays = deals.reduce((sum, d) => {
      const created = new Date(d.created_at);
      return sum + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / deals.length);
  }

  function calculateVelocity(deals: any[]): number {
    if (deals.length === 0) return 0;
    const closedDeals = deals.filter(d => d.stage === 'closed_won');
    if (closedDeals.length === 0) return 0;

    const avgDaysToClose = closedDeals.reduce((sum, d) => {
      const created = new Date(d.created_at);
      const closed = new Date(d.updated_at);
      return sum + Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0) / closedDeals.length;

    return Math.round(avgDaysToClose);
  }

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-600">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Advanced Analytics</h1>
          <p className="text-slate-600 mt-1">
            Deep insights into your sales performance and pipeline health
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-blue-700">
              <ArrowUp className="w-3 h-3" />
              <span>+12%</span>
            </div>
          </div>
          <p className="text-sm text-blue-900 font-medium mb-1">Total Pipeline Value</p>
          <p className="text-2xl font-bold text-blue-900">
            ${(analytics.totalValue / 1000).toFixed(0)}K
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-green-700">
              <ArrowUp className="w-3 h-3" />
              <span>+8%</span>
            </div>
          </div>
          <p className="text-sm text-green-900 font-medium mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-green-900">{analytics.winRate.toFixed(1)}%</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-purple-700">
              <ArrowDown className="w-3 h-3" />
              <span>-3 days</span>
            </div>
          </div>
          <p className="text-sm text-purple-900 font-medium mb-1">Avg. Deal Velocity</p>
          <p className="text-2xl font-bold text-purple-900">{analytics.pipelineVelocity} days</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-6 border border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-amber-600 p-2 rounded-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-amber-700">
              <ArrowUp className="w-3 h-3" />
              <span>+5%</span>
            </div>
          </div>
          <p className="text-sm text-amber-900 font-medium mb-1">Avg. Deal Size</p>
          <p className="text-2xl font-bold text-amber-900">
            ${(analytics.avgDealSize / 1000).toFixed(0)}K
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Pipeline by Stage</h3>
          <div className="space-y-3">
            {analytics.stageMetrics.filter(s => !s.stage.includes('closed')).map((stage) => {
              const maxValue = Math.max(...analytics.stageMetrics.map(s => s.value));
              const percentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;

              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">
                      {stageLabels[stage.stage]}
                    </span>
                    <span className="text-sm text-slate-600">
                      {stage.count} deals • ${(stage.value / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Avg. {stage.avgDaysInStage} days in stage
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-4">
            {analytics.stageMetrics.slice(0, -2).map((stage, index) => {
              const nextStage = analytics.stageMetrics[index + 1];
              const conversionRate = stage.count > 0
                ? ((nextStage.count / stage.count) * 100).toFixed(1)
                : '0';

              return (
                <div key={stage.stage} className="relative">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {stageLabels[stage.stage]} → {stageLabels[nextStage.stage]}
                      </p>
                      <p className="text-xs text-slate-600">
                        {stage.count} → {nextStage.count} deals
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        parseFloat(conversionRate) >= 50
                          ? 'text-green-600'
                          : parseFloat(conversionRate) >= 30
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}>
                        {conversionRate}%
                      </p>
                      <p className="text-xs text-slate-500">conversion</p>
                    </div>
                  </div>
                  {index < analytics.stageMetrics.length - 3 && (
                    <div className="flex justify-center my-1">
                      <ArrowDown className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Prospect Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Prospects</span>
              <span className="text-lg font-bold text-slate-900">{analytics.prospectMetrics.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg. Priority Score</span>
              <span className="text-lg font-bold text-slate-900">
                {analytics.prospectMetrics.avgPriorityScore.toFixed(0)}
              </span>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-2">By Status</p>
              {Object.entries(analytics.prospectMetrics.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-600 capitalize">{status}</span>
                  <span className="text-xs font-medium text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Cadence Performance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Active Cadences</span>
              <span className="text-lg font-bold text-slate-900">{analytics.cadenceMetrics.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg. Steps per Cadence</span>
              <span className="text-lg font-bold text-slate-900">
                {analytics.cadenceMetrics.avgSteps.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Total Enrollments</span>
              <span className="text-lg font-bold text-slate-900">{analytics.cadenceMetrics.totalEnrollments}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Activity Metrics</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-slate-600">Emails Sent</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{analytics.activityMetrics.emails}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-slate-600">Calls Made</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{analytics.activityMetrics.calls}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-sm text-slate-600">Total Activities</span>
              <span className="text-lg font-bold text-slate-900">{analytics.activityMetrics.totalActivities}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
