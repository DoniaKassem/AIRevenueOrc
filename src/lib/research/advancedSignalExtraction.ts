/**
 * Advanced Signal Extraction Engine
 * Analyzes multiple data sources to extract buying intent signals
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';
import type { IntentSignal } from '../enrichment/externalApiConnectors';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface SignalSource {
  type: 'website' | 'news' | 'social' | 'job_posting' | 'tech_stack' | 'funding' | 'web_activity' | 'content_engagement';
  url?: string;
  content: string;
  metadata: Record<string, any>;
  extractedAt: string;
}

export interface ExtractedSignal {
  type: IntentSignal['type'];
  category: 'behavioral' | 'technographic' | 'firmographic' | 'contextual';
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  confidence: number; // 0-100
  description: string;
  evidence: string;
  source: SignalSource;
  metadata: Record<string, any>;
}

export interface SignalAnalysis {
  companyProfileId: string;
  totalSignals: number;
  signalsByCategory: Record<string, number>;
  signalsByType: Record<string, number>;
  overallIntentScore: number; // 0-100
  recommendedAction: 'engage_immediately' | 'engage_soon' | 'nurture' | 'monitor';
  signals: ExtractedSignal[];
  extractedAt: string;
}

export interface WebsiteAnalysis {
  hasContactForm: boolean;
  hasPricing: boolean;
  hasBlog: boolean;
  hasCareersPage: boolean;
  technologies: string[];
  keywords: string[];
  metadata: {
    title?: string;
    description?: string;
    lastUpdated?: string;
  };
}

// =============================================
// SIGNAL EXTRACTORS
// =============================================

/**
 * Website Signal Extractor
 * Analyzes company websites for buying intent signals
 */
export class WebsiteSignalExtractor {
  /**
   * Extract signals from website content
   */
  async extract(url: string, content: string): Promise<ExtractedSignal[]> {
    const signals: ExtractedSignal[] = [];

    // Analyze website structure
    const analysis = this.analyzeWebsiteStructure(content);

    // Signal: Recent website update (shows active company)
    if (this.isRecentlyUpdated(content)) {
      signals.push({
        type: 'web_visit',
        category: 'behavioral',
        strength: 'medium',
        confidence: 70,
        description: 'Website recently updated',
        evidence: 'Copyright date or last-modified header shows recent activity',
        source: {
          type: 'website',
          url,
          content: content.substring(0, 500),
          metadata: analysis,
          extractedAt: new Date().toISOString(),
        },
        metadata: { lastUpdated: analysis.metadata.lastUpdated },
      });
    }

    // Signal: Careers page exists (hiring = growth)
    if (analysis.hasCareersPage) {
      const jobCount = this.extractJobPostings(content);

      signals.push({
        type: 'job_posting',
        category: 'firmographic',
        strength: jobCount > 5 ? 'strong' : 'medium',
        confidence: 85,
        description: `Company is hiring (${jobCount} open positions)`,
        evidence: 'Active careers page with job listings',
        source: {
          type: 'job_posting',
          url: `${url}/careers`,
          content: '',
          metadata: { jobCount },
          extractedAt: new Date().toISOString(),
        },
        metadata: { jobCount },
      });
    }

    // Signal: Pricing page exists (solution-aware)
    if (analysis.hasPricing) {
      signals.push({
        type: 'web_visit',
        category: 'behavioral',
        strength: 'medium',
        confidence: 75,
        description: 'Has pricing page (product-aware)',
        evidence: 'Public pricing indicates openness to self-serve evaluation',
        source: {
          type: 'website',
          url: `${url}/pricing`,
          content: '',
          metadata: {},
          extractedAt: new Date().toISOString(),
        },
        metadata: { hasPricingPage: true },
      });
    }

    // Signal: Blog exists (content marketing = budget)
    if (analysis.hasBlog) {
      signals.push({
        type: 'web_visit',
        category: 'firmographic',
        strength: 'weak',
        confidence: 60,
        description: 'Active blog/content marketing',
        evidence: 'Company invests in content creation',
        source: {
          type: 'website',
          url: `${url}/blog`,
          content: '',
          metadata: {},
          extractedAt: new Date().toISOString(),
        },
        metadata: { hasBlog: true },
      });
    }

    // Extract keyword-based signals
    const keywordSignals = await this.extractKeywordSignals(content, url);
    signals.push(...keywordSignals);

    return signals;
  }

