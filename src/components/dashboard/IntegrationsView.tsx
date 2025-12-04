import { useEffect, useState } from 'react';
import { Plug, CheckCircle2, AlertCircle, XCircle, Plus, Settings, Activity, Zap, RefreshCw } from 'lucide-react';

interface IntegrationProvider {
  id: string;
  name: string;
  category: string;
  description: string;
  logo_url?: string;
  auth_type: string;
  capabilities: any;
  is_active: boolean;
}

interface TeamIntegration {
  id: string;
  provider_id: string;
  provider_name: string;
  status: 'active' | 'inactive' | 'error';
  last_sync_at?: string;
  created_at: string;
}

export default function IntegrationsView() {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<TeamIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      // Available integration providers - only showing the main CRM and enrichment tools
      const availableProviders: IntegrationProvider[] = [
        {
          id: '1',
          name: 'Salesforce',
          category: 'CRM',
          description: 'Sync contacts, deals, and activities with Salesforce',
          auth_type: 'oauth2',
          capabilities: { sync: true, webhook: true, bidirectional: true },
          is_active: true,
        },
        {
          id: '2',
          name: 'HubSpot',
          category: 'CRM',
          description: 'Integrate with HubSpot CRM and Marketing Hub',
          auth_type: 'oauth2',
          capabilities: { sync: true, webhook: true, bidirectional: true },
          is_active: true,
        },
        {
          id: '3',
          name: 'ZoomInfo',
          category: 'Enrichment',
          description: 'Enrich contact and company data with ZoomInfo',
          auth_type: 'api_key',
          capabilities: { enrichment: true, company_data: true, contact_data: true },
          is_active: true,
        },
      ];

      // No connected integrations by default - user needs to connect them
      const connectedIntegrations: TeamIntegration[] = [];

      setProviders(availableProviders);
      setIntegrations(connectedIntegrations);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...new Set(providers.map(p => p.category))];

  const filteredProviders =
    selectedCategory === 'all'
      ? providers
      : providers.filter(p => p.category === selectedCategory);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const isConnected = (providerId: string) => {
    return integrations.some(i => i.provider_id === providerId);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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
            Integrations
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Connect your favorite tools and automate your workflow
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Custom Integration</span>
        </button>
      </div>

      {integrations.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Connected Integrations
          </h3>
          <div className="space-y-3">
            {integrations.map(integration => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {getStatusIcon(integration.status)}
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {integration.provider_name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Last synced {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedCategory === category
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProviders.map(provider => {
          const connected = isConnected(provider.id);

          return (
            <div
              key={provider.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:border-blue-400 dark:hover:border-blue-600 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                    <Plug className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {provider.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {provider.category}
                    </div>
                  </div>
                </div>
                {connected && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                    Connected
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {provider.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(provider.capabilities || {})
                  .filter(([_, value]) => value)
                  .slice(0, 3)
                  .map(([key]) => (
                    <span
                      key={key}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded"
                    >
                      {key.replace(/_/g, ' ')}
                    </span>
                  ))}
              </div>

              <button
                className={`w-full py-2 rounded-lg font-medium transition flex items-center justify-center space-x-2 ${
                  connected
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {connected ? (
                  <>
                    <Settings className="w-4 h-4" />
                    <span>Configure</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {filteredProviders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No integrations found
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Try selecting a different category
          </p>
        </div>
      )}
    </div>
  );
}
