/**
 * Autonomous BDR Agent Orchestrator
 * The brain of the autonomous business development representative
 * Makes decisions, executes workflows, and learns from outcomes
 */

import { supabase } from '../supabase';
import { routeAIRequest } from './modelRouter';
import { calculateCompositeIntentScore } from '../intent/intentAggregator';
import { researchOrchestrator } from '../research/researchOrchestrator';
import type { WorkflowDefinition, WorkflowStep } from '../workflows/autonomousWorkflows';

export interface BDRAgentConfig {
  teamId: string;
  agentName: string;
  dailyOutreachLimit: number;
  autoApproveMessages: boolean;
  requireHumanHandoff: boolean;
  handoffThreshold: number; // Deal value that triggers human handoff
  enabled: boolean;
}

export interface BDRTask {
  id: string;
  type: 'discover' | 'research' | 'engage' | 'follow_up' | 'respond' | 'schedule' | 'qualify' | 'handoff';
  prospectId: string;
  priority: number; // 0-100
  scheduledFor: string;
  context: Record<string, any>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  workflowId?: string;
}

export interface BDRDecision {
  action: string;
  reasoning: string;
  confidence: number;
  alternatives: Array<{ action: string; score: number }>;
  metadata: Record<string, any>;
}

export interface BDRActivity {
  id: string;
  prospectId: string;
  activityType: string;
  channel: string;
  content: string;
  outcome: 'success' | 'failure' | 'pending';
  metadata: Record<string, any>;
  timestamp: string;
}

/**
 * Main BDR Agent Orchestrator Class
 */
export class BDRAgent {
  private config: BDRAgentConfig;
  private isRunning: boolean = false;
  private taskQueue: BDRTask[] = [];

  constructor(config: BDRAgentConfig) {
    this.config = config;
  }

