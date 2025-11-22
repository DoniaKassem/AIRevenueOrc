/**
 * API Keys Management Component
 *
 * SaaS-ready API key management with:
 * - Create/revoke API keys
 * - Copy to clipboard
 * - Usage tracking
 * - Permissions/scopes
 * - Expiration dates
 */

import { useState, useEffect } from 'react';
import apiClient from '../../lib/api-client';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Calendar,
  Activity,
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface APIKey {
  id: string;
  name: string;
  key: string; // Masked, except when just created
  prefix: string; // e.g., "sk_live_"
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'revoked';
  requestCount: number;
}

// =============================================
// COMPONENT
// =============================================

export default function APIKeysManagement() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [newKeyExpiry, setNewKeyExpiry] = useState<number>(0); // 0 = never, or days
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const availableScopes = [
    { value: 'read', label: 'Read', description: 'Read data via API' },
    { value: 'write', label: 'Write', description: 'Create and update data' },
    { value: 'delete', label: 'Delete', description: 'Delete data' },
    { value: 'admin', label: 'Admin', description: 'Full administrative access' },
  ];

  useEffect(() => {
    loadAPIKeys();
  }, []);

  async function loadAPIKeys() {
    setLoading(true);
    try {
      const data = await apiClient.get<APIKey[]>('/api-keys');
      setApiKeys(data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;

    setCreating(true);
    try {
      const response = await apiClient.post<{ apiKey: APIKey; key: string }>('/api-keys', {
        name: newKeyName,
        scopes: newKeyScopes,
        expiresIn: newKeyExpiry > 0 ? newKeyExpiry * 24 * 60 * 60 : null, // Convert days to seconds
      });

      setNewlyCreatedKey(response.key);
      setNewKeyName('');
      setNewKeyScopes(['read']);
      setNewKeyExpiry(0);
      await loadAPIKeys();
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiClient.delete(`/api-keys/${keyId}`);
      await loadAPIKeys();
    } catch (error) {
      console.error('Failed to revoke API key:', error);
      alert('Failed to revoke API key');
    }
  }

  function handleCopyKey(key: string, keyId: string) {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  function toggleKeyVisibility(keyId: string) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  }

  function maskKey(key: string): string {
    if (key.length <= 8) return key;
    return `${key.substring(0, 12)}${'•'.repeat(20)}${key.substring(key.length - 4)}`;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
      case 'expired':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Expired</span>;
      case 'revoked':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Revoked</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create API Key</span>
        </button>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">Keep your API keys secure</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              API keys grant access to your account. Never share them publicly or commit them to version control.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
              <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{apiKeys.length}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Keys</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {apiKeys.filter((k) => k.status === 'active').length}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {apiKeys.reduce((sum, key) => sum + key.requestCount, 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total Requests</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {apiKeys.length === 0 ? (
          <div className="p-12 text-center">
            <Key className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No API keys yet</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Create an API key to access your data programmatically
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Create Your First API Key
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{apiKey.name}</h3>
                      {getStatusBadge(apiKey.status)}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-600 dark:text-slate-400">
                      <span>Created {formatDate(apiKey.createdAt)}</span>
                      {apiKey.lastUsedAt && <span>Last used {formatDate(apiKey.lastUsedAt)}</span>}
                      {apiKey.expiresAt && (
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Expires {formatDate(apiKey.expiresAt)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {apiKey.status === 'active' && (
                    <button
                      onClick={() => handleRevokeKey(apiKey.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-900 rounded-lg px-4 py-2 font-mono text-sm">
                      {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                    </div>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                      title={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}
                    >
                      {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleCopyKey(apiKey.key, apiKey.id)}
                      className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                      title="Copy to clipboard"
                    >
                      {copiedKeyId === apiKey.id ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400">Scopes:</span>
                    {apiKey.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-slate-600 dark:text-slate-400">
                    <span>{apiKey.requestCount.toLocaleString()} requests</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Create API Key</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production API Key"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {availableScopes.map((scope) => (
                    <label key={scope.value} className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope.value]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.value));
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{scope.label}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Expiration
                </label>
                <select
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value={0}>Never expires</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              {newlyCreatedKey && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900 dark:text-green-200">API Key Created!</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Make sure to copy your key now. You won't be able to see it again!
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 bg-white dark:bg-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-900 dark:text-white overflow-x-auto">
                      {newlyCreatedKey}
                    </code>
                    <button
                      onClick={() => handleCopyKey(newlyCreatedKey, 'new')}
                      className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition"
                    >
                      {copiedKeyId === 'new' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-b-xl flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewlyCreatedKey(null);
                }}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                {newlyCreatedKey ? 'Done' : 'Cancel'}
              </button>
              {!newlyCreatedKey && (
                <button
                  onClick={handleCreateKey}
                  disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
