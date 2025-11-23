/**
 * Automatic Objection Handling System
 * Detects and responds to common sales objections automatically
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';
import { classifyReply, ReplyClassification } from './replyClassifier';
import { TemplateManager } from './contentLibrary';

export interface ObjectionResponse {
  objectionType: 'price' | 'timing' | 'competition' | 'no_need' | 'decision_maker' | 'other';
  severity: 'soft' | 'medium' | 'hard';
  suggestedResponse: string;
  alternativeResponses: string[];
  shouldEscalateToHuman: boolean;
  reasoning: string;
  followUpActions: string[];
}

export interface ObjectionHandlingStrategy {
  objectionType: string;
  severity: string;
  responseFramework: string;
  examples: string[];
  dosDonts: {
    dos: string[];
    donts: string[];
  };
}

/**
 * Objection handling frameworks and strategies
 */
const OBJECTION_STRATEGIES: Record<string, ObjectionHandlingStrategy> = {
  price: {
    objectionType: 'price',
    severity: 'medium',
    responseFramework: `
1. Acknowledge the concern
2. Reframe as investment vs cost
3. Provide ROI data
4. Share customer success story
5. Offer flexible options
6. Ask qualifying questions
`,
    examples: [
      'I completely understand the concern about investment. Let me share how our customers typically see 3x ROI within 90 days...',
      'Price is definitely important. Quick question: what would a 40% increase in qualified pipeline be worth to your team?',
    ],
    dosDonts: {
      dos: [
        'Acknowledge their concern',
        'Provide specific ROI metrics',
        'Share relevant case studies',
        'Ask about cost of inaction',
        'Offer flexible payment terms if available',
      ],
      donts: [
        'Get defensive',
        'Immediately discount',
        'Compare to cheaper alternatives',
        'Dismiss their concern',
        'Pressure them',
      ],
    },
  },

  timing: {
    objectionType: 'timing',
    severity: 'soft',
    responseFramework: `
1. Acknowledge their bandwidth
2. Clarify what "not now" means
3. Understand their timeline
4. Identify if it's priority or bandwidth
5. Offer low-lift option
6. Schedule follow-up
`,
    examples: [
      'Totally understand timing matters. Quick question: when you say "not right now," is it that this isn\'t a priority, or just bad timing this quarter?',
      'I get it - everyone is busy. What if we could show results without requiring much time from your team? Would that change things?',
    ],
    dosDonts: {
      dos: [
        'Clarify the real reason',
        'Ask when would be better',
        'Offer low-commitment next steps',
        'Stay in touch appropriately',
        'Respect their timeline',
      ],
      donts: [
        'Push for immediate decision',
        'Ignore their timing concerns',
        'Be overly persistent',
        'Make them feel guilty',
      ],
    },
  },

  competition: {
    objectionType: 'competition',
    severity: 'medium',
    responseFramework: `
1. Acknowledge the competitor
2. Ask about their experience
3. Identify gaps or frustrations
4. Highlight unique differentiation
5. Offer comparison or trial
6. Focus on outcomes not features
`,
    examples: [
      'Great question about how we compare to [Competitor]. Most of our customers came from them actually. What has your experience been like?',
      'I\'m familiar with [Competitor] - they\'re good at X. We differentiate by Y, which means Z for your team. Would it be helpful to see a side-by-side?',
    ],
    dosDonts: {
      dos: [
        'Respect the competitor',
        'Focus on differentiation',
        'Ask about their experience',
        'Highlight unique value',
        'Offer comparison or trial',
      ],
      donts: [
        'Trash talk competitors',
        'Get into feature wars',
        'Be defensive',
        'Make false claims',
        'Pressure to switch',
      ],
    },
  },

  no_need: {
    objectionType: 'no_need',
    severity: 'hard',
    responseFramework: `
1. Acknowledge their position
2. Ask about current situation
3. Identify hidden pain points
4. Share industry trends
5. Reframe the problem
6. Offer educational content
`,
    examples: [
      'That\'s totally fair. Quick question: how are you currently handling [problem area]? Just curious if you\'ve found a better approach.',
      'I hear you. Most companies in [industry] thought the same until [trigger event]. Have you experienced [specific pain point]?',
    ],
    dosDonts: {
      dos: [
        'Respect their assessment',
        'Ask discovery questions',
        'Educate on hidden costs',
        'Share industry insights',
        'Plant seeds for future',
      ],
      donts: [
        'Tell them they\'re wrong',
        'Be pushy',
        'Lecture them',
        'Assume they don\'t understand',
      ],
    },
  },

  decision_maker: {
    objectionType: 'decision_maker',
    severity: 'soft',
    responseFramework: `
1. Build them as champion
2. Ask about decision process
3. Offer to help sell internally
4. Provide resources for sharing
5. Request introduction
6. Multi-thread if possible
`,
    examples: [
      'That makes sense. Who else would need to be involved in this decision? I can put together materials that would help you make the case internally.',
      'I appreciate you being upfront. What would [decision maker] need to see to feel confident about this? Happy to join a call with both of you.',
    ],
    dosDonts: {
      dos: [
        'Build them as champion',
        'Ask about decision process',
        'Provide internal selling materials',
        'Offer to help present',
        'Request warm introduction',
      ],
      donts: [
        'Go around them',
        'Dismiss their importance',
        'Assume they can\'t influence',
        'Be impatient',
      ],
    },
  },
};

