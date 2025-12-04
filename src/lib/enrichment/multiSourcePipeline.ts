/**
 * Multi-Source Enrichment Pipeline
 * Orchestrates data enrichment from Salesforce → ZoomInfo → HubSpot → LinkedIn
 * with waterfall methodology and signal aggregation
 */

import { supabase } from '../supabase';
import { SalesforceClient, createSalesforceClient } from '../crm/salesforce';
import { HubSpotClient, createHubSpotClient } from '../crm/hubspot';
import {
  ZoomInfoConnector,
  ClearbitConnector,
  ApolloConnector,
  BuiltWithConnector,
  NewsApiConnector,
  IntentSignal,
} from './externalApiConnectors';
import {
  LinkedInConnector,
  LinkedInProfile,
  LinkedInCompany,
  enrichProspectWithLinkedIn,
} from './linkedinConnector';
import { researchOrchestrator } from '../research/researchOrchestrator';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface EnrichmentSource {
  name: string;
  type: 'crm' | 'data_provider' | 'social' | 'intent' | 'research';
  priority: number;
  enabled: boolean;
}

export interface ProspectSignals {
  // Contact Information
  contact: {
    email: string;
    emailVerified: boolean;
    phone?: string;
    mobilePhone?: string;
    directDial?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
  };

  // Professional Context
  professional: {
    title: string;
    headline?: string;
    department?: string;
    seniority?: string;
    yearsInRole?: number;
    previousCompanies?: string[];
    skills?: string[];
    certifications?: string[];
  };

  // Company Context
  company: {
    name: string;
    domain?: string;
    industry?: string;
    employeeCount?: number;
    revenue?: string;
    fundingStage?: string;
    totalFunding?: number;
    technologies?: string[];
    headquarters?: string;
    founded?: number;
  };

  // Intent & Engagement Signals
  intent: {
    signals: IntentSignal[];
    score: number; // 0-100
    buyingStage?: 'awareness' | 'consideration' | 'decision' | 'purchase';
    topicInterests?: string[];
    recentActivity?: Array<{
      type: string;
      description: string;
      timestamp: string;
      confidence: number;
    }>;
  };

  // Relationship Context
  relationship: {
    connectionPath?: string[];
    mutualConnections?: number;
    previousInteractions?: number;
    lastContactDate?: string;
    responseRate?: number;
  };

  // Research Insights
  research: {
    companyNews?: Array<{
      title: string;
      summary: string;
      date: string;
      sentiment: 'positive' | 'neutral' | 'negative';
      relevance: number;
    }>;
    competitorMentions?: string[];
    painPoints?: string[];
    priorities?: string[];
    buyingCommittee?: Array<{
      role: string;
      influence: 'decision_maker' | 'influencer' | 'champion' | 'blocker';
    }>;
    recentChanges?: Array<{
      type: string;
      description: string;
      date: string;
    }>;
  };

  // Metadata
  metadata: {
    sources: string[];
    enrichedAt: string;
    qualityScore: number; // 0-100
    completeness: number; // 0-100
    freshness: number; // 0-100
  };
}

