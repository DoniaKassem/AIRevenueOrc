import { supabase } from './supabase';

export interface OAuthConfig {
  provider: string;
  client_id: string;
  client_secret?: string;
  redirect_uri: string;
  scopes: string[];
  auth_url: string;
  token_url: string;
  refresh_url?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
}

export interface IntegrationConnection {
  id: string;
  team_id: string;
  provider: string;
  status: 'active' | 'inactive' | 'error';
  tokens: OAuthTokens;
  config: any;
  last_sync_at?: string;
  created_at: string;
}

export const OAUTH_PROVIDERS: Record<string, Omit<OAuthConfig, 'client_id' | 'client_secret' | 'redirect_uri'>> = {
  salesforce: {
    provider: 'salesforce',
    scopes: ['api', 'refresh_token', 'full'],
    auth_url: 'https://login.salesforce.com/services/oauth2/authorize',
    token_url: 'https://login.salesforce.com/services/oauth2/token',
    refresh_url: 'https://login.salesforce.com/services/oauth2/token',
  },
  hubspot: {
    provider: 'hubspot',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
    auth_url: 'https://app.hubspot.com/oauth/authorize',
    token_url: 'https://api.hubapi.com/oauth/v1/token',
    refresh_url: 'https://api.hubapi.com/oauth/v1/token',
  },
  gmail: {
    provider: 'gmail',
    scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    refresh_url: 'https://oauth2.googleapis.com/token',
  },
  outlook: {
    provider: 'outlook',
    scopes: ['Mail.Send', 'Mail.Read', 'Calendars.ReadWrite'],
    auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    refresh_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  'google-calendar': {
    provider: 'google-calendar',
    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_url: 'https://oauth2.googleapis.com/token',
    refresh_url: 'https://oauth2.googleapis.com/token',
  },
  slack: {
    provider: 'slack',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    auth_url: 'https://slack.com/oauth/v2/authorize',
    token_url: 'https://slack.com/api/oauth.v2.access',
  },
  linkedin: {
    provider: 'linkedin',
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
    auth_url: 'https://www.linkedin.com/oauth/v2/authorization',
    token_url: 'https://www.linkedin.com/oauth/v2/accessToken',
    refresh_url: 'https://www.linkedin.com/oauth/v2/accessToken',
  },
};

export function generateAuthorizationUrl(
  provider: string,
  clientId: string,
  redirectUri: string,
  state: string,
  additionalParams?: Record<string, string>
): string {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    ...additionalParams,
  });

  if (provider === 'gmail' || provider === 'google-calendar') {
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');
  }

  return `${config.auth_url}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  provider: string,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(config.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scope: data.scope,
  };
}

export async function refreshAccessToken(
  provider: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokens> {
  const config = OAUTH_PROVIDERS[provider];
  if (!config || !config.refresh_url) {
    throw new Error(`Provider ${provider} does not support token refresh`);
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(config.refresh_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scope: data.scope,
  };
}

export async function saveIntegrationTokens(
  teamId: string,
  providerId: string,
  tokens: OAuthTokens,
  config?: any
): Promise<IntegrationConnection> {
  const { data: existing } = await supabase
    .from('team_integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('team_integrations')
      .update({
        auth_data: tokens,
        status: 'active',
        config: config || existing.config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update integration: ${error.message}`);
    }

    return {
      id: data.id,
      team_id: data.team_id,
      provider: providerId,
      status: data.status,
      tokens: data.auth_data,
      config: data.config,
      last_sync_at: data.last_sync_at,
      created_at: data.created_at,
    };
  } else {
    const { data, error } = await supabase
      .from('team_integrations')
      .insert({
        team_id: teamId,
        provider_id: providerId,
        auth_data: tokens,
        status: 'active',
        config: config || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create integration: ${error.message}`);
    }

    return {
      id: data.id,
      team_id: data.team_id,
      provider: providerId,
      status: data.status,
      tokens: data.auth_data,
      config: data.config,
      created_at: data.created_at,
    };
  }
}

export async function getIntegrationTokens(
  teamId: string,
  providerId: string
): Promise<OAuthTokens | null> {
  const { data, error } = await supabase
    .from('team_integrations')
    .select('auth_data')
    .eq('team_id', teamId)
    .eq('provider_id', providerId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.auth_data;
}

export async function ensureValidToken(
  teamId: string,
  providerId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokens = await getIntegrationTokens(teamId, providerId);

  if (!tokens) {
    throw new Error('Integration not connected');
  }

  if (tokens.expires_at && tokens.expires_at < Date.now() + 60000) {
    if (!tokens.refresh_token) {
      throw new Error('Token expired and no refresh token available');
    }

    const { data: integration } = await supabase
      .from('team_integrations')
      .select('id')
      .eq('team_id', teamId)
      .eq('provider_id', providerId)
      .single();

    if (!integration) {
      throw new Error('Integration not found');
    }

    const { data: provider } = await supabase
      .from('integration_providers')
      .select('name')
      .eq('id', providerId)
      .single();

    if (!provider) {
      throw new Error('Provider not found');
    }

    const newTokens = await refreshAccessToken(
      provider.name.toLowerCase().replace(/\s+/g, '-'),
      tokens.refresh_token,
      clientId,
      clientSecret
    );

    await supabase
      .from('team_integrations')
      .update({ auth_data: newTokens })
      .eq('id', integration.id);

    return newTokens.access_token;
  }

  return tokens.access_token;
}

export async function revokeIntegration(
  teamId: string,
  providerId: string
): Promise<void> {
  const { error } = await supabase
    .from('team_integrations')
    .update({ status: 'inactive', auth_data: {} })
    .eq('team_id', teamId)
    .eq('provider_id', providerId);

  if (error) {
    throw new Error(`Failed to revoke integration: ${error.message}`);
  }
}

export function generateOAuthState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function validateOAuthState(state: string, expectedState: string): Promise<boolean> {
  return state === expectedState;
}
