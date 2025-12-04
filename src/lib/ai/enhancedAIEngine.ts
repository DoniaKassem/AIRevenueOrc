/**
 * Enhanced AI Engine
 * Advanced AI-powered content generation with improved prompts, caching, and reliability
 */

import { z } from 'zod';
import {
  EnhancedAIClient,
  getAIClient,
  createCacheKey,
  safeJsonParse,
  BuyerPersonaSchema,
  EmailStrategySchema,
  CompetitiveContextSchema,
  TriggerAnalysisSchema,
  EmailVariantSchema,
  ReplyAnalysisSchema,
  PROMPT_TEMPLATES,
  AIResponse,
  costTracker,
  aiCache,
} from './aiUtils';
import { ProspectSignals } from '../enrichment/multiSourcePipeline';

// =============================================
// ENHANCED SCHEMAS
// =============================================

const EnhancedPersonalizationSchema = z.object({
  persona: BuyerPersonaSchema,
  competitiveContext: CompetitiveContextSchema,
  triggerAnalysis: TriggerAnalysisSchema.nullable(),
  strategy: EmailStrategySchema,
  subjectLines: z.array(z.object({
    subject: z.string(),
    angle: z.string(),
    expectedOpenRate: z.number().optional(),
  })).default([]),
  emailVariants: z.array(EmailVariantSchema).default([]),
  followUpSequence: z.array(z.object({
    day: z.number(),
    subject: z.string(),
    body: z.string(),
    purpose: z.string(),
  })).default([]),
  personalizationDepth: z.number().min(0).max(100).default(50),
  confidenceScore: z.number().min(0).max(100).default(70),
  reasoningChain: z.array(z.string()).default([]),
});

export type EnhancedPersonalization = z.infer<typeof EnhancedPersonalizationSchema>;

// =============================================
// FEW-SHOT EXAMPLES
// =============================================

const BUYER_PERSONA_EXAMPLES = [
  {
    input: `Title: VP of Sales, Industry: Technology, Company Size: 500 employees`,
    output: {
      archetype: 'Revenue-Focused Leader',
      communicationStyle: 'driver',
      buyingRole: 'economic_buyer',
      riskTolerance: 'medium',
      primaryMotivations: [
        'Hit quarterly revenue targets',
        'Improve sales team productivity',
        'Reduce sales cycle length',
        'Increase win rates',
      ],
      decisionCriteria: [
        'Proven ROI within 6 months',
        'Integration with existing CRM',
        'Adoption by sales team',
        'Scalability for growth',
      ],
      expectedObjections: [
        'We already have tools for this',
        'My team won\'t adopt another tool',
        'We\'re mid-quarter, bad timing',
        'Need to see competitor comparisons',
      ],
      valueDrivers: [
        'Pipeline acceleration',
        'Rep quota attainment',
        'Accurate forecasting',
        'Reduced admin time',
      ],
      preferredProofPoints: [
        'Case study from similar-sized SaaS company',
        'ROI calculator showing payback period',
        'Testimonial from VP Sales peer',
        'Before/after metrics from customer',
      ],
    },
  },
];

const EMAIL_VARIANT_EXAMPLES = [
  {
    input: `Prospect: John Smith, VP Sales at TechCorp (500 employees). Pain: slow sales cycles. Angle: problem-agitate-solve`,
    output: {
      variant: 'problem-agitate-solve',
      angle: 'Sales cycle reduction',
      subject: 'TechCorp\'s 6-month deals',
      body: `John,

At 500 employees, your sales team is probably closing deals that take 4-6 months. Meanwhile, competitors with similar products are closing in 60 days.

The difference isn't your product or your reps. It's usually deal velocity - how fast you can move from demo to decision.

Companies like Acme Corp cut their cycle by 40% last quarter. Would a 15-min call on how they did it be useful?`,
      strengths: ['Specific to company size', 'Creates urgency', 'Social proof', 'Low-commitment CTA'],
    },
  },
];

// =============================================
// ENHANCED AI ENGINE
// =============================================

