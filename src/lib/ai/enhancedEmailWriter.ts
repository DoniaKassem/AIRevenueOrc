/**
 * Enhanced AI Email Writer
 * Generates deeply personalized outreach using enrichment signals and research
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';
import { ProspectSignals } from '../enrichment/multiSourcePipeline';
import { PersonalizationContext, transformSignalsToOutreach } from './signalToOutreach';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface EnhancedEmailRequest {
  prospectId: string;
  emailType: 'cold_outreach' | 'follow_up' | 'trigger_based' | 'breakup' | 'referral_request';
  tone?: 'professional' | 'conversational' | 'bold' | 'empathetic';
  length?: 'short' | 'medium' | 'long';
  includePS?: boolean;
  customInstructions?: string;
  previousEmailContext?: string;
  sequenceStep?: number;
}

export interface EnhancedEmailResult {
  subject: string;
  body: string;
  previewText: string;
  personalizationScore: number;
  signalsUsed: string[];
  talkingPointsUsed: Array<{
    type: string;
    content: string;
  }>;
  alternativeSubjects: string[];
  metadata: {
    model: string;
    tokensUsed: number;
    generatedAt: string;
    enrichmentSources: string[];
  };
}

export interface EmailSequence {
  emails: Array<{
    step: number;
    type: string;
    delay: string;
    subject: string;
    body: string;
    channel: 'email' | 'linkedin';
  }>;
  totalPersonalizationScore: number;
}

// =============================================
// ENHANCED EMAIL WRITER
// =============================================

export class EnhancedAIEmailWriter {
  private openai: OpenAI;
  private model = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate a deeply personalized email using all available signals
   */
  async generateEmail(request: EnhancedEmailRequest): Promise<EnhancedEmailResult> {
    // 1. Get prospect with enrichment data
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, accounts(*), company_profiles(*)')
      .eq('id', request.prospectId)
      .single();

    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // 2. Get or build signals
    let signals: ProspectSignals;
    if (prospect.enrichment_data) {
      signals = prospect.enrichment_data as ProspectSignals;
    } else {
      // Build minimal signals from prospect data
      signals = this.buildSignalsFromProspect(prospect);
    }

    // 3. Transform signals to personalization context
    const context = await transformSignalsToOutreach(signals, true);

    // 4. Build the email prompt
    const systemPrompt = this.buildSystemPrompt(request, context);
    const userPrompt = this.buildUserPrompt(request, prospect, signals, context);

    // 5. Generate email with GPT-4
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    });

    // 6. Parse the response
    const content = completion.choices[0].message.content || '';
    const parsed = this.parseEmailResponse(content);

    // 7. Generate alternative subject lines
    const altSubjects = await this.generateAlternativeSubjects(parsed.subject, signals);

    // 8. Track which signals and talking points were used
    const signalsUsed = this.identifySignalsUsed(parsed.body, signals);
    const talkingPointsUsed = this.identifyTalkingPointsUsed(parsed.body, context);

    // 9. Log generation
    await this.logGeneration(request.prospectId, request.emailType, parsed, signalsUsed);

    return {
      subject: parsed.subject,
      body: parsed.body,
      previewText: parsed.previewText,
      personalizationScore: context.personalizationScore,
      signalsUsed,
      talkingPointsUsed,
      alternativeSubjects: altSubjects,
      metadata: {
        model: this.model,
        tokensUsed: completion.usage?.total_tokens || 0,
        generatedAt: new Date().toISOString(),
        enrichmentSources: signals.metadata.sources,
      },
    };
  }

  /**
   * Generate a complete email sequence
   */
  async generateSequence(
    prospectId: string,
    sequenceLength: number = 5
  ): Promise<EmailSequence> {
    const emails: EmailSequence['emails'] = [];
    let totalScore = 0;

    const sequenceTypes = [
      { type: 'cold_outreach', delay: 'Day 0', channel: 'email' as const },
      { type: 'follow_up', delay: 'Day 3', channel: 'email' as const },
      { type: 'trigger_based', delay: 'Day 5', channel: 'linkedin' as const },
      { type: 'follow_up', delay: 'Day 8', channel: 'email' as const },
      { type: 'breakup', delay: 'Day 14', channel: 'email' as const },
    ];

    for (let i = 0; i < Math.min(sequenceLength, sequenceTypes.length); i++) {
      const config = sequenceTypes[i];

      const result = await this.generateEmail({
        prospectId,
        emailType: config.type as any,
        sequenceStep: i + 1,
        previousEmailContext: emails.length > 0 ? emails[emails.length - 1].body : undefined,
      });

      emails.push({
        step: i + 1,
        type: config.type,
        delay: config.delay,
        subject: result.subject,
        body: result.body,
        channel: config.channel,
      });

      totalScore += result.personalizationScore;
    }

    return {
      emails,
      totalPersonalizationScore: Math.round(totalScore / emails.length),
    };
  }

  /**
   * Build system prompt based on email type and context
   */
  private buildSystemPrompt(
    request: EnhancedEmailRequest,
    context: PersonalizationContext
  ): string {
    const toneDescriptions = {
      professional: 'professional, polished, and business-appropriate',
      conversational: 'warm, friendly, and conversational like talking to a colleague',
      bold: 'confident, direct, and attention-grabbing without being aggressive',
      empathetic: 'understanding, helpful, and focused on their challenges',
    };

    const lengthGuidance = {
      short: '50-80 words. Get to the point fast.',
      medium: '100-150 words. Balanced depth and brevity.',
      long: '200-250 words. More context and detail.',
    };

    const emailTypeGuidance = {
      cold_outreach: `This is a FIRST email to someone who doesn't know you. Goals:
- Lead with something relevant to THEM (not about you/your company)
- Demonstrate you did research
- Create curiosity about what you offer
- End with a soft, low-commitment ask`,
      follow_up: `This is a FOLLOW-UP email. Goals:
- Reference previous outreach briefly
- Add NEW value (don't just "bump" the thread)
- Be persistent but not pushy
- Offer a different angle or asset`,
      trigger_based: `This is triggered by a SPECIFIC EVENT. Goals:
- Reference the trigger event naturally
- Connect the event to why you're reaching out
- Make the timing feel intentional, not coincidental
- Offer relevant, timely value`,
      breakup: `This is a FINAL attempt email. Goals:
- Be direct that this is your last email
- Summarize the value you could provide
- Make it easy to say yes or no
- Leave the door open professionally`,
      referral_request: `This is asking for a REFERRAL. Goals:
- Acknowledge they may not be the right person
- Ask who else might be relevant
- Make it easy to forward or refer
- Provide a clear reason someone would want to talk`,
    };

    return `You are an elite B2B sales copywriter who writes emails that consistently achieve 40%+ open rates and 15%+ response rates.

EMAIL TYPE: ${request.emailType}
${emailTypeGuidance[request.emailType]}

TONE: ${toneDescriptions[request.tone || 'professional']}

LENGTH: ${lengthGuidance[request.length || 'medium']}

PERSONALIZATION CONTEXT:
- Best opener: ${context.openers[0]?.content || 'Generic'}
- Main pain point: ${context.painPoints[0]?.content || 'Unknown'}
- Recommended angle: ${context.recommendedAngle}
- Buying stage: ${context.callsToAction[0]?.signal || 'awareness'}

CRITICAL RULES:
1. NEVER start with "I hope this email finds you well" or similar clichés
2. NEVER lead with your company or product name in the first line
3. ALWAYS use the prospect's specific signals in the email - don't be generic
4. Subject lines: 4-7 words, lowercase, create curiosity, no clickbait
5. First line must be about THEM (reference a signal or trigger)
6. Include ONE clear call-to-action (not multiple options)
7. Use their name naturally, not in the subject line
8. Write at an 8th grade reading level
9. No jargon, buzzwords, or corporate speak
10. Sound human - like a helpful expert, not a salesperson

FORMAT YOUR RESPONSE AS:
SUBJECT: [subject line here]
PREVIEW: [email preview text - 35-50 chars]
BODY:
[email body here]
${request.includePS ? 'PS: [postscript that adds value or creates urgency]' : ''}`;
  }

  /**
   * Build user prompt with all prospect context
   */
  private buildUserPrompt(
    request: EnhancedEmailRequest,
    prospect: any,
    signals: ProspectSignals,
    context: PersonalizationContext
  ): string {
    let prompt = `Write a ${request.emailType} email for this prospect:

=== PROSPECT PROFILE ===
Name: ${prospect.first_name} ${prospect.last_name}
Title: ${signals.professional.title || prospect.title || 'Unknown'}
${signals.professional.headline ? `Headline: ${signals.professional.headline}` : ''}
Company: ${signals.company.name || prospect.company}
Industry: ${signals.company.industry || 'Unknown'}
Company Size: ${signals.company.employeeCount ? `${signals.company.employeeCount} employees` : 'Unknown'}
${signals.professional.seniority ? `Seniority: ${signals.professional.seniority}` : ''}
${signals.professional.department ? `Department: ${signals.professional.department}` : ''}

=== SIGNALS TO USE (pick 2-3 most relevant) ===
`;

    // Add openers
    if (context.openers.length > 0) {
      prompt += `\nOPENER OPTIONS:\n`;
      context.openers.slice(0, 3).forEach((o, i) => {
        prompt += `${i + 1}. ${o.content} [from: ${o.signal}]\n`;
      });
    }

    // Add pain points
    if (context.painPoints.length > 0) {
      prompt += `\nPAIN POINTS TO ADDRESS:\n`;
      context.painPoints.slice(0, 3).forEach((p, i) => {
        prompt += `${i + 1}. ${p.content}\n`;
      });
    }

    // Add triggers
    if (context.triggers.length > 0) {
      prompt += `\nTRIGGER EVENTS:\n`;
      context.triggers.slice(0, 2).forEach((t, i) => {
        prompt += `${i + 1}. ${t.content}\n`;
      });
    }

    // Add value props
    if (context.valueProps.length > 0) {
      prompt += `\nVALUE PROPOSITIONS:\n`;
      context.valueProps.slice(0, 2).forEach((v, i) => {
        prompt += `${i + 1}. ${v.content}\n`;
      });
    }

    // Add social proof
    if (context.socialProof.length > 0) {
      prompt += `\nSOCIAL PROOF OPTIONS:\n`;
      context.socialProof.slice(0, 2).forEach((s, i) => {
        prompt += `${i + 1}. ${s.content}\n`;
      });
    }

    // Add CTAs
    if (context.callsToAction.length > 0) {
      prompt += `\nCALL-TO-ACTION OPTIONS:\n`;
      context.callsToAction.slice(0, 3).forEach((c, i) => {
        prompt += `${i + 1}. ${c.content}\n`;
      });
    }

    // Add company research
    if (signals.research.companyNews && signals.research.companyNews.length > 0) {
      prompt += `\nRECENT COMPANY NEWS:\n`;
      signals.research.companyNews.slice(0, 2).forEach(news => {
        prompt += `- ${news.title} (${news.date})\n`;
      });
    }

    // Add technology context
    if (signals.company.technologies && signals.company.technologies.length > 0) {
      prompt += `\nTECH STACK: ${signals.company.technologies.slice(0, 5).join(', ')}\n`;
    }

    // Add LinkedIn insights
    if (signals.professional.skills && signals.professional.skills.length > 0) {
      prompt += `\nLINKEDIN SKILLS: ${signals.professional.skills.slice(0, 5).join(', ')}\n`;
    }

    if (signals.professional.previousCompanies && signals.professional.previousCompanies.length > 0) {
      prompt += `\nPREVIOUS COMPANIES: ${signals.professional.previousCompanies.slice(0, 3).join(', ')}\n`;
    }

    // Add relationship context
    if (signals.relationship.previousInteractions) {
      prompt += `\nPREVIOUS INTERACTIONS: ${signals.relationship.previousInteractions} touchpoints\n`;
    }

    // Add intent signals
    if (signals.intent.score > 50) {
      prompt += `\nINTENT SCORE: ${signals.intent.score}/100 - High intent prospect\n`;
    }

    // Add sequence context
    if (request.sequenceStep && request.sequenceStep > 1) {
      prompt += `\n=== SEQUENCE CONTEXT ===
This is email #${request.sequenceStep} in the sequence.
Previous email reference: ${request.previousEmailContext?.slice(0, 200)}...
\nIMPORTANT: Reference the previous outreach without being annoying. Add NEW value.\n`;
    }

    // Add custom instructions
    if (request.customInstructions) {
      prompt += `\n=== SPECIAL INSTRUCTIONS ===
${request.customInstructions}\n`;
    }

    prompt += `\n=== RECOMMENDED APPROACH ===
Angle: ${context.recommendedAngle}
Best send time: ${context.timingRecommendation.bestDayOfWeek} at ${context.timingRecommendation.bestTimeOfDay}

Now write the email, incorporating the most relevant signals naturally.`;

    return prompt;
  }

  /**
   * Parse email from GPT response
   */
  private parseEmailResponse(content: string): {
    subject: string;
    body: string;
    previewText: string;
    ps?: string;
  } {
    const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
    const previewMatch = content.match(/PREVIEW:\s*(.+)/i);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+?)(?:PS:|$)/i);
    const psMatch = content.match(/PS:\s*(.+)/i);

    return {
      subject: subjectMatch ? subjectMatch[1].trim() : 'Quick question',
      previewText: previewMatch ? previewMatch[1].trim() : '',
      body: bodyMatch ? bodyMatch[1].trim() : content,
      ps: psMatch ? psMatch[1].trim() : undefined,
    };
  }

  /**
   * Generate alternative subject lines
   */
  private async generateAlternativeSubjects(
    originalSubject: string,
    signals: ProspectSignals
  ): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Generate 3 alternative email subject lines. Rules: 4-7 words, lowercase, create curiosity, personalized. Return only the subjects, one per line.',
          },
          {
            role: 'user',
            content: `Original: "${originalSubject}"
Company: ${signals.company.name}
Title: ${signals.professional.title}
Signal: ${signals.intent.signals[0]?.type || 'none'}

Generate 3 alternatives:`,
          },
        ],
        temperature: 0.9,
        max_tokens: 150,
      });

      return completion.choices[0].message.content
        ?.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3) || [];
    } catch {
      return [];
    }
  }

  /**
   * Identify which signals were used in the email
   */
  private identifySignalsUsed(body: string, signals: ProspectSignals): string[] {
    const used: string[] = [];
    const bodyLower = body.toLowerCase();

    if (signals.company.name && bodyLower.includes(signals.company.name.toLowerCase())) {
      used.push('company_name');
    }
    if (signals.professional.title && bodyLower.includes(signals.professional.title.toLowerCase())) {
      used.push('job_title');
    }
    if (signals.company.industry && bodyLower.includes(signals.company.industry.toLowerCase())) {
      used.push('industry');
    }
    if (signals.intent.signals.some(s => bodyLower.includes(s.type))) {
      used.push('intent_signal');
    }
    if (signals.research.companyNews?.some(n => bodyLower.includes(n.title.toLowerCase().slice(0, 20)))) {
      used.push('company_news');
    }
    if (signals.professional.skills?.some(s => bodyLower.includes(s.toLowerCase()))) {
      used.push('linkedin_skills');
    }

    return used;
  }

  /**
   * Identify which talking points were used
   */
  private identifyTalkingPointsUsed(
    body: string,
    context: PersonalizationContext
  ): Array<{ type: string; content: string }> {
    const used: Array<{ type: string; content: string }> = [];
    const bodyLower = body.toLowerCase();

    const allPoints = [
      ...context.openers,
      ...context.painPoints,
      ...context.valueProps,
      ...context.triggers,
    ];

    for (const point of allPoints) {
      // Check if key words from the talking point appear in the body
      const keywords = point.content.toLowerCase().split(' ').filter(w => w.length > 4);
      const matchCount = keywords.filter(k => bodyLower.includes(k)).length;

      if (matchCount >= 2 || (matchCount >= 1 && keywords.length <= 3)) {
        used.push({ type: point.type, content: point.content });
      }
    }

    return used.slice(0, 5); // Limit to top 5
  }

  /**
   * Build minimal signals from prospect data
   */
  private buildSignalsFromProspect(prospect: any): ProspectSignals {
    return {
      contact: {
        email: prospect.email,
        emailVerified: false,
        phone: prospect.phone,
        linkedinUrl: prospect.linkedin_url,
      },
      professional: {
        title: prospect.title || '',
        department: prospect.department,
      },
      company: {
        name: prospect.company || '',
        industry: prospect.accounts?.industry,
        employeeCount: prospect.accounts?.employee_count,
      },
      intent: {
        signals: [],
        score: prospect.intent_score || 0,
      },
      relationship: {},
      research: {},
      metadata: {
        sources: ['prospect_data'],
        enrichedAt: new Date().toISOString(),
        qualityScore: 30,
        completeness: 20,
        freshness: 100,
      },
    };
  }

  /**
   * Log email generation
   */
  private async logGeneration(
    prospectId: string,
    emailType: string,
    parsed: any,
    signalsUsed: string[]
  ): Promise<void> {
    await supabase.from('ai_email_generations').insert({
      prospect_id: prospectId,
      purpose: emailType,
      subject: parsed.subject,
      body: parsed.body,
      model: this.model,
      signals_used: signalsUsed,
      generated_at: new Date().toISOString(),
    });
  }
}

/**
 * Create enhanced email writer
 */
export function createEnhancedEmailWriter(apiKey?: string): EnhancedAIEmailWriter {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new EnhancedAIEmailWriter(key);
}

/**
 * Generate a deeply personalized email for a prospect
 */
export async function generatePersonalizedEmail(
  prospectId: string,
  options: Partial<EnhancedEmailRequest> = {}
): Promise<EnhancedEmailResult> {
  const writer = createEnhancedEmailWriter();
  return writer.generateEmail({
    prospectId,
    emailType: 'cold_outreach',
    ...options,
  });
}

/**
 * Generate a complete outreach sequence
 */
export async function generateOutreachSequence(
  prospectId: string,
  sequenceLength: number = 5
): Promise<EmailSequence> {
  const writer = createEnhancedEmailWriter();
  return writer.generateSequence(prospectId, sequenceLength);
}
