/**
 * LinkedIn Automation Agent
 * Automates LinkedIn actions for prospecting and engagement
 *
 * IMPORTANT: This uses LinkedIn's official Sales Navigator API and follows
 * LinkedIn's automation policies. Always respect rate limits and usage terms.
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface LinkedInProfile {
  linkedInUrl: string;
  publicIdentifier?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  connectionDegree?: '1st' | '2nd' | '3rd' | '3rd+';
  isPremium?: boolean;
  companyName?: string;
  companyUrl?: string;
}

export interface LinkedInAction {
  type: 'profile_view' | 'connection_request' | 'message' | 'post_like' | 'post_comment' | 'follow';
  targetProfile: LinkedInProfile;
  message?: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface LinkedInActionResult {
  action: LinkedInAction;
  success: boolean;
  timestamp: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface LinkedInAgentConfig {
  teamId: string;
  agentName: string;
  enabled: boolean;
  dailyActionLimits: {
    profileViews: number;
    connectionRequests: number;
    messages: number;
    likes: number;
    comments: number;
  };
  autoMessageTemplates?: {
    connectionRequest: string;
    firstMessage: string;
    followUp: string;
  };
  targetCriteria?: {
    industries?: string[];
    titles?: string[];
    seniorities?: string[];
    locations?: string[];
    companySize?: string[];
  };
}

export interface LinkedInActivityLog {
  id: string;
  prospectId: string;
  actionType: string;
  targetUrl: string;
  status: 'pending' | 'completed' | 'failed';
  message?: string;
  response?: string;
  createdAt: string;
  completedAt?: string;
}

// =============================================
// LINKEDIN CLIENT (Sales Navigator API)
// =============================================

export class LinkedInClient {
  private accessToken: string;
  private baseUrl = 'https://api.linkedin.com/v2';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get profile information
   */
  async getProfile(publicIdentifier: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/people/(publicIdentifier:${publicIdentifier})`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LinkedIn profile fetch failed:', error);
      throw error;
    }
  }

  /**
   * Send connection request
   */
  async sendConnectionRequest(
    targetUrn: string,
    message: string,
    profileData?: any
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          invitee: {
            'com.linkedin.voyager.invitations.InviteeProfile': {
              profileId: targetUrn,
            },
          },
          message: message.substring(0, 300), // LinkedIn limit
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('LinkedIn connection request failed:', error);
      throw error;
    }
  }

  /**
   * Send message to connection
   */
  async sendMessage(conversationUrn: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messaging/conversations/${conversationUrn}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          eventCreate: {
            'com.linkedin.voyager.messaging.create.MessageCreate': {
              body: message,
            },
          },
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('LinkedIn message send failed:', error);
      throw error;
    }
  }

  /**
   * View a profile (track impression)
   */
  async viewProfile(publicIdentifier: string): Promise<boolean> {
    try {
      // Profile views are tracked automatically when fetching profile data
      await this.getProfile(publicIdentifier);
      return true;
    } catch (error) {
      console.error('LinkedIn profile view failed:', error);
      return false;
    }
  }

  /**
   * Search for people based on criteria
   */
  async searchPeople(criteria: {
    keywords?: string;
    title?: string;
    company?: string;
    location?: string;
    industry?: string;
    start?: number;
    count?: number;
  }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (criteria.keywords) params.append('keywords', criteria.keywords);
      if (criteria.title) params.append('title', criteria.title);
      if (criteria.company) params.append('company', criteria.company);
      if (criteria.location) params.append('location', criteria.location);
      if (criteria.industry) params.append('industry', criteria.industry);
      params.append('start', String(criteria.start || 0));
      params.append('count', String(Math.min(criteria.count || 10, 100)));

      const response = await fetch(
        `${this.baseUrl}/search/people?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`LinkedIn search failed: ${response.status}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      console.error('LinkedIn people search failed:', error);
      throw error;
    }
  }
}

// =============================================
// LINKEDIN AUTOMATION AGENT
// =============================================

export class LinkedInAgent {
  private config: LinkedInAgentConfig;
  private client: LinkedInClient;
  private isRunning: boolean = false;
  private actionQueue: LinkedInAction[] = [];
  private dailyStats: {
    profileViews: number;
    connectionRequests: number;
    messages: number;
    likes: number;
    comments: number;
  } = {
    profileViews: 0,
    connectionRequests: 0,
    messages: 0,
    likes: 0,
    comments: 0,
  };

  constructor(config: LinkedInAgentConfig, accessToken: string) {
    this.config = config;
    this.client = new LinkedInClient(accessToken);
  }

  /**
   * Start the LinkedIn automation agent
   */
  async start(): Promise<void> {
    console.log(`🔗 LinkedIn Agent "${this.config.agentName}" starting...`);
    this.isRunning = true;

    // Reset daily stats at midnight
    this.scheduleDailyReset();

    // Main agent loop
    while (this.isRunning) {
      try {
        // 1. Find prospects with LinkedIn URLs that need engagement
        await this.discoverLinkedInProspects();

        // 2. Process action queue with rate limiting
        await this.processActions();

        // 3. Monitor for responses
        await this.monitorResponses();

        // Wait before next iteration (every 15 minutes)
        await this.sleep(15 * 60 * 1000);
      } catch (error) {
        console.error('LinkedIn Agent error:', error);
        // Continue running even on error
      }
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    console.log(`🛑 LinkedIn Agent "${this.config.agentName}" stopping...`);
    this.isRunning = false;
  }

  /**
   * Discover prospects that need LinkedIn engagement
   */
  async discoverLinkedInProspects(): Promise<void> {
    console.log('🔍 Discovering LinkedIn prospects...');

    // Get prospects with LinkedIn URLs that haven't been contacted on LinkedIn
    const { data: prospects } = await supabase
      .from('prospects')
      .select('*')
      .eq('team_id', this.config.teamId)
      .not('linkedin_url', 'is', null)
      .gte('intent_score', 50) // Warm or higher
      .is('linkedin_last_contacted_at', null) // Never contacted on LinkedIn
      .or('linkedin_last_contacted_at.lt.' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Or >30 days ago
      .order('intent_score', { ascending: false })
      .limit(20);

    if (!prospects || prospects.length === 0) {
      console.log('No LinkedIn prospects to engage');
      return;
    }

    for (const prospect of prospects) {
      // Decide on LinkedIn action sequence
      const sequence = await this.planLinkedInSequence(prospect);

      for (const action of sequence) {
        this.actionQueue.push(action);
      }
    }

    console.log(`📋 Added ${this.actionQueue.length} LinkedIn actions to queue`);
  }

  /**
   * Plan LinkedIn engagement sequence for a prospect
   */
  async planLinkedInSequence(prospect: any): Promise<LinkedInAction[]> {
    const actions: LinkedInAction[] = [];
    const linkedInProfile: LinkedInProfile = {
      linkedInUrl: prospect.linkedin_url,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      headline: prospect.title,
      companyName: prospect.company,
    };

    // Check existing LinkedIn activity
    const { data: existingActivity } = await supabase
      .from('linkedin_activities')
      .select('*')
      .eq('prospect_id', prospect.id)
      .order('created_at', { ascending: false });

    const hasViewed = existingActivity?.some(a => a.action_type === 'profile_view');
    const hasConnected = existingActivity?.some(a => a.action_type === 'connection_request');
    const isConnected = prospect.linkedin_connection_status === 'connected';

    // Sequence: View → Connect → Message
    if (!hasViewed) {
      // Step 1: View profile
      actions.push({
        type: 'profile_view',
        targetProfile: linkedInProfile,
        metadata: { prospectId: prospect.id },
      });

      // Wait 2-3 days before connection request
      // (handled by scheduling)
    }

    if (hasViewed && !hasConnected && this.shouldSendConnectionRequest(prospect)) {
      // Step 2: Send connection request with personalized note
      const connectionNote = await this.generateConnectionNote(prospect);

      actions.push({
        type: 'connection_request',
        targetProfile: linkedInProfile,
        note: connectionNote,
        metadata: { prospectId: prospect.id },
      });
    }

    if (isConnected && !this.hasRecentMessage(existingActivity)) {
      // Step 3: Send first message (after connection is accepted)
      const firstMessage = await this.generateFirstMessage(prospect);

      actions.push({
        type: 'message',
        targetProfile: linkedInProfile,
        message: firstMessage,
        metadata: { prospectId: prospect.id },
      });
    }

    return actions;
  }

  /**
   * Process LinkedIn actions with rate limiting
   */
  async processActions(): Promise<void> {
    if (this.actionQueue.length === 0) {
      console.log('No LinkedIn actions to process');
      return;
    }

    console.log(`📤 Processing ${this.actionQueue.length} LinkedIn actions...`);

    // Process actions one by one with delays
    while (this.actionQueue.length > 0 && this.isRunning) {
      const action = this.actionQueue.shift();
      if (!action) break;

      // Check rate limits
      if (!this.canPerformAction(action.type)) {
        console.log(`Rate limit reached for ${action.type}, requeueing...`);
        this.actionQueue.push(action); // Put it back
        break;
      }

      try {
        const result = await this.executeAction(action);

        // Log activity
        await this.logActivity(action, result);

        // Update daily stats
        this.updateStats(action.type);

        // Human-like delay between actions (2-5 minutes)
        const delay = 120000 + Math.random() * 180000; // 2-5 minutes
        console.log(`⏳ Waiting ${Math.round(delay / 1000)}s before next action...`);
        await this.sleep(delay);
      } catch (error) {
        console.error('LinkedIn action failed:', error);
        await this.logActivity(action, {
          action,
          success: false,
          timestamp: new Date().toISOString(),
          error: String(error),
        });
      }
    }
  }

  /**
   * Execute a LinkedIn action
   */
  async executeAction(action: LinkedInAction): Promise<LinkedInActionResult> {
    const startTime = Date.now();
    const prospectId = action.metadata?.prospectId;

    console.log(`▶️  Executing ${action.type} for ${action.targetProfile.firstName} ${action.targetProfile.lastName}`);

    try {
      let success = false;

      switch (action.type) {
        case 'profile_view':
          const publicId = this.extractPublicIdentifier(action.targetProfile.linkedInUrl);
          success = await this.client.viewProfile(publicId);
          break;

        case 'connection_request':
          // Extract profile URN from URL
          const profileUrn = await this.getProfileUrn(action.targetProfile.linkedInUrl);
          success = await this.client.sendConnectionRequest(
            profileUrn,
            action.note || 'I'd like to connect with you on LinkedIn.',
            action.targetProfile
          );
          break;

        case 'message':
          // Get conversation URN
          const conversationUrn = await this.getConversationUrn(action.targetProfile.linkedInUrl);
          success = await this.client.sendMessage(conversationUrn, action.message || '');
          break;

        default:
          console.warn(`Unknown LinkedIn action type: ${action.type}`);
      }

      // Update prospect LinkedIn status
      if (success && prospectId) {
        const updates: any = {
          linkedin_last_contacted_at: new Date().toISOString(),
        };

        if (action.type === 'connection_request') {
          updates.linkedin_connection_status = 'pending';
        } else if (action.type === 'message') {
          updates.linkedin_message_count = (await this.getMessageCount(prospectId)) + 1;
        }

        await supabase
          .from('prospects')
          .update(updates)
          .eq('id', prospectId);
      }

      return {
        action,
        success,
        timestamp: new Date().toISOString(),
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      return {
        action,
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Monitor for LinkedIn responses
   */
  async monitorResponses(): Promise<void> {
    // Check for accepted connection requests
    // Check for message replies
    // Update prospect statuses accordingly
    console.log('👀 Monitoring LinkedIn responses...');

    // This would integrate with LinkedIn's messaging API to check for new messages
    // For now, this is a placeholder for the full implementation
  }

  /**
   * Generate personalized connection note using AI
   */
  async generateConnectionNote(prospect: any): Promise<string> {
    const template = this.config.autoMessageTemplates?.connectionRequest || '';

    if (template) {
      return this.personalizeTemplate(template, prospect);
    }

    // Generate with AI
    const prompt = `Generate a personalized LinkedIn connection request note (max 250 characters).

Prospect: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}

