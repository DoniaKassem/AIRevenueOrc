/**
 * LinkedIn Automation for BDR Outreach
 * Handles connection requests, messages, and engagement tracking
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';

export interface LinkedInProfile {
  profileUrl: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  location: string;
  headline?: string;
  about?: string;
  connectionDegree: 1 | 2 | 3;
  recentActivity?: LinkedInActivity[];
}

export interface LinkedInActivity {
  type: 'post' | 'comment' | 'share' | 'reaction';
  content: string;
  timestamp: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface ConnectionRequest {
  prospectId: string;
  profileUrl: string;
  note: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  sentAt: string;
  respondedAt?: string;
}

export interface LinkedInMessage {
  prospectId: string;
  conversationId: string;
  message: string;
  messageType: 'connection_request' | 'inmail' | 'follow_up' | 'response';
  sentAt: string;
  read: boolean;
  replied: boolean;
}

export interface LinkedInOutreachConfig {
  dailyConnectionLimit: number;
  dailyMessageLimit: number;
  usePersonalizedNotes: boolean;
  engageWithContentFirst: boolean;
  minProfileCompleteness: number;  // 0-100
  connectionNoteTemplate?: string;
  inmailTemplate?: string;
}

/**
 * Default configuration for LinkedIn outreach
 */
const DEFAULT_CONFIG: LinkedInOutreachConfig = {
  dailyConnectionLimit: 20,      // LinkedIn's safe limit
  dailyMessageLimit: 30,
  usePersonalizedNotes: true,
  engageWithContentFirst: true,
  minProfileCompleteness: 70,
};

/**
 * LinkedIn automation manager
 */
export class LinkedInAutomationManager {
  private config: LinkedInOutreachConfig;
  private teamId: string;

  constructor(teamId: string, config?: Partial<LinkedInOutreachConfig>) {
    this.teamId = teamId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Send connection request with personalized note
   */
  async sendConnectionRequest(
    prospectId: string,
    profile: LinkedInProfile,
    customNote?: string
  ): Promise<ConnectionRequest> {
    // Check daily limit
    const todayCount = await this.getTodayConnectionCount();
    if (todayCount >= this.config.dailyConnectionLimit) {
      throw new Error('Daily connection limit reached');
    }

    // Check if already connected
    const existing = await this.getExistingConnection(prospectId);
    if (existing) {
      throw new Error('Already connected or request pending');
    }

    // Generate personalized note
    const note = customNote || (
      this.config.usePersonalizedNotes
        ? await this.generateConnectionNote(profile)
        : this.config.connectionNoteTemplate || ''
    );

    // Validate note length (300 chars max on LinkedIn)
    const trimmedNote = note.substring(0, 300);

    // Create connection request record
    const request: ConnectionRequest = {
      prospectId,
      profileUrl: profile.profileUrl,
      note: trimmedNote,
      status: 'pending',
      sentAt: new Date().toISOString(),
    };

    // Store in database
    await supabase.from('linkedin_connections').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      profile_url: profile.profileUrl,
      connection_note: trimmedNote,
      status: 'pending',
      sent_at: request.sentAt,
    });

    // Log activity
    await this.logActivity({
      prospectId,
      activityType: 'connection_request',
      details: { note: trimmedNote, profileUrl: profile.profileUrl },
    });

    // In production, this would actually send via LinkedIn API
    // For now, we just track it
    console.log(`[LinkedIn] Connection request sent to ${profile.firstName} ${profile.lastName}`);