  /**
   * Analyze website structure
   */
  private analyzeWebsiteStructure(html: string): WebsiteAnalysis {
    const lowerHtml = html.toLowerCase();

    return {
      hasContactForm: lowerHtml.includes('<form') && (lowerHtml.includes('contact') || lowerHtml.includes('email')),
      hasPricing: lowerHtml.includes('pricing') || lowerHtml.includes('plans'),
      hasBlog: lowerHtml.includes('/blog') || lowerHtml.includes('article'),
      hasCareersPage: lowerHtml.includes('careers') || lowerHtml.includes('jobs') || lowerHtml.includes('join our team'),
      technologies: this.extractTechnologies(html),
      keywords: this.extractKeywords(html),
      metadata: {
        title: this.extractTitle(html),
        description: this.extractMetaDescription(html),
        lastUpdated: this.extractLastUpdated(html),
      },
    };
  }

  private isRecentlyUpdated(html: string): boolean {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    return (
      html.includes(String(currentYear)) ||
      html.includes(String(lastYear)) ||
      html.includes('last-modified')
    );
  }

  private extractJobPostings(html: string): number {
    // Simple heuristic: count occurrences of job-related keywords
    const jobKeywords = ['position', 'opening', 'hiring', 'apply now'];
    let count = 0;

    for (const keyword of jobKeywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = html.match(regex);
      if (matches) count += matches.length;
    }

    return Math.min(count, 50); // Cap at 50
  }

  private extractTechnologies(html: string): string[] {
    const technologies: string[] = [];
    const techPatterns = [
      /react/i,
      /vue/i,
      /angular/i,
      /node\.js/i,
      /python/i,
      /java/i,
      /\.net/i,
      /aws/i,
      /azure/i,
      /google cloud/i,
      /salesforce/i,
      /hubspot/i,
    ];

    for (const pattern of techPatterns) {
      if (pattern.test(html)) {
        technologies.push(pattern.source.replace(/\//g, '').replace(/i$/, ''));
      }
    }

    return technologies;
  }

  private extractKeywords(html: string): string[] {
    // Extract keywords from meta tags or prominent text
    const metaMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i);
    if (metaMatch) {
      return metaMatch[1].split(',').map(k => k.trim());
    }
    return [];
  }

  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : undefined;
  }

  private extractMetaDescription(html: string): string | undefined {
    const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    return match ? match[1].trim() : undefined;
  }

  private extractLastUpdated(html: string): string | undefined {
    const copyrightMatch = html.match(/copyright.*?(\d{4})/i);
    return copyrightMatch ? copyrightMatch[1] : undefined;
  }

  /**
   * Extract keyword-based intent signals using AI
   */
  private async extractKeywordSignals(content: string, url: string): Promise<ExtractedSignal[]> {
    const signals: ExtractedSignal[] = [];

    // Pain point keywords
    const painPoints = [
      'struggling with',
      'need help',
      'looking for',
      'seeking',
      'challenge',
      'problem',
      'inefficient',
      'manual process',
      'time-consuming',
    ];

    for (const pain of painPoints) {
      if (content.toLowerCase().includes(pain)) {
        signals.push({
          type: 'web_visit',
          category: 'contextual',
          strength: 'medium',
          confidence: 65,
          description: `Pain point mentioned: "${pain}"`,
          evidence: `Website content indicates awareness of problem`,
          source: {
            type: 'website',
            url,
            content: this.extractContext(content, pain),
            metadata: { keyword: pain },
            extractedAt: new Date().toISOString(),
          },
          metadata: { painPoint: pain },
        });
      }
    }

    // Solution-aware keywords
    const solutions = [
      'software',
      'platform',
      'automation',
      'integration',
      'crm',
      'analytics',
      'dashboard',
      'reporting',
    ];

    for (const solution of solutions) {
      if (content.toLowerCase().includes(solution)) {
        signals.push({
          type: 'web_visit',
          category: 'contextual',
          strength: 'weak',
          confidence: 55,
          description: `Solution-aware keyword: "${solution}"`,
          evidence: 'Website mentions relevant solution category',
          source: {
            type: 'website',
            url,
            content: this.extractContext(content, solution),
            metadata: { keyword: solution },
            extractedAt: new Date().toISOString(),
          },
          metadata: { solutionKeyword: solution },
        });
      }
    }

    return signals;
  }

