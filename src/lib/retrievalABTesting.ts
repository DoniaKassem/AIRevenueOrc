export interface RetrievalExperiment {
  id: string;
  name: string;
  description: string;
  variants: RetrievalVariant[];
  traffic_split: number[];
  start_date: string;
  end_date?: string;
  status: 'draft' | 'running' | 'completed';
  metrics: ExperimentMetrics;
}

export interface RetrievalVariant {
  id: string;
  name: string;
  config: RetrievalConfig;
  performance: VariantPerformance;
}

export interface RetrievalConfig {
  method: 'semantic' | 'keyword' | 'hybrid';
  semantic_weight?: number;
  keyword_weight?: number;
  reranking_enabled: boolean;
  query_expansion_enabled: boolean;
  graph_expansion_enabled: boolean;
  min_similarity_threshold: number;
  max_results: number;
}

export interface VariantPerformance {
  impressions: number;
  clicks: number;
  avg_relevance_score: number;
  avg_response_time_ms: number;
  user_satisfaction: number;
}

export interface ExperimentMetrics {
  total_queries: number;
  avg_results_per_query: number;
  winner?: string;
  confidence_level?: number;
}

export interface ABTestResult {
  variant_id: string;
  query: string;
  results_count: number;
  response_time_ms: number;
  user_clicked: boolean;
  clicked_rank?: number;
  relevance_score?: number;
  timestamp: string;
}

export function createExperiment(
  name: string,
  description: string,
  variants: Array<{ name: string; config: RetrievalConfig }>
): RetrievalExperiment {
  const variantObjects: RetrievalVariant[] = variants.map((v, idx) => ({
    id: `variant-${idx}`,
    name: v.name,
    config: v.config,
    performance: {
      impressions: 0,
      clicks: 0,
      avg_relevance_score: 0,
      avg_response_time_ms: 0,
      user_satisfaction: 0,
    },
  }));

  const trafficSplit = variants.map(() => 1 / variants.length);

  return {
    id: `exp-${Date.now()}`,
    name,
    description,
    variants: variantObjects,
    traffic_split: trafficSplit,
    start_date: new Date().toISOString(),
    status: 'running',
    metrics: {
      total_queries: 0,
      avg_results_per_query: 0,
    },
  };
}

export function selectVariant(experiment: RetrievalExperiment): RetrievalVariant {
  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < experiment.variants.length; i++) {
    cumulative += experiment.traffic_split[i];
    if (random <= cumulative) {
      return experiment.variants[i];
    }
  }

  return experiment.variants[0];
}

export function recordTestResult(
  experiment: RetrievalExperiment,
  result: ABTestResult
): void {
  const variant = experiment.variants.find(v => v.id === result.variant_id);
  if (!variant) return;

  variant.performance.impressions++;

  if (result.user_clicked) {
    variant.performance.clicks++;
  }

  if (result.relevance_score) {
    const currentAvg = variant.performance.avg_relevance_score;
    const count = variant.performance.impressions;
    variant.performance.avg_relevance_score =
      (currentAvg * (count - 1) + result.relevance_score) / count;
  }

  const currentResponseAvg = variant.performance.avg_response_time_ms;
  const count = variant.performance.impressions;
  variant.performance.avg_response_time_ms =
    (currentResponseAvg * (count - 1) + result.response_time_ms) / count;

  experiment.metrics.total_queries++;
}

export function calculateClickThroughRate(variant: RetrievalVariant): number {
  if (variant.performance.impressions === 0) return 0;
  return variant.performance.clicks / variant.performance.impressions;
}

export function calculateMeanReciprocalRank(
  results: ABTestResult[],
  variantId: string
): number {
  const variantResults = results.filter(
    r => r.variant_id === variantId && r.user_clicked && r.clicked_rank
  );

  if (variantResults.length === 0) return 0;

  const mrr =
    variantResults.reduce((sum, r) => sum + 1 / (r.clicked_rank || 1), 0) /
    variantResults.length;

  return mrr;
}

