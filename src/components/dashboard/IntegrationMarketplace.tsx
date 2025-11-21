import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  TrendingUp,
  Check,
  ExternalLink,
  BookOpen,
  Zap,
  Filter,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateAuthorizationUrl } from '../../lib/oauthIntegration';
import { useAuth } from '../../contexts/AuthContext';

interface MarketplaceIntegration {
  id: string;
  provider_key: string;
  name: string;
  description: string;
  category: string;
  logo_url: string | null;
  website_url: string | null;
  documentation_url: string | null;
  setup_complexity: 'easy' | 'medium' | 'hard';
  pricing_tier: string | null;
  required_scopes: string[];
  supported_features: Record<string, boolean>;
  is_featured: boolean;
  install_count: number;
  average_rating: number | null;
  is_installed?: boolean;
}

interface IntegrationMarketplaceProps {
  onNavigate: (view: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  crm: '👥',
  email: '✉️',
  calendar: '📅',
  communication: '💬',
  enrichment: '🔍',
  social: '🌐',
  payment: '💳',
  automation: '⚙️',
  analytics: '📊',
};

export default function IntegrationMarketplace({
  onNavigate,
}: IntegrationMarketplaceProps) {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<MarketplaceIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [user]);

  async function loadIntegrations() {
    if (!user?.team_id) return;

    setLoading(true);
    try {
      // Get all marketplace integrations
      const { data: marketplaceData, error: marketplaceError } = await supabase
        .from('integration_marketplace')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('install_count', { ascending: false });

      if (marketplaceError) throw marketplaceError;

      // Get installed integrations for this team
      const { data: installedData, error: installedError } = await supabase
        .from('team_integrations')
        .select('provider_key')
        .eq('team_id', user.team_id)
        .eq('is_active', true);

      if (installedError) throw installedError;

      const installedKeys = new Set(installedData?.map(i => i.provider_key) || []);

      // Mark installed integrations
      const integrationsWithStatus = (marketplaceData || []).map(integration => ({
        ...integration,
        is_installed: installedKeys.has(integration.provider_key),
      }));

      setIntegrations(integrationsWithStatus);
    } catch (error) {
      console.error('Error loading marketplace:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstallIntegration(integration: MarketplaceIntegration) {
    if (!user?.team_id) return;

    setInstalling(integration.provider_key);

    try {
      // Check if provider has OAuth configuration
      const { data: providerData } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('provider_key', integration.provider_key)
        .single();

      if (!providerData) {
        alert('Integration configuration not found');
        setInstalling(null);
        return;
      }

      // Generate OAuth URL if OAuth-based
      if (providerData.auth_type === 'oauth2') {
        const authUrl = await generateAuthorizationUrl(
          integration.provider_key,
          user.team_id,
          integration.required_scopes || []
        );

        if (authUrl) {
          // Open OAuth flow in popup
          const width = 600;
          const height = 700;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;

          window.open(
            authUrl,
            'OAuth Authorization',
            `width=${width},height=${height},left=${left},top=${top}`
          );

          // Listen for OAuth callback
          window.addEventListener('message', async (event) => {
            if (event.data.type === 'oauth_success') {
              await loadIntegrations(); // Reload to show new installation
              alert(`${integration.name} installed successfully!`);
              setInstalling(null);
            } else if (event.data.type === 'oauth_error') {
              alert(`Failed to install ${integration.name}: ${event.data.error}`);
              setInstalling(null);
            }
          });
        } else {
          alert('Failed to generate authorization URL');
          setInstalling(null);
        }
      } else {
        // For API key-based integrations, show configuration modal
        const apiKey = prompt(`Enter your ${integration.name} API key:`);
        if (apiKey) {
          const { error } = await supabase
            .from('team_integrations')
            .insert({
              team_id: user.team_id,
              provider_key: integration.provider_key,
              config: { api_key: apiKey },
              is_active: true,
            });

          if (error) {
            alert('Failed to save integration');
            console.error(error);
          } else {
            await loadIntegrations();
            alert(`${integration.name} installed successfully!`);
          }
        }
        setInstalling(null);
      }
    } catch (error) {
      console.error('Error installing integration:', error);
      alert('An error occurred while installing the integration');
      setInstalling(null);
    }
  }

  const categories = Array.from(new Set(integrations.map(i => i.category)));

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || integration.category === selectedCategory;

    const matchesComplexity =
      selectedComplexity === 'all' || integration.setup_complexity === selectedComplexity;

    const matchesFeatured = !showFeaturedOnly || integration.is_featured;

    return matchesSearch && matchesCategory && matchesComplexity && matchesFeatured;
  });

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'easy':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'hard':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integration Marketplace</h1>
          <p className="text-sm text-gray-600 mt-1">
            Browse and install integrations to connect with your favorite tools
          </p>
        </div>
        <button
          onClick={() => onNavigate('control-center')}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back to Control Center
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {CATEGORY_ICONS[category] || '📦'} {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={selectedComplexity}
            onChange={(e) => setSelectedComplexity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Complexity</option>
            <option value="easy">Easy Setup</option>
            <option value="medium">Medium Setup</option>
            <option value="hard">Advanced Setup</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFeaturedOnly}
              onChange={(e) => setShowFeaturedOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Featured only</span>
          </label>

          {(searchQuery || selectedCategory !== 'all' || selectedComplexity !== 'all' || showFeaturedOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedComplexity('all');
                setShowFeaturedOnly(false);
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredIntegrations.length} of {integrations.length} integrations
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                  {CATEGORY_ICONS[integration.category] || '📦'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    {integration.name}
                    {integration.is_featured && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 capitalize">{integration.category}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {integration.description}
            </p>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(integration.supported_features)
                .filter(([_, enabled]) => enabled)
                .slice(0, 3)
                .map(([feature]) => (
                  <span
                    key={feature}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                  >
                    {feature}
                  </span>
                ))}
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className={`px-2 py-1 rounded ${getComplexityColor(integration.setup_complexity)}`}>
                {integration.setup_complexity} setup
              </span>
              <div className="flex items-center gap-3 text-gray-600">
                {integration.average_rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{integration.average_rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>{integration.install_count}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {integration.is_installed ? (
                <button
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium"
                >
                  <Check className="w-4 h-4" />
                  Installed
                </button>
              ) : (
                <button
                  onClick={() => handleInstallIntegration(integration)}
                  disabled={installing === integration.provider_key}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {installing === integration.provider_key ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Install
                    </>
                  )}
                </button>
              )}

              {integration.documentation_url && (
                <a
                  href={integration.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="View Documentation"
                >
                  <BookOpen className="w-5 h-5 text-gray-600" />
                </a>
              )}

              {integration.website_url && (
                <a
                  href={integration.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="Visit Website"
                >
                  <ExternalLink className="w-5 h-5 text-gray-600" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No integrations found matching your filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedComplexity('all');
              setShowFeaturedOnly(false);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
