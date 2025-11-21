/**
 * Smart Response Router
 * Automatically processes incoming replies and routes to appropriate handlers
 */

import { supabase } from '../supabase';
import { IntegratedOutreachEngine } from './integratedOutreachEngine';

export interface IncomingReply {
  id: string;
  prospectId: string;
  teamId: string;

  from: string;
  subject: string;
  body: string;
  receivedAt: string;

  // Thread context
  threadId?: string;
  inReplyTo?: string;
  conversationHistory?: string[];

  // Status
  processed: boolean;
  processedAt?: string;
  processingResult?: any;
}

export interface RoutingDecision {
  prospectId: string;
  replyId: string;

  // Classification
  category: string;
  sentiment: string;
  intents: any[];

  // Routing
  routedTo: 'objection_handler' | 'meeting_scheduler' | 'human' | 'auto_responder' | 'suppression';
  reasoning: string;
  confidence: number;

  // Action taken
  actionTaken: string;
  responseGenerated?: string;
  responseSent: boolean;
  requiresHumanReview: boolean;

  // Results
  meetingScheduled?: boolean;
  objectionHandled?: boolean;
  escalatedToHuman?: boolean;

  processedAt: string;
}

/**
 * Smart Response Router
 * Monitors inbox and automatically routes replies
 */
export class SmartResponseRouter {
  private teamId: string;
  private userId: string;
  private outreachEngine: IntegratedOutreachEngine;

  private isRunning: boolean = false;
  private pollInterval: number = 30000; // 30 seconds

  constructor(teamId: string, userId: string) {
    this.teamId = teamId;
    this.userId = userId;
    this.outreachEngine = new IntegratedOutreachEngine(teamId, userId);
  }

