/**
 * AI Email Writer
 * Uses GPT-4 to generate personalized sales emails
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

export interface EmailGenerationRequest {
  prospectId: string;
  purpose: 'cold_outreach' | 'follow_up' | 'meeting_request' | 'check_in' | 'proposal' | 'custom';
  tone?: 'professional' | 'friendly' | 'casual' | 'formal';
  length?: 'short' | 'medium' | 'long';
  includeCallToAction?: boolean;
  customPrompt?: string;
  context?: {
    previousEmails?: string[];
    meetingNotes?: string;
    dealStage?: string;
    products?: string[];
  };
}

export interface EmailGenerationResult {
  subject: string;
  body: string;
  alternatives?: Array<{
    subject: string;
    body: string;
  }>;
  metadata: {
    model: string;
    tokensUsed: number;
    generatedAt: Date;
    purpose: string;
  };
}

export interface EmailImprovementRequest {
  originalEmail: string;
  improvementType: 'clarity' | 'tone' | 'length' | 'cta' | 'personalization' | 'all';
  targetAudience?: string;
}

/**
 * AI Email Writer Service
 */
export class AIEmailWriter {
  private openai: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate a new email using AI
   */
  async generateEmail(request: EmailGenerationRequest): Promise<EmailGenerationResult> {
    // Get prospect data
    const { data: prospect } = await supabase
      .from('prospects')
      .select(`
        *,
        accounts (*)
      `)
      .eq('id', request.prospectId)
      .single();

    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // Get recent activities for context
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', request.prospectId)
      .order('completed_at', { ascending: false })
      .limit(5);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(request.purpose, request.tone);

    // Build user prompt with prospect context
    const userPrompt = this.buildUserPrompt(request, prospect, activities || []);

    // Generate email with GPT-4
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      n: request.alternatives ? 3 : 1
    });

    // Parse response
    const primaryChoice = completion.choices[0];
    const parsed = this.parseEmailFromCompletion(primaryChoice.message.content || '');

    const result: EmailGenerationResult = {
      subject: parsed.subject,
      body: parsed.body,
      alternatives: [],
      metadata: {
        model: this.model,
        tokensUsed: completion.usage?.total_tokens || 0,
        generatedAt: new Date(),
        purpose: request.purpose
      }
    };

    // Parse alternatives if requested
    if (request.alternatives && completion.choices.length > 1) {
      result.alternatives = completion.choices.slice(1).map(choice => {
        return this.parseEmailFromCompletion(choice.message.content || '');
      });
    }

    // Log generation to database
    await this.logGeneration(request.prospectId, request.purpose, result);

    return result;
  }

  /**
   * Improve an existing email
   */
  async improveEmail(request: EmailImprovementRequest): Promise<EmailGenerationResult> {
    const systemPrompt = `You are an expert sales email writer. Your task is to improve the given email based on the specified improvement type. Maintain the core message but enhance ${request.improvementType}.`;

    const userPrompt = `
Original Email:
${request.originalEmail}

Improvement Type: ${request.improvementType}
${request.targetAudience ? `Target Audience: ${request.targetAudience}` : ''}

Please provide an improved version of this email. Format your response as:
SUBJECT: [subject line]
BODY:
[email body]
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const parsed = this.parseEmailFromCompletion(completion.choices[0].message.content || '');

    return {
      subject: parsed.subject,
      body: parsed.body,
      metadata: {
        model: this.model,
        tokensUsed: completion.usage?.total_tokens || 0,
        generatedAt: new Date(),
        purpose: 'improvement'
      }
    };
  }

  /**
   * Generate multiple email variations
   */
  async generateVariations(
    originalEmail: { subject: string; body: string },
    count: number = 3
  ): Promise<Array<{ subject: string; body: string }>> {
    const systemPrompt = 'You are an expert sales email writer. Generate variations of the given email while maintaining the core message.';

    const userPrompt = `
Original Email:
SUBJECT: ${originalEmail.subject}
BODY:
${originalEmail.body}

Generate ${count} different variations of this email. Each variation should have a different approach or angle while conveying the same core message.

Format each variation as:
VARIATION 1:
SUBJECT: [subject]
BODY: [body]

VARIATION 2:
SUBJECT: [subject]
BODY: [body]
...
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    const content = completion.choices[0].message.content || '';
    return this.parseMultipleVariations(content);
  }

  /**
   * Generate subject lines for existing email body
   */
  async generateSubjectLines(emailBody: string, count: number = 5): Promise<string[]> {
    const systemPrompt = 'You are an expert at writing compelling email subject lines that drive high open rates.';

    const userPrompt = `
Email Body:
${emailBody}

Generate ${count} compelling subject lines for this email. The subject lines should:
1. Be attention-grabbing
2. Create curiosity
3. Be relevant to the content
4. Be concise (under 60 characters)
5. Avoid spam trigger words

Return only the subject lines, one per line, numbered.
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    const content = completion.choices[0].message.content || '';
    return this.parseSubjectLines(content);
  }

  /**
   * Build system prompt based on email purpose
   */
  private buildSystemPrompt(purpose: string, tone?: string): string {
    const toneDescription = {
      professional: 'professional and business-like',
      friendly: 'friendly and approachable',
      casual: 'casual and conversational',
      formal: 'formal and respectful'
    };

    const purposeDescription = {
      cold_outreach: 'You are writing a cold outreach email to a prospect who has never heard from you before. The goal is to introduce yourself, establish credibility, and generate interest.',
      follow_up: 'You are writing a follow-up email to a prospect you\'ve contacted before. Reference the previous interaction and move the conversation forward.',
      meeting_request: 'You are writing an email to request a meeting. Be clear about the value proposition and make it easy for them to say yes.',
      check_in: 'You are writing a check-in email to maintain the relationship and stay top-of-mind. Be helpful and provide value.',
      proposal: 'You are writing an email to present a proposal or solution. Be clear about the benefits and next steps.',
      custom: 'You are writing a sales email.'
    };

    return `You are an expert B2B sales email writer with 10+ years of experience.

${purposeDescription[purpose as keyof typeof purposeDescription] || purposeDescription.custom}

Tone: ${tone ? toneDescription[tone as keyof typeof toneDescription] : 'professional'}

Best practices:
- Keep it concise and scannable
- Lead with value for the recipient
- Personalize based on available context
- Include a clear call-to-action
- Avoid salesy language and jargon
- Use short paragraphs (2-3 sentences max)
- Write at an 8th-grade reading level
- Proofread for grammar and spelling

Format your response as:
SUBJECT: [compelling subject line]
BODY:
[email body with proper formatting]
`;
  }

  /**
   * Build user prompt with prospect context
   */
  private buildUserPrompt(
    request: EmailGenerationRequest,
    prospect: any,
    activities: any[]
  ): string {
    let prompt = `Write an email for the following prospect:

Prospect Information:
- Name: ${prospect.first_name} ${prospect.last_name}
- Title: ${prospect.title || 'Unknown'}
- Company: ${prospect.company || 'Unknown'}
- Industry: ${prospect.accounts?.industry || 'Unknown'}
- Email: ${prospect.email}
`;

    // Add stage context
    if (prospect.stage) {
      prompt += `- Current Stage: ${prospect.stage}\n`;
    }

    // Add recent activity context
    if (activities.length > 0) {
      prompt += `\nRecent Interactions:\n`;
      activities.forEach(activity => {
        prompt += `- ${activity.activity_type}: ${activity.notes || activity.subject || 'No details'}\n`;
      });
    }

    // Add custom context
    if (request.context) {
      if (request.context.previousEmails && request.context.previousEmails.length > 0) {
        prompt += `\nPrevious Emails:\n${request.context.previousEmails.join('\n\n---\n\n')}`;
      }

      if (request.context.meetingNotes) {
        prompt += `\nMeeting Notes:\n${request.context.meetingNotes}`;
      }

      if (request.context.dealStage) {
        prompt += `\nDeal Stage: ${request.context.dealStage}`;
      }

      if (request.context.products && request.context.products.length > 0) {
        prompt += `\nProducts Discussed: ${request.context.products.join(', ')}`;
      }
    }

    // Add custom prompt if provided
    if (request.customPrompt) {
      prompt += `\n\nAdditional Instructions:\n${request.customPrompt}`;
    }

    // Add length guidance
    const lengthGuidance = {
      short: '50-100 words',
      medium: '100-200 words',
      long: '200-300 words'
    };
    prompt += `\n\nTarget Length: ${lengthGuidance[request.length || 'medium']}`;

    // Add CTA requirement
    if (request.includeCallToAction !== false) {
      prompt += `\n\nInclude a clear call-to-action at the end.`;
    }

    return prompt;
  }

  /**
   * Parse email from GPT completion
   */
  private parseEmailFromCompletion(content: string): { subject: string; body: string } {
    const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
    const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

    const subject = subjectMatch ? subjectMatch[1].trim() : 'Your Subject Here';
    const body = bodyMatch ? bodyMatch[1].trim() : content;

    return { subject, body };
  }

  /**
   * Parse multiple variations
   */
  private parseMultipleVariations(content: string): Array<{ subject: string; body: string }> {
    const variations: Array<{ subject: string; body: string }> = [];

    const variationRegex = /VARIATION \d+:\s*SUBJECT:\s*(.+?)\s*BODY:\s*([\s\S]+?)(?=VARIATION \d+:|$)/gi;
    let match;

    while ((match = variationRegex.exec(content)) !== null) {
      variations.push({
        subject: match[1].trim(),
        body: match[2].trim()
      });
    }

    return variations;
  }

  /**
   * Parse subject lines
   */
  private parseSubjectLines(content: string): string[] {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Remove numbering (1. 2. etc.)
      return line.replace(/^\d+\.\s*/, '').trim();
    }).filter(line => line.length > 0);
  }

  /**
   * Log generation to database
   */
  private async logGeneration(
    prospectId: string,
    purpose: string,
    result: EmailGenerationResult
  ): Promise<void> {
    await supabase.from('ai_email_generations').insert({
      prospect_id: prospectId,
      purpose: purpose,
      subject: result.subject,
      body: result.body,
      model: result.metadata.model,
      tokens_used: result.metadata.tokensUsed,
      generated_at: result.metadata.generatedAt.toISOString()
    });
  }
}

/**
 * Create AI Email Writer
 */
export function createAIEmailWriter(apiKey?: string): AIEmailWriter {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new AIEmailWriter(key);
}
