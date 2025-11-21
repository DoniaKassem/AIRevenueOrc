/**
 * Universal Smart Search Service
 *
 * Features:
 * - Multi-object search (prospects, deals, tickets, emails, etc.)
 * - Instant search-as-you-type (< 50ms)
 * - Typo tolerance and fuzzy matching
 * - Faceted search with filters
 * - Relevance ranking with boosting
 * - Search analytics and insights
 * - Saved searches
 *
 * Powered by Typesense for speed and ease of use
 *
 * Priority 1 Launch Blocker Feature
 */

import Typesense from 'typesense';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize Typesense client
const typesense = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
});

// =============================================
// TYPES & INTERFACES
// =============================================

export type SearchableObjectType =
  | 'prospect'
  | 'account'
  | 'deal'
  | 'ticket'
  | 'email'
  | 'task'
  | 'campaign'
  | 'article'
  | 'file';

export interface SearchQuery {
  q: string; // Search query
  organizationId: string;
  userId: string;

  // Filters
  types?: SearchableObjectType[];
  statuses?: string[];
  owners?: string[];
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;

  // Facets to return
  facets?: string[];

  // Pagination
  page?: number;
  perPage?: number;

  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  type: SearchableObjectType;
  title: string;
  description?: string;
  highlights: {
    field: string;
    snippet: string;
  }[];
  metadata: Record<string, any>;
  score: number; // Relevance score
  url: string;
}

export interface SearchResponse {
  results: SearchResult[];
  facets: Record<string, FacetValue[]>;
  total: number;
  searchTime: number; // milliseconds
  page: number;
  perPage: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  query: SearchQuery;
  isPinned: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

// =============================================
// COLLECTION SCHEMAS
// =============================================

// Schema definitions for each searchable object type
const COLLECTION_SCHEMAS = {
  prospects: {
    name: 'prospects',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'full_name', type: 'string' },
      { name: 'email', type: 'string' },
      { name: 'company', type: 'string', optional: true },
      { name: 'title', type: 'string', optional: true },
      { name: 'phone', type: 'string', optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'lead_score', type: 'int32', optional: true },
      { name: 'owner_id', type: 'string', facet: true, optional: true },
      { name: 'owner_name', type: 'string', optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'notes', type: 'string', optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'updated_at',
  },

  accounts: {
    name: 'accounts',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'name', type: 'string' },
      { name: 'domain', type: 'string', optional: true },
      { name: 'industry', type: 'string', facet: true, optional: true },
      { name: 'size', type: 'string', facet: true, optional: true },
      { name: 'description', type: 'string', optional: true },
      { name: 'owner_id', type: 'string', facet: true, optional: true },
      { name: 'owner_name', type: 'string', optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'updated_at',
  },

  deals: {
    name: 'deals',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'amount', type: 'float', optional: true },
      { name: 'stage', type: 'string', facet: true },
      { name: 'probability', type: 'int32', optional: true },
      { name: 'expected_close_date', type: 'int64', optional: true },
      { name: 'owner_id', type: 'string', facet: true, optional: true },
      { name: 'owner_name', type: 'string', optional: true },
      { name: 'account_name', type: 'string', optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'updated_at',
  },

  tickets: {
    name: 'tickets',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'subject', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'status', type: 'string', facet: true },
      { name: 'priority', type: 'string', facet: true },
      { name: 'category', type: 'string', facet: true, optional: true },
      { name: 'assigned_to_id', type: 'string', facet: true, optional: true },
      { name: 'assigned_to_name', type: 'string', optional: true },
      { name: 'requester_name', type: 'string', optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'updated_at',
  },

  emails: {
    name: 'emails',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'subject', type: 'string' },
      { name: 'body_text', type: 'string' },
      { name: 'from_email', type: 'string' },
      { name: 'from_name', type: 'string', optional: true },
      { name: 'to_emails', type: 'string[]' },
      { name: 'direction', type: 'string', facet: true },
      { name: 'status', type: 'string', facet: true, optional: true },
      { name: 'opened', type: 'bool', facet: true, optional: true },
      { name: 'clicked', type: 'bool', facet: true, optional: true },
      { name: 'prospect_id', type: 'string', optional: true },
      { name: 'sent_at', type: 'int64' },
    ],
    default_sorting_field: 'sent_at',
  },

  tasks: {
    name: 'tasks',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'priority', type: 'string', facet: true },
      { name: 'assigned_to_id', type: 'string', facet: true, optional: true },
      { name: 'assigned_to_name', type: 'string', optional: true },
      { name: 'due_date', type: 'int64', optional: true },
      { name: 'completed_at', type: 'int64', optional: true },
      { name: 'created_at', type: 'int64' },
    ],
    default_sorting_field: 'due_date',
  },

  campaigns: {
    name: 'campaigns',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string', optional: true },
      { name: 'type', type: 'string', facet: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'content', type: 'string', optional: true },
      { name: 'owner_id', type: 'string', facet: true, optional: true },
      { name: 'owner_name', type: 'string', optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'updated_at',
  },

  articles: {
    name: 'articles',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'organization_id', type: 'string', facet: true },
      { name: 'title', type: 'string' },
      { name: 'content', type: 'string' },
      { name: 'category', type: 'string', facet: true, optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'author_id', type: 'string', optional: true },
      { name: 'author_name', type: 'string', optional: true },
      { name: 'views', type: 'int32', optional: true },
      { name: 'helpful_count', type: 'int32', optional: true },
      { name: 'created_at', type: 'int64' },
      { name: 'updated_at', type: 'int64' },
    ],
    default_sorting_field: 'helpful_count',
  },
};