  private extractContext(content: string, keyword: string, contextLength: number = 200): string {
    const index = content.toLowerCase().indexOf(keyword.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + keyword.length + contextLength / 2);

    return '...' + content.substring(start, end) + '...';
  }
}

/**
 * Job Posting Signal Extractor
 * Analyzes job postings for growth and technology signals
 */
export class JobPostingSignalExtractor {
  /**
   * Extract signals from job postings
   */
  async extract(jobPostings: any[]): Promise<ExtractedSignal[]> {
    const signals: ExtractedSignal[] = [];

    if (jobPostings.length === 0) return signals;

    // Signal: High volume hiring (growth)
    if (jobPostings.length > 10) {
      signals.push({
        type: 'job_posting',
        category: 'firmographic',
        strength: 'very_strong',
        confidence: 95,
        description: `Rapid hiring (${jobPostings.length} open positions)`,
        evidence: 'High number of job openings indicates significant growth',
        source: {
          type: 'job_posting',
          content: JSON.stringify(jobPostings.slice(0, 5)),
          metadata: { totalJobs: jobPostings.length },
          extractedAt: new Date().toISOString(),
        },
        metadata: { jobCount: jobPostings.length },
      });
    }

    // Analyze job titles for tech stack signals
    const techSignals = this.extractTechStackFromJobs(jobPostings);
    signals.push(...techSignals);

    // Analyze for department expansion
    const departmentSignals = this.extractDepartmentExpansion(jobPostings);
    signals.push(...departmentSignals);

    return signals;
  }

  private extractTechStackFromJobs(jobPostings: any[]): ExtractedSignal[] {
    const signals: ExtractedSignal[] = [];
    const technologies = new Set<string>();

    const techKeywords = [
      'salesforce',
      'hubspot',
      'aws',
      'azure',
      'python',
      'javascript',
      'react',
      'node.js',
      'sql',
      'kubernetes',
    ];

    for (const job of jobPostings) {
      const jobText = (job.title + ' ' + job.description).toLowerCase();

      for (const tech of techKeywords) {
        if (jobText.includes(tech.toLowerCase())) {
          technologies.add(tech);
        }
      }
    }

    if (technologies.size > 0) {
      signals.push({
        type: 'tech_stack',
        category: 'technographic',
        strength: 'strong',
        confidence: 85,
        description: `Tech stack identified: ${Array.from(technologies).join(', ')}`,
        evidence: 'Job postings mention specific technologies',
        source: {
          type: 'job_posting',
          content: JSON.stringify(jobPostings),
          metadata: { technologies: Array.from(technologies) },
          extractedAt: new Date().toISOString(),
        },
        metadata: { technologies: Array.from(technologies) },
      });
    }

    return signals;
  }

  private extractDepartmentExpansion(jobPostings: any[]): ExtractedSignal[] {
    const signals: ExtractedSignal[] = [];
    const departments: Record<string, number> = {};

    const departmentKeywords = {
      sales: ['sales', 'account executive', 'bdr', 'sdr'],
      marketing: ['marketing', 'growth', 'demand generation'],
      engineering: ['engineer', 'developer', 'software'],
      'customer success': ['customer success', 'support', 'account manager'],
    };

    for (const job of jobPostings) {
      const jobText = (job.title + ' ' + job.description).toLowerCase();

      for (const [dept, keywords] of Object.entries(departmentKeywords)) {
        if (keywords.some(kw => jobText.includes(kw))) {
          departments[dept] = (departments[dept] || 0) + 1;
        }
      }
    }

    // Find departments with significant hiring
    for (const [dept, count] of Object.entries(departments)) {
      if (count >= 3) {
        signals.push({
          type: 'job_posting',
          category: 'firmographic',
          strength: 'strong',
          confidence: 80,
          description: `${dept} department expansion (${count} roles)`,
          evidence: `Multiple job openings in ${dept} indicate department growth`,
          source: {
            type: 'job_posting',
            content: '',
            metadata: { department: dept, count },
            extractedAt: new Date().toISOString(),
          },
          metadata: { department: dept, jobCount: count },
        });
      }
    }

    return signals;
  }
}

/**
 * News & Social Signal Extractor
 * Analyzes news articles and social media for intent signals
 */
