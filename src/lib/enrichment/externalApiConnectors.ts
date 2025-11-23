/**
 * External API Connectors for Data Enrichment
 * Integrates with third-party APIs to enrich prospect and company data
 */

import { supabase } from '../supabase';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface EnrichmentProvider {
  id: string;
  name: string;
  type: 'person' | 'company' | 'intent' | 'technographic' | 'news';
  apiKey?: string;
  config: Record<string, any>;
}

export interface EnrichmentRequest {
  provider: string;
  entityType: 'prospect' | 'company';
  entityId: string;
  enrichmentType: string;
  inputData: Record<string, any>;
}

export interface EnrichmentResult {
  provider: string;
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  creditsUsed?: number;
  metadata: {
    requestedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export interface IntentSignal {
  type: 'web_visit' | 'content_download' | 'search_query' | 'tech_stack' | 'job_posting' | 'funding' | 'news_mention';
  source: string;
  confidence: number; // 0-100
  timestamp: string;
  description: string;
  metadata: Record<string, any>;
}

// =============================================
// CLEARBIT CONNECTOR
// =============================================

export class ClearbitConnector {
  private apiKey: string;
  private baseUrl = 'https://person.clearbit.com/v2';
  private companyUrl = 'https://company.clearbit.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Enrich person data by email
   */
  async enrichPerson(email: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/people/find?email=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { found: false };
        }
        throw new Error(`Clearbit API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        found: true,
        name: data.name?.fullName,
        title: data.employment?.title,
        company: data.employment?.name,
        linkedin: data.linkedin?.handle,
        twitter: data.twitter?.handle,
        location: data.location,
        bio: data.bio,
        avatar: data.avatar,
        employment: data.employment,
        raw: data,
      };
    } catch (error) {
      console.error('Clearbit person enrichment failed:', error);
      throw error;
    }
  }

  /**
   * Enrich company data by domain
   */
  async enrichCompany(domain: string): Promise<any> {
    try {
      const response = await fetch(`${this.companyUrl}/companies/find?domain=${encodeURIComponent(domain)}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { found: false };
        }
        throw new Error(`Clearbit API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        found: true,
        name: data.name,
        domain: data.domain,
        description: data.description,
        logo: data.logo,
        employees: data.metrics?.employees,
        employeesRange: data.metrics?.employeesRange,
        revenue: data.metrics?.estimatedAnnualRevenue,
        industry: data.category?.industry,
        sector: data.category?.sector,
        tags: data.tags,
        tech: data.tech,
        location: data.geo,
        linkedin: data.linkedin?.handle,
        twitter: data.twitter?.handle,
        raw: data,
      };
    } catch (error) {
      console.error('Clearbit company enrichment failed:', error);
      throw error;
    }
  }
}

// =============================================
// ZOOMINFO CONNECTOR
// =============================================

export class ZoomInfoConnector {
  private apiKey: string;
  private baseUrl = 'https://api.zoominfo.com/lookup';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Enrich person data
   */
  async enrichPerson(email?: string, firstName?: string, lastName?: string, company?: string): Promise<any> {
    try {
      const body: any = {};
      if (email) body.email = email;
      if (firstName) body.firstName = firstName;
      if (lastName) body.lastName = lastName;
      if (company) body.companyName = company;

      const response = await fetch(`${this.baseUrl}/person`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`ZoomInfo API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        found: data.success,
        directPhone: data.directPhoneNumber,
        mobilePhone: data.mobilePhoneNumber,
        email: data.email,
        title: data.jobTitle,
        department: data.jobFunction,
        seniority: data.managementLevel,
        company: data.companyName,
        companySize: data.companyEmployeeCount,
        companyRevenue: data.companyRevenue,
        linkedin: data.linkedInUrl,
        raw: data,
      };
    } catch (error) {
      console.error('ZoomInfo person enrichment failed:', error);
      throw error;
    }
  }