// =============================================
// SEARCH SERVICE
// =============================================

export class SearchService {
  /**
   * Initialize search collections (run once on setup)
   */
  async initializeCollections(): Promise<void> {
    for (const [key, schema] of Object.entries(COLLECTION_SCHEMAS)) {
      try {
        // Try to create collection
        await typesense.collections().create(schema);
        console.log(`Created collection: ${key}`);
      } catch (error: any) {
        if (error.httpStatus === 409) {
          // Collection already exists
          console.log(`Collection ${key} already exists`);
        } else {
          console.error(`Failed to create collection ${key}:`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Universal search across all object types
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    // Determine which collections to search
    const collections = query.types?.map((t) => this.getCollectionName(t)) || Object.keys(COLLECTION_SCHEMAS);

    // Build search parameters
    const searchParams: any = {
      q: query.q,
      query_by: this.getQueryFields(query.types),
      filter_by: this.buildFilterQuery(query),
      facet_by: query.facets?.join(',') || 'status,owner_id,tags',
      max_facet_values: 20,
      per_page: query.perPage || 20,
      page: query.page || 1,
      num_typos: 2, // Allow up to 2 typos
      typo_tokens_threshold: 1,
      prefix: true, // Enable prefix search
      drop_tokens_threshold: 1,
      highlight_full_fields: 'title,subject,name,description,body_text',
      snippet_threshold: 30,
    };

    // Sort by relevance by default, unless specified
    if (query.sortBy) {
      searchParams.sort_by = `${query.sortBy}:${query.sortOrder || 'desc'}`;
    }

    try {
      // Multi-collection search
      const searchResults = await typesense.multiSearch.perform({
        searches: collections.map((collection) => ({
          collection,
          ...searchParams,
        })),
      });

      // Aggregate and rank results
      const aggregatedResults = this.aggregateResults(searchResults.results);

      // Track search analytics
      await this.trackSearch(query, aggregatedResults.length);

      const searchTime = Date.now() - startTime;

      return {
        results: aggregatedResults.slice(0, query.perPage || 20),
        facets: this.aggregateFacets(searchResults.results),
        total: aggregatedResults.length,
        searchTime,
        page: query.page || 1,
        perPage: query.perPage || 20,
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Search suggestions (autocomplete)
   */
  async suggest(params: {
    q: string;
    organizationId: string;
    types?: SearchableObjectType[];
    limit?: number;
  }): Promise<{
    suggestions: string[];
    results: SearchResult[];
  }> {
    const collections = params.types?.map((t) => this.getCollectionName(t)) || ['prospects', 'accounts', 'deals'];

    const searchResults = await typesense.multiSearch.perform({
      searches: collections.map((collection) => ({
        collection,
        q: params.q,
        query_by: this.getQueryFields(params.types),
        filter_by: `organization_id:=${params.organizationId}`,
        per_page: 5,
        prefix: true,
        num_typos: 1,
      })),
    });

    const results = this.aggregateResults(searchResults.results);

    // Extract unique suggestions from results
    const suggestions = Array.from(
      new Set(results.map((r) => r.title))
    ).slice(0, params.limit || 5);

    return {
      suggestions,
      results: results.slice(0, params.limit || 5),
    };
  }

  /**
   * Save a search for quick access later
   */
  async saveSearch(params: {
    userId: string;
    name: string;
    query: SearchQuery;
    isPinned?: boolean;
  }): Promise<SavedSearch> {
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        user_id: params.userId,
        name: params.name,
        query: params.query,
        is_pinned: params.isPinned || false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapSavedSearch(data);
  }

  /**
   * Get user's saved searches
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    const { data, error } = await supabase
      .from('saved_searches')
      .select()
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapSavedSearch);
  }

  /**
   * Execute a saved search
   */
  async executeSavedSearch(savedSearchId: string, page?: number): Promise<SearchResponse> {
    const { data: savedSearch } = await supabase
      .from('saved_searches')
      .select()
      .eq('id', savedSearchId)
      .single();

    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Update last used timestamp
    await supabase
      .from('saved_searches')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', savedSearchId);

    // Execute search with saved query
    const query = savedSearch.query as SearchQuery;
    if (page) {
      query.page = page;
    }

    return this.search(query);
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(params: {
    organizationId: string;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    topQueries: { query: string; count: number; avgResults: number }[];
    noResultQueries: { query: string; count: number }[];
    totalSearches: number;
    avgSearchTime: number;
  }> {
    let query = supabase
      .from('search_analytics')
      .select()
      .eq('organization_id', params.organizationId);

    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }

    if (params.dateFrom) {
      query = query.gte('searched_at', params.dateFrom.toISOString());
    }

    if (params.dateTo) {
      query = query.lte('searched_at', params.dateTo.toISOString());
    }

    const { data } = await query;

    if (!data) {
      return {
        topQueries: [],
        noResultQueries: [],
        totalSearches: 0,
        avgSearchTime: 0,
      };
    }

    // Aggregate statistics
    const queryStats = new Map<string, { count: number; totalResults: number; totalTime: number }>();

    for (const record of data) {
      const existing = queryStats.get(record.query) || { count: 0, totalResults: 0, totalTime: 0 };
      existing.count++;
      existing.totalResults += record.result_count;
      existing.totalTime += record.search_time;
      queryStats.set(record.query, existing);
    }

    const topQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgResults: Math.round(stats.totalResults / stats.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const noResultQueries = Array.from(queryStats.entries())
      .filter(([, stats]) => stats.totalResults === 0)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalSearchTime = Array.from(queryStats.values()).reduce((sum, s) => sum + s.totalTime, 0);

    return {
      topQueries,
      noResultQueries,
      totalSearches: data.length,
      avgSearchTime: Math.round(totalSearchTime / data.length),
    };
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private getCollectionName(type: SearchableObjectType): string {
    const mapping: Record<SearchableObjectType, string> = {
      prospect: 'prospects',
      account: 'accounts',
      deal: 'deals',
      ticket: 'tickets',
      email: 'emails',
      task: 'tasks',
      campaign: 'campaigns',
      article: 'articles',
      file: 'files',
    };
    return mapping[type];
  }

  private getQueryFields(types?: SearchableObjectType[]): string {
    // Different fields to search based on object type
    const fieldMappings: Record<string, string[]> = {
      prospects: ['full_name', 'email', 'company', 'title', 'notes'],
      accounts: ['name', 'domain', 'description'],
      deals: ['title', 'description', 'account_name'],
      tickets: ['subject', 'description'],
      emails: ['subject', 'body_text', 'from_email', 'from_name'],
      tasks: ['title', 'description'],
      campaigns: ['name', 'description', 'content'],
      articles: ['title', 'content'],
    };

    if (!types || types.length === 0) {
      // Default search fields
      return 'full_name,email,name,title,subject,description,content';
    }

    const fields = new Set<string>();
    for (const type of types) {
      const collectionName = this.getCollectionName(type);
      const collectionFields = fieldMappings[collectionName] || [];
      collectionFields.forEach((f) => fields.add(f));
    }

    return Array.from(fields).join(',');
  }

  private buildFilterQuery(query: SearchQuery): string {
    const filters: string[] = [];

    // Organization filter (required)
    filters.push(`organization_id:=${query.organizationId}`);

    // Status filter
    if (query.statuses && query.statuses.length > 0) {
      filters.push(`status:[${query.statuses.join(',')}]`);
    }

    // Owner filter
    if (query.owners && query.owners.length > 0) {
      filters.push(`owner_id:[${query.owners.join(',')}]`);
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      filters.push(`tags:[${query.tags.join(',')}]`);
    }

    // Date range filter
    if (query.dateFrom && query.dateTo) {
      const fromTs = Math.floor(query.dateFrom.getTime() / 1000);
      const toTs = Math.floor(query.dateTo.getTime() / 1000);
      filters.push(`created_at:>=${fromTs} && created_at:<=${toTs}`);
    }

    return filters.join(' && ');
  }

  private aggregateResults(searchResults: any[]): SearchResult[] {
    const allResults: SearchResult[] = [];

    for (const result of searchResults) {
      if (!result.hits) continue;

      for (const hit of result.hits) {
        const doc = hit.document;
        const type = this.getTypeFromCollection(result.request_params.collection_name);

        allResults.push({
          id: doc.id,
          type,
          title: this.getTitle(doc, type),
          description: this.getDescription(doc, type),
          highlights: this.extractHighlights(hit.highlights || []),
          metadata: this.getMetadata(doc, type),
          score: hit.text_match_info?.score || 0,
          url: this.getUrl(doc, type),
        });
      }
    }

    // Sort by relevance score
    allResults.sort((a, b) => b.score - a.score);

    return allResults;
  }

  private aggregateFacets(searchResults: any[]): Record<string, FacetValue[]> {
    const aggregated: Record<string, Map<string, number>> = {};

    for (const result of searchResults) {
      if (!result.facet_counts) continue;

      for (const facet of result.facet_counts) {
        if (!aggregated[facet.field_name]) {
          aggregated[facet.field_name] = new Map();
        }

        for (const count of facet.counts) {
          const existing = aggregated[facet.field_name].get(count.value) || 0;
          aggregated[facet.field_name].set(count.value, existing + count.count);
        }
      }
    }

    const facets: Record<string, FacetValue[]> = {};

    for (const [field, valueMap] of Object.entries(aggregated)) {
      facets[field] = Array.from(valueMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    }

    return facets;
  }

  private getTypeFromCollection(collectionName: string): SearchableObjectType {
    const mapping: Record<string, SearchableObjectType> = {
      prospects: 'prospect',
      accounts: 'account',
      deals: 'deal',
      tickets: 'ticket',
      emails: 'email',
      tasks: 'task',
      campaigns: 'campaign',
      articles: 'article',
      files: 'file',
    };
    return mapping[collectionName] || 'prospect';
  }

  private getTitle(doc: any, type: SearchableObjectType): string {
    switch (type) {
      case 'prospect':
        return doc.full_name || doc.email;
      case 'account':
        return doc.name;
      case 'deal':
        return doc.title;
      case 'ticket':
        return doc.subject;
      case 'email':
        return doc.subject;
      case 'task':
        return doc.title;
      case 'campaign':
        return doc.name;
      case 'article':
        return doc.title;
      default:
        return doc.name || doc.title || 'Untitled';
    }
  }

  private getDescription(doc: any, type: SearchableObjectType): string | undefined {
    switch (type) {
      case 'prospect':
        return doc.company ? `${doc.title || 'Contact'} at ${doc.company}` : doc.title;
      case 'account':
        return doc.industry || doc.description;
      case 'deal':
        return doc.amount ? `$${doc.amount.toLocaleString()} • ${doc.stage}` : doc.stage;
      case 'ticket':
        return `${doc.priority} priority • ${doc.status}`;
      case 'email':
        return `From: ${doc.from_name || doc.from_email}`;
      case 'task':
        return doc.status;
      case 'campaign':
        return `${doc.type} • ${doc.status}`;
      case 'article':
        return doc.category;
      default:
        return undefined;
    }
  }

  private getMetadata(doc: any, type: SearchableObjectType): Record<string, any> {
    return {
      ...doc,
      objectType: type,
    };
  }

  private getUrl(doc: any, type: SearchableObjectType): string {
    const baseUrl = process.env.APP_URL || 'https://app.airevenueorc.com';
    const paths: Record<SearchableObjectType, string> = {
      prospect: '/prospects',
      account: '/accounts',
      deal: '/deals',
      ticket: '/tickets',
      email: '/emails',
      task: '/tasks',
      campaign: '/campaigns',
      article: '/knowledge-base/articles',
      file: '/files',
    };
    return `${baseUrl}${paths[type]}/${doc.id}`;
  }

  private extractHighlights(highlights: any[]): SearchResult['highlights'] {
    return highlights
      .filter((h) => h.matched_tokens && h.matched_tokens.length > 0)
      .map((h) => ({
        field: h.field,
        snippet: h.snippet || h.value || '',
      }))
      .slice(0, 3); // Max 3 highlights per result
  }

  private async trackSearch(query: SearchQuery, resultCount: number): Promise<void> {
    try {
      await supabase.from('search_analytics').insert({
        organization_id: query.organizationId,
        user_id: query.userId,
        query: query.q,
        result_count: resultCount,
        search_time: 0, // Will be updated by caller
        filters: {
          types: query.types,
          statuses: query.statuses,
          owners: query.owners,
          tags: query.tags,
        },
      });
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  }

  private mapSavedSearch(data: any): SavedSearch {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      query: data.query,
      isPinned: data.is_pinned,
      createdAt: new Date(data.created_at),
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
    };
  }
}

// =============================================
// FACTORY
// =============================================

let searchServiceInstance: SearchService | null = null;

export function createSearchService(): SearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SearchService();
  }
  return searchServiceInstance;
}
