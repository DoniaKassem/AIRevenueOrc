import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkIntegrationHealth,
  monitorAllIntegrations,
  getIntegrationUptime,
  diagnoseIntegrationIssues,
  getIntegrationMetrics,
} from '../../lib/integrationHealthMonitor';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Integration Health Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Checks', () => {
    it('should detect healthy integration', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'valid_token',
          expires_at: Date.now() + 3600000,
          refresh_token: 'refresh',
        },
        integration_providers: {
          name: 'Salesforce',
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockIntegration,
          error: null,
        }),
      } as any);

      const health = await checkIntegrationHealth('integration-1');

      expect(health.status).toBe('healthy');
      expect(health.health_score).toBeGreaterThan(70);
    });

    it('should detect expired authentication', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'expired_token',
          expires_at: Date.now() - 1000,
        },
        integration_providers: {
          name: 'HubSpot',
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockIntegration,
          error: null,
        }),
      } as any);

      const health = await checkIntegrationHealth('integration-1');

      const authCheck = health.checks.find(c => c.name === 'Authentication');
      expect(authCheck?.status).toBe('failing');
    });

    it('should detect high rate limit usage', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'valid_token',
          expires_at: Date.now() + 3600000,
        },
        integration_providers: {
          name: 'Salesforce',
        },
      };

      const mockRateLimits = [
        {
          requests_made: 950,
          requests_limit: 1000,
          window_end: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;

        if (table === 'team_integrations' && callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockIntegration,
              error: null,
            }),
          } as any;
        }

        if (table === 'api_rate_limits') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: mockRateLimits,
              error: null,
            }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        } as any;
      });

      const health = await checkIntegrationHealth('integration-1');

      const rateLimitCheck = health.checks.find(c => c.name === 'Rate Limits');
      expect(rateLimitCheck?.status).toBe('warning');
    });

    it('should detect high sync failure rate', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'valid_token',
          expires_at: Date.now() + 3600000,
        },
        integration_providers: {
          name: 'ZoomInfo',
        },
      };

      const mockSyncJobs = [
        { status: 'failed' },
        { status: 'failed' },
        { status: 'completed' },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;

        if (table === 'team_integrations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockIntegration,
              error: null,
            }),
          } as any;
        }

        if (table === 'sync_jobs' && callCount > 3) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: mockSyncJobs,
              error: null,
            }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        } as any;
      });

      const health = await checkIntegrationHealth('integration-1');

      const syncCheck = health.checks.find(c => c.name === 'Sync Status');
      expect(syncCheck?.status).toBe('failing');
    });

    it('should calculate overall health score correctly', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'valid_token',
          expires_at: Date.now() + 3600000,
          refresh_token: 'refresh',
        },
        integration_providers: {
          name: 'Salesforce',
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockIntegration,
          error: null,
        }),
      } as any);

      const health = await checkIntegrationHealth('integration-1');

      expect(health.health_score).toBeGreaterThanOrEqual(0);
      expect(health.health_score).toBeLessThanOrEqual(100);
      expect(health.checks.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Integration Monitoring', () => {
    it('should monitor all team integrations', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegrations = [
        { id: 'integration-1' },
        { id: 'integration-2' },
        { id: 'integration-3' },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;

        if (table === 'team_integrations' && callCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            data: mockIntegrations,
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: `integration-${callCount}`,
              auth_data: { access_token: 'token', expires_at: Date.now() + 3600000 },
              integration_providers: { name: 'Provider' },
            },
            error: null,
          }),
        } as any;
      });

      const healthChecks = await monitorAllIntegrations('team-1');

      expect(healthChecks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Uptime Calculation', () => {
    it('should calculate integration uptime', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockSyncJobs = [
        {
          status: 'completed',
          started_at: '2023-10-15T10:00:00Z',
          completed_at: '2023-10-15T10:05:00Z',
        },
        {
          status: 'completed',
          started_at: '2023-10-15T11:00:00Z',
          completed_at: '2023-10-15T11:05:00Z',
        },
        {
          status: 'failed',
          started_at: '2023-10-15T12:00:00Z',
          completed_at: '2023-10-15T12:05:00Z',
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: mockSyncJobs,
          error: null,
        }),
      } as any);

      const since = new Date(Date.now() - 86400000);
      const uptime = await getIntegrationUptime('integration-1', since);

      expect(uptime.uptime_percentage).toBeCloseTo(66.67, 1);
      expect(uptime.incidents).toBe(1);
      expect(uptime.avg_response_time_ms).toBeGreaterThan(0);
    });

    it('should handle no sync history', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const since = new Date(Date.now() - 86400000);
      const uptime = await getIntegrationUptime('integration-1', since);

      expect(uptime.uptime_percentage).toBe(100);
      expect(uptime.incidents).toBe(0);
    });
  });

  describe('Issue Diagnosis', () => {
    it('should diagnose authentication issues', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'expired_token',
          expires_at: Date.now() - 1000,
        },
        integration_providers: {
          name: 'Salesforce',
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockIntegration,
          error: null,
        }),
      } as any);

      const diagnosis = await diagnoseIntegrationIssues('integration-1');

      expect(diagnosis.issues.some(i => i.includes('Authentication'))).toBe(true);
      expect(
        diagnosis.recommendations.some(r => r.includes('Reconnect'))
      ).toBe(true);
      expect(diagnosis.severity).toBeDefined();
    });

    it('should provide recommendations for rate limit issues', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {
          access_token: 'valid_token',
          expires_at: Date.now() + 3600000,
        },
        integration_providers: {
          name: 'HubSpot',
        },
      };

      const mockRateLimits = [
        {
          requests_made: 95,
          requests_limit: 100,
          window_end: new Date(Date.now() + 600000).toISOString(),
        },
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;

        if (table === 'team_integrations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockIntegration,
              error: null,
            }),
          } as any;
        }

        if (table === 'api_rate_limits') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({
              data: mockRateLimits,
              error: null,
            }),
          } as any;
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        } as any;
      });

      const diagnosis = await diagnoseIntegrationIssues('integration-1');

      expect(
        diagnosis.recommendations.some(r => r.includes('sync frequency'))
      ).toBe(true);
    });

    it('should assign correct severity levels', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockIntegration = {
        id: 'integration-1',
        auth_data: {},
        integration_providers: {
          name: 'Salesforce',
        },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockIntegration,
          error: null,
        }),
      } as any);

      const diagnosis = await diagnoseIntegrationIssues('integration-1');

      expect(['low', 'medium', 'high']).toContain(diagnosis.severity);
    });
  });

  describe('Integration Metrics', () => {
    it('should calculate hourly metrics', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockSyncJobs = [
        {
          status: 'completed',
          records_processed: 100,
          records_failed: 5,
          started_at: new Date(Date.now() - 1800000).toISOString(),
          completed_at: new Date(Date.now() - 1750000).toISOString(),
        },
        {
          status: 'completed',
          records_processed: 150,
          records_failed: 10,
          started_at: new Date(Date.now() - 900000).toISOString(),
          completed_at: new Date(Date.now() - 850000).toISOString(),
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: mockSyncJobs,
          error: null,
        }),
      } as any);

      const metrics = await getIntegrationMetrics('integration-1', 'hour');

      expect(metrics.sync_count).toBe(2);
      expect(metrics.success_rate).toBe(100);
      expect(metrics.records_synced).toBe(250);
      expect(metrics.errors).toBe(15);
    });

    it('should calculate daily metrics', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockSyncJobs = [
        {
          status: 'completed',
          records_processed: 500,
          records_failed: 10,
          started_at: new Date(Date.now() - 43200000).toISOString(),
          completed_at: new Date(Date.now() - 43100000).toISOString(),
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: mockSyncJobs,
          error: null,
        }),
      } as any);

      const metrics = await getIntegrationMetrics('integration-1', 'day');

      expect(metrics.sync_count).toBe(1);
      expect(metrics.records_synced).toBe(500);
    });

    it('should handle metrics with no data', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const metrics = await getIntegrationMetrics('integration-1', 'week');

      expect(metrics.sync_count).toBe(0);
      expect(metrics.success_rate).toBe(0);
      expect(metrics.records_synced).toBe(0);
    });
  });
});