export interface EnrichmentPipelineResult {
  success: boolean;
  prospectId: string;
  signals: ProspectSignals;
  sourceResults: Array<{
    source: string;
    success: boolean;
    dataPoints: number;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
  creditsUsed: number;
}

export interface CompanyEnrichmentResult {
  success: boolean;
  companyId: string;
  data: {
    overview: any;
    technologies: string[];
    funding: any;
    news: any[];
    intentSignals: IntentSignal[];
    employees: any[];
  };
  sources: string[];
  totalDuration: number;
}

// =============================================
// MULTI-SOURCE ENRICHMENT PIPELINE
// =============================================

export class MultiSourceEnrichmentPipeline {
  private teamId: string;
  private connectors: Map<string, any> = new Map();
  private enabledSources: EnrichmentSource[] = [];

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Initialize all available connectors
   */
  async initialize(): Promise<void> {
    // Get team integrations and API keys
    const { data: integrations } = await supabase
      .from('team_integrations')
      .select('provider_key, credentials, is_active')
      .eq('team_id', this.teamId)
      .eq('is_active', true);

    const apiKeys: Record<string, string> = {};

    for (const integration of integrations || []) {
      if (integration.credentials?.api_key) {
        apiKeys[integration.provider_key] = integration.credentials.api_key;
      }
      if (integration.credentials?.access_token) {
        apiKeys[`${integration.provider_key}_token`] = integration.credentials.access_token;
      }
    }

    // Add environment variable fallbacks
    apiKeys.zoominfo = apiKeys.zoominfo || process.env.ZOOMINFO_API_KEY || '';
    apiKeys.clearbit = apiKeys.clearbit || process.env.CLEARBIT_API_KEY || '';
    apiKeys.apollo = apiKeys.apollo || process.env.APOLLO_API_KEY || '';
    apiKeys.builtwith = apiKeys.builtwith || process.env.BUILTWITH_API_KEY || '';
    apiKeys.newsapi = apiKeys.newsapi || process.env.NEWS_API_KEY || '';
    apiKeys.proxycurl = apiKeys.proxycurl || process.env.PROXYCURL_API_KEY || '';

    // Initialize connectors based on available keys
    if (apiKeys.zoominfo) {
      this.connectors.set('zoominfo', new ZoomInfoConnector(apiKeys.zoominfo));
      this.enabledSources.push({ name: 'zoominfo', type: 'data_provider', priority: 1, enabled: true });
    }

    if (apiKeys.clearbit) {
      this.connectors.set('clearbit', new ClearbitConnector(apiKeys.clearbit));
      this.enabledSources.push({ name: 'clearbit', type: 'data_provider', priority: 2, enabled: true });
    }

    if (apiKeys.apollo) {
      this.connectors.set('apollo', new ApolloConnector(apiKeys.apollo));
      this.enabledSources.push({ name: 'apollo', type: 'data_provider', priority: 3, enabled: true });
    }

    if (apiKeys.builtwith) {
      this.connectors.set('builtwith', new BuiltWithConnector(apiKeys.builtwith));
      this.enabledSources.push({ name: 'builtwith', type: 'intent', priority: 4, enabled: true });
    }

    if (apiKeys.newsapi) {
      this.connectors.set('newsapi', new NewsApiConnector(apiKeys.newsapi));
      this.enabledSources.push({ name: 'newsapi', type: 'intent', priority: 5, enabled: true });
    }

    if (apiKeys.proxycurl) {
      this.connectors.set('linkedin', new LinkedInConnector(apiKeys.proxycurl));
      this.enabledSources.push({ name: 'linkedin', type: 'social', priority: 6, enabled: true });
    }

    // Sort by priority
    this.enabledSources.sort((a, b) => a.priority - b.priority);

    console.log(`[Pipeline] Initialized with ${this.enabledSources.length} sources:`,
      this.enabledSources.map(s => s.name));
  }

