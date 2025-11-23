/**
 * Integration Marketplace
 * Third-party app integrations, OAuth apps, and API management
 */

import { supabase } from '../supabase';

export interface Integration {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  category: 'crm' | 'email' | 'calendar' | 'marketing' | 'sales' | 'support' | 'analytics' | 'productivity' | 'communication' | 'other';
  icon: string;
  screenshots?: string[];

  // Publisher
  publisher: {
    name: string;
    website?: string;
    supportEmail?: string;
  };

  // Capabilities
  capabilities: IntegrationCapability[];
  scopes: string[]; // OAuth scopes required

  // Configuration
  configFields?: ConfigField[];
  webhookUrl?: string;
  oauthConfig?: {
    authorizationUrl: string;
    tokenUrl: string;
    clientId?: string;
    clientSecret?: string;
    scopes: string[];
  };

  // Status
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'deprecated';
  isOfficial: boolean;
  isFeatured: boolean;
  isPremium: boolean;

  // Pricing
  pricing?: {
    model: 'free' | 'paid' | 'freemium';
    price?: number;
    billingPeriod?: 'monthly' | 'yearly' | 'one_time';
  };

  // Analytics
  installCount: number;
  rating: number;
  reviewCount: number;

  // Metadata
  version: string;
  minPlatformVersion?: string;
  lastUpdated: Date;
  createdBy: string;
  createdAt: Date;
}

export interface IntegrationCapability {
  type: 'sync' | 'action' | 'trigger' | 'oauth' | 'webhook';
  name: string;
  description: string;
  config?: any;
}

export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'boolean';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface IntegrationInstallation {
  id: string;
  integrationId: string;
  organizationId: string;
  userId: string;

  // Configuration
  config: Record<string, any>;

  // OAuth
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;

  // Status
  status: 'active' | 'paused' | 'error' | 'disconnected';
  lastSyncAt?: Date;
  lastError?: string;

  // Analytics
  syncCount: number;
  recordsSynced: number;

  installedAt: Date;
  updatedAt: Date;
}

export interface IntegrationLog {
  id: string;
  installationId: string;
  action: string;
  direction: 'inbound' | 'outbound';
  status: 'success' | 'error';
  recordCount: number;
  duration: number; // ms
  error?: string;
  metadata?: any;
  executedAt: Date;
}

export interface IntegrationReview {
  id: string;
  integrationId: string;
  userId: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  helpfulCount: number;
  verified: boolean; // Has user actually installed it?
  createdAt: Date;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  userId: string;
  organizationId: string;

  // Permissions
  scopes: string[];
  ipWhitelist?: string[];

  // Rate Limiting
  rateLimit: {
    requests: number;
    period: 'second' | 'minute' | 'hour' | 'day';
  };

  // Status
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;

  // Analytics
  requestCount: number;

  createdAt: Date;
}

export interface APIUsage {
  id: string;
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ipAddress: string;
  userAgent: string;
  requestedAt: Date;
}

/**
 * Integration Marketplace Service
 */
export class IntegrationMarketplaceService {
  /**
   * Create integration
   */
  async createIntegration(integration: Partial<Integration>): Promise<Integration> {
    const slug = integration.slug || this.generateSlug(integration.name || 'integration');

    const { data, error } = await supabase
      .from('integrations')
      .insert({
        name: integration.name,
        slug,
        description: integration.description,
        long_description: integration.longDescription,
        category: integration.category || 'other',
        icon: integration.icon,
        screenshots: integration.screenshots,
        publisher: integration.publisher,
        capabilities: integration.capabilities || [],
        scopes: integration.scopes || [],
        config_fields: integration.configFields,
        webhook_url: integration.webhookUrl,
        oauth_config: integration.oauthConfig,
        status: 'pending_review',
        is_official: false,
        is_featured: false,
        is_premium: integration.isPremium || false,
        pricing: integration.pricing,
        install_count: 0,
        rating: 0,
        review_count: 0,
        version: integration.version || '1.0.0',
        min_platform_version: integration.minPlatformVersion,
        created_by: integration.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapIntegration(data);
  }

  /**
   * Update integration
   */
  async updateIntegration(integrationId: string, updates: Partial<Integration>): Promise<Integration> {
    const { data, error } = await supabase
      .from('integrations')
      .update({
        name: updates.name,
        description: updates.description,
        long_description: updates.longDescription,
        category: updates.category,
        icon: updates.icon,
        screenshots: updates.screenshots,
        publisher: updates.publisher,
        capabilities: updates.capabilities,
        scopes: updates.scopes,
        config_fields: updates.configFields,
        webhook_url: updates.webhookUrl,
        oauth_config: updates.oauthConfig,
        pricing: updates.pricing,
        version: updates.version,
        min_platform_version: updates.minPlatformVersion,
        last_updated: new Date().toISOString()
      })
      .eq('id', integrationId)
      .select()
      .single();

    if (error) throw error;
    return this.mapIntegration(data);
  }

  /**
   * Approve integration
   */
  async approveIntegration(integrationId: string): Promise<Integration> {
    const { data, error } = await supabase
      .from('integrations')
      .update({ status: 'approved' })
      .eq('id', integrationId)
      .select()
      .single();

    if (error) throw error;
    return this.mapIntegration(data);
  }

  /**
   * Get integration
   */
  async getIntegration(integrationId: string): Promise<Integration> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error) throw error;
    return this.mapIntegration(data);
  }