/**
 * Objection Handler Class
 */
export class ObjectionHandler {
  private teamId: string;
  private templateManager: TemplateManager;

  constructor(teamId: string) {
    this.teamId = teamId;
    this.templateManager = new TemplateManager(teamId);
  }

  /**
   * Handle objection from prospect reply
   */
  async handleObjection(
    prospectId: string,
    emailBody: string,
    classification: ReplyClassification,
    prospectContext?: Record<string, any>
  ): Promise<ObjectionResponse> {
    if (classification.category !== 'objection' || !classification.objection) {
      throw new Error('Not an objection');
    }

    const { objection } = classification;

    // Get strategy for this objection type
    const strategy = OBJECTION_STRATEGIES[objection.type] || OBJECTION_STRATEGIES.other;

    // Determine if human escalation needed
    const shouldEscalateToHuman = this.shouldEscalateToHuman(objection, classification);

    // Generate response
    const suggestedResponse = await this.generateObjectionResponse(
      objection.type,
      objection.severity,
      objection.specificConcern,
      prospectContext
    );

    // Generate alternative responses
    const alternativeResponses = await this.generateAlternativeResponses(
      objection.type,
      prospectContext
    );

    // Determine follow-up actions
    const followUpActions = this.determineFollowUpActions(objection, prospectContext);

    // Log objection
    await this.logObjection(prospectId, objection, suggestedResponse);

    return {
      objectionType: objection.type,
      severity: objection.severity,
      suggestedResponse,
      alternativeResponses,
      shouldEscalateToHuman,
      reasoning: this.explainReasoning(objection, strategy),
      followUpActions,
    };
  }

  /**
   * Generate objection response using AI
   */
  private async generateObjectionResponse(
    objectionType: string,
    severity: string,
    specificConcern: string,
    context?: Record<string, any>
  ): Promise<string> {
    const strategy = OBJECTION_STRATEGIES[objectionType];

    const prompt = `Generate a professional, empathetic email response to this sales objection:

**Objection Type**: ${objectionType}
**Severity**: ${severity}
**Specific Concern**: "${specificConcern}"

${context ? `**Prospect Context**:
- Company: ${context.company_name}
- Title: ${context.title}
- Industry: ${context.industry}
- Previous conversation: ${context.previous_context}
` : ''}

**Response Framework**:
${strategy.responseFramework}

**Dos**:
${strategy.dosDonts.dos.map(d => `- ${d}`).join('\n')}

**Don'ts**:
${strategy.dosDonts.donts.map(d => `- ${d}`).join('\n')}

**Examples** (for inspiration, don't copy):
${strategy.examples.map(e => `- ${e}`).join('\n')}

Requirements:
1. Acknowledge their concern genuinely
2. Provide specific value/ROI
3. Include 1-2 questions to understand better
4. Suggest a clear next step
5. Keep it under 150 words
6. Professional but conversational tone
7. Don't be pushy or defensive

Return only the email response, no explanations.`;

    const response = await routeAIRequest(prompt, {
      taskType: 'email-generation',
      maxTokens: 400,
    });

    return response.trim();
  }

  /**
   * Generate alternative responses
   */
  private async generateAlternativeResponses(
    objectionType: string,
    context?: Record<string, any>
  ): Promise<string[]> {
    // Generate 2 alternative approaches
    const alternatives: string[] = [];

    // Alternative 1: More direct
    const direct = await this.generateObjectionResponse(
      objectionType,
      'soft',
      'Direct approach',
      { ...context, approach: 'direct' }
    );
    alternatives.push(direct);

    // Alternative 2: More educational
    const educational = await this.generateObjectionResponse(
      objectionType,
      'soft',
      'Educational approach',
      { ...context, approach: 'educational' }
    );
    alternatives.push(educational);

    return alternatives;
  }

  /**
   * Determine if human escalation needed
   */
  private shouldEscalateToHuman(
    objection: { type: string; severity: string },
    classification: ReplyClassification
  ): boolean {
    // Always escalate hard objections
    if (objection.severity === 'hard') return true;

    // Escalate if low confidence
    if (classification.confidence < 0.6) return true;

    // Escalate if very negative sentiment
    if (classification.sentiment.score < -0.5) return true;

    // Escalate 'no_need' objections (harder to overcome)
    if (objection.type === 'no_need') return true;

    // Escalate if already multiple objections
    // (would check objection history here)

    return false;
  }

