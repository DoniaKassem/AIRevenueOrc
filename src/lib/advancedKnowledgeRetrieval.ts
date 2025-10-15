import { supabase } from './supabase';

export interface HybridSearchResult {
  text: string;
  source_type: string;
  metadata: any;
  semantic_score: number;
  keyword_score: number;
  combined_score: number;
  rank: number;
}

export interface QueryExpansion {
  original_query: string;
  expanded_queries: string[];
  synonyms: Record<string, string[]>;
  related_terms: string[];
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  source_type: string;
  metadata: any;
  embedding?: number[];
  created_at: string;
  last_accessed?: string;
  access_count: number;
}

export interface ChunkingStrategy {
  method: 'fixed' | 'sentence' | 'paragraph' | 'semantic';
  size: number;
  overlap: number;
  preserve_structure: boolean;
}

export async function hybridSearch(
  companyProfileId: string,
  query: string,
  options: {
    semanticWeight?: number;
    keywordWeight?: number;
    limit?: number;
    minSemanticScore?: number;
    minKeywordScore?: number;
  } = {}
): Promise<HybridSearchResult[]> {
  const {
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    limit = 10,
    minSemanticScore = 0.6,
    minKeywordScore = 0.1,
  } = options;

  try {
    const embeddingResponse = await fetch(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: query,
          model: 'text-embedding-3-small',
        }),
      }
    );

    if (!embeddingResponse.ok) {
      console.error('Failed to generate query embedding');
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    const { data: semanticResults, error: semanticError } = await supabase.rpc(
      'match_knowledge_embeddings',
      {
        query_embedding: queryEmbedding,
        match_threshold: minSemanticScore,
        match_count: limit * 2,
        p_company_profile_id: companyProfileId,
      }
    );

    if (semanticError) {
      console.error('Semantic search error:', semanticError);
      return [];
    }

    const keywords = extractKeywords(query);
    const keywordPattern = keywords.map(k => `%${k}%`).join('|');

    const { data: allChunks, error: keywordError } = await supabase
      .from('knowledge_embeddings')
      .select('*')
      .eq('company_profile_id', companyProfileId)
      .or(keywords.map(k => `text.ilike.%${k}%`).join(','));

    if (keywordError) {
      console.error('Keyword search error:', keywordError);
    }

    const semanticMap = new Map(
      semanticResults?.map((r: any) => [r.text, r.similarity]) || []
    );

    const hybridResults: HybridSearchResult[] = [];
    const processedTexts = new Set<string>();

    semanticResults?.forEach((result: any) => {
      if (processedTexts.has(result.text)) return;
      processedTexts.add(result.text);

      const keywordScore = calculateKeywordScore(result.text, keywords);
      const semanticScore = result.similarity;
      const combinedScore =
        semanticScore * semanticWeight + keywordScore * keywordWeight;

      if (semanticScore >= minSemanticScore || keywordScore >= minKeywordScore) {
        hybridResults.push({
          text: result.text,
          source_type: result.source_type,
          metadata: result.metadata,
          semantic_score: semanticScore,
          keyword_score: keywordScore,
          combined_score: combinedScore,
          rank: 0,
        });
      }
    });

    allChunks?.forEach((chunk: any) => {
      if (processedTexts.has(chunk.text)) return;
      processedTexts.add(chunk.text);

      const keywordScore = calculateKeywordScore(chunk.text, keywords);
      const semanticScore = semanticMap.get(chunk.text) || 0;
      const combinedScore =
        semanticScore * semanticWeight + keywordScore * keywordWeight;

      if (keywordScore >= minKeywordScore) {
        hybridResults.push({
          text: chunk.text,
          source_type: chunk.source_type,
          metadata: chunk.metadata,
          semantic_score: semanticScore,
          keyword_score: keywordScore,
          combined_score: combinedScore,
          rank: 0,
        });
      }
    });

    hybridResults.sort((a, b) => b.combined_score - a.combined_score);
    hybridResults.forEach((result, idx) => {
      result.rank = idx + 1;
    });

    return hybridResults.slice(0, limit);
  } catch (error) {
    console.error('Hybrid search error:', error);
    return [];
  }
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'that', 'this',
    'it', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function calculateKeywordScore(text: string, keywords: string[]): number {
  const textLower = text.toLowerCase();
  let score = 0;
  let matches = 0;

  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const keywordMatches = (textLower.match(regex) || []).length;

    if (keywordMatches > 0) {
      matches++;
      score += Math.min(keywordMatches * 0.1, 0.3);
    }
  });

  const coverageBonus = keywords.length > 0 ? matches / keywords.length : 0;
  score += coverageBonus * 0.3;

  return Math.min(score, 1.0);
}

