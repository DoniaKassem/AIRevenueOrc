/**
 * Reply Classification System
 * Analyzes incoming prospect emails to classify intent, sentiment, and extract key information
 */

import { routeAIRequest } from '../ai/modelRouter';

export interface ReplyClassification {
  // Primary classification
  category:
    | 'positive_interest'      // "Tell me more", "Interested", "Let's chat"
    | 'objection'              // Price, timing, competition, no need
    | 'question'               // Specific information request
    | 'meeting_request'        // Wants to schedule a meeting
    | 'out_of_office'          // Auto-reply OOO
    | 'not_interested'         // "Not interested", "Remove me"
    | 'wrong_person'           // "I'm not the right person"
    | 'unsubscribe'            // Unsubscribe request
    | 'neutral'                // Generic response
    | 'unclear';               // Can't determine intent

  // Sentiment analysis
  sentiment: {
    score: number;           // -1.0 (very negative) to 1.0 (very positive)
    label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';
    confidence: number;      // 0-1
  };

  // Intent signals
  intents: Array<{
    type: 'demo_request' | 'pricing_inquiry' | 'meeting_request' | 'technical_question'
          | 'competitor_mention' | 'timeline_discussion' | 'budget_discussion';
    confidence: number;
    evidence: string;        // Quote from email that indicates this intent
  }>;

  // Objection details (if category is 'objection')
  objection?: {
    type: 'price' | 'timing' | 'competition' | 'no_need' | 'decision_maker' | 'other';
    severity: 'soft' | 'medium' | 'hard';
    specificConcern: string;
  };

  // Extracted entities
  entities: {
    mentionedCompetitors: string[];
    mentionedTimeline: string | null;  // "next quarter", "in 6 months"
    mentionedBudget: string | null;     // "$50k", "limited budget"
    mentionedPeople: string[];          // Other people mentioned
    urgency: 'low' | 'medium' | 'high';
  };

  // Suggested next action
  suggestedAction: {
    action: 'send_info' | 'schedule_meeting' | 'handle_objection' | 'nurture'
            | 'escalate_to_human' | 'remove_from_sequence' | 'send_case_study' | 'send_pricing';
    reasoning: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    suggestedResponse?: string;  // AI-generated suggested reply
  };

  // Metadata
  requiresHumanReview: boolean;
  confidence: number;              // Overall confidence in classification (0-1)
  processingTime: number;          // ms
}

/**
 * Keywords and patterns for classification
 */
