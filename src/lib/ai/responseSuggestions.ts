/**
 * AI Response Suggestions
 * Generates intelligent reply suggestions for incoming emails
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

export interface ResponseSuggestionRequest {
  prospectId: string;
  incomingEmail: {
    subject: string;
    body: string;
    from: string;
    receivedAt: Date;
  };
  conversationHistory?: Array<{
    direction: 'inbound' | 'outbound';
    subject: string;
    body: string;
    sentAt: Date;
  }>;
  intent?: 'respond' | 'schedule_meeting' | 'send_info' | 'close_deal' | 'handle_objection';
}

export interface ResponseSuggestion {
  id: string;
  type: 'quick_reply' | 'detailed_response' | 'meeting_request' | 'follow_up';
  subject: string;
  body: string;
  confidence: number;
  reasoning: string;
  suggestedActions?: Array<{
    type: 'schedule_meeting' | 'send_document' | 'create_task' | 'update_stage';
    description: string;
  }>;
}

export interface EmailIntent {
  primary: 'question' | 'objection' | 'interest' | 'meeting_request' | 'pricing_inquiry' | 'out_of_office' | 'other';
  secondary?: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'low' | 'medium' | 'high';
  requiresResponse: boolean;
  suggestedResponseTime: 'immediate' | 'within_hours' | 'within_day' | 'no_rush';
}

/**
 * AI Response Suggestions Service
 */
export class AIResponseSuggestions {
  private openai: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate response suggestions for an incoming email
   */
  async generateSuggestions(request: ResponseSuggestionRequest): Promise<ResponseSuggestion[]> {
    // Get prospect data
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, accounts (*)')
      .eq('id', request.prospectId)
      .single();

    if (!prospect) {
      throw new Error('Prospect not found');
    }

    // Analyze email intent first
    const intent = await this.analyzeIntent(request.incomingEmail.body);

    // Generate suggestions based on intent
    const systemPrompt = this.buildSystemPromptForSuggestions(intent);
    const userPrompt = this.buildUserPromptForSuggestions(request, prospect, intent);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const suggestions = this.parseSuggestions(completion.choices[0].message.content || '');

    // Log suggestions
    await this.logSuggestions(request.prospectId, request.incomingEmail.subject, suggestions);

    return suggestions;
  }

  /**
   * Analyze email intent
   */
  async analyzeIntent(emailBody: string): Promise<EmailIntent> {
    const systemPrompt = `You are an expert at analyzing email intent and sentiment in sales conversations. Analyze the email and determine the primary intent, sentiment, urgency, and whether it requires a response.`;

    const userPrompt = `
Analyze this email:

${emailBody}

Provide your analysis in JSON format:
{
  "primary": "question|objection|interest|meeting_request|pricing_inquiry|out_of_office|other",
  "secondary": ["array", "of", "secondary", "intents"],
  "sentiment": "positive|neutral|negative",
  "urgency": "low|medium|high",
  "requiresResponse": true|false,
  "suggestedResponseTime": "immediate|within_hours|within_day|no_rush"
}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      // Fallback intent
      return {
        primary: 'other',
        sentiment: 'neutral',
        urgency: 'medium',
        requiresResponse: true,
        suggestedResponseTime: 'within_hours'
      };
    }
  }

  /**
   * Generate quick replies (1-2 sentences)
   */
  async generateQuickReplies(
    emailBody: string,
    count: number = 3
  ): Promise<string[]> {
    const systemPrompt = 'You are an expert at writing concise, professional quick replies to emails. Each reply should be 1-2 sentences maximum.';

    const userPrompt = `
Generate ${count} quick reply options for this email:

${emailBody}

Each reply should:
1. Be 1-2 sentences maximum
2. Acknowledge the email
3. Provide a brief response or next step
4. Be professional but friendly

Format as numbered list.
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const content = completion.choices[0].message.content || '';
    return this.parseQuickReplies(content);
  }

