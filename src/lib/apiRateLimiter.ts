import { supabase } from './supabase';

export interface RateLimitConfig {
  requests_per_window: number;
  window_seconds: number;
  burst_limit?: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  reset_at: Date;
  retry_after_seconds?: number;
}

export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  retry_on_status_codes: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_retries: 3,
  initial_delay_ms: 1000,
  max_delay_ms: 30000,
  backoff_multiplier: 2,
  retry_on_status_codes: [429, 500, 502, 503, 504],
};

export const PROVIDER_RATE_LIMITS: Record<string, Record<string, RateLimitConfig>> = {
  salesforce: {
    default: { requests_per_window: 15000, window_seconds: 86400 },
    bulk: { requests_per_window: 10000, window_seconds: 86400 },
  },
  hubspot: {
    default: { requests_per_window: 100, window_seconds: 10, burst_limit: 200 },
  },
  gmail: {
    send: { requests_per_window: 2000, window_seconds: 86400 },
    read: { requests_per_window: 250, window_seconds: 1 },
  },
  clearbit: {
    enrichment: { requests_per_window: 600, window_seconds: 60 },
  },
  zoominfo: {
    enrichment: { requests_per_window: 1000, window_seconds: 60 },
  },
};

export async function checkRateLimit(
  integrationId: string,
  endpoint: string = 'default'
): Promise<RateLimitStatus> {
  const { data: integration } = await supabase
    .from('team_integrations')
    .select('provider_id')
    .eq('id', integrationId)
    .single();

  if (!integration) {
    throw new Error('Integration not found');
  }

  const { data: provider } = await supabase
    .from('integration_providers')
    .select('name')
    .eq('id', integration.provider_id)
    .single();

  if (!provider) {
    throw new Error('Provider not found');
  }

  const providerKey = provider.name.toLowerCase().replace(/\s+/g, '-');
  const limits = PROVIDER_RATE_LIMITS[providerKey];

  if (!limits) {
    return {
      allowed: true,
      remaining: 999999,
      reset_at: new Date(Date.now() + 86400000),
    };
  }

  const config = limits[endpoint] || limits.default;
  if (!config) {
    return {
      allowed: true,
      remaining: 999999,
      reset_at: new Date(Date.now() + 86400000),
    };
  }

  const windowStart = new Date(Date.now() - config.window_seconds * 1000);

  const { data: rateLimitRecord } = await supabase
    .from('api_rate_limits')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('endpoint', endpoint)
    .gte('window_end', new Date().toISOString())
    .maybeSingle();

  if (!rateLimitRecord) {
    const windowEnd = new Date(Date.now() + config.window_seconds * 1000);
    await supabase.from('api_rate_limits').insert({
      integration_id: integrationId,
      endpoint,
      requests_made: 0,
      requests_limit: config.requests_per_window,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
    });

    return {
      allowed: true,
      remaining: config.requests_per_window,
      reset_at: windowEnd,
    };
  }

  const remaining = config.requests_per_window - rateLimitRecord.requests_made;

  if (remaining <= 0) {
    const resetAt = new Date(rateLimitRecord.window_end);
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      reset_at: resetAt,
      retry_after_seconds: retryAfter,
    };
  }

  return {
    allowed: true,
    remaining,
    reset_at: new Date(rateLimitRecord.window_end),
  };
}

export async function incrementRateLimit(
  integrationId: string,
  endpoint: string = 'default'
): Promise<void> {
  const { data: rateLimitRecord } = await supabase
    .from('api_rate_limits')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('endpoint', endpoint)
    .gte('window_end', new Date().toISOString())
    .maybeSingle();

  if (rateLimitRecord) {
    await supabase
      .from('api_rate_limits')
      .update({ requests_made: rateLimitRecord.requests_made + 1 })
      .eq('id', rateLimitRecord.id);
  }
}

export async function executeWithRateLimit<T>(
  integrationId: string,
  endpoint: string,
  operation: () => Promise<T>
): Promise<T> {
  const status = await checkRateLimit(integrationId, endpoint);

  if (!status.allowed) {
    throw new Error(
      `Rate limit exceeded. Retry after ${status.retry_after_seconds} seconds.`
    );
  }

  await incrementRateLimit(integrationId, endpoint);

  return await operation();
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = retryConfig.initial_delay_ms;

  for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt === retryConfig.max_retries) {
        break;
      }

      const shouldRetry = shouldRetryError(error, retryConfig.retry_on_status_codes);

      if (!shouldRetry) {
        throw error;
      }

      const retryAfter = extractRetryAfter(error);
      const waitTime = retryAfter || delay;

      await sleep(waitTime);

      delay = Math.min(delay * retryConfig.backoff_multiplier, retryConfig.max_delay_ms);
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

function shouldRetryError(error: any, retryStatusCodes: number[]): boolean {
  if (error.status && retryStatusCodes.includes(error.status)) {
    return true;
  }

  if (error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT')) {
    return true;
  }

  return false;
}

function extractRetryAfter(error: any): number | null {
  if (error.headers?.['retry-after']) {
    const retryAfter = parseInt(error.headers['retry-after'], 10);
    if (!isNaN(retryAfter)) {
      return retryAfter * 1000;
    }
  }

  if (error.retryAfter) {
    return error.retryAfter * 1000;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeWithRateLimitAndRetry<T>(
  integrationId: string,
  endpoint: string,
  operation: () => Promise<T>,
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  return executeWithRetry(
    () => executeWithRateLimit(integrationId, endpoint, operation),
    retryConfig
  );
}

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private halfOpenMaxAttempts: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();

      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

export function createBatchProcessor<T, R>(
  batchSize: number,
  delayBetweenBatches: number,
  processor: (batch: T[]) => Promise<R[]>
) {
  return async function processBatches(items: T[]): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);

      if (i + batchSize < items.length) {
        await sleep(delayBetweenBatches);
      }
    }

    return results;
  };
}

export async function getRateLimitStats(
  integrationId: string
): Promise<
  Array<{
    endpoint: string;
    requests_made: number;
    requests_limit: number;
    utilization: number;
    resets_at: string;
  }>
> {
  const { data: records, error } = await supabase
    .from('api_rate_limits')
    .select('*')
    .eq('integration_id', integrationId)
    .gte('window_end', new Date().toISOString());

  if (error || !records) {
    return [];
  }

  return records.map(record => ({
    endpoint: record.endpoint,
    requests_made: record.requests_made,
    requests_limit: record.requests_limit,
    utilization: (record.requests_made / record.requests_limit) * 100,
    resets_at: record.window_end,
  }));
}