  /**
   * Enrich company data
   */
  async enrichCompany(domain: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/company`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ website: domain }),
      });

      if (!response.ok) {
        throw new Error(`ZoomInfo API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        found: data.success,
        name: data.companyName,
        revenue: data.revenue,
        employees: data.employeeCount,
        industry: data.industry,
        description: data.description,
        phone: data.phone,
        address: data.address,
        technologies: data.technologies,
        raw: data,
      };
    } catch (error) {
      console.error('ZoomInfo company enrichment failed:', error);
      throw error;
    }
  }
}

// =============================================
// APOLLO.IO CONNECTOR
// =============================================

export class ApolloConnector {
  private apiKey: string;
  private baseUrl = 'https://api.apollo.io/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Enrich person data
   */
  async enrichPerson(email?: string, firstName?: string, lastName?: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/people/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Apollo API error: ${response.status}`);
      }

      const data = await response.json();
      const person = data.person;

      return {
        found: !!person,
        email: person?.email,
        firstName: person?.first_name,
        lastName: person?.last_name,
        title: person?.title,
        company: person?.organization?.name,
        linkedin: person?.linkedin_url,
        twitter: person?.twitter_url,
        phoneNumbers: person?.phone_numbers,
        emailStatus: person?.email_status,
        seniority: person?.seniority,
        departments: person?.departments,
        raw: data,
      };
    } catch (error) {
      console.error('Apollo person enrichment failed:', error);
      throw error;
    }
  }

  /**
   * Search for contacts based on criteria
   */
  async searchPeople(criteria: {
    companyDomain?: string;
    title?: string;
    seniority?: string;
    departments?: string[];
    limit?: number;
  }): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/mixed_people/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          q_organization_domains: criteria.companyDomain,
          person_titles: criteria.title ? [criteria.title] : undefined,
          person_seniorities: criteria.seniority ? [criteria.seniority] : undefined,
          person_departments: criteria.departments,
          page: 1,
          per_page: criteria.limit || 25,
        }),
      });

      if (!response.ok) {
        throw new Error(`Apollo API error: ${response.status}`);
      }

      const data = await response.json();
      return data.people || [];
    } catch (error) {
      console.error('Apollo people search failed:', error);
      throw error;
    }
  }
}

// =============================================
// BUILTWITH / TECHNOGRAPHIC CONNECTOR
// =============================================

export class BuiltWithConnector {
  private apiKey: string;
  private baseUrl = 'https://api.builtwith.com/v21/api.json';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get technology stack for a domain
   */
  async getTechStack(domain: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}?KEY=${this.apiKey}&LOOKUP=${encodeURIComponent(domain)}&NOMETA=yes&NOATTR=yes&HIDETEXT=yes&HIDEDL=yes`
      );

      if (!response.ok) {
        throw new Error(`BuiltWith API error: ${response.status}`);
      }

      const data = await response.json();
      const results = data.Results?.[0];

      if (!results) {
        return { found: false };
      }

      const technologies: any[] = [];

      // Parse different technology categories
      for (const path of results.Paths || []) {
        for (const tech of path.Technologies || []) {
          technologies.push({
            name: tech.Name,
            category: tech.Tag,
            firstDetected: tech.FirstDetected,
            lastDetected: tech.LastDetected,
            isCurrent: tech.IsPremium,
          });
        }
      }

      return {
        found: true,
        domain: results.Domain,
        technologies,
        categories: [...new Set(technologies.map(t => t.category))],
        raw: data,
      };
    } catch (error) {
      console.error('BuiltWith tech stack lookup failed:', error);
      throw error;
    }
  }
}

// =============================================
// NEWS / INTENT SIGNAL CONNECTOR
// =============================================

export class NewsApiConnector {
  private apiKey: string;
  private baseUrl = 'https://newsapi.org/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for company news and events
   */
  async getCompanyNews(companyName: string, daysBack: number = 30): Promise<IntentSignal[]> {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysBack);

