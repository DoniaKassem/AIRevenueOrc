import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Clock,
  RefreshCw,
  Settings,
  Plus,
  Search,
  Filter,
} from 'lucide-react';
import {
  getIntegrationHealthStatus,
  getUsageAnalyticsSummary,
  getCostBreakdown,
  getApiCallTrends,
  type IntegrationHealthStatus,
  type UsageAnalyticsSummary,
} from '../../lib/integrationAnalytics';
import { useAuth } from '../../contexts/AuthContext';

interface IntegrationControlCenterProps {
  onNavigate: (view: string, integrationId?: string) => void;
}

export default function IntegrationControlCenter({
  onNavigate,
}: IntegrationControlCenterProps) {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationHealthStatus[]>([]);
  const [summary, setSummary] = useState<UsageAnalyticsSummary | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<Array<{ integrationName: string; totalCost: number }>>([]);
  const [apiTrends, setApiTrends] = useState<Array<{ date: string; apiCalls: number; successRate: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'degraded' | 'critical'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user?.team_id) return;

    setLoading(true);
    try {
      // Get current date range (last 30 days)
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [healthData, summaryData, costsData, trendsData] = await Promise.all([
        getIntegrationHealthStatus(user.team_id),
        getUsageAnalyticsSummary(user.team_id, startDate, endDate),
        getCostBreakdown(user.team_id, startDate, endDate),
        getApiCallTrends(user.team_id, startDate, endDate),
      ]);

      setIntegrations(healthData);
      setSummary(summaryData);
      setCostBreakdown(costsData);
      setApiTrends(trendsData);
    } catch (error) {
      console.error('Error loading integration data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.integrationName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || integration.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integration Control Center</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor and manage all your API connections in one place
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('marketplace')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Add Integration
          </button>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Integrations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.activeIntegrations}</p>
              </div>
              <Zap className="w-10 h-10 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">API Calls (30d)</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.totalApiCalls.toLocaleString()}
                </p>
              </div>
              <Activity className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.avgSuccessRate.toFixed(1)}%
                </p>
              </div>
              {summary.avgSuccessRate >= 95 ? (
                <TrendingUp className="w-10 h-10 text-green-600" />
              ) : (
                <TrendingDown className="w-10 h-10 text-red-600" />
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cost (30d)</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  ${summary.totalCostUsd.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="critical">Critical</option>
            </select>

            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <div
              key={integration.integrationId}
              className={`bg-white p-6 rounded-lg border-2 ${getStatusColor(integration.status)} cursor-pointer hover:shadow-lg transition-shadow`}
              onClick={() => onNavigate('integration-details', integration.integrationId)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(integration.status)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{integration.integrationName}</h3>
                    <p className="text-xs text-gray-500">{integration.providerKey}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('integration-settings', integration.integrationId);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Health Score</span>
                  <span className="font-semibold">{integration.healthScore}/100</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      integration.healthScore >= 70
                        ? 'bg-green-500'
                        : integration.healthScore >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${integration.healthScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Success Rate (24h)</span>
                  <span className="font-semibold">{integration.successRate24h.toFixed(1)}%</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Avg Latency</span>
                  <span className="font-semibold">{integration.avgLatencyMs}ms</span>
                </div>

                {integration.lastSyncAt && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                    <Clock className="w-3 h-3" />
                    Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                  </div>
                )}

                {integration.issues.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Issues:</p>
                    {integration.issues.map((issue, idx) => (
                      <p key={idx} className="text-xs text-red-600">• {issue}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Integration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIntegrations.map((integration) => (
                <tr
                  key={integration.integrationId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onNavigate('integration-details', integration.integrationId)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(integration.status)}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {integration.integrationName}
                        </div>
                        <div className="text-xs text-gray-500">{integration.providerKey}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(integration.status)}`}>
                      {integration.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {integration.healthScore}/100
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {integration.successRate24h.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {integration.avgLatencyMs}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {integration.lastSyncAt
                      ? new Date(integration.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('integration-settings', integration.integrationId);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Settings
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredIntegrations.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No integrations found</p>
          <button
            onClick={() => onNavigate('marketplace')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Marketplace
          </button>
        </div>
      )}
    </div>
  );
}
