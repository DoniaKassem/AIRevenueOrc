import { useEffect, useState } from 'react';
import { Target, TrendingUp, Users, Filter, Search } from 'lucide-react';
import { LookAlikeScore, buildICPFromWonDeals, findLookAlikeProspects } from '../../lib/lookAlikeScoring';

export default function LookAlikeProspectsView() {
  const [prospects, setProspects] = useState<LookAlikeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'excellent' | 'good' | 'fair'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLookAlikeProspects();
  }, []);

  async function loadLookAlikeProspects() {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // Empty prospects - will be populated when real prospect data is analyzed
      // Look-alike scoring requires won deals to build an ICP (Ideal Customer Profile)
      const emptyProspects: LookAlikeScore[] = [];

      setProspects(emptyProspects);
    } finally {
      setLoading(false);
    }
  }

  const filteredProspects = prospects.filter(p => {
    const matchesFilter = filter === 'all' || p.fit_rating === filter;
    const matchesSearch = searchTerm === '' ||
      p.match_reasons.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getFitColor = (rating: LookAlikeScore['fit_rating']) => {
    switch (rating) {
      case 'excellent':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'good':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'fair':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'poor':
        return 'border-slate-500 bg-slate-50 dark:bg-slate-900/20';
    }
  };

  const getFitBadge = (rating: LookAlikeScore['fit_rating']) => {
    switch (rating) {
      case 'excellent':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'good':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'fair':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'poor':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
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
            Look-Alike Prospects
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-powered prospect matching based on your best customers
          </p>
        </div>
        <button
          onClick={loadLookAlikeProspects}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          Refresh Analysis
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Excellent Fit</div>
            <Target className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {prospects.filter(p => p.fit_rating === 'excellent').length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Score 75+
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Good Fit</div>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {prospects.filter(p => p.fit_rating === 'good').length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Score 55-74
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Prospects</div>
            <Users className="w-5 h-5 text-slate-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {prospects.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Analyzed & scored
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by match reasons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            {(['all', 'excellent', 'good', 'fair'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  filter === level
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredProspects.map(prospect => (
          <div
            key={prospect.prospect_id}
            className={`border-l-4 rounded-lg p-6 ${getFitColor(prospect.fit_rating)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Prospect #{prospect.prospect_id}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getFitBadge(prospect.fit_rating)}`}>
                    {prospect.fit_rating.toUpperCase()} FIT
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  {prospect.similarity_score}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Similarity Score</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Match Reasons:
              </h4>
              <div className="space-y-1">
                {prospect.match_reasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start text-sm">
                    <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
                    <span className="text-slate-700 dark:text-slate-300">{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                Recommended Actions:
              </h4>
              <ul className="space-y-1">
                {prospect.recommended_actions.map((action, idx) => (
                  <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start">
                    <span className="mr-2">{idx + 1}.</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                Add to Cadence
              </button>
              <button className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                View Full Profile
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProspects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No matching prospects
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Try adjusting your filters or search criteria
          </p>
        </div>
      )}
    </div>
  );
}
