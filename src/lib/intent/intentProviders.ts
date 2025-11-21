/**
 * Intent Signal Providers
 * Track buying intent from multiple sources: website visitors, LinkedIn, hiring, tech stack
 */

import { supabase } from '../supabase';

export interface IntentSignal {
  type: string;
  source: string;
  strength: 'low' | 'medium' | 'high';
  description: string;
  data: any;
  confidence: number;
  detectedAt: string;
  expiresAt?: string;
}

/**
 * Website Visitor Tracking Provider
 * Identifies companies visiting your website
 */
export class WebsiteVisitorProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_CLEARBIT_API_KEY || '';
  }

  /**
   * Identify company from IP address
   */
  async identifyVisitor(ipAddress: string): Promise<IntentSignal | null> {
    if (!this.apiKey) {
      return this.getMockVisitorData(ipAddress);
    }

    try {
      const response = await fetch(
        `https://company.clearbit.com/v1/companies/find?ip=${ipAddress}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Clearbit API error');
      }

      const data = await response.json();

      return {
        type: 'website_visit',
        source: 'clearbit',
        strength: 'medium',
        description: `${data.name} visited website`,
        data: {
          companyName: data.name,
          domain: data.domain,
          employeeCount: data.metrics?.employees,
          industry: data.category?.industry,
          location: data.geo?.city,
        },
        confidence: 0.9,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };
    } catch (error) {
      console.error('Visitor identification failed:', error);
      return this.getMockVisitorData(ipAddress);
    }
  }

  /**
   * Track page views and engagement
   */
  async trackPageView(
    companyId: string,
    pageUrl: string,
    timeOnPage: number
  ): Promise<IntentSignal> {
    const intentStrength = this.calculatePageViewIntent(pageUrl, timeOnPage);

    return {
      type: 'page_view',
      source: 'website_tracking',
      strength: intentStrength,
      description: `Viewed ${pageUrl} for ${Math.round(timeOnPage / 1000)}s`,
      data: {
        pageUrl,
        timeOnPage,
        category: this.categorizePageUrl(pageUrl),
      },
      confidence: 0.85,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    };
  }

  private calculatePageViewIntent(pageUrl: string, timeOnPage: number): 'low' | 'medium' | 'high' {
    const highIntentPages = ['/pricing', '/demo', '/contact', '/enterprise'];
    const mediumIntentPages = ['/features', '/solutions', '/case-studies'];

    const isHighIntent = highIntentPages.some(page => pageUrl.includes(page));
    const isMediumIntent = mediumIntentPages.some(page => pageUrl.includes(page));

    if (isHighIntent && timeOnPage > 30000) return 'high';
    if (isHighIntent || (isMediumIntent && timeOnPage > 60000)) return 'medium';
    return 'low';
  }

  private categorizePageUrl(pageUrl: string): string {
    if (pageUrl.includes('/pricing')) return 'pricing';
    if (pageUrl.includes('/demo')) return 'demo';
    if (pageUrl.includes('/contact')) return 'contact';
    if (pageUrl.includes('/features')) return 'features';
    if (pageUrl.includes('/case-studies')) return 'case_studies';
    return 'general';
  }

  private getMockVisitorData(ipAddress: string): IntentSignal {
    return {
      type: 'website_visit',
      source: 'mock_tracking',
      strength: 'medium',
      description: 'Company visited website',
      data: {
        companyName: 'Example Corp',
        ipAddress,
        employeeCount: 250,
      },
      confidence: 0.7,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

/**
 * LinkedIn Engagement Provider
 * Track LinkedIn profile views, post engagement, InMail activity
 */
export class LinkedInEngagementProvider {
  /**
   * Track LinkedIn profile view
   */
  async trackProfileView(
    companyId: string,
    viewerProfile: any
  ): Promise<IntentSignal> {
    const strength = this.calculateProfileViewIntent(viewerProfile);

    return {
      type: 'linkedin_profile_view',
      source: 'linkedin',
      strength,
      description: `${viewerProfile.title} at ${viewerProfile.company} viewed profile`,
      data: {
        viewerName: viewerProfile.name,
        viewerTitle: viewerProfile.title,
        viewerCompany: viewerProfile.company,
        viewerSeniority: viewerProfile.seniority,
      },
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
    };
  }

  /**
   * Track post engagement (likes, comments, shares)
   */
  async trackPostEngagement(
    companyId: string,
    engagementType: 'like' | 'comment' | 'share',
    engagerProfile: any
  ): Promise<IntentSignal> {
    const strengthMap = {
      like: 'low' as const,
      comment: 'medium' as const,
      share: 'high' as const,
    };

    return {
      type: 'linkedin_post_engagement',
      source: 'linkedin',
      strength: strengthMap[engagementType],
      description: `${engagerProfile.title} ${engagementType}d your post`,
      data: {
        engagementType,
        engagerName: engagerProfile.name,
        engagerTitle: engagerProfile.title,
        engagerCompany: engagerProfile.company,
      },
      confidence: 0.85,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Track connection requests
   */
  async trackConnectionRequest(
    companyId: string,
    requesterProfile: any
  ): Promise<IntentSignal> {
    return {
      type: 'linkedin_connection_request',
      source: 'linkedin',
      strength: 'medium',
      description: `${requesterProfile.title} sent connection request`,
      data: {
        requesterName: requesterProfile.name,
        requesterTitle: requesterProfile.title,
        requesterCompany: requesterProfile.company,
      },
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
  }

  private calculateProfileViewIntent(profile: any): 'low' | 'medium' | 'high' {
    const decisionMakerTitles = ['ceo', 'cto', 'vp', 'director', 'head of'];
    const influencerTitles = ['manager', 'lead', 'senior'];

    const titleLower = profile.title?.toLowerCase() || '';
    const isDecisionMaker = decisionMakerTitles.some(title => titleLower.includes(title));
    const isInfluencer = influencerTitles.some(title => titleLower.includes(title));

    if (isDecisionMaker) return 'high';
    if (isInfluencer) return 'medium';
    return 'low';
  }
}

/**
 * Hiring Intent Provider
 * Monitor job postings as buying signals
 */
export class HiringIntentProvider {
  /**
   * Analyze job postings for intent signals
   */
  async analyzeJobPostings(
    companyId: string,
    jobPostings: any[]
  ): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    for (const job of jobPostings) {
      const signal = this.analyzeJobPosting(job);
      if (signal) {
        signals.push(signal);
      }
    }

    return signals;
  }

  private analyzeJobPosting(job: any): IntentSignal | null {
    const title = job.title?.toLowerCase() || '';
    const description = job.description?.toLowerCase() || '';

    // Check if job posting indicates buying intent
    const buyingSignals = {
      sales: ['sales', 'account executive', 'business development', 'revenue'],
      marketing: ['marketing', 'growth', 'demand generation'],
      product: ['product manager', 'product owner'],
      engineering: ['engineer', 'developer', 'architect'],
      operations: ['operations', 'customer success', 'support'],
    };

    let department = 'general';
    let strength: 'low' | 'medium' | 'high' = 'low';

    for (const [dept, keywords] of Object.entries(buyingSignals)) {
      if (keywords.some(keyword => title.includes(keyword))) {
        department = dept;

        // Sales and product hires indicate higher buying intent
        if (dept === 'sales' || dept === 'product') {
          strength = 'high';
        } else if (dept === 'marketing' || dept === 'engineering') {
          strength = 'medium';
        }
        break;
      }
    }

    if (department === 'general') return null;

    // Check description for tool mentions
    const toolMentions = this.extractToolMentions(description);

    return {
      type: 'hiring_signal',
      source: 'job_postings',
      strength,
      description: `Hiring ${job.title} in ${department}`,
      data: {
        jobTitle: job.title,
        department,
        location: job.location,
        toolsRequired: toolMentions,
        postedDate: job.postedDate,
      },
      confidence: 0.8,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    };
  }

  private extractToolMentions(description: string): string[] {
    const commonTools = [
      'salesforce', 'hubspot', 'marketo', 'pardot',
      'tableau', 'power bi', 'looker',
      'aws', 'azure', 'gcp',
      'react', 'angular', 'vue',
      'python', 'java', 'node.js',
    ];

    return commonTools.filter(tool => description.includes(tool));
  }
}

/**
 * Tech Stack Change Provider
 * Detect technology adoption and removal
 */
export class TechStackChangeProvider {
  /**
   * Compare tech stacks and detect changes
   */
  async detectChanges(
    companyId: string,
    previousStack: any,
    currentStack: any
  ): Promise<IntentSignal[]> {
    const signals: IntentSignal[] = [];

    // Detect new technologies
    const newTechs = this.findNewTechnologies(previousStack, currentStack);
    for (const tech of newTechs) {
      signals.push({
        type: 'tech_adoption',
        source: 'tech_stack_tracking',
        strength: this.calculateAdoptionIntent(tech),
        description: `Adopted ${tech.name} (${tech.category})`,
        data: {
          technology: tech.name,
          category: tech.category,
          detectedDate: new Date().toISOString(),
        },
        confidence: 0.85,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      });
    }

    // Detect removed technologies
    const removedTechs = this.findRemovedTechnologies(previousStack, currentStack);
    for (const tech of removedTechs) {
      signals.push({
        type: 'tech_removal',
        source: 'tech_stack_tracking',
        strength: 'medium',
        description: `Removed ${tech.name} (${tech.category})`,
        data: {
          technology: tech.name,
          category: tech.category,
          detectedDate: new Date().toISOString(),
        },
        confidence: 0.85,
        detectedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
    }

    return signals;
  }

  private findNewTechnologies(previous: any, current: any): any[] {
    const previousTechs = new Set(previous?.technologies?.flat() || []);
    const newTechs: any[] = [];

    Object.entries(current?.technologies || {}).forEach(([category, techs]: [string, any]) => {
      techs.forEach((tech: string) => {
        if (!previousTechs.has(tech)) {
          newTechs.push({ name: tech, category });
        }
      });
    });

    return newTechs;
  }

  private findRemovedTechnologies(previous: any, current: any): any[] {
    const currentTechs = new Set(
      Object.values(current?.technologies || {}).flat() as string[]
    );
    const removedTechs: any[] = [];

    Object.entries(previous?.technologies || {}).forEach(([category, techs]: [string, any]) => {
      techs.forEach((tech: string) => {
        if (!currentTechs.has(tech)) {
          removedTechs.push({ name: tech, category });
        }
      });
    });

    return removedTechs;
  }

  private calculateAdoptionIntent(tech: any): 'low' | 'medium' | 'high' {
    const highIntentCategories = ['CRM', 'Marketing Automation', 'Sales Enablement'];
    const mediumIntentCategories = ['Analytics', 'Customer Support', 'Email'];

    if (highIntentCategories.includes(tech.category)) return 'high';
    if (mediumIntentCategories.includes(tech.category)) return 'medium';
    return 'low';
  }
}

/**
 * Third-Party Intent Data Provider
 * Integrate with Bombora, 6sense, etc.
 */
export class ThirdPartyIntentProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_BOMBORA_API_KEY || '';
  }

  /**
   * Get intent topics from Bombora
   */
  async getIntentTopics(companyDomain: string): Promise<IntentSignal[]> {
    if (!this.apiKey) {
      return this.getMockIntentData(companyDomain);
    }

    // In production, integrate with actual Bombora API
    return this.getMockIntentData(companyDomain);
  }

  private getMockIntentData(companyDomain: string): IntentSignal[] {
    const topics = [
      { topic: 'CRM Software', surge: 85, strength: 'high' as const },
      { topic: 'Sales Automation', surge: 72, strength: 'high' as const },
      { topic: 'Marketing Analytics', surge: 65, strength: 'medium' as const },
      { topic: 'Customer Data Platform', surge: 58, strength: 'medium' as const },
    ];

    return topics.map(({ topic, surge, strength }) => ({
      type: 'content_research',
      source: 'bombora',
      strength,
      description: `Researching "${topic}" (${surge}% surge)`,
      data: {
        topic,
        surgeScore: surge,
        domain: companyDomain,
      },
      confidence: 0.9,
      detectedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    }));
  }
}

/**
 * Aggregate all intent signals for a company/prospect
 */
export async function aggregateIntentSignals(
  companyId: string,
  prospectId?: string
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];

  // Fetch all stored signals from database
  let query = supabase
    .from('intent_signals')
    .select('*')
    .or(`company_profile_id.eq.${companyId},prospect_id.eq.${prospectId || 'null'}`)
    .gte('detected_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('detected_at', { ascending: false });

  const { data } = await query;

  if (data) {
    signals.push(
      ...data.map(record => ({
        type: record.signal_type,
        source: record.signal_source,
        strength: record.signal_strength,
        description: record.signal_description,
        data: record.signal_data,
        confidence: record.confidence,
        detectedAt: record.detected_at,
        expiresAt: record.expires_at,
      }))
    );
  }

  return signals;
}
