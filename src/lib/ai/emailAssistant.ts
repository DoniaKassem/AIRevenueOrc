/**
 * AI Email Assistant - Real GPT-4 Integration
 * Generate personalized emails using OpenAI GPT-4 Turbo
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIEmailGenerationRequest {
  userId: string;
  organizationId: string;
  objectType: 'prospect' | 'deal' | 'ticket' | 'account';
  objectId: string;
  emailType: 'cold_outreach' | 'follow_up' | 'meeting_request' | 'proposal' | 'support_reply' | 'thank_you' | 'introduction' | 'feedback_request' | 'event_invite' | 'custom';
  tone: 'professional' | 'casual' | 'persuasive' | 'friendly' | 'urgent';
  additionalContext?: string;
  userPrompt?: string;
}

export interface AIEmailGenerationResponse {
  id: string;
  subject: string;
  body: string;
  confidence: number;
  tokensUsed: number;
  cost: number;
  model: string;
}

export interface AIEmailGeneration {
  id: string;
  userId: string;
  organizationId: string;
  objectType: string;
  objectId: string;
  emailType: string;
  tone: string;
  additionalContext?: string;
  userPrompt?: string;
  generatedSubject: string;
  generatedBody: string;
  confidence: number;
  model: string;
  tokensUsed: number;
  wasEdited: boolean;
  finalSubject?: string;
  finalBody?: string;
  editDistance?: number;
  wasSent: boolean;
  openRate?: number;
  clickRate?: number;
  replyRate?: number;
  cost: number;
  createdAt: Date;
  sentAt?: Date;
}

/**
 * AI Email Assistant Service
 */
export class AIEmailAssistantService {
  /**
   * Generate email using GPT-4
   */
  async generateEmail(request: AIEmailGenerationRequest): Promise<AIEmailGenerationResponse> {
    // Check usage limits
    await this.checkUsageLimits(request.organizationId);

    // Get context data
    const context = await this.getContextData(request.objectType, request.objectId);

    // Build prompt
    const prompt = this.buildPrompt(request, context);

    // Call OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(request.tone, request.emailType)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const duration = Date.now() - startTime;

    // Parse response
    const emailContent = completion.choices[0].message.content || '';
    const { subject, body } = this.parseEmailContent(emailContent);

    // Calculate cost (GPT-4 Turbo: $0.01/1K input, $0.03/1K output)
    const tokensUsed = completion.usage?.total_tokens || 0;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const cost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;

    // Calculate confidence score
    const confidence = this.calculateConfidence(completion, context);

    // Save generation
    const { data, error } = await supabase
      .from('ai_email_generations')
      .insert({
        user_id: request.userId,
        organization_id: request.organizationId,
        object_type: request.objectType,
        object_id: request.objectId,
        email_type: request.emailType,
        tone: request.tone,
        additional_context: request.additionalContext,
        user_prompt: request.userPrompt,
        generated_subject: subject,
        generated_body: body,
        confidence,
        model: 'gpt-4-turbo-preview',
        tokens_used: tokensUsed,
        cost,
        was_edited: false,
        was_sent: false
      })
      .select()
      .single();

    if (error) throw error;

    // Track usage
    await this.trackUsage(request.organizationId, request.userId, tokensUsed, cost);

    return {
      id: data.id,
      subject,
      body,
      confidence,
      tokensUsed,
      cost,
      model: 'gpt-4-turbo-preview'
    };
  }

