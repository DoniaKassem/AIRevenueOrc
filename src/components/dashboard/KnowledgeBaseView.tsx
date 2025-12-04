import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Book,
  Globe,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
} from 'lucide-react';
import Modal from '../common/Modal';
import CompanyProfileForm from '../forms/CompanyProfileForm';
import TrainingInsightsModal from './TrainingInsightsModal';
import { useAuth } from '../../contexts/AuthContext';

interface CompanyProfile {
  id: string;
  company_name: string;
  industry: string;
  website_url: string;
  company_description: string;
  spokesperson_enabled: boolean;
  knowledge_completeness_score: number;
  last_trained_at: string;
}

interface KnowledgeDocument {
  id: string;
  file_name: string;
  document_type: string;
  processing_status: string;
  created_at: string;
}

interface KnowledgeWebsite {
  id: string;
  url: string;
  page_title: string;
  sync_status: string;
  last_synced_at: string;
}

export default function KnowledgeBaseView() {
  const { user } = useAuth();
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null
  );
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [websites, setWebsites] = useState<KnowledgeWebsite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const [latestTraining, setLatestTraining] = useState<any>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);

  useEffect(() => {
    if (user?.team_id) {
      loadKnowledgeBase();
    }
  }, [user?.team_id]);

  async function loadKnowledgeBase() {
    if (!user?.team_id) return;

    try {
      setLoading(true);

      const { data: companyData } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('team_id', user.team_id)
        .maybeSingle();

      setCompanyProfile(companyData);

      if (companyData) {
        const { data: docsData } = await supabase
          .from('knowledge_documents')
          .select('*')
          .eq('company_profile_id', companyData.id)
          .order('created_at', { ascending: false });

        setDocuments(docsData || []);

        const { data: websitesData } = await supabase
          .from('knowledge_websites')
          .select('*')
          .eq('company_profile_id', companyData.id)
          .order('created_at', { ascending: false });

        setWebsites(websitesData || []);

        const { data: trainingData } = await supabase
          .from('company_training_sessions')
          .select('*')
          .eq('company_profile_id', companyData.id)
          .eq('training_type', 'full')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setLatestTraining(trainingData);
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddWebsite() {
    if (!newWebsiteUrl || !companyProfile) return;

    try {
      const { data, error } = await supabase
        .from('knowledge_websites')
        .insert({
          company_profile_id: companyProfile.id,
          url: newWebsiteUrl,
        })
        .select()
        .single();

      if (error) throw error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      fetch(`${supabaseUrl}/functions/v1/crawl-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ website_id: data.id }),
      });

      setNewWebsiteUrl('');
      setShowWebsiteModal(false);
      await loadKnowledgeBase();
    } catch (error) {
      console.error('Error adding website:', error);
    }
  }

  async function handleSyncWebsite(websiteId: string) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      await fetch(`${supabaseUrl}/functions/v1/crawl-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ website_id: websiteId }),
      });

      await loadKnowledgeBase();
    } catch (error) {
      console.error('Error syncing website:', error);
    }
  }

  async function handleDeepResearch() {
    if (!companyProfile) return;

    try {
      setResearchLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/deep-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          company_profile_id: companyProfile.id,
          research_focus: 'comprehensive',
        }),
      });

      if (response.ok) {
        await loadKnowledgeBase();
      }
    } catch (error) {
      console.error('Error running deep research:', error);
    } finally {
      setResearchLoading(false);
    }
  }

  async function handleDeleteWebsite(websiteId: string) {
    try {
      await supabase.from('knowledge_websites').delete().eq('id', websiteId);
      await loadKnowledgeBase();
    } catch (error) {
      console.error('Error deleting website:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!companyProfile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-600 mt-1">
            Train your AI agents with company-specific knowledge
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Book className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            No Company Profile Yet
          </h2>
          <p className="text-slate-600 mb-6">
            Create your company profile to start training AI agents with your
            company's background and knowledge
          </p>
          <button
            onClick={() => setShowProfileForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
          >
            Create Company Profile
          </button>
        </div>

        <CompanyProfileForm
          isOpen={showProfileForm}
          onClose={() => setShowProfileForm(false)}
          onSuccess={loadKnowledgeBase}
          teamId={user?.team_id || ''}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-600 mt-1">
            Manage your company knowledge and train AI agents
          </p>
        </div>
        <button
          onClick={() => setShowProfileForm(true)}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit Profile
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Book className="w-8 h-8 text-blue-600" />
            <span
              className={`text-2xl font-bold ${
                companyProfile.knowledge_completeness_score >= 70
                  ? 'text-green-600'
                  : companyProfile.knowledge_completeness_score >= 40
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {companyProfile.knowledge_completeness_score}%
            </span>
          </div>
          <h3 className="font-semibold text-slate-900">Knowledge Score</h3>
          <p className="text-sm text-slate-600 mt-1">
            Completeness of training data
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {documents.length}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900">Documents</h3>
          <p className="text-sm text-slate-600 mt-1">Training documents</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Globe className="w-8 h-8 text-purple-600" />
            <span className="text-2xl font-bold text-purple-600">
              {websites.length}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900">Websites</h3>
          <p className="text-sm text-slate-600 mt-1">Crawled web pages</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {companyProfile.company_name}
            </h2>
            <p className="text-sm text-slate-600">
              {companyProfile.company_description}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {companyProfile.spokesperson_enabled && (
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3 mr-1" />
                Spokesperson Mode Active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDeepResearch}
            disabled={researchLoading}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg transition"
          >
            {researchLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Running Deep Research...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Run OpenAI Deep Research</span>
              </>
            )}
          </button>
          {latestTraining && latestTraining.metrics && (
            <button
              onClick={() => setShowInsightsModal(true)}
              className="flex items-center space-x-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-lg transition"
            >
              <Eye className="w-5 h-5" />
              <span>View Latest Insights</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Knowledge Documents
              </h2>
              <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {documents.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No documents uploaded yet</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">
                        {doc.file_name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {doc.document_type}
                        </span>
                        <span
                          className={`text-xs ${
                            doc.processing_status === 'completed'
                              ? 'text-green-600'
                              : doc.processing_status === 'processing'
                              ? 'text-yellow-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {doc.processing_status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Website Sources
              </h2>
              <button
                onClick={() => setShowWebsiteModal(true)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add URL</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {websites.length === 0 ? (
              <div className="p-12 text-center">
                <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No websites added yet</p>
              </div>
            ) : (
              websites.map((website) => (
                <div
                  key={website.id}
                  className="p-4 hover:bg-slate-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">
                        {website.page_title || website.url}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {website.url}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span
                          className={`text-xs ${
                            website.sync_status === 'completed'
                              ? 'text-green-600'
                              : website.sync_status === 'syncing'
                              ? 'text-yellow-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {website.sync_status}
                        </span>
                        {website.last_synced_at && (
                          <span className="text-xs text-slate-400">
                            Last synced:{' '}
                            {new Date(website.last_synced_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleSyncWebsite(website.id)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWebsite(website.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showWebsiteModal}
        onClose={() => setShowWebsiteModal(false)}
        title="Add Website Source"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website URL
            </label>
            <input
              type="url"
              value={newWebsiteUrl}
              onChange={(e) => setNewWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowWebsiteModal(false)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddWebsite}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add & Crawl
            </button>
          </div>
        </div>
      </Modal>

      <CompanyProfileForm
        isOpen={showProfileForm}
        onClose={() => setShowProfileForm(false)}
        onSuccess={loadKnowledgeBase}
        existingProfile={companyProfile}
        teamId={user?.team_id || ''}
      />

      <TrainingInsightsModal
        isOpen={showInsightsModal}
        onClose={() => setShowInsightsModal(false)}
        trainingData={latestTraining}
      />
    </div>
  );
}