export class NewsSocialSignalExtractor {
  /**
   * Extract signals from news articles
   */
  async extractFromNews(articles: any[]): Promise<ExtractedSignal[]> {
    const signals: ExtractedSignal[] = [];

    for (const article of articles) {
      const articleText = (article.title + ' ' + article.description).toLowerCase();

      // Funding signal
      if (this.isFundingNews(articleText)) {
        signals.push({
          type: 'funding',
          category: 'firmographic',
          strength: 'very_strong',
          confidence: 95,
          description: 'Recent funding announcement',
          evidence: article.title,
          source: {
            type: 'news',
            url: article.url,
            content: article.description,
            metadata: { publishedAt: article.publishedAt, source: article.source },
            extractedAt: new Date().toISOString(),
          },
          metadata: { fundingAmount: this.extractFundingAmount(articleText) },
        });
      }

      // Acquisition/merger signal
      if (this.isAcquisitionNews(articleText)) {
        signals.push({
          type: 'news_mention',
          category: 'firmographic',
          strength: 'strong',
          confidence: 90,
          description: 'Recent acquisition/merger',
          evidence: article.title,
          source: {
            type: 'news',
            url: article.url,
            content: article.description,
            metadata: { publishedAt: article.publishedAt },
            extractedAt: new Date().toISOString(),
          },
          metadata: { newsType: 'acquisition' },
        });
      }

      // Product launch signal
      if (this.isProductLaunchNews(articleText)) {
        signals.push({
          type: 'news_mention',
          category: 'contextual',
          strength: 'strong',
          confidence: 85,
          description: 'Recent product launch',
          evidence: article.title,
          source: {
            type: 'news',
            url: article.url,
            content: article.description,
            metadata: { publishedAt: article.publishedAt },
            extractedAt: new Date().toISOString(),
          },
          metadata: { newsType: 'product_launch' },
        });
      }

      // Expansion signal
      if (this.isExpansionNews(articleText)) {
        signals.push({
          type: 'news_mention',
          category: 'firmographic',
          strength: 'medium',
          confidence: 75,
          description: 'Market expansion or new office',
          evidence: article.title,
          source: {
            type: 'news',
            url: article.url,
            content: article.description,
            metadata: { publishedAt: article.publishedAt },
            extractedAt: new Date().toISOString(),
          },
          metadata: { newsType: 'expansion' },
        });
      }
    }

    return signals;
  }

  private isFundingNews(text: string): boolean {
    const fundingKeywords = ['raised', 'funding', 'series a', 'series b', 'series c', 'investment', 'venture capital', 'vc'];
    return fundingKeywords.some(kw => text.includes(kw));
  }

  private isAcquisitionNews(text: string): boolean {
    const keywords = ['acquired', 'acquisition', 'merger', 'bought', 'purchased'];
    return keywords.some(kw => text.includes(kw));
  }

  private isProductLaunchNews(text: string): boolean {
    const keywords = ['launches', 'unveils', 'announces', 'introduces new', 'releases'];
    return keywords.some(kw => text.includes(kw));
  }

  private isExpansionNews(text: string): boolean {
    const keywords = ['expands', 'opens new', 'new office', 'enters market', 'international'];
    return keywords.some(kw => text.includes(kw));
  }

  private extractFundingAmount(text: string): string | null {
    // Extract funding amount (e.g., "$10M", "$5.2 million")
    const match = text.match(/\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i);
    if (match) {
      const amount = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const multiplier = unit.startsWith('b') ? 1000 : 1;
      return `$${amount * multiplier}M`;
    }
    return null;
  }
}

/**
 * AI-Powered Signal Analyzer
 * Uses AI to extract nuanced signals from unstructured data
 */