  /**
   * Refine email based on user feedback
   */
  async refineEmail(generationId: string, userFeedback: string): Promise<AIEmailGenerationResponse> {
    // Get original generation
    const { data: original } = await supabase
      .from('ai_email_generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (!original) throw new Error('Generation not found');

    // Build refinement prompt
    const refinementPrompt = `
Original Email:
Subject: ${original.generated_subject}

${original.generated_body}

User Feedback: ${userFeedback}

Please refine the email based on this feedback while maintaining the core message.
`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(original.tone, original.email_type)
        },
        {
          role: 'user',
          content: refinementPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const emailContent = completion.choices[0].message.content || '';
    const { subject, body } = this.parseEmailContent(emailContent);

    // Calculate cost
    const tokensUsed = completion.usage?.total_tokens || 0;
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const cost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;

    // Update generation
    await supabase
      .from('ai_email_generations')
      .update({
        generated_subject: subject,
        generated_body: body,
        tokens_used: original.tokens_used + tokensUsed,
        cost: original.cost + cost
      })
      .eq('id', generationId);

    // Track usage
    await this.trackUsage(original.organization_id, original.user_id, tokensUsed, cost);

    return {
      id: generationId,
      subject,
      body,
      confidence: 85,
      tokensUsed,
      cost,
      model: 'gpt-4-turbo-preview'
    };
  }

  /**
   * Generate multiple reply suggestions
   */
  async generateReplySuggestions(
    ticketId: string,
    userId: string,
    organizationId: string,
    count: number = 3
  ): Promise<AIEmailGenerationResponse[]> {
    // Get ticket context
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*, ticket_replies(*)')
      .eq('id', ticketId)
      .single();

    if (!ticket) throw new Error('Ticket not found');

    // Build conversation history
    const conversation = ticket.ticket_replies
      .map((r: any) => `${r.author_type === 'customer' ? 'Customer' : 'Agent'}: ${r.content}`)
      .join('\n\n');

    // Generate suggestions
    const suggestions: AIEmailGenerationResponse[] = [];

    const tones: Array<'professional' | 'friendly' | 'empathetic'> = ['professional', 'friendly', 'empathetic'];

    for (let i = 0; i < Math.min(count, 3); i++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a helpful customer support agent. Reply to tickets professionally and helpfully. Tone: ${tones[i]}.`
          },
          {
            role: 'user',
            content: `Ticket #${ticket.ticket_number}\nSubject: ${ticket.subject}\n\nConversation:\n${conversation}\n\nWrite a ${tones[i]} reply to help resolve this ticket.`
          }
        ],
        temperature: 0.7 + (i * 0.1), // Vary temperature for diversity
        max_tokens: 500,
      });

      const body = completion.choices[0].message.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens / 1000) * 0.01 + (outputTokens / 1000) * 0.03;

      // Save generation
      const { data } = await supabase
        .from('ai_email_generations')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          object_type: 'ticket',
          object_id: ticketId,
          email_type: 'support_reply',
          tone: tones[i],
          generated_subject: `Re: ${ticket.subject}`,
          generated_body: body,
          confidence: 80 + i * 5,
          model: 'gpt-4-turbo-preview',
          tokens_used: tokensUsed,
          cost,
          was_edited: false,
          was_sent: false
        })
        .select()
        .single();

      if (data) {
        suggestions.push({
          id: data.id,
          subject: `Re: ${ticket.subject}`,
          body,
          confidence: 80 + i * 5,
          tokensUsed,
          cost,
          model: 'gpt-4-turbo-preview'
        });
      }

      await this.trackUsage(organizationId, userId, tokensUsed, cost);
    }

    return suggestions;
  }

  /**
   * Track email edit and sending
   */
  async trackEmailAction(
    generationId: string,
    action: {
      finalSubject?: string;
      finalBody?: string;
      wasSent?: boolean;
      sentAt?: Date;
    }
  ): Promise<void> {
    const { data: original } = await supabase
      .from('ai_email_generations')
      .select('*')
      .eq('id', generationId)
      .single();

    if (!original) return;

    const updates: any = {
      was_sent: action.wasSent,
      sent_at: action.sentAt?.toISOString()
    };

    if (action.finalSubject || action.finalBody) {
      updates.was_edited = true;
      updates.final_subject = action.finalSubject;
      updates.final_body = action.finalBody;

      // Calculate edit distance
      if (action.finalBody) {
        updates.edit_distance = this.calculateEditDistance(
          original.generated_body,
          action.finalBody
        );
      }
    }

    await supabase
      .from('ai_email_generations')
      .update(updates)
      .eq('id', generationId);
  }

  /**
   * Track email performance (open, click, reply)
   */
  async trackEmailPerformance(
    generationId: string,
    metrics: {
      openRate?: number;
      clickRate?: number;
      replyRate?: number;
    }
  ): Promise<void> {
    await supabase
      .from('ai_email_generations')
      .update(metrics)
      .eq('id', generationId);
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(organizationId: string, month?: string): Promise<{
    emailsGenerated: number;
    tokensUsed: number;
    totalCost: number;
    creditsRemaining: number;
    avgConfidence: number;
    avgEditDistance: number;
    sendRate: number;
  }> {
    const currentMonth = month || new Date().toISOString().substring(0, 7);

    const { data: usage } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('month', currentMonth)
      .single();

    if (!usage) {
      return {
        emailsGenerated: 0,
        tokensUsed: 0,
        totalCost: 0,
        creditsRemaining: 1000, // Default credits
        avgConfidence: 0,
        avgEditDistance: 0,
        sendRate: 0
      };
    }

    return {
      emailsGenerated: usage.emails_generated,
      tokensUsed: usage.tokens_used,
      totalCost: usage.total_cost,
      creditsRemaining: usage.credits_remaining,
      avgConfidence: usage.avg_confidence,
      avgEditDistance: usage.avg_edit_distance,
      sendRate: usage.send_rate
    };
  }

  /**
   * Get email generation history
   */
  async getGenerationHistory(
    organizationId: string,
    filters?: {
      userId?: string;
      objectType?: string;
      emailType?: string;
      limit?: number;
    }
  ): Promise<AIEmailGeneration[]> {
    let query = supabase
      .from('ai_email_generations')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.objectType) {
      query = query.eq('object_type', filters.objectType);
    }

    if (filters?.emailType) {
      query = query.eq('email_type', filters.emailType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data } = await query;

    return (data || []).map(this.mapGeneration);
  }

  /**
   * Build prompt from context
   */
  private buildPrompt(request: AIEmailGenerationRequest, context: any): string {
    let prompt = '';

    if (request.userPrompt) {
      return request.userPrompt;
    }

    // Build context-aware prompt
    switch (request.objectType) {
      case 'prospect':
        prompt = this.buildProspectPrompt(request, context);
        break;
      case 'deal':
        prompt = this.buildDealPrompt(request, context);
        break;
      case 'ticket':
        prompt = this.buildTicketPrompt(request, context);
        break;
      case 'account':
        prompt = this.buildAccountPrompt(request, context);
        break;
    }

    if (request.additionalContext) {
      prompt += `\n\nAdditional Context: ${request.additionalContext}`;
    }

    return prompt;
  }

  /**
   * Build prospect email prompt
   */
  private buildProspectPrompt(request: AIEmailGenerationRequest, prospect: any): string {
    const recentActivity = prospect.activities?.slice(0, 3)
      .map((a: any) => `- ${a.type}: ${a.description}`)
      .join('\n') || 'No recent activity';

    return `Write a ${request.emailType.replace('_', ' ')} email to a prospect with the following details:

Name: ${prospect.first_name} ${prospect.last_name}
Company: ${prospect.company || 'Unknown'}
Job Title: ${prospect.job_title || 'Unknown'}
Industry: ${prospect.industry || 'Unknown'}
Lead Score: ${prospect.lead_score || 0}/100
Lead Source: ${prospect.lead_source || 'Unknown'}

Recent Activity:
${recentActivity}

${prospect.notes ? `Notes: ${prospect.notes}` : ''}

Email Type: ${request.emailType.replace('_', ' ')}
Tone: ${request.tone}

Generate a personalized email that references their specific situation and provides clear value.`;
  }

  /**
   * Build deal email prompt
   */
  private buildDealPrompt(request: AIEmailGenerationRequest, deal: any): string {
    return `Write a ${request.emailType.replace('_', ' ')} email for a sales deal:

Deal: ${deal.name}
Stage: ${deal.stage}
Amount: $${deal.amount?.toLocaleString() || 0}
Probability: ${deal.probability || 0}%
Expected Close: ${deal.expected_close_date || 'Not set'}

Contact: ${deal.prospect?.first_name} ${deal.prospect?.last_name}
Company: ${deal.account?.name || 'Unknown'}

Deal Notes: ${deal.notes || 'None'}

Email Type: ${request.emailType.replace('_', ' ')}
Tone: ${request.tone}

Write a professional email that moves the deal forward.`;
  }

  /**
   * Build ticket email prompt
   */
  private buildTicketPrompt(request: AIEmailGenerationRequest, ticket: any): string {
    const conversation = ticket.ticket_replies?.slice(0, 5)
      .map((r: any) => `${r.author_type === 'customer' ? 'Customer' : 'Agent'}: ${r.content}`)
      .join('\n\n') || 'No conversation yet';

    return `Write a ${request.emailType.replace('_', ' ')} for a support ticket:

Ticket #${ticket.ticket_number}
Subject: ${ticket.subject}
Priority: ${ticket.priority}
Status: ${ticket.status}

Customer: ${ticket.customer_name}
Email: ${ticket.customer_email}

Conversation:
${conversation}

Email Type: ${request.emailType.replace('_', ' ')}
Tone: ${request.tone}

Provide a helpful, professional response that resolves or progresses the ticket.`;
  }

  /**
   * Build account email prompt
   */
  private buildAccountPrompt(request: AIEmailGenerationRequest, account: any): string {
    return `Write a ${request.emailType.replace('_', ' ')} email to an account:

Company: ${account.name}
Industry: ${account.industry || 'Unknown'}
Employees: ${account.employee_count || 'Unknown'}
Revenue: ${account.annual_revenue ? '$' + account.annual_revenue.toLocaleString() : 'Unknown'}

Account Status: ${account.status || 'Active'}
Owner: ${account.owner?.name || 'Unassigned'}

Recent Deals: ${account.open_deals_count || 0} open, ${account.closed_deals_count || 0} closed

Email Type: ${request.emailType.replace('_', ' ')}
Tone: ${request.tone}

Write a strategic email appropriate for this account.`;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(tone: string, emailType: string): string {
    const toneInstructions = {
      professional: 'Write in a professional, business-appropriate tone. Be clear, concise, and respectful.',
      casual: 'Write in a casual, friendly tone. Be conversational but still professional.',
      persuasive: 'Write persuasively. Use compelling language and focus on benefits and value.',
      friendly: 'Write in a warm, friendly tone. Be personable and approachable.',
      urgent: 'Write with urgency. Be direct and emphasize time-sensitivity.'
    };

    return `You are an expert email writer for a CRM platform. Your task is to write ${emailType.replace('_', ' ')} emails that are effective, personalized, and drive results.

${toneInstructions[tone as keyof typeof toneInstructions]}

IMPORTANT FORMAT:
Return ONLY the email in this exact format:

Subject: [Your subject line here]

[Email body here]

Do NOT include greetings like "Subject:" labels or any explanatory text before or after the email. Just the subject line and body.

Keep emails concise (under 200 words unless more detail is specifically needed).
Always include a clear call-to-action.
Personalize based on the provided context.
Avoid generic templates - make it specific to the recipient.`;
  }

  /**
   * Parse email content from GPT response
   */
  private parseEmailContent(content: string): { subject: string; body: string } {
    const lines = content.trim().split('\n');
    let subject = '';
    let body = '';

    // Find subject line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().startsWith('subject:')) {
        subject = lines[i].substring(8).trim();
        // Body starts after subject
        body = lines.slice(i + 1).join('\n').trim();
        break;
      }
    }

    // If no subject found, use first line as subject
    if (!subject && lines.length > 0) {
      subject = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
    }

    return {
      subject: subject || 'No subject',
      body: body || content
    };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(completion: any, context: any): number {
    let confidence = 85; // Base confidence

    // Adjust based on finish reason
    if (completion.choices[0].finish_reason === 'stop') {
      confidence += 10;
    }

    // Adjust based on context completeness
    if (context.first_name && context.last_name) confidence += 5;
    if (context.company) confidence += 5;
    if (context.job_title) confidence += 5;

    return Math.min(100, confidence);
  }

  /**
   * Get context data
   */
  private async getContextData(objectType: string, objectId: string): Promise<any> {
    const tableMap: Record<string, string> = {
      prospect: 'prospects',
      deal: 'deals',
      ticket: 'tickets',
      account: 'accounts'
    };

    const table = tableMap[objectType];

    if (!table) return {};

    let query = supabase.from(table).select('*').eq('id', objectId);

    // Add related data
    if (objectType === 'prospect') {
      query = supabase
        .from(table)
        .select('*, activities(type, description, created_at)')
        .eq('id', objectId);
    } else if (objectType === 'deal') {
      query = supabase
        .from(table)
        .select('*, prospect:prospects(*), account:accounts(*)')
        .eq('id', objectId);
    } else if (objectType === 'ticket') {
      query = supabase
        .from(table)
        .select('*, ticket_replies(*)')
        .eq('id', objectId);
    }

    const { data } = await query.single();

    return data || {};
  }

  /**
   * Check usage limits
   */
  private async checkUsageLimits(organizationId: string): Promise<void> {
    const stats = await this.getUsageStats(organizationId);

    if (stats.creditsRemaining <= 0) {
      throw new Error('AI credits exhausted. Please upgrade your plan.');
    }
  }

  /**
   * Track usage
   */
  private async trackUsage(
    organizationId: string,
    userId: string,
    tokensUsed: number,
    cost: number
  ): Promise<void> {
    const currentMonth = new Date().toISOString().substring(0, 7);

    // Upsert usage record
    const { data: existing } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('month', currentMonth)
      .single();

    if (existing) {
      await supabase
        .from('ai_usage')
        .update({
          emails_generated: existing.emails_generated + 1,
          tokens_used: existing.tokens_used + tokensUsed,
          total_cost: existing.total_cost + cost,
          credits_remaining: Math.max(0, existing.credits_remaining - 1)
        })
        .eq('organization_id', organizationId)
        .eq('month', currentMonth);
    } else {
      await supabase
        .from('ai_usage')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          month: currentMonth,
          emails_generated: 1,
          tokens_used: tokensUsed,
          total_cost: cost,
          credits_remaining: 999 // 1000 - 1
        });
    }
  }

  /**
   * Calculate edit distance (Levenshtein)
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);

    return maxLength > 0 ? Math.round((distance / maxLength) * 100) : 0;
  }

  /**
   * Map database record to AIEmailGeneration
   */
  private mapGeneration(data: any): AIEmailGeneration {
    return {
      id: data.id,
      userId: data.user_id,
      organizationId: data.organization_id,
      objectType: data.object_type,
      objectId: data.object_id,
      emailType: data.email_type,
      tone: data.tone,
      additionalContext: data.additional_context,
      userPrompt: data.user_prompt,
      generatedSubject: data.generated_subject,
      generatedBody: data.generated_body,
      confidence: data.confidence,
      model: data.model,
      tokensUsed: data.tokens_used,
      wasEdited: data.was_edited,
      finalSubject: data.final_subject,
      finalBody: data.final_body,
      editDistance: data.edit_distance,
      wasSent: data.was_sent,
      openRate: data.open_rate,
      clickRate: data.click_rate,
      replyRate: data.reply_rate,
      cost: data.cost,
      createdAt: new Date(data.created_at),
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined
    };
  }
}

/**
 * Create AI Email Assistant Service
 */
export function createAIEmailAssistantService(): AIEmailAssistantService {
  return new AIEmailAssistantService();
}