  /**
   * Get integrations
   */
  async getIntegrations(filters?: {
    category?: string;
    status?: Integration['status'];
    isFeatured?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Integration[]> {
    let query = supabase
      .from('integrations')
      .select('*')
      .order('install_count', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    } else {
      query = query.eq('status', 'approved'); // Default to approved only
    }

    if (filters?.isFeatured !== undefined) {
      query = query.eq('is_featured', filters.isFeatured);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapIntegration);
  }

  /**
   * Install integration
   */
  async installIntegration(
    integrationId: string,
    organizationId: string,
    userId: string,
    config: Record<string, any>
  ): Promise<IntegrationInstallation> {
    const integration = await this.getIntegration(integrationId);

    // Validate required config fields
    this.validateConfig(config, integration.configFields || []);

    const { data, error } = await supabase
      .from('integration_installations')
      .insert({
        integration_id: integrationId,
        organization_id: organizationId,
        user_id: userId,
        config,
        status: 'active',
        sync_count: 0,
        records_synced: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Increment install count
    await supabase
      .from('integrations')
      .update({ install_count: integration.installCount + 1 })
      .eq('id', integrationId);

    return this.mapInstallation(data);
  }

  /**
   * Uninstall integration
   */
  async uninstallIntegration(installationId: string): Promise<void> {
    const installation = await this.getInstallation(installationId);

    await supabase
      .from('integration_installations')
      .delete()
      .eq('id', installationId);

    // Decrement install count
    const integration = await this.getIntegration(installation.integrationId);
    await supabase
      .from('integrations')
      .update({ install_count: Math.max(0, integration.installCount - 1) })
      .eq('id', installation.integrationId);
  }

  /**
   * Get installation
   */
  async getInstallation(installationId: string): Promise<IntegrationInstallation> {
    const { data, error } = await supabase
      .from('integration_installations')
      .select('*')
      .eq('id', installationId)
      .single();

    if (error) throw error;
    return this.mapInstallation(data);
  }

  /**
   * Get installations
   */
  async getInstallations(organizationId: string): Promise<IntegrationInstallation[]> {
    const { data } = await supabase
      .from('integration_installations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('installed_at', { ascending: false });

    return (data || []).map(this.mapInstallation);
  }

  /**
   * Log integration action
   */
  async logAction(log: Partial<IntegrationLog>): Promise<IntegrationLog> {
    const { data, error } = await supabase
      .from('integration_logs')
      .insert({
        installation_id: log.installationId,
        action: log.action,
        direction: log.direction,
        status: log.status,
        record_count: log.recordCount || 0,
        duration: log.duration || 0,
        error: log.error,
        metadata: log.metadata
      })
      .select()
      .single();

    if (error) throw error;

    // Update installation stats
    if (log.status === 'success') {
      const installation = await this.getInstallation(log.installationId!);
      await supabase
        .from('integration_installations')
        .update({
          sync_count: installation.syncCount + 1,
          records_synced: installation.recordsSynced + (log.recordCount || 0),
          last_sync_at: new Date().toISOString()
        })
        .eq('id', log.installationId);
    }

    return this.mapLog(data);
  }

  /**
   * Get logs
   */
  async getLogs(installationId: string, limit: number = 100): Promise<IntegrationLog[]> {
    const { data } = await supabase
      .from('integration_logs')
      .select('*')
      .eq('installation_id', installationId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapLog);
  }

  /**
   * Create review
   */
  async createReview(review: Partial<IntegrationReview>): Promise<IntegrationReview> {
    // Check if user has installed this integration
    const { data: installations } = await supabase
      .from('integration_installations')
      .select('id')
      .eq('integration_id', review.integrationId)
      .eq('user_id', review.userId)
      .limit(1);

    const verified = (installations?.length || 0) > 0;

    const { data, error } = await supabase
      .from('integration_reviews')
      .insert({
        integration_id: review.integrationId,
        user_id: review.userId,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        helpful_count: 0,
        verified
      })
      .select()
      .single();

    if (error) throw error;

    // Update integration rating
    await this.updateIntegrationRating(review.integrationId!);

    return this.mapReview(data);
  }

  /**
   * Get reviews
   */
  async getReviews(integrationId: string): Promise<IntegrationReview[]> {
    const { data } = await supabase
      .from('integration_reviews')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapReview);
  }

  /**
   * Create API key
   */
  async createAPIKey(apiKey: Partial<APIKey>): Promise<APIKey> {
    const key = this.generateAPIKey();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name: apiKey.name,
        key,
        user_id: apiKey.userId,
        organization_id: apiKey.organizationId,
        scopes: apiKey.scopes || [],
        ip_whitelist: apiKey.ipWhitelist,
        rate_limit: apiKey.rateLimit || { requests: 100, period: 'minute' },
        is_active: true,
        expires_at: apiKey.expiresAt?.toISOString(),
        request_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAPIKey(data);
  }

  /**
   * Get API keys
   */
  async getAPIKeys(organizationId: string): Promise<APIKey[]> {
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapAPIKey);
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: string): Promise<void> {
    await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);
  }

  /**
   * Track API usage
   */
  async trackAPIUsage(usage: Partial<APIUsage>): Promise<void> {
    await supabase
      .from('api_usage')
      .insert({
        api_key_id: usage.apiKeyId,
        endpoint: usage.endpoint,
        method: usage.method,
        status_code: usage.statusCode,
        response_time: usage.responseTime,
        ip_address: usage.ipAddress,
        user_agent: usage.userAgent
      });

    // Update API key stats
    await supabase
      .from('api_keys')
      .update({
        request_count: supabase.rpc('increment', { x: 1 }),
        last_used_at: new Date().toISOString()
      })
      .eq('id', usage.apiKeyId);
  }

  /**
   * Get API usage
   */
  async getAPIUsage(apiKeyId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<APIUsage[]> {
    let query = supabase
      .from('api_usage')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .order('requested_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('requested_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('requested_at', filters.endDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data } = await query;
    return (data || []).map(this.mapAPIUsage);
  }

  /**
   * Validate config
   */
  private validateConfig(config: Record<string, any>, fields: ConfigField[]): void {
    for (const field of fields) {
      if (field.required && !config[field.name]) {
        throw new Error(`Field ${field.label} is required`);
      }
    }
  }

  /**
   * Update integration rating
   */
  private async updateIntegrationRating(integrationId: string): Promise<void> {
    const { data: reviews } = await supabase
      .from('integration_reviews')
      .select('rating')
      .eq('integration_id', integrationId);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await supabase
        .from('integrations')
        .update({
          rating: Math.round(avgRating * 10) / 10,
          review_count: reviews.length
        })
        .eq('id', integrationId);
    }
  }

  /**
   * Generate API key
   */
  private generateAPIKey(): string {
    const prefix = 'airo_';
    const random = Math.random().toString(36).substring(2, 15) +
                   Math.random().toString(36).substring(2, 15) +
                   Math.random().toString(36).substring(2, 15);
    return prefix + random;
  }

  /**
   * Generate slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Map database record to Integration
   */
  private mapIntegration(data: any): Integration {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      longDescription: data.long_description,
      category: data.category,
      icon: data.icon,
      screenshots: data.screenshots,
      publisher: data.publisher,
      capabilities: data.capabilities,
      scopes: data.scopes,
      configFields: data.config_fields,
      webhookUrl: data.webhook_url,
      oauthConfig: data.oauth_config,
      status: data.status,
      isOfficial: data.is_official,
      isFeatured: data.is_featured,
      isPremium: data.is_premium,
      pricing: data.pricing,
      installCount: data.install_count,
      rating: data.rating,
      reviewCount: data.review_count,
      version: data.version,
      minPlatformVersion: data.min_platform_version,
      lastUpdated: new Date(data.last_updated || data.created_at),
      createdBy: data.created_by,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to IntegrationInstallation
   */
  private mapInstallation(data: any): IntegrationInstallation {
    return {
      id: data.id,
      integrationId: data.integration_id,
      organizationId: data.organization_id,
      userId: data.user_id,
      config: data.config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
      status: data.status,
      lastSyncAt: data.last_sync_at ? new Date(data.last_sync_at) : undefined,
      lastError: data.last_error,
      syncCount: data.sync_count,
      recordsSynced: data.records_synced,
      installedAt: new Date(data.installed_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to IntegrationLog
   */
  private mapLog(data: any): IntegrationLog {
    return {
      id: data.id,
      installationId: data.installation_id,
      action: data.action,
      direction: data.direction,
      status: data.status,
      recordCount: data.record_count,
      duration: data.duration,
      error: data.error,
      metadata: data.metadata,
      executedAt: new Date(data.executed_at)
    };
  }

  /**
   * Map database record to IntegrationReview
   */
  private mapReview(data: any): IntegrationReview {
    return {
      id: data.id,
      integrationId: data.integration_id,
      userId: data.user_id,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      helpfulCount: data.helpful_count,
      verified: data.verified,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to APIKey
   */
  private mapAPIKey(data: any): APIKey {
    return {
      id: data.id,
      name: data.name,
      key: data.key,
      userId: data.user_id,
      organizationId: data.organization_id,
      scopes: data.scopes,
      ipWhitelist: data.ip_whitelist,
      rateLimit: data.rate_limit,
      isActive: data.is_active,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
      requestCount: data.request_count,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to APIUsage
   */
  private mapAPIUsage(data: any): APIUsage {
    return {
      id: data.id,
      apiKeyId: data.api_key_id,
      endpoint: data.endpoint,
      method: data.method,
      statusCode: data.status_code,
      responseTime: data.response_time,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      requestedAt: new Date(data.requested_at)
    };
  }
}

/**
 * Create Integration Marketplace Service
 */
export function createIntegrationMarketplaceService(): IntegrationMarketplaceService {
  return new IntegrationMarketplaceService();
}