export class AISignalAnalyzer {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Analyze content with AI to extract buying signals
   */
  async analyzeContent(
    content: string,
    context: { companyName: string; industry?: string; source: string }
  ): Promise<ExtractedSignal[]> {
    const prompt = `Analyze the following content and extract buying intent signals.

Company: ${context.companyName}
Industry: ${context.industry || 'Unknown'}
Source: ${context.source}

Content:
${content.substring(0, 2000)}

Extract all buying intent signals. For each signal, provide:
1. Type (funding, job_posting, tech_stack, news_mention, web_visit, content_download)
2. Strength (weak, medium, strong, very_strong)
3. Confidence (0-100)
4. Description (what the signal indicates)
5. Evidence (specific text that supports this signal)

Respond with a JSON array of signals:
[
  {
    "type": "funding",
    "strength": "very_strong",
    "confidence": 95,
    "description": "Company raised $10M Series A",
    "evidence": "Announced $10M funding round led by VC firm"
  }
]

Only include signals with confidence >= 60. Be specific and evidence-based.`;

    try {
      const response = await routeAIRequest(prompt, {
        taskType: 'general',
        teamId: this.teamId,
        prioritizeCost: true,
      });

      // Parse AI response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('AI did not return valid JSON signal array');
        return [];
      }

      const aiSignals = JSON.parse(jsonMatch[0]);

      // Convert to ExtractedSignal format
      return aiSignals.map((signal: any) => ({
        type: signal.type as IntentSignal['type'],
        category: this.categorizeSignal(signal.type),
        strength: signal.strength,
        confidence: signal.confidence,
        description: signal.description,
        evidence: signal.evidence,
        source: {
          type: context.source as any,
          content: content.substring(0, 500),
          metadata: { analyzedByAI: true },
          extractedAt: new Date().toISOString(),
        },
        metadata: { extractedByAI: true },
      }));
    } catch (error) {
      console.error('AI signal analysis failed:', error);
      return [];
    }
  }

  private categorizeSignal(type: string): ExtractedSignal['category'] {
    const categories: Record<string, ExtractedSignal['category']> = {
      funding: 'firmographic',
      job_posting: 'firmographic',
      tech_stack: 'technographic',
      news_mention: 'contextual',
      web_visit: 'behavioral',
      content_download: 'behavioral',
      search_query: 'behavioral',
    };

    return categories[type] || 'contextual';
  }
}

/**
 * Signal Aggregator & Scorer
 * Combines all signals and calculates overall intent score
 */
