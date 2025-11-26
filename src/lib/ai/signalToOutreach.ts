/**
 * Signal-to-Outreach Transformer
 * Converts enrichment signals and research insights into personalized email talking points
 */

import OpenAI from 'openai';
import { ProspectSignals } from '../enrichment/multiSourcePipeline';
import { supabase } from '../supabase';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface TalkingPoint {
  type: 'opener' | 'pain_point' | 'value_prop' | 'social_proof' | 'trigger' | 'cta';
  content: string;
  signal: string; // The signal this was derived from
  confidence: number; // 0-100
  priority: number; // 1-5, 1 being highest
}

export interface PersonalizationContext {
  // Personalized openers based on signals
  openers: TalkingPoint[];

  // Pain points inferred from signals
  painPoints: TalkingPoint[];

  // Value propositions aligned to their situation
  valueProps: TalkingPoint[];

  // Social proof relevant to them
  socialProof: TalkingPoint[];

  // Trigger events to reference
  triggers: TalkingPoint[];

  // Suggested CTAs
  callsToAction: TalkingPoint[];

  // Overall personalization score
  personalizationScore: number;

  // Recommended email angle
  recommendedAngle: string;

  // Timing recommendation
  timingRecommendation: {
    bestDayOfWeek: string;
    bestTimeOfDay: string;
    reason: string;
  };
}

export interface OutreachRecommendation {
  channel: 'email' | 'linkedin' | 'phone' | 'multi_touch';
  priority: number;
  reason: string;
  suggestedSequence: Array<{
    step: number;
    channel: string;
    timing: string;
    template: string;
  }>;
}

// =============================================
// SIGNAL TO OUTREACH TRANSFORMER
// =============================================

