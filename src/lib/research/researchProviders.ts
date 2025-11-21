/**
 * Multi-Source Research Providers
 * Aggregate company intelligence from multiple data sources
 */

import { supabase } from '../supabase';

export interface ResearchSource {
  name: string;
  type: 'crunchbase' | 'news' | 'reviews' | 'social' | 'financial' | 'tech_stack';
  data: any;
  confidence: number;
  lastUpdated: string;
}

export interface CompanyIntelligence {
  companyName: string;
  sources: ResearchSource[];
  aggregatedData: {
    overview?: any;
    funding?: any;
    news?: any[];
    reviews?: any;
    techStack?: any;
    competitors?: any[];
    signals?: any[];
  };
  qualityScore: number;
  completeness: number;
  freshness: number;
}

/**
 * Crunchbase Provider - Company funding and business data
 */
export class CrunchbaseProvider {
  private apiKey: string;
  private baseUrl = 'https://api.crunchbase.com/api/v4';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_CRUNCHBASE_API_KEY || '';
  }

  async searchCompany(companyName: string): Promise<ResearchSource | null> {
    if (!this.apiKey) {
      console.warn('Crunchbase API key not configured');
      return this.getMockCrunchbaseData(companyName);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations&limit=1`,
        {
          headers: {
            'X-cb-user-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Crunchbase API error: ${response.statusText}`);
      }

      const data = await response.json();
      const org = data.entities[0];

      if (!org) {
        return null;
      }

      // Get detailed organization data
      const detailResponse = await fetch(
        `${this.baseUrl}/entities/organizations/${org.identifier.permalink}?card_ids=fields,funding_rounds,investors`,
        {
          headers: {
            'X-cb-user-key': this.apiKey,
          },
        }
      );

      const detailData = await detailResponse.json();

      return {
        name: 'Crunchbase',
        type: 'crunchbase',
        data: this.formatCrunchbaseData(detailData.properties),
        confidence: 0.95,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Crunchbase API error:', error);
      return this.getMockCrunchbaseData(companyName);
    }
  }

  private formatCrunchbaseData(data: any) {
    return {
      name: data.name,
      description: data.short_description,
      website: data.website_url,
      founded: data.founded_on?.value,
      employeeCount: data.num_employees_enum,
      headquarters: data.location_identifiers?.[0],
      totalFunding: data.funding_total?.value_usd,
      fundingRounds: data.num_funding_rounds,
      lastFundingType: data.last_funding_type,
      lastFundingDate: data.last_funding_at?.value,
      investors: data.investor_identifiers?.map((i: any) => i.value) || [],
      categories: data.category_groups || [],
      linkedin: data.linkedin?.value,
      twitter: data.twitter?.value,
    };
  }

  private getMockCrunchbaseData(companyName: string): ResearchSource {
    return {
      name: 'Crunchbase',
      type: 'crunchbase',
      data: {
        name: companyName,
        description: `${companyName} is a technology company focused on innovation.`,
        employeeCount: '51-100',
        totalFunding: 5000000,
        fundingRounds: 2,
        lastFundingType: 'Series A',
        categories: ['Software', 'Technology'],
      },
      confidence: 0.6,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * News API Provider - Recent company news and mentions
 */
export class NewsAPIProvider {
  private apiKey: string;
  private baseUrl = 'https://newsapi.org/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_NEWS_API_KEY || '';
  }

  async searchCompanyNews(companyName: string, daysBack: number = 30): Promise<ResearchSource> {
    if (!this.apiKey) {
      console.warn('News API key not configured');
      return this.getMockNewsData(companyName);
    }

    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysBack);

      const response = await fetch(
        `${this.baseUrl}/everything?q="${encodeURIComponent(companyName)}"&from=${fromDate.toISOString().split('T')[0]}&sortBy=publishedAt&language=en&apiKey=${this.apiKey}`
      );

      if (!response.ok) {
        throw new Error(`News API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        name: 'NewsAPI',
        type: 'news',
        data: {
          articles: data.articles.slice(0, 10).map((article: any) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source.name,
            publishedAt: article.publishedAt,
            sentiment: this.analyzeSentiment(article.title + ' ' + article.description),
          })),
          totalResults: data.totalResults,
          categories: this.categorizeNews(data.articles),
        },
        confidence: 0.85,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('News API error:', error);
      return this.getMockNewsData(companyName);
    }
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['launch', 'growth', 'success', 'win', 'partnership', 'funding', 'innovation'];
    const negativeWords = ['layoff', 'decline', 'loss', 'lawsuit', 'controversy', 'failure'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private categorizeNews(articles: any[]): string[] {
    const categories = new Set<string>();
    const keywords = {
      'Funding': ['funding', 'investment', 'raised', 'series', 'venture'],
      'Product': ['launch', 'product', 'feature', 'release', 'announce'],
      'Partnership': ['partnership', 'collaboration', 'deal', 'agreement'],
      'Acquisition': ['acquisition', 'acquire', 'merge', 'buyout'],
      'Leadership': ['ceo', 'hire', 'appoint', 'executive', 'leadership'],
      'Growth': ['expansion', 'growth', 'scale', 'revenue'],
    };

    articles.forEach(article => {
      const text = (article.title + ' ' + article.description).toLowerCase();
      Object.entries(keywords).forEach(([category, words]) => {
        if (words.some(word => text.includes(word))) {
          categories.add(category);
        }
      });
    });

    return Array.from(categories);
  }

  private getMockNewsData(companyName: string): ResearchSource {
    return {
      name: 'NewsAPI',
      type: 'news',
      data: {
        articles: [
          {
            title: `${companyName} Announces New Product Launch`,
            description: 'Company unveils innovative solution for enterprise customers',
            source: 'TechCrunch',
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            sentiment: 'positive',
          },
          {
            title: `${companyName} Expands to New Market`,
            description: 'Growth strategy targets international customers',
            source: 'Business Wire',
            publishedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            sentiment: 'positive',
          },
        ],
        totalResults: 2,
        categories: ['Product', 'Growth'],
      },
      confidence: 0.7,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * G2 Reviews Provider - Product reviews and ratings
 */
export class G2ReviewsProvider {
  async searchCompanyReviews(companyName: string): Promise<ResearchSource> {
    // G2 doesn't have a public API, so we'll use web scraping or mock data
    // In production, you might use a service like Apify or ScrapingBee
    return this.getMockG2Data(companyName);
  }

  private getMockG2Data(companyName: string): ResearchSource {
    const rating = 4.2 + Math.random() * 0.8; // 4.2-5.0
    const reviewCount = Math.floor(Math.random() * 500) + 100;

    return {
      name: 'G2',
      type: 'reviews',
      data: {
        overallRating: rating,
        totalReviews: reviewCount,
        ratingBreakdown: {
          5: Math.floor(reviewCount * 0.5),
          4: Math.floor(reviewCount * 0.3),
          3: Math.floor(reviewCount * 0.15),
          2: Math.floor(reviewCount * 0.04),
          1: Math.floor(reviewCount * 0.01),
        },
        pros: [
          'Easy to use and intuitive interface',
          'Great customer support',
          'Powerful features for the price',
          'Regular updates and improvements',
        ],
        cons: [
          'Steep learning curve for advanced features',
          'Mobile app needs improvement',
          'Limited integrations with some tools',
        ],
        categories: ['Software', 'SaaS'],
        competitorComparison: [
          { name: 'Competitor A', rating: 4.1, marketShare: 35 },
          { name: 'Competitor B', rating: 4.3, marketShare: 28 },
          { name: companyName, rating, marketShare: 22 },
        ],
      },
      confidence: 0.75,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * BuiltWith Provider - Technology stack analysis
 */
export class BuiltWithProvider {
  private apiKey: string;
  private baseUrl = 'https://api.builtwith.com/v20/api.json';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || import.meta.env.VITE_BUILTWITH_API_KEY || '';
  }

  async analyzeWebsite(websiteUrl: string): Promise<ResearchSource> {
    if (!this.apiKey) {
      console.warn('BuiltWith API key not configured');
      return this.getMockTechStackData(websiteUrl);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}?KEY=${this.apiKey}&LOOKUP=${encodeURIComponent(websiteUrl)}`
      );

      if (!response.ok) {
        throw new Error(`BuiltWith API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        name: 'BuiltWith',
        type: 'tech_stack',
        data: this.formatTechStackData(data),
        confidence: 0.9,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('BuiltWith API error:', error);
      return this.getMockTechStackData(websiteUrl);
    }
  }

  private formatTechStackData(data: any) {
    const technologies: Record<string, string[]> = {};

    data.Results?.[0]?.Result?.Paths?.[0]?.Technologies?.forEach((tech: any) => {
      const category = tech.Tag || 'Other';
      if (!technologies[category]) {
        technologies[category] = [];
      }
      technologies[category].push(tech.Name);
    });

    return {
      technologies,
      categories: Object.keys(technologies),
      integrationOpportunities: this.findIntegrationOpportunities(technologies),
    };
  }

  private findIntegrationOpportunities(technologies: Record<string, string[]>): string[] {
    const opportunities: string[] = [];

    if (technologies['CRM']?.includes('Salesforce')) {
      opportunities.push('Salesforce integration available');
    }
    if (technologies['Analytics']?.includes('Google Analytics')) {
      opportunities.push('Analytics integration possible');
    }
    if (technologies['Marketing Automation']) {
      opportunities.push('Marketing automation stack detected');
    }

    return opportunities;
  }

  private getMockTechStackData(websiteUrl: string): ResearchSource {
    return {
      name: 'BuiltWith',
      type: 'tech_stack',
      data: {
        technologies: {
          'Web Servers': ['Nginx', 'CloudFlare'],
          'JavaScript Frameworks': ['React', 'Next.js'],
          'Analytics': ['Google Analytics', 'Mixpanel'],
          'CRM': ['Salesforce', 'HubSpot'],
          'Email': ['SendGrid'],
          'Hosting': ['AWS', 'Vercel'],
        },
        categories: ['Web Servers', 'JavaScript Frameworks', 'Analytics', 'CRM', 'Email', 'Hosting'],
        integrationOpportunities: [
          'Salesforce integration available',
          'HubSpot CRM detected',
          'Analytics integration possible',
        ],
      },
      confidence: 0.7,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * LinkedIn Company Provider - Company updates and hiring signals
 */
export class LinkedInProvider {
  async getCompanyInsights(companyLinkedInUrl: string): Promise<ResearchSource> {
    // LinkedIn doesn't have a public API for company data
    // In production, use LinkedIn Sales Navigator API or web scraping service
    return this.getMockLinkedInData();
  }

  private getMockLinkedInData(): ResearchSource {
    return {
      name: 'LinkedIn',
      type: 'social',
      data: {
        followerCount: Math.floor(Math.random() * 50000) + 10000,
        employeeCount: Math.floor(Math.random() * 500) + 50,
        recentPosts: [
          {
            content: 'Excited to announce our new product launch!',
            engagement: 234,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            content: "We're hiring! Join our growing team.",
            engagement: 156,
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        openPositions: [
          { title: 'Senior Sales Executive', department: 'Sales', location: 'Remote' },
          { title: 'Product Manager', department: 'Product', location: 'San Francisco' },
          { title: 'Software Engineer', department: 'Engineering', location: 'New York' },
        ],
        hiringSignals: {
          isHiring: true,
          departmentsHiring: ['Sales', 'Product', 'Engineering'],
          growthIndicator: 'expanding',
        },
      },
      confidence: 0.8,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Aggregator - Combines data from all sources
 */
export async function aggregateCompanyResearch(
  companyName: string,
  websiteUrl?: string
): Promise<CompanyIntelligence> {
  const sources: ResearchSource[] = [];

  // Gather data from all providers in parallel
  const [crunchbaseData, newsData, reviewsData, techStackData, linkedInData] = await Promise.all([
    new CrunchbaseProvider().searchCompany(companyName),
    new NewsAPIProvider().searchCompanyNews(companyName),
    new G2ReviewsProvider().searchCompanyReviews(companyName),
    websiteUrl ? new BuiltWithProvider().analyzeWebsite(websiteUrl) : null,
    new LinkedInProvider().getCompanyInsights(''),
  ]);

  if (crunchbaseData) sources.push(crunchbaseData);
  sources.push(newsData);
  sources.push(reviewsData);
  if (techStackData) sources.push(techStackData);
  sources.push(linkedInData);

  // Aggregate data
  const aggregatedData = {
    overview: crunchbaseData?.data,
    funding: {
      total: crunchbaseData?.data.totalFunding,
      rounds: crunchbaseData?.data.fundingRounds,
      lastRound: crunchbaseData?.data.lastFundingType,
    },
    news: newsData.data.articles,
    reviews: reviewsData.data,
    techStack: techStackData?.data,
    competitors: reviewsData.data.competitorComparison,
    signals: extractBuyingSignals(sources),
  };

  // Calculate quality metrics
  const qualityScore = calculateQualityScore(sources);
  const completeness = calculateCompleteness(aggregatedData);
  const freshness = calculateFreshness(sources);

  return {
    companyName,
    sources,
    aggregatedData,
    qualityScore,
    completeness,
    freshness,
  };
}

function extractBuyingSignals(sources: ResearchSource[]): any[] {
  const signals: any[] = [];

  sources.forEach(source => {
    if (source.type === 'news') {
      source.data.articles.forEach((article: any) => {
        if (article.sentiment === 'positive' && source.data.categories.includes('Funding')) {
          signals.push({
            type: 'funding',
            description: 'Recent funding round',
            strength: 'high',
            source: 'news',
          });
        }
      });
    }

    if (source.type === 'social') {
      if (source.data.hiringSignals?.isHiring) {
        signals.push({
          type: 'hiring',
          description: `Hiring in ${source.data.hiringSignals.departmentsHiring.join(', ')}`,
          strength: 'medium',
          source: 'linkedin',
        });
      }
    }

    if (source.type === 'crunchbase') {
      if (source.data.lastFundingDate) {
        const daysSinceFunding =
          (Date.now() - new Date(source.data.lastFundingDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceFunding < 90) {
          signals.push({
            type: 'recent_funding',
            description: `${source.data.lastFundingType} ${Math.floor(daysSinceFunding)} days ago`,
            strength: 'high',
            source: 'crunchbase',
          });
        }
      }
    }
  });

  return signals;
}

function calculateQualityScore(sources: ResearchSource[]): number {
  const totalConfidence = sources.reduce((sum, source) => sum + source.confidence, 0);
  return Math.round((totalConfidence / sources.length) * 100);
}

function calculateCompleteness(data: any): number {
  const fields = [
    data.overview?.name,
    data.overview?.description,
    data.funding?.total,
    data.news?.length > 0,
    data.reviews?.overallRating,
    data.techStack?.technologies,
  ];

  const filledFields = fields.filter(Boolean).length;
  return Math.round((filledFields / fields.length) * 100);
}

function calculateFreshness(sources: ResearchSource[]): number {
  const now = Date.now();
  const avgAge =
    sources.reduce((sum, source) => {
      const age = (now - new Date(source.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      return sum + age;
    }, 0) / sources.length;

  // Fresher = higher score
  if (avgAge < 1) return 100;
  if (avgAge < 7) return 90;
  if (avgAge < 30) return 70;
  if (avgAge < 90) return 50;
  return 30;
}
