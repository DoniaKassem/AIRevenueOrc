/**
 * AI Lead Scoring
 * Machine learning-powered lead scoring and qualification
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

export interface LeadScoringResult {
  prospectId: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number; // 0-100
  signals: {
    positive: Array<{
      factor: string;
      impact: number;
      description: string;
    }>;
    negative: Array<{
      factor: string;
      impact: number;
      description: string;
    }>;
  };
  qualification: {
    budget: 'qualified' | 'unqualified' | 'unknown';
    authority: 'qualified' | 'unqualified' | 'unknown';
    need: 'qualified' | 'unqualified' | 'unknown';
    timing: 'qualified' | 'unqualified' | 'unknown';
  };
  recommendations: string[];
  nextBestActions: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  predictedCloseDate?: Date;
  predictedCloseRate?: number;
}

export interface ScoringFactors {
  // Company factors
  companySize?: number;
  companyRevenue?: number;
  companyIndustry?: string;
  companyGrowthRate?: number;

  // Engagement factors
  emailOpens?: number;
  emailClicks?: number;
  emailReplies?: number;
  websiteVisits?: number;
  contentDownloads?: number;
  meetingsAttended?: number;

  // Demographic factors
  jobTitle?: string;
  seniority?: string;
  department?: string;

  // Behavioral factors
  daysActive?: number;
  lastActivityDate?: Date;
  averageResponseTime?: number; // hours

  // Custom factors
  customFields?: Record<string, any>;
}

/**
 * AI Lead Scoring Service
 */
