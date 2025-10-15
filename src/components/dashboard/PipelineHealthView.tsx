import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, DollarSign, Clock } from 'lucide-react';
import { DealHealthMetrics, calculateDealHealth } from '../../lib/pipelineHealthMonitor';
import { supabase } from '../../lib/supabase';

export default function PipelineHealthView() {
  const [deals, setDeals] = useState<any[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<DealHealthMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadPipelineHealth();
  }, []);

  async function loadPipelineHealth() {
    setLoading(true);
    try {
      const { data: deals, error } = await supabase
        .from('deals')
        .select('*')
        .not('stage', 'in', '(closed_won,closed_lost)');

      if (error) {
        console.error('Error loading deals:', error);
        setHealthMetrics([]);
        setDeals([]);
        return;
      }

      const realDeals = deals || [];
      setDeals(realDeals);

      const metrics: DealHealthMetrics[] = [];
      for (const deal of realDeals) {
        const health = await calculateDealHealth(deal.id);
        metrics.push(health);
      }

      setHealthMetrics(metrics);
    } catch (error) {
      console.error('Error calculating pipeline health:', error);
      setHealthMetrics([]);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredMetrics =
    filter === 'all'
      ? healthMetrics
      : healthMetrics.filter(m => m.risk_level === filter);

  const criticalCount = healthMetrics.filter(m => m.risk_level === 'critical').length;
  const highCount = healthMetrics.filter(m => m.risk_level === 'high').length;
  const avgHealth = Math.round(
    healthMetrics.reduce((sum, m) => sum + m.health_score, 0) / healthMetrics.length
  );

  const getRiskColor = (level: DealHealthMetrics['risk_level']) => {
    switch (level) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    }
  };

  const getRiskBadge = (level: DealHealthMetrics['risk_level']) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Pipeline Health Monitor
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-powered deal risk assessment and recommendations
          </p>
        </div>
        <button
          onClick={loadPipelineHealth}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          Refresh Analysis
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Avg Health</div>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {avgHealth}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {avgHealth >= 75 ? 'Healthy' : avgHealth >= 50 ? 'Moderate' : 'At Risk'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Critical Risk</div>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {criticalCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Need immediate attention
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">High Risk</div>
            <TrendingDown className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {highCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Require close monitoring
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Deals</div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {deals.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            In active pipeline
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === level
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredMetrics.map(metric => {
          const deal = deals.find(d => d.id === metric.deal_id);
          if (!deal) return null;

          return (
            <div
              key={metric.deal_id}
              className={`border-l-4 rounded-lg p-6 ${getRiskColor(metric.risk_level)}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {deal.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskBadge(
                        metric.risk_level
                      )}`}
                    >
                      {metric.risk_level.toUpperCase()} RISK
                    </span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      ${(deal.value / 1000).toFixed(0)}K
                    </div>
                    <div>Stage: <span className="font-medium capitalize">{deal.stage}</span></div>
                    <div>Probability: <span className="font-medium">{(deal.probability * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-slate-900 dark:text-white">
                    {metric.health_score}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Health Score</div>
                </div>
              </div>

              {metric.risk_factors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Risk Factors:
                  </h4>
                  <div className="space-y-2">
                    {metric.risk_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2 text-sm"
                      >
                        <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5" />
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {factor.category}:
                          </span>{' '}
                          <span className="text-slate-600 dark:text-slate-400">
                            {factor.description}
                          </span>
                          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                            (Impact: -{factor.impact_score})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metric.recommendations.length > 0 && (
                <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Recommended Actions:
                  </h4>
                  <ul className="space-y-1">
                    {metric.recommendations.map((rec, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-slate-700 dark:text-slate-300 flex items-start"
                      >
                        <span className="mr-2">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredMetrics.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No {filter !== 'all' ? filter : ''} risk deals
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Your pipeline is looking healthy!
          </p>
        </div>
      )}
    </div>
  );
}