export async function expandQuery(query: string): Promise<QueryExpansion> {
  const keywords = extractKeywords(query);

  const synonymMap: Record<string, string[]> = {
    product: ['service', 'solution', 'offering', 'platform'],
    customer: ['client', 'user', 'buyer', 'account'],
    price: ['cost', 'pricing', 'rate', 'fee'],
    feature: ['capability', 'functionality', 'function'],
    benefit: ['advantage', 'value', 'gain'],
    company: ['organization', 'business', 'firm', 'enterprise'],
    help: ['assist', 'support', 'aid', 'enable'],
    improve: ['enhance', 'optimize', 'increase', 'boost'],
    problem: ['issue', 'challenge', 'pain point', 'difficulty'],
    solution: ['answer', 'resolution', 'fix', 'remedy'],
  };

  const synonyms: Record<string, string[]> = {};
  const relatedTerms: string[] = [];
  const expandedQueries: string[] = [query];

  keywords.forEach(keyword => {
    if (synonymMap[keyword]) {
      synonyms[keyword] = synonymMap[keyword];
      relatedTerms.push(...synonymMap[keyword]);

      synonymMap[keyword].forEach(synonym => {
        const expandedQuery = query.replace(
          new RegExp(`\\b${keyword}\\b`, 'gi'),
          synonym
        );
        if (!expandedQueries.includes(expandedQuery)) {
          expandedQueries.push(expandedQuery);
        }
      });
    }
  });

  return {
    original_query: query,
    expanded_queries: expandedQueries.slice(0, 5),
    synonyms,
    related_terms: [...new Set(relatedTerms)],
  };
}

export async function rerankResults(
  results: HybridSearchResult[],
  query: string,
  context?: string
): Promise<HybridSearchResult[]> {
  if (results.length === 0) return results;

  const queryKeywords = new Set(extractKeywords(query));
  const contextKeywords = context ? new Set(extractKeywords(context)) : new Set();

  const reranked = results.map(result => {
    let boostedScore = result.combined_score;

    const resultKeywords = extractKeywords(result.text);
    const queryOverlap = resultKeywords.filter(k => queryKeywords.has(k)).length;
    const contextOverlap = resultKeywords.filter(k => contextKeywords.has(k)).length;

    boostedScore += (queryOverlap / Math.max(queryKeywords.size, 1)) * 0.1;
    boostedScore += (contextOverlap / Math.max(contextKeywords.size, 1)) * 0.05;

    if (result.source_type === 'website') {
      boostedScore *= 1.05;
    } else if (result.source_type === 'document') {
      boostedScore *= 1.1;
    }

    const freshnessScore = calculateFreshnessScore(
      result.metadata?.created_at || new Date().toISOString()
    );
    boostedScore += freshnessScore * 0.05;

    return {
      ...result,
      combined_score: Math.min(boostedScore, 1.0),
    };
  });

  reranked.sort((a, b) => b.combined_score - a.combined_score);
  reranked.forEach((result, idx) => {
    result.rank = idx + 1;
  });

  return reranked;
}

function calculateFreshnessScore(createdAt: string): number {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const daysSince = (now - created) / (1000 * 60 * 60 * 24);

  if (daysSince <= 30) return 1.0;
  if (daysSince <= 90) return 0.8;
  if (daysSince <= 180) return 0.6;
  if (daysSince <= 365) return 0.4;
  return 0.2;
}

export async function trackKnowledgeFreshness(
  companyProfileId: string
): Promise<{
  total_chunks: number;
  fresh_chunks: number;
  stale_chunks: number;
  avg_age_days: number;
  oldest_chunk_date: string;
  recommendations: string[];
}> {
  try {
    const { data: chunks, error } = await supabase
      .from('knowledge_embeddings')
      .select('created_at')
      .eq('company_profile_id', companyProfileId);

    if (error || !chunks) {
      return {
        total_chunks: 0,
        fresh_chunks: 0,
        stale_chunks: 0,
        avg_age_days: 0,
        oldest_chunk_date: '',
        recommendations: [],
      };
    }

    const now = Date.now();
    let totalAgeDays = 0;
    let freshCount = 0;
    let staleCount = 0;
    let oldestDate = now;

    chunks.forEach(chunk => {
      const created = new Date(chunk.created_at).getTime();
      const ageDays = (now - created) / (1000 * 60 * 60 * 24);
      totalAgeDays += ageDays;

      if (ageDays <= 90) freshCount++;
      else staleCount++;

      if (created < oldestDate) oldestDate = created;
    });

    const avgAgeDays = chunks.length > 0 ? totalAgeDays / chunks.length : 0;
    const recommendations: string[] = [];

    if (staleCount > chunks.length * 0.3) {
      recommendations.push('30%+ of knowledge is over 90 days old - consider refreshing');
    }

    if (avgAgeDays > 180) {
      recommendations.push('Average knowledge age exceeds 6 months - re-crawl websites');
    }

    if (chunks.length < 50) {
      recommendations.push('Low knowledge volume - add more sources for better AI responses');
    }

    return {
      total_chunks: chunks.length,
      fresh_chunks: freshCount,
      stale_chunks: staleCount,
      avg_age_days: Math.round(avgAgeDays),
      oldest_chunk_date: new Date(oldestDate).toISOString(),
      recommendations,
    };
  } catch (error) {
    console.error('Error tracking freshness:', error);
    return {
      total_chunks: 0,
      fresh_chunks: 0,
      stale_chunks: 0,
      avg_age_days: 0,
      oldest_chunk_date: '',
      recommendations: [],
    };
  }
}