export function analyzeExperiment(
  experiment: RetrievalExperiment,
  allResults: ABTestResult[]
): {
  winner: RetrievalVariant | null;
  confidence: number;
  metrics_comparison: Array<{
    variant_name: string;
    ctr: number;
    mrr: number;
    avg_response_time: number;
    avg_relevance: number;
  }>;
  recommendation: string;
} {
  const metricsComparison = experiment.variants.map(variant => {
    const ctr = calculateClickThroughRate(variant);
    const mrr = calculateMeanReciprocalRank(allResults, variant.id);

    return {
      variant_name: variant.name,
      ctr,
      mrr,
      avg_response_time: variant.performance.avg_response_time_ms,
      avg_relevance: variant.performance.avg_relevance_score,
    };
  });

  const scores = experiment.variants.map((variant, idx) => {
    const metrics = metricsComparison[idx];

    const ctrScore = metrics.ctr * 0.35;
    const mrrScore = metrics.mrr * 0.35;
    const relevanceScore = metrics.avg_relevance * 0.2;
    const speedScore = Math.max(0, 1 - metrics.avg_response_time / 1000) * 0.1;

    return {
      variant,
      total_score: ctrScore + mrrScore + relevanceScore + speedScore,
    };
  });

  scores.sort((a, b) => b.total_score - a.total_score);

  const winner = scores[0].variant;
  const runnerUp = scores[1]?.variant;

  let confidence = 0;
  if (winner.performance.impressions >= 100) {
    const scoreDiff = scores[0].total_score - (scores[1]?.total_score || 0);
    confidence = Math.min(scoreDiff * 100, 99);
  }

  let recommendation = '';
  if (confidence >= 95) {
    recommendation = `${winner.name} is the clear winner with ${confidence.toFixed(1)}% confidence. Consider rolling out to 100% traffic.`;
  } else if (confidence >= 80) {
    recommendation = `${winner.name} is performing better but needs more data for statistical significance.`;
  } else {
    recommendation = 'Continue the experiment - not enough data to declare a winner yet.';
  }

  return {
    winner: confidence >= 80 ? winner : null,
    confidence,
    metrics_comparison: metricsComparison,
    recommendation,
  };
}

export function generateOptimalConfig(
  experimentResults: Array<{
    config: RetrievalConfig;
    performance: VariantPerformance;
  }>
): RetrievalConfig {
  const bestPerforming = experimentResults.sort(
    (a, b) =>
      calculateClickThroughRate({ id: '', name: '', config: b.config, performance: b.performance }) -
      calculateClickThroughRate({ id: '', name: '', config: a.config, performance: a.performance })
  )[0];

  return bestPerforming.config;
}

export const PRESET_EXPERIMENTS = {
  semantic_vs_hybrid: {
    name: 'Semantic vs Hybrid Search',
    description: 'Compare pure semantic search against hybrid approach',
    variants: [
      {
        name: 'Semantic Only',
        config: {
          method: 'semantic' as const,
          reranking_enabled: false,
          query_expansion_enabled: false,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
      {
        name: 'Hybrid Search',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: false,
          query_expansion_enabled: false,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.6,
          max_results: 5,
        },
      },
    ],
  },
  reranking_impact: {
    name: 'Reranking Impact',
    description: 'Test if reranking improves relevance',
    variants: [
      {
        name: 'No Reranking',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: false,
          query_expansion_enabled: false,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
      {
        name: 'With Reranking',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: true,
          query_expansion_enabled: false,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
    ],
  },
  query_expansion: {
    name: 'Query Expansion Test',
    description: 'Evaluate query expansion effectiveness',
    variants: [
      {
        name: 'Baseline',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: true,
          query_expansion_enabled: false,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
      {
        name: 'With Query Expansion',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: true,
          query_expansion_enabled: true,
          graph_expansion_enabled: false,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
      {
        name: 'With Graph Expansion',
        config: {
          method: 'hybrid' as const,
          semantic_weight: 0.7,
          keyword_weight: 0.3,
          reranking_enabled: true,
          query_expansion_enabled: true,
          graph_expansion_enabled: true,
          min_similarity_threshold: 0.7,
          max_results: 5,
        },
      },
    ],
  },
};

export function getRecommendedExperiments(
  currentConfig: RetrievalConfig
): Array<{ name: string; reason: string }> {
  const recommendations: Array<{ name: string; reason: string }> = [];

  if (currentConfig.method === 'semantic' && !currentConfig.reranking_enabled) {
    recommendations.push({
      name: 'semantic_vs_hybrid',
      reason: 'Your current setup uses semantic-only search. Test hybrid to improve recall.',
    });
  }

  if (!currentConfig.reranking_enabled) {
    recommendations.push({
      name: 'reranking_impact',
      reason: 'Reranking can significantly improve result relevance.',
    });
  }

  if (!currentConfig.query_expansion_enabled && !currentConfig.graph_expansion_enabled) {
    recommendations.push({
      name: 'query_expansion',
      reason: 'Query expansion helps handle synonyms and related concepts.',
    });
  }

  return recommendations;
}
