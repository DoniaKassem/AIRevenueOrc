import { useEffect, useState } from 'react';
import { UserPlus, Search, Filter, TrendingUp, Mail, Phone, Target, Download, PhoneCall, Sparkles, Database, Brain, Upload, Send } from 'lucide-react';
import AddProspectForm from '../forms/AddProspectForm';
import EnrollCadenceForm from '../forms/EnrollCadenceForm';
import LogCallForm from '../forms/LogCallForm';
import AIEmailComposer from '../forms/AIEmailComposer';
import EnrichContactForm from '../forms/EnrichContactForm';
import AIInsightsPanel from './AIInsightsPanel';
import BulkEmailForm from '../forms/BulkEmailForm';
import BulkImportForm from '../forms/BulkImportForm';
import { exportToCSV } from '../../utils/exportCSV';

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

interface Prospect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  company: string | null;
  status: string;
  priority_score: number;
  created_at: string;
}

export default function ProspectsView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showAiEmailModal, setShowAiEmailModal] = useState(false);
  const [showEnrichModal, setShowEnrichModal] = useState(false);
  const [showAIInsightsModal, setShowAIInsightsModal] = useState(false);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedProspectForEmail, setSelectedProspectForEmail] = useState<Prospect | null>(null);
  const [selectedProspectForEnrich, setSelectedProspectForEnrich] = useState<Prospect | null>(null);
  const [selectedProspectForInsights, setSelectedProspectForInsights] = useState<Prospect | null>(null);
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProspects();
  }, []);

  async function loadProspects() {
    try {
      const response = await fetch('/api/prospects?limit=50&orderBy=priority_score&orderDir=desc');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load prospects');
      }
      
      setProspects(result.data || []);
    } catch (error) {
      console.error('Error loading prospects:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProspects = prospects.filter(
    (p) =>
      p.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-green-100 text-green-700',
    nurturing: 'bg-purple-100 text-purple-700',
    unqualified: 'bg-slate-100 text-slate-700',
  };

  const toggleProspectSelection = (prospectId: string) => {
    const newSelected = new Set(selectedProspects);
    if (newSelected.has(prospectId)) {
      newSelected.delete(prospectId);
    } else {
      newSelected.add(prospectId);
    }
    setSelectedProspects(newSelected);
  };

  const toggleAllProspects = () => {
    if (selectedProspects.size === filteredProspects.length) {
      setSelectedProspects(new Set());
    } else {
      setSelectedProspects(new Set(filteredProspects.map((p) => p.id)));
    }
  };

  const handleExport = () => {
    const exportData = filteredProspects.map((p) => ({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      company: p.company,
      title: p.title,
      status: p.status,
      priority_score: p.priority_score,
      created_at: p.created_at,
    }));
    exportToCSV(exportData, 'prospects');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Prospects</h1>
          <p className="text-slate-600 mt-1">
            Manage and prioritize your prospect pipeline
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-lg transition"
          >
            <Upload className="w-5 h-5" />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-lg transition"
          >
            <Download className="w-5 h-5" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Prospect</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Prospects', value: prospects.length, icon: UserPlus },
          {
            label: 'High Priority',
            value: prospects.filter((p) => p.priority_score > 75).length,
            icon: TrendingUp,
          },
          {
            label: 'Contacted',
            value: prospects.filter((p) => p.status === 'contacted').length,
            icon: Mail,
          },
          {
            label: 'Qualified',
            value: prospects.filter((p) => p.status === 'qualified').length,
            icon: Phone,
          },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <stat.icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {selectedProspects.size > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedProspects.size} prospect{selectedProspects.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowBulkEmailModal(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm transition"
              >
                <Send className="w-4 h-4" />
                <span>Send Email</span>
              </button>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition"
              >
                <Target className="w-4 h-4" />
                <span>Enroll in Cadence</span>
              </button>
              <button
                onClick={() => {
                  const selectedData = prospects.filter(p => selectedProspects.has(p.id));
                  const exportData = selectedData.map(p => ({
                    first_name: p.first_name,
                    last_name: p.last_name,
                    email: p.email,
                    phone: p.phone,
                    title: p.title,
                    company: p.company,
                    status: p.status,
                    priority_score: p.priority_score,
                  }));
                  exportToCSV(exportData, 'selected_prospects');
                }}
                className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm transition"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <button
                onClick={() => setSelectedProspects(new Set())}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-3 py-1.5"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-slate-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search prospects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
            <Filter className="w-5 h-5" />
            <span>Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedProspects.size === filteredProspects.length && filteredProspects.length > 0}
                    onChange={toggleAllProspects}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Contact
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Priority
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading prospects...
                  </td>
                </tr>
              ) : filteredProspects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No prospects found. Add your first prospect to get started.
                  </td>
                </tr>
              ) : (
                filteredProspects.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProspects.has(prospect.id)}
                        onChange={() => toggleProspectSelection(prospect.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {prospect.first_name} {prospect.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {prospect.company || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {prospect.title || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        {prospect.email && (
                          <div className="text-slate-600">{prospect.email}</div>
                        )}
                        {prospect.phone && (
                          <div className="text-slate-500">{prospect.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusColors[prospect.status] ||
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {prospect.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${prospect.priority_score}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-600">
                          {Math.round(prospect.priority_score)}
                        </span>
                        {(prospect as any).ai_insights?.insights && (
                          <div className="group relative">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <div className="hidden group-hover:block absolute z-10 w-64 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg right-0 top-6">
                              <p className="font-semibold mb-1">AI Insights:</p>
                              {(prospect as any).ai_insights.insights.slice(0, 2).map((insight: string, idx: number) => (
                                <p key={idx} className="mb-1">• {insight}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setSelectedProspectForInsights(prospect);
                            setShowAIInsightsModal(true);
                          }}
                          className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-700 font-medium"
                          title="View AI Insights"
                        >
                          <Brain className="w-4 h-4" />
                          <span>Insights</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProspectForEmail(prospect);
                            setShowAiEmailModal(true);
                          }}
                          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Email</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProspectForEnrich(prospect);
                            setShowEnrichModal(true);
                          }}
                          className="flex items-center space-x-1 text-sm text-slate-600 hover:text-slate-700 font-medium"
                        >
                          <Database className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddProspectForm
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadProspects}
      />

      <EnrollCadenceForm
        isOpen={showEnrollModal}
        onClose={() => {
          setShowEnrollModal(false);
          setSelectedProspects(new Set());
        }}
        onSuccess={() => {
          loadProspects();
          setSelectedProspects(new Set());
        }}
        prospectIds={Array.from(selectedProspects)}
      />

      <LogCallForm
        isOpen={showLogCallModal}
        onClose={() => setShowLogCallModal(false)}
        onSuccess={loadProspects}
      />

      {selectedProspectForEmail && (
        <AIEmailComposer
          isOpen={showAiEmailModal}
          onClose={() => {
            setShowAiEmailModal(false);
            setSelectedProspectForEmail(null);
          }}
          prospectName={`${selectedProspectForEmail.first_name || ''} ${selectedProspectForEmail.last_name || ''}`.trim()}
          prospectTitle={selectedProspectForEmail.title || undefined}
          prospectCompany={selectedProspectForEmail.company || undefined}
        />
      )}

      {selectedProspectForEnrich && (
        <EnrichContactForm
          isOpen={showEnrichModal}
          onClose={() => {
            setShowEnrichModal(false);
            setSelectedProspectForEnrich(null);
          }}
          prospectId={selectedProspectForEnrich.id}
          currentData={{
            email: selectedProspectForEnrich.email || undefined,
            firstName: selectedProspectForEnrich.first_name || undefined,
            lastName: selectedProspectForEnrich.last_name || undefined,
            company: selectedProspectForEnrich.company || undefined,
          }}
          onSuccess={loadProspects}
        />
      )}

      {showAIInsightsModal && selectedProspectForInsights && (
        <AIInsightsPanel
          prospectId={selectedProspectForInsights.id}
          prospectName={`${selectedProspectForInsights.first_name || ''} ${selectedProspectForInsights.last_name || ''}`.trim()}
          onClose={() => {
            setShowAIInsightsModal(false);
            setSelectedProspectForInsights(null);
          }}
        />
      )}

      <BulkEmailForm
        isOpen={showBulkEmailModal}
        onClose={() => setShowBulkEmailModal(false)}
        prospectIds={Array.from(selectedProspects)}
        prospectCount={selectedProspects.size}
        onSuccess={() => {
          loadProspects();
          setSelectedProspects(new Set());
        }}
      />

      <BulkImportForm
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={loadProspects}
      />
    </div>
  );
}
