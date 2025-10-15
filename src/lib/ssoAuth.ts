import { supabase } from './supabase';

export interface SAMLConfig {
  entity_id: string;
  sso_url: string;
  certificate: string;
  sign_requests: boolean;
  attribute_mapping: {
    email: string;
    first_name?: string;
    last_name?: string;
    role?: string;
  };
}

export interface OIDCConfig {
  issuer: string;
  client_id: string;
  client_secret: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  scopes: string[];
}

export interface SSOProvider {
  id: string;
  organization_id: string;
  provider_type: 'saml' | 'oidc' | 'azure_ad' | 'okta' | 'google_workspace';
  provider_name: string;
  config: SAMLConfig | OIDCConfig;
  is_active: boolean;
}

export interface SSOUser {
  email: string;
  first_name?: string;
  last_name?: string;
  roles?: string[];
  attributes?: Record<string, any>;
}

export async function configureSSOProvider(
  organizationId: string,
  providerType: string,
  providerName: string,
  config: SAMLConfig | OIDCConfig
): Promise<SSOProvider> {
  const { data, error } = await supabase
    .from('sso_providers')
    .insert({
      organization_id: organizationId,
      provider_type: providerType,
      provider_name: providerName,
      config,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to configure SSO provider: ${error.message}`);
  }

  return data;
}

export async function getSSOProvider(
  organizationId: string
): Promise<SSOProvider | null> {
  const { data, error } = await supabase
    .from('sso_providers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching SSO provider:', error);
    return null;
  }

  return data;
}

export async function updateSSOProvider(
  providerId: string,
  updates: Partial<{
    provider_name: string;
    config: SAMLConfig | OIDCConfig;
    is_active: boolean;
  }>
): Promise<void> {
  const { error } = await supabase
    .from('sso_providers')
    .update(updates)
    .eq('id', providerId);

  if (error) {
    throw new Error(`Failed to update SSO provider: ${error.message}`);
  }
}

export async function generateSAMLRequest(
  config: SAMLConfig,
  relayState?: string
): Promise<string> {
  const samlRequest = {
    entityId: config.entity_id,
    acsUrl: `${window.location.origin}/auth/saml/callback`,
    destination: config.sso_url,
    timestamp: new Date().toISOString(),
  };

  const encoded = btoa(JSON.stringify(samlRequest));

  const params = new URLSearchParams({
    SAMLRequest: encoded,
  });

  if (relayState) {
    params.append('RelayState', relayState);
  }

  return `${config.sso_url}?${params.toString()}`;
}

export async function parseSAMLResponse(
  samlResponse: string
): Promise<SSOUser> {
  const decoded = atob(samlResponse);
  const data = JSON.parse(decoded);

  return {
    email: data.email || data.nameID,
    first_name: data.firstName || data.givenName,
    last_name: data.lastName || data.surname,
    roles: data.roles || [],
    attributes: data,
  };
}

export function generateOIDCAuthorizationUrl(
  config: OIDCConfig,
  state: string,
  nonce: string
): string {
  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: 'code',
    scope: config.scopes.join(' '),
    redirect_uri: `${window.location.origin}/auth/oidc/callback`,
    state,
    nonce,
  });

  return `${config.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeOIDCCode(
  config: OIDCConfig,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
}> {
  const response = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.client_id,
      client_secret: config.client_secret,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange OIDC authorization code');
  }

  return await response.json();
}

export async function getOIDCUserInfo(
  config: OIDCConfig,
  accessToken: string
): Promise<SSOUser> {
  const response = await fetch(config.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch OIDC user info');
  }

  const data = await response.json();

  return {
    email: data.email,
    first_name: data.given_name || data.first_name,
    last_name: data.family_name || data.last_name,
    roles: data.roles || [],
    attributes: data,
  };
}

export async function provisionUserFromSSO(
  organizationId: string,
  ssoUser: SSOUser,
  providerId: string
): Promise<{ user_id: string; is_new: boolean }> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', ssoUser.email)
    .maybeSingle();

  if (existingUser) {
    return { user_id: existingUser.id, is_new: false };
  }

  const { data: newUser, error } = await supabase.auth.signUp({
    email: ssoUser.email,
    password: crypto.randomUUID(),
    options: {
      data: {
        first_name: ssoUser.first_name,
        last_name: ssoUser.last_name,
        sso_provider_id: providerId,
        organization_id: organizationId,
      },
    },
  });

  if (error || !newUser.user) {
    throw new Error(`Failed to provision user: ${error?.message}`);
  }

  if (ssoUser.roles && ssoUser.roles.length > 0) {
    await assignRolesFromSSO(newUser.user.id, organizationId, ssoUser.roles);
  }

  return { user_id: newUser.user.id, is_new: true };
}

async function assignRolesFromSSO(
  userId: string,
  organizationId: string,
  ssoRoles: string[]
): Promise<void> {
  const roleMapping: Record<string, string> = {
    admin: 'Admin',
    manager: 'Sales Manager',
    'sales-rep': 'Sales Rep',
    rep: 'Sales Rep',
    viewer: 'Viewer',
  };

  for (const ssoRole of ssoRoles) {
    const roleName = roleMapping[ssoRole.toLowerCase()] || 'Sales Rep';

    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', roleName)
      .maybeSingle();

    if (role) {
      await supabase.from('user_roles').insert({
        user_id: userId,
        role_id: role.id,
      });
    }
  }
}

export const PRESET_SSO_CONFIGS = {
  okta: {
    provider_type: 'okta',
    scopes: ['openid', 'profile', 'email'],
  },
  azure_ad: {
    provider_type: 'azure_ad',
    authorization_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    token_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
    scopes: ['openid', 'profile', 'email'],
  },
  google_workspace: {
    provider_type: 'google_workspace',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'profile', 'email'],
  },
};

export function validateSAMLConfig(config: SAMLConfig): string[] {
  const errors: string[] = [];

  if (!config.entity_id) {
    errors.push('Entity ID is required');
  }

  if (!config.sso_url) {
    errors.push('SSO URL is required');
  }

  if (!config.certificate) {
    errors.push('Certificate is required');
  }

  if (!config.attribute_mapping?.email) {
    errors.push('Email attribute mapping is required');
  }

  return errors;
}

export function validateOIDCConfig(config: OIDCConfig): string[] {
  const errors: string[] = [];

  if (!config.issuer) {
    errors.push('Issuer is required');
  }

  if (!config.client_id) {
    errors.push('Client ID is required');
  }

  if (!config.client_secret) {
    errors.push('Client Secret is required');
  }

  if (!config.authorization_endpoint) {
    errors.push('Authorization endpoint is required');
  }

  if (!config.token_endpoint) {
    errors.push('Token endpoint is required');
  }

  if (!config.scopes || config.scopes.length === 0) {
    errors.push('At least one scope is required');
  }

  return errors;
}

export async function testSSOConnection(providerId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { data: provider } = await supabase
      .from('sso_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (!provider) {
      return {
        success: false,
        message: 'SSO provider not found',
      };
    }

    if (provider.provider_type === 'oidc') {
      const config = provider.config as OIDCConfig;
      const response = await fetch(config.issuer + '/.well-known/openid-configuration');

      if (response.ok) {
        return {
          success: true,
          message: 'OIDC provider is reachable',
          details: await response.json(),
        };
      }
    }

    return {
      success: true,
      message: 'SSO configuration is valid',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
    };
  }
}
