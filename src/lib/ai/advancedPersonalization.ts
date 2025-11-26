/**
 * Advanced AI Personalization Engine
 * Uses multi-step reasoning, persona analysis, and contextual intelligence
 * to generate deeply personalized outreach
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';
import { ProspectSignals } from '../enrichment/multiSourcePipeline';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface BuyerPersona {
  archetype: string;
  primaryMotivations: string[];
  decisionCriteria: string[];
  communicationStyle: 'analytical' | 'driver' | 'expressive' | 'amiable';
  riskTolerance: 'low' | 'medium' | 'high';
  buyingRole: 'economic_buyer' | 'technical_buyer' | 'user_buyer' | 'champion' | 'influencer';
  expectedObjections: string[];
  valueDrivers: string[];
  preferredProofPoints: string[];
}

export interface CompetitiveContext {
  currentSolutions: string[];
  likelyPainWithCurrent: string[];
  competitiveAdvantages: string[];
  switchingBarriers: string[];
  differentiators: string[];
}

export interface TriggerAnalysis {
  trigger: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  timeWindow: string;
  recommendedAngle: string;
  openingHook: string;
  connectionToValue: string;
}

export interface EmailStrategy {
  primaryAngle: string;
  emotionalAppeal: string;
  logicalAppeal: string;
  socialProofType: string;
  ctaStyle: 'soft' | 'medium' | 'direct';
  followUpStrategy: string;
  anticipatedResponse: string;
}

export interface PersonalizedContent {
  persona: BuyerPersona;
  competitiveContext: CompetitiveContext;
  triggerAnalysis: TriggerAnalysis | null;
  strategy: EmailStrategy;

  // Generated content
  subjectLines: Array<{ text: string; angle: string; expectedOpenRate: string }>;
  emailVariants: Array<{
    variant: string;
    angle: string;
    body: string;
    strengths: string[];
    bestFor: string;
  }>;
  followUpSequence: Array<{
    day: number;
    subject: string;
    body: string;
    channel: 'email' | 'linkedin';
  }>;

  // Metadata
  personalizationDepth: number;
  confidenceScore: number;
  reasoningChain: string[];
}

// =============================================
// ADVANCED PERSONALIZATION ENGINE
// =============================================

export class AdvancedPersonalizationEngine {
  private openai: OpenAI;
  private model = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate deeply personalized content using multi-step AI reasoning
   */
  async generatePersonalizedContent(
    signals: ProspectSignals,
    productContext?: {
      productName: string;
      valueProps: string[];
      targetPersonas: string[];
      competitors: string[];
    }
  ): Promise<PersonalizedContent> {
    const reasoningChain: string[] = [];

    // Step 1: Analyze and build buyer persona
    reasoningChain.push('Analyzing prospect signals to build buyer persona...');
    const persona = await this.buildBuyerPersona(signals);
    reasoningChain.push(`Identified persona: ${persona.archetype} (${persona.communicationStyle})`);

    // Step 2: Analyze competitive context
    reasoningChain.push('Analyzing competitive landscape from tech stack...');
    const competitiveContext = await this.analyzeCompetitiveContext(signals, productContext?.competitors);
    reasoningChain.push(`Found ${competitiveContext.currentSolutions.length} current solutions to position against`);

    // Step 3: Analyze trigger events
    reasoningChain.push('Analyzing trigger events for timing and relevance...');
    const triggerAnalysis = await this.analyzeTriggerEvents(signals);
    if (triggerAnalysis) {
      reasoningChain.push(`Identified ${triggerAnalysis.urgencyLevel} urgency trigger: ${triggerAnalysis.trigger}`);
    }

    // Step 4: Develop email strategy
    reasoningChain.push('Developing optimal email strategy based on persona and context...');
    const strategy = await this.developEmailStrategy(persona, competitiveContext, triggerAnalysis, signals);
    reasoningChain.push(`Strategy: ${strategy.primaryAngle} with ${strategy.ctaStyle} CTA`);

    // Step 5: Generate subject lines
    reasoningChain.push('Generating optimized subject lines...');
    const subjectLines = await this.generateSubjectLines(signals, persona, strategy);
    reasoningChain.push(`Generated ${subjectLines.length} subject line variants`);

    // Step 6: Generate email variants
    reasoningChain.push('Generating email body variants for A/B testing...');
    const emailVariants = await this.generateEmailVariants(signals, persona, competitiveContext, strategy);
    reasoningChain.push(`Generated ${emailVariants.length} email variants`);

    // Step 7: Generate follow-up sequence
    reasoningChain.push('Generating intelligent follow-up sequence...');
    const followUpSequence = await this.generateFollowUpSequence(signals, persona, strategy);
    reasoningChain.push(`Created ${followUpSequence.length}-step follow-up sequence`);

    // Calculate scores
    const personalizationDepth = this.calculatePersonalizationDepth(signals, persona, triggerAnalysis);
    const confidenceScore = this.calculateConfidenceScore(signals);

    return {
      persona,
      competitiveContext,
      triggerAnalysis,
      strategy,
      subjectLines,
      emailVariants,
      followUpSequence,
      personalizationDepth,
      confidenceScore,
      reasoningChain,
    };
  }

  /**
   * Build detailed buyer persona using AI analysis
   */
  private async buildBuyerPersona(signals: ProspectSignals): Promise<BuyerPersona> {
    const prompt = `Analyze this B2B prospect and create a detailed buyer persona.

PROSPECT DATA:
- Title: ${signals.professional.title}
- Seniority: ${signals.professional.seniority || 'Unknown'}
- Department: ${signals.professional.department || 'Unknown'}
- Skills: ${signals.professional.skills?.join(', ') || 'Unknown'}
- Headline: ${signals.professional.headline || 'N/A'}
- Company: ${signals.company.name}
- Industry: ${signals.company.industry || 'Unknown'}
- Company Size: ${signals.company.employeeCount || 'Unknown'} employees
- Technologies: ${signals.company.technologies?.join(', ') || 'Unknown'}
- Intent Score: ${signals.intent.score}/100
- Buying Stage: ${signals.intent.buyingStage || 'Unknown'}

Based on this data, create a buyer persona with:

1. ARCHETYPE: A descriptive label (e.g., "Growth-Focused Sales Leader", "Process-Driven Operations Manager")

2. COMMUNICATION STYLE: Choose one:
   - "analytical" (data-driven, wants proof, asks detailed questions)
   - "driver" (results-focused, direct, values efficiency)
   - "expressive" (relationship-oriented, enthusiastic, values innovation)
   - "amiable" (consensus-seeking, risk-averse, values stability)

3. BUYING ROLE: Choose one:
   - "economic_buyer" (controls budget)
   - "technical_buyer" (evaluates functionality)
   - "user_buyer" (will use daily)
   - "champion" (internal advocate)
   - "influencer" (shapes opinion)

4. PRIMARY MOTIVATIONS: 3-4 things that drive their decisions

5. DECISION CRITERIA: 3-4 things they evaluate when buying

6. RISK TOLERANCE: "low", "medium", or "high"

7. EXPECTED OBJECTIONS: 3-4 likely objections they'll raise

8. VALUE DRIVERS: 3-4 outcomes they care most about

9. PREFERRED PROOF POINTS: Types of evidence that resonate (case studies, ROI data, peer reviews, etc.)

Return as JSON:
{
  "archetype": "...",
  "communicationStyle": "...",
  "buyingRole": "...",
  "primaryMotivations": [...],
  "decisionCriteria": [...],
  "riskTolerance": "...",
  "expectedObjections": [...],
  "valueDrivers": [...],
  "preferredProofPoints": [...]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert B2B sales psychologist who creates accurate buyer personas. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      // Return default persona
      return {
        archetype: 'Business Professional',
        primaryMotivations: ['Efficiency', 'Results', 'Growth'],
        decisionCriteria: ['ROI', 'Ease of use', 'Support'],
        communicationStyle: 'analytical',
        riskTolerance: 'medium',
        buyingRole: 'influencer',
        expectedObjections: ['Budget constraints', 'Implementation time', 'Switching costs'],
        valueDrivers: ['Time savings', 'Revenue impact', 'Team productivity'],
        preferredProofPoints: ['Case studies', 'ROI calculator', 'Customer reviews'],
      };
    }
  }

  /**
   * Analyze competitive context from tech stack and signals
   */
  private async analyzeCompetitiveContext(
    signals: ProspectSignals,
    knownCompetitors?: string[]
  ): Promise<CompetitiveContext> {
    const techStack = signals.company.technologies || [];

    const prompt = `Analyze this company's tech stack and identify competitive context for a sales engagement.

COMPANY: ${signals.company.name}
INDUSTRY: ${signals.company.industry || 'Unknown'}
TECH STACK: ${techStack.join(', ') || 'Unknown'}
KNOWN COMPETITORS IN SPACE: ${knownCompetitors?.join(', ') || 'N/A'}

Provide:
1. CURRENT SOLUTIONS: What tools/solutions they likely use for sales/marketing/operations based on tech stack
2. LIKELY PAINS: Common frustrations with those solutions
3. COMPETITIVE ADVANTAGES: Why they might switch to a new solution
4. SWITCHING BARRIERS: What might prevent them from switching
5. KEY DIFFERENTIATORS: What would make a new solution compelling

Return as JSON:
{
  "currentSolutions": [...],
  "likelyPainWithCurrent": [...],
  "competitiveAdvantages": [...],
  "switchingBarriers": [...],
  "differentiators": [...]
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a competitive intelligence analyst. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        currentSolutions: [],
        likelyPainWithCurrent: ['Manual processes', 'Lack of visibility', 'Poor integration'],
        competitiveAdvantages: ['Better automation', 'Unified platform', 'AI capabilities'],
        switchingBarriers: ['Implementation effort', 'Team training', 'Data migration'],
        differentiators: ['Ease of use', 'Better support', 'Faster time to value'],
      };
    }
  }

  /**
   * Analyze trigger events for timing and messaging
   */
  private async analyzeTriggerEvents(signals: ProspectSignals): Promise<TriggerAnalysis | null> {
    const triggers = signals.intent.signals.filter(s =>
      ['funding', 'job_posting', 'news_mention'].includes(s.type)
    );

    if (triggers.length === 0) return null;

    const topTrigger = triggers.sort((a, b) => b.confidence - a.confidence)[0];

    const prompt = `Analyze this trigger event and provide strategic recommendations for sales outreach.

TRIGGER TYPE: ${topTrigger.type}
DESCRIPTION: ${topTrigger.description}
CONFIDENCE: ${topTrigger.confidence}%
DATE: ${topTrigger.timestamp}

PROSPECT CONTEXT:
- Title: ${signals.professional.title}
- Company: ${signals.company.name}
- Industry: ${signals.company.industry || 'Unknown'}

Provide:
1. URGENCY LEVEL: "low", "medium", "high", or "critical" based on how time-sensitive this trigger is
2. TIME WINDOW: How long is this trigger relevant for outreach?
3. RECOMMENDED ANGLE: The best messaging angle given this trigger
4. OPENING HOOK: A compelling first line that references this trigger naturally
5. CONNECTION TO VALUE: How to connect this trigger to your value proposition

Return as JSON:
{
  "trigger": "...",
  "urgencyLevel": "...",
  "timeWindow": "...",
  "recommendedAngle": "...",
  "openingHook": "...",
  "connectionToValue": "..."
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a sales timing expert. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        trigger: topTrigger.description,
        urgencyLevel: 'medium',
        timeWindow: '2-4 weeks',
        recommendedAngle: 'Capitalize on momentum',
        openingHook: `I noticed ${topTrigger.description}`,
        connectionToValue: 'This is often when teams like yours evaluate new solutions',
      };
    }
  }

  /**
   * Develop optimal email strategy based on all context
   */
  private async developEmailStrategy(
    persona: BuyerPersona,
    competitiveContext: CompetitiveContext,
    triggerAnalysis: TriggerAnalysis | null,
    signals: ProspectSignals
  ): Promise<EmailStrategy> {
    const prompt = `Develop an optimal email strategy for this prospect.

BUYER PERSONA:
- Archetype: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}
- Buying Role: ${persona.buyingRole}
- Risk Tolerance: ${persona.riskTolerance}
- Primary Motivations: ${persona.primaryMotivations.join(', ')}
- Expected Objections: ${persona.expectedObjections.join(', ')}

