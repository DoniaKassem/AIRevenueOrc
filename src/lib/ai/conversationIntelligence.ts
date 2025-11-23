/**
 * Conversation Intelligence & Sentiment Analysis
 * AI-powered analysis of conversations, sentiment, and communication patterns
 */

import OpenAI from 'openai';
import { supabase } from '../supabase';

export interface SentimentAnalysisResult {
  score: number; // -1 (very negative) to 1 (very positive)
  label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
  confidence: number; // 0-100
  emotions: Array<{
    emotion: 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';
    intensity: number; // 0-100
  }>;
  keyPhrases: string[];
  tone: 'formal' | 'casual' | 'urgent' | 'friendly' | 'professional' | 'frustrated';
}

export interface ConversationInsights {
  prospectId: string;
  conversationId: string;
  summary: string;
  keyTopics: Array<{
    topic: string;
    mentions: number;
    sentiment: number;
  }>;
  buyingSignals: Array<{
    signal: string;
    strength: 'strong' | 'moderate' | 'weak';
    timestamp: Date;
    context: string;
  }>;
  objections: Array<{
    objection: string;
    type: 'price' | 'timing' | 'authority' | 'need' | 'competitor' | 'other';
    addressed: boolean;
    response?: string;
  }>;
  questions: Array<{
    question: string;
    answered: boolean;
    importance: 'high' | 'medium' | 'low';
  }>;
  nextSteps: string[];
  overallSentiment: SentimentAnalysisResult;
  engagementScore: number; // 0-100
  dealMomentum: 'accelerating' | 'steady' | 'slowing' | 'stalled';
}

export interface CallTranscriptionAnalysis {
  transcriptId: string;
  duration: number; // seconds
  speakerStats: {
    [speaker: string]: {
      talkTime: number; // seconds
      talkRatio: number; // percentage
      averagePause: number; // seconds
      interruptionCount: number;
    };
  };
  keyMoments: Array<{
    timestamp: number; // seconds from start
    type: 'buying_signal' | 'objection' | 'question' | 'commitment' | 'concern';
    content: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  actionItems: Array<{
    assignedTo: string;
    action: string;
    deadline?: Date;
  }>;
  coachingInsights: Array<{
    category: 'questioning' | 'listening' | 'objection_handling' | 'closing' | 'rapport';
    feedback: string;
    score: number; // 0-100
  }>;
}

/**
 * Conversation Intelligence Service
 */
export class ConversationIntelligence {
  private openai: OpenAI;
  private model: string = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    const systemPrompt = 'You are an expert at analyzing sentiment and emotions in business communications. Provide detailed sentiment analysis.';

    const userPrompt = `
Analyze the sentiment of this text:

"${text}"

Provide analysis in JSON format:
{
  "score": -1.0 to 1.0,
  "label": "very_negative|negative|neutral|positive|very_positive",
  "confidence": 0-100,
  "emotions": [
    {"emotion": "joy|trust|fear|surprise|sadness|disgust|anger|anticipation", "intensity": 0-100}
  ],
  "keyPhrases": ["array", "of", "important", "phrases"],
  "tone": "formal|casual|urgent|friendly|professional|frustrated"
}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    try {
      return JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      return {
        score: 0,
        label: 'neutral',
        confidence: 50,
        emotions: [],
        keyPhrases: [],
        tone: 'professional'
      };
    }
  }

  /**
   * Analyze entire conversation
   */
  async analyzeConversation(prospectId: string): Promise<ConversationInsights> {
    // Get conversation history
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .in('activity_type', ['email', 'call', 'meeting'])
      .order('created_at', { ascending: true });

    if (!activities || activities.length === 0) {
      throw new Error('No conversation history found');
    }

    // Build conversation text
    const conversationText = activities.map(a => {
      const direction = a.direction === 'inbound' ? 'Prospect' : 'Rep';
      const content = a.body || a.notes || a.subject || '';
      return `[${direction}] ${content}`;
    }).join('\n\n');

    // Analyze with AI
    const systemPrompt = `You are an expert sales conversation analyst. Analyze the conversation and extract key insights, buying signals, objections, questions, and recommendations.`;

    const userPrompt = `
Analyze this sales conversation:

${conversationText}

Provide comprehensive analysis in JSON format:
{
  "summary": "2-3 sentence summary of the conversation",
  "keyTopics": [
    {"topic": "topic name", "mentions": count, "sentiment": -1 to 1}
  ],
  "buyingSignals": [
    {"signal": "description", "strength": "strong|moderate|weak", "context": "relevant quote"}
  ],
  "objections": [
    {"objection": "description", "type": "price|timing|authority|need|competitor|other", "addressed": true|false}
  ],
  "questions": [
    {"question": "the question", "answered": true|false, "importance": "high|medium|low"}
  ],
  "nextSteps": ["array", "of", "recommended", "next", "steps"],
  "engagementScore": 0-100,
  "dealMomentum": "accelerating|steady|slowing|stalled"
}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    let analysis: any = {};
    try {
      analysis = JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      analysis = { summary: 'Analysis unavailable' };
    }

