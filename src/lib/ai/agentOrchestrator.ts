/**
 * AI Agent Orchestrator
 * Manages specialized AI agents for different tasks
 * Each agent has optimized prompts and can collaborate with other agents
 */

import { routeAIRequest, type AIResponse, type TaskType } from './modelRouter';
import { supabase } from '../supabase';

export type AgentType =
  | 'research'
  | 'outreach'
  | 'scoring'
  | 'analysis'
  | 'automation'
  | 'strategist';

export interface AgentContext {
  teamId: string;
  userId: string;
  prospectData?: any;
  dealData?: any;
  companyData?: any;
  conversationHistory?: Array<{ role: string; content: string }>;
  additionalContext?: Record<string, any>;
}

export interface AgentTask {
  agentType: AgentType;
  action: string;
  parameters: Record<string, any>;
  context: AgentContext;
}

export interface AgentResult {
  agentType: AgentType;
  action: string;
  result: any;
  confidence: number;
  reasoning: string;
  suggestions: string[];
  nextActions: string[];
  metadata: {
    provider: string;
    model: string;
    latency: number;
    cost: number;
  };
}

/**
 * Research Agent - Company and prospect research
 */
export class ResearchAgent {
  private systemPrompt = `You are a B2B research specialist. Your role is to:
- Analyze companies and prospects deeply
- Identify pain points and business challenges
- Find competitive insights and market positioning
- Discover buying signals and intent indicators
- Provide actionable intelligence for sales teams

Always structure your research in a clear, actionable format with specific recommendations.`;

  async execute(action: string, parameters: any, context: AgentContext): Promise<AgentResult> {
    let prompt = '';
    let taskType: TaskType = 'company-research';

    switch (action) {
      case 'research_company':
        prompt = this.buildCompanyResearchPrompt(parameters, context);
        taskType = 'company-research';
        break;

      case 'research_prospect':
        prompt = this.buildProspectResearchPrompt(parameters, context);
        taskType = 'deep-research';
        break;

      case 'competitive_analysis':
        prompt = this.buildCompetitiveAnalysisPrompt(parameters, context);
        taskType = 'deep-research';
        break;

      case 'identify_pain_points':
        prompt = this.buildPainPointsPrompt(parameters, context);
        taskType = 'general';
        break;

      default:
        throw new Error(`Unknown research action: ${action}`);
    }

    const response = await routeAIRequest(prompt, {
      systemPrompt: this.systemPrompt,
      taskType,
      teamId: context.teamId,
      fallbackEnabled: true,
    });

    return this.parseResponse(action, response, context);
  }

  private buildCompanyResearchPrompt(parameters: any, context: AgentContext): string {
    const { companyName, industry, website } = parameters;
    return `Conduct comprehensive research on ${companyName} (${industry}).
Website: ${website || 'Not provided'}

Provide:
1. Business Overview (what they do, products/services, value proposition)
2. Market Position (competitors, differentiators, market share)
3. Recent News (funding, acquisitions, product launches, partnerships)
4. Technology Stack (known tools and platforms they use)
5. Pain Points (likely challenges and problems they face)
6. Buying Signals (indicators of readiness to buy)
7. Key Decision Makers (titles and departments to target)
8. Recommended Approach (how to engage and message to them)

Format as JSON with these exact keys.`;
  }

  private buildProspectResearchPrompt(parameters: any, context: AgentContext): string {
    const { prospectName, title, company } = parameters;
    return `Research prospect: ${prospectName} (${title} at ${company})

Based on their role and company, provide:
1. Role Responsibilities (what they likely focus on daily)
2. Key Challenges (problems they face in their role)
3. Success Metrics (what they're measured on)
4. Budget Authority (likelihood they have buying power)
5. Engagement Strategy (best way to reach and engage them)
6. Value Proposition (how our solution helps them specifically)
7. Talking Points (personalized conversation starters)

Format as JSON.`;
  }

