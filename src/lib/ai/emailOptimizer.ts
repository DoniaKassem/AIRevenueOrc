/**
 * AI Email Optimizer
 * Learns from email performance data to continuously improve personalization
 * Uses OpenAI for analysis and recommendation generation
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface EmailPerformanceData {
  emailId: string;
  prospectId: string;
  subject: string;
  body: string;
  sentAt: string;
  opened: boolean;
  openedAt?: string;
  clicked: boolean;
  clickedAt?: string;
  replied: boolean;
  repliedAt?: string;
  replyContent?: string;
  replySentiment?: 'positive' | 'neutral' | 'negative';
  converted: boolean;
  signalsUsed: string[];
  personalizationScore: number;
  prospectIndustry?: string;
  prospectTitle?: string;
  prospectSeniority?: string;
}

export interface OptimizationInsight {
  category: 'subject_line' | 'opening' | 'body' | 'cta' | 'timing' | 'personalization';
  insight: string;
  confidence: number;
  recommendation: string;
  basedOn: string;
}

export interface PerformancePattern {
  pattern: string;
  successRate: number;
  sampleSize: number;
  segments: {
    industry?: string;
    seniority?: string;
    buyingStage?: string;
  };
  examples: string[];
}

export interface OptimizationReport {
  overallMetrics: {
    totalEmails: number;
    openRate: number;
    replyRate: number;
    positiveReplyRate: number;
    avgPersonalizationScore: number;
  };
  topPerformingPatterns: PerformancePattern[];
  underperformingPatterns: PerformancePattern[];
  insights: OptimizationInsight[];
  recommendations: string[];
  suggestedExperiments: Array<{
    hypothesis: string;
    test: string;
    expectedImpact: string;
  }>;
}

export interface ReplyAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'interested' | 'not_now' | 'not_interested' | 'needs_info' | 'referral' | 'objection';
  keyObjections: string[];
  followUpRecommendation: string;
  suggestedResponse: string;
}

// =============================================
// EMAIL OPTIMIZER
// =============================================

export class EmailOptimizer {
  private openai: OpenAI;
  private model = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze email performance and generate optimization report
   */
  async analyzePerformance(teamId: string, daysBack: number = 30): Promise<OptimizationReport> {
    // Get email performance data
    const performanceData = await this.getPerformanceData(teamId, daysBack);

    if (performanceData.length < 10) {
      return this.getInsufficientDataReport(performanceData.length);
    }

    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(performanceData);

    // Find patterns
    const topPerformingPatterns = await this.findPerformingPatterns(performanceData, 'top');
    const underperformingPatterns = await this.findPerformingPatterns(performanceData, 'under');

    // Generate AI insights
    const insights = await this.generateInsights(performanceData, overallMetrics);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(insights, topPerformingPatterns);

    // Suggest experiments
    const suggestedExperiments = await this.suggestExperiments(insights, underperformingPatterns);

    return {
      overallMetrics,
      topPerformingPatterns,
      underperformingPatterns,
      insights,
      recommendations,
      suggestedExperiments,
    };
  }

  /**
   * Analyze a reply and recommend next action
   */
  async analyzeReply(
    originalEmail: string,
    replyContent: string,
    prospectContext: {
      title?: string;
      company?: string;
      industry?: string;
    }
  ): Promise<ReplyAnalysis> {
    const prompt = `Analyze this email reply from a sales prospect and provide actionable recommendations.

ORIGINAL EMAIL SENT:
${originalEmail}

PROSPECT'S REPLY:
${replyContent}

PROSPECT CONTEXT:
- Title: ${prospectContext.title || 'Unknown'}
- Company: ${prospectContext.company || 'Unknown'}
- Industry: ${prospectContext.industry || 'Unknown'}

Analyze:
1. SENTIMENT: "positive", "neutral", or "negative"
2. INTENT: What are they actually saying?
   - "interested" - Want to learn more/meet
   - "not_now" - Bad timing, but maybe later
   - "not_interested" - Clear no
   - "needs_info" - Want more details before committing
   - "referral" - Suggesting someone else
   - "objection" - Raising a concern
3. KEY OBJECTIONS: Any specific objections raised
4. FOLLOW-UP RECOMMENDATION: What should the rep do next?
5. SUGGESTED RESPONSE: Draft a response email (if appropriate)

Return as JSON:
{
  "sentiment": "...",
  "intent": "...",
  "keyObjections": [...],
  "followUpRecommendation": "...",
  "suggestedResponse": "..."
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a sales response analyst. Provide accurate analysis and helpful recommendations. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        sentiment: 'neutral',
        intent: 'needs_info',
        keyObjections: [],
        followUpRecommendation: 'Review reply manually and respond appropriately',
        suggestedResponse: '',
      };
    }
  }

  /**
   * Optimize an email before sending based on historical performance
   */
  async optimizeEmailBeforeSend(
    teamId: string,
    email: { subject: string; body: string },
    prospectContext: {
      title?: string;
      industry?: string;
      seniority?: string;
      buyingStage?: string;
    }
  ): Promise<{
    optimizedSubject: string;
    optimizedBody: string;
    changes: string[];
    expectedImprovements: string[];
  }> {
    // Get historical patterns for similar prospects
    const similarPerformance = await this.getSimilarProspectPerformance(teamId, prospectContext);

    const prompt = `Optimize this email based on what has worked for similar prospects.

ORIGINAL EMAIL:
Subject: ${email.subject}
Body: ${email.body}

PROSPECT CONTEXT:
- Title: ${prospectContext.title || 'Unknown'}
- Industry: ${prospectContext.industry || 'Unknown'}
- Seniority: ${prospectContext.seniority || 'Unknown'}
- Buying Stage: ${prospectContext.buyingStage || 'Unknown'}

HISTORICAL PERFORMANCE DATA FOR SIMILAR PROSPECTS:
${JSON.stringify(similarPerformance, null, 2)}

OPTIMIZATION GOALS:
1. Improve open rate (optimize subject line)
2. Improve reply rate (optimize body)
3. Maintain personalization
4. Keep it concise

SPECIFIC OPTIMIZATIONS TO CONSIDER:
- Subject line: Based on what's worked, adjust length, wording, curiosity
- Opening line: Make it more relevant to this prospect type
- Value proposition: Emphasize what resonates with this segment
- CTA: Use the CTA style that gets replies from this persona
- Length: Optimal length for this audience

Provide:
1. Optimized subject line
2. Optimized email body
3. List of changes made
4. Expected improvements

Return as JSON:
{
  "optimizedSubject": "...",
  "optimizedBody": "...",
  "changes": ["Change 1", "Change 2", ...],
  "expectedImprovements": ["Should improve X by Y%", ...]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an email optimization expert. Make targeted improvements based on data. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        optimizedSubject: email.subject,
        optimizedBody: email.body,
        changes: [],
        expectedImprovements: [],
      };
    }
  }

  /**
   * Learn from a successful email to improve future generations
   */
  async learnFromSuccess(
    teamId: string,
    email: { subject: string; body: string },
    outcome: {
      opened: boolean;
      replied: boolean;
      replyPositive: boolean;
      converted: boolean;
    },
    prospectContext: {
      title?: string;
      industry?: string;
      seniority?: string;
      signals?: string[];
    }
  ): Promise<void> {
    // Extract patterns from successful email
    const prompt = `Analyze this successful email and extract reusable patterns.

EMAIL:
Subject: ${email.subject}
Body: ${email.body}

OUTCOME:
- Opened: ${outcome.opened}
- Replied: ${outcome.replied}
- Positive Reply: ${outcome.replyPositive}
- Converted: ${outcome.converted}

PROSPECT CONTEXT:
- Title: ${prospectContext.title}
- Industry: ${prospectContext.industry}
- Seniority: ${prospectContext.seniority}
- Signals Used: ${prospectContext.signals?.join(', ')}

Extract:
1. What made the subject line effective?
2. What made the opening hook work?
3. What personalization elements contributed to success?
4. What was the CTA approach?
5. What can be replicated for similar prospects?

Return as JSON:
{
  "subjectPatterns": [...],
  "openingPatterns": [...],
  "personalizationPatterns": [...],
  "ctaPatterns": [...],
  "segmentApplicability": {
    "industries": [...],
    "seniorities": [...],
    "titles": [...]
  }
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a pattern recognition expert for sales emails. Extract actionable patterns.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 800,
    });

    try {
      const patterns = JSON.parse(completion.choices[0].message.content || '{}');

      // Store learned patterns
      await supabase.from('email_patterns').insert({
        team_id: teamId,
        pattern_type: 'success',
        subject_patterns: patterns.subjectPatterns,
        opening_patterns: patterns.openingPatterns,
        personalization_patterns: patterns.personalizationPatterns,
        cta_patterns: patterns.ctaPatterns,
        segment_applicability: patterns.segmentApplicability,
        outcome: outcome,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to learn from success:', error);
    }
  }

  /**
   * Get performance data from database
   */
  private async getPerformanceData(teamId: string, daysBack: number): Promise<EmailPerformanceData[]> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const { data } = await supabase
      .from('email_tracking_events')
      .select(`
        *,
        prospects (title, company, enrichment_data),
        ai_email_generations (subject, body, signals_used, personalization_score)
      `)
      .eq('team_id', teamId)
      .gte('created_at', since.toISOString());

    return (data || []).map(row => ({
      emailId: row.id,
      prospectId: row.prospect_id,
      subject: row.ai_email_generations?.subject || '',
      body: row.ai_email_generations?.body || '',
      sentAt: row.sent_at,
      opened: row.opened || false,
      openedAt: row.opened_at,
      clicked: row.clicked || false,
      clickedAt: row.clicked_at,
      replied: row.replied || false,
      repliedAt: row.replied_at,
      replyContent: row.reply_content,
      replySentiment: row.reply_sentiment,
      converted: row.converted || false,
      signalsUsed: row.ai_email_generations?.signals_used || [],
      personalizationScore: row.ai_email_generations?.personalization_score || 0,
      prospectIndustry: row.prospects?.enrichment_data?.company?.industry,
      prospectTitle: row.prospects?.title,
      prospectSeniority: row.prospects?.enrichment_data?.professional?.seniority,
    }));
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(data: EmailPerformanceData[]) {
    const total = data.length;
    const opened = data.filter(d => d.opened).length;
    const replied = data.filter(d => d.replied).length;
    const positiveReplies = data.filter(d => d.replySentiment === 'positive').length;
    const avgScore = data.reduce((sum, d) => sum + d.personalizationScore, 0) / total;

    return {
      totalEmails: total,
      openRate: Math.round((opened / total) * 100),
      replyRate: Math.round((replied / total) * 100),
      positiveReplyRate: Math.round((positiveReplies / total) * 100),
      avgPersonalizationScore: Math.round(avgScore),
    };
  }

  /**
   * Find performing patterns
   */
  private async findPerformingPatterns(
    data: EmailPerformanceData[],
    type: 'top' | 'under'
  ): Promise<PerformancePattern[]> {
    const performingEmails = type === 'top'
      ? data.filter(d => d.replied && d.replySentiment === 'positive')
      : data.filter(d => !d.opened);

    if (performingEmails.length < 3) return [];

    const prompt = `Analyze these ${type === 'top' ? 'successful' : 'unsuccessful'} emails and identify common patterns.

EMAILS:
${performingEmails.slice(0, 10).map((e, i) => `
Email ${i + 1}:
Subject: ${e.subject}
Body: ${e.body.slice(0, 300)}...
Prospect: ${e.prospectTitle} at ${e.prospectIndustry} company
`).join('\n')}

Identify 3-5 common patterns that may have contributed to ${type === 'top' ? 'success' : 'failure'}.

Return as JSON array:
[
  {
    "pattern": "Description of pattern",
    "successRate": ${type === 'top' ? '75' : '15'},
    "sampleSize": ${performingEmails.length},
    "segments": { "industry": "...", "seniority": "..." },
    "examples": ["Example 1", "Example 2"]
  }
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a pattern analysis expert. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Generate AI insights
   */
  private async generateInsights(
    data: EmailPerformanceData[],
    metrics: OptimizationReport['overallMetrics']
  ): Promise<OptimizationInsight[]> {
    const prompt = `Based on this email performance data, generate actionable insights.

OVERALL METRICS:
- Total Emails: ${metrics.totalEmails}
- Open Rate: ${metrics.openRate}%
- Reply Rate: ${metrics.replyRate}%
- Positive Reply Rate: ${metrics.positiveReplyRate}%
- Avg Personalization Score: ${metrics.avgPersonalizationScore}

SAMPLE SUBJECTS (opened vs not opened):
Opened: ${data.filter(d => d.opened).slice(0, 5).map(d => d.subject).join(', ')}
Not Opened: ${data.filter(d => !d.opened).slice(0, 5).map(d => d.subject).join(', ')}

SIGNALS USED IN SUCCESSFUL EMAILS:
${data.filter(d => d.replied).flatMap(d => d.signalsUsed).slice(0, 20).join(', ')}

Generate 5 specific, actionable insights across these categories:
- subject_line
- opening
- body
- cta
- timing
- personalization

Return as JSON array:
[
  {
    "category": "subject_line",
    "insight": "Specific observation",
    "confidence": 85,
    "recommendation": "What to do",
    "basedOn": "Data point this is based on"
  }
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a sales analytics expert. Provide specific, data-backed insights. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1200,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    insights: OptimizationInsight[],
    topPatterns: PerformancePattern[]
  ): Promise<string[]> {
    const prompt = `Based on these insights and patterns, generate 5 specific recommendations to improve email performance.

INSIGHTS:
${insights.map(i => `- ${i.category}: ${i.insight}`).join('\n')}

TOP PERFORMING PATTERNS:
${topPatterns.map(p => `- ${p.pattern}`).join('\n')}

Generate 5 actionable recommendations that can be implemented immediately.
Be specific - include examples where helpful.

Return as JSON array of strings:
["Recommendation 1", "Recommendation 2", ...]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a sales optimization consultant. Be specific and actionable. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Suggest experiments
   */
  private async suggestExperiments(
    insights: OptimizationInsight[],
    underperformingPatterns: PerformancePattern[]
  ): Promise<Array<{ hypothesis: string; test: string; expectedImpact: string }>> {
    const prompt = `Based on these insights and underperforming patterns, suggest A/B tests to run.

INSIGHTS:
${insights.map(i => `- ${i.category}: ${i.insight}`).join('\n')}

UNDERPERFORMING PATTERNS:
${underperformingPatterns.map(p => `- ${p.pattern}`).join('\n')}

Suggest 3 experiments with:
1. Clear hypothesis
2. What to test
3. Expected impact

Return as JSON array:
[
  {
    "hypothesis": "If we X, then Y will improve because Z",
    "test": "Test A vs B",
    "expectedImpact": "+X% improvement in Y"
  }
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a growth experimentation expert. Suggest high-impact tests. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Get performance data for similar prospects
   */
  private async getSimilarProspectPerformance(
    teamId: string,
    context: {
      title?: string;
      industry?: string;
      seniority?: string;
      buyingStage?: string;
    }
  ): Promise<any> {
    // Get patterns from database
    const { data: patterns } = await supabase
      .from('email_patterns')
      .select('*')
      .eq('team_id', teamId)
      .eq('pattern_type', 'success')
      .order('created_at', { ascending: false })
      .limit(10);

    // Filter for applicable patterns
    const applicablePatterns = (patterns || []).filter(p => {
      const seg = p.segment_applicability || {};
      if (context.industry && seg.industries?.length && !seg.industries.includes(context.industry)) {
        return false;
      }
      if (context.seniority && seg.seniorities?.length && !seg.seniorities.includes(context.seniority)) {
        return false;
      }
      return true;
    });

    return {
      patternCount: applicablePatterns.length,
      subjectPatterns: applicablePatterns.flatMap(p => p.subject_patterns || []),
      openingPatterns: applicablePatterns.flatMap(p => p.opening_patterns || []),
      ctaPatterns: applicablePatterns.flatMap(p => p.cta_patterns || []),
    };
  }

  /**
   * Return insufficient data report
   */
  private getInsufficientDataReport(count: number): OptimizationReport {
    return {
      overallMetrics: {
        totalEmails: count,
        openRate: 0,
        replyRate: 0,
        positiveReplyRate: 0,
        avgPersonalizationScore: 0,
      },
      topPerformingPatterns: [],
      underperformingPatterns: [],
      insights: [{
        category: 'personalization',
        insight: 'Insufficient data for analysis',
        confidence: 0,
        recommendation: 'Send at least 10 emails to enable performance analysis',
        basedOn: `Only ${count} emails in dataset`,
      }],
      recommendations: ['Send more emails to enable AI optimization'],
      suggestedExperiments: [],
    };
  }
}

/**
 * Create email optimizer instance
 */
export function createEmailOptimizer(): EmailOptimizer {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  return new EmailOptimizer(apiKey);
}

/**
 * Analyze and optimize email performance
 */
export async function analyzeEmailPerformance(
  teamId: string,
  daysBack: number = 30
): Promise<OptimizationReport> {
  const optimizer = createEmailOptimizer();
  return optimizer.analyzePerformance(teamId, daysBack);
}

/**
 * Optimize email before sending
 */
export async function optimizeEmail(
  teamId: string,
  email: { subject: string; body: string },
  prospectContext: {
    title?: string;
    industry?: string;
    seniority?: string;
    buyingStage?: string;
  }
) {
  const optimizer = createEmailOptimizer();
  return optimizer.optimizeEmailBeforeSend(teamId, email, prospectContext);
}