  /**
   * Start the autonomous agent loop
   */
  async start(): Promise<void> {
    console.log(`🤖 BDR Agent "${this.config.agentName}" starting...`);
    this.isRunning = true;

    // Main agent loop
    while (this.isRunning) {
      try {
        // 1. Discover new prospects
        await this.discoverProspects();

        // 2. Process task queue
        await this.processTasks();

        // 3. Monitor for responses
        await this.monitorResponses();

        // 4. Learn from outcomes
        await this.learnFromOutcomes();

        // Wait before next iteration (every 5 minutes)
        await this.sleep(5 * 60 * 1000);
      } catch (error) {
        console.error('BDR Agent error:', error);
        // Continue running even on error
      }
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    console.log(`🛑 BDR Agent "${this.config.agentName}" stopping...`);
    this.isRunning = false;
  }

  /**
   * DISCOVER: Find and prioritize new prospects
   */
  async discoverProspects(): Promise<void> {
    console.log('🔍 Discovering prospects...');

    // Get prospects with high intent that haven't been contacted recently
    const { data: prospects } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('team_id', this.config.teamId)
      .gte('intent_score', 50) // Warm or higher
      .is('last_contacted_at', null) // Never contacted
      .or('last_contacted_at.lt.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Or >7 days ago
      .order('intent_score', { ascending: false })
      .limit(50);

    if (!prospects || prospects.length === 0) {
      console.log('No new prospects to engage');
      return;
    }

    // Make decisions for each prospect
    for (const prospect of prospects) {
      const decision = await this.makeDecision('should_engage', {
        prospect,
        intentScore: prospect.intent_score,
        tier: prospect.intent_tier,
      });

      if (decision.action === 'engage') {
        // Add to task queue
        await this.addTask({
          type: 'research',
          prospectId: prospect.id,
          priority: prospect.intent_score || 50,
          scheduledFor: new Date().toISOString(),
          context: { decision },
        });

        console.log(`✅ Added prospect ${prospect.first_name} ${prospect.last_name} to queue (intent: ${prospect.intent_score})`);
      }
    }
  }

  /**
   * Make an autonomous decision
   */
  async makeDecision(
    decisionType: string,
    context: Record<string, any>
  ): Promise<BDRDecision> {
    const prompts: Record<string, string> = {
      should_engage: this.buildShouldEngagePrompt(context),
      next_action: this.buildNextActionPrompt(context),
      channel_selection: this.buildChannelSelectionPrompt(context),
      timing: this.buildTimingPrompt(context),
      handoff: this.buildHandoffPrompt(context),
    };

    const prompt = prompts[decisionType] || 'Make a decision based on the context.';

    try {
      const response = await routeAIRequest(prompt, {
        taskType: 'general',
        teamId: this.config.teamId,
        fallbackEnabled: true,
      });

      // Parse AI response into structured decision
      const decision = this.parseDecision(response.response);

      // Log decision
      await this.logDecision(decisionType, context, decision);

      return decision;
    } catch (error) {
      console.error('Decision making failed:', error);
      // Fallback decision
      return {
        action: 'defer',
        reasoning: 'Unable to make decision, deferring to later',
        confidence: 0.3,
        alternatives: [],
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * PROCESS TASKS: Execute queued tasks
   */
  async processTasks(): Promise<void> {
    // Get pending tasks ordered by priority
    const tasks = this.taskQueue
      .filter(t => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10); // Process top 10

    console.log(`📋 Processing ${tasks.length} tasks...`);

    for (const task of tasks) {
      try {
        task.status = 'in_progress';

        switch (task.type) {
          case 'research':
            await this.executeResearchTask(task);
            break;
          case 'engage':
            await this.executeEngageTask(task);
            break;
          case 'follow_up':
            await this.executeFollowUpTask(task);
            break;
          case 'respond':
            await this.executeRespondTask(task);
            break;
          case 'schedule':
            await this.executeScheduleTask(task);
            break;
          case 'qualify':
            await this.executeQualifyTask(task);
            break;
          case 'handoff':
            await this.executeHandoffTask(task);
            break;
        }

        task.status = 'completed';
        console.log(`✅ Completed task: ${task.type} for prospect ${task.prospectId}`);
      } catch (error) {
        console.error(`Task execution failed:`, error);
        task.status = 'failed';
      }
    }

    // Remove completed tasks
    this.taskQueue = this.taskQueue.filter(t => t.status !== 'completed');
  }

  /**
   * Execute research task
   */
  async executeResearchTask(task: BDRTask): Promise<void> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('id', task.prospectId)
      .single();

    if (!prospect) return;

    // Deep research on prospect and company
    let companyResearch = null;
    if (prospect.company_profiles) {
      companyResearch = await researchOrchestrator.executeResearch(
        this.config.teamId,
        prospect.company_profiles.id,
        prospect.company_profiles.name,
        prospect.company_profiles.website
      );
    }

    // Store research context
    await this.updateContext(task.prospectId, {
      researchCompleted: true,
      companyIntelligence: companyResearch?.aggregatedData,
      researchedAt: new Date().toISOString(),
    });

    // Next task: engage
    await this.addTask({
      type: 'engage',
      prospectId: task.prospectId,
      priority: task.priority,
      scheduledFor: new Date().toISOString(),
      context: { ...task.context, companyResearch },
    });
  }

  /**
   * Execute engage task (initial outreach)
   */
  async executeEngageTask(task: BDRTask): Promise<void> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('id', task.prospectId)
      .single();

    if (!prospect) return;

    // Get context
    const context = await this.getContext(task.prospectId);

    // Decide on channel
    const channelDecision = await this.makeDecision('channel_selection', {
      prospect,
      context,
      availableChannels: ['email', 'linkedin'],
    });

    // Generate personalized message
    const message = await this.generateMessage('initial_outreach', {
      prospect,
      context,
      channel: channelDecision.action,
    });

    // Check if requires approval
    if (!this.config.autoApproveMessages) {
      await this.requestApproval({
        prospectId: task.prospectId,
        messageType: 'initial_outreach',
        channel: channelDecision.action,
        message,
      });
      return;
    }

    // Send message
    await this.sendMessage(prospect, channelDecision.action, message);

    // Update prospect
    await supabase
      .from('prospects')
      .update({
        last_contacted_at: new Date().toISOString(),
        contact_count: (prospect.contact_count || 0) + 1,
      })
      .eq('id', task.prospectId);

    // Schedule follow-up
    const followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    await this.addTask({
      type: 'follow_up',
      prospectId: task.prospectId,
      priority: task.priority - 10,
      scheduledFor: followUpDate.toISOString(),
      context: { touchNumber: 1 },
    });

    // Log activity
    await this.logActivity({
      prospectId: task.prospectId,
      activityType: 'outreach',
      channel: channelDecision.action,
      content: message.subject + '\n\n' + message.body,
      outcome: 'pending',
      metadata: { automated: true },
    });
  }

  /**
   * Execute follow-up task
   */
  async executeFollowUpTask(task: BDRTask): Promise<void> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', task.prospectId)
      .single();

    if (!prospect) return;

    // Check if prospect has responded
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('prospect_id', task.prospectId)
      .eq('type', 'email_reply')
      .gte('created_at', prospect.last_contacted_at)
      .limit(1);

    if (activities && activities.length > 0) {
      console.log('Prospect already responded, skipping follow-up');
      return;
    }

    // Check touch count
    const touchNumber = task.context.touchNumber || 1;
    if (touchNumber >= 5) {
      console.log('Max touches reached, marking as unresponsive');
      await supabase
        .from('prospects')
        .update({ status: 'unresponsive' })
        .eq('id', task.prospectId);
      return;
    }

    // Generate follow-up message
    const context = await this.getContext(task.prospectId);
    const message = await this.generateMessage('follow_up', {
      prospect,
      context,
      touchNumber,
    });

    // Send follow-up
    await this.sendMessage(prospect, 'email', message);

    // Update prospect
    await supabase
      .from('prospects')
      .update({
        last_contacted_at: new Date().toISOString(),
        contact_count: (prospect.contact_count || 0) + 1,
      })
      .eq('id', task.prospectId);

    // Schedule next follow-up
    const daysToWait = touchNumber === 1 ? 3 : touchNumber === 2 ? 4 : 7;
    const nextFollowUpDate = new Date(Date.now() + daysToWait * 24 * 60 * 60 * 1000);

    await this.addTask({
      type: 'follow_up',
      prospectId: task.prospectId,
      priority: task.priority - 5,
      scheduledFor: nextFollowUpDate.toISOString(),
      context: { touchNumber: touchNumber + 1 },
    });

    // Log activity
    await this.logActivity({
      prospectId: task.prospectId,
      activityType: 'follow_up',
      channel: 'email',
      content: message.subject + '\n\n' + message.body,
      outcome: 'pending',
      metadata: { automated: true, touchNumber },
    });
  }

  /**
   * Execute respond task (reply to prospect)
   */
  async executeRespondTask(task: BDRTask): Promise<void> {
    // This will be implemented in Week 3-4 with conversational engine
    console.log('Respond task - requires conversational engine');
  }

  /**
   * Execute schedule task (book meeting)
   */
  async executeScheduleTask(task: BDRTask): Promise<void> {
    // This will be implemented in Week 7-8 with meeting scheduler
    console.log('Schedule task - requires meeting scheduler');
  }

  /**
   * Execute qualify task
   */
  async executeQualifyTask(task: BDRTask): Promise<void> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('id', task.prospectId)
      .single();

    if (!prospect) return;

    // Qualify based on BANT
    const qualificationScore = await this.qualifyProspect(prospect);

    // Update prospect
    await supabase
      .from('prospects')
      .update({
        qualification_score: qualificationScore,
        qualified_at: qualificationScore >= 70 ? new Date().toISOString() : null,
      })
      .eq('id', task.prospectId);

    // Decide next action based on qualification
    if (qualificationScore >= 90) {
      // Highly qualified - hand off to human
      await this.addTask({
        type: 'handoff',
        prospectId: task.prospectId,
        priority: 95,
        scheduledFor: new Date().toISOString(),
        context: { reason: 'highly_qualified', score: qualificationScore },
      });
    } else if (qualificationScore >= 70) {
      // Qualified - continue automated outreach
      console.log(`Prospect qualified (score: ${qualificationScore}), continuing engagement`);
    } else {
      // Not qualified - mark for nurture
      await supabase
        .from('prospects')
        .update({ status: 'nurture' })
        .eq('id', task.prospectId);
    }
  }

  /**
   * Execute handoff task (transfer to human)
   */
  async executeHandoffTask(task: BDRTask): Promise<void> {
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', task.prospectId)
      .single();

    if (!prospect) return;

    // Create handoff record
    await supabase.from('bdr_handoffs').insert({
      team_id: this.config.teamId,
      prospect_id: task.prospectId,
      reason: task.context.reason,
      context_summary: await this.generateHandoffSummary(task.prospectId),
      recommended_next_steps: await this.generateNextSteps(task.prospectId),
      priority: task.priority,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ status: 'handed_off', assigned_to: null })
      .eq('id', task.prospectId);

    console.log(`🤝 Handed off prospect ${prospect.first_name} ${prospect.last_name} to human`);
  }

  /**
   * MONITOR: Check for responses and triggers
   */
  async monitorResponses(): Promise<void> {
    // Check for new email replies in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: newReplies } = await supabase
      .from('activities')
      .select('*, prospects(*)')
      .eq('type', 'email_reply')
      .gte('created_at', fiveMinutesAgo)
      .is('processed_by_bdr_agent', false);

    if (!newReplies || newReplies.length === 0) return;

    console.log(`📧 Found ${newReplies.length} new replies to process`);

    for (const reply of newReplies) {
      // Add respond task
      await this.addTask({
        type: 'respond',
        prospectId: reply.prospect_id,
        priority: 80, // High priority
        scheduledFor: new Date().toISOString(),
        context: { replyId: reply.id, replyContent: reply.description },
      });

      // Mark as processed
      await supabase
        .from('activities')
        .update({ processed_by_bdr_agent: true })
        .eq('id', reply.id);
    }
  }

  /**
   * LEARN: Analyze outcomes and improve
   */
  async learnFromOutcomes(): Promise<void> {
    // This will be implemented in Week 9-10 with learning engine
    // For now, just log basic metrics
    const { data: metrics } = await supabase
      .from('bdr_activities')
      .select('outcome')
      .eq('team_id', this.config.teamId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (metrics) {
      const total = metrics.length;
      const successful = metrics.filter(m => m.outcome === 'success').length;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      console.log(`📊 Last 24h: ${total} activities, ${successRate.toFixed(1)}% success rate`);
    }
  }

  // Helper methods

  private async addTask(taskData: Omit<BDRTask, 'id' | 'status'>): Promise<void> {
    const task: BDRTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...taskData,
      status: 'pending',
    };

    this.taskQueue.push(task);

    // Also persist to database
    await supabase.from('bdr_tasks').insert({
      team_id: this.config.teamId,
      task_type: task.type,
      prospect_id: task.prospectId,
      priority: task.priority,
      scheduled_for: task.scheduledFor,
      context: task.context,
      status: task.status,
    });
  }

  private async getContext(prospectId: string): Promise<Record<string, any>> {
    const { data } = await supabase
      .from('bdr_context_memory')
      .select('context_data')
      .eq('prospect_id', prospectId)
      .single();

    return data?.context_data || {};
  }

  private async updateContext(prospectId: string, updates: Record<string, any>): Promise<void> {
    const existing = await this.getContext(prospectId);
    const merged = { ...existing, ...updates, lastUpdated: new Date().toISOString() };

    await supabase.from('bdr_context_memory').upsert({
      team_id: this.config.teamId,
      prospect_id: prospectId,
      context_data: merged,
      updated_at: new Date().toISOString(),
    });
  }

  private async generateMessage(
    messageType: string,
    context: any
  ): Promise<{ subject: string; body: string }> {
    const prompt = this.buildMessagePrompt(messageType, context);

    const response = await routeAIRequest(prompt, {
      taskType: 'email-generation',
      teamId: this.config.teamId,
      prioritizeCost: true,
      fallbackEnabled: true,
    });

    // Parse response into subject and body
    return this.parseMessage(response.response);
  }

  private async sendMessage(prospect: any, channel: string, message: any): Promise<void> {
    // This will integrate with actual email/LinkedIn APIs
    console.log(`📤 Sending ${channel} to ${prospect.email}: ${message.subject}`);

    // For now, just create activity record
    await supabase.from('activities').insert({
      team_id: this.config.teamId,
      prospect_id: prospect.id,
      type: channel === 'email' ? 'email_sent' : 'linkedin_message',
      description: `${message.subject}\n\n${message.body}`,
      created_at: new Date().toISOString(),
    });
  }

  private async qualifyProspect(prospect: any): Promise<number> {
    // Simple BANT-based qualification
    let score = 0;

    // Budget (company size, funding)
    if (prospect.company_profiles?.employee_count > 100) score += 25;
    if (prospect.company_profiles?.funding_amount > 5000000) score += 10;

    // Authority (title seniority)
    const title = prospect.title?.toLowerCase() || '';
    if (title.includes('ceo') || title.includes('founder')) score += 30;
    else if (title.includes('vp') || title.includes('director')) score += 25;
    else if (title.includes('manager')) score += 15;

    // Need (intent score)
    score += Math.round((prospect.intent_score || 0) * 0.25);

    // Timeline (recent activity)
    if (prospect.last_activity_at) {
      const daysSince = (Date.now() - new Date(prospect.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += 10;
    }

    return Math.min(100, score);
  }

  private async logActivity(activity: Omit<BDRActivity, 'id' | 'timestamp'>): Promise<void> {
    await supabase.from('bdr_activities').insert({
      team_id: this.config.teamId,
      ...activity,
      timestamp: new Date().toISOString(),
    });
  }

  private async logDecision(
    decisionType: string,
    context: any,
    decision: BDRDecision
  ): Promise<void> {
    await supabase.from('bdr_decisions').insert({
      team_id: this.config.teamId,
      decision_type: decisionType,
      context_data: context,
      action_taken: decision.action,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      created_at: new Date().toISOString(),
    });
  }

  private async requestApproval(approvalRequest: any): Promise<void> {
    await supabase.from('bdr_approval_queue').insert({
      team_id: this.config.teamId,
      ...approvalRequest,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  private async generateHandoffSummary(prospectId: string): Promise<string> {
    const context = await this.getContext(prospectId);
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('timestamp', { ascending: false })
      .limit(10);

    return `Context: ${JSON.stringify(context)}\n\nRecent Activities: ${activities?.length || 0} activities`;
  }

  private async generateNextSteps(prospectId: string): Promise<string[]> {
    return [
      'Review conversation history',
      'Schedule discovery call',
      'Send personalized demo invite',
    ];
  }

  // Prompt builders

  private buildShouldEngagePrompt(context: any): string {
    return `You are an autonomous BDR evaluating whether to engage with a prospect.

Prospect: ${context.prospect.first_name} ${context.prospect.last_name}
Title: ${context.prospect.title}
Company: ${context.prospect.company}
Intent Score: ${context.intentScore}/100
Intent Tier: ${context.tier}

Based on this information, should we engage with this prospect?
Respond with JSON: { "action": "engage" or "defer", "reasoning": "explanation", "confidence": 0-1 }`;
  }

  private buildNextActionPrompt(context: any): string {
    return `Determine the next best action for this prospect.

Context: ${JSON.stringify(context)}

What should we do next? Options: research, outreach, follow_up, qualify, handoff
Respond with JSON: { "action": "action_name", "reasoning": "explanation", "confidence": 0-1 }`;
  }

  private buildChannelSelectionPrompt(context: any): string {
    return `Select the best channel to reach this prospect.

Prospect: ${context.prospect.first_name} ${context.prospect.last_name}
Available channels: ${context.availableChannels.join(', ')}

Which channel should we use?
Respond with JSON: { "action": "channel_name", "reasoning": "explanation", "confidence": 0-1 }`;
  }

  private buildTimingPrompt(context: any): string {
    return `Determine the optimal time to send the next message.

Respond with JSON: { "action": "send_now" or "delay_X_hours", "reasoning": "explanation", "confidence": 0-1 }`;
  }

  private buildHandoffPrompt(context: any): string {
    return `Determine if this prospect should be handed off to a human.

Context: ${JSON.stringify(context)}

Should we hand off to human?
Respond with JSON: { "action": "handoff" or "continue_automated", "reasoning": "explanation", "confidence": 0-1 }`;
  }

  private buildMessagePrompt(messageType: string, context: any): string {
    const prospect = context.prospect;
    const research = context.companyResearch || context.context?.companyIntelligence;

    if (messageType === 'initial_outreach') {
      return `Generate a personalized cold outreach email.

Prospect: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}

Company Research: ${JSON.stringify(research)}

Create a compelling, personalized email that:
1. References something specific about their company
2. Identifies a pain point they likely have
3. Offers clear value
4. Includes a soft CTA

Respond with JSON: { "subject": "subject line", "body": "email body" }`;
    } else if (messageType === 'follow_up') {
      return `Generate a follow-up email (touch #${context.touchNumber}).

Original context: ${JSON.stringify(context.context)}

Create a friendly follow-up that:
1. Adds new value (insight, case study, etc.)
2. Makes it easy to respond
3. Isn't pushy

Respond with JSON: { "subject": "subject line", "body": "email body" }`;
    }

    return 'Generate an appropriate message for this situation.';
  }

  private parseDecision(response: string): BDRDecision {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'defer',
          reasoning: parsed.reasoning || 'No reasoning provided',
          confidence: parsed.confidence || 0.5,
          alternatives: parsed.alternatives || [],
          metadata: {},
        };
      }
    } catch (error) {
      console.error('Failed to parse decision:', error);
    }

    // Fallback
    return {
      action: 'defer',
      reasoning: 'Unable to parse AI response',
      confidence: 0.3,
      alternatives: [],
      metadata: { rawResponse: response },
    };
  }

  private parseMessage(response: string): { subject: string; body: string } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || 'Follow up',
          body: parsed.body || response,
        };
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }

    // Fallback - try to extract subject and body from text
    const lines = response.split('\n');
    return {
      subject: lines[0] || 'Follow up',
      body: lines.slice(1).join('\n') || response,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create and start a BDR agent
 */
export async function startBDRAgent(config: BDRAgentConfig): Promise<BDRAgent> {
  const agent = new BDRAgent(config);

  // Save agent configuration
  await supabase.from('bdr_agent_configs').upsert({
    team_id: config.teamId,
    agent_name: config.agentName,
    daily_outreach_limit: config.dailyOutreachLimit,
    auto_approve_messages: config.autoApproveMessages,
    require_human_handoff: config.requireHumanHandoff,
    handoff_threshold: config.handoffThreshold,
    enabled: config.enabled,
    last_started_at: new Date().toISOString(),
  });

  // Start the agent (in background)
  agent.start().catch(err => console.error('BDR Agent error:', err));

  return agent;
}

/**
 * Stop a running BDR agent
 */
export async function stopBDRAgent(teamId: string): Promise<void> {
  await supabase
    .from('bdr_agent_configs')
    .update({ enabled: false, last_stopped_at: new Date().toISOString() })
    .eq('team_id', teamId);
}