  private buildCompetitiveAnalysisPrompt(parameters: any, context: AgentContext): string {
    const { ourProduct, competitor } = parameters;
    return `Compare ${ourProduct} vs ${competitor}

Provide competitive analysis:
1. Feature Comparison (key differences)
2. Pricing Comparison (value proposition differences)
3. Target Market (who each serves best)
4. Strengths (what ${competitor} does well)
5. Weaknesses (where ${competitor} falls short)
6. Win Strategies (how to position against them)
7. Battle Cards (key talking points for sales)

Format as JSON.`;
  }

  private buildPainPointsPrompt(parameters: any, context: AgentContext): string {
    const { industry, role, companySize } = parameters;
    return `Identify pain points for ${role} in ${industry} at ${companySize} companies.

List:
1. Top 5 Pain Points (specific challenges they face)
2. Impact Assessment (how these problems affect their business)
3. Current Solutions (how they're solving these today)
4. Gaps in Current Solutions (why current approaches fail)
5. Triggers (events that make these problems urgent)

Format as JSON.`;
  }

  private parseResponse(action: string, response: AIResponse, context: AgentContext): AgentResult {
    try {
      const parsed = JSON.parse(response.response);
      return {
        agentType: 'research',
        action,
        result: parsed,
        confidence: 0.85,
        reasoning: 'Research compiled from multiple data sources and analysis',
        suggestions: [
          'Review the identified pain points',
          'Customize outreach based on research findings',
          'Use competitive insights in conversations',
        ],
        nextActions: [
          'Create personalized outreach campaign',
          'Schedule research review with team',
          'Update prospect profile with insights',
        ],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    } catch (error) {
      return {
        agentType: 'research',
        action,
        result: { rawText: response.response },
        confidence: 0.7,
        reasoning: 'Research completed but format needs manual review',
        suggestions: ['Review raw research output', 'Extract key insights manually'],
        nextActions: ['Manual processing needed'],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    }
  }
}

/**
 * Outreach Agent - Email and message crafting
 */
export class OutreachAgent {
  private systemPrompt = `You are a B2B sales communication expert. Your role is to:
- Craft personalized, compelling outreach messages
- Optimize subject lines for high open rates
- Create value-driven content that resonates
- Use proven sales frameworks (AIDA, PAS, BAB)
- Maintain authentic, conversational tone

Every message should be concise, personalized, and action-oriented.`;

  async execute(action: string, parameters: any, context: AgentContext): Promise<AgentResult> {
    let prompt = '';
    let taskType: TaskType = 'email-generation';

    switch (action) {
      case 'generate_email':
        prompt = this.buildEmailPrompt(parameters, context);
        break;

      case 'generate_linkedin_message':
        prompt = this.buildLinkedInPrompt(parameters, context);
        break;

      case 'generate_follow_up':
        prompt = this.buildFollowUpPrompt(parameters, context);
        break;

      case 'optimize_message':
        prompt = this.buildOptimizationPrompt(parameters, context);
        break;

      default:
        throw new Error(`Unknown outreach action: ${action}`);
    }

    const response = await routeAIRequest(prompt, {
      systemPrompt: this.systemPrompt,
      taskType,
      teamId: context.teamId,
      prioritizeCost: true, // Email generation can use cheaper models
      fallbackEnabled: true,
    });

    return this.parseResponse(action, response, context);
  }

  private buildEmailPrompt(parameters: any, context: AgentContext): string {
    const { prospectName, company, title, painPoint, valueProposition } = parameters;
    return `Generate a personalized cold email to ${prospectName}, ${title} at ${company}.

Key details:
- Pain Point: ${painPoint}
- Value Proposition: ${valueProposition}
- Tone: Professional but conversational
- Length: 100-150 words
- Include: Strong subject line, personalized intro, clear value, soft CTA

Format as JSON with keys: subject, body, tips`;
  }

  private buildLinkedInPrompt(parameters: any, context: AgentContext): string {
    const { prospectName, mutualConnection, recentActivity } = parameters;
    return `Write a LinkedIn connection request or InMail to ${prospectName}.

Context:
- Mutual Connection: ${mutualConnection || 'None'}
- Recent Activity: ${recentActivity || 'None'}
- Keep it under 300 characters for connection request
- Be authentic and specific about why you're reaching out

Format as JSON with keys: message, notes`;
  }

  private buildFollowUpPrompt(parameters: any, context: AgentContext): string {
    const { previousMessage, daysSince, prospectResponse } = parameters;
    return `Generate a follow-up email.

Previous message: ${previousMessage}
Days since last contact: ${daysSince}
Prospect response: ${prospectResponse || 'No response'}

Create a friendly, value-adding follow-up that:
- References the previous message
- Adds new value or insight
- Makes it easy to respond
- Isn't pushy or desperate

Format as JSON with keys: subject, body, timing`;
  }

  private buildOptimizationPrompt(parameters: any, context: AgentContext): string {
    const { originalMessage, goalOptimize } = parameters;
    return `Optimize this sales message:

Original: ${originalMessage}
Goal: ${goalOptimize}

Improve:
1. Clarity and readability
2. Personalization and relevance
3. Value proposition strength
4. Call-to-action effectiveness
5. Overall conversion potential

Provide optimized version and specific improvements made.

Format as JSON with keys: optimized, improvements, score (1-10)`;
  }

  private parseResponse(action: string, response: AIResponse, context: AgentContext): AgentResult {
    try {
      const parsed = JSON.parse(response.response);
      return {
        agentType: 'outreach',
        action,
        result: parsed,
        confidence: 0.9,
        reasoning: 'Message crafted using sales best practices and personalization',
        suggestions: [
          'Review for tone and brand alignment',
          'Personalize further if possible',
          'A/B test different variations',
        ],
        nextActions: ['Send message', 'Track engagement', 'Prepare follow-up sequence'],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    } catch (error) {
      return {
        agentType: 'outreach',
        action,
        result: { rawText: response.response },
        confidence: 0.75,
        reasoning: 'Message generated but needs formatting',
        suggestions: ['Format message properly', 'Add personalization'],
        nextActions: ['Manual review needed'],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    }
  }
}

/**
 * Scoring Agent - Lead and deal scoring
 */
export class ScoringAgent {
  private systemPrompt = `You are a sales qualification expert. Your role is to:
- Score leads based on fit, intent, and engagement
- Evaluate deal health and win probability
- Identify risk factors and red flags
- Provide data-driven recommendations
- Use established frameworks (BANT, MEDDPICC, etc.)

Provide objective, actionable scoring with clear reasoning.`;

  async execute(action: string, parameters: any, context: AgentContext): Promise<AgentResult> {
    let prompt = '';
    let taskType: TaskType = 'lead-scoring';

    switch (action) {
      case 'score_lead':
        prompt = this.buildLeadScorePrompt(parameters, context);
        taskType = 'lead-scoring';
        break;

      case 'score_deal':
        prompt = this.buildDealScorePrompt(parameters, context);
        taskType = 'deal-analysis';
        break;

      case 'assess_risk':
        prompt = this.buildRiskAssessmentPrompt(parameters, context);
        taskType = 'deal-analysis';
        break;

      default:
        throw new Error(`Unknown scoring action: ${action}`);
    }

    const response = await routeAIRequest(prompt, {
      systemPrompt: this.systemPrompt,
      taskType,
      teamId: context.teamId,
      prioritizeCost: true,
      fallbackEnabled: true,
    });

    return this.parseResponse(action, response, context);
  }

  private buildLeadScorePrompt(parameters: any, context: AgentContext): string {
    return `Score this lead:
${JSON.stringify(parameters, null, 2)}

Provide:
1. Overall Score (0-100)
2. Fit Score (company size, industry, role match)
3. Intent Score (engagement, behavior signals)
4. Timing Score (urgency, budget cycle)
5. Key Strengths (why this is a good lead)
6. Key Concerns (potential dealbreakers)
7. Recommended Action (what to do next)
8. Priority Level (hot, warm, cold, nurture)

Format as JSON.`;
  }

  private buildDealScorePrompt(parameters: any, context: AgentContext): string {
    return `Assess this deal:
${JSON.stringify(parameters, null, 2)}

Provide:
1. Win Probability (0-100%)
2. Health Score (healthy, at-risk, critical)
3. Stage Confidence (is current stage accurate?)
4. MEDDPICC Assessment (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition)
5. Risk Factors (what could kill this deal)
6. Acceleration Opportunities (how to move faster)
7. Recommended Next Steps
8. Close Timeline Estimate

Format as JSON.`;
  }

  private buildRiskAssessmentPrompt(parameters: any, context: AgentContext): string {
    return `Assess risks for this deal:
${JSON.stringify(parameters, null, 2)}

Identify:
1. Red Flags (immediate concerns)
2. Risk Level (low, medium, high, critical)
3. Probability of Loss (%)
4. Main Threats (what could go wrong)
5. Mitigation Strategies (how to address risks)
6. Warning Signs to Monitor
7. Recommended Actions

Format as JSON.`;
  }

  private parseResponse(action: string, response: AIResponse, context: AgentContext): AgentResult {
    try {
      const parsed = JSON.parse(response.response);
      return {
        agentType: 'scoring',
        action,
        result: parsed,
        confidence: 0.88,
        reasoning: 'Score calculated using sales qualification frameworks',
        suggestions: [
          'Review scoring factors',
          'Validate with actual data',
          'Update CRM with insights',
        ],
        nextActions: ['Prioritize high-scoring leads', 'Address identified risks', 'Take recommended actions'],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    } catch (error) {
      return {
        agentType: 'scoring',
        action,
        result: { rawText: response.response },
        confidence: 0.7,
        reasoning: 'Scoring completed but format needs review',
        suggestions: ['Parse scoring manually'],
        nextActions: ['Manual review needed'],
        metadata: {
          provider: response.provider,
          model: response.model,
          latency: response.latency,
          cost: response.cost,
        },
      };
    }
  }
}

/**
 * Agent Orchestrator - Coordinates multiple agents
 */
export class AgentOrchestrator {
  private agents: Map<AgentType, any>;

  constructor() {
    this.agents = new Map([
      ['research', new ResearchAgent()],
      ['outreach', new OutreachAgent()],
      ['scoring', new ScoringAgent()],
    ]);
  }

  /**
   * Execute a task with the appropriate agent
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.agents.get(task.agentType);

    if (!agent) {
      throw new Error(`Unknown agent type: ${task.agentType}`);
    }

    try {
      const result = await agent.execute(task.action, task.parameters, task.context);

      // Log agent execution
      await this.logAgentExecution(task, result);

      return result;
    } catch (error: any) {
      console.error(`Agent execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute multiple tasks in sequence
   */
  async executePipeline(tasks: AgentTask[]): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);

      // Pass context from previous agents to next ones
      if (results.length > 0) {
        task.context.additionalContext = {
          ...task.context.additionalContext,
          previousResults: results,
        };
      }
    }

    return results;
  }

  /**
   * Log agent execution to database
   */
  private async logAgentExecution(task: AgentTask, result: AgentResult): Promise<void> {
    try {
      await supabase.from('ai_agent_sessions').insert({
        team_id: task.context.teamId,
        agent_type: task.agentType,
        conversation_history: task.context.conversationHistory || [],
        actions_taken: [
          {
            action: task.action,
            parameters: task.parameters,
            result: result.result,
            confidence: result.confidence,
          },
        ],
        outcome: result.reasoning,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging agent execution:', error);
    }
  }

  /**
   * Get agent execution history
   */
  async getAgentHistory(teamId: string, agentType?: AgentType): Promise<any[]> {
    let query = supabase
      .from('ai_agent_sessions')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agent history:', error);
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const orchestrator = new AgentOrchestrator();