  /**
   * Start monitoring for new replies
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[ResponseRouter] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[ResponseRouter] Started monitoring for replies');

    while (this.isRunning) {
      try {
        await this.processNewReplies();
      } catch (error) {
        console.error('[ResponseRouter] Error processing replies:', error);
      }

      // Wait before next check
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    console.log('[ResponseRouter] Stopped monitoring');
  }

  /**
   * Process all new unprocessed replies
   */
  async processNewReplies(): Promise<RoutingDecision[]> {
    // Get unprocessed replies
    const replies = await this.fetchUnprocessedReplies();

    if (replies.length === 0) {
      return [];
    }

    console.log(`[ResponseRouter] Processing ${replies.length} new replies`);

    const decisions: RoutingDecision[] = [];

    // Process each reply
    for (const reply of replies) {
      try {
        const decision = await this.processReply(reply);
        decisions.push(decision);

        // Mark as processed
        await this.markReplyProcessed(reply.id, decision);
      } catch (error) {
        console.error(`[ResponseRouter] Failed to process reply ${reply.id}:`, error);

        // Mark as processed with error
        await this.markReplyProcessed(reply.id, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return decisions;
  }

  /**
   * Process a single reply and route to appropriate handler
   */
  async processReply(reply: IncomingReply): Promise<RoutingDecision> {
    console.log(`[ResponseRouter] Processing reply from ${reply.from}`);

    // Use the integrated outreach engine to process the reply
    const result = await this.outreachEngine.processIncomingReply({
      prospectId: reply.prospectId,
      emailSubject: reply.subject,
      emailBody: reply.body,
      conversationHistory: reply.conversationHistory,
    });

    // Create routing decision
    const decision: RoutingDecision = {
      prospectId: reply.prospectId,
      replyId: reply.id,

      category: result.classification.category,
      sentiment: result.classification.sentiment.label,
      intents: result.classification.intents,

      routedTo: this.mapActionToRoute(result.action),
      reasoning: result.classification.suggestedAction.reasoning,
      confidence: result.classification.confidence,

      actionTaken: result.action,
      responseGenerated: result.response,
      responseSent: false,
      requiresHumanReview: result.classification.requiresHumanReview,

      meetingScheduled: !!result.meetingId,
      objectionHandled: result.action === 'objection_handled',
      escalatedToHuman: result.action === 'escalate_to_human',

      processedAt: new Date().toISOString(),
    };

    // Take action based on routing
    await this.executeRoutingAction(decision, reply, result);

    // Log the decision
    await this.logRoutingDecision(decision);

    return decision;
  }

  /**
   * Get routing statistics
   */
  async getRoutingStats(daysBack: number = 30): Promise<{
    totalProcessed: number;
    byCategory: Record<string, number>;
    byRoute: Record<string, number>;
    avgConfidence: number;
    autoHandledPercent: number;
    escalatedPercent: number;
    responseRate: number;
  }> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const { data: decisions } = await supabase
      .from('response_routing_decisions')
      .select('*')
      .eq('team_id', this.teamId)
      .gte('processed_at', since.toISOString());

    if (!decisions || decisions.length === 0) {
      return {
        totalProcessed: 0,
        byCategory: {},
        byRoute: {},
        avgConfidence: 0,
        autoHandledPercent: 0,
        escalatedPercent: 0,
        responseRate: 0,
      };
    }

    // Calculate stats
    const byCategory: Record<string, number> = {};
    const byRoute: Record<string, number> = {};
    let totalConfidence = 0;
    let autoHandled = 0;
    let escalated = 0;
    let responseSent = 0;

    for (const decision of decisions) {
      byCategory[decision.category] = (byCategory[decision.category] || 0) + 1;
      byRoute[decision.routed_to] = (byRoute[decision.routed_to] || 0) + 1;
      totalConfidence += decision.confidence;

      if (decision.routed_to !== 'human') autoHandled++;
      if (decision.escalated_to_human) escalated++;
      if (decision.response_sent) responseSent++;
    }

    return {
      totalProcessed: decisions.length,
      byCategory,
      byRoute,
      avgConfidence: totalConfidence / decisions.length,
      autoHandledPercent: (autoHandled / decisions.length) * 100,
      escalatedPercent: (escalated / decisions.length) * 100,
      responseRate: (responseSent / decisions.length) * 100,
    };
  }

  /**
   * Get pending human review queue
   */
  async getHumanReviewQueue(): Promise<Array<{
    decision: RoutingDecision;
    reply: IncomingReply;
    prospect: any;
  }>> {
    const { data: decisions } = await supabase
      .from('response_routing_decisions')
      .select('*, incoming_replies(*), prospects(*)')
      .eq('team_id', this.teamId)
      .eq('requires_human_review', true)
      .eq('escalated_to_human', false)
      .order('processed_at', { ascending: true });

    return decisions || [];
  }

  // Private helper methods

  private async fetchUnprocessedReplies(): Promise<IncomingReply[]> {
    const { data } = await supabase
      .from('incoming_replies')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('processed', false)
      .order('received_at', { ascending: true })
      .limit(50);

    return data || [];
  }

  private mapActionToRoute(action: string): RoutingDecision['routedTo'] {
    switch (action) {
      case 'objection_handled':
        return 'objection_handler';
      case 'meeting_scheduled':
        return 'meeting_scheduler';
      case 'escalate_to_human':
        return 'human';
      case 'continue_nurture':
        return 'auto_responder';
      default:
        return 'human';
    }
  }

  private async executeRoutingAction(
    decision: RoutingDecision,
    reply: IncomingReply,
    result: any
  ): Promise<void> {
    // Send response if generated and not requiring human review
    if (
      result.response &&
      !decision.requiresHumanReview &&
      decision.routedTo !== 'human'
    ) {
      // Check auto-approval settings
      const { data: config } = await supabase
        .from('bdr_agent_configs')
        .select('auto_approve_messages')
        .eq('team_id', this.teamId)
        .single();

      if (config?.auto_approve_messages) {
        // Send automatically
        await this.sendResponse(reply, result.response);
        decision.responseSent = true;
      } else {
        // Add to approval queue
        await supabase.from('bdr_approval_queue').insert({
          team_id: this.teamId,
          prospect_id: reply.prospectId,
          approval_type: 'email',
          message_body: result.response,
          ai_reasoning: decision.reasoning,
          ai_confidence: decision.confidence,
        });
      }
    }

    // Create handoff if escalated
    if (decision.escalatedToHuman) {
      await this.createHumanHandoff(reply, decision);
    }

    // Update prospect status
    await this.updateProspectStatus(reply.prospectId, decision);
  }

  private async sendResponse(reply: IncomingReply, response: string): Promise<void> {
    // In production, would send via email service

    // Log activity
    await supabase.from('bdr_activities').insert({
      team_id: this.teamId,
      prospect_id: reply.prospectId,
      activity_type: 'email_sent',
      channel: 'email',
      direction: 'outbound',
      subject: `Re: ${reply.subject}`,
      message_preview: response.substring(0, 200),
      full_content: response,
      was_automated: true,
      metadata: {
        in_reply_to: reply.id,
        automated_response: true,
      },
    });

    console.log(`[ResponseRouter] Sent automated response to ${reply.from}`);
  }

  private async createHumanHandoff(reply: IncomingReply, decision: RoutingDecision): Promise<void> {
    await supabase.from('bdr_handoffs').insert({
      team_id: this.teamId,
      prospect_id: reply.prospectId,
      handoff_type: 'needs_help',
      priority: decision.confidence < 0.5 ? 'high' : 'medium',
      executive_summary: `Prospect replied with ${decision.category}. ${decision.reasoning}`,
      key_insights: decision.intents,
      conversation_summary: reply.body.substring(0, 500),
      suggested_next_steps: [
        `Review reply: "${reply.subject}"`,
        'Respond appropriately based on context',
        decision.responseGenerated ? `AI suggested: ${decision.responseGenerated}` : '',
      ],
      status: 'pending',
    });

    console.log(`[ResponseRouter] Created handoff for prospect ${reply.prospectId}`);
  }

  private async updateProspectStatus(prospectId: string, decision: RoutingDecision): Promise<void> {
    const updates: any = {
      last_responded_at: new Date().toISOString(),
      response_count: supabase.rpc('increment', { amount: 1 }),
    };

    // Update relationship stage based on response type
    if (decision.category === 'positive_interest' || decision.category === 'meeting_request') {
      updates.relationship_stage = 'interested';
    } else if (decision.category === 'not_interested') {
      updates.relationship_stage = 'disqualified';
    }

    await supabase
      .from('prospects')
      .update(updates)
      .eq('id', prospectId);
  }

  private async markReplyProcessed(replyId: string, result: any): Promise<void> {
    await supabase
      .from('incoming_replies')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        processing_result: result,
      })
      .eq('id', replyId);
  }

