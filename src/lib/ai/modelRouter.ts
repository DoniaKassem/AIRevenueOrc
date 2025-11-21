/**
 * AI Model Router
 * Intelligently routes requests to the best AI model based on task type,
 * cost optimization, and fallback strategies
 */

import { createOpenAICompletion } from '../openai';
import { generateClaudeCompletion, callClaude, type ClaudeMessage } from './claudeProvider';
import { generateGeminiCompletion, callGemini, type GeminiMessage } from './geminiProvider';
import { supabase } from '../supabase';

export type AIProvider = 'openai' | 'claude' | 'gemini';

export type TaskType =
  | 'email-generation'
  | 'deep-research'
  | 'sentiment-analysis'
  | 'lead-scoring'
  | 'deal-analysis'
  | 'conversation-analysis'
  | 'company-research'
  | 'code-generation'
  | 'image-analysis'
  | 'general';

export interface ModelRoutingConfig {
  taskType: TaskType;
  prioritizeCost?: boolean; // Use cheaper models when possible
  requireVision?: boolean; // Task requires image analysis
  requireLongContext?: boolean; // Task requires large context window
  maxLatency?: number; // Maximum acceptable latency in ms
  fallbackEnabled?: boolean; // Enable fallback to other models
}

export interface ModelSelection {
  provider: AIProvider;
  model: string;
  reason: string;
}

export interface AIResponse {
  response: string;
  provider: AIProvider;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latency: number;
  cost: number;
}

/**
 * Route request to the best AI model based on task type and configuration
 */
export function selectModel(config: ModelRoutingConfig): ModelSelection {
  const { taskType, prioritizeCost, requireVision, requireLongContext, maxLatency } = config;

  // Vision tasks require Gemini
  if (requireVision) {
    return {
      provider: 'gemini',
      model: 'gemini-pro-vision',
      reason: 'Vision analysis requires multimodal model',
    };
  }

  // Long context tasks benefit from Gemini (2M tokens) or Claude (200k tokens)
  if (requireLongContext) {
    return prioritizeCost
      ? {
          provider: 'gemini',
          model: 'gemini-flash',
          reason: 'Cost-effective for long context tasks',
        }
      : {
          provider: 'gemini',
          model: 'gemini-pro',
          reason: 'Best performance for long context tasks',
        };
  }

  // Task-specific routing
  switch (taskType) {
    case 'deep-research':
    case 'company-research':
      return {
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        reason: 'Best for thoughtful, comprehensive analysis',
      };

    case 'code-generation':
      return {
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        reason: 'Superior code generation and understanding',
      };

    case 'email-generation':
    case 'sentiment-analysis':
      return prioritizeCost
        ? {
            provider: 'openai',
            model: 'gpt-4o-mini',
            reason: 'Cost-effective for simple text generation',
          }
        : {
            provider: 'openai',
            model: 'gpt-4o',
            reason: 'High-quality text generation',
          };

    case 'lead-scoring':
    case 'deal-analysis':
      return {
        provider: 'gemini',
        model: 'gemini-flash',
        reason: 'Fast and accurate for structured analysis',
      };

    case 'conversation-analysis':
      return {
        provider: 'claude',
        model: 'claude-3-haiku',
        reason: 'Fast and cost-effective for conversation analysis',
      };

    case 'image-analysis':
      return {
        provider: 'gemini',
        model: 'gemini-pro-vision',
        reason: 'Multimodal capabilities for image analysis',
      };

    case 'general':
    default:
      // Default to cost-optimized if requested, otherwise balanced
      if (prioritizeCost) {
        return {
          provider: 'gemini',
          model: 'gemini-flash',
          reason: 'Most cost-effective for general tasks',
        };
      } else if (maxLatency && maxLatency < 2000) {
        return {
          provider: 'openai',
          model: 'gpt-4o-mini',
          reason: 'Fast response time for real-time tasks',
        };
      } else {
        return {
          provider: 'claude',
          model: 'claude-3-sonnet',
          reason: 'Balanced performance for general tasks',
        };
      }
  }
}

