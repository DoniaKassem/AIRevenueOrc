/**
 * API Keys Management Service
 *
 * Handles API key operations:
 * - Generate API keys
 * - List API keys
 * - Revoke API keys
 * - Validate API keys
 * - Track usage
 */

import { supabase } from '../supabase';
import crypto from 'crypto';

// =============================================
// TYPES
// =============================================

export interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'revoked';
  requestCount: number;
  organizationId: string;
  userId: string;
}

export interface CreateAPIKeyParams {
  name: string;
  scopes: string[];
  organizationId: string;
  userId: string;
  expiresIn?: number; // seconds, null for never
}

// =============================================
// SERVICE
// =============================================

export class APIKeyService {
  private readonly PREFIX = 'sk_live_';
  private readonly KEY_LENGTH = 32;

  /**
   * Generate a new API key
   */
  async createAPIKey(params: CreateAPIKeyParams): Promise<{ apiKey: APIKey; key: string }> {
    // Generate random key
    const randomKey = crypto.randomBytes(this.KEY_LENGTH).toString('hex');
    const key = `${this.PREFIX}${randomKey}`;

    // Hash the key for storage
    const hashedKey = this.hashKey(key);

    // Calculate expiration
    let expiresAt: string | null = null;
    if (params.expiresIn) {
      const expirationDate = new Date();
      expirationDate.setSeconds(expirationDate.getSeconds() + params.expiresIn);
      expiresAt = expirationDate.toISOString();
    }

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        name: params.name,
        key_hash: hashedKey,
        prefix: this.PREFIX,
        scopes: params.scopes,
        organization_id: params.organizationId,
        user_id: params.userId,
        expires_at: expiresAt,
        status: 'active',
        request_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    const apiKey: APIKey = {
      id: data.id,
      name: data.name,
      key: key, // Return full key only on creation
      prefix: data.prefix,
      scopes: data.scopes,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      expiresAt: data.expires_at,
      status: data.status,
      requestCount: data.request_count,
      organizationId: data.organization_id,
      userId: data.user_id,
    };

    return { apiKey, key };
  }

  /**
   * List all API keys for an organization
   */
  async getAPIKeys(organizationId: string, userId?: string): Promise<APIKey[]> {
    let query = supabase
      .from('api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'expired'])
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((key) => ({
      id: key.id,
      name: key.name,
      key: this.maskKey(key.prefix), // Return masked key for list
      prefix: key.prefix,
      scopes: key.scopes,
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      status: this.getKeyStatus(key.status, key.expires_at),
      requestCount: key.request_count,
      organizationId: key.organization_id,
      userId: key.user_id,
    }));
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string, organizationId: string): Promise<void> {
    const { error } = await supabase
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('id', keyId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  }

  /**
   * Validate an API key and return associated user/org
   */
  async validateAPIKey(key: string): Promise<{
    userId: string;
    organizationId: string;
    scopes: string[];
  } | null> {
    const hashedKey = this.hashKey(key);

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', hashedKey)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('api_keys')
        .update({ status: 'expired' })
        .eq('id', data.id);
      return null;
    }

    // Update last used timestamp and increment request count
    await supabase
      .from('api_keys')
      .update({
        last_used_at: new Date().toISOString(),
        request_count: data.request_count + 1,
      })
      .eq('id', data.id);

    return {
      userId: data.user_id,
      organizationId: data.organization_id,
      scopes: data.scopes,
    };
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Mask an API key for display
   */
  private maskKey(prefix: string): string {
    return `${prefix}${'•'.repeat(20)}****`;
  }

  /**
   * Get the current status of a key
   */
  private getKeyStatus(status: string, expiresAt: string | null): 'active' | 'expired' | 'revoked' {
    if (status === 'revoked') return 'revoked';
    if (expiresAt && new Date(expiresAt) < new Date()) return 'expired';
    return 'active';
  }
}

export const apiKeyService = new APIKeyService();