const CLASSIFICATION_PATTERNS = {
  positive_interest: [
    /\b(interested|tell me more|sounds good|looks interesting|curious|intrigued)\b/i,
    /\b(would like to|want to|keen to|happy to|open to|willing to)\b/i,
    /\b(learn more|find out more|hear more|see more)\b/i,
    /\b(yes|sure|okay|ok|absolutely|definitely)\b/i,
  ],

  objection: [
    /\b(too expensive|too costly|can't afford|budget|price|cost concerns)\b/i,
    /\b(not now|bad timing|maybe later|revisit|not ready|too busy)\b/i,
    /\b(already using|current solution|happy with|competitor|alternative)\b/i,
    /\b(not a priority|not interested|don't need|no need)\b/i,
  ],

  meeting_request: [
    /\b(schedule|set up|book|arrange|meet|call|chat|discuss|connect)\b/i,
    /\b(available|free|calendar|time|when|what time|next week)\b/i,
    /\b(demo|presentation|walkthrough|overview)\b/i,
  ],

  out_of_office: [
    /\b(out of office|away from|on vacation|on leave|ooo|auto.*reply)\b/i,
    /\b(returning on|back on|will respond|limited access)\b/i,
  ],

  not_interested: [
    /\b(not interested|no thanks|no thank you|don't contact|stop|remove me)\b/i,
    /\b(unsubscribe|opt out|take me off)\b/i,
  ],

  wrong_person: [
    /\b(wrong person|not the right|not my area|not responsible|not my department)\b/i,
    /\b(try|contact|reach out to|speak with|talk to)\s+\w+/i,
  ],

  question: [
    /\?/,
    /\b(what|how|when|where|why|who|which|can you|could you|would you)\b/i,
    /\b(explain|clarify|details|information|specifics)\b/i,
  ],
};

const OBJECTION_PATTERNS = {
  price: [
    /\b(price|cost|expensive|budget|affordable|pricing|fee|rate)\b/i,
  ],
  timing: [
    /\b(timing|time|now|later|busy|bandwidth|quarter|year|month)\b/i,
    /\b(revisit|circle back|touch base|check in|follow up)\b/i,
  ],
  competition: [
    /\b(already|current|existing|using|have|competitor|alternative)\b/i,
    /\b(salesforce|hubspot|pipedrive|zoho|monday|asana)\b/i,
  ],
  no_need: [
    /\b(don't need|no need|not a priority|not necessary|not relevant)\b/i,
  ],
  decision_maker: [
    /\b(not my decision|need to check|have to ask|boss|manager|team)\b/i,
    /\b(not authorized|need approval|committee)\b/i,
  ],
};

const INTENT_PATTERNS = {
  demo_request: [
    /\b(demo|demonstration|show me|see it|walkthrough|trial)\b/i,
  ],
  pricing_inquiry: [
    /\b(price|pricing|cost|how much|rates|fee|package|plan)\b/i,
  ],
  meeting_request: [
    /\b(meet|call|chat|discuss|talk|connect|schedule|calendar)\b/i,
  ],
  technical_question: [
    /\b(integrate|api|technical|feature|capability|support|work with)\b/i,
    /\b(does it|can it|will it|is it able)\b/i,
  ],
  competitor_mention: [
    /\b(vs|versus|compared to|alternative|competitor|instead of)\b/i,
  ],
  timeline_discussion: [
    /\b(when|timeline|date|quarter|month|year|soon|later)\b/i,
  ],
  budget_discussion: [
    /\b(budget|afford|spend|investment|cost)\b/i,
  ],
};

const SENTIMENT_INDICATORS = {
  positive: [
    /\b(great|excellent|perfect|wonderful|fantastic|awesome|love|excited|impressed)\b/i,
    /\b(thanks|thank you|appreciate|helpful|glad)\b/i,
    /👍|😊|🙂|😀|👏|✨/,
  ],
  negative: [
    /\b(not|don't|can't|won't|never|no|none|neither)\b/i,
    /\b(disappointed|frustrated|annoyed|upset|angry|waste)\b/i,
    /😠|😡|👎|❌/,
  ],
};

/**
 * Classify an email reply
 */
export async function classifyReply(
  emailBody: string,
  emailSubject?: string,
  conversationHistory?: string[]
): Promise<ReplyClassification> {
  const startTime = Date.now();

  // Clean the email body
  const cleanedBody = cleanEmailBody(emailBody);

  // Quick pattern-based classification for speed
  const quickClassification = quickClassify(cleanedBody, emailSubject);

  // If high confidence quick classification, return it
  if (quickClassification.confidence > 0.85) {
    return {
      ...quickClassification,
      processingTime: Date.now() - startTime,
    };
  }

  // For lower confidence, use AI for deeper analysis
  try {
    const aiClassification = await aiClassify(cleanedBody, emailSubject, conversationHistory);
    return {
      ...aiClassification,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    console.error('AI classification failed, falling back to pattern matching:', error);
    return {
      ...quickClassification,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Quick pattern-based classification
 */
function quickClassify(
  emailBody: string,
  emailSubject?: string
): Omit<ReplyClassification, 'processingTime'> {
  const fullText = `${emailSubject || ''} ${emailBody}`.toLowerCase();

  // Check for out of office (highest priority)
  if (CLASSIFICATION_PATTERNS.out_of_office.some(pattern => pattern.test(fullText))) {
    return createClassification('out_of_office', fullText, 0.95);
  }

  // Check for unsubscribe/not interested
  if (CLASSIFICATION_PATTERNS.not_interested.some(pattern => pattern.test(fullText))) {
    return createClassification('not_interested', fullText, 0.9);
  }

  // Check for wrong person
  if (CLASSIFICATION_PATTERNS.wrong_person.some(pattern => pattern.test(fullText))) {
    return createClassification('wrong_person', fullText, 0.85);
  }

  // Check for meeting request
  if (CLASSIFICATION_PATTERNS.meeting_request.some(pattern => pattern.test(fullText))) {
    return createClassification('meeting_request', fullText, 0.8);
  }

  // Check for objection
  if (CLASSIFICATION_PATTERNS.objection.some(pattern => pattern.test(fullText))) {
    return createClassification('objection', fullText, 0.75);
  }

  // Check for positive interest
  if (CLASSIFICATION_PATTERNS.positive_interest.some(pattern => pattern.test(fullText))) {
    return createClassification('positive_interest', fullText, 0.8);
  }

  // Check for question
  if (CLASSIFICATION_PATTERNS.question.some(pattern => pattern.test(fullText))) {
    return createClassification('question', fullText, 0.7);
  }

  // Default to unclear
  return createClassification('unclear', fullText, 0.3);
}

/**
 * AI-powered classification using LLM
 */
async function aiClassify(
  emailBody: string,
  emailSubject?: string,
  conversationHistory?: string[]
): Promise<Omit<ReplyClassification, 'processingTime'>> {
  const prompt = `Analyze this email reply from a sales prospect and classify it.

${conversationHistory && conversationHistory.length > 0 ? `
Previous conversation:
${conversationHistory.join('\n---\n')}
` : ''}

Subject: ${emailSubject || 'N/A'}
Body:
${emailBody}

Provide a JSON response with:
{
  "category": "positive_interest|objection|question|meeting_request|out_of_office|not_interested|wrong_person|unsubscribe|neutral|unclear",
  "sentiment": {
    "score": -1.0 to 1.0,
    "label": "very_negative|negative|neutral|positive|very_positive",
    "confidence": 0-1
  },
  "intents": [
    {
      "type": "demo_request|pricing_inquiry|meeting_request|technical_question|competitor_mention|timeline_discussion|budget_discussion",
      "confidence": 0-1,
      "evidence": "quote from email"
    }
  ],
  "objection": {
    "type": "price|timing|competition|no_need|decision_maker|other",
    "severity": "soft|medium|hard",
    "specificConcern": "explanation"
  },
  "entities": {
    "mentionedCompetitors": ["competitor names"],
    "mentionedTimeline": "timeline mentioned or null",
    "mentionedBudget": "budget mentioned or null",
    "mentionedPeople": ["names mentioned"],
    "urgency": "low|medium|high"
  },
  "suggestedAction": {
    "action": "send_info|schedule_meeting|handle_objection|nurture|escalate_to_human|remove_from_sequence|send_case_study|send_pricing",
    "reasoning": "why this action",
    "priority": "low|medium|high|urgent",
    "suggestedResponse": "brief suggested reply (2-3 sentences)"
  },
  "requiresHumanReview": boolean,
  "confidence": 0-1
}`;

  const response = await routeAIRequest(prompt, {
    taskType: 'email-classification',
    maxTokens: 1000,
  });

  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const classification = JSON.parse(jsonMatch[0]);
    return classification as Omit<ReplyClassification, 'processingTime'>;
  } catch (error) {
    console.error('Failed to parse AI classification:', error);
    // Fallback to pattern matching
    return quickClassify(emailBody, emailSubject);
  }
}

/**
 * Create a classification object from pattern matching
 */
function createClassification(
  category: ReplyClassification['category'],
  fullText: string,
  confidence: number
): Omit<ReplyClassification, 'processingTime'> {
  const sentiment = analyzeSentiment(fullText);
  const intents = extractIntents(fullText);
  const entities = extractEntities(fullText);
  const objection = category === 'objection' ? detectObjection(fullText) : undefined;
  const suggestedAction = determineSuggestedAction(category, sentiment, intents);

  return {
    category,
    sentiment,
    intents,
    objection,
    entities,
    suggestedAction,
    requiresHumanReview: shouldRequireHumanReview(category, sentiment, confidence),
    confidence,
  };
}

/**
 * Analyze sentiment in text
 */
function analyzeSentiment(text: string): ReplyClassification['sentiment'] {
  let score = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  // Count positive indicators
  for (const pattern of SENTIMENT_INDICATORS.positive) {
    const matches = text.match(pattern);
    if (matches) {
      positiveCount += matches.length;
    }
  }

  // Count negative indicators
  for (const pattern of SENTIMENT_INDICATORS.negative) {
    const matches = text.match(pattern);
    if (matches) {
      negativeCount += matches.length;
    }
  }

  // Calculate score
  const total = positiveCount + negativeCount;
  if (total > 0) {
    score = (positiveCount - negativeCount) / total;
  }

  // Determine label
  let label: ReplyClassification['sentiment']['label'];
  if (score >= 0.5) label = 'very_positive';
  else if (score >= 0.2) label = 'positive';
  else if (score >= -0.2) label = 'neutral';
  else if (score >= -0.5) label = 'negative';
  else label = 'very_negative';

  return {
    score: Math.max(-1, Math.min(1, score)),
    label,
    confidence: total > 0 ? Math.min(0.8, total / 10) : 0.5,
  };
}

/**
 * Extract intent signals from text
 */
function extractIntents(text: string): ReplyClassification['intents'] {
  const intents: ReplyClassification['intents'] = [];

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        intents.push({
          type: intentType as any,
          confidence: 0.7,
          evidence: match[0],
        });
        break; // Only add each intent type once
      }
    }
  }

  return intents;
}

/**
 * Extract entities from text
 */
function extractEntities(text: string): ReplyClassification['entities'] {
  // Extract competitors
  const competitorPatterns = [
    /salesforce/i, /hubspot/i, /pipedrive/i, /zoho/i, /monday/i,
    /asana/i, /clickup/i, /notion/i, /airtable/i,
  ];
  const mentionedCompetitors = competitorPatterns
    .filter(pattern => pattern.test(text))
    .map(pattern => text.match(pattern)?.[0] || '')
    .filter(Boolean);

  // Extract timeline
  const timelineMatch = text.match(
    /\b(next|this|in \d+)\s+(week|month|quarter|year|q[1-4])\b/i
  );
  const mentionedTimeline = timelineMatch ? timelineMatch[0] : null;

  // Extract budget
  const budgetMatch = text.match(
    /\$[\d,]+k?|\d+k budget|limited budget|tight budget/i
  );
  const mentionedBudget = budgetMatch ? budgetMatch[0] : null;

  // Extract people (basic name detection)
  const peopleMatches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || [];
  const mentionedPeople = [...new Set(peopleMatches)];

  // Determine urgency
  const urgencyKeywords = {
    high: ['urgent', 'asap', 'immediately', 'right now', 'today'],
    medium: ['soon', 'this week', 'next week', 'quickly'],
    low: ['eventually', 'someday', 'future', 'maybe', 'later'],
  };

  let urgency: 'low' | 'medium' | 'high' = 'medium';
  if (urgencyKeywords.high.some(kw => text.toLowerCase().includes(kw))) {
    urgency = 'high';
  } else if (urgencyKeywords.low.some(kw => text.toLowerCase().includes(kw))) {
    urgency = 'low';
  }

  return {
    mentionedCompetitors,
    mentionedTimeline,
    mentionedBudget,
    mentionedPeople,
    urgency,
  };
}

/**
 * Detect objection type
 */
function detectObjection(text: string): ReplyClassification['objection'] {
  for (const [objectionType, patterns] of Object.entries(OBJECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        // Determine severity based on language
        const hardWords = ['never', 'absolutely not', 'definitely not', 'impossible'];
        const softWords = ['maybe', 'might', 'possibly', 'consider'];

        let severity: 'soft' | 'medium' | 'hard' = 'medium';
        if (hardWords.some(word => text.toLowerCase().includes(word))) {
          severity = 'hard';
        } else if (softWords.some(word => text.toLowerCase().includes(word))) {
          severity = 'soft';
        }

        return {
          type: objectionType as any,
          severity,
          specificConcern: text.substring(0, 200),
        };
      }
    }
  }

  return {
    type: 'other',
    severity: 'medium',
    specificConcern: text.substring(0, 200),
  };
}

/**
 * Determine suggested next action
 */
function determineSuggestedAction(
  category: ReplyClassification['category'],
  sentiment: ReplyClassification['sentiment'],
  intents: ReplyClassification['intents']
): ReplyClassification['suggestedAction'] {
  switch (category) {
    case 'positive_interest':
      if (intents.some(i => i.type === 'meeting_request' || i.type === 'demo_request')) {
        return {
          action: 'schedule_meeting',
          reasoning: 'Prospect expressed interest and wants to meet or see a demo',
          priority: 'high',
          suggestedResponse: 'Great! I\'d love to show you how we can help. Are you available for a quick 15-minute call this week?',
        };
      }
      if (intents.some(i => i.type === 'pricing_inquiry')) {
        return {
          action: 'send_pricing',
          reasoning: 'Prospect is interested and asking about pricing',
          priority: 'high',
          suggestedResponse: 'Happy to share pricing! Our plans start at $X/month. Can I schedule a quick call to understand your needs and recommend the best fit?',
        };
      }
      return {
        action: 'send_info',
        reasoning: 'Prospect showed positive interest, send more information',
        priority: 'medium',
        suggestedResponse: 'Great to hear you\'re interested! I\'d love to learn more about your specific needs. Would you have 15 minutes this week to discuss?',
      };

    case 'meeting_request':
      return {
        action: 'schedule_meeting',
        reasoning: 'Prospect explicitly requested a meeting',
        priority: 'urgent',
        suggestedResponse: 'Absolutely! I have availability [Day] at [Time] or [Day] at [Time]. Which works better for you?',
      };

    case 'objection':
      return {
        action: 'handle_objection',
        reasoning: 'Prospect raised an objection that needs addressing',
        priority: 'high',
        suggestedResponse: 'I understand your concern. Many of our customers initially had similar thoughts. Can I share how they approached this?',
      };

    case 'question':
      return {
        action: 'send_info',
        reasoning: 'Prospect has questions that need answering',
        priority: 'medium',
        suggestedResponse: 'Great question! [Answer]. Would you like to schedule a brief call to discuss this in more detail?',
      };

    case 'out_of_office':
      return {
        action: 'nurture',
        reasoning: 'Prospect is out of office, follow up when they return',
        priority: 'low',
      };

    case 'not_interested':
      return {
        action: 'remove_from_sequence',
        reasoning: 'Prospect explicitly stated they are not interested',
        priority: 'low',
      };

    case 'wrong_person':
      return {
        action: 'escalate_to_human',
        reasoning: 'Need to find the right contact person',
        priority: 'medium',
        suggestedResponse: 'Thanks for letting me know! Who would be the best person to discuss this with?',
      };

    default:
      return {
        action: 'escalate_to_human',
        reasoning: 'Unclear intent, human review recommended',
        priority: 'medium',
      };
  }
}

/**
 * Determine if human review is required
 */
function shouldRequireHumanReview(
  category: ReplyClassification['category'],
  sentiment: ReplyClassification['sentiment'],
  confidence: number
): boolean {
  // Always require review for very negative sentiment
  if (sentiment.label === 'very_negative') return true;

  // Require review for low confidence classifications
  if (confidence < 0.5) return true;

  // Require review for meeting requests (too important to automate fully)
  if (category === 'meeting_request') return true;

  // Require review for complex objections
  if (category === 'objection' && confidence < 0.7) return true;

  return false;
}

/**
 * Clean email body (remove signatures, quoted text, etc.)
 */
function cleanEmailBody(body: string): string {
  // Remove quoted text (lines starting with >)
  body = body.replace(/^>.*$/gm, '');

  // Remove email signatures (common patterns)
  body = body.replace(/^--\s*$/m, '');
  body = body.replace(/^Sent from my (iPhone|iPad|Android)/mi, '');
  body = body.replace(/^Get Outlook for (iOS|Android)/mi, '');

  // Remove multiple newlines
  body = body.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  return body.trim();
}

/**
 * Batch classify multiple replies
 */
export async function batchClassifyReplies(
  replies: Array<{ id: string; emailBody: string; emailSubject?: string }>
): Promise<Map<string, ReplyClassification>> {
  const results = new Map<string, ReplyClassification>();

  // Process in parallel with rate limiting
  const batchSize = 5;
  for (let i = 0; i < replies.length; i += batchSize) {
    const batch = replies.slice(i, i + batchSize);
    const classifications = await Promise.all(
      batch.map(reply => classifyReply(reply.emailBody, reply.emailSubject))
    );

    batch.forEach((reply, index) => {
      results.set(reply.id, classifications[index]);
    });
  }

  return results;
}

/**
 * Get suggested template for response based on classification
 */
export function getSuggestedResponseTemplate(
  classification: ReplyClassification
): string {
  if (classification.suggestedAction.suggestedResponse) {
    return classification.suggestedAction.suggestedResponse;
  }

  // Fallback templates
  const templates = {
    positive_interest: 'Thanks for your interest! I\'d love to learn more about your needs and show you how we can help. Do you have 15 minutes this week for a quick call?',

    objection: 'I understand your concern about {{objection_type}}. Many of our customers had similar thoughts initially. Can I share how they approached this?',

    question: 'Great question! {{answer_placeholder}}. Would you like to schedule a brief call to discuss this in more detail?',

    meeting_request: 'Absolutely! I have availability on {{day}} at {{time}} or {{day}} at {{time}}. Which works better for you? Here\'s my calendar link: {{calendar_link}}',
  };

  return templates[classification.category as keyof typeof templates] || '';
}
