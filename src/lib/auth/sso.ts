/**
 * SSO (Single Sign-On) Orchestrator
 * Manages SSO authentication flows across different providers
 */

import { createSAMLProvider, createSAMLManager, SAMLConfig, SAMLAssertion } from './saml';
import { supabase } from '../supabase';

export type SSOProvider = 'okta' | 'azure_ad' | 'google_workspace' | 'onelogin' | 'custom_saml';

export interface SSOSession {
  id: string;
  userId: string;
  organizationId: string;
  provider: SSOProvider;
  sessionIndex?: string;
  expiresAt: Date;
  metadata: {
    ipAddress: string;
    userAgent: string;
    loginAt: Date;
  };
}

export interface SSOLoginRequest {
  organizationId?: string;
  email?: string;
  returnUrl?: string;
}

export interface SSOLoginResult {
  success: boolean;
  redirectUrl?: string;
  session?: SSOSession;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
  error?: string;
}

export interface SSOCallbackRequest {
  samlResponse: string;
  relayState?: string;
}

/**
 * SSO Orchestrator
 * Handles SSO flows for different providers
 */
export class SSOOrchestrator {
  private samlManager = createSAMLManager();

  /**
   * Initiate SSO login
   *
   * @param request - SSO login request with org/email
   * @returns Redirect URL to IdP or error
   */
  async initiateLogin(request: SSOLoginRequest): Promise<SSOLoginResult> {
    try {
      // Find organization by domain or ID
      const organizationId = await this.resolveOrganization(request);

      if (!organizationId) {
        return {
          success: false,
          error: 'Organization not found or SSO not configured',
        };
      }

      // Get SAML config
      const samlConfig = await this.samlManager.getSAMLConfig(organizationId);

      if (!samlConfig || !samlConfig.isActive) {
        return {
          success: false,
          error: 'SSO not configured for this organization',
        };
      }

      // Generate SAML auth request
      const samlProvider = createSAMLProvider(samlConfig);
      const authRequest = samlProvider.generateAuthRequest(request.returnUrl);

      // Build redirect URL
      const redirectUrl = this.buildIdPRedirectUrl(
        samlConfig.idpSsoUrl,
        authRequest.samlRequest,
        authRequest.relayState
      );

      // Log SSO attempt
      await this.logSSOAttempt({
        organizationId,
        provider: samlConfig.provider,
        action: 'login_initiated',
        success: true,
      });

      return {
        success: true,
        redirectUrl,
      };
    } catch (error) {
      console.error('[SSO] Login initiation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO login failed',
      };
    }
  }