export class SignalToOutreachTransformer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Transform signals into personalization context
   */
  async transformSignals(signals: ProspectSignals): Promise<PersonalizationContext> {
    const context: PersonalizationContext = {
      openers: [],
      painPoints: [],
      valueProps: [],
      socialProof: [],
      triggers: [],
      callsToAction: [],
      personalizationScore: 0,
      recommendedAngle: '',
      timingRecommendation: {
        bestDayOfWeek: 'Tuesday',
        bestTimeOfDay: '9:00 AM',
        reason: 'Default optimal B2B sending time',
      },
    };

    // 1. Generate openers from signals
    context.openers = this.generateOpeners(signals);

    // 2. Infer pain points from company/role signals
    context.painPoints = this.inferPainPoints(signals);

    // 3. Generate value propositions
    context.valueProps = this.generateValueProps(signals);

    // 4. Find relevant social proof
    context.socialProof = this.findSocialProof(signals);

    // 5. Identify trigger events
    context.triggers = this.identifyTriggers(signals);

    // 6. Generate CTAs based on buying stage
    context.callsToAction = this.generateCTAs(signals);

    // 7. Calculate personalization score
    context.personalizationScore = this.calculatePersonalizationScore(context);

    // 8. Determine recommended angle
    context.recommendedAngle = this.determineAngle(signals, context);

    // 9. Optimize timing
    context.timingRecommendation = this.optimizeTiming(signals);

    return context;
  }

  /**
   * Generate personalized openers from signals
   */
  private generateOpeners(signals: ProspectSignals): TalkingPoint[] {
    const openers: TalkingPoint[] = [];

    // LinkedIn-based openers
    if (signals.professional.headline) {
      openers.push({
        type: 'opener',
        content: `I noticed your focus on "${signals.professional.headline}" - that's exactly the kind of expertise we're seeing drive results`,
        signal: 'linkedin_headline',
        confidence: 85,
        priority: 2,
      });
    }

    // Skills-based opener
    if (signals.professional.skills && signals.professional.skills.length > 0) {
      const topSkills = signals.professional.skills.slice(0, 3).join(', ');
      openers.push({
        type: 'opener',
        content: `Your background in ${topSkills} caught my attention`,
        signal: 'linkedin_skills',
        confidence: 75,
        priority: 3,
      });
    }

    // Company news-based opener
    if (signals.research.companyNews && signals.research.companyNews.length > 0) {
      const recentNews = signals.research.companyNews[0];
      openers.push({
        type: 'opener',
        content: `Congrats on ${recentNews.title} - exciting times at ${signals.company.name}`,
        signal: 'company_news',
        confidence: 90,
        priority: 1,
      });
    }

    // Funding-based opener
    const fundingSignal = signals.intent.signals.find(s => s.type === 'funding');
    if (fundingSignal) {
      openers.push({
        type: 'opener',
        content: `Congratulations on the recent funding! As you scale, I thought you might find this relevant`,
        signal: 'funding_announcement',
        confidence: 95,
        priority: 1,
      });
    }

    // Hiring-based opener
    const hiringSignal = signals.intent.signals.find(s => s.type === 'job_posting');
    if (hiringSignal) {
      openers.push({
        type: 'opener',
        content: `I see you're growing the team - many companies in that phase find value in what we do`,
        signal: 'hiring_activity',
        confidence: 85,
        priority: 2,
      });
    }

    // Role tenure opener
    if (signals.professional.yearsInRole && signals.professional.yearsInRole < 1) {
      openers.push({
        type: 'opener',
        content: `Congrats on the new role! I work with a lot of ${signals.professional.title}s in their first year`,
        signal: 'new_role',
        confidence: 80,
        priority: 2,
      });
    }

    // Shared background opener
    if (signals.professional.previousCompanies && signals.professional.previousCompanies.length > 0) {
      openers.push({
        type: 'opener',
        content: `I see you previously worked at ${signals.professional.previousCompanies[0]} - we've helped several folks from there`,
        signal: 'career_history',
        confidence: 70,
        priority: 3,
      });
    }

    return openers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Infer pain points from signals
   */
  private inferPainPoints(signals: ProspectSignals): TalkingPoint[] {
    const painPoints: TalkingPoint[] = [];

    // Seniority-based pain points
    const seniorityPains: Record<string, string[]> = {
      'VP': [
        'Hitting revenue targets while scaling',
        'Getting visibility into team performance',
        'Reducing sales cycle length',
      ],
      'Director': [
        'Optimizing team productivity',
        'Improving pipeline accuracy',
        'Reducing manual reporting',
      ],
      'Manager': [
        'Coaching reps effectively',
        'Managing pipeline reviews',
        'Hitting team quota',
      ],
      'Individual Contributor': [
        'Booking more meetings',
        'Getting responses from prospects',
        'Managing time effectively',
      ],
    };

    const seniority = signals.professional.seniority || 'Individual Contributor';
    const pains = seniorityPains[seniority] || seniorityPains['Individual Contributor'];

    pains.forEach((pain, idx) => {
      painPoints.push({
        type: 'pain_point',
        content: pain,
        signal: 'seniority_inference',
        confidence: 70,
        priority: idx + 1,
      });
    });

    // Industry-specific pain points
    const industryPains: Record<string, string[]> = {
      'Technology': ['Long sales cycles', 'Complex buying committees', 'Technical evaluation hurdles'],
      'Financial Services': ['Compliance requirements', 'Security concerns', 'Legacy system integration'],
      'Healthcare': ['HIPAA compliance', 'Long procurement cycles', 'Multiple stakeholder approval'],
      'Manufacturing': ['Supply chain visibility', 'Cost optimization', 'Digital transformation'],
      'Retail': ['Customer acquisition costs', 'Inventory management', 'Omnichannel experience'],
    };

    if (signals.company.industry && industryPains[signals.company.industry]) {
      industryPains[signals.company.industry].forEach((pain, idx) => {
        painPoints.push({
          type: 'pain_point',
          content: pain,
          signal: 'industry_inference',
          confidence: 65,
          priority: idx + 2,
        });
      });
    }

    // Company size pain points
    if (signals.company.employeeCount) {
      if (signals.company.employeeCount < 50) {
        painPoints.push({
          type: 'pain_point',
          content: 'Doing more with limited resources',
          signal: 'company_size',
          confidence: 80,
          priority: 1,
        });
      } else if (signals.company.employeeCount < 200) {
        painPoints.push({
          type: 'pain_point',
          content: 'Scaling processes that worked when smaller',
          signal: 'company_size',
          confidence: 80,
          priority: 1,
        });
      } else {
        painPoints.push({
          type: 'pain_point',
          content: 'Maintaining efficiency across large teams',
          signal: 'company_size',
          confidence: 75,
          priority: 2,
        });
      }
    }

    // Tech stack pain points
    if (signals.company.technologies && signals.company.technologies.length > 0) {
      const techs = signals.company.technologies;

      // Check for integration opportunities
      if (techs.some(t => t.toLowerCase().includes('salesforce'))) {
        painPoints.push({
          type: 'pain_point',
          content: 'Getting more value from Salesforce investment',
          signal: 'tech_stack',
          confidence: 85,
          priority: 1,
        });
      }

      if (techs.some(t => t.toLowerCase().includes('hubspot'))) {
        painPoints.push({
          type: 'pain_point',
          content: 'Connecting marketing and sales data',
          signal: 'tech_stack',
          confidence: 85,
          priority: 1,
        });
      }
    }

    return painPoints.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate value propositions
   */
  private generateValueProps(signals: ProspectSignals): TalkingPoint[] {
    const valueProps: TalkingPoint[] = [];

    // Base value prop
    valueProps.push({
      type: 'value_prop',
      content: 'Our AI-powered platform helps teams close deals faster with personalized outreach at scale',
      signal: 'default',
      confidence: 60,
      priority: 3,
    });

    // Seniority-specific value props
    if (signals.professional.seniority === 'VP' || signals.professional.seniority === 'Director') {
      valueProps.push({
        type: 'value_prop',
        content: 'Get real-time visibility into pipeline health and rep performance without manual reporting',
        signal: 'seniority',
        confidence: 80,
        priority: 1,
      });
    }

    // Company size value props
    if (signals.company.employeeCount && signals.company.employeeCount < 100) {
      valueProps.push({
        type: 'value_prop',
        content: 'Help your lean team punch above their weight with AI-powered personalization',
        signal: 'company_size',
        confidence: 80,
        priority: 2,
      });
    }

    // Intent-driven value props
    if (signals.intent.buyingStage === 'consideration' || signals.intent.buyingStage === 'decision') {
      valueProps.push({
        type: 'value_prop',
        content: 'Compare us to your current solution - most teams see 3x improvement in response rates',
        signal: 'buying_stage',
        confidence: 85,
        priority: 1,
      });
    }

    // Tech stack alignment
    if (signals.company.technologies?.some(t => t.toLowerCase().includes('salesforce'))) {
      valueProps.push({
        type: 'value_prop',
        content: 'Seamlessly syncs with Salesforce - no duplicate data entry, full activity logging',
        signal: 'tech_stack',
        confidence: 90,
        priority: 1,
      });
    }

    return valueProps.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find relevant social proof
   */
  private findSocialProof(signals: ProspectSignals): TalkingPoint[] {
    const socialProof: TalkingPoint[] = [];

    // Industry-based social proof
    const industryCaseStudies: Record<string, string> = {
      'Technology': 'Companies like Stripe and Datadog use us to scale outreach',
      'Financial Services': 'Leading fintech companies trust us for compliant, personalized outreach',
      'Healthcare': 'Healthcare companies see 40% higher engagement with HIPAA-compliant personalization',
      'Manufacturing': 'Manufacturing leaders use us to modernize their sales motion',
    };

    if (signals.company.industry && industryCaseStudies[signals.company.industry]) {
      socialProof.push({
        type: 'social_proof',
        content: industryCaseStudies[signals.company.industry],
        signal: 'industry',
        confidence: 75,
        priority: 1,
      });
    }

    // Size-based social proof
    if (signals.company.employeeCount) {
      if (signals.company.employeeCount < 100) {
        socialProof.push({
          type: 'social_proof',
          content: 'Startups like yours have grown pipeline 3x within 90 days',
          signal: 'company_size',
          confidence: 70,
          priority: 2,
        });
      } else {
        socialProof.push({
          type: 'social_proof',
          content: 'Enterprise teams report 50% reduction in time spent on manual outreach',
          signal: 'company_size',
          confidence: 70,
          priority: 2,
        });
      }
    }

    // Role-based social proof
    if (signals.professional.title?.toLowerCase().includes('sales')) {
      socialProof.push({
        type: 'social_proof',
        content: 'Sales leaders report their teams book 2x more meetings with half the effort',
        signal: 'role',
        confidence: 80,
        priority: 1,
      });
    }

    return socialProof.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Identify trigger events
   */
  private identifyTriggers(signals: ProspectSignals): TalkingPoint[] {
    const triggers: TalkingPoint[] = [];

    // Intent signals as triggers
    for (const signal of signals.intent.signals) {
      let content = '';
      let priority = 3;

      switch (signal.type) {
        case 'funding':
          content = `Recent funding round - perfect time to invest in sales infrastructure`;
          priority = 1;
          break;
        case 'job_posting':
          content = `Hiring for sales roles - scaling teams often need better tooling`;
          priority = 2;
          break;
        case 'tech_stack':
          content = `Technology evaluation in progress - good time to introduce a new solution`;
          priority = 2;
          break;
        case 'web_visit':
          content = `Recent interest in solutions like ours`;
          priority = 1;
          break;
        case 'news_mention':
          content = `Recent press coverage creates momentum for initiatives`;
          priority = 3;
          break;
      }

      if (content) {
        triggers.push({
          type: 'trigger',
          content,
          signal: signal.type,
          confidence: signal.confidence,
          priority,
        });
      }
    }

    // Role change as trigger
    if (signals.professional.yearsInRole && signals.professional.yearsInRole < 1) {
      triggers.push({
        type: 'trigger',
        content: 'New in role - often looking to make an impact quickly',
        signal: 'role_tenure',
        confidence: 85,
        priority: 1,
      });
    }

    // Company changes as triggers
    if (signals.research.recentChanges) {
      for (const change of signals.research.recentChanges.slice(0, 2)) {
        triggers.push({
          type: 'trigger',
          content: change.description,
          signal: 'company_change',
          confidence: 80,
          priority: 2,
        });
      }
    }

    return triggers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate CTAs based on buying stage
   */
  private generateCTAs(signals: ProspectSignals): TalkingPoint[] {
    const ctas: TalkingPoint[] = [];

    const buyingStage = signals.intent.buyingStage || 'awareness';

    const stageCTAs: Record<string, Array<{ content: string; priority: number }>> = {
      awareness: [
        { content: 'Would a 2-minute video showing how this works be helpful?', priority: 1 },
        { content: 'Happy to share a case study from a similar company', priority: 2 },
        { content: 'Worth a quick chat to see if this is relevant?', priority: 3 },
      ],
      consideration: [
        { content: 'Shall I set up a quick demo to show how this fits your workflow?', priority: 1 },
        { content: 'Want me to connect you with a customer in your industry?', priority: 2 },
        { content: 'I can share a comparison with your current approach', priority: 3 },
      ],
      decision: [
        { content: 'Ready to discuss next steps and timeline?', priority: 1 },
        { content: 'Want to loop in others from your team for a joint session?', priority: 2 },
        { content: 'I can put together a custom proposal based on your needs', priority: 3 },
      ],
      purchase: [
        { content: 'Let me know what you need to move forward', priority: 1 },
        { content: 'Happy to expedite the process - what questions remain?', priority: 2 },
      ],
    };

    const selectedCTAs = stageCTAs[buyingStage] || stageCTAs.awareness;

    selectedCTAs.forEach(cta => {
      ctas.push({
        type: 'cta',
        content: cta.content,
        signal: 'buying_stage',
        confidence: 80,
        priority: cta.priority,
      });
    });

    // Add seniority-appropriate CTA
    if (signals.professional.seniority === 'VP' || signals.professional.seniority === 'Director') {
      ctas.push({
        type: 'cta',
        content: 'Would 15 minutes this week work to show you the executive dashboard?',
        signal: 'seniority',
        confidence: 85,
        priority: 1,
      });
    }

    return ctas.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Calculate overall personalization score
   */
  private calculatePersonalizationScore(context: PersonalizationContext): number {
    let score = 0;

    // Weight different components
    const weights = {
      openers: 25,
      painPoints: 20,
      valueProps: 15,
      socialProof: 10,
      triggers: 20,
      ctas: 10,
    };

    // Score each component based on quality
    if (context.openers.length > 0) {
      const topOpener = context.openers[0];
      score += (weights.openers * topOpener.confidence) / 100;
    }

    if (context.painPoints.length > 0) {
      const avgConfidence = context.painPoints.reduce((sum, p) => sum + p.confidence, 0) / context.painPoints.length;
      score += (weights.painPoints * avgConfidence) / 100;
    }

    if (context.triggers.length > 0) {
      const topTrigger = context.triggers[0];
      score += (weights.triggers * topTrigger.confidence) / 100;
    }

    if (context.valueProps.length > 0) {
      score += weights.valueProps * 0.7; // Value props are semi-personalized
    }

    if (context.socialProof.length > 0) {
      score += weights.socialProof * 0.8;
    }

    if (context.callsToAction.length > 0) {
      score += weights.ctas * 0.8;
    }

    return Math.round(score);
  }

  /**
   * Determine recommended email angle
   */
  private determineAngle(signals: ProspectSignals, context: PersonalizationContext): string {
    // Prioritize triggers
    if (context.triggers.length > 0 && context.triggers[0].confidence >= 80) {
      const trigger = context.triggers[0];
      if (trigger.signal === 'funding') return 'Growth investment angle - reference funding for scale';
      if (trigger.signal === 'job_posting') return 'Scaling team angle - help new hires ramp faster';
      if (trigger.signal === 'role_tenure') return 'New leader angle - help them make an impact';
    }

    // Fall back to pain points
    if (context.painPoints.length > 0 && context.painPoints[0].confidence >= 70) {
      return `Pain point angle - address "${context.painPoints[0].content}"`;
    }

    // Default to value-led
    return 'Value-led angle - lead with relevant benefit for their role';
  }

  /**
   * Optimize send timing
   */
  private optimizeTiming(signals: ProspectSignals): PersonalizationContext['timingRecommendation'] {
    const defaults = {
      bestDayOfWeek: 'Tuesday',
      bestTimeOfDay: '9:00 AM',
      reason: 'Optimal B2B engagement time',
    };

    // Adjust based on seniority
    if (signals.professional.seniority === 'VP' || signals.professional.seniority === 'C-Suite') {
      return {
        bestDayOfWeek: 'Tuesday',
        bestTimeOfDay: '7:00 AM',
        reason: 'Executives often check email early before meetings',
      };
    }

    // Adjust based on industry
    if (signals.company.industry === 'Technology') {
      return {
        bestDayOfWeek: 'Wednesday',
        bestTimeOfDay: '10:00 AM',
        reason: 'Tech companies often have Monday standups',
      };
    }

    // Check for time zone
    if (signals.contact.linkedinUrl?.includes('uk.linkedin')) {
      return {
        bestDayOfWeek: 'Tuesday',
        bestTimeOfDay: '2:00 PM ET',
        reason: 'Adjusted for UK timezone (morning local time)',
      };
    }

    return defaults;
  }

  /**
   * Generate AI-enhanced talking points
   */
  async enhanceWithAI(
    signals: ProspectSignals,
    context: PersonalizationContext
  ): Promise<PersonalizationContext> {
    const prompt = `You are an expert B2B sales strategist. Based on the following prospect signals, enhance the personalization context with more specific and compelling talking points.

PROSPECT SIGNALS:
- Name: ${signals.contact.email.split('@')[0]}
- Title: ${signals.professional.title}
- Headline: ${signals.professional.headline || 'N/A'}
- Company: ${signals.company.name}
- Industry: ${signals.company.industry || 'Unknown'}
- Employee Count: ${signals.company.employeeCount || 'Unknown'}
- Seniority: ${signals.professional.seniority || 'Unknown'}
- Technologies: ${signals.company.technologies?.join(', ') || 'Unknown'}
- Intent Score: ${signals.intent.score}
- Buying Stage: ${signals.intent.buyingStage || 'awareness'}
- Recent Signals: ${signals.intent.signals.slice(0, 3).map(s => s.description).join('; ')}
- Recent News: ${signals.research.companyNews?.slice(0, 2).map(n => n.title).join('; ') || 'None'}

CURRENT CONTEXT:
- Top Opener: ${context.openers[0]?.content || 'None'}
- Top Pain Point: ${context.painPoints[0]?.content || 'None'}
- Recommended Angle: ${context.recommendedAngle}

Provide enhanced talking points in JSON format:
{
  "enhancedOpener": "A more specific, compelling opener",
  "enhancedPainPoint": "A more specific pain point for their situation",
  "enhancedValueProp": "A value proposition tailored to their specific context",
  "customAngle": "A specific angle recommendation",
  "personalizedCTA": "A highly personalized call to action"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a B2B sales expert. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const enhanced = JSON.parse(completion.choices[0].message.content || '{}');

      // Add enhanced talking points with high priority
      if (enhanced.enhancedOpener) {
        context.openers.unshift({
          type: 'opener',
          content: enhanced.enhancedOpener,
          signal: 'ai_enhanced',
          confidence: 90,
          priority: 1,
        });
      }

      if (enhanced.enhancedPainPoint) {
        context.painPoints.unshift({
          type: 'pain_point',
          content: enhanced.enhancedPainPoint,
          signal: 'ai_enhanced',
          confidence: 90,
          priority: 1,
        });
      }

      if (enhanced.enhancedValueProp) {
        context.valueProps.unshift({
          type: 'value_prop',
          content: enhanced.enhancedValueProp,
          signal: 'ai_enhanced',
          confidence: 90,
          priority: 1,
        });
      }

      if (enhanced.customAngle) {
        context.recommendedAngle = enhanced.customAngle;
      }

      if (enhanced.personalizedCTA) {
        context.callsToAction.unshift({
          type: 'cta',
          content: enhanced.personalizedCTA,
          signal: 'ai_enhanced',
          confidence: 90,
          priority: 1,
        });
      }

      // Boost personalization score
      context.personalizationScore = Math.min(100, context.personalizationScore + 15);

    } catch (error) {
      console.error('AI enhancement failed:', error);
      // Keep original context on failure
    }

    return context;
  }
}

/**
 * Transform signals to outreach context
 */
export async function transformSignalsToOutreach(
  signals: ProspectSignals,
  enhanceWithAI: boolean = true
): Promise<PersonalizationContext> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const transformer = new SignalToOutreachTransformer(apiKey);
  let context = await transformer.transformSignals(signals);

  if (enhanceWithAI) {
    context = await transformer.enhanceWithAI(signals, context);
  }

  return context;
}
