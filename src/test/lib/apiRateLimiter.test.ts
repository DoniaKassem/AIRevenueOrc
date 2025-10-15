import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  incrementRateLimit,
  executeWithRateLimit,
  executeWithRetry,
  executeWithRateLimitAndRetry,
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG,
} from '../../lib/apiRateLimiter';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('API Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limit Checking', () => {
    it('should allow requests within rate limit', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'Salesforce' },
          error: null,
        }),
      } as any);

      const result = await checkRateLimit('integration-1', 'default');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests when rate limit exceeded', async () => {
      const { supabase } = await import('../../lib/supabase');

      const windowEnd = new Date(Date.now() + 3600000);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'HubSpot' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            requests_made: 100,
            requests_limit: 100,
            window_end: windowEnd.toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await checkRateLimit('integration-2', 'default');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retry_after_seconds).toBeGreaterThan(0);
    });

    it('should handle Salesforce daily rate limits correctly', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'Salesforce' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            requests_made: 14500,
            requests_limit: 15000,
            window_end: new Date(Date.now() + 86400000).toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await checkRateLimit('sf-integration', 'default');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(500);
    });

    it('should handle ZoomInfo rate limits with per-minute window', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'ZoomInfo' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            requests_made: 950,
            requests_limit: 1000,
            window_end: new Date(Date.now() + 60000).toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await checkRateLimit('zi-integration', 'enrichment');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
    });
  });

  describe('Rate Limit Execution', () => {
    it('should execute operation when within rate limit', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true });

      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'Salesforce' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'rate-limit-1',
            requests_made: 50,
            requests_limit: 1000,
            window_end: new Date(Date.now() + 3600000).toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await executeWithRateLimit('integration-1', 'default', mockOperation);

      expect(result).toEqual({ success: true });
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should throw error when rate limit exceeded', async () => {
      const mockOperation = vi.fn().mockResolvedValue({ success: true });

      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'HubSpot' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            requests_made: 100,
            requests_limit: 100,
            window_end: new Date(Date.now() + 600000).toISOString(),
          },
          error: null,
        }),
      } as any);

      await expect(
        executeWithRateLimit('integration-2', 'default', mockOperation)
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations with exponential backoff', async () => {
      let attempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error: any = new Error('Temporary failure');
          error.status = 503;
          throw error;
        }
        return Promise.resolve({ success: true });
      });

      const result = await executeWithRetry(mockOperation, {
        max_retries: 3,
        initial_delay_ms: 10,
        max_delay_ms: 100,
        backoff_multiplier: 2,
        retry_on_status_codes: [503],
      });

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockOperation = vi.fn().mockImplementation(() => {
        const error: any = new Error('Bad request');
        error.status = 400;
        throw error;
      });

      await expect(
        executeWithRetry(mockOperation, {
          max_retries: 3,
          retry_on_status_codes: [429, 500, 503],
        })
      ).rejects.toThrow('Bad request');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect retry-after header', async () => {
      const mockOperation = vi.fn().mockImplementation(() => {
        const error: any = new Error('Rate limited');
        error.status = 429;
        error.headers = { 'retry-after': '2' };
        throw error;
      });

      const startTime = Date.now();

      await expect(
        executeWithRetry(mockOperation, {
          max_retries: 1,
          retry_on_status_codes: [429],
        })
      ).rejects.toThrow('Rate limited');

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(2000);
    });

    it('should handle network timeout errors', async () => {
      let attempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error('ETIMEDOUT');
        }
        return Promise.resolve({ success: true });
      });

      const result = await executeWithRetry(mockOperation, {
        max_retries: 2,
        initial_delay_ms: 10,
      });

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(2);
    });
  });

  describe('Combined Rate Limit and Retry', () => {
    it('should handle rate limiting with retry logic', async () => {
      let callCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error: any = new Error('Service unavailable');
          error.status = 503;
          throw error;
        }
        return Promise.resolve({ data: 'success' });
      });

      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { name: 'Salesforce' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'rate-limit-1',
            requests_made: 10,
            requests_limit: 1000,
            window_end: new Date(Date.now() + 3600000).toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await executeWithRateLimitAndRetry(
        'integration-1',
        'default',
        mockOperation,
        { max_retries: 2, initial_delay_ms: 10 }
      );

      expect(result).toEqual({ data: 'success' });
      expect(callCount).toBe(2);
    });
  });

  describe('Circuit Breaker', () => {
    it('should allow operations when circuit is closed', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const mockOperation = vi.fn().mockResolvedValue({ success: true });

      const result = await breaker.execute(mockOperation);

      expect(result).toEqual({ success: true });
      expect(breaker.getState()).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker(3, 1000);
      const mockOperation = vi.fn().mockRejectedValue(new Error('Service down'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Service down');
      }

      expect(breaker.getState()).toBe('open');

      await expect(breaker.execute(mockOperation)).rejects.toThrow(
        'Circuit breaker is open'
      );
    });

    it('should transition to half-open after timeout', async () => {
      const breaker = new CircuitBreaker(2, 100);
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Failure');
      }

      expect(breaker.getState()).toBe('open');

      await new Promise(resolve => setTimeout(resolve, 150));

      mockOperation.mockResolvedValue({ success: true });
      const result = await breaker.execute(mockOperation);

      expect(result).toEqual({ success: true });
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset circuit breaker manually', async () => {
      const breaker = new CircuitBreaker(2, 1000);
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      for (let i = 0; i < 2; i++) {
        await expect(breaker.execute(mockOperation)).rejects.toThrow('Failure');
      }

      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
    });
  });
});