  /**
   * Handle SSO callback (SAML response from IdP)
   *
   * @param request - Callback request with SAML response
   * @returns Login result with user and session
   */
  async handleCallback(
    request: SSOCallbackRequest,
    metadata: { ipAddress: string; userAgent: string }
  ): Promise<SSOLoginResult> {
    try {
      // Parse SAML response
      // Note: We need to determine which org this is for from the SAML response
      // In production, you'd typically store the RelayState or use the audience to determine this

      // For now, we'll try to parse the response with any active SAML config
      // In production, you'd have better state management (e.g., stored in Redis with the RelayState)

      const { assertion, samlConfig } = await this.parseSAMLResponse(request.samlResponse);

      // Map SAML attributes to user
      const samlProvider = createSAMLProvider(samlConfig);
      const userAttributes = samlProvider.mapAttributesToUser(assertion.attributes);

      // Find or create user
      const user = await this.findOrCreateUser({
        email: userAttributes.email,
        firstName: userAttributes.firstName,
        lastName: userAttributes.lastName,
        displayName: userAttributes.displayName,
        organizationId: samlConfig.organizationId,
        ssoProvider: samlConfig.provider,
      });

      // Create session
      const session = await this.createSession({
        userId: user.id,
        organizationId: samlConfig.organizationId,
        provider: samlConfig.provider,
        sessionIndex: assertion.sessionIndex,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });

      // Log successful login
      await this.logSSOAttempt({
        organizationId: samlConfig.organizationId,
        provider: samlConfig.provider,
        userId: user.id,
        action: 'login_success',
        success: true,
      });

      // Update last used timestamp
      await this.updateLastUsed(samlConfig.organizationId);

      return {
        success: true,
        session,
        user,
      };
    } catch (error) {
      console.error('[SSO] Callback handling failed:', error);

      // Log failed login
      await this.logSSOAttempt({
        organizationId: 'unknown',
        provider: 'unknown' as any,
        action: 'login_failed',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO callback failed',
      };
    }
  }

  /**
   * Initiate SSO logout
   */
  async initiateLogout(sessionId: string): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
    try {
      // Get session
      const { data: session } = await supabase
        .from('sso_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      // Get SAML config
      const samlConfig = await this.samlManager.getSAMLConfig(session.organization_id);

      if (!samlConfig) {
        // Just delete local session
        await this.deleteSession(sessionId);
        return { success: true };
      }

      // If IdP supports SLO (Single Logout), redirect there
      if (samlConfig.idpSloUrl) {
        // Generate logout request
        // Note: Full implementation would generate a proper SAML LogoutRequest
        const redirectUrl = samlConfig.idpSloUrl;

        // Delete local session
        await this.deleteSession(sessionId);

        return { success: true, redirectUrl };
      }

      // Just delete local session
      await this.deleteSession(sessionId);

      return { success: true };
    } catch (error) {
      console.error('[SSO] Logout failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  }

  /**
   * Validate SSO session
   */
  async validateSession(sessionId: string): Promise<{ valid: boolean; session?: SSOSession }> {
    try {
      const { data: session } = await supabase
        .from('sso_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('is_active', true)
        .single();

      if (!session) {
        return { valid: false };
      }

      // Check expiration
      const expiresAt = new Date(session.expires_at);
      if (expiresAt < new Date()) {
        await this.deleteSession(sessionId);
        return { valid: false };
      }

      return {
        valid: true,
        session: {
          id: session.id,
          userId: session.user_id,
          organizationId: session.organization_id,
          provider: session.provider,
          sessionIndex: session.session_index,
          expiresAt,
          metadata: {
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            loginAt: new Date(session.created_at),
          },
        },
      };
    } catch (error) {
      console.error('[SSO] Session validation failed:', error);
      return { valid: false };
    }
  }

  /**
   * Get active SSO sessions for user
   */
  async getUserSessions(userId: string): Promise<SSOSession[]> {
    const { data: sessions } = await supabase
      .from('sso_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!sessions) {
      return [];
    }

    return sessions.map(s => ({
      id: s.id,
      userId: s.user_id,
      organizationId: s.organization_id,
      provider: s.provider,
      sessionIndex: s.session_index,
      expiresAt: new Date(s.expires_at),
      metadata: {
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        loginAt: new Date(s.created_at),
      },
    }));
  }

  /**
   * Revoke SSO session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  /**
   * Revoke all SSO sessions for user
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await supabase
      .from('sso_sessions')
      .update({ is_active: false })
      .eq('user_id', userId);
  }

  // Private helper methods

  private async resolveOrganization(request: SSOLoginRequest): Promise<string | null> {
    if (request.organizationId) {
      return request.organizationId;
    }

    if (request.email) {
      const domain = request.email.split('@')[1];

      // Find organization by email domain
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .contains('email_domains', [domain])
        .single();

      return data?.id || null;
    }

    return null;
  }

  private async parseSAMLResponse(samlResponse: string): Promise<{
    assertion: SAMLAssertion;
    samlConfig: SAMLConfig;
  }> {
    // In production, you'd look up the correct SAML config based on the RelayState or Issuer
    // For now, we'll try all active SAML configs

    const { data: configs } = await supabase
      .from('sso_providers')
      .select('*')
      .eq('provider_type', 'saml')
      .eq('is_active', true);

    if (!configs || configs.length === 0) {
      throw new Error('No active SAML configurations found');
    }

    // Try to parse with each config until one works
    for (const configData of configs) {
      try {
        const samlManager = createSAMLManager();
        const samlConfig = await samlManager.getSAMLConfig(configData.organization_id);

        if (!samlConfig) continue;

        const samlProvider = createSAMLProvider(samlConfig);
        const assertion = await samlProvider.parseResponse(samlResponse);

        return { assertion, samlConfig };
      } catch (error) {
        // Try next config
        continue;
      }
    }

    throw new Error('Failed to parse SAML response with any configured provider');
  }

  private async findOrCreateUser(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    organizationId: string;
    ssoProvider: SSOProvider;
  }): Promise<{ id: string; email: string; firstName?: string; lastName?: string; displayName?: string }> {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, display_name')
      .eq('email', params.email)
      .single();

    if (existingUser) {
      // Update user if attributes changed
      await supabase
        .from('users')
        .update({
          first_name: params.firstName || existingUser.first_name,
          last_name: params.lastName || existingUser.last_name,
          display_name: params.displayName || existingUser.display_name,
          last_login_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      return {
        id: existingUser.id,
        email: existingUser.email,
        firstName: params.firstName || existingUser.first_name,
        lastName: params.lastName || existingUser.last_name,
        displayName: params.displayName || existingUser.display_name,
      };
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        display_name: params.displayName,
        organization_id: params.organizationId,
        auth_provider: params.ssoProvider,
        email_verified: true, // SSO users are pre-verified
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      displayName: newUser.display_name,
    };
  }

  private async createSession(params: {
    userId: string;
    organizationId: string;
    provider: SSOProvider;
    sessionIndex?: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<SSOSession> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8-hour session

    const { data: session, error } = await supabase
      .from('sso_sessions')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        provider: params.provider,
        session_index: params.sessionIndex,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return {
      id: session.id,
      userId: session.user_id,
      organizationId: session.organization_id,
      provider: session.provider,
      sessionIndex: session.session_index,
      expiresAt,
      metadata: {
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        loginAt: new Date(),
      },
    };
  }

  private async deleteSession(sessionId: string): Promise<void> {
    await supabase
      .from('sso_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
  }

  private buildIdPRedirectUrl(idpSsoUrl: string, samlRequest: string, relayState?: string): string {
    const url = new URL(idpSsoUrl);
    url.searchParams.set('SAMLRequest', samlRequest);

    if (relayState) {
      url.searchParams.set('RelayState', relayState);
    }

    return url.toString();
  }

  private async logSSOAttempt(params: {
    organizationId: string;
    provider: SSOProvider | 'unknown';
    userId?: string;
    action: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await supabase.from('sso_audit_log').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      provider: params.provider,
      action: params.action,
      success: params.success,
      error_message: params.errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private async updateLastUsed(organizationId: string): Promise<void> {
    await supabase
      .from('sso_providers')
      .update({ last_used: new Date().toISOString() })
      .eq('organization_id', organizationId);
  }
}

/**
 * Create SSO orchestrator instance
 */
export function createSSOOrchestrator(): SSOOrchestrator {
  return new SSOOrchestrator();
}

/**
 * SSO Helper Functions
 */

/**
 * Check if organization has SSO enabled
 */
export async function isSSOEnabled(organizationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('sso_providers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single();

  return !!data;
}

/**
 * Get SSO provider for organization
 */
export async function getSSOProvider(organizationId: string): Promise<SSOProvider | null> {
  const { data } = await supabase
    .from('sso_providers')
    .select('provider_name')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single();

  return data?.provider_name || null;
}

/**
 * Require SSO for organization
 */
export async function requireSSO(organizationId: string): Promise<void> {
  await supabase
    .from('organizations')
    .update({ require_sso: true })
    .eq('id', organizationId);
}

/**
 * Disable SSO requirement
 */
export async function disableRequireSSO(organizationId: string): Promise<void> {
  await supabase
    .from('organizations')
    .update({ require_sso: false })
    .eq('id', organizationId);
}
