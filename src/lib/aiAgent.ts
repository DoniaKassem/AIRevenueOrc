import { supabase } from './supabase';
import { createOpenAICompletion } from './openai';

export type AgentAction =
  | 'create_cadence'
  | 'create_deal'
  | 'add_prospect'
  | 'search_prospects'
  | 'update_deal_stage'
  | 'schedule_task'
  | 'get_analytics'
  | 'conversation_only';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface AgentResponse {
  message: string;
  action?: AgentAction;
  actionData?: any;
  needsMoreInfo?: boolean;
  suggestions?: string[];
}

export interface ConversationContext {
  teamId: string;
  userId?: string;
  history: AgentMessage[];
  pendingAction?: {
    type: AgentAction;
    collectedData: any;
  };
}

const SYSTEM_PROMPT = `You are an intelligent sales assistant AI embedded in a CRM platform. You help users manage their sales workflow through natural conversation.

You can help with:
1. Creating sales cadences (multi-step outreach sequences)
2. Managing deals and pipelines
3. Adding and searching prospects
4. Analyzing sales data
5. Scheduling tasks and follow-ups

When users ask to do something, identify what they want and gather the necessary information through conversation. Be conversational, helpful, and efficient.

For cadence creation, you need:
- name: The cadence name
- purpose: What this cadence is for
- steps: Array of objects with { type: "email"|"call"|"linkedin"|"sms"|"task", delayDays: number, content: "description" }

For deal creation, you need:
- dealName: Name of the deal
- amount: Dollar amount (number)
- stage: "qualification"|"proposal"|"negotiation"|"closed-won"|"closed-lost"
- company: Company name
- prospectId: (optional) ID of related prospect

For prospect addition, you need:
- firstName, lastName, email, company, title, phone (optional)

Always respond in a friendly, professional tone. If information is missing, ask specific questions. When you have all needed info, confirm before executing.

IMPORTANT: Your response must be valid JSON in this exact format:
{
  "message": "Your conversational response to the user",
  "action": "create_cadence|create_deal|add_prospect|update_deal_stage|null",
  "actionData": {extracted data object with correct field names},
  "needsMoreInfo": boolean,
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

export class AIAgent {
  private context: ConversationContext;

  constructor(teamId: string, userId?: string) {
    this.context = {
      teamId,
      userId,
      history: [],
    };
  }

  async chat(userMessage: string): Promise<AgentResponse> {
    this.context.history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const conversationHistory = this.context.history
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const contextInfo = await this.buildContextInfo();

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'system' as const, content: `Current Context:\n${contextInfo}` },
      ...conversationHistory,
    ];

    try {
      const response = await createOpenAICompletion(messages, {
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 1000,
        teamId: this.context.teamId,
        agentType: 'conversational_assistant',
        taskContext: userMessage,
      });

      const parsed = this.parseAgentResponse(response);

      this.context.history.push({
        role: 'assistant',
        content: parsed.message,
        timestamp: new Date(),
      });

      if (parsed.action && parsed.actionData) {
        this.context.pendingAction = {
          type: parsed.action,
          collectedData: parsed.actionData,
        };
      }

      return parsed;
    } catch (error) {
      console.error('AI Agent error:', error);
      return {
        message: "I'm having trouble processing that request. Could you try rephrasing?",
        needsMoreInfo: false,
        suggestions: ['Create a cadence', 'Add a prospect', 'Show my deals'],
      };
    }
  }

  private parseAgentResponse(response: string): AgentResponse {
    try {
      const cleanedResponse = response.trim();
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          message: response,
          needsMoreInfo: false,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: parsed.message || response,
        action: parsed.action || undefined,
        actionData: parsed.actionData || undefined,
        needsMoreInfo: parsed.needsMoreInfo || false,
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      return {
        message: response,
        needsMoreInfo: false,
      };
    }
  }

  private async buildContextInfo(): Promise<string> {
    let context = '';

    const { data: recentProspects } = await supabase
      .from('prospects')
      .select('first_name, last_name, company, status')
      .eq('team_id', this.context.teamId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentProspects && recentProspects.length > 0) {
      context += '\nRecent Prospects:\n';
      recentProspects.forEach((p) => {
        context += `- ${p.first_name} ${p.last_name} at ${p.company} (${p.status})\n`;
      });
    }

    const { data: activeCadences } = await supabase
      .from('cadences')
      .select('name, is_active')
      .eq('team_id', this.context.teamId)
      .eq('is_active', true)
      .limit(5);

    if (activeCadences && activeCadences.length > 0) {
      context += '\nActive Cadences:\n';
      activeCadences.forEach((c) => {
        context += `- ${c.name}\n`;
      });
    }

    const { data: deals } = await supabase
      .from('deals')
      .select('deal_name, stage, amount')
      .eq('team_id', this.context.teamId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (deals && deals.length > 0) {
      context += '\nRecent Deals:\n';
      deals.forEach((d) => {
        context += `- ${d.deal_name} (${d.stage}): $${d.amount}\n`;
      });
    }

    if (this.context.pendingAction) {
      context += `\nPending Action: ${this.context.pendingAction.type}\n`;
      context += `Collected Data: ${JSON.stringify(this.context.pendingAction.collectedData)}\n`;
    }

    return context || 'No additional context available.';
  }

  async executeAction(): Promise<{ success: boolean; message: string; data?: any }> {
    if (!this.context.pendingAction) {
      return { success: false, message: 'No pending action to execute.' };
    }

    const { type, collectedData } = this.context.pendingAction;

    try {
      switch (type) {
        case 'create_cadence':
          return await this.createCadence(collectedData);
        case 'create_deal':
          return await this.createDeal(collectedData);
        case 'add_prospect':
          return await this.addProspect(collectedData);
        case 'update_deal_stage':
          return await this.updateDealStage(collectedData);
        default:
          return { success: false, message: 'Unknown action type.' };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Action failed.' };
    } finally {
      this.context.pendingAction = undefined;
    }
  }

  private async createCadence(data: any) {
    const { name, purpose, steps } = data;

    const { data: cadence, error } = await supabase
      .from('cadences')
      .insert({
        name,
        description: purpose,
        team_id: this.context.teamId,
        created_by: this.context.userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    if (steps && Array.isArray(steps)) {
      const cadenceSteps = steps.map((step: any, index: number) => ({
        cadence_id: cadence.id,
        step_number: index + 1,
        type: step.type || 'email',
        delay_days: step.waitDays || step.delayDays || 1,
        delay_hours: 0,
        content: step.content || step.template || `Step ${index + 1}: ${step.type || 'email'}`,
      }));

      await supabase.from('cadence_steps').insert(cadenceSteps);
    }

    return {
      success: true,
      message: `Successfully created cadence "${name}" with ${steps?.length || 0} steps!`,
      data: cadence,
    };
  }

  private async createDeal(data: any) {
    const { dealName, amount, stage, company, prospectId } = data;

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        deal_name: dealName,
        amount: amount || 0,
        stage: stage || 'qualification',
        company_name: company,
        prospect_id: prospectId,
        team_id: this.context.teamId,
        owner_id: this.context.userId,
        expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Successfully created deal "${dealName}" for $${amount}!`,
      data: deal,
    };
  }

  private async addProspect(data: any) {
    const { firstName, lastName, email, company, title, phone } = data;

    const { data: prospect, error } = await supabase
      .from('prospects')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        company,
        title,
        phone,
        team_id: this.context.teamId,
        owner_id: this.context.userId,
        status: 'new',
        priority_score: 50,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Successfully added ${firstName} ${lastName} from ${company} to your prospects!`,
      data: prospect,
    };
  }

  private async updateDealStage(data: any) {
    const { dealId, newStage } = data;

    const { data: deal, error } = await supabase
      .from('deals')
      .update({ stage: newStage })
      .eq('id', dealId)
      .eq('team_id', this.context.teamId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Successfully moved deal to ${newStage} stage!`,
      data: deal,
    };
  }

  getHistory(): AgentMessage[] {
    return this.context.history;
  }

  clearHistory(): void {
    this.context.history = [];
    this.context.pendingAction = undefined;
  }
}

export function createAIAgent(teamId: string, userId?: string): AIAgent {
  return new AIAgent(teamId, userId);
}