    return request;
  }

  /**
   * Send LinkedIn message (requires existing connection)
   */
  async sendMessage(
    prospectId: string,
    message: string,
    messageType: LinkedInMessage['messageType'] = 'follow_up'
  ): Promise<LinkedInMessage> {
    // Check daily limit
    const todayCount = await this.getTodayMessageCount();
    if (todayCount >= this.config.dailyMessageLimit) {
      throw new Error('Daily message limit reached');
    }

    // Check if connected
    const connection = await this.getExistingConnection(prospectId);
    if (!connection || connection.status !== 'accepted') {
      throw new Error('Must be connected to send message');
    }

    // Create message record
    const linkedInMessage: LinkedInMessage = {
      prospectId,
      conversationId: `conv_${prospectId}_${Date.now()}`,
      message,
      messageType,
      sentAt: new Date().toISOString(),
      read: false,
      replied: false,
    };

    // Store in database
    await supabase.from('linkedin_messages').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      conversation_id: linkedInMessage.conversationId,
      message_content: message,
      message_type: messageType,
      sent_at: linkedInMessage.sentAt,
    });

    // Log activity
    await this.logActivity({
      prospectId,
      activityType: 'linkedin_message',
      details: { message: message.substring(0, 100), messageType },
    });

    console.log(`[LinkedIn] Message sent to prospect ${prospectId}`);

    return linkedInMessage;
  }

  /**
   * Send InMail (premium feature, doesn't require connection)
   */
  async sendInMail(
    prospectId: string,
    profile: LinkedInProfile,
    subject: string,
    message: string
  ): Promise<LinkedInMessage> {
    // Check if prospect has InMail available
    // (In production, would check LinkedIn API)

    const linkedInMessage: LinkedInMessage = {
      prospectId,
      conversationId: `inmail_${prospectId}_${Date.now()}`,
      message: `Subject: ${subject}\n\n${message}`,
      messageType: 'inmail',
      sentAt: new Date().toISOString(),
      read: false,
      replied: false,
    };

    // Store in database
    await supabase.from('linkedin_messages').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      conversation_id: linkedInMessage.conversationId,
      message_content: message,
      message_type: 'inmail',
      subject,
      sent_at: linkedInMessage.sentAt,
    });

    // Log activity
    await this.logActivity({
      prospectId,
      activityType: 'linkedin_inmail',
      details: { subject, message: message.substring(0, 100) },
    });

    return linkedInMessage;
  }

  /**
   * Engage with prospect's LinkedIn content
   */
  async engageWithContent(
    prospectId: string,
    profile: LinkedInProfile,
    engagementType: 'like' | 'comment' | 'share'
  ): Promise<void> {
    if (!profile.recentActivity || profile.recentActivity.length === 0) {
      throw new Error('No recent activity found');
    }

    const latestPost = profile.recentActivity[0];

    // Generate thoughtful comment if commenting
    let comment: string | undefined;
    if (engagementType === 'comment') {
      comment = await this.generateComment(latestPost);
    }

    // Store engagement
    await supabase.from('linkedin_engagements').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      engagement_type: engagementType,
      post_content: latestPost.content.substring(0, 500),
      comment_content: comment,
      engaged_at: new Date().toISOString(),
    });

    // Log activity
    await this.logActivity({
      prospectId,
      activityType: `linkedin_${engagementType}`,
      details: { postContent: latestPost.content.substring(0, 100), comment },
    });

    console.log(`[LinkedIn] ${engagementType} on ${profile.firstName}'s post`);
  }

  /**
   * View prospect's LinkedIn profile
   */
  async viewProfile(prospectId: string, profile: LinkedInProfile): Promise<void> {
    // Track profile view
    await supabase.from('linkedin_engagements').insert({
      team_id: this.teamId,
      prospect_id: prospectId,
      engagement_type: 'profile_view',
      engaged_at: new Date().toISOString(),
    });

    // Log activity
    await this.logActivity({
      prospectId,
      activityType: 'linkedin_profile_view',
      details: { profileUrl: profile.profileUrl },
    });
  }

  /**
   * Execute multi-touch LinkedIn sequence
   */
  async executeLinkedInSequence(
    prospectId: string,
    profile: LinkedInProfile,
    sequenceType: 'warm' | 'cold' | 'engage_first'
  ): Promise<void> {
    switch (sequenceType) {
      case 'engage_first':
        // 1. View profile
        await this.viewProfile(prospectId, profile);
        await this.delay(24); // Wait 24 hours

        // 2. Engage with content
        if (this.config.engageWithContentFirst && profile.recentActivity?.length) {
          await this.engageWithContent(prospectId, profile, 'like');
          await this.delay(48); // Wait 48 hours

          // 3. Send connection request
          await this.sendConnectionRequest(prospectId, profile);
        } else {
          // No content to engage with, send connection directly
          await this.sendConnectionRequest(prospectId, profile);
        }
        break;

      case 'cold':
        // Direct connection request
        await this.sendConnectionRequest(prospectId, profile);
        break;

      case 'warm':
        // For existing connections, send message
        const connection = await this.getExistingConnection(prospectId);
        if (connection?.status === 'accepted') {
          const message = await this.generateOutreachMessage(profile);
          await this.sendMessage(prospectId, message, 'follow_up');
        } else {
          // Not connected yet, send connection request
          await this.sendConnectionRequest(prospectId, profile);
        }
        break;
    }
  }

  /**
   * Generate personalized connection note
   */
  private async generateConnectionNote(profile: LinkedInProfile): Promise<string> {
    const prompt = `Write a personalized LinkedIn connection request note for:

Name: ${profile.firstName} ${profile.lastName}
Title: ${profile.title}
Company: ${profile.company}
${profile.headline ? `Headline: ${profile.headline}` : ''}
${profile.recentActivity?.[0] ? `Recent activity: ${profile.recentActivity[0].content.substring(0, 200)}` : ''}

Requirements:
- Keep it under 280 characters (LinkedIn limit is 300, leave buffer)
- Be professional and genuine
- Reference something specific about them (title, company, or recent activity)
- Clear value proposition
- End with a soft ask to connect
- Don't be salesy

Return only the connection note text, no explanations.`;

    const note = await routeAIRequest(prompt, {
      taskType: 'message-generation',
      maxTokens: 150,
    });

    return note.trim().substring(0, 280);
  }

  /**
   * Generate LinkedIn outreach message
   */
  private async generateOutreachMessage(profile: LinkedInProfile): Promise<string> {
    const prompt = `Write a personalized LinkedIn message for a sales outreach to:

Name: ${profile.firstName} ${profile.lastName}
Title: ${profile.title}
Company: ${profile.company}
${profile.about ? `About: ${profile.about.substring(0, 300)}` : ''}

Requirements:
- Professional and conversational tone
- Reference something specific about their role or company
- Identify a potential pain point or opportunity
- Offer clear value
- Soft CTA (ask a question or offer to share something useful)
- Keep under 500 characters
- Don't be pushy

Return only the message text, no explanations.`;

    const message = await routeAIRequest(prompt, {
      taskType: 'message-generation',
      maxTokens: 200,
    });

    return message.trim();
  }

  /**
   * Generate thoughtful comment on LinkedIn post
   */
  private async generateComment(activity: LinkedInActivity): Promise<string> {
    const prompt = `Write a thoughtful LinkedIn comment on this post:

"${activity.content.substring(0, 500)}"

Requirements:
- Add value to the conversation
- Show genuine interest
- Be professional but friendly
- Keep under 150 characters
- Don't be salesy at all
- No emojis unless the post has them

Return only the comment text, no explanations.`;

    const comment = await routeAIRequest(prompt, {
      taskType: 'message-generation',
      maxTokens: 100,
    });

    return comment.trim().substring(0, 150);
  }

  /**
   * Get today's connection count
   */
  private async getTodayConnectionCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { count } = await supabase
      .from('linkedin_connections')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lt('sent_at', `${today}T23:59:59.999Z`);

    return count || 0;
  }

  /**
   * Get today's message count
   */
  private async getTodayMessageCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const { count } = await supabase
      .from('linkedin_messages')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', this.teamId)
      .gte('sent_at', `${today}T00:00:00.000Z`)
      .lt('sent_at', `${today}T23:59:59.999Z`);

    return count || 0;
  }

  /**
   * Get existing connection status
   */
  private async getExistingConnection(
    prospectId: string
  ): Promise<{ status: string } | null> {
    const { data } = await supabase
      .from('linkedin_connections')
      .select('status')
      .eq('team_id', this.teamId)
      .eq('prospect_id', prospectId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  /**
   * Log LinkedIn activity
   */
  private async logActivity(params: {
    prospectId: string;
    activityType: string;
    details: Record<string, any>;
  }): Promise<void> {
    await supabase.from('bdr_activities').insert({
      team_id: this.teamId,
      prospect_id: params.prospectId,
      activity_type: params.activityType,
      channel: 'linkedin',
      direction: 'outbound',
      metadata: params.details,
      was_automated: true,
    });
  }

  /**
   * Delay helper (for sequencing)
   */
  private async delay(hours: number): Promise<void> {
    // In production, this would schedule a task for later
    // For now, just log it
    console.log(`[LinkedIn] Waiting ${hours} hours before next action`);
  }
}

/**
 * Extract LinkedIn profile data from URL
 */
export async function extractLinkedInProfile(
  profileUrl: string
): Promise<LinkedInProfile | null> {
  try {
    // In production, this would use LinkedIn API or scraping service
    // For now, return mock data structure

    // Basic validation
    if (!profileUrl.includes('linkedin.com')) {
      return null;
    }

    // Mock profile extraction
    return {
      profileUrl,
      firstName: 'John',
      lastName: 'Doe',
      title: 'VP of Sales',
      company: 'Example Corp',
      location: 'San Francisco, CA',
      connectionDegree: 2,
      headline: 'VP of Sales at Example Corp | SaaS Enthusiast',
    };
  } catch (error) {
    console.error('Failed to extract LinkedIn profile:', error);
    return null;
  }
}

/**
 * Find LinkedIn profile from prospect data
 */
export async function findLinkedInProfile(prospect: {
  firstName: string;
  lastName: string;
  company: string;
  title?: string;
}): Promise<string | null> {
  try {
    // In production, use LinkedIn Sales Navigator API or similar
    // to find the correct profile

    // Mock implementation
    const searchQuery = `${prospect.firstName} ${prospect.lastName} ${prospect.company}`;
    console.log(`[LinkedIn] Searching for: ${searchQuery}`);

    // Would return actual LinkedIn URL
    return `https://linkedin.com/in/${prospect.firstName.toLowerCase()}-${prospect.lastName.toLowerCase()}`;
  } catch (error) {
    console.error('LinkedIn profile search failed:', error);
    return null;
  }
}

/**
 * Get LinkedIn outreach performance metrics
 */
export async function getLinkedInMetrics(
  teamId: string,
  daysBack: number = 30
): Promise<{
  connectionsSent: number;
  connectionsAccepted: number;
  acceptanceRate: number;
  messagesSent: number;
  messagesReplied: number;
  responseRate: number;
  profileViews: number;
  contentEngagements: number;
}> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Get connections data
  const { data: connections } = await supabase
    .from('linkedin_connections')
    .select('status')
    .eq('team_id', teamId)
    .gte('sent_at', since);

  const connectionsSent = connections?.length || 0;
  const connectionsAccepted = connections?.filter(c => c.status === 'accepted').length || 0;

  // Get messages data
  const { data: messages } = await supabase
    .from('linkedin_messages')
    .select('replied')
    .eq('team_id', teamId)
    .gte('sent_at', since);

  const messagesSent = messages?.length || 0;
  const messagesReplied = messages?.filter(m => m.replied).length || 0;

  // Get engagement data
  const { data: engagements } = await supabase
    .from('linkedin_engagements')
    .select('engagement_type')
    .eq('team_id', teamId)
    .gte('engaged_at', since);

  const profileViews = engagements?.filter(e => e.engagement_type === 'profile_view').length || 0;
  const contentEngagements = engagements?.filter(e =>
    ['like', 'comment', 'share'].includes(e.engagement_type)
  ).length || 0;

  return {
    connectionsSent,
    connectionsAccepted,
    acceptanceRate: connectionsSent > 0 ? (connectionsAccepted / connectionsSent) * 100 : 0,
    messagesSent,
    messagesReplied,
    responseRate: messagesSent > 0 ? (messagesReplied / messagesSent) * 100 : 0,
    profileViews,
    contentEngagements,
  };
}

/**
 * Sync LinkedIn conversations to track replies
 */
export async function syncLinkedInConversations(
  teamId: string
): Promise<{ synced: number; newReplies: number }> {
  // In production, this would call LinkedIn API to get new messages
  // and update the database accordingly

  console.log(`[LinkedIn] Syncing conversations for team ${teamId}`);

  // Mock implementation
  return {
    synced: 0,
    newReplies: 0,
  };
}
