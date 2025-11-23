/**
 * CMS Hub - URL Redirects & Domain Management
 * URL mapping, redirects, and domain configuration
 */

import { supabase } from '../supabase';

export interface URLRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  type: 301 | 302 | 307 | 308; // Permanent, Temporary, Temporary (POST), Permanent (POST)
  isActive: boolean;
  matchType: 'exact' | 'prefix' | 'regex';
  preserveQueryString: boolean;
  conditions?: {
    language?: string;
    device?: 'desktop' | 'mobile' | 'tablet';
    country?: string;
  };
  hitCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Domain {
  id: string;
  domain: string;
  isPrimary: boolean;
  isActive: boolean;

  // SSL/TLS
  sslEnabled: boolean;
  sslProvider?: 'lets_encrypt' | 'custom' | 'cloudflare';
  sslCertificate?: string;
  sslKey?: string;
  sslExpiresAt?: Date;
  autoRenewSsl: boolean;

  // DNS
  dnsRecords?: DNSRecord[];
  dnsStatus: 'pending' | 'active' | 'failed';

  // CDN
  cdnEnabled: boolean;
  cdnProvider?: 'cloudflare' | 'fastly' | 'akamai' | 'aws_cloudfront';
  cdnUrl?: string;

  // Settings
  forceHttps: boolean;
  wwwRedirect?: 'add_www' | 'remove_www' | 'none';
  defaultLanguage?: string;

  // Verification
  verificationToken?: string;
  verifiedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

export interface URLMapping {
  id: string;
  pattern: string;
  pageId?: string;
  handler?: 'page' | 'blog' | 'product' | 'category' | 'custom';
  params?: Record<string, string>; // e.g., { slug: ':slug', id: ':id' }
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Sitemap {
  id: string;
  url: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number; // 0.0 to 1.0
  lastModified: Date;
  language?: string;
  alternateUrls?: Array<{
    language: string;
    url: string;
  }>;
}

/**
 * Redirect Service
 */
export class RedirectService {
  /**
   * Create redirect
   */
  async createRedirect(redirect: Partial<URLRedirect>): Promise<URLRedirect> {
    const { data, error } = await supabase
      .from('cms_redirects')
      .insert({
        from_path: redirect.fromPath,
        to_path: redirect.toPath,
        type: redirect.type || 301,
        is_active: redirect.isActive !== false,
        match_type: redirect.matchType || 'exact',
        preserve_query_string: redirect.preserveQueryString !== false,
        conditions: redirect.conditions,
        hit_count: 0,
        created_by: redirect.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRedirect(data);
  }

  /**
   * Update redirect
   */
  async updateRedirect(redirectId: string, updates: Partial<URLRedirect>): Promise<URLRedirect> {
    const { data, error } = await supabase
      .from('cms_redirects')
      .update({
        from_path: updates.fromPath,
        to_path: updates.toPath,
        type: updates.type,
        is_active: updates.isActive,
        match_type: updates.matchType,
        preserve_query_string: updates.preserveQueryString,
        conditions: updates.conditions,
        updated_at: new Date().toISOString()
      })
      .eq('id', redirectId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRedirect(data);
  }

  /**
   * Get redirect
   */
  async getRedirect(redirectId: string): Promise<URLRedirect> {
    const { data, error } = await supabase
      .from('cms_redirects')
      .select('*')
      .eq('id', redirectId)
      .single();

    if (error) throw error;
    return this.mapRedirect(data);
  }

  /**
   * Get redirects
   */
  async getRedirects(filters?: {
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<URLRedirect[]> {
    let query = supabase
      .from('cms_redirects')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters?.search) {
      query = query.or(`from_path.ilike.%${filters.search}%,to_path.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapRedirect);
  }

  /**
   * Find redirect for path
   */
  async findRedirect(path: string, conditions?: {
    language?: string;
    device?: string;
    country?: string;
  }): Promise<URLRedirect | null> {
    const { data } = await supabase
      .from('cms_redirects')
      .select('*')
      .eq('is_active', true)
      .or(`from_path.eq.${path},match_type.eq.prefix`)
      .order('match_type', { ascending: true }); // Exact matches first

    if (!data || data.length === 0) return null;

    // Find first matching redirect
    for (const redirect of data) {
      if (this.matchesRedirect(path, redirect, conditions)) {
        // Increment hit count
        await supabase
          .from('cms_redirects')
          .update({ hit_count: redirect.hit_count + 1 })
          .eq('id', redirect.id);

        return this.mapRedirect(redirect);
      }
    }

    return null;
  }

  /**
   * Delete redirect
   */
  async deleteRedirect(redirectId: string): Promise<void> {
    await supabase
      .from('cms_redirects')
      .delete()
      .eq('id', redirectId);
  }

  /**
   * Bulk import redirects
   */
  async bulkImportRedirects(redirects: Array<{
    from: string;
    to: string;
    type?: 301 | 302;
  }>, createdBy: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const redirect of redirects) {
      try {
        await this.createRedirect({
          fromPath: redirect.from,
          toPath: redirect.to,
          type: redirect.type || 301,
          createdBy
        });
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Check if path matches redirect
   */
  private matchesRedirect(path: string, redirect: any, conditions?: any): boolean {
    // Check path match
    let pathMatches = false;

    if (redirect.match_type === 'exact') {
      pathMatches = path === redirect.from_path;
    } else if (redirect.match_type === 'prefix') {
      pathMatches = path.startsWith(redirect.from_path);
    } else if (redirect.match_type === 'regex') {
      const regex = new RegExp(redirect.from_path);
      pathMatches = regex.test(path);
    }

    if (!pathMatches) return false;

    // Check conditions
    if (redirect.conditions) {
      if (redirect.conditions.language && redirect.conditions.language !== conditions?.language) {
        return false;
      }

      if (redirect.conditions.device && redirect.conditions.device !== conditions?.device) {
        return false;
      }

      if (redirect.conditions.country && redirect.conditions.country !== conditions?.country) {
        return false;
      }
    }

    return true;
  }

  /**
   * Map database record to URLRedirect
   */
  private mapRedirect(data: any): URLRedirect {
    return {
      id: data.id,
      fromPath: data.from_path,
      toPath: data.to_path,
      type: data.type,
      isActive: data.is_active,
      matchType: data.match_type,
      preserveQueryString: data.preserve_query_string,
      conditions: data.conditions,
      hitCount: data.hit_count,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Domain Service
 */
export class DomainService {
  /**
   * Create domain
   */
  async createDomain(domain: Partial<Domain>): Promise<Domain> {
    // Generate verification token
    const verificationToken = this.generateVerificationToken();

    const { data, error } = await supabase
      .from('cms_domains')
      .insert({
        domain: domain.domain,
        is_primary: domain.isPrimary || false,
        is_active: false, // Needs verification first
        ssl_enabled: domain.sslEnabled || false,
        ssl_provider: domain.sslProvider,
        auto_renew_ssl: domain.autoRenewSsl !== false,
        dns_records: domain.dnsRecords,
        dns_status: 'pending',
        cdn_enabled: domain.cdnEnabled || false,
        cdn_provider: domain.cdnProvider,
        cdn_url: domain.cdnUrl,
        force_https: domain.forceHttps !== false,
        www_redirect: domain.wwwRedirect || 'none',
        default_language: domain.defaultLanguage || 'en',
        verification_token: verificationToken
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapDomain(data);
  }

  /**
   * Verify domain
   */
  async verifyDomain(domainId: string): Promise<{ verified: boolean; message: string }> {
    const domain = await this.getDomain(domainId);

    // Check DNS records
    // In production, this would make actual DNS lookups
    const dnsVerified = await this.checkDNSRecords(domain.domain, domain.verificationToken!);

    if (dnsVerified) {
      await supabase
        .from('cms_domains')
        .update({
          is_active: true,
          dns_status: 'active',
          verified_at: new Date().toISOString()
        })
        .eq('id', domainId);

      return { verified: true, message: 'Domain verified successfully' };
    }

    return { verified: false, message: 'DNS records not found or incorrect' };
  }

  /**
   * Enable SSL
   */
  async enableSSL(domainId: string, provider: 'lets_encrypt' | 'custom' | 'cloudflare'): Promise<Domain> {
    const domain = await this.getDomain(domainId);

    if (!domain.verifiedAt) {
      throw new Error('Domain must be verified before enabling SSL');
    }

    // In production, this would trigger SSL certificate provisioning
    const sslExpiresAt = new Date();
    sslExpiresAt.setDate(sslExpiresAt.getDate() + 90); // 90 days

    const { data, error } = await supabase
      .from('cms_domains')
      .update({
        ssl_enabled: true,
        ssl_provider: provider,
        ssl_expires_at: sslExpiresAt.toISOString()
      })
      .eq('id', domainId)
      .select()
      .single();

    if (error) throw error;
    return this.mapDomain(data);
  }

  /**
   * Enable CDN
   */
  async enableCDN(domainId: string, provider: Domain['cdnProvider']): Promise<Domain> {
    const domain = await this.getDomain(domainId);

    // Generate CDN URL
    const cdnUrl = `cdn.${domain.domain}`;

    const { data, error } = await supabase
      .from('cms_domains')
      .update({
        cdn_enabled: true,
        cdn_provider: provider,
        cdn_url: cdnUrl
      })
      .eq('id', domainId)
      .select()
      .single();

    if (error) throw error;
    return this.mapDomain(data);
  }

  /**
   * Get domain
   */
  async getDomain(domainId: string): Promise<Domain> {
    const { data, error } = await supabase
      .from('cms_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (error) throw error;
    return this.mapDomain(data);
  }

  /**
   * Get domains
   */
  async getDomains(filters?: { isActive?: boolean }): Promise<Domain[]> {
    let query = supabase
      .from('cms_domains')
      .select('*')
      .order('is_primary', { ascending: false });

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapDomain);
  }

  /**
   * Get primary domain
   */
  async getPrimaryDomain(): Promise<Domain | null> {
    const { data } = await supabase
      .from('cms_domains')
      .select('*')
      .eq('is_primary', true)
      .eq('is_active', true)
      .single();

    if (!data) return null;
    return this.mapDomain(data);
  }

  /**
   * Set primary domain
   */
  async setPrimaryDomain(domainId: string): Promise<Domain> {
    // Unset current primary
    await supabase
      .from('cms_domains')
      .update({ is_primary: false })
      .eq('is_primary', true);

    // Set new primary
    const { data, error } = await supabase
      .from('cms_domains')
      .update({ is_primary: true })
      .eq('id', domainId)
      .select()
      .single();

    if (error) throw error;
    return this.mapDomain(data);
  }

  /**
   * Delete domain
   */
  async deleteDomain(domainId: string): Promise<void> {
    const domain = await this.getDomain(domainId);

    if (domain.isPrimary) {
      throw new Error('Cannot delete primary domain');
    }

    await supabase
      .from('cms_domains')
      .delete()
      .eq('id', domainId);
  }

  /**
   * Generate sitemap
   */
  async generateSitemap(domainId?: string): Promise<Sitemap[]> {
    const domain = domainId ? await this.getDomain(domainId) : await this.getPrimaryDomain();

    if (!domain) {
      throw new Error('No domain configured');
    }

    // Get all published pages
    const { data: pages } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('status', 'published');

    const sitemap: Sitemap[] = (pages || []).map(page => ({
      id: page.id,
      url: `https://${domain.domain}${page.path}`,
      changeFrequency: this.getChangeFrequency(page),
      priority: page.is_homepage ? 1.0 : 0.8,
      lastModified: new Date(page.updated_at),
      language: page.language,
      alternateUrls: page.translations
        ? Object.entries(page.translations).map(([lang, pageId]) => ({
            language: lang,
            url: `https://${domain.domain}${page.path}`
          }))
        : undefined
    }));

    return sitemap;
  }

  /**
   * Generate verification token
   */
  private generateVerificationToken(): string {
    return `airo-verification-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Check DNS records (mock)
   */
  private async checkDNSRecords(domain: string, token: string): Promise<boolean> {
    // In production, this would make actual DNS lookups
    // For now, return true to simulate verification
    return true;
  }

  /**
   * Get change frequency for sitemap
   */
  private getChangeFrequency(page: any): Sitemap['changeFrequency'] {
    if (page.page_type === 'homepage') return 'daily';
    if (page.page_type === 'blog') return 'weekly';
    return 'monthly';
  }

  /**
   * Map database record to Domain
   */
  private mapDomain(data: any): Domain {
    return {
      id: data.id,
      domain: data.domain,
      isPrimary: data.is_primary,
      isActive: data.is_active,
      sslEnabled: data.ssl_enabled,
      sslProvider: data.ssl_provider,
      sslCertificate: data.ssl_certificate,
      sslKey: data.ssl_key,
      sslExpiresAt: data.ssl_expires_at ? new Date(data.ssl_expires_at) : undefined,
      autoRenewSsl: data.auto_renew_ssl,
      dnsRecords: data.dns_records,
      dnsStatus: data.dns_status,
      cdnEnabled: data.cdn_enabled,
      cdnProvider: data.cdn_provider,
      cdnUrl: data.cdn_url,
      forceHttps: data.force_https,
      wwwRedirect: data.www_redirect,
      defaultLanguage: data.default_language,
      verificationToken: data.verification_token,
      verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create Redirect Service
 */
export function createRedirectService(): RedirectService {
  return new RedirectService();
}

/**
 * Create Domain Service
 */
export function createDomainService(): DomainService {
  return new DomainService();
}