/**
 * Execute AI request with automatic model selection and fallback
 */
export async function routeAIRequest(
  prompt: string,
  config: ModelRoutingConfig & {
    systemPrompt?: string;
    teamId?: string;
  }
): Promise<AIResponse> {
  const selection = selectModel(config);
  const startTime = Date.now();

  try {
    let result: AIResponse;

    switch (selection.provider) {
      case 'openai':
        result = await executeOpenAI(prompt, config.systemPrompt, selection.model);
        break;

      case 'claude':
        result = await executeClaude(prompt, config.systemPrompt, selection.model);
        break;

      case 'gemini':
        result = await executeGemini(prompt, config.systemPrompt, selection.model);
        break;

      default:
        throw new Error(`Unknown provider: ${selection.provider}`);
    }

    // Track performance
    if (config.teamId) {
      await trackModelPerformance(
        config.teamId,
        selection.provider,
        selection.model,
        config.taskType,
        result.usage.inputTokens,
        result.usage.outputTokens,
        result.latency,
        result.cost,
        true
      );
    }

    return result;
  } catch (error: any) {
    console.error(`AI request failed with ${selection.provider}:`, error);

    // Attempt fallback if enabled
    if (config.fallbackEnabled) {
      console.log('Attempting fallback to alternative model...');
      return await fallbackAIRequest(prompt, config, selection.provider);
    }

    throw error;
  }
}

/**
 * Fallback to alternative AI provider
 */
async function fallbackAIRequest(
  prompt: string,
  config: ModelRoutingConfig & { systemPrompt?: string; teamId?: string },
  failedProvider: AIProvider
): Promise<AIResponse> {
  // Try providers in order of preference, excluding the failed one
  const fallbackOrder: AIProvider[] = ['claude', 'openai', 'gemini'].filter(
    p => p !== failedProvider
  );

  for (const provider of fallbackOrder) {
    try {
      console.log(`Trying fallback provider: ${provider}`);

      let result: AIResponse;

      switch (provider) {
        case 'openai':
          result = await executeOpenAI(prompt, config.systemPrompt, 'gpt-4o-mini');
          break;
        case 'claude':
          result = await executeClaude(prompt, config.systemPrompt, 'claude-3-haiku');
          break;
        case 'gemini':
          result = await executeGemini(prompt, config.systemPrompt, 'gemini-flash');
          break;
      }

      // Track successful fallback
      if (config.teamId) {
        await trackModelPerformance(
          config.teamId,
          provider,
          result.model,
          config.taskType,
          result.usage.inputTokens,
          result.usage.outputTokens,
          result.latency,
          result.cost,
          true
        );
      }

      return result;
    } catch (error) {
      console.error(`Fallback to ${provider} also failed:`, error);
      continue;
    }
  }

  throw new Error('All AI providers failed');
}

/**
 * Execute request with OpenAI
 */
async function executeOpenAI(
  prompt: string,
  systemPrompt?: string,
  model: string = 'gpt-4o-mini'
): Promise<AIResponse> {
  const startTime = Date.now();

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await createOpenAICompletion(fullPrompt, {
    model,
    temperature: 0.7,
  });

  const latency = Date.now() - startTime;

  // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
  const inputTokens = Math.ceil(fullPrompt.length / 4);
  const outputTokens = Math.ceil(response.length / 4);

  // Calculate cost based on model
  const costs: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
  };

  const modelCosts = costs[model] || costs['gpt-4o-mini'];
  const cost =
    (inputTokens / 1000) * modelCosts.input + (outputTokens / 1000) * modelCosts.output;

  return {
    response,
    provider: 'openai',
    model,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    latency,
    cost,
  };
}

/**
 * Execute request with Claude
 */
