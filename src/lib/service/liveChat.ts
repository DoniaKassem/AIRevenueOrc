/**
 * Service Hub - Live Chat
 * Real-time chat widget with AI assistance and routing
 */

import { supabase } from '../supabase';

export interface ChatConversation {
  id: string;
  prospectId?: string;
  visitorName?: string;
  visitorEmail?: string;
  status: 'waiting' | 'active' | 'ended' | 'missed';

  // Assignment
  assignedTo?: string;
  assignedTeam?: string;

  // Context
  pageUrl: string;
  pageTitle: string;
  userAgent: string;
  ipAddress: string;
  country?: string;
  city?: string;

  // UTM
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // Session
  sessionId: string;
  previousVisits: number;

  // Metadata
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  firstResponseTime?: number; // in seconds
  avgResponseTime?: number; // in seconds

  // Satisfaction
  rating?: number; // 1-5
  feedback?: string;

  // Tags
  tags: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';

  // Sender
  senderId?: string;
  senderName: string;
  senderType: 'visitor' | 'agent' | 'bot' | 'system';

  // Attachments
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
  }>;

  // AI
  isAiGenerated?: boolean;
  aiSuggestion?: boolean;

  // Metadata
  sentAt: Date;
  readAt?: Date;
}

export interface ChatWidget {
  id: string;
  name: string;
  isActive: boolean;

  // Appearance
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  accentColor: string;
  buttonIcon?: string;
  buttonText?: string;

  // Welcome Message
  welcomeMessage: string;
  offlineMessage: string;
  preChatFormEnabled: boolean;
  preChatFields?: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'phone' | 'select';
    required: boolean;
    options?: string[];
  }>;

  // Routing
  routingStrategy: 'round-robin' | 'least-active' | 'manual' | 'ai-based';
  assignToTeam?: string;
  assignToUsers?: string[];

  // Operating Hours
  businessHoursOnly: boolean;
  businessHours?: {
    timezone: string;
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };

  // AI Settings
  enableAiAssist: boolean;
  aiGreeting?: string;
  aiHandoffTriggers?: string[];

  // Security
  allowedDomains?: string[];
  requireEmailVerification?: boolean;

  // Analytics
  totalConversations: number;
  avgResponseTime: number;
  avgRating: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStatus {
  userId: string;
  status: 'online' | 'away' | 'offline';
  activeConversations: number;
  maxConversations: number;
  lastSeenAt: Date;
}

export interface ChatAnalytics {
  totalConversations: number;
  activeConversations: number;
  missedConversations: number;
  avgFirstResponseTime: number;
  avgResponseTime: number;
  avgDuration: number;
  avgRating: number;
  conversationsByHour: Record<string, number>;
  conversationsByDay: Record<string, number>;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    conversations: number;
    avgResponseTime: number;
    avgRating: number;
  }>;
}

/**
 * Live Chat Service
 */
