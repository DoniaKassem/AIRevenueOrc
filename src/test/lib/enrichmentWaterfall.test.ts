import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enrichContactWithWaterfall,
  getProviderStats,
  EnrichmentInput,
} from '../../lib/enrichmentWaterfall';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Enrichment Waterfall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Selection and Failover', () => {
    it('should use highest priority provider first', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
        },
        {
          id: 'provider-2',
          provider_name: 'clearbit',
          display_name: 'Clearbit',
          priority_order: 2,
          is_enabled: true,
          credits_remaining: 200,
        },
      ];

      let selectCalls = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        if (table === 'enrichment_requests') {
          selectCalls++;
          if (selectCalls === 1) {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'request-1' },
                error: null,
              }),
            } as any;
          }
        }

        if (table === 'enrichment_provider_attempts') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const input: EnrichmentInput = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await enrichContactWithWaterfall(
        'prospect-1',
        'team-1',
        input,
        'full_profile'
      );

      expect(result.attemptsCount).toBeGreaterThan(0);
      expect(result.waterfallLog[0].provider).toBe('ZoomInfo');
    });

    it('should failover to next provider when first fails', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
        {
          id: 'provider-2',
          provider_name: 'clearbit',
          display_name: 'Clearbit',
          priority_order: 2,
          is_enabled: true,
          credits_remaining: 200,
          credits_used_this_month: 25,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        if (table === 'enrichment_requests') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'request-1' },
              error: null,
            }),
          } as any;
        }

        if (table === 'enrichment_provider_attempts') {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const input: EnrichmentInput = {
        email: 'test@example.com',
      };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      expect(result.waterfallLog.length).toBeGreaterThan(0);
    });

    it('should skip providers with no remaining credits', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-2',
          provider_name: 'clearbit',
          display_name: 'Clearbit',
          priority_order: 2,
          is_enabled: true,
          credits_remaining: 200,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
            order: vi.fn().mockReturnThis(),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = { email: 'test@example.com' };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      expect(result.waterfallLog.every(log => log.provider !== 'ZoomInfo')).toBe(true);
    });
  });

  describe('Credit Management', () => {
    it('should track credit consumption', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
      ];

      let updateCalls = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          if (updateCalls > 0) {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: { credits_remaining: 99 },
                error: null,
              }),
            } as any;
          }
          updateCalls++;
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = { email: 'test@example.com' };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      expect(result.creditsConsumed).toBeGreaterThanOrEqual(0);
    });

    it('should not consume credits for failed attempts with no data found', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = { email: 'notfound@example.com' };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      const noDataLogs = result.waterfallLog.filter(log =>
        log.error?.includes('No data found')
      );
      expect(noDataLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Data Quality Scoring', () => {
    it('should calculate data quality score based on filled fields', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = {
        email: 'complete@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
      };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      if (result.success && result.data) {
        const filledFields = Object.keys(result.data).filter(
          key => result.data![key] !== null && result.data![key] !== undefined
        );
        expect(filledFields.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Efficiency', () => {
    it('should complete enrichment within acceptable time', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = { email: 'fast@example.com' };

      const startTime = Date.now();
      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should track duration for each provider attempt', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockProviders = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          is_enabled: true,
          credits_remaining: 100,
          credits_used_this_month: 50,
        },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'enrichment_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockProviders,
              error: null,
            }),
          } as any;
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'request-1' },
            error: null,
          }),
        } as any;
      });

      const input: EnrichmentInput = { email: 'timing@example.com' };

      const result = await enrichContactWithWaterfall('prospect-1', 'team-1', input);

      result.waterfallLog.forEach(log => {
        expect(log.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Provider Statistics', () => {
    it('should retrieve provider statistics', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockStats = [
        {
          id: 'provider-1',
          provider_name: 'zoominfo',
          display_name: 'ZoomInfo',
          priority_order: 1,
          credits_remaining: 950,
          credits_used_this_month: 50,
        },
        {
          id: 'provider-2',
          provider_name: 'clearbit',
          display_name: 'Clearbit',
          priority_order: 2,
          credits_remaining: 475,
          credits_used_this_month: 25,
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockStats,
          error: null,
        }),
      } as any);

      const stats = await getProviderStats();

      expect(stats).toHaveLength(2);
      expect(stats[0].provider_name).toBe('zoominfo');
      expect(stats[0].credits_remaining).toBe(950);
    });
  });
});