export function smartChunking(
  text: string,
  strategy: ChunkingStrategy
): string[] {
  const chunks: string[] = [];

  switch (strategy.method) {
    case 'fixed':
      return fixedSizeChunking(text, strategy.size, strategy.overlap);

    case 'sentence':
      return sentenceBasedChunking(text, strategy.size);

    case 'paragraph':
      return paragraphBasedChunking(text, strategy.size);

    case 'semantic':
      return semanticChunking(text, strategy.size);

    default:
      return fixedSizeChunking(text, strategy.size, strategy.overlap);
  }
}

function fixedSizeChunking(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.substring(start, end));
    start += size - overlap;
  }

  return chunks;
}

function sentenceBasedChunking(text: string, targetSize: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  sentences.forEach(sentence => {
    if (currentChunk.length + sentence.length <= targetSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  });

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function paragraphBasedChunking(text: string, targetSize: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  paragraphs.forEach(para => {
    if (currentChunk.length + para.length <= targetSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    }
  });

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function semanticChunking(text: string, targetSize: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';
  let lastTopic = '';

  paragraphs.forEach(para => {
    const topic = extractTopicSignal(para);

    const topicChanged = lastTopic && topic !== lastTopic;
    const sizeLimitReached = currentChunk.length + para.length > targetSize;

    if ((topicChanged || sizeLimitReached) && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }

    lastTopic = topic;
  });

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function extractTopicSignal(text: string): string {
  const headingMatch = text.match(/^#+\s+(.+)/m);
  if (headingMatch) return headingMatch[1].toLowerCase();

  const keywords = extractKeywords(text.substring(0, 200));
  return keywords.slice(0, 3).join(' ');
}

export function scoreKnowledgeQuality(chunk: KnowledgeChunk): {
  quality_score: number;
  factors: {
    completeness: number;
    clarity: number;
    relevance: number;
    freshness: number;
  };
  issues: string[];
} {
  const issues: string[] = [];
  const factors = {
    completeness: 0,
    clarity: 0,
    relevance: 0,
    freshness: 0,
  };

  if (chunk.text.length < 50) {
    issues.push('Text too short for meaningful context');
    factors.completeness = 0.3;
  } else if (chunk.text.length < 200) {
    factors.completeness = 0.6;
  } else if (chunk.text.length > 2000) {
    issues.push('Text very long - consider splitting');
    factors.completeness = 0.8;
  } else {
    factors.completeness = 1.0;
  }

  const sentences = (chunk.text.match(/[.!?]+/g) || []).length;
  const words = chunk.text.split(/\s+/).length;
  const avgWordsPerSentence = sentences > 0 ? words / sentences : words;

  if (avgWordsPerSentence < 5) {
    issues.push('Very short sentences - may lack detail');
    factors.clarity = 0.6;
  } else if (avgWordsPerSentence > 40) {
    issues.push('Very long sentences - may be unclear');
    factors.clarity = 0.7;
  } else {
    factors.clarity = 1.0;
  }

  const hasQuestionMarks = (chunk.text.match(/\?/g) || []).length > 0;
  const hasColons = (chunk.text.match(/:/g) || []).length > 0;
  const hasNumbers = (chunk.text.match(/\d+/g) || []).length > 0;

  let relevanceScore = 0.5;
  if (hasQuestionMarks || hasColons) relevanceScore += 0.2;
  if (hasNumbers) relevanceScore += 0.3;
  factors.relevance = Math.min(relevanceScore, 1.0);

  factors.freshness = calculateFreshnessScore(chunk.created_at);

  const qualityScore = (
    factors.completeness * 0.3 +
    factors.clarity * 0.2 +
    factors.relevance * 0.3 +
    factors.freshness * 0.2
  );

  return {
    quality_score: Math.round(qualityScore * 100) / 100,
    factors,
    issues,
  };
}
