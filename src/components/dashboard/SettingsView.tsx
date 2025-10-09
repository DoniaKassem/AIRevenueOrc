import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Mail, Plug, Bell, Shield, Plus, Sparkles, Key, Database, Moon, Sun, Monitor } from 'lucide-react';
import EmailTemplateForm from '../forms/EmailTemplateForm';
import EnrichmentProvidersPanel from './EnrichmentProvidersPanel';
import { useTheme } from '../../contexts/ThemeContext';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('general');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  async function loadTemplates() {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  }

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'ai', name: 'AI Settings', icon: Sparkles },
    { id: 'enrichment', name: 'Data Enrichment', icon: Database },
    { id: 'templates', name: 'Email Templates', icon: Mail },
    { id: 'integrations', name: 'Integrations', icon: Plug },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">
          Manage your platform configuration and preferences
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">General Settings</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Manage your appearance and preferences
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg transition ${
                          theme === 'light'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-slate-600'}`} />
                        <span className={`text-sm font-medium ${theme === 'light' ? 'text-blue-900' : 'text-slate-700'}`}>
                          Light
                        </span>
                      </button>

                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg transition ${
                          theme === 'dark'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-600' : 'text-slate-600'}`} />
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-900' : 'text-slate-700'}`}>
                          Dark
                        </span>
                      </button>

                      <button
                        onClick={() => setTheme('auto')}
                        className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg transition ${
                          theme === 'auto'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Monitor className={`w-6 h-6 ${theme === 'auto' ? 'text-blue-600' : 'text-slate-600'}`} />
                        <span className={`text-sm font-medium ${theme === 'auto' ? 'text-blue-900' : 'text-slate-700'}`}>
                          Auto
                        </span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {theme === 'auto'
                        ? 'Theme will match your system preferences'
                        : `${theme === 'light' ? 'Light' : 'Dark'} theme is active`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enrichment' && <EnrichmentProvidersPanel />}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <span>AI & OpenAI Configuration</span>
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Configure OpenAI integration for intelligent features
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-600 p-3 rounded-lg">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      OpenAI API Key
                    </h3>
                    <p className="text-sm text-slate-700 mb-4">
                      Your OpenAI API key is already configured in the environment. The system uses <code className="px-2 py-1 bg-white rounded text-blue-600 font-mono text-xs">gpt-4o-mini</code> for all AI features.
                    </p>
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
                        Current Configuration
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Default Model:</span>
                          <span className="font-medium text-slate-900">gpt-4o-mini</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Temperature:</span>
                          <span className="font-medium text-slate-900">0.7 (Balanced)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Max Tokens:</span>
                          <span className="font-medium text-slate-900">1000-1500</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-green-600" />
                    <span>AI Email Generation</span>
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Automatically generates personalized email content based on prospect data and your guidance.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600">ACTIVE</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <span>Lead Prioritization</span>
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Intelligent scoring and qualification of prospects using AI analysis of profile data.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600">ACTIVE</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <span>Conversation Intelligence</span>
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Analyzes call transcripts for insights, MEDDPICC, sentiment, and coaching recommendations.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600">ACTIVE</span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-red-600" />
                    <span>Deal Risk Analysis</span>
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Identifies at-risk deals and provides strategic recommendations to keep them on track.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-green-600">ACTIVE</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Bell className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">
                      Usage & Cost Monitoring
                    </p>
                    <p className="text-xs text-yellow-700">
                      All AI features use the OpenAI API. Monitor your usage in the OpenAI dashboard to track costs. The system uses cost-effective models (gpt-4o-mini) to minimize expenses while maintaining quality.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Email Templates
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Create and manage reusable email templates with personalization
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Template</span>
                </button>
              </div>

              <div className="grid gap-4">
                {templates.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 mb-4">No email templates yet</p>
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Create your first template
                    </button>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-slate-900">
                              {template.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                template.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {template.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            <span className="font-medium">Subject:</span>{' '}
                            {template.subject}
                          </p>
                          <p className="text-sm text-slate-500 line-clamp-2">
                            {template.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Integrations
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Connect with your favorite tools and platforms
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    name: 'Salesforce',
                    description: 'Sync contacts and deals',
                    connected: false,
                  },
                  {
                    name: 'HubSpot',
                    description: 'CRM integration',
                    connected: false,
                  },
                  {
                    name: 'Slack',
                    description: 'Team notifications',
                    connected: false,
                  },
                  {
                    name: 'Gmail',
                    description: 'Email sync',
                    connected: false,
                  },
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {integration.name}
                      </h3>
                      <button className="text-sm text-blue-600 hover:text-blue-700">
                        {integration.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                    <p className="text-sm text-slate-600">
                      {integration.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Notification Preferences
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Configure when and how you receive notifications
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    title: 'Email Notifications',
                    description: 'Receive updates via email',
                    enabled: true,
                  },
                  {
                    title: 'Deal Updates',
                    description: 'Notify when deals change stage',
                    enabled: true,
                  },
                  {
                    title: 'Cadence Completions',
                    description: 'Alert when prospects complete cadences',
                    enabled: false,
                  },
                  {
                    title: 'AI Insights',
                    description: 'Daily digest of AI recommendations',
                    enabled: true,
                  },
                ].map((setting) => (
                  <div
                    key={setting.title}
                    className="flex items-center justify-between py-3 border-b border-slate-200"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{setting.title}</p>
                      <p className="text-sm text-slate-600">
                        {setting.description}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        className="sr-only peer"
                        readOnly
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Security Settings
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Manage security and access controls
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    API Access
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Generate API keys for programmatic access
                  </p>
                  <button className="text-sm bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition">
                    Generate API Key
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Data Export
                  </h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Export all your data in CSV format
                  </p>
                  <button className="text-sm bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <EmailTemplateForm
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={loadTemplates}
      />
    </div>
  );
}