      const response = await fetch(
        `${this.baseUrl}/everything?q=${encodeURIComponent(companyName)}&from=${fromDate.toISOString().split('T')[0]}&sortBy=relevancy&apiKey=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`NewsAPI error: ${response.status}`);
      }

      const data = await response.json();
      const signals: IntentSignal[] = [];

      for (const article of data.articles || []) {
        // Classify news as intent signals
        const signal: IntentSignal = {
          type: this.classifyNewsType(article.title + ' ' + article.description),
          source: 'news',
          confidence: this.calculateConfidence(article),
          timestamp: article.publishedAt,
          description: article.title,
          metadata: {
            url: article.url,
            source: article.source.name,
            author: article.author,
            content: article.description,
          },
        };

        signals.push(signal);
      }

      return signals;
    } catch (error) {
      console.error('NewsAPI company news search failed:', error);
      throw error;
    }
  }

  private classifyNewsType(text: string): IntentSignal['type'] {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('funding') || lowerText.includes('raised') || lowerText.includes('investment')) {
      return 'funding';
    }
    if (lowerText.includes('hiring') || lowerText.includes('job') || lowerText.includes('career')) {
      return 'job_posting';
    }

    return 'news_mention';
  }

  private calculateConfidence(article: any): number {
    let confidence = 50;

    // Higher confidence for recent articles
    const daysOld = (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) confidence += 20;
    else if (daysOld < 30) confidence += 10;

    // Higher confidence for reputable sources
    const reputableSources = ['techcrunch', 'forbes', 'bloomberg', 'reuters', 'wsj'];
    if (reputableSources.some(s => article.source.name.toLowerCase().includes(s))) {
      confidence += 15;
    }

    return Math.min(100, confidence);
  }
}

// =============================================
// ENRICHMENT ORCHESTRATOR
// =============================================

export class EnrichmentOrchestrator {
  private connectors: Map<string, any> = new Map();
  private teamId: string;

  constructor(teamId: string, apiKeys: Record<string, string>) {
    this.teamId = teamId;

    // Initialize connectors based on available API keys
    if (apiKeys.clearbit) {
      this.connectors.set('clearbit', new ClearbitConnector(apiKeys.clearbit));
    }
    if (apiKeys.zoominfo) {
      this.connectors.set('zoominfo', new ZoomInfoConnector(apiKeys.zoominfo));
    }
    if (apiKeys.apollo) {
      this.connectors.set('apollo', new ApolloConnector(apiKeys.apollo));
    }
    if (apiKeys.builtwith) {
      this.connectors.set('builtwith', new BuiltWithConnector(apiKeys.builtwith));
    }
    if (apiKeys.newsapi) {
      this.connectors.set('newsapi', new NewsApiConnector(apiKeys.newsapi));
    }
  }

  /**
   * Enrich a prospect with all available providers
   */
  async enrichProspect(prospectId: string): Promise<EnrichmentResult[]> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) {
      throw new Error('Prospect not found');
    }

    const results: EnrichmentResult[] = [];

    // Person enrichment
    if (this.connectors.has('clearbit') && prospect.email) {
      results.push(await this.enrichWithProvider('clearbit', 'person', prospectId, {
        email: prospect.email,
      }));
    }

    if (this.connectors.has('zoominfo')) {
      results.push(await this.enrichWithProvider('zoominfo', 'person', prospectId, {
        email: prospect.email,
        firstName: prospect.first_name,
        lastName: prospect.last_name,
        company: prospect.company,
      }));
    }

    // Apply enriched data to prospect
    await this.applyEnrichmentToProspect(prospectId, results);

    return results;
  }

  /**
   * Enrich a company with all available providers
   */
  async enrichCompany(companyProfileId: string, domain: string): Promise<EnrichmentResult[]> {
    const results: EnrichmentResult[] = [];

    // Company enrichment
    if (this.connectors.has('clearbit')) {
      results.push(await this.enrichWithProvider('clearbit', 'company', companyProfileId, { domain }));
    }

    if (this.connectors.has('zoominfo')) {
      results.push(await this.enrichWithProvider('zoominfo', 'company', companyProfileId, { domain }));
    }

    // Tech stack
    if (this.connectors.has('builtwith')) {
      results.push(await this.enrichWithProvider('builtwith', 'techstack', companyProfileId, { domain }));
    }

    // Intent signals from news
    if (this.connectors.has('newsapi')) {
      const { data: company } = await supabase
        .from('company_profiles')
        .select('name')
        .eq('id', companyProfileId)
        .single();

      if (company) {
        results.push(await this.enrichWithProvider('newsapi', 'news', companyProfileId, {
          companyName: company.name,
        }));
      }
    }

    // Apply enriched data to company
    await this.applyEnrichmentToCompany(companyProfileId, results);

    return results;
  }

  /**
   * Enrich with a specific provider
   */
  private async enrichWithProvider(
    provider: string,
    type: string,
    entityId: string,
    inputData: Record<string, any>
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const connector = this.connectors.get(provider);

    try {
      let enrichedData;

      // Call the appropriate connector method
      if (provider === 'clearbit') {
        if (type === 'person') {
          enrichedData = await connector.enrichPerson(inputData.email);
        } else if (type === 'company') {
          enrichedData = await connector.enrichCompany(inputData.domain);
        }
      } else if (provider === 'zoominfo') {
        if (type === 'person') {
          enrichedData = await connector.enrichPerson(
            inputData.email,
            inputData.firstName,
            inputData.lastName,
            inputData.company
          );
        } else if (type === 'company') {
          enrichedData = await connector.enrichCompany(inputData.domain);
        }
      } else if (provider === 'apollo') {
        enrichedData = await connector.enrichPerson(
          inputData.email,
          inputData.firstName,
          inputData.lastName
        );
      } else if (provider === 'builtwith') {
        enrichedData = await connector.getTechStack(inputData.domain);
      } else if (provider === 'newsapi') {
        enrichedData = await connector.getCompanyNews(inputData.companyName);
      }

      // Log enrichment request
      await supabase.from('enrichment_requests').insert({
        team_id: this.teamId,
        provider,
        entity_type: type === 'person' ? 'prospect' : 'company',
        entity_id: entityId,
        status: 'completed',
        credits_used: 1,
        response_data: enrichedData,
        created_at: new Date().toISOString(),
      });

      return {
        provider,
        success: true,
        data: enrichedData,
        creditsUsed: 1,
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      console.error(`${provider} enrichment failed:`, error);

      // Log failed enrichment
      await supabase.from('enrichment_requests').insert({
        team_id: this.teamId,
        provider,
        entity_type: type === 'person' ? 'prospect' : 'company',
        entity_id: entityId,
        status: 'failed',
        error_message: error.message,
        created_at: new Date().toISOString(),
      });

      return {
        provider,
        success: false,
        error: error.message,
        metadata: {
          requestedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Apply enrichment data to prospect
   */
  private async applyEnrichmentToProspect(prospectId: string, results: EnrichmentResult[]): Promise<void> {
    const updates: any = {};
    const signals: IntentSignal[] = [];

    for (const result of results) {
      if (!result.success || !result.data) continue;

      const data = result.data;

      // Merge data from different providers
      if (data.title && !updates.title) updates.title = data.title;
      if (data.company && !updates.company) updates.company = data.company;
      if (data.linkedin && !updates.linkedin_url) updates.linkedin_url = data.linkedin;
      if (data.twitter && !updates.twitter_url) updates.twitter_url = data.twitter;
      if (data.phoneNumbers && data.phoneNumbers.length > 0 && !updates.phone) {
        updates.phone = data.phoneNumbers[0].sanitized_number;
      }
      if (data.directPhone && !updates.phone) updates.phone = data.directPhone;
      if (data.seniority) updates.seniority = data.seniority;
      if (data.department) updates.department = data.department;
    }

    // Update prospect if we have data
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('prospects')
        .update({
          ...updates,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', prospectId);
    }
  }

  /**
   * Apply enrichment data to company
   */
  private async applyEnrichmentToCompany(companyProfileId: string, results: EnrichmentResult[]): Promise<void> {
    const updates: any = {};
    const technologies: string[] = [];
    const signals: IntentSignal[] = [];

    for (const result of results) {
      if (!result.success || !result.data) continue;

      const data = result.data;

      // Merge company data
      if (data.description && !updates.description) updates.description = data.description;
      if (data.employees) updates.employee_count = data.employees;
      if (data.revenue) updates.annual_revenue = data.revenue;
      if (data.industry && !updates.industry) updates.industry = data.industry;
      if (data.logo && !updates.logo_url) updates.logo_url = data.logo;
      if (data.linkedin && !updates.linkedin_url) updates.linkedin_url = data.linkedin;
      if (data.twitter && !updates.twitter_url) updates.twitter_url = data.twitter;

      // Collect technologies
      if (data.technologies) {
        technologies.push(...data.technologies.map((t: any) => t.name || t));
      }
      if (data.tech) {
        technologies.push(...data.tech);
      }

      // Collect intent signals from news
      if (Array.isArray(data) && data[0]?.type) {
        signals.push(...data);
      }
    }

    // Update company if we have data
    if (Object.keys(updates).length > 0) {
      updates.technologies = [...new Set(technologies)];
      updates.enriched_at = new Date().toISOString();

      await supabase
        .from('company_profiles')
        .update(updates)
        .eq('id', companyProfileId);
    }

    // Store intent signals
    if (signals.length > 0) {
      await this.storeIntentSignals(companyProfileId, signals);
    }
  }

  /**
   * Store intent signals
   */
  private async storeIntentSignals(companyProfileId: string, signals: IntentSignal[]): Promise<void> {
    const signalRecords = signals.map(signal => ({
      company_profile_id: companyProfileId,
      team_id: this.teamId,
      signal_type: signal.type,
      source: signal.source,
      confidence: signal.confidence,
      description: signal.description,
      metadata: signal.metadata,
      detected_at: signal.timestamp,
      created_at: new Date().toISOString(),
    }));

    await supabase.from('intent_signals').insert(signalRecords);
  }
}

/**
 * Create enrichment orchestrator for a team
 */
export async function createEnrichmentOrchestrator(teamId: string): Promise<EnrichmentOrchestrator> {
  // Get API keys from team integrations
  const { data: integrations } = await supabase
    .from('team_integrations')
    .select('provider_key, credentials')
    .eq('team_id', teamId)
    .in('provider_key', ['clearbit', 'zoominfo', 'apollo', 'builtwith', 'newsapi']);

  const apiKeys: Record<string, string> = {};

  for (const integration of integrations || []) {
    if (integration.credentials?.api_key) {
      apiKeys[integration.provider_key] = integration.credentials.api_key;
    }
  }

  return new EnrichmentOrchestrator(teamId, apiKeys);
}

/**
 * Enrich prospect workflow node action
 */
export async function enrichProspectWorkflowAction(
  teamId: string,
  prospectId: string
): Promise<EnrichmentResult[]> {
  const orchestrator = await createEnrichmentOrchestrator(teamId);
  return await orchestrator.enrichProspect(prospectId);
}

/**
 * Enrich company workflow node action
 */
export async function enrichCompanyWorkflowAction(
  teamId: string,
  companyProfileId: string,
  domain: string
): Promise<EnrichmentResult[]> {
  const orchestrator = await createEnrichmentOrchestrator(teamId);
  return await orchestrator.enrichCompany(companyProfileId, domain);
}
