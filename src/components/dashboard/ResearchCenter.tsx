import React, { useState, useEffect } from 'react';
import {
  Search,
  TrendingUp,
  Calendar,
  Award,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Play,
  Clock,
  Target,
  Newspaper,
  Users,
  BarChart3,
  Database,
} from 'lucide-react';
import { researchOrchestrator } from '../../lib/research/researchOrchestrator';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function ResearchCenter() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [researchData, setResearchData] = useState<any | null>(null);
  const [qualityReport, setQualityReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCompanies();
  }, [user]);

  async function loadCompanies() {
    if (!user?.team_id) return;

    const { data } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('team_id', user.team_id)
      .order('created_at', { ascending: false });

    setCompanies(data || []);
  }

  async function handleSelectCompany(company: any) {
    setSelectedCompany(company);
    setLoading(true);

    try {
      // Load research data
      const { data: sources } = await supabase
        .from('company_research_sources')
        .select('*')
        .eq('company_profile_id', company.id);

      setResearchData({
        ...company.research_data,
        sources: sources || [],
        aiAnalysis: company.ai_analysis,
      });

      // Load quality report
      const report = await researchOrchestrator.generateQualityReport(company.id);
      setQualityReport(report);
    } catch (error) {
      console.error('Error loading research data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunResearch() {
    if (!selectedCompany || !user?.team_id) return;

    setResearching(true);

    try {
      const intelligence = await researchOrchestrator.executeResearch(
        user.team_id,
        selectedCompany.id,
        selectedCompany.name,
        selectedCompany.website
      );

      setResearchData(intelligence.aggregatedData);
      alert('Research completed successfully!');

      // Reload company data
      await loadCompanies();
      const updated = companies.find(c => c.id === selectedCompany.id);
      if (updated) {
        await handleSelectCompany(updated);
      }
    } catch (error) {
      console.error('Research failed:', error);
      alert('Research failed. Please try again.');
    } finally {
      setResearching(false);
    }
  }

  async function handleScheduleResearch(frequency: 'daily' | 'weekly' | 'monthly') {
    if (!selectedCompany || !user?.team_id) return;

    try {
      await researchOrchestrator.scheduleResearch(
        user.team_id,
        selectedCompany.id,
        frequency
      );

      alert(`Research scheduled to run ${frequency}`);
    } catch (error) {
      console.error('Failed to schedule research:', error);
      alert('Failed to schedule research');
    }
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getFreshnessColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Research Center</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Multi-source company intelligence and competitive analysis
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-8 text-center">
          <Database className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Database Setup Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            To use the Research Center, you need to configure a Supabase database.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-left max-w-lg mx-auto">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Setup steps:</p>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
              <li>Create a free project at <span className="text-blue-600">supabase.com</span></li>
              <li>Go to Settings → API</li>
              <li>Copy your Project URL and anon key</li>
              <li>Add them to your <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> file</li>
              <li>Restart the development server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research Center</h1>
          <p className="text-sm text-gray-600 mt-1">
            Multi-source company intelligence and competitive analysis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Company List */}
        <div className="col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCompany?.id === company.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{company.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{company.industry || 'N/A'}</span>
                    {company.research_quality_score && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${getQualityColor(
                          company.research_quality_score
                        )}`}
                      >
                        {company.research_quality_score}%
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Research Details */}
        <div className="col-span-8 space-y-4">
          {selectedCompany ? (
            <>
              {/* Company Header */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{selectedCompany.industry}</p>
                    {selectedCompany.website && (
                      <a
                        href={selectedCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                      >
                        {selectedCompany.website}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleRunResearch}
                      disabled={researching}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {researching ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Researching...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run Research
                        </>
                      )}
                    </button>

                    <div className="relative group">
                      <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        <Calendar className="w-4 h-4" />
                        Schedule
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                        <button
                          onClick={() => handleScheduleResearch('daily')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                        >
                          Daily
                        </button>
                        <button
                          onClick={() => handleScheduleResearch('weekly')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                        >
                          Weekly
                        </button>
                        <button
                          onClick={() => handleScheduleResearch('monthly')}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                        >
                          Monthly
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quality Metrics */}
                {qualityReport && (
                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Award className="w-4 h-4" />
                        Quality Score
                      </div>
                      <div className={`text-2xl font-bold ${getQualityColor(qualityReport.overallScore)}`}>
                        {qualityReport.overallScore}%
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <CheckCircle className="w-4 h-4" />
                        Completeness
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {qualityReport.completeness}%
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Clock className="w-4 h-4" />
                        Freshness
                      </div>
                      <div className={`text-2xl font-bold ${getFreshnessColor(qualityReport.freshness)}`}>
                        {qualityReport.freshness}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Research Data */}
              {researchData && (
                <div className="space-y-4">
                  {/* AI Analysis */}
                  {researchData.aiAnalysis?.executiveSummary && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-3">AI Analysis</h3>
                      <p className="text-sm text-gray-700">{researchData.aiAnalysis.executiveSummary}</p>

                      {researchData.aiAnalysis.painPoints && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Pain Points</h4>
                          <ul className="space-y-1">
                            {researchData.aiAnalysis.painPoints.map((point: string, idx: number) => (
                              <li key={idx} className="text-sm text-gray-600">• {point}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Funding */}
                  {researchData.funding && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <h3 className="font-semibold text-gray-900">Funding</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Total Raised</div>
                          <div className="font-semibold text-gray-900">
                            ${(researchData.funding.total / 1000000).toFixed(1)}M
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Rounds</div>
                          <div className="font-semibold text-gray-900">{researchData.funding.rounds}</div>
                        </div>
                        <div>
                          <div className="text-gray-600">Last Round</div>
                          <div className="font-semibold text-gray-900">{researchData.funding.lastRound}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent News */}
                  {researchData.news && researchData.news.length > 0 && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">Recent News</h3>
                      </div>
                      <div className="space-y-3">
                        {researchData.news.slice(0, 5).map((article: any, idx: number) => (
                          <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                            <div className="font-medium text-sm text-gray-900">{article.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {article.source} • {new Date(article.publishedAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Buying Signals */}
                  {researchData.signals && researchData.signals.length > 0 && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-purple-600" />
                        <h3 className="font-semibold text-gray-900">Buying Signals</h3>
                      </div>
                      <div className="space-y-2">
                        {researchData.signals.map((signal: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2 rounded ${
                              signal.strength === 'high'
                                ? 'bg-green-50'
                                : signal.strength === 'medium'
                                ? 'bg-yellow-50'
                                : 'bg-gray-50'
                            }`}
                          >
                            <div className="text-sm">
                              <span className="font-medium text-gray-900 capitalize">
                                {signal.type.replace(/_/g, ' ')}:
                              </span>{' '}
                              <span className="text-gray-700">{signal.description}</span>
                            </div>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                signal.strength === 'high'
                                  ? 'bg-green-100 text-green-700'
                                  : signal.strength === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {signal.strength}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations */}
              {qualityReport && qualityReport.recommendations.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">Recommendations</h3>
                  </div>
                  <ul className="space-y-1">
                    {qualityReport.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-yellow-800">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a company to view research</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DollarSign = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