  /**
   * Run full enrichment pipeline for a prospect
   */
  async enrichProspect(prospectId: string): Promise<EnrichmentPipelineResult> {
    const startTime = Date.now();
    const sourceResults: EnrichmentPipelineResult['sourceResults'] = [];
    let totalCredits = 0;

    // Get prospect data
    const { data: prospect, error } = await supabase
      .from('prospects')
      .select('*, accounts(*), company_profiles(*)')
      .eq('id', prospectId)
      .single();

    if (error || !prospect) {
      throw new Error(`Prospect not found: ${prospectId}`);
    }

    // Initialize signals object
    const signals: ProspectSignals = {
      contact: {
        email: prospect.email,
        emailVerified: false,
        linkedinUrl: prospect.linkedin_url,
      },
      professional: {
        title: prospect.title || '',
      },
      company: {
        name: prospect.company || '',
      },
      intent: {
        signals: [],
        score: 0,
      },
      relationship: {},
      research: {},
      metadata: {
        sources: [],
        enrichedAt: new Date().toISOString(),
        qualityScore: 0,
        completeness: 0,
        freshness: 100,
      },
    };

    // 1. SALESFORCE - Get CRM data
    const sfResult = await this.enrichFromSalesforce(prospect, signals);
    sourceResults.push(sfResult);
    if (sfResult.success) signals.metadata.sources.push('salesforce');

    // 2. ZOOMINFO - Get intent data and contact details
    const ziResult = await this.enrichFromZoomInfo(prospect, signals);
    sourceResults.push(ziResult);
    totalCredits += ziResult.success ? 1 : 0;
    if (ziResult.success) signals.metadata.sources.push('zoominfo');

    // 3. HUBSPOT - Get additional lead info
    const hsResult = await this.enrichFromHubSpot(prospect, signals);
    sourceResults.push(hsResult);
    if (hsResult.success) signals.metadata.sources.push('hubspot');

    // 4. LINKEDIN - Get professional profile
    const liResult = await this.enrichFromLinkedIn(prospect, signals);
    sourceResults.push(liResult);
    totalCredits += liResult.success ? 1 : 0;
    if (liResult.success) signals.metadata.sources.push('linkedin');

    // 5. CLEARBIT - Additional company data
    const cbResult = await this.enrichFromClearbit(prospect, signals);
    sourceResults.push(cbResult);
    totalCredits += cbResult.success ? 1 : 0;
    if (cbResult.success) signals.metadata.sources.push('clearbit');

    // 6. NEWS & INTENT - Get recent signals
    const newsResult = await this.enrichWithNewsAndIntent(prospect, signals);
    sourceResults.push(newsResult);
    if (newsResult.success) signals.metadata.sources.push('newsapi');

    // 7. TECH STACK - Get technology signals
    const techResult = await this.enrichWithTechStack(prospect, signals);
    sourceResults.push(techResult);
    totalCredits += techResult.success ? 1 : 0;
    if (techResult.success) signals.metadata.sources.push('builtwith');

    // Calculate quality metrics
    signals.metadata.qualityScore = this.calculateQualityScore(signals);
    signals.metadata.completeness = this.calculateCompleteness(signals);
    signals.intent.score = this.calculateIntentScore(signals);

    // Update prospect with enriched data
    await this.updateProspectWithSignals(prospectId, signals);

    // Log pipeline execution
    await this.logPipelineExecution(prospectId, signals, sourceResults, totalCredits);

    return {
      success: true,
      prospectId,
      signals,
      sourceResults,
      totalDuration: Date.now() - startTime,
      creditsUsed: totalCredits,
    };
  }