export class AILeadScoring {
  private openai: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Score a lead using AI
   */
  async scoreProspect(prospectId: string): Promise<LeadScoringResult> {
    // Get comprehensive prospect data
    const prospectData = await this.getProspectData(prospectId);

    if (!prospectData) {
      throw new Error('Prospect not found');
    }

    // Calculate scoring factors
    const factors = this.calculateScoringFactors(prospectData);

    // Use AI to analyze and score
    const aiAnalysis = await this.analyzeWithAI(prospectData, factors);

    // Combine rule-based and AI scoring
    const finalScore = this.calculateFinalScore(factors, aiAnalysis);

    // Calculate grade
    const grade = this.calculateGrade(finalScore);

    // BANT qualification
    const qualification = await this.assessBANT(prospectData);

    // Get recommendations
    const recommendations = this.generateRecommendations(finalScore, qualification, factors);

    // Predict close metrics
    const predictions = this.predictCloseMetrics(factors, aiAnalysis);

    const result: LeadScoringResult = {
      prospectId,
      score: finalScore,
      grade,
      confidence: aiAnalysis.confidence || 75,
      signals: aiAnalysis.signals || { positive: [], negative: [] },
      qualification,
      recommendations,
      nextBestActions: aiAnalysis.nextBestActions || [],
      predictedCloseDate: predictions.closeDate,
      predictedCloseRate: predictions.closeRate
    };

    // Save scoring result
    await this.saveScoringResult(result);

    // Update prospect score in database
    await supabase
      .from('prospects')
      .update({
        score: finalScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', prospectId);

    return result;
  }

  /**
   * Batch score multiple prospects
   */
  async batchScoreProspects(prospectIds: string[]): Promise<LeadScoringResult[]> {
    const results: LeadScoringResult[] = [];

    // Process in batches of 10
    for (let i = 0; i < prospectIds.length; i += 10) {
      const batch = prospectIds.slice(i, i + 10);
      const batchPromises = batch.map(id => this.scoreProspect(id));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get top-scoring prospects
   */
  async getTopProspects(limit: number = 20): Promise<LeadScoringResult[]> {
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id')
      .order('score', { ascending: false })
      .limit(limit);

    if (!prospects || prospects.length === 0) {
      return [];
    }

    return await Promise.all(
      prospects.map(p => this.scoreProspect(p.id))
    );
  }

  /**
   * Identify at-risk deals
   */
  async identifyAtRiskDeals(): Promise<Array<{
    prospectId: string;
    riskScore: number;
    riskFactors: string[];
    recommendations: string[];
  }>> {
    const { data: prospects } = await supabase
      .from('prospects')
      .select('*')
      .in('stage', ['proposal_sent', 'negotiation', 'verbal_commit'])
      .order('updated_at', { ascending: true });

    if (!prospects || prospects.length === 0) {
      return [];
    }

    const atRiskDeals = [];

    for (const prospect of prospects) {
      const prospectData = await this.getProspectData(prospect.id);
      if (!prospectData) continue;

      const riskAnalysis = await this.analyzeRisk(prospectData);

      if (riskAnalysis.riskScore > 50) {
        atRiskDeals.push({
          prospectId: prospect.id,
          riskScore: riskAnalysis.riskScore,
          riskFactors: riskAnalysis.factors,
          recommendations: riskAnalysis.recommendations
        });
      }
    }

    return atRiskDeals.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get prospect data
   */
  private async getProspectData(prospectId: string): Promise<any> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select(`
        *,
        accounts (*),
        bdr_activities (*)
      `)
      .eq('id', prospectId)
      .single();

    return prospect;
  }

  /**
   * Calculate scoring factors
   */
  private calculateScoringFactors(prospectData: any): ScoringFactors {
    const activities = prospectData.bdr_activities || [];

    // Email engagement
    const emailActivities = activities.filter((a: any) => a.activity_type === 'email');
    const emailOpens = emailActivities.filter((a: any) => a.metadata?.opened).length;
    const emailClicks = emailActivities.filter((a: any) => a.metadata?.clicked).length;
    const emailReplies = activities.filter((a: any) => a.activity_type === 'email' && a.direction === 'inbound').length;

    // Meetings
    const meetingsAttended = activities.filter((a: any) => a.activity_type === 'meeting' && a.completed_at).length;

    // Activity timeline
    const firstActivity = activities.length > 0 ? new Date(activities[activities.length - 1].created_at) : null;
    const lastActivity = activities.length > 0 ? new Date(activities[0].created_at) : null;
    const daysActive = firstActivity && lastActivity
      ? Math.floor((lastActivity.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Response time (average time between outbound and inbound emails)
    const responseTimes: number[] = [];
    for (let i = 0; i < activities.length - 1; i++) {
      if (activities[i].activity_type === 'email' && activities[i].direction === 'inbound' &&
          activities[i + 1].activity_type === 'email' && activities[i + 1].direction === 'outbound') {
        const diff = new Date(activities[i].created_at).getTime() - new Date(activities[i + 1].created_at).getTime();
        responseTimes.push(diff / (1000 * 60 * 60)); // hours
      }
    }
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

    return {
      companySize: prospectData.accounts?.employees,
      companyRevenue: prospectData.accounts?.revenue,
      companyIndustry: prospectData.accounts?.industry,
      emailOpens,
      emailClicks,
      emailReplies,
      meetingsAttended,
      jobTitle: prospectData.title,
      seniority: this.determineSeniority(prospectData.title),
      department: this.determineDepartment(prospectData.title),
      daysActive,
      lastActivityDate: lastActivity || undefined,
      averageResponseTime: averageResponseTime || undefined
    };
  }

  /**
   * Analyze with AI
   */
  private async analyzeWithAI(prospectData: any, factors: ScoringFactors): Promise<any> {
    const systemPrompt = `You are an expert sales AI analyzing lead quality and fit. Provide comprehensive scoring analysis.`;

    const userPrompt = `
Analyze this prospect:

Prospect Information:
- Name: ${prospectData.first_name} ${prospectData.last_name}
- Title: ${prospectData.title || 'Unknown'}
- Company: ${prospectData.company || 'Unknown'}
- Industry: ${factors.companyIndustry || 'Unknown'}
- Company Size: ${factors.companySize || 'Unknown'} employees
- Stage: ${prospectData.stage || 'Unknown'}

Engagement Metrics:
- Email Opens: ${factors.emailOpens || 0}
- Email Clicks: ${factors.emailClicks || 0}
- Email Replies: ${factors.emailReplies || 0}
- Meetings Attended: ${factors.meetingsAttended || 0}
- Days Active: ${factors.daysActive || 0}
- Avg Response Time: ${factors.averageResponseTime ? `${factors.averageResponseTime.toFixed(1)} hours` : 'Unknown'}

Provide analysis in JSON format:
{
  "confidence": 0-100,
  "signals": {
    "positive": [
      {"factor": "name", "impact": 0-20, "description": "why this is positive"}
    ],
    "negative": [
      {"factor": "name", "impact": 0-20, "description": "why this is negative"}
    ]
  },
  "nextBestActions": [
    {"action": "action name", "priority": "high|medium|low", "reasoning": "why"}
  ]
}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      return { confidence: 75, signals: { positive: [], negative: [] }, nextBestActions: [] };
    }
  }

  /**
   * Calculate final score
   */
  private calculateFinalScore(factors: ScoringFactors, aiAnalysis: any): number {
    let score = 50; // Base score

    // Company fit (0-20 points)
    if (factors.companySize) {
      if (factors.companySize >= 100) score += 10;
      else if (factors.companySize >= 50) score += 7;
      else if (factors.companySize >= 10) score += 4;
    }

    // Engagement (0-30 points)
    if (factors.emailOpens) score += Math.min(factors.emailOpens * 2, 10);
    if (factors.emailClicks) score += Math.min(factors.emailClicks * 3, 10);
    if (factors.emailReplies) score += Math.min(factors.emailReplies * 5, 10);

    // Meetings (0-20 points)
    if (factors.meetingsAttended) score += Math.min(factors.meetingsAttended * 10, 20);

    // Seniority (0-15 points)
    if (factors.seniority === 'executive') score += 15;
    else if (factors.seniority === 'director') score += 10;
    else if (factors.seniority === 'manager') score += 7;
    else if (factors.seniority === 'individual_contributor') score += 4;

    // Response time (0-10 points)
    if (factors.averageResponseTime) {
      if (factors.averageResponseTime < 4) score += 10;
      else if (factors.averageResponseTime < 24) score += 7;
      else if (factors.averageResponseTime < 48) score += 4;
    }

    // Activity recency (0-5 points)
    if (factors.lastActivityDate) {
      const daysSince = Math.floor((Date.now() - factors.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 3) score += 5;
      else if (daysSince < 7) score += 3;
      else if (daysSince < 14) score += 1;
      else score -= 5; // Penalty for stale leads
    }

    // Apply AI signals
    if (aiAnalysis.signals) {
      const positiveImpact = aiAnalysis.signals.positive?.reduce((sum: number, s: any) => sum + s.impact, 0) || 0;
      const negativeImpact = aiAnalysis.signals.negative?.reduce((sum: number, s: any) => sum + s.impact, 0) || 0;
      score += positiveImpact - negativeImpact;
    }

    // Normalize to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate grade
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Assess BANT (Budget, Authority, Need, Timing)
   */
  private async assessBANT(prospectData: any): Promise<{
    budget: 'qualified' | 'unqualified' | 'unknown';
    authority: 'qualified' | 'unqualified' | 'unknown';
    need: 'qualified' | 'unqualified' | 'unknown';
    timing: 'qualified' | 'unqualified' | 'unknown';
  }> {
    // Authority assessment based on title
    const seniority = this.determineSeniority(prospectData.title);
    const authority = ['executive', 'director'].includes(seniority) ? 'qualified' : 'unknown';

    // Need assessment based on engagement
    const activities = prospectData.bdr_activities || [];
    const hasEngagement = activities.length >= 3;
    const need = hasEngagement ? 'qualified' : 'unknown';

    // Timing assessment based on recent activity
    const lastActivity = activities.length > 0 ? new Date(activities[0].created_at) : null;
    const daysSinceActivity = lastActivity
      ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const timing = daysSinceActivity < 14 ? 'qualified' : 'unknown';

    return {
      budget: 'unknown', // Requires explicit discovery
      authority,
      need,
      timing
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    score: number,
    qualification: any,
    factors: ScoringFactors
  ): string[] {
    const recommendations: string[] = [];

    if (score >= 70) {
      recommendations.push('High-priority lead - prioritize outreach');
      recommendations.push('Schedule a discovery call or demo');
    } else if (score >= 50) {
      recommendations.push('Continue nurturing with valuable content');
      recommendations.push('Try to engage with personalized outreach');
    } else {
      recommendations.push('Low engagement - consider re-engagement campaign');
      recommendations.push('Verify contact information and job role');
    }

    if (qualification.authority === 'unqualified') {
      recommendations.push('Identify economic buyer or decision maker');
    }

    if (!factors.meetingsAttended) {
      recommendations.push('Focus on booking first meeting');
    }

    if (factors.emailReplies === 0) {
      recommendations.push('Improve email personalization and value proposition');
    }

    return recommendations;
  }

  /**
   * Predict close metrics
   */
  private predictCloseMetrics(factors: ScoringFactors, aiAnalysis: any): {
    closeDate?: Date;
    closeRate?: number;
  } {
    // Simple prediction model
    // In production, this would use historical data and ML

    const daysToClose = factors.meetingsAttended
      ? 30 + (3 - factors.meetingsAttended) * 15
      : 60;

    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + daysToClose);

    let closeRate = 10; // Base 10%
    if (factors.emailReplies && factors.emailReplies > 0) closeRate += 15;
    if (factors.meetingsAttended && factors.meetingsAttended > 0) closeRate += 25;
    if (factors.meetingsAttended && factors.meetingsAttended >= 2) closeRate += 20;
    if (factors.seniority === 'executive') closeRate += 15;

    return {
      closeDate,
      closeRate: Math.min(closeRate, 85)
    };
  }

  /**
   * Analyze risk
   */
  private async analyzeRisk(prospectData: any): Promise<{
    riskScore: number;
    factors: string[];
    recommendations: string[];
  }> {
    let riskScore = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];

    const activities = prospectData.bdr_activities || [];
    const lastActivity = activities.length > 0 ? new Date(activities[0].created_at) : null;

    if (lastActivity) {
      const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceActivity > 14) {
        riskScore += 30;
        factors.push('No activity in 2+ weeks');
        recommendations.push('Reach out immediately to re-engage');
      } else if (daysSinceActivity > 7) {
        riskScore += 15;
        factors.push('Activity slowing down');
        recommendations.push('Schedule follow-up within 48 hours');
      }
    } else {
      riskScore += 50;
      factors.push('No activity recorded');
      recommendations.push('Urgent: Establish contact');
    }

    // Check for stalled stage
    const stageChangedAt = new Date(prospectData.updated_at);
    const daysInStage = Math.floor((Date.now() - stageChangedAt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysInStage > 30) {
      riskScore += 25;
      factors.push('Deal stalled in current stage');
      recommendations.push('Re-qualify and identify blockers');
    }

    return { riskScore, factors, recommendations };
  }

  /**
   * Determine seniority from title
   */
  private determineSeniority(title: string): string {
    if (!title) return 'unknown';

    const titleLower = title.toLowerCase();

    if (titleLower.includes('ceo') || titleLower.includes('cto') || titleLower.includes('cfo') ||
        titleLower.includes('chief') || titleLower.includes('president') || titleLower.includes('vp')) {
      return 'executive';
    }

    if (titleLower.includes('director') || titleLower.includes('head of')) {
      return 'director';
    }

    if (titleLower.includes('manager') || titleLower.includes('lead')) {
      return 'manager';
    }

    return 'individual_contributor';
  }

  /**
   * Determine department from title
   */
  private determineDepartment(title: string): string {
    if (!title) return 'unknown';

    const titleLower = title.toLowerCase();

    if (titleLower.includes('sales') || titleLower.includes('revenue')) return 'sales';
    if (titleLower.includes('marketing')) return 'marketing';
    if (titleLower.includes('engineer') || titleLower.includes('developer') || titleLower.includes('technical')) return 'engineering';
    if (titleLower.includes('product')) return 'product';
    if (titleLower.includes('finance') || titleLower.includes('accounting')) return 'finance';
    if (titleLower.includes('operations') || titleLower.includes('ops')) return 'operations';
    if (titleLower.includes('hr') || titleLower.includes('people')) return 'hr';

    return 'other';
  }

  /**
   * Save scoring result
   */
  private async saveScoringResult(result: LeadScoringResult): Promise<void> {
    await supabase.from('ai_lead_scores').insert({
      prospect_id: result.prospectId,
      score: result.score,
      grade: result.grade,
      confidence: result.confidence,
      signals: JSON.stringify(result.signals),
      qualification: JSON.stringify(result.qualification),
      recommendations: JSON.stringify(result.recommendations),
      next_best_actions: JSON.stringify(result.nextBestActions),
      predicted_close_date: result.predictedCloseDate?.toISOString(),
      predicted_close_rate: result.predictedCloseRate,
      scored_at: new Date().toISOString()
    });
  }
}

/**
 * Create AI Lead Scoring
 */
export function createAILeadScoring(apiKey?: string): AILeadScoring {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new AILeadScoring(key);
}
