import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Award, Target, Activity, Zap, Clock, DollarSign } from 'lucide-react';
import { PerformanceMetrics, LeaderboardEntry, ActivityCorrelation, generateLeaderboard, analyzeActivityCorrelations } from '../../lib/performanceAnalytics';

export default function PerformanceDashboardView() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [correlations, setCorrelations] = useState<ActivityCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    loadPerformanceData();
  }, [period]);

  async function loadPerformanceData() {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Empty metrics - will be populated with real data when available
      const emptyMetrics: PerformanceMetrics = {
        user_id: '',
        period: period,
        metrics: {
          emails_sent: 0,
          calls_made: 0,
          meetings_booked: 0,
          demos_completed: 0,
          deals_created: 0,
          deals_won: 0,
          revenue_generated: 0,
          activities_logged: 0,
        },
        conversion_rates: {
          email_to_reply: 0,
          call_to_meeting: 0,
          meeting_to_demo: 0,
          demo_to_proposal: 0,
          proposal_to_close: 0,
        },
        efficiency_scores: {
          activity_consistency: 0,
          response_time: 0,
          pipeline_velocity: 0,
          win_rate: 0,
        },
        timestamp: new Date().toISOString(),
      };

      // Empty leaderboard - will show "You" entry with no data
      const emptyLeaderboard: LeaderboardEntry[] = [
        {
          user_id: '1',
          user_name: 'You',
          rank: 1,
          total_score: 0,
          metrics: { revenue: 0, deals_won: 0, activities: 0 },
          badges: [],
        },
      ];

      // Empty correlations - will be populated as activities are tracked
      const emptyCorrelations: ActivityCorrelation[] = [];

      setMetrics(emptyMetrics);
      setLeaderboard(emptyLeaderboard);
      setCorrelations(emptyCorrelations);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const yourRank = leaderboard.find(e => e.user_name === 'You');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Performance Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your progress and compare with peers
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {(['week', 'month', 'quarter'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90 mb-1">Your Rank</div>
            <div className="text-5xl font-bold">#{yourRank?.rank || '-'}</div>
            <div className="text-sm opacity-90 mt-2">out of {leaderboard.length} reps</div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90 mb-1">Performance Score</div>
            <div className="text-5xl font-bold">{yourRank?.total_score || '-'}</div>
            <div className="flex items-center justify-end space-x-2 mt-2">
              {yourRank?.badges.map(badge => (
                <span key={badge} className="px-2 py-1 bg-white/20 rounded text-xs font-medium">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Revenue</div>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            ${(metrics.metrics.revenue_generated / 1000).toFixed(0)}K
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            +12% vs last {period}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Deals Won</div>
            <Trophy className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {metrics.metrics.deals_won}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.metrics.deals_created} created
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Meetings</div>
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {metrics.metrics.meetings_booked}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {metrics.conversion_rates.call_to_meeting * 100}% conversion
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Activities</div>
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {metrics.metrics.activities_logged}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            {metrics.efficiency_scores.activity_consistency * 100}% consistent
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Conversion Funnel
          </h3>
          <div className="space-y-4">
            {[
              { stage: 'Email → Reply', rate: metrics.conversion_rates.email_to_reply },
              { stage: 'Call → Meeting', rate: metrics.conversion_rates.call_to_meeting },
              { stage: 'Meeting → Demo', rate: metrics.conversion_rates.meeting_to_demo },
              { stage: 'Demo → Proposal', rate: metrics.conversion_rates.demo_to_proposal },
              { stage: 'Proposal → Close', rate: metrics.conversion_rates.proposal_to_close },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{item.stage}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {(item.rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${item.rate * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Activity Impact
          </h3>
          <div className="space-y-4">
            {correlations.map((corr, idx) => (
              <div key={idx} className="border-l-4 border-blue-600 pl-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                    {corr.activity_type}
                  </span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {(corr.correlation_to_revenue * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                  {corr.recommendation}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Optimal: {corr.optimal_frequency} per week
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
          Team Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Rep</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Score</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Revenue</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Deals Won</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Activities</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Badges</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.user_id}
                  className={`border-b border-slate-200 dark:border-slate-700 ${
                    entry.user_name === 'You' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {entry.rank === 1 && <span className="text-2xl mr-2">🥇</span>}
                      {entry.rank === 2 && <span className="text-2xl mr-2">🥈</span>}
                      {entry.rank === 3 && <span className="text-2xl mr-2">🥉</span>}
                      <span className="font-semibold text-slate-900 dark:text-white">#{entry.rank}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-medium ${entry.user_name === 'You' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                      {entry.user_name}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white">{entry.total_score}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    ${(entry.metrics.revenue / 1000).toFixed(0)}K
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {entry.metrics.deals_won}
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {entry.metrics.activities}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {entry.badges.slice(0, 2).map(badge => (
                        <span key={badge} className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded">
                          {badge}
                        </span>
                      ))}
                      {entry.badges.length > 2 && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded">
                          +{entry.badges.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