  /**
   * Handle objections with AI
   */
  async handleObjection(
    objection: string,
    context?: {
      productName?: string;
      pricing?: string;
      competitorMentioned?: string;
    }
  ): Promise<ResponseSuggestion[]> {
    const systemPrompt = `You are an expert sales professional skilled at handling objections. Provide thoughtful, empathetic responses that acknowledge concerns and provide value.`;

    const userPrompt = `
Prospect raised this objection:
"${objection}"

${context ? `Context:
${context.productName ? `Product: ${context.productName}` : ''}
${context.pricing ? `Pricing: ${context.pricing}` : ''}
${context.competitorMentioned ? `Competitor mentioned: ${context.competitorMentioned}` : ''}
` : ''}

Generate 3 different approaches to handle this objection. For each approach, provide:
1. A brief description of the strategy
2. The email response

Format as:
APPROACH 1: [strategy description]
SUBJECT: [subject line]
BODY:
[response]

APPROACH 2: ...
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return this.parseObjectionResponses(completion.choices[0].message.content || '');
  }

  /**
   * Suggest next best action
   */
  async suggestNextAction(
    prospectId: string,
    conversationHistory: Array<{ direction: string; body: string; sentAt: Date }>
  ): Promise<{
    action: string;
    reasoning: string;
    suggestedEmail?: { subject: string; body: string };
  }> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, accounts (*)')
      .eq('id', prospectId)
      .single();

    const systemPrompt = 'You are an expert sales strategist. Analyze the conversation and suggest the next best action to move the deal forward.';

    const userPrompt = `
Prospect: ${prospect?.first_name} ${prospect?.last_name} at ${prospect?.company}
Stage: ${prospect?.stage || 'Unknown'}

Conversation History:
${conversationHistory.map(msg => `[${msg.direction}] ${msg.body.substring(0, 200)}...`).join('\n\n')}

Based on this conversation, what should be the next best action? Consider:
1. Where the prospect is in the buying journey
2. Any signals of interest or concern
3. Timing and momentum
4. Missing information or next logical step

Provide your recommendation in JSON format:
{
  "action": "send_follow_up|schedule_meeting|send_proposal|provide_demo|share_case_study|other",
  "reasoning": "Explanation of why this is the best next step",
  "suggestedEmail": {
    "subject": "Subject line",
    "body": "Email body"
  }
}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      return {
        action: 'send_follow_up',
        reasoning: 'Continue the conversation'
      };
    }
  }

  /**
   * Build system prompt for suggestions
   */
  private buildSystemPromptForSuggestions(intent: EmailIntent): string {
    const intentGuidance = {
      question: 'The prospect has asked a question. Provide clear, helpful answers.',
      objection: 'The prospect has raised an objection. Acknowledge their concern and provide value.',
      interest: 'The prospect is showing interest. Move the conversation forward.',
      meeting_request: 'The prospect wants to meet. Make it easy to schedule.',
      pricing_inquiry: 'The prospect is asking about pricing. Frame the value, not just the cost.',
      out_of_office: 'Prospect is out of office. Suggest a polite acknowledgment or wait.',
      other: 'Provide helpful, professional response options.'
    };

    return `You are an expert B2B sales professional generating email response suggestions.

Email Intent: ${intent.primary}
${intentGuidance[intent.primary as keyof typeof intentGuidance] || intentGuidance.other}

Sentiment: ${intent.sentiment}
Urgency: ${intent.urgency}

Generate 3 different response suggestions:
1. Quick Reply - Brief, acknowledges receipt, sets expectations
2. Detailed Response - Thorough answer, addresses all points
3. Strategic Response - Moves conversation forward with specific ask

For each suggestion, provide:
- Type (quick_reply, detailed_response, meeting_request, follow_up)
- Subject line
- Email body
- Confidence level (0-100)
- Reasoning for this approach
- Suggested follow-up actions

Format as:
SUGGESTION 1:
TYPE: [type]
CONFIDENCE: [0-100]
SUBJECT: [subject]
BODY:
[body]
REASONING: [why this approach works]
ACTIONS: [action1, action2]

SUGGESTION 2:
...
`;
  }

  /**
   * Build user prompt for suggestions
   */
  private buildUserPromptForSuggestions(
    request: ResponseSuggestionRequest,
    prospect: any,
    intent: EmailIntent
  ): string {
    let prompt = `Prospect Information:
- Name: ${prospect.first_name} ${prospect.last_name}
- Title: ${prospect.title || 'Unknown'}
- Company: ${prospect.company || 'Unknown'}
- Stage: ${prospect.stage || 'Unknown'}

Incoming Email:
Subject: ${request.incomingEmail.subject}
Body:
${request.incomingEmail.body}
`;

    if (request.conversationHistory && request.conversationHistory.length > 0) {
      prompt += `\n\nConversation History (most recent first):\n`;
      request.conversationHistory.slice(0, 5).forEach((email, index) => {
        prompt += `\n${index + 1}. [${email.direction}] ${email.subject}\n${email.body.substring(0, 200)}...\n`;
      });
    }

    if (request.intent) {
      prompt += `\n\nDesired Intent: ${request.intent}`;
    }

    return prompt;
  }

  /**
   * Parse suggestions from completion
   */
  private parseSuggestions(content: string): ResponseSuggestion[] {
    const suggestions: ResponseSuggestion[] = [];

    const suggestionRegex = /SUGGESTION \d+:\s*TYPE:\s*(.+?)\s*CONFIDENCE:\s*(\d+)\s*SUBJECT:\s*(.+?)\s*BODY:\s*([\s\S]+?)\s*REASONING:\s*(.+?)\s*(?:ACTIONS:\s*(.+?))?(?=SUGGESTION \d+:|$)/gi;
    let match;
    let id = 1;

    while ((match = suggestionRegex.exec(content)) !== null) {
      const type = match[1].trim() as ResponseSuggestion['type'];
      const confidence = parseInt(match[2]);
      const subject = match[3].trim();
      const body = match[4].trim();
      const reasoning = match[5].trim();
      const actions = match[6]?.trim();

      suggestions.push({
        id: `suggestion_${id++}`,
        type,
        subject,
        body,
        confidence,
        reasoning,
        suggestedActions: actions ? this.parseActions(actions) : undefined
      });
    }

    return suggestions;
  }

  /**
   * Parse actions
   */
  private parseActions(actionsStr: string): Array<{
    type: 'schedule_meeting' | 'send_document' | 'create_task' | 'update_stage';
    description: string;
  }> {
    const actions: Array<{ type: any; description: string }> = [];
    const parts = actionsStr.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.toLowerCase().includes('meeting') || part.toLowerCase().includes('schedule')) {
        actions.push({ type: 'schedule_meeting', description: part });
      } else if (part.toLowerCase().includes('document') || part.toLowerCase().includes('send')) {
        actions.push({ type: 'send_document', description: part });
      } else if (part.toLowerCase().includes('task') || part.toLowerCase().includes('reminder')) {
        actions.push({ type: 'create_task', description: part });
      } else if (part.toLowerCase().includes('stage') || part.toLowerCase().includes('update')) {
        actions.push({ type: 'update_stage', description: part });
      }
    }

    return actions;
  }

  /**
   * Parse quick replies
   */
  private parseQuickReplies(content: string): string[] {
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      return line.replace(/^\d+\.\s*/, '').trim();
    }).filter(line => line.length > 0);
  }

  /**
   * Parse objection responses
   */
  private parseObjectionResponses(content: string): ResponseSuggestion[] {
    const suggestions: ResponseSuggestion[] = [];

    const approachRegex = /APPROACH \d+:\s*(.+?)\s*SUBJECT:\s*(.+?)\s*BODY:\s*([\s\S]+?)(?=APPROACH \d+:|$)/gi;
    let match;
    let id = 1;

    while ((match = approachRegex.exec(content)) !== null) {
      suggestions.push({
        id: `objection_${id++}`,
        type: 'detailed_response',
        subject: match[2].trim(),
        body: match[3].trim(),
        confidence: 80,
        reasoning: match[1].trim()
      });
    }

    return suggestions;
  }

  /**
   * Log suggestions
   */
  private async logSuggestions(
    prospectId: string,
    emailSubject: string,
    suggestions: ResponseSuggestion[]
  ): Promise<void> {
    await supabase.from('ai_response_suggestions').insert({
      prospect_id: prospectId,
      email_subject: emailSubject,
      suggestions: JSON.stringify(suggestions),
      generated_at: new Date().toISOString()
    });
  }
}

/**
 * Create AI Response Suggestions
 */
export function createAIResponseSuggestions(apiKey?: string): AIResponseSuggestions {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new AIResponseSuggestions(key);
}