export class SignalAggregator {
  /**
   * Aggregate signals and calculate intent score
   */
  aggregate(signals: ExtractedSignal[]): SignalAnalysis {
    const signalsByCategory: Record<string, number> = {};
    const signalsByType: Record<string, number> = {};

    // Count signals by category and type
    for (const signal of signals) {
      signalsByCategory[signal.category] = (signalsByCategory[signal.category] || 0) + 1;
      signalsByType[signal.type] = (signalsByType[signal.type] || 0) + 1;
    }

    // Calculate weighted intent score
    const intentScore = this.calculateIntentScore(signals);
    const recommendedAction = this.recommendAction(intentScore, signals);

    return {
      companyProfileId: '',
      totalSignals: signals.length,
      signalsByCategory,
      signalsByType,
      overallIntentScore: intentScore,
      recommendedAction,
      signals,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate overall intent score from signals
   */
  private calculateIntentScore(signals: ExtractedSignal[]): number {
    if (signals.length === 0) return 0;

    const strengthWeights = {
      weak: 0.5,
      medium: 1.0,
      strong: 1.5,
      very_strong: 2.0,
    };

    const categoryMultipliers = {
      behavioral: 1.2, // Highest weight - actual behavior
      technographic: 1.0,
      firmographic: 0.9,
      contextual: 0.8, // Lowest weight - indirect signals
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      const strengthWeight = strengthWeights[signal.strength];
      const categoryMultiplier = categoryMultipliers[signal.category];
      const confidence = signal.confidence / 100;

      const signalScore = strengthWeight * categoryMultiplier * confidence * 100;

      totalScore += signalScore;
      totalWeight += strengthWeight * categoryMultiplier;
    }

    // Normalize to 0-100 scale
    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Cap at 100 and apply boost for signal volume
    const volumeBoost = Math.min(10, signals.length * 0.5); // Up to 10 points for volume

    return Math.min(100, Math.round(normalizedScore + volumeBoost));
  }

  /**
   * Recommend action based on intent score and signals
   */
  private recommendAction(
    intentScore: number,
    signals: ExtractedSignal[]
  ): SignalAnalysis['recommendedAction'] {
    // Check for very strong signals regardless of score
    const hasVeryStrongSignal = signals.some(s => s.strength === 'very_strong');

    if (hasVeryStrongSignal && intentScore >= 70) {
      return 'engage_immediately';
    }

    if (intentScore >= 75) {
      return 'engage_immediately';
    }

    if (intentScore >= 55) {
      return 'engage_soon';
    }

    if (intentScore >= 35) {
      return 'nurture';
    }

    return 'monitor';
  }
}

/**
 * Main Signal Extraction Orchestrator
 */
export class SignalExtractionOrchestrator {
  private teamId: string;
  private websiteExtractor: WebsiteSignalExtractor;
  private jobPostingExtractor: JobPostingSignalExtractor;
  private newsSocialExtractor: NewsSocialSignalExtractor;
  private aiAnalyzer: AISignalAnalyzer;
  private aggregator: SignalAggregator;

  constructor(teamId: string) {
    this.teamId = teamId;
    this.websiteExtractor = new WebsiteSignalExtractor();
    this.jobPostingExtractor = new JobPostingSignalExtractor();
    this.newsSocialExtractor = new NewsSocialSignalExtractor();
    this.aiAnalyzer = new AISignalAnalyzer(teamId);
    this.aggregator = new SignalAggregator();
  }

  /**
   * Extract all signals for a company
   */
  async extractSignals(companyProfileId: string): Promise<SignalAnalysis> {
    const allSignals: ExtractedSignal[] = [];

    // Get company data
    const { data: company } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', companyProfileId)
      .single();

    if (!company) {
      throw new Error('Company not found');
    }

    // Extract from website
    if (company.website) {
      try {
        const websiteContent = await this.fetchWebsiteContent(company.website);
        const websiteSignals = await this.websiteExtractor.extract(company.website, websiteContent);
        allSignals.push(...websiteSignals);
      } catch (error) {
        console.error('Website extraction failed:', error);
      }
    }

    // Extract from job postings
    const { data: jobPostings } = await supabase
      .from('company_job_postings')
      .select('*')
      .eq('company_profile_id', companyProfileId);

    if (jobPostings && jobPostings.length > 0) {
      const jobSignals = await this.jobPostingExtractor.extract(jobPostings);
      allSignals.push(...jobSignals);
    }

    // Extract from news
    const { data: newsArticles } = await supabase
      .from('company_news')
      .select('*')
      .eq('company_profile_id', companyProfileId)
      .gte('published_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

    if (newsArticles && newsArticles.length > 0) {
      const newsSignals = await this.newsSocialExtractor.extractFromNews(newsArticles);
      allSignals.push(...newsSignals);
    }

    // AI analysis for nuanced signals
    if (company.description) {
      const aiSignals = await this.aiAnalyzer.analyzeContent(company.description, {
        companyName: company.name,
        industry: company.industry,
        source: 'company_description',
      });
      allSignals.push(...aiSignals);
    }

    // Aggregate signals and calculate score
    const analysis = this.aggregator.aggregate(allSignals);
    analysis.companyProfileId = companyProfileId;

    // Store signals in database
    await this.storeSignals(companyProfileId, allSignals, analysis);

    return analysis;
  }

  /**
   * Fetch website content
   */
  private async fetchWebsiteContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIRevenueOrc/1.0; +https://airevenueorcheestrator.com/bot)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Website fetch failed:', error);
      throw error;
    }
  }

  /**
   * Store extracted signals
   */
  private async storeSignals(
    companyProfileId: string,
    signals: ExtractedSignal[],
    analysis: SignalAnalysis
  ): Promise<void> {
    // Store individual signals
    const signalRecords = signals.map(signal => ({
      company_profile_id: companyProfileId,
      team_id: this.teamId,
      signal_type: signal.type,
      category: signal.category,
      strength: signal.strength,
      confidence: signal.confidence,
      description: signal.description,
      evidence: signal.evidence,
      source_type: signal.source.type,
      source_url: signal.source.url,
      source_metadata: signal.source.metadata,
      metadata: signal.metadata,
      detected_at: signal.source.extractedAt,
      created_at: new Date().toISOString(),
    }));

    if (signalRecords.length > 0) {
      await supabase.from('intent_signals').insert(signalRecords);
    }

    // Update company intent score
    await supabase
      .from('company_profiles')
      .update({
        intent_score: analysis.overallIntentScore,
        intent_tier: this.getIntentTier(analysis.overallIntentScore),
        last_signal_extraction_at: new Date().toISOString(),
        signal_count: analysis.totalSignals,
      })
      .eq('id', companyProfileId);
  }

  private getIntentTier(score: number): string {
    if (score >= 75) return 'hot';
    if (score >= 55) return 'warm';
    if (score >= 35) return 'lukewarm';
    return 'cold';
  }
}

/**
 * Extract signals for a company (workflow action)
 */
export async function extractSignalsWorkflowAction(
  teamId: string,
  companyProfileId: string
): Promise<SignalAnalysis> {
  const orchestrator = new SignalExtractionOrchestrator(teamId);
  return await orchestrator.extractSignals(companyProfileId);
}