  private async logRoutingDecision(decision: RoutingDecision): Promise<void> {
    await supabase.from('response_routing_decisions').insert({
      team_id: this.teamId,
      prospect_id: decision.prospectId,
      reply_id: decision.replyId,
      category: decision.category,
      sentiment: decision.sentiment,
      intents: decision.intents,
      routed_to: decision.routedTo,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      action_taken: decision.actionTaken,
      response_generated: decision.responseGenerated,
      response_sent: decision.responseSent,
      requires_human_review: decision.requiresHumanReview,
      meeting_scheduled: decision.meetingScheduled,
      objection_handled: decision.objectionHandled,
      escalated_to_human: decision.escalatedToHuman,
      processed_at: decision.processedAt,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create and start response router
 */
export async function startResponseRouter(teamId: string, userId: string): Promise<SmartResponseRouter> {
  const router = new SmartResponseRouter(teamId, userId);
  // Don't await - let it run in background
  router.start();
  return router;
}

/**
 * Simulate incoming reply (for testing)
 */
export async function simulateIncomingReply(params: {
  teamId: string;
  prospectId: string;
  from: string;
  subject: string;
  body: string;
}): Promise<IncomingReply> {
  const { data: reply } = await supabase
    .from('incoming_replies')
    .insert({
      team_id: params.teamId,
      prospect_id: params.prospectId,
      from: params.from,
      subject: params.subject,
      body: params.body,
      received_at: new Date().toISOString(),
      processed: false,
    })
    .select()
    .single();

  return reply as IncomingReply;
}