COMPETITIVE CONTEXT:
- Current Solutions: ${competitiveContext.currentSolutions.join(', ') || 'Unknown'}
- Likely Pains: ${competitiveContext.likelyPainWithCurrent.join(', ')}

TRIGGER: ${triggerAnalysis?.trigger || 'None identified'}
INTENT SCORE: ${signals.intent.score}/100
BUYING STAGE: ${signals.intent.buyingStage || 'awareness'}

Develop the optimal strategy:
1. PRIMARY ANGLE: The main messaging approach (problem-focused, opportunity-focused, peer-influenced, etc.)
2. EMOTIONAL APPEAL: What emotional driver to tap into (fear of missing out, desire for success, frustration relief, etc.)
3. LOGICAL APPEAL: What rational argument to make (ROI, efficiency, competitive advantage, etc.)
4. SOCIAL PROOF TYPE: Best type of proof for this persona (case study, peer quote, data point, award, etc.)
5. CTA STYLE: "soft" (offer resource), "medium" (suggest call), or "direct" (request meeting)
6. FOLLOW-UP STRATEGY: How to handle non-response
7. ANTICIPATED RESPONSE: Most likely response and how to handle it

Return as JSON:
{
  "primaryAngle": "...",
  "emotionalAppeal": "...",
  "logicalAppeal": "...",
  "socialProofType": "...",
  "ctaStyle": "...",
  "followUpStrategy": "...",
  "anticipatedResponse": "..."
}`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a sales strategy expert. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch {
      return {
        primaryAngle: 'Value-focused',
        emotionalAppeal: 'Desire for improvement',
        logicalAppeal: 'Efficiency gains',
        socialProofType: 'Case study',
        ctaStyle: 'medium',
        followUpStrategy: 'Add value with each touch',
        anticipatedResponse: 'Request for more information',
      };
    }
  }

  /**
   * Generate optimized subject lines with different angles
   */
  private async generateSubjectLines(
    signals: ProspectSignals,
    persona: BuyerPersona,
    strategy: EmailStrategy
  ): Promise<Array<{ text: string; angle: string; expectedOpenRate: string }>> {
    const prompt = `Generate 5 highly optimized email subject lines for this prospect.