export class EnhancedAIEngine {
  private client: EnhancedAIClient;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.client = apiKey ? new EnhancedAIClient(apiKey, model) : getAIClient();
    this.model = model;
  }

  /**
   * Generate comprehensive personalization with multi-step reasoning
   */
  async generatePersonalization(
    signals: ProspectSignals,
    productContext?: {
      productName: string;
      valueProps: string[];
      targetPersonas: string[];
      competitors: string[];
    }
  ): Promise<AIResponse<EnhancedPersonalization>> {
    const startTime = Date.now();
    const reasoningChain: string[] = [];

    // Step 1: Build buyer persona
    reasoningChain.push('Analyzing prospect profile to build buyer persona...');
    const persona = await this.buildBuyerPersona(signals);
    reasoningChain.push(`Identified persona: ${persona.data.archetype} (${persona.data.communicationStyle} style)`);

    // Step 2: Analyze competitive context
    reasoningChain.push('Analyzing tech stack for competitive context...');
    const competitiveContext = await this.analyzeCompetitiveContext(signals, productContext?.competitors);
    reasoningChain.push(`Found ${competitiveContext.data.currentSolutions.length} existing solutions to position against`);

    // Step 3: Analyze triggers if available
    let triggerAnalysis: z.infer<typeof TriggerAnalysisSchema> | null = null;
    const triggers = signals.intent?.signals?.filter(s =>
      ['funding', 'job_posting', 'news_mention'].includes(s.type)
    ) || [];

    if (triggers.length > 0) {
      reasoningChain.push('Analyzing trigger events for timing...');
      const triggerResult = await this.analyzeTriggers(signals, triggers[0]);
      triggerAnalysis = triggerResult.data;
      reasoningChain.push(`Identified trigger: ${triggerAnalysis.trigger} (${triggerAnalysis.urgencyLevel} urgency)`);
    } else {
      reasoningChain.push('No trigger events found - using general approach');
    }

    // Step 4: Develop email strategy
    reasoningChain.push('Developing optimal email strategy...');
    const strategy = await this.developStrategy(persona.data, competitiveContext.data, triggerAnalysis, signals);
    reasoningChain.push(`Strategy: ${strategy.data.primaryAngle} angle with ${strategy.data.ctaStyle} CTA`);

    // Step 5: Generate subject lines
    reasoningChain.push('Generating subject line variations...');
    const subjectLines = await this.generateSubjectLines(signals, persona.data, strategy.data);
    reasoningChain.push(`Created ${subjectLines.data.length} subject line variations`);

    // Step 6: Generate email variants
    reasoningChain.push('Generating email body variants...');
    const emailVariants = await this.generateEmailVariants(
      signals,
      persona.data,
      competitiveContext.data,
      strategy.data
    );
    reasoningChain.push(`Created ${emailVariants.data.length} email variants for A/B testing`);

    // Step 7: Generate follow-up sequence
    reasoningChain.push('Generating follow-up sequence...');
    const followUpSequence = await this.generateFollowUpSequence(signals, persona.data, strategy.data);
    reasoningChain.push(`Created ${followUpSequence.data.length}-touch follow-up sequence`);

    // Calculate scores
    const personalizationDepth = this.calculatePersonalizationDepth(signals, persona.data);
    const confidenceScore = this.calculateConfidenceScore(signals, emailVariants.data);

    // Aggregate costs
    const totalCost = [
      persona.metadata.cost,
      competitiveContext.metadata.cost,
      strategy.metadata.cost,
      subjectLines.metadata.cost,
      emailVariants.metadata.cost,
      followUpSequence.metadata.cost,
    ].reduce((sum, cost) => sum + cost, 0);

    const totalTokens = [
      persona.metadata.tokensUsed.total,
      competitiveContext.metadata.tokensUsed.total,
      strategy.metadata.tokensUsed.total,
      subjectLines.metadata.tokensUsed.total,
      emailVariants.metadata.tokensUsed.total,
      followUpSequence.metadata.tokensUsed.total,
    ].reduce((sum, tokens) => sum + tokens, 0);

    return {
      data: {
        persona: persona.data,
        competitiveContext: competitiveContext.data,
        triggerAnalysis,
        strategy: strategy.data,
        subjectLines: subjectLines.data,
        emailVariants: emailVariants.data,
        followUpSequence: followUpSequence.data,
        personalizationDepth,
        confidenceScore,
        reasoningChain,
      },
      metadata: {
        model: this.model,
        tokensUsed: {
          prompt: totalTokens * 0.7, // Rough split
          completion: totalTokens * 0.3,
          total: totalTokens,
        },
        cost: totalCost,
        latencyMs: Date.now() - startTime,
        cached: false,
        retries: 0,
      },
    };
  }

  /**
   * Build detailed buyer persona with few-shot learning
   */
  private async buildBuyerPersona(
    signals: ProspectSignals
  ): Promise<AIResponse<z.infer<typeof BuyerPersonaSchema>>> {
    const cacheKey = createCacheKey(
      'persona',
      signals.professional.title,
      signals.company.industry,
      signals.company.employeeCount
    );

    const userPrompt = `Title: ${signals.professional.title || 'Unknown'}
Industry: ${signals.company.industry || 'Technology'}
Company Size: ${signals.company.employeeCount || 'Unknown'} employees
Seniority: ${signals.professional.seniority || 'Unknown'}
Department: ${signals.professional.department || 'Unknown'}
Skills: ${signals.professional.skills?.slice(0, 5).join(', ') || 'Unknown'}
Company Technologies: ${signals.company.technologies?.slice(0, 5).join(', ') || 'Unknown'}

Build a detailed buyer persona for this prospect.`;

    return this.client.generateStructured(
      PROMPT_TEMPLATES.buyerPersona,
      userPrompt,
      BuyerPersonaSchema,
      {
        model: this.model,
        temperature: 0.7,
        cacheKey,
        cacheTtlMs: 30 * 60 * 1000, // 30 min cache
        operation: 'build_persona',
        examples: BUYER_PERSONA_EXAMPLES,
        fallback: {
          archetype: 'Business Professional',
          communicationStyle: 'analytical',
          buyingRole: 'influencer',
          riskTolerance: 'medium',
          primaryMotivations: ['Efficiency', 'Results', 'Growth'],
          decisionCriteria: ['ROI', 'Ease of use', 'Support'],
          expectedObjections: ['Budget', 'Timeline', 'Resources'],
          valueDrivers: ['Time savings', 'Revenue impact'],
          preferredProofPoints: ['Case studies', 'ROI data'],
        },
      }
    );
  }

  /**
   * Analyze competitive context from tech stack
   */
  private async analyzeCompetitiveContext(
    signals: ProspectSignals,
    knownCompetitors?: string[]
  ): Promise<AIResponse<z.infer<typeof CompetitiveContextSchema>>> {
    const techStack = signals.company.technologies || [];
    const cacheKey = createCacheKey(
      'competitive',
      signals.company.industry,
      techStack.slice(0, 5).join(',')
    );

    const userPrompt = `Company: ${signals.company.name || 'Unknown'}
Industry: ${signals.company.industry || 'Unknown'}
Tech Stack: ${techStack.join(', ') || 'Unknown'}
Company Size: ${signals.company.employeeCount || 'Unknown'} employees
Known Competitors: ${knownCompetitors?.join(', ') || 'N/A'}

Analyze their competitive context for sales engagement.`;

    return this.client.generateStructured(
      PROMPT_TEMPLATES.competitiveAnalysis,
      userPrompt,
      CompetitiveContextSchema,
      {
        model: this.model,
        temperature: 0.7,
        cacheKey,
        cacheTtlMs: 60 * 60 * 1000, // 1 hour cache
        operation: 'analyze_competitive',
        fallback: {
          currentSolutions: [],
          likelyPainWithCurrent: ['Manual processes', 'Lack of visibility'],
          competitiveAdvantages: ['Better automation', 'Unified platform'],
          switchingBarriers: ['Implementation effort', 'Team training'],
          differentiators: ['Ease of use', 'Better support'],
        },
      }
    );
  }

  /**
   * Analyze trigger events for timing and messaging
   */
  private async analyzeTriggers(
    signals: ProspectSignals,
    trigger: { type: string; description: string; confidence: number; timestamp?: string }
  ): Promise<AIResponse<z.infer<typeof TriggerAnalysisSchema>>> {
    const userPrompt = `Trigger Type: ${trigger.type}
Description: ${trigger.description}
Confidence: ${trigger.confidence}%
Date: ${trigger.timestamp || 'Recent'}

Prospect Context:
- Title: ${signals.professional.title || 'Unknown'}
- Company: ${signals.company.name || 'Unknown'}
- Industry: ${signals.company.industry || 'Unknown'}

Analyze this trigger event and provide strategic recommendations.`;

    const systemPrompt = `You are a sales timing expert who identifies the perfect moment to reach out.

Based on the trigger event, determine:
1. How urgent is this trigger? (Will it go stale?)
2. What's the best angle to reference it naturally?
3. How to open the email referencing this trigger
4. How to connect it to value

Be specific and actionable. The opening hook should be usable as-is.`;

    return this.client.generateStructured(
      systemPrompt,
      userPrompt,
      TriggerAnalysisSchema,
      {
        model: this.model,
        temperature: 0.7,
        operation: 'analyze_trigger',
        fallback: {
          trigger: trigger.description,
          urgencyLevel: 'medium',
          timeWindow: '2-4 weeks',
          recommendedAngle: 'Capitalize on momentum',
          openingHook: `I noticed ${trigger.description}`,
          connectionToValue: 'This is often when teams evaluate new solutions',
        },
      }
    );
  }

  /**
   * Develop optimal email strategy
   */
  private async developStrategy(
    persona: z.infer<typeof BuyerPersonaSchema>,
    competitiveContext: z.infer<typeof CompetitiveContextSchema>,
    triggerAnalysis: z.infer<typeof TriggerAnalysisSchema> | null,
    signals: ProspectSignals
  ): Promise<AIResponse<z.infer<typeof EmailStrategySchema>>> {
    const userPrompt = `BUYER PERSONA:
- Archetype: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}
- Buying Role: ${persona.buyingRole}
- Risk Tolerance: ${persona.riskTolerance}
- Primary Motivations: ${persona.primaryMotivations?.join(', ') || 'Unknown'}
- Expected Objections: ${persona.expectedObjections?.join(', ') || 'Unknown'}

COMPETITIVE CONTEXT:
- Current Solutions: ${competitiveContext.currentSolutions?.join(', ') || 'Unknown'}
- Likely Pains: ${competitiveContext.likelyPainWithCurrent?.join(', ') || 'Unknown'}

TRIGGER: ${triggerAnalysis?.trigger || 'None identified'}
INTENT SCORE: ${signals.intent?.score || 0}/100
BUYING STAGE: ${signals.intent?.buyingStage || 'awareness'}

Develop the optimal email strategy for this prospect.`;

    return this.client.generateStructured(
      PROMPT_TEMPLATES.emailStrategy,
      userPrompt,
      EmailStrategySchema,
      {
        model: this.model,
        temperature: 0.7,
        operation: 'develop_strategy',
        fallback: {
          primaryAngle: 'value-focused',
          emotionalAppeal: 'success',
          logicalAppeal: 'efficiency',
          socialProofType: 'case study',
          ctaStyle: 'soft',
          followUpStrategy: 'Follow up in 3-4 days with additional value',
        },
      }
    );
  }

  /**
   * Generate subject line variations
   */
  private async generateSubjectLines(
    signals: ProspectSignals,
    persona: z.infer<typeof BuyerPersonaSchema>,
    strategy: z.infer<typeof EmailStrategySchema>
  ): Promise<AIResponse<Array<{ subject: string; angle: string; expectedOpenRate?: number }>>> {
    const SubjectLinesSchema = z.array(
      z.object({
        subject: z.string(),
        angle: z.string(),
        expectedOpenRate: z.number().optional(),
      })
    );

    const userPrompt = `Generate 5 email subject lines for:
- Name: ${signals.contact.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Prospect'}
- Title: ${signals.professional.title || 'Unknown'}
- Company: ${signals.company.name || 'Unknown'}
- Industry: ${signals.company.industry || 'Unknown'}
- Persona: ${persona.archetype} (${persona.communicationStyle} style)
- Strategy Angle: ${strategy.primaryAngle}

Requirements:
- Under 50 characters each
- Mix of curiosity, value, and personalization
- No spam trigger words
- Sound human, not automated`;

    const systemPrompt = `You are an email copywriter who specializes in B2B cold email subject lines.

Write subject lines that:
- Get opened (not marked as spam)
- Are relevant to the recipient's role
- Create curiosity or offer clear value
- Sound like they're from a real person
- Are short and scannable

Return as JSON array with: subject, angle, expectedOpenRate (optional, as percentage).`;

    return this.client.generateStructured(
      systemPrompt,
      userPrompt,
      SubjectLinesSchema,
      {
        model: this.model,
        temperature: 0.8, // Higher temp for creativity
        operation: 'generate_subjects',
        fallback: [
          { subject: `Quick question, ${signals.contact.email?.split('@')[0] || 'there'}`, angle: 'curiosity' },
          { subject: `${signals.company.name || 'Your team'} + efficiency`, angle: 'value' },
          { subject: `Idea for ${signals.professional.title || 'your role'}`, angle: 'personalization' },
        ],
      }
    );
  }

  /**
   * Generate email body variants for A/B testing
   */
  private async generateEmailVariants(
    signals: ProspectSignals,
    persona: z.infer<typeof BuyerPersonaSchema>,
    competitiveContext: z.infer<typeof CompetitiveContextSchema>,
    strategy: z.infer<typeof EmailStrategySchema>
  ): Promise<AIResponse<z.infer<typeof EmailVariantSchema>[]>> {
    const EmailVariantsSchema = z.array(EmailVariantSchema);

    const userPrompt = `PROSPECT:
- Name: ${signals.contact.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Prospect'}
- Title: ${signals.professional.title || 'Unknown'}
- Company: ${signals.company.name || 'Unknown'}
- Industry: ${signals.company.industry || 'tech'}

PERSONA:
- Archetype: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}
- Primary Motivations: ${persona.primaryMotivations?.join(', ') || 'Unknown'}

STRATEGY:
- Primary Angle: ${strategy.primaryAngle}
- CTA Style: ${strategy.ctaStyle}

COMPETITIVE CONTEXT:
- Current Solutions: ${competitiveContext.currentSolutions?.join(', ') || 'Unknown'}
- Likely Pains: ${competitiveContext.likelyPainWithCurrent?.join(', ') || 'Unknown'}

Generate 3 email body variants:
1. PROBLEM-AGITATE-SOLVE: Lead with a pain point
2. PEER SUCCESS: Lead with what similar companies are doing
3. DIRECT VALUE: Lead with a specific benefit

Each email: 80-120 words, start with THEM, ONE clear CTA, human tone.`;

    return this.client.generateStructured(
      PROMPT_TEMPLATES.emailComposition,
      userPrompt,
      EmailVariantsSchema,
      {
        model: this.model,
        temperature: 0.8,
        operation: 'generate_variants',
        examples: EMAIL_VARIANT_EXAMPLES,
        fallback: [
          {
            variant: 'problem-agitate-solve',
            angle: 'Pain point focus',
            subject: 'Quick question',
            body: 'Hi there,\n\nI noticed companies in your space often struggle with X.\n\nWould a quick call to discuss be helpful?',
            strengths: ['Generic but safe'],
          },
        ],
      }
    );
  }

  /**
   * Generate follow-up email sequence
   */
  private async generateFollowUpSequence(
    signals: ProspectSignals,
    persona: z.infer<typeof BuyerPersonaSchema>,
    strategy: z.infer<typeof EmailStrategySchema>
  ): Promise<AIResponse<Array<{ day: number; subject: string; body: string; purpose: string }>>> {
    const FollowUpSequenceSchema = z.array(
      z.object({
        day: z.number(),
        subject: z.string(),
        body: z.string(),
        purpose: z.string(),
      })
    );

    const userPrompt = `Create a 4-email follow-up sequence for:
- Name: ${signals.contact.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Prospect'}
- Title: ${signals.professional.title || 'Unknown'}
- Company: ${signals.company.name || 'Unknown'}
- Persona: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}
- Expected Objections: ${persona.expectedObjections?.join(', ') || 'Unknown'}

Schedule: Day 3, Day 7, Day 14, Day 21

Each follow-up should:
- Add NEW value (not just "following up")
- Be shorter than the previous
- Have a different angle/hook
- Reference (but not repeat) the original email`;

    const systemPrompt = `You are an expert at writing follow-up sequences that get responses.

Keys to effective follow-ups:
- Each email should stand alone (they might not have read previous ones)
- Provide new value: insight, resource, or perspective
- Get shorter and more direct over time
- Final email should be a "break-up" style
- Never guilt trip or be pushy

Return as JSON array with: day, subject, body, purpose.`;

    return this.client.generateStructured(
      systemPrompt,
      userPrompt,
      FollowUpSequenceSchema,
      {
        model: this.model,
        temperature: 0.7,
        operation: 'generate_sequence',
        fallback: [
          { day: 3, subject: 'Thought you might find this useful', body: 'Quick follow-up...', purpose: 'Add value' },
          { day: 7, subject: 'One more thing', body: 'Hi...', purpose: 'Different angle' },
          { day: 14, subject: 'Last thought', body: 'Hi...', purpose: 'Final attempt' },
        ],
      }
    );
  }

  /**
   * Analyze a prospect's reply
   */
  async analyzeReply(
    originalEmail: string,
    replyContent: string,
    prospectContext: { title?: string; company?: string; industry?: string }
  ): Promise<AIResponse<z.infer<typeof ReplyAnalysisSchema>>> {
    const userPrompt = `ORIGINAL EMAIL SENT:
${originalEmail}

PROSPECT'S REPLY:
${replyContent}

PROSPECT CONTEXT:
- Title: ${prospectContext.title || 'Unknown'}
- Company: ${prospectContext.company || 'Unknown'}
- Industry: ${prospectContext.industry || 'Unknown'}

Analyze this reply and provide recommendations.`;

    return this.client.generateStructured(
      PROMPT_TEMPLATES.replyAnalysis,
      userPrompt,
      ReplyAnalysisSchema,
      {
        model: this.model,
        temperature: 0.5, // Lower temp for analysis
        operation: 'analyze_reply',
        fallback: {
          sentiment: 'neutral',
          intent: 'needs_info',
          keyObjections: [],
          followUpRecommendation: 'Send additional information addressing their question',
        },
      }
    );
  }

  /**
   * Calculate personalization depth score
   */
  private calculatePersonalizationDepth(
    signals: ProspectSignals,
    persona: z.infer<typeof BuyerPersonaSchema>
  ): number {
    let score = 0;
    const weights = {
      hasTitle: 10,
      hasSeniority: 10,
      hasCompanyName: 10,
      hasIndustry: 10,
      hasTechStack: 15,
      hasIntentSignals: 15,
      hasLinkedIn: 10,
      hasNews: 10,
      hasFunding: 10,
    };

    if (signals.professional.title) score += weights.hasTitle;
    if (signals.professional.seniority) score += weights.hasSeniority;
    if (signals.company.name) score += weights.hasCompanyName;
    if (signals.company.industry) score += weights.hasIndustry;
    if (signals.company.technologies?.length) score += weights.hasTechStack;
    if (signals.intent?.signals?.length) score += weights.hasIntentSignals;
    if (signals.contact.linkedinUrl) score += weights.hasLinkedIn;
    if (signals.research?.companyNews?.length) score += weights.hasNews;
    if (signals.intent?.signals?.some(s => s.type === 'funding')) score += weights.hasFunding;

    return Math.min(score, 100);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    signals: ProspectSignals,
    emailVariants: z.infer<typeof EmailVariantSchema>[]
  ): number {
    let score = 50; // Base score

    // Data quality factors
    if (signals.metadata?.qualityScore) score += signals.metadata.qualityScore * 0.2;
    if (signals.metadata?.completeness) score += signals.metadata.completeness * 20;

    // Intent factors
    if (signals.intent?.score) score += signals.intent.score * 0.1;

    // Email quality factors
    if (emailVariants.length >= 3) score += 5;
    if (emailVariants.every(v => v.body.length > 100)) score += 5;

    return Math.min(Math.round(score), 100);
  }
}

// =============================================
// CONVENIENCE FUNCTIONS
// =============================================

export async function generateEnhancedPersonalization(
  prospectId: string,
  productContext?: {
    productName: string;
    valueProps: string[];
    targetPersonas: string[];
    competitors: string[];
  }
): Promise<EnhancedPersonalization> {
  const { supabase } = await import('../supabase');

  const { data: prospect } = await supabase
    .from('prospects')
    .select('enrichment_data')
    .eq('id', prospectId)
    .single();

  if (!prospect?.enrichment_data) {
    throw new Error('Prospect not enriched. Run enrichment pipeline first.');
  }

  const engine = new EnhancedAIEngine();
  const result = await engine.generatePersonalization(prospect.enrichment_data, productContext);
  return result.data;
}

export function getAIUsageStats(sinceDate?: Date) {
  return costTracker.getUsage(sinceDate);
}

export function getDailyAIUsage(days: number = 7) {
  return costTracker.getDailyUsage(days);
}

export function getCacheStats() {
  return aiCache.getStats();
}

export function clearAICache() {
  aiCache.clear();
}

export { EnhancedAIEngine };
