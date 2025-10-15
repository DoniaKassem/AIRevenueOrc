import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  saveIntegrationTokens,
  ensureValidToken,
  OAUTH_PROVIDERS,
} from '../../lib/oauthIntegration';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

global.fetch = vi.fn();

describe('OAuth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization URL Generation', () => {
    it('should generate valid Salesforce authorization URL', () => {
      const url = generateAuthorizationUrl(
        'salesforce',
        'client_123',
        'https://app.example.com/callback',
        'state_abc'
      );

      expect(url).toContain('https://login.salesforce.com/services/oauth2/authorize');
      expect(url).toContain('client_id=client_123');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state_abc');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
    });

    it('should generate valid HubSpot authorization URL', () => {
      const url = generateAuthorizationUrl(
        'hubspot',
        'client_456',
        'https://app.example.com/callback',
        'state_xyz'
      );

      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain('client_id=client_456');
      expect(url).toContain('crm.objects.contacts');
    });

    it('should include offline access for Gmail', () => {
      const url = generateAuthorizationUrl(
        'gmail',
        'client_789',
        'https://app.example.com/callback',
        'state_123'
      );

      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('https://www.googleapis.com/auth/gmail.send');
    });

    it('should throw error for unknown provider', () => {
      expect(() =>
        generateAuthorizationUrl(
          'unknown_provider',
          'client_123',
          'https://app.example.com/callback',
          'state'
        )
      ).toThrow('Unknown OAuth provider');
    });

    it('should include additional params when provided', () => {
      const url = generateAuthorizationUrl(
        'salesforce',
        'client_123',
        'https://app.example.com/callback',
        'state_abc',
        { login_hint: 'user@example.com' }
      );

      expect(url).toContain('login_hint=user%40example.com');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'api refresh_token full',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
      } as Response);

      const tokens = await exchangeCodeForTokens(
        'salesforce',
        'auth_code_789',
        'client_123',
        'client_secret_abc',
        'https://app.example.com/callback'
      );

      expect(tokens.access_token).toBe('access_token_123');
      expect(tokens.refresh_token).toBe('refresh_token_456');
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.expires_at).toBeGreaterThan(Date.now());
    });

    it('should handle token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant: Code has expired',
      } as Response);

      await expect(
        exchangeCodeForTokens(
          'salesforce',
          'invalid_code',
          'client_123',
          'client_secret_abc',
          'https://app.example.com/callback'
        )
      ).rejects.toThrow('Token exchange failed');
    });

    it('should include proper headers in token request', async () => {
      const mockTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      await exchangeCodeForTokens(
        'salesforce',
        'code',
        'client',
        'secret',
        'redirect'
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });
  });

  describe('Token Refresh', () => {
    it('should refresh expired access token', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_456',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockRefreshResponse,
      } as Response);

      const tokens = await refreshAccessToken(
        'salesforce',
        'old_refresh_token',
        'client_123',
        'client_secret_abc'
      );

      expect(tokens.access_token).toBe('new_access_token_123');
      expect(tokens.expires_at).toBeGreaterThan(Date.now());
    });

    it('should preserve refresh token if not returned', async () => {
      const mockRefreshResponse = {
        access_token: 'new_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockRefreshResponse,
      } as Response);

      const tokens = await refreshAccessToken(
        'hubspot',
        'refresh_token_to_preserve',
        'client_123',
        'client_secret_abc'
      );

      expect(tokens.refresh_token).toBe('refresh_token_to_preserve');
    });

    it('should throw error for providers without refresh support', async () => {
      await expect(
        refreshAccessToken('slack', 'token', 'client', 'secret')
      ).rejects.toThrow('does not support token refresh');
    });

    it('should handle refresh token expiration', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant: Refresh token expired',
      } as Response);

      await expect(
        refreshAccessToken('salesforce', 'expired_refresh', 'client', 'secret')
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('Token Storage', () => {
    it('should save new integration tokens', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockTokens = {
        access_token: 'access_123',
        refresh_token: 'refresh_456',
        token_type: 'Bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'integration-1',
            team_id: 'team-1',
            provider_id: 'provider-1',
            status: 'active',
            auth_data: mockTokens,
            config: {},
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      } as any);

      const result = await saveIntegrationTokens('team-1', 'provider-1', mockTokens);

      expect(result.id).toBe('integration-1');
      expect(result.status).toBe('active');
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should update existing integration tokens', async () => {
      const { supabase } = await import('../../lib/supabase');

      const mockTokens = {
        access_token: 'new_access_123',
        refresh_token: 'new_refresh_456',
        token_type: 'Bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
      };

      const existingIntegration = {
        id: 'existing-1',
        team_id: 'team-1',
        provider_id: 'provider-1',
        status: 'inactive',
        auth_data: {},
        config: { some: 'config' },
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingIntegration,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            ...existingIntegration,
            status: 'active',
            auth_data: mockTokens,
          },
          error: null,
        }),
      } as any);

      const result = await saveIntegrationTokens('team-1', 'provider-1', mockTokens);

      expect(result.status).toBe('active');
      expect(result.config).toEqual({ some: 'config' });
    });
  });

  describe('Token Validation and Auto-Refresh', () => {
    it('should return valid token when not expired', async () => {
      const { supabase } = await import('../../lib/supabase');

      const validTokens = {
        access_token: 'valid_access_token',
        refresh_token: 'refresh_token',
        token_type: 'Bearer',
        expires_at: Date.now() + 3600000,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { auth_data: validTokens },
          error: null,
        }),
      } as any);

      const token = await ensureValidToken(
        'team-1',
        'provider-1',
        'client_123',
        'client_secret_abc'
      );

      expect(token).toBe('valid_access_token');
    });

    it('should refresh token when expired', async () => {
      const { supabase } = await import('../../lib/supabase');

      const expiredTokens = {
        access_token: 'expired_access_token',
        refresh_token: 'valid_refresh_token',
        token_type: 'Bearer',
        expires_at: Date.now() - 1000,
      };

      const newTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        token_type: 'Bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600000,
      };

      let fromCallCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        fromCallCount++;

        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { auth_data: expiredTokens },
              error: null,
            }),
          } as any;
        }

        if (table === 'team_integrations' && fromCallCount === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: 'integration-1' },
              error: null,
            }),
          } as any;
        }

        if (table === 'integration_providers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { name: 'Salesforce' },
              error: null,
            }),
          } as any;
        }

        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => newTokens,
      } as Response);

      const token = await ensureValidToken(
        'team-1',
        'provider-1',
        'client_123',
        'client_secret_abc'
      );

      expect(token).toBe('new_access_token');
    });

    it('should throw error when token expired and no refresh token', async () => {
      const { supabase } = await import('../../lib/supabase');

      const expiredTokens = {
        access_token: 'expired_access_token',
        token_type: 'Bearer',
        expires_at: Date.now() - 1000,
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { auth_data: expiredTokens },
          error: null,
        }),
      } as any);

      await expect(
        ensureValidToken('team-1', 'provider-1', 'client_123', 'client_secret_abc')
      ).rejects.toThrow('Token expired and no refresh token available');
    });

    it('should throw error when integration not connected', async () => {
      const { supabase } = await import('../../lib/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      await expect(
        ensureValidToken('team-1', 'provider-1', 'client_123', 'client_secret_abc')
      ).rejects.toThrow('Integration not connected');
    });
  });

  describe('Provider Configuration', () => {
    it('should have correct Salesforce configuration', () => {
      const config = OAUTH_PROVIDERS.salesforce;

      expect(config.auth_url).toContain('salesforce.com');
      expect(config.scopes).toContain('api');
      expect(config.scopes).toContain('refresh_token');
      expect(config.refresh_url).toBeDefined();
    });

    it('should have correct ZoomInfo API key configuration', () => {
      const hasZoomInfo = Object.values(OAUTH_PROVIDERS).some(
        provider => provider.provider === 'zoominfo'
      );
      expect(hasZoomInfo).toBe(false);
    });

    it('should have correct HubSpot configuration', () => {
      const config = OAUTH_PROVIDERS.hubspot;

      expect(config.auth_url).toContain('hubspot.com');
      expect(config.scopes).toContain('crm.objects.contacts.read');
      expect(config.scopes).toContain('crm.objects.deals.read');
    });

    it('should have correct LinkedIn configuration', () => {
      const config = OAUTH_PROVIDERS.linkedin;

      expect(config.auth_url).toContain('linkedin.com');
      expect(config.scopes).toContain('r_liteprofile');
    });
  });
});