    // Analyze overall sentiment
    const overallSentiment = await this.analyzeSentiment(conversationText);

    const insights: ConversationInsights = {
      prospectId,
      conversationId: `conv_${Date.now()}`,
      summary: analysis.summary || 'No summary available',
      keyTopics: analysis.keyTopics || [],
      buyingSignals: analysis.buyingSignals?.map((s: any) => ({
        ...s,
        timestamp: new Date()
      })) || [],
      objections: analysis.objections || [],
      questions: analysis.questions || [],
      nextSteps: analysis.nextSteps || [],
      overallSentiment,
      engagementScore: analysis.engagementScore || 50,
      dealMomentum: analysis.dealMomentum || 'steady'
    };

    // Save insights
    await this.saveConversationInsights(insights);

    return insights;
  }

  /**
   * Analyze call transcription
   */
  async analyzeCallTranscription(
    transcriptId: string,
    transcript: string,
    speakers: { [speaker: string]: string[] } // speaker -> array of their statements
  ): Promise<CallTranscriptionAnalysis> {
    // Calculate speaker stats
    const speakerStats: any = {};
    let totalWords = 0;

    for (const [speaker, statements] of Object.entries(speakers)) {
      const words = statements.join(' ').split(/\s+/).length;
      totalWords += words;

      speakerStats[speaker] = {
        talkTime: words * 0.4, // Rough estimate: 150 words/minute
        talkRatio: 0, // Will calculate after totalWords is known
        averagePause: 2.0, // Placeholder
        interruptionCount: 0 // Placeholder
      };
    }

    // Calculate talk ratios
    for (const speaker in speakerStats) {
      speakerStats[speaker].talkRatio = (speakerStats[speaker].talkTime / totalWords) * 100;
    }

    // Analyze with AI
    const systemPrompt = `You are an expert sales call analyst. Analyze this call transcription and extract key moments, action items, and coaching insights.`;

    const userPrompt = `
Analyze this sales call transcription:

${transcript}

Provide analysis in JSON format:
{
  "keyMoments": [
    {"timestamp": seconds, "type": "buying_signal|objection|question|commitment|concern", "content": "what was said", "importance": "high|medium|low"}
  ],
  "actionItems": [
    {"assignedTo": "person", "action": "description", "deadline": "YYYY-MM-DD or null"}
  ],
  "coachingInsights": [
    {"category": "questioning|listening|objection_handling|closing|rapport", "feedback": "specific feedback", "score": 0-100}
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
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    let analysis: any = {};
    try {
      analysis = JSON.parse(completion.choices[0].message.content || '{}');
    } catch (error) {
      analysis = {};
    }

    const result: CallTranscriptionAnalysis = {
      transcriptId,
      duration: Math.floor(totalWords * 0.4), // Rough estimate
      speakerStats,
      keyMoments: analysis.keyMoments || [],
      actionItems: analysis.actionItems?.map((item: any) => ({
        ...item,
        deadline: item.deadline ? new Date(item.deadline) : undefined
      })) || [],
      coachingInsights: analysis.coachingInsights || []
    };

    // Save analysis
    await this.saveCallAnalysis(result);

    return result;
  }

  /**
   * Extract action items from text
   */
  async extractActionItems(text: string): Promise<Array<{
    action: string;
    assignee?: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
  }>> {
    const systemPrompt = 'You are an expert at extracting action items and tasks from business communications.';

    const userPrompt = `
Extract action items from this text:

"${text}"

Provide as JSON array:
[
  {
    "action": "clear description of the action",
    "assignee": "person responsible or null",
    "priority": "high|medium|low",
    "dueDate": "YYYY-MM-DD or null"
  }
]
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return (result.actionItems || result || []).map((item: any) => ({
        ...item,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Detect buying signals
   */
  async detectBuyingSignals(text: string): Promise<Array<{
    signal: string;
    type: 'explicit' | 'implicit';
    strength: 'strong' | 'moderate' | 'weak';
    quote: string;
  }>> {
    const systemPrompt = 'You are an expert at detecting buying signals in sales conversations. Identify both explicit and implicit signals.';

    const userPrompt = `
Detect buying signals in this text:

"${text}"

Provide as JSON:
{
  "signals": [
    {
      "signal": "description of the signal",
      "type": "explicit|implicit",
      "strength": "strong|moderate|weak",
      "quote": "exact quote showing the signal"
    }
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
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.signals || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Identify objections
   */
  async identifyObjections(text: string): Promise<Array<{
    objection: string;
    type: 'price' | 'timing' | 'authority' | 'need' | 'competitor' | 'other';
    severity: 'high' | 'medium' | 'low';
    suggestedResponse: string;
  }>> {
    const systemPrompt = 'You are an expert at identifying objections in sales conversations and suggesting responses.';

    const userPrompt = `
Identify objections in this text:

"${text}"

Provide as JSON:
{
  "objections": [
    {
      "objection": "the objection raised",
      "type": "price|timing|authority|need|competitor|other",
      "severity": "high|medium|low",
      "suggestedResponse": "how to address this objection"
    }
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
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result.objections || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate conversation summary
   */
  async generateSummary(
    activities: Array<{ direction: string; body?: string; notes?: string; subject?: string }>
  ): Promise<string> {
    const conversationText = activities.map(a => {
      const direction = a.direction === 'inbound' ? 'Prospect' : 'Rep';
      const content = a.body || a.notes || a.subject || '';
      return `[${direction}] ${content}`;
    }).join('\n\n');

    const systemPrompt = 'You are an expert at summarizing sales conversations concisely.';

    const userPrompt = `
Summarize this conversation in 2-3 sentences, highlighting the key points, current status, and next steps:

${conversationText}
`;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    return completion.choices[0].message.content || 'Summary unavailable';
  }

  /**
   * Analyze communication patterns over time
   */
  async analyzeCommunicationPatterns(prospectId: string): Promise<{
    responseTimeAvg: number; // hours
    responseTimeMedian: number; // hours
    emailFrequency: number; // per week
    preferredChannel: 'email' | 'phone' | 'meeting';
    preferredTime: string; // e.g., "9am-11am EST"
    engagementTrend: 'increasing' | 'stable' | 'decreasing';
  }> {
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: true });

    if (!activities || activities.length === 0) {
      throw new Error('No activity history found');
    }

    // Calculate response times
    const responseTimes: number[] = [];
    for (let i = 0; i < activities.length - 1; i++) {
      if (activities[i].direction === 'outbound' && activities[i + 1].direction === 'inbound') {
        const diff = new Date(activities[i + 1].created_at).getTime() - new Date(activities[i].created_at).getTime();
        responseTimes.push(diff / (1000 * 60 * 60)); // Convert to hours
      }
    }

    const responseTimeAvg = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const responseTimeMedian = responseTimes.length > 0
      ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)]
      : 0;

    // Email frequency (emails per week)
    const firstActivity = new Date(activities[0].created_at);
    const lastActivity = new Date(activities[activities.length - 1].created_at);
    const weeks = (lastActivity.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24 * 7);
    const emailFrequency = activities.filter(a => a.activity_type === 'email').length / Math.max(weeks, 1);

    // Preferred channel
    const channelCounts: Record<string, number> = {};
    activities.forEach(a => {
      channelCounts[a.activity_type] = (channelCounts[a.activity_type] || 0) + 1;
    });
    const preferredChannel = Object.keys(channelCounts).reduce((a, b) =>
      channelCounts[a] > channelCounts[b] ? a : b
    ) as 'email' | 'phone' | 'meeting';

    // Engagement trend (based on activity frequency in first half vs second half)
    const midpoint = Math.floor(activities.length / 2);
    const firstHalf = activities.slice(0, midpoint);
    const secondHalf = activities.slice(midpoint);

    const firstHalfDays = (new Date(firstHalf[firstHalf.length - 1].created_at).getTime() -
      new Date(firstHalf[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    const secondHalfDays = (new Date(secondHalf[secondHalf.length - 1].created_at).getTime() -
      new Date(secondHalf[0].created_at).getTime()) / (1000 * 60 * 60 * 24);

    const firstHalfFreq = firstHalf.length / Math.max(firstHalfDays, 1);
    const secondHalfFreq = secondHalf.length / Math.max(secondHalfDays, 1);

    let engagementTrend: 'increasing' | 'stable' | 'decreasing';
    if (secondHalfFreq > firstHalfFreq * 1.2) engagementTrend = 'increasing';
    else if (secondHalfFreq < firstHalfFreq * 0.8) engagementTrend = 'decreasing';
    else engagementTrend = 'stable';

    return {
      responseTimeAvg,
      responseTimeMedian,
      emailFrequency,
      preferredChannel,
      preferredTime: '9am-11am EST', // Would need timestamp analysis
      engagementTrend
    };
  }

  /**
   * Save conversation insights
   */
  private async saveConversationInsights(insights: ConversationInsights): Promise<void> {
    await supabase.from('ai_conversation_insights').insert({
      prospect_id: insights.prospectId,
      conversation_id: insights.conversationId,
      summary: insights.summary,
      key_topics: JSON.stringify(insights.keyTopics),
      buying_signals: JSON.stringify(insights.buyingSignals),
      objections: JSON.stringify(insights.objections),
      questions: JSON.stringify(insights.questions),
      next_steps: JSON.stringify(insights.nextSteps),
      overall_sentiment: JSON.stringify(insights.overallSentiment),
      engagement_score: insights.engagementScore,
      deal_momentum: insights.dealMomentum,
      analyzed_at: new Date().toISOString()
    });
  }

  /**
   * Save call analysis
   */
  private async saveCallAnalysis(analysis: CallTranscriptionAnalysis): Promise<void> {
    await supabase.from('ai_call_analysis').insert({
      transcript_id: analysis.transcriptId,
      duration: analysis.duration,
      speaker_stats: JSON.stringify(analysis.speakerStats),
      key_moments: JSON.stringify(analysis.keyMoments),
      action_items: JSON.stringify(analysis.actionItems),
      coaching_insights: JSON.stringify(analysis.coachingInsights),
      analyzed_at: new Date().toISOString()
    });
  }
}

/**
 * Create Conversation Intelligence
 */
export function createConversationIntelligence(apiKey?: string): ConversationIntelligence {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured');
  }
  return new ConversationIntelligence(key);
}
