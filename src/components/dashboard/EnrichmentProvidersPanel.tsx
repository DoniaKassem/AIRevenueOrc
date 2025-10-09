import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, CheckCircle, XCircle, TrendingUp, Clock, CreditCard } from 'lucide-react';

interface Provider {
  id: string;
  provider_name: string;
  display_name: string;
  priority_order: number;
  is_enabled: boolean;
  credits_remaining: number;
  credits_used_this_month: number;
  success_rate: number;
  avg_response_time_ms: number;
}

export default function EnrichmentProvidersPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    try {
      const { data, error } = await supabase
        .from('enrichment_providers')
        .select('*')
        .order('priority_order', { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleProvider(providerId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('enrichment_providers')
        .update({ is_enabled: !currentStatus })
        .eq('id', providerId);

      if (error) throw error;
      await loadProviders();
    } catch (error) {
      console.error('Error toggling provider:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Enrichment Providers</h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage data enrichment providers and waterfall priority order
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Waterfall Strategy</p>
            <p className="text-xs text-blue-700 mt-1">
              Providers are tried in priority order until enrichment succeeds. Adjust priority
              order to optimize for success rate, speed, or cost.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {providers.map((provider, index) => (
          <div
            key={provider.id}
            className={`bg-white rounded-xl border-2 p-6 transition ${
              provider.is_enabled
                ? 'border-slate-200 hover:border-blue-300'
                : 'border-slate-100 bg-slate-50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                    provider.is_enabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{provider.display_name}</h3>
                  <p className="text-xs text-slate-500">Priority: {provider.priority_order}</p>
                </div>
              </div>

              <button
                onClick={() => toggleProvider(provider.id, provider.is_enabled)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  provider.is_enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {provider.is_enabled ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Enabled</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Disabled</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <CreditCard className="w-4 h-4 text-slate-600" />
                  <span className="text-xs text-slate-600">Credits</span>
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {provider.credits_remaining.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">
                  {provider.credits_used_this_month} used this month
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600">Success Rate</span>
                </div>
                <p className="text-lg font-bold text-green-900">
                  {provider.success_rate.toFixed(0)}%
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-xs text-purple-600">Avg Speed</span>
                </div>
                <p className="text-lg font-bold text-purple-900">
                  {provider.avg_response_time_ms}ms
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-blue-600">Status</span>
                </div>
                <p className="text-sm font-semibold text-blue-900">
                  {provider.is_enabled && provider.credits_remaining > 0
                    ? 'Active'
                    : provider.credits_remaining === 0
                    ? 'No Credits'
                    : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> These are mock providers for demonstration. In production, you
          would integrate with real APIs like Clearbit, ZoomInfo, Apollo, Hunter.io, and People
          Data Labs.
        </p>
      </div>
    </div>
  );
}