export class LiveChatService {
  /**
   * Start conversation
   */
  async startConversation(data: Partial<ChatConversation>): Promise<ChatConversation> {
    // Find available agent
    const assignment = await this.findAvailableAgent(data.assignedTeam);

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        prospect_id: data.prospectId,
        visitor_name: data.visitorName,
        visitor_email: data.visitorEmail,
        status: 'waiting',
        assigned_to: assignment?.userId,
        assigned_team: data.assignedTeam,
        page_url: data.pageUrl,
        page_title: data.pageTitle,
        user_agent: data.userAgent,
        ip_address: data.ipAddress,
        country: data.country,
        city: data.city,
        utm_source: data.utmSource,
        utm_medium: data.utmMedium,
        utm_campaign: data.utmCampaign,
        session_id: data.sessionId,
        previous_visits: data.previousVisits || 0,
        tags: data.tags || []
      })
      .select()
      .single();

    if (error) throw error;

    // Send welcome message
    await this.sendMessage({
      conversationId: conversation.id,
      content: 'Welcome! How can we help you today?',
      senderName: 'System',
      senderType: 'system'
    });

    return this.mapConversation(conversation);
  }

  /**
   * Send message
   */
  async sendMessage(message: Partial<ChatMessage>): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: message.conversationId,
        content: message.content,
        type: message.type || 'text',
        sender_id: message.senderId,
        sender_name: message.senderName,
        sender_type: message.senderType || 'agent',
        attachments: message.attachments,
        is_ai_generated: message.isAiGenerated || false,
        ai_suggestion: message.aiSuggestion || false
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation
    const conversation = await this.getConversation(message.conversationId!);
    const now = new Date();

    // Calculate first response time
    if (!conversation.firstResponseTime && message.senderType === 'agent') {
      const firstResponseTime = (now.getTime() - conversation.startedAt.getTime()) / 1000;

      await supabase
        .from('chat_conversations')
        .update({
          first_response_time: firstResponseTime,
          status: 'active'
        })
        .eq('id', message.conversationId);
    }

    return this.mapMessage(data);
  }

  /**
   * Get conversation messages
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });

    return (data || []).map(this.mapMessage);
  }

  /**
   * Get conversation
   */
  async getConversation(conversationId: string): Promise<ChatConversation> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    return this.mapConversation(data);
  }

  /**
   * Get conversations
   */
  async getConversations(filters?: {
    status?: ChatConversation['status'];
    assignedTo?: string;
    assignedTeam?: string;
    prospectId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<ChatConversation[]> {
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .order('started_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters?.assignedTeam) {
      query = query.eq('assigned_team', filters.assignedTeam);
    }

    if (filters?.prospectId) {
      query = query.eq('prospect_id', filters.prospectId);
    }

    if (filters?.startDate) {
      query = query.gte('started_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('started_at', filters.endDate.toISOString());
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapConversation);
  }

  /**
   * Assign conversation
   */
  async assignConversation(conversationId: string, userId: string): Promise<ChatConversation> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({
        assigned_to: userId,
        status: 'active'
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;

    // Send system message
    await this.sendMessage({
      conversationId,
      content: `Agent joined the conversation`,
      senderName: 'System',
      senderType: 'system'
    });

    return this.mapConversation(data);
  }

  /**
   * End conversation
   */
  async endConversation(conversationId: string, rating?: number, feedback?: string): Promise<ChatConversation> {
    const conversation = await this.getConversation(conversationId);
    const duration = (new Date().getTime() - conversation.startedAt.getTime()) / 1000;

    const { data, error } = await supabase
      .from('chat_conversations')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration,
        rating,
        feedback
      })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;

    // Send system message
    await this.sendMessage({
      conversationId,
      content: 'Conversation ended',
      senderName: 'System',
      senderType: 'system'
    });

    return this.mapConversation(data);
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId);
  }

  /**
   * Create widget
   */
  async createWidget(widget: Partial<ChatWidget>): Promise<ChatWidget> {
    const { data, error } = await supabase
      .from('chat_widgets')
      .insert({
        name: widget.name,
        is_active: widget.isActive !== false,
        position: widget.position || 'bottom-right',
        primary_color: widget.primaryColor || '#0078d4',
        accent_color: widget.accentColor || '#ffffff',
        button_icon: widget.buttonIcon,
        button_text: widget.buttonText || 'Chat with us',
        welcome_message: widget.welcomeMessage || 'Welcome! How can we help?',
        offline_message: widget.offlineMessage || 'We\'re currently offline. Leave us a message!',
        pre_chat_form_enabled: widget.preChatFormEnabled || false,
        pre_chat_fields: widget.preChatFields,
        routing_strategy: widget.routingStrategy || 'round-robin',
        assign_to_team: widget.assignToTeam,
        assign_to_users: widget.assignToUsers,
        business_hours_only: widget.businessHoursOnly || false,
        business_hours: widget.businessHours,
        enable_ai_assist: widget.enableAiAssist || false,
        ai_greeting: widget.aiGreeting,
        ai_handoff_triggers: widget.aiHandoffTriggers,
        allowed_domains: widget.allowedDomains,
        require_email_verification: widget.requireEmailVerification || false,
        total_conversations: 0,
        avg_response_time: 0,
        avg_rating: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWidget(data);
  }

  /**
   * Get widget
   */
  async getWidget(widgetId: string): Promise<ChatWidget> {
    const { data, error } = await supabase
      .from('chat_widgets')
      .select('*')
      .eq('id', widgetId)
      .single();

    if (error) throw error;
    return this.mapWidget(data);
  }

  /**
   * Get embed code
   */
  getEmbedCode(widgetId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.airevenueorc.com';

    return `<script>
  (function() {
    window.AIROChat = window.AIROChat || {};
    window.AIROChat.widgetId = '${widgetId}';
    var script = document.createElement('script');
    script.src = '${baseUrl}/chat-widget.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(userId: string, status: AgentStatus['status']): Promise<void> {
    await supabase
      .from('agent_status')
      .upsert({
        user_id: userId,
        status,
        last_seen_at: new Date().toISOString()
      });
  }

  /**
   * Get agent status
   */
  async getAgentStatus(userId: string): Promise<AgentStatus | null> {
    const { data } = await supabase
      .from('agent_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    // Count active conversations
    const { count } = await supabase
      .from('chat_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'active');

    return {
      userId: data.user_id,
      status: data.status,
      activeConversations: count || 0,
      maxConversations: data.max_conversations || 5,
      lastSeenAt: new Date(data.last_seen_at)
    };
  }

  /**
   * Get analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<ChatAnalytics> {
    let query = supabase.from('chat_conversations').select('*');

    if (dateRange) {
      query = query
        .gte('started_at', dateRange.start.toISOString())
        .lte('started_at', dateRange.end.toISOString());
    }

    const { data: conversations } = await query;

    const totalConversations = conversations?.length || 0;
    const activeConversations = conversations?.filter(c => c.status === 'active').length || 0;
    const missedConversations = conversations?.filter(c => c.status === 'missed').length || 0;

    // Calculate averages
    const firstResponseTimes = conversations?.filter(c => c.first_response_time).map(c => c.first_response_time) || [];
    const avgFirstResponseTime = firstResponseTimes.length > 0
      ? firstResponseTimes.reduce((a, b) => a + b, 0) / firstResponseTimes.length
      : 0;

    const durations = conversations?.filter(c => c.duration).map(c => c.duration) || [];
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const ratings = conversations?.filter(c => c.rating).map(c => c.rating!) || [];
    const avgRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Group by hour and day
    const conversationsByHour: Record<string, number> = {};
    const conversationsByDay: Record<string, number> = {};

    conversations?.forEach(c => {
      const date = new Date(c.started_at);
      const hour = date.getHours().toString().padStart(2, '0');
      const day = date.toISOString().split('T')[0];

      conversationsByHour[hour] = (conversationsByHour[hour] || 0) + 1;
      conversationsByDay[day] = (conversationsByDay[day] || 0) + 1;
    });

    // Top agents (placeholder - would need more data)
    const topAgents: ChatAnalytics['topAgents'] = [];

    return {
      totalConversations,
      activeConversations,
      missedConversations,
      avgFirstResponseTime,
      avgResponseTime: avgFirstResponseTime, // Simplified
      avgDuration,
      avgRating,
      conversationsByHour,
      conversationsByDay,
      topAgents
    };
  }

  /**
   * Find available agent
   */
  private async findAvailableAgent(teamId?: string): Promise<{ userId: string } | null> {
    let query = supabase
      .from('agent_status')
      .select('user_id, max_conversations')
      .eq('status', 'online')
      .order('last_seen_at', { ascending: false });

    // TODO: Filter by team if provided

    const { data: agents } = await query;

    if (!agents || agents.length === 0) {
      return null;
    }

    // Find agent with least active conversations
    for (const agent of agents) {
      const { count } = await supabase
        .from('chat_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', agent.user_id)
        .eq('status', 'active');

      if (count === null || count < (agent.max_conversations || 5)) {
        return { userId: agent.user_id };
      }
    }

    return null;
  }

  /**
   * Map database record to Conversation
   */
  private mapConversation(data: any): ChatConversation {
    return {
      id: data.id,
      prospectId: data.prospect_id,
      visitorName: data.visitor_name,
      visitorEmail: data.visitor_email,
      status: data.status,
      assignedTo: data.assigned_to,
      assignedTeam: data.assigned_team,
      pageUrl: data.page_url,
      pageTitle: data.page_title,
      userAgent: data.user_agent,
      ipAddress: data.ip_address,
      country: data.country,
      city: data.city,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      sessionId: data.session_id,
      previousVisits: data.previous_visits,
      startedAt: new Date(data.started_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      duration: data.duration,
      firstResponseTime: data.first_response_time,
      avgResponseTime: data.avg_response_time,
      rating: data.rating,
      feedback: data.feedback,
      tags: data.tags || []
    };
  }

  /**
   * Map database record to Message
   */
  private mapMessage(data: any): ChatMessage {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      content: data.content,
      type: data.type,
      senderId: data.sender_id,
      senderName: data.sender_name,
      senderType: data.sender_type,
      attachments: data.attachments,
      isAiGenerated: data.is_ai_generated,
      aiSuggestion: data.ai_suggestion,
      sentAt: new Date(data.sent_at),
      readAt: data.read_at ? new Date(data.read_at) : undefined
    };
  }

  /**
   * Map database record to Widget
   */
  private mapWidget(data: any): ChatWidget {
    return {
      id: data.id,
      name: data.name,
      isActive: data.is_active,
      position: data.position,
      primaryColor: data.primary_color,
      accentColor: data.accent_color,
      buttonIcon: data.button_icon,
      buttonText: data.button_text,
      welcomeMessage: data.welcome_message,
      offlineMessage: data.offline_message,
      preChatFormEnabled: data.pre_chat_form_enabled,
      preChatFields: data.pre_chat_fields,
      routingStrategy: data.routing_strategy,
      assignToTeam: data.assign_to_team,
      assignToUsers: data.assign_to_users,
      businessHoursOnly: data.business_hours_only,
      businessHours: data.business_hours,
      enableAiAssist: data.enable_ai_assist,
      aiGreeting: data.ai_greeting,
      aiHandoffTriggers: data.ai_handoff_triggers,
      allowedDomains: data.allowed_domains,
      requireEmailVerification: data.require_email_verification,
      totalConversations: data.total_conversations,
      avgResponseTime: data.avg_response_time,
      avgRating: data.avg_rating,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create Live Chat Service
 */
export function createLiveChatService(): LiveChatService {
  return new LiveChatService();
}