  /**
   * Determine follow-up actions
   */
  private determineFollowUpActions(
    objection: { type: string; severity: string },
    context?: Record<string, any>
  ): string[] {
    const actions: string[] = [];

    switch (objection.type) {
      case 'price':
        actions.push('Send ROI calculator');
        actions.push('Share case study with similar company');
        actions.push('Offer pricing options document');
        actions.push('Schedule call with sales engineer');
        break;

      case 'timing':
        actions.push('Add to nurture sequence');
        actions.push('Set reminder for follow-up');
        actions.push('Send relevant content');
        actions.push('Ask about specific timeline');
        break;

      case 'competition':
        actions.push('Send comparison document');
        actions.push('Offer demo/trial');
        actions.push('Share differentiation one-pager');
        actions.push('Request conversation about current tool');
        break;

      case 'no_need':
        actions.push('Send educational content');
        actions.push('Share industry report');
        actions.push('Add to long-term nurture');
        actions.push('Ask discovery questions');
        break;

      case 'decision_maker':
        actions.push('Request introduction to decision maker');
        actions.push('Provide internal selling materials');
        actions.push('Offer to join call with team');
        actions.push('Send executive summary');
        break;
    }

    return actions;
  }

  /**
   * Explain reasoning for response
   */
  private explainReasoning(
    objection: { type: string; severity: string },
    strategy: ObjectionHandlingStrategy
  ): string {
    return `This is a ${objection.severity} ${objection.type} objection. The recommended approach is to:

${strategy.responseFramework}

This framework has proven effective because it:
1. Acknowledges their concern (builds trust)
2. Provides specific value (addresses root issue)
3. Asks questions (gathers more info)
4. Suggests next step (moves conversation forward)

${objection.severity === 'hard' ? 'Due to the severity, human review is recommended before sending.' : 'This can typically be handled automatically with good results.'}`;
  }

  /**
   * Log objection for learning
   */
  private async logObjection(
    prospectId: string,
    objection: { type: string; severity: string; specificConcern: string },
    suggestedResponse: string
  ): Promise<void> {
    await supabase.from('objection_log').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      objection_type: objection.type,
      objection_severity: objection.severity,
      objection_text: objection.specificConcern,
      suggested_response: suggestedResponse,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Get objection handling stats
   */
  async getObjectionStats(daysBack: number = 30): Promise<{
    totalObjections: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    overcomRate: number;
    avgResponseTime: number;
  }> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: objections } = await supabase
      .from('objection_log')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('created_at', since.toISOString());

    const totalObjections = objections?.length || 0;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    objections?.forEach(obj => {
      byType[obj.objection_type] = (byType[obj.objection_type] || 0) + 1;
      bySeverity[obj.objection_severity] = (bySeverity[obj.objection_severity] || 0) + 1;
    });

    return {
      totalObjections,
      byType,
      bySeverity,
      overcomRate: 0, // Would calculate from subsequent replies
      avgResponseTime: 0, // Would calculate from timestamps
    };
  }

  /**
   * Get objection handling recommendations
   */
  async getObjectionRecommendations(): Promise<string[]> {
    const stats = await this.getObjectionStats();
    const recommendations: string[] = [];

    // Analyze most common objections
    const topObjection = Object.entries(stats.byType)
      .sort(([, a], [, b]) => b - a)[0];

    if (topObjection) {
      recommendations.push(
        `Most common objection is "${topObjection[0]}". Consider proactively addressing this in initial outreach.`
      );
    }

    // Check for high severity rate
    const hardCount = stats.bySeverity['hard'] || 0;
    if (hardCount / stats.totalObjections > 0.3) {
      recommendations.push(
        'High rate of hard objections. Review targeting and messaging to better qualify upfront.'
      );
    }

    return recommendations;
  }
}

/**
 * Get objection handling playbook
 */
export function getObjectionPlaybook(): Record<string, ObjectionHandlingStrategy> {
  return OBJECTION_STRATEGIES;
}

/**
 * Analyze objection trends
 */
export async function analyzeObjectionTrends(
  teamId: string,
  daysBack: number = 90
): Promise<{
  trending: Array<{ objectionType: string; trend: 'up' | 'down' | 'stable'; change: number }>;
  seasonality: Record<string, number[]>;  // By day of week or month
  correlations: Array<{ objectionType: string; correlatedWith: string; strength: number }>;
}> {
  // This would analyze objection data over time to identify patterns
  // For now, returning mock structure

  return {
    trending: [],
    seasonality: {},
    correlations: [],
  };
}
