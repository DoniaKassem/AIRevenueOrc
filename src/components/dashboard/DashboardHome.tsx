import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  Users,
  Target,
  Mail,
  Phone,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Settings,
} from 'lucide-react';
import CustomizableDashboard from './CustomizableDashboard';

interface DashboardStats {
  prospects: number;
  activeDeals: number;
  pipelineValue: number;
  emailsSent: number;
  callsMade: number;
  activeCadences: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<DashboardStats>({
    prospects: 0,
    activeDeals: 0,
    pipelineValue: 0,
    emailsSent: 0,
    callsMade: 0,
    activeCadences: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'default' | 'custom'>(() => {
    const stored = localStorage.getItem('dashboard-view-mode');
    return (stored as 'default' | 'custom') || 'default';
  });

  const toggleViewMode = () => {
    const newMode = viewMode === 'default' ? 'custom' : 'default';
    setViewMode(newMode);
    localStorage.setItem('dashboard-view-mode', newMode);
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  async function loadDashboardStats() {
    try {
      const [prospects, deals, emails, calls, cadences] = await Promise.all([
        supabase
          .from('prospects')
          .select('id', { count: 'exact' }),
        supabase
          .from('deals')
          .select('amount')
          .not('stage', 'in', '(closed_won,closed_lost)'),
        supabase
          .from('email_sends')
          .select('id', { count: 'exact' })
          .gte(
            'created_at',
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ),
        supabase
          .from('call_logs')
          .select('id', { count: 'exact' })
          .gte(
            'created_at',
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ),
        supabase
          .from('cadences')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
      ]);

      const pipelineValue = deals.data?.reduce((sum, d) => sum + d.amount, 0) || 0;

      setStats({
        prospects: prospects.count || 0,
        activeDeals: deals.count || 0,
        pipelineValue,
        emailsSent: emails.count || 0,
        callsMade: calls.count || 0,
        activeCadences: cadences.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const metrics = [
    {
      label: 'Total Prospects',
      value: stats.prospects,
      icon: Users,
      change: '+12%',
      positive: true,
      color: 'blue',
    },
    {
      label: 'Active Deals',
      value: stats.activeDeals,
      icon: Target,
      change: '+8%',
      positive: true,
      color: 'green',
    },
    {
      label: 'Pipeline Value',
      value: `$${(stats.pipelineValue / 1000).toFixed(0)}K`,
      icon: TrendingUp,
      change: '+24%',
      positive: true,
      color: 'purple',
    },
    {
      label: 'Emails Sent (30d)',
      value: stats.emailsSent,
      icon: Mail,
      change: '+5%',
      positive: true,
      color: 'cyan',
    },
    {
      label: 'Calls Made (30d)',
      value: stats.callsMade,
      icon: Phone,
      change: '-3%',
      positive: false,
      color: 'orange',
    },
    {
      label: 'Active Cadences',
      value: stats.activeCadences,
      icon: Sparkles,
      change: '+2',
      positive: true,
      color: 'pink',
    },
  ];

  if (viewMode === 'custom') {
    return <CustomizableDashboard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Revenue Operations Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Here's what's happening with your revenue operations
          </p>
        </div>
        <button
          onClick={toggleViewMode}
          className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition"
        >
          <Settings className="w-5 h-5" />
          <span>Customize</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6">
            {metrics.map((metric, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`bg-${metric.color}-100 p-3 rounded-lg`}>
                    <metric.icon className={`w-6 h-6 text-${metric.color}-600`} />
                  </div>
                  <div
                    className={`flex items-center text-sm font-medium ${
                      metric.positive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {metric.positive ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 mr-1" />
                    )}
                    {metric.change}
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-2">{metric.label}</p>
                <p className="text-3xl font-bold text-slate-900">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  AI Insights
                </h2>
                <Sparkles className="w-5 h-5 text-blue-600" />
              </div>
              <div className="space-y-4">
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">
                    AI insights will appear here as you interact with prospects
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Start adding prospects and deals to see intelligent recommendations
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent Activity
                </h2>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">
                    No recent activity
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Activity will appear here as you engage with prospects
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
