import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, X, TrendingUp, Users, Target, Mail, Calendar } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'prospect' | 'deal' | 'cadence';
  title: string;
  subtitle: string;
  metadata?: string;
}

interface GlobalSearchProps {
  onSelectResult?: (result: SearchResult) => void;
}

export default function GlobalSearch({ onSelectResult }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (query.length >= 2) {
      performSearch(query);
    } else {
      setResults([]);
    }
  }, [query]);

  async function performSearch(searchQuery: string) {
    setLoading(true);
    try {
      const searchTerm = searchQuery.toLowerCase();

      const [prospectsData, dealsData, cadencesData] = await Promise.all([
        supabase
          .from('prospects')
          .select('*')
          .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
          .limit(5),
        supabase
          .from('deals')
          .select('*')
          .or(`deal_name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`)
          .limit(5),
        supabase
          .from('cadences')
          .select('*')
          .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .limit(5),
      ]);

      const searchResults: SearchResult[] = [];

      (prospectsData.data || []).forEach((prospect) => {
        searchResults.push({
          id: prospect.id,
          type: 'prospect',
          title: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'No Name',
          subtitle: prospect.company || 'No Company',
          metadata: prospect.title || prospect.email || '',
        });
      });

      (dealsData.data || []).forEach((deal) => {
        searchResults.push({
          id: deal.id,
          type: 'deal',
          title: deal.deal_name || 'Unnamed Deal',
          subtitle: `$${deal.amount.toLocaleString()} • ${deal.stage}`,
          metadata: deal.company_name || '',
        });
      });

      (cadencesData.data || []).forEach((cadence) => {
        searchResults.push({
          id: cadence.id,
          type: 'cadence',
          title: cadence.name,
          subtitle: cadence.description || 'No description',
          metadata: cadence.is_active ? 'Active' : 'Paused',
        });
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectResult(result: SearchResult) {
    if (onSelectResult) {
      onSelectResult(result);
    }
    setIsOpen(false);
    setQuery('');
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'prospect':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'deal':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'cadence':
        return <Target className="w-4 h-4 text-purple-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'prospect':
        return 'bg-blue-100 text-blue-700';
      case 'deal':
        return 'bg-green-100 text-green-700';
      case 'cadence':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition text-slate-600"
      >
        <Search className="w-4 h-4" />
        <span className="text-sm">Search...</span>
        <kbd className="px-2 py-0.5 text-xs bg-slate-100 border border-slate-300 rounded">
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
          <div
            ref={containerRef}
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
          >
            <div className="flex items-center space-x-3 p-4 border-b border-slate-200">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prospects, deals, cadences..."
                className="flex-1 text-lg outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 hover:bg-slate-100 rounded transition"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-600">Searching...</p>
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  {results.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelectResult(result)}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                    >
                      <div className="bg-slate-100 p-2 rounded-lg">
                        {getIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {result.title}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(
                              result.type
                            )}`}
                          >
                            {result.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">{result.subtitle}</p>
                        {result.metadata && (
                          <p className="text-xs text-slate-500 truncate">{result.metadata}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : query.length >= 2 ? (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-900 mb-1">No results found</p>
                  <p className="text-xs text-slate-600">
                    Try searching for a different term
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-900 mb-1">
                    Start typing to search
                  </p>
                  <p className="text-xs text-slate-600">
                    Search across prospects, deals, and cadences
                  </p>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">
                    ↑↓
                  </kbd>{' '}
                  Navigate
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">
                    ↵
                  </kbd>{' '}
                  Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs">
                    esc
                  </kbd>{' '}
                  Close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
