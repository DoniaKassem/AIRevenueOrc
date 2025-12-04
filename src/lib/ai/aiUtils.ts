/**
 * AI Utilities
 * Common utilities for AI operations including retry logic, caching, validation, and cost tracking
 */

import OpenAI from 'openai';
import { z, ZodSchema } from 'zod';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface AIRequestConfig {
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  cacheKey?: string;
  cacheTtlMs?: number;
  validateResponse?: boolean;
  trackCost?: boolean;
}

export interface AIResponse<T> {
  data: T;
  metadata: {
    model: string;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost: number;
    latencyMs: number;
    cached: boolean;
    retries: number;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Model pricing (per 1K tokens as of 2024)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// =============================================
// IN-MEMORY CACHE
// =============================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class AICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 1000;

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(keyPattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

export const aiCache = new AICache();

// =============================================
// COST TRACKING
// =============================================

interface UsageRecord {
  timestamp: Date;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  operation: string;
}

class CostTracker {
  private usage: UsageRecord[] = [];
  private maxRecords: number = 10000;

  record(
    model: string,
    promptTokens: number,
    completionTokens: number,
    operation: string
  ): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o-mini'];
    const cost =
      (promptTokens / 1000) * pricing.input +
      (completionTokens / 1000) * pricing.output;

    // Trim old records if necessary
    if (this.usage.length >= this.maxRecords) {
      this.usage = this.usage.slice(-this.maxRecords / 2);
    }

    this.usage.push({
      timestamp: new Date(),
      model,
      promptTokens,
      completionTokens,
      cost,
      operation,
    });

    return cost;
  }

  getUsage(sinceDate?: Date): {
    totalCost: number;
    totalTokens: number;
    byModel: Record<string, { tokens: number; cost: number }>;
    byOperation: Record<string, { tokens: number; cost: number }>;
  } {
    const filtered = sinceDate
      ? this.usage.filter(r => r.timestamp >= sinceDate)
      : this.usage;

    const byModel: Record<string, { tokens: number; cost: number }> = {};
    const byOperation: Record<string, { tokens: number; cost: number }> = {};
    let totalCost = 0;
    let totalTokens = 0;

    for (const record of filtered) {
      const tokens = record.promptTokens + record.completionTokens;
      totalCost += record.cost;
      totalTokens += tokens;

      if (!byModel[record.model]) {
        byModel[record.model] = { tokens: 0, cost: 0 };
      }
      byModel[record.model].tokens += tokens;
      byModel[record.model].cost += record.cost;

      if (!byOperation[record.operation]) {
        byOperation[record.operation] = { tokens: 0, cost: 0 };
      }
      byOperation[record.operation].tokens += tokens;
      byOperation[record.operation].cost += record.cost;
    }

    return { totalCost, totalTokens, byModel, byOperation };
  }

  getDailyUsage(days: number = 7): Array<{
    date: string;
    tokens: number;
    cost: number;
  }> {
    const dailyMap = new Map<string, { tokens: number; cost: number }>();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    for (const record of this.usage) {
      if (record.timestamp < cutoff) continue;
      const dateKey = record.timestamp.toISOString().split('T')[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { tokens: 0, cost: 0 });
      }

      const entry = dailyMap.get(dateKey)!;
      entry.tokens += record.promptTokens + record.completionTokens;
      entry.cost += record.cost;
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const costTracker = new CostTracker();

// =============================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// =============================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
  } = {}
): Promise<{ result: T; retries: number }> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    retryableErrors = ['rate_limit', 'timeout', 'server_error', '429', '500', '502', '503'],
  } = config;

  let lastError: Error | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retries };
    } catch (error) {
      lastError = error as Error;
      retries = attempt;

      // Check if error is retryable
      const errorMessage = (error as Error).message?.toLowerCase() || '';
      const isRetryable = retryableErrors.some(e => errorMessage.includes(e.toLowerCase()));

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = Math.min(baseDelay + jitter, maxDelayMs);

      console.log(`[AI] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${errorMessage}`);
      await sleep(delay);
    }
  }

  throw lastError;
}

// =============================================
// RESPONSE VALIDATION
// =============================================

export function validateAIResponse<T>(
  response: unknown,
  schema: ZodSchema<T>,
  fallback?: T
): T {
  try {
    return schema.parse(response);
  } catch (error) {
    console.error('[AI] Response validation failed:', error);
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`AI response validation failed: ${(error as Error).message}`);
  }
}

export function safeJsonParse<T>(
  content: string | null | undefined,
  schema?: ZodSchema<T>,
  fallback?: T
): T {
  if (!content) {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty content received from AI');
  }

  // Try to extract JSON from markdown code blocks
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON object or array
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  } else if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (schema) {
      return validateAIResponse(parsed, schema, fallback);
    }
    return parsed as T;
  } catch (error) {
    console.error('[AI] JSON parse error:', error, 'Content:', content.substring(0, 500));
    if (fallback !== undefined) return fallback;
    throw new Error(`Failed to parse AI response as JSON: ${(error as Error).message}`);
  }
}

