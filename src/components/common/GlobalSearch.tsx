import { useState, useEffect, useRef } from 'react';
import apiClient from '../../lib/api-client';
import { Search, X, TrendingUp, Users, Target, Mail, Calendar, FileText, MessageSquare, Ticket } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'prospect' | 'deal' | 'cadence' | 'email_campaign' | 'template' | 'ticket' | 'knowledge_article';
  title: string;
  subtitle: string;
  metadata?: string;
  score?: number;
}

interface GlobalSearchProps {
  onSelectResult?: (result: SearchResult) => void;
}

export default function GlobalSearch({ onSelectResult }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [totalResults, setTotalResults] = useState<number>(0);
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
      setSearchTime(0);
      setTotalResults(0);
    }
  }, [query]);

  async function performSearch(searchQuery: string) {
    setLoading(true);
    const startTime = performance.now();

    try {
      const response = await apiClient.search({
        q: searchQuery,
        limit: 20, // Get more results for better UX
      });

      const endTime = performance.now();
      setSearchTime(endTime - startTime);
      setTotalResults(response.total || 0);

      // Transform API results to component format
      const searchResults: SearchResult[] = (response.results || []).map((result: any) => {
        const type = result.type || 'prospect';

        // Format based on type
        let title = '';
        let subtitle = '';
        let metadata = '';

        switch (type) {
          case 'prospect':
            title = result.name || `${result.first_name || ''} ${result.last_name || ''}`.trim() || 'No Name';
            subtitle = result.company || 'No Company';
            metadata = result.title || result.email || '';
            break;

          case 'deal':
            title = result.deal_name || result.name || 'Unnamed Deal';
            subtitle = result.amount ? `$${result.amount.toLocaleString()} • ${result.stage || 'Unknown'}` : result.stage || 'Unknown Stage';
            metadata = result.company_name || '';
            break;

          case 'cadence':
            title = result.name || 'Unnamed Cadence';
            subtitle = result.description || 'No description';
            metadata = result.is_active ? 'Active' : 'Paused';
            break;

          case 'email_campaign':
            title = result.name || 'Unnamed Campaign';
            subtitle = `${result.total_recipients || 0} recipients`;
            metadata = result.status || '';
            break;

          case 'template':
            title = result.name || 'Unnamed Template';
            subtitle = result.type || 'Email Template';
            metadata = result.category || '';
            break;

          case 'ticket':
            title = result.subject || 'No Subject';
            subtitle = `${result.status || 'Unknown'} • Priority: ${result.priority || 'Normal'}`;
            metadata = result.assignee_name || 'Unassigned';
            break;

          case 'knowledge_article':
            title = result.title || 'Untitled Article';
            subtitle = result.summary || result.content?.substring(0, 100) || 'No summary';
            metadata = result.category || '';
            break;

          default:
            title = result.name || result.title || 'Unknown';
            subtitle = '';
        }

        return {
          id: result.id,
          type,
          title,
          subtitle,
          metadata,
          score: result.score,
        };
      });

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTotalResults(0);
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
      case 'email_campaign':
        return <Mail className="w-4 h-4 text-cyan-600" />;
      case 'template':
        return <FileText className="w-4 h-4 text-orange-600" />;
      case 'ticket':
        return <Ticket className="w-4 h-4 text-red-600" />;
      case 'knowledge_article':
        return <MessageSquare className="w-4 h-4 text-indigo-600" />;
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
      case 'email_campaign':
        return 'bg-cyan-100 text-cyan-700';
      case 'template':
        return 'bg-orange-100 text-orange-700';
      case 'ticket':
        return 'bg-red-100 text-red-700';
      case 'knowledge_article':
        return 'bg-indigo-100 text-indigo-700';
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
                placeholder="Search across all your data..."
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
              {totalResults > 0 && (
                <div className="text-xs text-slate-500">
                  <span className="font-medium">{totalResults}</span> results in{' '}
                  <span className="font-medium">{searchTime.toFixed(0)}ms</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