PROSPECT:
- Name: ${signals.contact.email.split('@')[0]}
- Title: ${signals.professional.title}
- Company: ${signals.company.name}

PERSONA:
- Archetype: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}

STRATEGY:
- Primary Angle: ${strategy.primaryAngle}
- Emotional Appeal: ${strategy.emotionalAppeal}

SUBJECT LINE RULES:
1. 4-7 words maximum
2. Lowercase (except proper nouns)
3. Create curiosity without clickbait
4. No spam trigger words
5. Personalize where natural
6. Test different psychological triggers

Generate 5 subject lines with different angles:
1. Curiosity-driven
2. Pain-focused
3. Benefit-focused
4. Social proof
5. Question format

Return as JSON array:
[
  { "text": "...", "angle": "curiosity", "expectedOpenRate": "25-30%" },
  ...
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an email subject line expert with 40%+ average open rates. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 500,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [
        { text: `quick question about ${signals.company.name}`, angle: 'curiosity', expectedOpenRate: '25-30%' },
        { text: 'noticed this about your team', angle: 'personalization', expectedOpenRate: '30-35%' },
      ];
    }
  }

  /**
   * Generate multiple email variants for A/B testing
   */
  private async generateEmailVariants(
    signals: ProspectSignals,
    persona: BuyerPersona,
    competitiveContext: CompetitiveContext,
    strategy: EmailStrategy
  ): Promise<Array<{ variant: string; angle: string; body: string; strengths: string[]; bestFor: string }>> {
    const prompt = `Generate 3 distinct email variants for A/B testing.

PROSPECT:
- Name: ${signals.contact.email.split('@')[0].replace(/[._]/g, ' ')}
- Title: ${signals.professional.title}
- Company: ${signals.company.name}
- Industry: ${signals.company.industry || 'tech'}

PERSONA:
- Archetype: ${persona.archetype}
- Communication Style: ${persona.communicationStyle}
- Primary Motivations: ${persona.primaryMotivations.join(', ')}
- Expected Objections: ${persona.expectedObjections.join(', ')}

STRATEGY:
- Primary Angle: ${strategy.primaryAngle}
- Emotional Appeal: ${strategy.emotionalAppeal}
- Logical Appeal: ${strategy.logicalAppeal}
- CTA Style: ${strategy.ctaStyle}

COMPETITIVE CONTEXT:
- Current Solutions: ${competitiveContext.currentSolutions.join(', ') || 'Unknown'}
- Likely Pains: ${competitiveContext.likelyPainWithCurrent.join(', ')}

Generate 3 email variants:
1. PROBLEM-AGITATE-SOLVE: Lead with a pain point
2. PEER SUCCESS: Lead with what similar companies are doing
3. DIRECT VALUE: Lead with a specific benefit/outcome

Each email should be:
- 80-120 words
- Start with something about THEM (not you)
- Include ONE clear call-to-action
- Sound human, not salesy
- Reference their specific context

Return as JSON array:
[
  {
    "variant": "problem-agitate-solve",
    "angle": "Pain-focused",
    "body": "...",
    "strengths": ["..."],
    "bestFor": "Prospects frustrated with current situation"
  },
  ...
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a world-class B2B copywriter. Write emails that feel personal, not templated. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Generate intelligent follow-up sequence
   */
  private async generateFollowUpSequence(
    signals: ProspectSignals,
    persona: BuyerPersona,
    strategy: EmailStrategy
  ): Promise<Array<{ day: number; subject: string; body: string; channel: 'email' | 'linkedin' }>> {
    const prompt = `Generate a 5-touch follow-up sequence for this prospect who didn't respond.

PROSPECT:
- Title: ${signals.professional.title}
- Company: ${signals.company.name}
- Has LinkedIn: ${signals.contact.linkedinUrl ? 'Yes' : 'No'}

PERSONA:
- Communication Style: ${persona.communicationStyle}
- Risk Tolerance: ${persona.riskTolerance}

STRATEGY:
- Follow-Up Strategy: ${strategy.followUpStrategy}

SEQUENCE RULES:
1. Each touch should add NEW value (not just "bumping")
2. Mix channels if LinkedIn available
3. Vary the approach each time
4. Final email should be a "breakup" email
5. Keep emails progressively shorter
6. Never be desperate or pushy

Generate sequence:
- Day 3: Follow-up #1
- Day 7: Follow-up #2 (try different angle)
- Day 10: LinkedIn message (if available) or email
- Day 14: Follow-up #3 (share something valuable)
- Day 21: Breakup email

Return as JSON array:
[
  {
    "day": 3,
    "subject": "...",
    "body": "...",
    "channel": "email"
  },
  ...
]`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a follow-up sequence expert. Each touch should provide value, not annoy. Return only valid JSON array.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Calculate personalization depth score
   */
  private calculatePersonalizationDepth(
    signals: ProspectSignals,
    persona: BuyerPersona,
    triggerAnalysis: TriggerAnalysis | null
  ): number {
    let score = 0;

    // Signal-based scoring
    if (signals.professional.title) score += 10;
    if (signals.professional.headline) score += 15;
    if (signals.professional.skills?.length) score += 10;
    if (signals.company.industry) score += 10;
    if (signals.company.technologies?.length) score += 15;
    if (signals.intent.signals.length > 0) score += 15;
    if (signals.research.companyNews?.length) score += 10;

    // Persona confidence
    if (persona.archetype !== 'Business Professional') score += 10;

    // Trigger bonus
    if (triggerAnalysis) score += 15;

    return Math.min(100, score);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(signals: ProspectSignals): number {
    return signals.metadata.qualityScore;
  }
}

/**
 * Generate advanced personalized content
 */
export async function generateAdvancedPersonalization(
  prospectId: string,
  productContext?: {
    productName: string;
    valueProps: string[];
    targetPersonas: string[];
    competitors: string[];
  }
): Promise<PersonalizedContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get prospect signals
  const { data: prospect } = await supabase
    .from('prospects')
    .select('enrichment_data')
    .eq('id', prospectId)
    .single();

  if (!prospect?.enrichment_data) {
    throw new Error('Prospect not enriched. Run enrichment pipeline first.');
  }

  const engine = new AdvancedPersonalizationEngine(apiKey);
  return engine.generatePersonalizedContent(prospect.enrichment_data, productContext);
}