// =============================================
// COMMON VALIDATION SCHEMAS
// =============================================

export const BuyerPersonaSchema = z.object({
  archetype: z.string().default('Business Professional'),
  communicationStyle: z.enum(['analytical', 'driver', 'expressive', 'amiable']).default('analytical'),
  buyingRole: z.enum(['economic_buyer', 'technical_buyer', 'user_buyer', 'champion', 'influencer']).default('influencer'),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  primaryMotivations: z.array(z.string()).default(['Efficiency', 'Results']),
  decisionCriteria: z.array(z.string()).default(['ROI', 'Ease of use']),
  expectedObjections: z.array(z.string()).default(['Budget', 'Timeline']),
  valueDrivers: z.array(z.string()).default(['Time savings', 'Revenue impact']),
  preferredProofPoints: z.array(z.string()).default(['Case studies', 'ROI data']),
});

export const EmailStrategySchema = z.object({
  primaryAngle: z.string().default('value-focused'),
  emotionalAppeal: z.string().default('success'),
  logicalAppeal: z.string().default('efficiency'),
  socialProofType: z.string().default('case study'),
  ctaStyle: z.enum(['soft', 'medium', 'direct']).default('soft'),
  followUpStrategy: z.string().default('Follow up in 3 days'),
  anticipatedResponse: z.string().optional(),
});

export const CompetitiveContextSchema = z.object({
  currentSolutions: z.array(z.string()).default([]),
  likelyPainWithCurrent: z.array(z.string()).default(['Manual processes']),
  competitiveAdvantages: z.array(z.string()).default(['Better automation']),
  switchingBarriers: z.array(z.string()).default(['Implementation effort']),
  differentiators: z.array(z.string()).default(['Ease of use']),
});

export const TriggerAnalysisSchema = z.object({
  trigger: z.string(),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timeWindow: z.string().default('2-4 weeks'),
  recommendedAngle: z.string(),
  openingHook: z.string(),
  connectionToValue: z.string(),
});

export const EmailVariantSchema = z.object({
  variant: z.string(),
  angle: z.string(),
  subject: z.string(),
  body: z.string(),
  strengths: z.array(z.string()).default([]),
});

export const ReplyAnalysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  intent: z.enum(['interested', 'not_now', 'not_interested', 'needs_info', 'referral', 'objection']).default('needs_info'),
  keyObjections: z.array(z.string()).default([]),
  followUpRecommendation: z.string(),
  suggestedResponse: z.string().optional(),
});

// =============================================
// ENHANCED AI CLIENT
// =============================================

export class EnhancedAIClient {
  private openai: OpenAI;
  private defaultModel: string;