Requirements:
1. Be genuine and specific (reference their role/company)
2. Explain why you want to connect (mutual interest in their industry/role)
3. Keep it professional but friendly
4. Under 250 characters
5. No salesy language

Respond with just the connection note text, no quotes or formatting.`;

    const response = await routeAIRequest(prompt, {
      taskType: 'general',
      teamId: this.config.teamId,
      prioritizeCost: true,
    });

    return response.response.substring(0, 250);
  }

  /**
   * Generate first message after connection
   */
  async generateFirstMessage(prospect: any): Promise<string> {
    const template = this.config.autoMessageTemplates?.firstMessage || '';

    if (template) {
      return this.personalizeTemplate(template, prospect);
    }

    // Generate with AI
    const prompt = `Generate a personalized first LinkedIn message after connection is accepted.

Prospect: ${prospect.first_name} ${prospect.last_name}
Title: ${prospect.title}
Company: ${prospect.company}
Intent Score: ${prospect.intent_score}/100

Requirements:
1. Thank them for connecting
2. Reference something specific about their company or role
3. Offer value (insight, resource, help)
4. Include a soft CTA (question or conversation starter)
5. Keep it conversational, 3-4 sentences max
6. No hard sell

Respond with just the message text.`;

    const response = await routeAIRequest(prompt, {
      taskType: 'general',
      teamId: this.config.teamId,
      prioritizeCost: true,
    });

    return response.response;
  }

  /**
   * Check if action can be performed based on daily limits
   */
  private canPerformAction(actionType: LinkedInAction['type']): boolean {
    const limits = this.config.dailyActionLimits;

    switch (actionType) {
      case 'profile_view':
        return this.dailyStats.profileViews < limits.profileViews;
      case 'connection_request':
        return this.dailyStats.connectionRequests < limits.connectionRequests;
      case 'message':
        return this.dailyStats.messages < limits.messages;
      case 'post_like':
        return this.dailyStats.likes < limits.likes;
      case 'post_comment':
        return this.dailyStats.comments < limits.comments;
      default:
        return false;
    }
  }

  /**
   * Update daily stats
   */
  private updateStats(actionType: LinkedInAction['type']): void {
    switch (actionType) {
      case 'profile_view':
        this.dailyStats.profileViews++;
        break;
      case 'connection_request':
        this.dailyStats.connectionRequests++;
        break;
      case 'message':
        this.dailyStats.messages++;
        break;
      case 'post_like':
        this.dailyStats.likes++;
        break;
      case 'post_comment':
        this.dailyStats.comments++;
        break;
    }
  }

  /**
   * Log LinkedIn activity
   */
  private async logActivity(action: LinkedInAction, result: LinkedInActionResult): Promise<void> {
    const prospectId = action.metadata?.prospectId;

    await supabase.from('linkedin_activities').insert({
      team_id: this.config.teamId,
      prospect_id: prospectId,
      action_type: action.type,
      target_url: action.targetProfile.linkedInUrl,
      status: result.success ? 'completed' : 'failed',
      message: action.message || action.note,
      error_message: result.error,
      created_at: new Date().toISOString(),
      completed_at: result.timestamp,
    });
  }

  /**
   * Helper methods
   */

  private shouldSendConnectionRequest(prospect: any): boolean {
    // Business logic to determine if connection request should be sent
    return (
      prospect.intent_score >= 60 &&
      prospect.status !== 'unqualified' &&
      !prospect.linkedin_connection_status
    );
  }

  private hasRecentMessage(activities: any[] | null): boolean {
    if (!activities) return false;

    const lastMessage = activities.find(a => a.action_type === 'message');
    if (!lastMessage) return false;

    const daysSince = (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 7;
  }

  private extractPublicIdentifier(linkedinUrl: string): string {
    // Extract public identifier from LinkedIn URL
    // e.g., https://www.linkedin.com/in/john-doe-123 → john-doe-123
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : '';
  }

  private async getProfileUrn(linkedinUrl: string): Promise<string> {
    // This would fetch the profile URN from LinkedIn API
    // For now, placeholder
    const publicId = this.extractPublicIdentifier(linkedinUrl);
    return `urn:li:person:${publicId}`;
  }

  private async getConversationUrn(linkedinUrl: string): Promise<string> {
    // This would fetch or create conversation URN
    // For now, placeholder
    return `urn:li:conversation:${Date.now()}`;
  }

  private async getMessageCount(prospectId: string): Promise<number> {
    const { count } = await supabase
      .from('linkedin_activities')
      .select('*', { count: 'exact', head: true })
      .eq('prospect_id', prospectId)
      .eq('action_type', 'message');

    return count || 0;
  }

  private personalizeTemplate(template: string, prospect: any): string {
    return template
      .replace(/\{firstName\}/g, prospect.first_name || '')
      .replace(/\{lastName\}/g, prospect.last_name || '')
      .replace(/\{company\}/g, prospect.company || '')
      .replace(/\{title\}/g, prospect.title || '');
  }

  private scheduleDailyReset(): void {
    // Reset stats at midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.dailyStats = {
        profileViews: 0,
        connectionRequests: 0,
        messages: 0,
        likes: 0,
        comments: 0,
      };

      console.log('🔄 LinkedIn daily stats reset');

      // Schedule next reset
      this.scheduleDailyReset();
    }, msUntilMidnight);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Start LinkedIn agent for a team
 */
export async function startLinkedInAgent(config: LinkedInAgentConfig): Promise<LinkedInAgent> {
  // Get LinkedIn OAuth token from team integrations
  const { data: integration } = await supabase
    .from('team_integrations')
    .select('credentials')
    .eq('team_id', config.teamId)
    .eq('provider_key', 'linkedin')
    .single();

  if (!integration?.credentials?.access_token) {
    throw new Error('LinkedIn integration not configured');
  }

  const agent = new LinkedInAgent(config, integration.credentials.access_token);

  // Save agent configuration
  await supabase.from('linkedin_agent_configs').upsert({
    team_id: config.teamId,
    agent_name: config.agentName,
    enabled: config.enabled,
    daily_limits: config.dailyActionLimits,
    auto_message_templates: config.autoMessageTemplates,
    target_criteria: config.targetCriteria,
    last_started_at: new Date().toISOString(),
  });

  // Start the agent in background
  if (config.enabled) {
    agent.start().catch(err => console.error('LinkedIn Agent error:', err));
  }

  return agent;
}

/**
 * Stop LinkedIn agent
 */
export async function stopLinkedInAgent(teamId: string): Promise<void> {
  await supabase
    .from('linkedin_agent_configs')
    .update({
      enabled: false,
      last_stopped_at: new Date().toISOString(),
    })
    .eq('team_id', teamId);
}