  /**
   * Enrich from Salesforce CRM
   */
  private async enrichFromSalesforce(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    try {
      // Get Salesforce connection
      const { data: connection } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('team_id', this.teamId)
        .eq('provider', 'salesforce')
        .eq('is_active', true)
        .single();

      if (!connection) {
        return { source: 'salesforce', success: false, dataPoints: 0, duration: 0, error: 'Not connected' };
      }

      // Search for contact/lead in Salesforce
      const sfClient = createSalesforceClient(
        connection,
        process.env.SALESFORCE_CLIENT_ID || '',
        process.env.SALESFORCE_CLIENT_SECRET || ''
      );

      // Try to find by email
      const contacts = await sfClient.queryEntities({
        entityType: 'contact',
        filter: { Email: prospect.email },
        limit: 1,
      });

      let dataPoints = 0;

      if (contacts.length > 0) {
        const contact = contacts[0];

        // Update signals with Salesforce data
        if (contact.data.Phone) {
          signals.contact.phone = contact.data.Phone;
          dataPoints++;
        }
        if (contact.data.MobilePhone) {
          signals.contact.mobilePhone = contact.data.MobilePhone;
          dataPoints++;
        }
        if (contact.data.Title) {
          signals.professional.title = contact.data.Title;
          dataPoints++;
        }
        if (contact.data.Department) {
          signals.professional.department = contact.data.Department;
          dataPoints++;
        }

        // Get related account info
        if (contact.data.AccountId) {
          const account = await sfClient.getEntity('account', contact.data.AccountId);
          if (account) {
            signals.company.name = account.data.Name || signals.company.name;
            signals.company.industry = account.data.Industry;
            signals.company.employeeCount = account.data.NumberOfEmployees;
            signals.company.revenue = account.data.AnnualRevenue;
            dataPoints += 4;
          }
        }

        // Get recent activities
        const activities = await sfClient.queryEntities({
          entityType: 'task',
          filter: { WhoId: contact.id },
          limit: 5,
          orderBy: 'CreatedDate DESC',
        });

        if (activities.length > 0) {
          signals.relationship.previousInteractions = activities.length;
          signals.relationship.lastContactDate = activities[0].data.CreatedDate;
          dataPoints += 2;
        }
      }

      return {
        source: 'salesforce',
        success: true,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] Salesforce enrichment failed:', error);
      return {
        source: 'salesforce',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich from ZoomInfo
   */
  private async enrichFromZoomInfo(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    const connector = this.connectors.get('zoominfo') as ZoomInfoConnector;
    if (!connector) {
      return { source: 'zoominfo', success: false, dataPoints: 0, duration: 0, error: 'Not configured' };
    }

    try {
      const result = await connector.enrichPerson(
        prospect.email,
        prospect.first_name,
        prospect.last_name,
        prospect.company
      );

      let dataPoints = 0;

      if (result.found) {
        // Contact info
        if (result.directPhone) {
          signals.contact.directDial = result.directPhone;
          dataPoints++;
        }
        if (result.mobilePhone) {
          signals.contact.mobilePhone = result.mobilePhone;
          dataPoints++;
        }
        if (result.linkedin) {
          signals.contact.linkedinUrl = result.linkedin;
          dataPoints++;
        }

        // Professional info
        if (result.title) {
          signals.professional.title = result.title;
          dataPoints++;
        }
        if (result.department) {
          signals.professional.department = result.department;
          dataPoints++;
        }
        if (result.seniority) {
          signals.professional.seniority = result.seniority;
          dataPoints++;
        }

        // Company info
        if (result.companySize) {
          signals.company.employeeCount = result.companySize;
          dataPoints++;
        }
        if (result.companyRevenue) {
          signals.company.revenue = result.companyRevenue;
          dataPoints++;
        }

        signals.contact.emailVerified = true;
        dataPoints++;
      }

      return {
        source: 'zoominfo',
        success: result.found,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] ZoomInfo enrichment failed:', error);
      return {
        source: 'zoominfo',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich from HubSpot CRM
   */
  private async enrichFromHubSpot(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    try {
      // Get HubSpot connection
      const { data: connection } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('team_id', this.teamId)
        .eq('provider', 'hubspot')
        .eq('is_active', true)
        .single();

      if (!connection) {
        return { source: 'hubspot', success: false, dataPoints: 0, duration: 0, error: 'Not connected' };
      }

      const hsClient = createHubSpotClient(connection);

      // Search for contact by email
      const contacts = await hsClient.search({
        entityType: 'contact',
        filterGroups: [
          {
            filters: [
              { propertyName: 'email', operator: 'EQ', value: prospect.email },
            ],
          },
        ],
      });

      let dataPoints = 0;

      if (contacts.length > 0) {
        const contact = contacts[0];

        // Extract HubSpot-specific data
        if (contact.data.lifecyclestage) {
          signals.intent.buyingStage = this.mapHubSpotLifecycleStage(contact.data.lifecyclestage);
          dataPoints++;
        }

        if (contact.data.hs_lead_status) {
          dataPoints++;
        }

        // Get engagement data
        if (contact.data.notes_last_contacted) {
          signals.relationship.lastContactDate = contact.data.notes_last_contacted;
          dataPoints++;
        }

        // Get associated company
        if (contact.data.associatedcompanyid) {
          const company = await hsClient.getEntity('account', contact.data.associatedcompanyid);
          if (company) {
            if (company.data.industry) {
              signals.company.industry = company.data.industry;
              dataPoints++;
            }
            if (company.data.numberofemployees) {
              signals.company.employeeCount = parseInt(company.data.numberofemployees);
              dataPoints++;
            }
          }
        }
      }

      return {
        source: 'hubspot',
        success: true,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] HubSpot enrichment failed:', error);
      return {
        source: 'hubspot',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich from LinkedIn
   */
  private async enrichFromLinkedIn(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    const connector = this.connectors.get('linkedin') as LinkedInConnector;
    if (!connector) {
      return { source: 'linkedin', success: false, dataPoints: 0, duration: 0, error: 'Not configured' };
    }

    try {
      let linkedinUrl = prospect.linkedin_url || signals.contact.linkedinUrl;

      // Try to find LinkedIn URL from email
      if (!linkedinUrl && prospect.email) {
        linkedinUrl = await connector.findLinkedInUrl(prospect.email);
      }

      if (!linkedinUrl) {
        return { source: 'linkedin', success: false, dataPoints: 0, duration: Date.now() - startTime, error: 'No LinkedIn URL' };
      }

      const result = await connector.enrichPerson(linkedinUrl);

      let dataPoints = 0;

      if (result.success && result.profile) {
        const profile = result.profile;

        // Contact info
        signals.contact.linkedinUrl = linkedinUrl;
        dataPoints++;

        // Professional info
        if (profile.headline) {
          signals.professional.headline = profile.headline;
          dataPoints++;
        }
        if (profile.currentCompany.title) {
          signals.professional.title = profile.currentCompany.title;
          dataPoints++;
        }
        if (profile.skills && profile.skills.length > 0) {
          signals.professional.skills = profile.skills;
          dataPoints++;
        }
        if (profile.certifications && profile.certifications.length > 0) {
          signals.professional.certifications = profile.certifications.map(c => c.name);
          dataPoints++;
        }

        // Calculate years in role
        if (profile.currentCompany.startDate) {
          const startYear = parseInt(profile.currentCompany.startDate.split('-')[0]);
          if (startYear) {
            signals.professional.yearsInRole = new Date().getFullYear() - startYear;
            dataPoints++;
          }
        }

        // Previous companies
        if (profile.experiences && profile.experiences.length > 1) {
          signals.professional.previousCompanies = profile.experiences
            .slice(1)
            .map(exp => exp.company)
            .filter(Boolean);
          dataPoints++;
        }

        // Company info
        if (profile.currentCompany.name) {
          signals.company.name = profile.currentCompany.name;
          dataPoints++;
        }

        // Relationship context
        if (profile.connections) {
          signals.relationship.mutualConnections = Math.floor(profile.connections * 0.01); // Estimate
          dataPoints++;
        }
      }

      return {
        source: 'linkedin',
        success: result.success,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] LinkedIn enrichment failed:', error);
      return {
        source: 'linkedin',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich from Clearbit
   */
  private async enrichFromClearbit(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    const connector = this.connectors.get('clearbit') as ClearbitConnector;
    if (!connector) {
      return { source: 'clearbit', success: false, dataPoints: 0, duration: 0, error: 'Not configured' };
    }

    try {
      let dataPoints = 0;

      // Person enrichment
      if (prospect.email) {
        const personResult = await connector.enrichPerson(prospect.email);

        if (personResult.found) {
          if (personResult.twitter) {
            signals.contact.twitterUrl = `https://twitter.com/${personResult.twitter}`;
            dataPoints++;
          }
          if (personResult.location) {
            dataPoints++;
          }
        }
      }

      // Company enrichment
      const domain = this.extractDomain(prospect.email) || prospect.company_domain;
      if (domain) {
        const companyResult = await connector.enrichCompany(domain);

        if (companyResult.found) {
          if (companyResult.industry) {
            signals.company.industry = companyResult.industry;
            dataPoints++;
          }
          if (companyResult.employees) {
            signals.company.employeeCount = companyResult.employees;
            dataPoints++;
          }
          if (companyResult.revenue) {
            signals.company.revenue = companyResult.revenue;
            dataPoints++;
          }
          if (companyResult.tech && companyResult.tech.length > 0) {
            signals.company.technologies = companyResult.tech;
            dataPoints++;
          }
          if (companyResult.location) {
            signals.company.headquarters = `${companyResult.location.city}, ${companyResult.location.country}`;
            dataPoints++;
          }
        }
      }

      return {
        source: 'clearbit',
        success: dataPoints > 0,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] Clearbit enrichment failed:', error);
      return {
        source: 'clearbit',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich with news and intent signals
   */
  private async enrichWithNewsAndIntent(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    const connector = this.connectors.get('newsapi') as NewsApiConnector;
    if (!connector) {
      return { source: 'newsapi', success: false, dataPoints: 0, duration: 0, error: 'Not configured' };
    }

    try {
      const companyName = signals.company.name || prospect.company;
      if (!companyName) {
        return { source: 'newsapi', success: false, dataPoints: 0, duration: Date.now() - startTime, error: 'No company name' };
      }

      const intentSignals = await connector.getCompanyNews(companyName, 30);

      let dataPoints = 0;

      if (intentSignals.length > 0) {
        // Add to signals
        signals.intent.signals.push(...intentSignals);
        dataPoints = intentSignals.length;

        // Extract news items
        signals.research.companyNews = intentSignals
          .filter(s => s.type === 'news_mention')
          .slice(0, 5)
          .map(s => ({
            title: s.description,
            summary: s.metadata.content || '',
            date: s.timestamp,
            sentiment: 'neutral' as const,
            relevance: s.confidence,
          }));

        // Extract recent changes
        signals.research.recentChanges = intentSignals
          .filter(s => s.type === 'funding' || s.type === 'job_posting')
          .map(s => ({
            type: s.type,
            description: s.description,
            date: s.timestamp,
          }));
      }

      return {
        source: 'newsapi',
        success: intentSignals.length > 0,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] News enrichment failed:', error);
      return {
        source: 'newsapi',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enrich with technology stack
   */
  private async enrichWithTechStack(
    prospect: any,
    signals: ProspectSignals
  ): Promise<EnrichmentPipelineResult['sourceResults'][0]> {
    const startTime = Date.now();

    const connector = this.connectors.get('builtwith') as BuiltWithConnector;
    if (!connector) {
      return { source: 'builtwith', success: false, dataPoints: 0, duration: 0, error: 'Not configured' };
    }

    try {
      const domain = this.extractDomain(prospect.email) || prospect.company_domain;
      if (!domain) {
        return { source: 'builtwith', success: false, dataPoints: 0, duration: Date.now() - startTime, error: 'No domain' };
      }

      const result = await connector.getTechStack(domain);

      let dataPoints = 0;

      if (result.found && result.technologies) {
        signals.company.technologies = [
          ...(signals.company.technologies || []),
          ...result.technologies.map((t: any) => t.name),
        ].filter((v, i, a) => a.indexOf(v) === i); // Dedupe

        dataPoints = result.technologies.length;

        // Create intent signal for tech stack
        signals.intent.signals.push({
          type: 'tech_stack',
          source: 'builtwith',
          confidence: 90,
          timestamp: new Date().toISOString(),
          description: `Uses ${result.technologies.length} technologies including ${result.technologies.slice(0, 3).map((t: any) => t.name).join(', ')}`,
          metadata: { technologies: result.technologies },
        });
      }

      return {
        source: 'builtwith',
        success: result.found,
        dataPoints,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Pipeline] Tech stack enrichment failed:', error);
      return {
        source: 'builtwith',
        success: false,
        dataPoints: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email: string): string | null {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1];
    // Skip common email providers
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
    return commonDomains.includes(domain) ? null : domain;
  }

  /**
   * Map HubSpot lifecycle stage to buying stage
   */
  private mapHubSpotLifecycleStage(stage: string): ProspectSignals['intent']['buyingStage'] {
    const mapping: Record<string, ProspectSignals['intent']['buyingStage']> = {
      subscriber: 'awareness',
      lead: 'awareness',
      marketingqualifiedlead: 'consideration',
      salesqualifiedlead: 'consideration',
      opportunity: 'decision',
      customer: 'purchase',
    };
    return mapping[stage.toLowerCase()] || 'awareness';
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(signals: ProspectSignals): number {
    let score = 0;
    const weights = {
      emailVerified: 15,
      hasPhone: 10,
      hasLinkedIn: 10,
      hasTitle: 10,
      hasDepartment: 5,
      hasSeniority: 5,
      hasCompanyInfo: 15,
      hasIntentSignals: 15,
      hasResearch: 15,
    };

    if (signals.contact.emailVerified) score += weights.emailVerified;
    if (signals.contact.phone || signals.contact.directDial) score += weights.hasPhone;
    if (signals.contact.linkedinUrl) score += weights.hasLinkedIn;
    if (signals.professional.title) score += weights.hasTitle;
    if (signals.professional.department) score += weights.hasDepartment;
    if (signals.professional.seniority) score += weights.hasSeniority;
    if (signals.company.industry && signals.company.employeeCount) score += weights.hasCompanyInfo;
    if (signals.intent.signals.length > 0) score += weights.hasIntentSignals;
    if (signals.research.companyNews && signals.research.companyNews.length > 0) score += weights.hasResearch;

    return score;
  }

  /**
   * Calculate completeness
   */
  private calculateCompleteness(signals: ProspectSignals): number {
    const fields = [
      signals.contact.email,
      signals.contact.phone || signals.contact.directDial,
      signals.contact.linkedinUrl,
      signals.professional.title,
      signals.professional.department,
      signals.professional.seniority,
      signals.company.name,
      signals.company.industry,
      signals.company.employeeCount,
      signals.company.technologies?.length,
    ];

    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }

  /**
   * Calculate intent score
   */
  private calculateIntentScore(signals: ProspectSignals): number {
    let score = 0;

    // Base score from signals
    for (const signal of signals.intent.signals) {
      const typeWeights: Record<string, number> = {
        funding: 25,
        job_posting: 20,
        web_visit: 15,
        content_download: 20,
        tech_stack: 10,
        news_mention: 5,
      };
      score += (typeWeights[signal.type] || 5) * (signal.confidence / 100);
    }

    // Boost for buying stage
    const stageBoosts: Record<string, number> = {
      awareness: 0,
      consideration: 15,
      decision: 30,
      purchase: 40,
    };
    if (signals.intent.buyingStage) {
      score += stageBoosts[signals.intent.buyingStage] || 0;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Update prospect with signals
   */
  private async updateProspectWithSignals(prospectId: string, signals: ProspectSignals): Promise<void> {
    await supabase
      .from('prospects')
      .update({
        title: signals.professional.title || undefined,
        phone: signals.contact.phone || signals.contact.directDial || undefined,
        linkedin_url: signals.contact.linkedinUrl || undefined,
        enrichment_data: signals,
        enriched_at: new Date().toISOString(),
        intent_score: signals.intent.score,
        quality_score: signals.metadata.qualityScore,
      })
      .eq('id', prospectId);
  }

  /**
   * Log pipeline execution
   */
  private async logPipelineExecution(
    prospectId: string,
    signals: ProspectSignals,
    sourceResults: EnrichmentPipelineResult['sourceResults'],
    creditsUsed: number
  ): Promise<void> {
    await supabase.from('enrichment_requests').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      enrichment_type: 'multi_source_pipeline',
      status: 'completed',
      response_data: {
        signals,
        sourceResults,
      },
      credits_used: creditsUsed,
      waterfall_log: sourceResults,
    });
  }
}

/**
 * Create and run enrichment pipeline for a prospect
 */
export async function runEnrichmentPipeline(
  teamId: string,
  prospectId: string
): Promise<EnrichmentPipelineResult> {
  const pipeline = new MultiSourceEnrichmentPipeline(teamId);
  await pipeline.initialize();
  return pipeline.enrichProspect(prospectId);
}