  constructor(
    apiKey?: string,
    defaultModel: string = 'gpt-4o-mini'
  ) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.defaultModel = defaultModel;
  }

  async chat<T>(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      schema?: ZodSchema<T>;
      fallback?: T;
      cacheKey?: string;
      cacheTtlMs?: number;
      maxRetries?: number;
      operation?: string;
    } = {}
  ): Promise<AIResponse<T>> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1000,
      schema,
      fallback,
      cacheKey,
      cacheTtlMs = 5 * 60 * 1000, // 5 minutes default
      maxRetries = 3,
      operation = 'chat',
    } = options;

    // Check cache
    if (cacheKey) {
      const cached = aiCache.get<AIResponse<T>>(cacheKey);
      if (cached) {
        return { ...cached, metadata: { ...cached.metadata, cached: true } };
      }
    }

    const startTime = Date.now();

    const { result, retries } = await withRetry(
      async () => {
        return this.openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        });
      },
      { maxRetries }
    );

    const latencyMs = Date.now() - startTime;

    // Parse and validate response
    const content = result.choices[0]?.message?.content;
    let data: T;

    if (schema) {
      data = safeJsonParse(content, schema, fallback);
    } else {
      data = (content as unknown) as T;
    }

    // Track cost
    const promptTokens = result.usage?.prompt_tokens || 0;
    const completionTokens = result.usage?.completion_tokens || 0;
    const cost = costTracker.record(model, promptTokens, completionTokens, operation);

    const response: AIResponse<T> = {
      data,
      metadata: {
        model,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        cost,
        latencyMs,
        cached: false,
        retries,
      },
    };

    // Cache response
    if (cacheKey) {
      aiCache.set(cacheKey, response, cacheTtlMs);
    }

    return response;
  }

  async chatWithStreaming(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    onChunk: (chunk: string) => void,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      operation?: string;
    } = {}
  ): Promise<{ content: string; metadata: AIResponse<string>['metadata'] }> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1000,
      operation = 'chat_stream',
    } = options;

    const startTime = Date.now();
    let content = '';
    let retries = 0;

    const { result } = await withRetry(
      async () => {
        return this.openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });
      },
      { maxRetries: 3 }
    );

    for await (const chunk of result) {
      const delta = chunk.choices[0]?.delta?.content || '';
      content += delta;
      if (delta) onChunk(delta);
    }

    const latencyMs = Date.now() - startTime;

    // Estimate tokens (rough approximation for streaming)
    const estimatedPromptTokens = messages.reduce(
      (sum, m) => sum + (typeof m.content === 'string' ? m.content.length / 4 : 0),
      0
    );
    const estimatedCompletionTokens = content.length / 4;
    const cost = costTracker.record(
      model,
      Math.round(estimatedPromptTokens),
      Math.round(estimatedCompletionTokens),
      operation
    );

    return {
      content,
      metadata: {
        model,
        tokensUsed: {
          prompt: Math.round(estimatedPromptTokens),
          completion: Math.round(estimatedCompletionTokens),
          total: Math.round(estimatedPromptTokens + estimatedCompletionTokens),
        },
        cost,
        latencyMs,
        cached: false,
        retries,
      },
    };
  }

  /**
   * Generate structured output with automatic validation and retry
   */
  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: ZodSchema<T>,
    options: {
      model?: string;
      temperature?: number;
      fallback?: T;
      cacheKey?: string;
      operation?: string;
      examples?: Array<{ input: string; output: T }>;
    } = {}
  ): Promise<AIResponse<T>> {
    const { examples, ...chatOptions } = options;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + '\n\nReturn only valid JSON matching the expected schema.' },
    ];

    // Add few-shot examples if provided
    if (examples && examples.length > 0) {
      for (const example of examples) {
        messages.push({ role: 'user', content: example.input });
        messages.push({ role: 'assistant', content: JSON.stringify(example.output) });
      }
    }

    messages.push({ role: 'user', content: userPrompt });

    return this.chat<T>(messages, {
      ...chatOptions,
      schema,
    });
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createCacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts
    .filter(p => p !== undefined && p !== null)
    .map(p => String(p).toLowerCase().replace(/\s+/g, '_'))
    .join(':');
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function truncateForContext(
  text: string,
  maxTokens: number,
  strategy: 'start' | 'end' | 'middle' = 'end'
): string {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  const maxChars = maxTokens * 4;

  switch (strategy) {
    case 'start':
      return text.substring(text.length - maxChars) + '...';
    case 'middle':
      const halfChars = Math.floor(maxChars / 2);
      return text.substring(0, halfChars) + '\n...[truncated]...\n' + text.substring(text.length - halfChars);
    case 'end':
    default:
      return text.substring(0, maxChars) + '...';
  }
}

// =============================================
// PROMPT TEMPLATES
// =============================================

export const PROMPT_TEMPLATES = {
  buyerPersona: `You are an expert B2B sales psychologist who creates accurate buyer personas based on professional data.

Analyze the prospect's title, industry, company size, and any other available signals to build a comprehensive buyer persona.

Consider:
- Their likely priorities and pressures based on role
- How they prefer to receive information
- Their position in the buying process
- Risk factors that influence their decisions
- Common objections from similar personas

Be specific and actionable, avoiding generic statements.`,

  competitiveAnalysis: `You are a competitive intelligence analyst specializing in B2B software and services.

Based on the company's tech stack and industry, identify:
- What solutions they're likely using for similar problems
- Common frustrations with incumbent solutions
- What would motivate them to evaluate alternatives
- Barriers that might prevent switching

Be specific to their industry and company size. Reference real tools and real challenges.`,

  emailStrategy: `You are a master sales strategist who develops highly effective outreach approaches.

Based on the buyer persona and competitive context, develop an optimal email strategy that:
- Matches the prospect's communication style
- Addresses their likely priorities
- Preemptively handles common objections
- Uses appropriate proof points for their persona type
- Has a clear, compelling call-to-action

Think step by step about what will resonate most with this specific buyer.`,

  emailComposition: `You are an elite sales copywriter who writes emails that get responses.

Write emails that:
- Start with something relevant about THEM (not you)
- Are 80-120 words maximum
- Sound like a real human wrote them
- Have ONE clear call-to-action
- Create curiosity without being clickbait
- Reference specific details from their context

Avoid: buzzwords, hyperbole, multiple CTAs, starting with "I", being salesy.`,

  replyAnalysis: `You are an expert at reading between the lines in sales conversations.

Analyze the prospect's reply to understand:
- Their true sentiment (not just surface politeness)
- What they're really saying (the subtext)
- Specific concerns or objections raised
- Buying signals, if any
- The appropriate next step

Be honest in your assessment - it's better to know a prospect isn't interested than to pursue a dead end.`,
};

// =============================================
// SINGLETON INSTANCE
// =============================================

let defaultClient: EnhancedAIClient | null = null;

export function getAIClient(): EnhancedAIClient {
  if (!defaultClient) {
    defaultClient = new EnhancedAIClient();
  }
  return defaultClient;
}

export function createAIClient(apiKey?: string, model?: string): EnhancedAIClient {
  return new EnhancedAIClient(apiKey, model);
}