async function executeClaude(
  prompt: string,
  systemPrompt?: string,
  model: string = 'claude-3-5-sonnet'
): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const messages: ClaudeMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'user', content: systemPrompt });
    messages.push({ role: 'assistant', content: 'Understood. I will follow these instructions.' });
  }

  messages.push({ role: 'user', content: prompt });

  const result = await callClaude(messages, { apiKey, model });

  const costs: Record<string, { input: number; output: number }> = {
    'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  };

  const modelCosts = costs[model] || costs['claude-3-5-sonnet'];
  const cost =
    (result.usage.input_tokens / 1000) * modelCosts.input +
    (result.usage.output_tokens / 1000) * modelCosts.output;

  return {
    response: result.response,
    provider: 'claude',
    model,
    usage: {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      totalTokens: result.usage.input_tokens + result.usage.output_tokens,
    },
    latency: result.latency,
    cost,
  };
}

/**
 * Execute request with Gemini
 */
async function executeGemini(
  prompt: string,
  systemPrompt?: string,
  model: string = 'gemini-pro'
): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('Google API key not configured');
  }

  const messages: GeminiMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'user', parts: [{ text: systemPrompt }] });
    messages.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }

  messages.push({ role: 'user', parts: [{ text: prompt }] });

  const result = await callGemini(messages, { apiKey, model });

  const costs: Record<string, { input: number; output: number }> = {
    'gemini-pro': { input: 0.00125, output: 0.00375 },
    'gemini-flash': { input: 0.000075, output: 0.0003 },
    'gemini-pro-vision': { input: 0.00125, output: 0.00375 },
  };

  const modelCosts = costs[model] || costs['gemini-pro'];
  const cost =
    (result.usage.promptTokenCount / 1000) * modelCosts.input +
    (result.usage.candidatesTokenCount / 1000) * modelCosts.output;

  return {
    response: result.response,
    provider: 'gemini',
    model,
    usage: {
      inputTokens: result.usage.promptTokenCount,
      outputTokens: result.usage.candidatesTokenCount,
      totalTokens: result.usage.totalTokenCount,
    },
    latency: result.latency,
    cost,
  };
}

/**
 * Track model performance in database
 */
async function trackModelPerformance(
  teamId: string,
  provider: AIProvider,
  model: string,
  taskType: string,
  inputTokens: number,
  outputTokens: number,
  latency: number,
  cost: number,
  success: boolean
): Promise<void> {
  try {
    await supabase.from('ai_model_performance').insert({
      team_id: teamId,
      provider,
      model_name: model,
      task_type: taskType,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      latency_ms: latency,
      cost_usd: cost,
      success,
    });
  } catch (error) {
    console.error('Error tracking model performance:', error);
  }
}

/**
 * Get model performance statistics
 */
export async function getModelPerformanceStats(
  teamId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let query = supabase
    .from('ai_model_performance')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching model performance stats:', error);
    return [];
  }

  return data || [];
}

/**
 * Compare models for a specific task type
 */
export async function compareModelsForTask(
  teamId: string,
  taskType: TaskType
): Promise<{
  provider: AIProvider;
  model: string;
  avgLatency: number;
  avgCost: number;
  successRate: number;
  totalRequests: number;
}[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const stats = await getModelPerformanceStats(teamId, thirtyDaysAgo);

  const taskStats = stats.filter(s => s.task_type === taskType);

  // Group by provider and model
  const grouped = new Map<string, any[]>();

  taskStats.forEach(stat => {
    const key = `${stat.provider}:${stat.model_name}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(stat);
  });

  // Calculate aggregates
  const results = Array.from(grouped.entries()).map(([key, stats]) => {
    const [provider, model] = key.split(':');
    const totalRequests = stats.length;
    const successCount = stats.filter(s => s.success).length;
    const avgLatency = stats.reduce((sum, s) => sum + s.latency_ms, 0) / totalRequests;
    const avgCost = stats.reduce((sum, s) => sum + s.cost_usd, 0) / totalRequests;
    const successRate = (successCount / totalRequests) * 100;

    return {
      provider: provider as AIProvider,
      model,
      avgLatency,
      avgCost,
      successRate,
      totalRequests,
    };
  });

  return results.sort((a, b) => b.successRate - a.successRate);
}
