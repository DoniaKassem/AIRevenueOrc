/**
 * Service Hub - Ticketing System
 * Support ticket management with SLAs, routing, and automation
 */

import { supabase } from '../supabase';

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'new' | 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  tags: string[];

  // Parties
  customerId: string;
  customerEmail: string;
  customerName: string;
  assignedTo?: string;
  assignedTeam?: string;

  // SLA
  slaId?: string;
  dueDate?: Date;
  firstResponseTime?: number; // in minutes
  resolutionTime?: number; // in minutes
  slaBreached: boolean;

  // Communication
  channel: 'email' | 'chat' | 'phone' | 'web' | 'social';
  lastReplyAt?: Date;
  lastReplyBy?: string;

  // Satisfaction
  satisfaction?: 'satisfied' | 'neutral' | 'dissatisfied';
  satisfactionComment?: string;

  // Metadata
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
}

export interface TicketReply {
  id: string;
  ticketId: string;
  content: string;
  isInternal: boolean; // internal note vs customer-facing
  attachments?: string[];

  // Author
  authorId?: string;
  authorName: string;
  authorEmail: string;
  authorType: 'agent' | 'customer' | 'system';

  createdAt: Date;
}

export interface SLA {
  id: string;
  name: string;
  description: string;
  priority: Ticket['priority'];

  // Time targets (in minutes)
  firstResponseTarget: number;
  resolutionTarget: number;

  // Business hours
  businessHoursOnly: boolean;
  businessHours?: {
    start: string; // HH:MM
    end: string;   // HH:MM
    days: number[]; // 0-6 (Sunday-Saturday)
  };

  // Escalation
  escalationEnabled: boolean;
  escalationAfter?: number; // minutes
  escalateTo?: string; // team or user ID

  isActive: boolean;
  createdAt: Date;
}

export interface TicketRoutingRule {
  id: string;
  name: string;
  priority: number; // lower = higher priority
  isActive: boolean;

  // Conditions
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'greater_than' | 'less_than';
    value: any;
  }>;

  // Actions
  assignTo?: string;
  assignToTeam?: string;
  setPriority?: Ticket['priority'];
  setCategory?: string;
  addTags?: string[];
  applySLA?: string;

  createdAt: Date;
}

export interface CannedResponse {
  id: string;
  name: string;
  shortcut: string;
  subject?: string;
  content: string;
  category?: string;
  isPublic: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
}

export interface TicketAnalytics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgFirstResponseTime: number;
  avgResolutionTime: number;
  slaCompliance: number; // percentage
  satisfactionScore: number; // 1-5 scale
  ticketsByStatus: Record<string, number>;
  ticketsByPriority: Record<string, number>;
  ticketsByCategory: Record<string, number>;
  topAgents: Array<{
    agentId: string;
    agentName: string;
    ticketsResolved: number;
    avgResolutionTime: number;
    satisfaction: number;
  }>;
  trendData: Array<{
    date: string;
    created: number;
    resolved: number;
    avgResponseTime: number;
  }>;
}

/**
 * Ticketing Service
 */
export class TicketingService {
  /**
   * Create ticket
   */
  async createTicket(ticket: Partial<Ticket>): Promise<Ticket> {
    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber();

    // Apply routing rules
    const routing = await this.applyRoutingRules(ticket);

    // Apply SLA
    const sla = routing.applySLA ? await this.getSLA(routing.applySLA) : null;
    const dueDate = sla ? this.calculateDueDate(sla.resolutionTarget, sla.businessHoursOnly) : undefined;

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        subject: ticket.subject,
        description: ticket.description,
        status: 'new',
        priority: routing.setPriority || ticket.priority || 'normal',
        category: routing.setCategory || ticket.category,
        tags: [...(ticket.tags || []), ...(routing.addTags || [])],
        customer_id: ticket.customerId,
        customer_email: ticket.customerEmail,
        customer_name: ticket.customerName,
        assigned_to: routing.assignTo || ticket.assignedTo,
        assigned_team: routing.assignToTeam || ticket.assignedTeam,
        sla_id: routing.applySLA,
        due_date: dueDate?.toISOString(),
        sla_breached: false,
        channel: ticket.channel || 'web',
        created_by: ticket.createdBy
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial system message
    await this.addReply({
      ticketId: data.id,
      content: `Ticket created via ${ticket.channel || 'web'}`,
      isInternal: true,
      authorName: 'System',
      authorEmail: 'system@airevenueorc.com',
      authorType: 'system'
    });

    return this.mapTicket(data);
  }

  /**
   * Update ticket
   */
  async updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket> {
    const current = await this.getTicket(ticketId);

    // Track status changes
    if (updates.status && updates.status !== current.status) {
      if (updates.status === 'resolved' && !current.resolvedAt) {
        updates.resolvedAt = new Date();

        // Calculate resolution time
        const resolutionTime = (updates.resolvedAt.getTime() - current.createdAt.getTime()) / 60000;
        updates.resolutionTime = resolutionTime;
      }

      if (updates.status === 'closed' && !current.closedAt) {
        updates.closedAt = new Date();
      }
    }

    const { data, error } = await supabase
      .from('tickets')
      .update({
        subject: updates.subject,
        description: updates.description,
        status: updates.status,
        priority: updates.priority,
        category: updates.category,
        tags: updates.tags,
        assigned_to: updates.assignedTo,
        assigned_team: updates.assignedTeam,
        resolved_at: updates.resolvedAt?.toISOString(),
        closed_at: updates.closedAt?.toISOString(),
        resolution_time: updates.resolutionTime,
        satisfaction: updates.satisfaction,
        satisfaction_comment: updates.satisfactionComment,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return this.mapTicket(data);
  }

  /**
   * Assign ticket
   */
  async assignTicket(ticketId: string, assignTo: string, assignType: 'user' | 'team'): Promise<Ticket> {
    const updates: Partial<Ticket> = {
      assignedTo: assignType === 'user' ? assignTo : undefined,
      assignedTeam: assignType === 'team' ? assignTo : undefined,
      status: 'open'
    };

    const ticket = await this.updateTicket(ticketId, updates);

    // Add system message
    await this.addReply({
      ticketId,
      content: `Ticket assigned to ${assignType} ${assignTo}`,
      isInternal: true,
      authorName: 'System',
      authorEmail: 'system@airevenueorc.com',
      authorType: 'system'
    });

    return ticket;
  }

  /**
   * Add reply to ticket
   */
  async addReply(reply: Partial<TicketReply>): Promise<TicketReply> {
    const { data, error } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: reply.ticketId,
        content: reply.content,
        is_internal: reply.isInternal || false,
        attachments: reply.attachments,
        author_id: reply.authorId,
        author_name: reply.authorName,
        author_email: reply.authorEmail,
        author_type: reply.authorType || 'agent'
      })
      .select()
      .single();

    if (error) throw error;

    // Update ticket's last reply info
    await supabase
      .from('tickets')
      .update({
        last_reply_at: new Date().toISOString(),
        last_reply_by: reply.authorId
      })
      .eq('id', reply.ticketId);

    // Check if this is first response
    const ticket = await this.getTicket(reply.ticketId!);
    if (!ticket.firstResponseTime && reply.authorType === 'agent') {
      const firstResponseTime = (new Date().getTime() - ticket.createdAt.getTime()) / 60000;

      await supabase
        .from('tickets')
        .update({ first_response_time: firstResponseTime })
        .eq('id', reply.ticketId);
    }

    return this.mapReply(data);
  }

  /**
   * Get ticket
   */
  async getTicket(ticketId: string): Promise<Ticket> {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    return this.mapTicket(data);
  }

  /**
   * Get tickets
   */
  async getTickets(filters?: {
    status?: Ticket['status'];
    priority?: Ticket['priority'];
    assignedTo?: string;
    assignedTeam?: string;
    customerId?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Ticket[]> {
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters?.assignedTeam) {
      query = query.eq('assigned_team', filters.assignedTeam);
    }

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.search) {
      query = query.or(`subject.ilike.%${filters.search}%,description.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapTicket);
  }

  /**
   * Get ticket replies
   */
  async getReplies(ticketId: string, includeInternal: boolean = true): Promise<TicketReply[]> {
    let query = supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (!includeInternal) {
      query = query.eq('is_internal', false);
    }

    const { data } = await query;
    return (data || []).map(this.mapReply);
  }

  /**
   * Create SLA
   */
  async createSLA(sla: Partial<SLA>): Promise<SLA> {
    const { data, error } = await supabase
      .from('slas')
      .insert({
        name: sla.name,
        description: sla.description,
        priority: sla.priority,
        first_response_target: sla.firstResponseTarget,
        resolution_target: sla.resolutionTarget,
        business_hours_only: sla.businessHoursOnly || false,
        business_hours: sla.businessHours,
        escalation_enabled: sla.escalationEnabled || false,
        escalation_after: sla.escalationAfter,
        escalate_to: sla.escalateTo,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapSLA(data);
  }

  /**
   * Get SLA
   */
  async getSLA(slaId: string): Promise<SLA> {
    const { data, error } = await supabase
      .from('slas')
      .select('*')
      .eq('id', slaId)
      .single();

    if (error) throw error;
    return this.mapSLA(data);
  }

  /**
   * Create canned response
   */
  async createCannedResponse(response: Partial<CannedResponse>): Promise<CannedResponse> {
    const { data, error } = await supabase
      .from('canned_responses')
      .insert({
        name: response.name,
        shortcut: response.shortcut,
        subject: response.subject,
        content: response.content,
        category: response.category,
        is_public: response.isPublic !== false,
        usage_count: 0,
        created_by: response.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCannedResponse(data);
  }

  /**
   * Get canned responses
   */
  async getCannedResponses(category?: string): Promise<CannedResponse[]> {
    let query = supabase
      .from('canned_responses')
      .select('*')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data } = await query;
    return (data || []).map(this.mapCannedResponse);
  }

  /**
   * Use canned response
   */
  async useCannedResponse(responseId: string): Promise<CannedResponse> {
    await supabase.rpc('increment_canned_response_usage', { p_response_id: responseId });

    return this.getCannedResponse(responseId);
  }

  /**
   * Get canned response
   */
  async getCannedResponse(responseId: string): Promise<CannedResponse> {
    const { data, error } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('id', responseId)
      .single();

    if (error) throw error;
    return this.mapCannedResponse(data);
  }

  /**
   * Get ticket analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<TicketAnalytics> {
    let query = supabase.from('tickets').select('*');

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
    }

    const { data: tickets } = await query;

    const totalTickets = tickets?.length || 0;
    const openTickets = tickets?.filter(t => ['new', 'open', 'pending'].includes(t.status)).length || 0;
    const resolvedTickets = tickets?.filter(t => ['resolved', 'closed'].includes(t.status)).length || 0;

    // Calculate averages
    const responseTimes = tickets?.filter(t => t.first_response_time).map(t => t.first_response_time) || [];
    const avgFirstResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const resolutionTimes = tickets?.filter(t => t.resolution_time).map(t => t.resolution_time) || [];
    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    // SLA compliance
    const slaCompliance = totalTickets > 0
      ? ((tickets?.filter(t => !t.sla_breached).length || 0) / totalTickets) * 100
      : 100;

    // Satisfaction score
    const satisfactionScores = {
      satisfied: 5,
      neutral: 3,
      dissatisfied: 1
    };
    const satisfactionRatings = tickets?.filter(t => t.satisfaction).map(t => satisfactionScores[t.satisfaction!]) || [];
    const satisfactionScore = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((a, b) => a + b, 0) / satisfactionRatings.length
      : 0;

    // Group by status, priority, category
    const ticketsByStatus = this.groupBy(tickets || [], 'status');
    const ticketsByPriority = this.groupBy(tickets || [], 'priority');
    const ticketsByCategory = this.groupBy(tickets || [], 'category');

    // Top agents (placeholder - would need more data)
    const topAgents: TicketAnalytics['topAgents'] = [];

    // Trend data
    const trendData = this.groupTicketsByDate(tickets || []);

    return {
      totalTickets,
      openTickets,
      resolvedTickets,
      avgFirstResponseTime,
      avgResolutionTime,
      slaCompliance,
      satisfactionScore,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      topAgents,
      trendData
    };
  }

  /**
   * Generate unique ticket number
   */
  private async generateTicketNumber(): Promise<string> {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true });

    const number = (count || 0) + 1;
    return `TICKET-${String(number).padStart(6, '0')}`;
  }

  /**
   * Apply routing rules
   */
  private async applyRoutingRules(ticket: Partial<Ticket>): Promise<{
    assignTo?: string;
    assignToTeam?: string;
    setPriority?: Ticket['priority'];
    setCategory?: string;
    addTags?: string[];
    applySLA?: string;
  }> {
    const { data: rules } = await supabase
      .from('ticket_routing_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority');

    let result: any = {};

    for (const rule of rules || []) {
      const matches = this.evaluateRuleConditions(ticket, rule.conditions);
      if (matches) {
        result = {
          assignTo: rule.assign_to || result.assignTo,
          assignToTeam: rule.assign_to_team || result.assignToTeam,
          setPriority: rule.set_priority || result.setPriority,
          setCategory: rule.set_category || result.setCategory,
          addTags: [...(result.addTags || []), ...(rule.add_tags || [])],
          applySLA: rule.apply_sla || result.applySLA
        };
        break; // First matching rule wins
      }
    }

    return result;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateRuleConditions(ticket: any, conditions: any[]): boolean {
    return conditions.every(condition => {
      const value = ticket[condition.field];

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'starts_with':
          return String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Calculate due date based on SLA
   */
  private calculateDueDate(targetMinutes: number, businessHoursOnly: boolean): Date {
    const now = new Date();

    if (!businessHoursOnly) {
      return new Date(now.getTime() + targetMinutes * 60000);
    }

    // TODO: Implement business hours calculation
    // For now, return simple calculation
    return new Date(now.getTime() + targetMinutes * 60000);
  }

  /**
   * Group tickets by field
   */
  private groupBy(tickets: any[], field: string): Record<string, number> {
    const groups: Record<string, number> = {};
    tickets.forEach(t => {
      const value = t[field] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  /**
   * Group tickets by date
   */
  private groupTicketsByDate(tickets: any[]): Array<{
    date: string;
    created: number;
    resolved: number;
    avgResponseTime: number;
  }> {
    const groups: Record<string, { created: number; resolved: number; responseTimes: number[] }> = {};

    tickets.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = { created: 0, resolved: 0, responseTimes: [] };
      }
      groups[date].created++;

      if (t.resolved_at) {
        const resolvedDate = new Date(t.resolved_at).toISOString().split('T')[0];
        if (!groups[resolvedDate]) {
          groups[resolvedDate] = { created: 0, resolved: 0, responseTimes: [] };
        }
        groups[resolvedDate].resolved++;
      }

      if (t.first_response_time) {
        groups[date].responseTimes.push(t.first_response_time);
      }
    });

    return Object.entries(groups).map(([date, data]) => ({
      date,
      created: data.created,
      resolved: data.resolved,
      avgResponseTime: data.responseTimes.length > 0
        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
        : 0
    }));
  }

  /**
   * Map database record to Ticket
   */
  private mapTicket(data: any): Ticket {
    return {
      id: data.id,
      ticketNumber: data.ticket_number,
      subject: data.subject,
      description: data.description,
      status: data.status,
      priority: data.priority,
      category: data.category,
      tags: data.tags || [],
      customerId: data.customer_id,
      customerEmail: data.customer_email,
      customerName: data.customer_name,
      assignedTo: data.assigned_to,
      assignedTeam: data.assigned_team,
      slaId: data.sla_id,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      firstResponseTime: data.first_response_time,
      resolutionTime: data.resolution_time,
      slaBreached: data.sla_breached,
      channel: data.channel,
      lastReplyAt: data.last_reply_at ? new Date(data.last_reply_at) : undefined,
      lastReplyBy: data.last_reply_by,
      satisfaction: data.satisfaction,
      satisfactionComment: data.satisfaction_comment,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
      closedAt: data.closed_at ? new Date(data.closed_at) : undefined
    };
  }

  /**
   * Map database record to TicketReply
   */
  private mapReply(data: any): TicketReply {
    return {
      id: data.id,
      ticketId: data.ticket_id,
      content: data.content,
      isInternal: data.is_internal,
      attachments: data.attachments,
      authorId: data.author_id,
      authorName: data.author_name,
      authorEmail: data.author_email,
      authorType: data.author_type,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to SLA
   */
  private mapSLA(data: any): SLA {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      priority: data.priority,
      firstResponseTarget: data.first_response_target,
      resolutionTarget: data.resolution_target,
      businessHoursOnly: data.business_hours_only,
      businessHours: data.business_hours,
      escalationEnabled: data.escalation_enabled,
      escalationAfter: data.escalation_after,
      escalateTo: data.escalate_to,
      isActive: data.is_active,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to CannedResponse
   */
  private mapCannedResponse(data: any): CannedResponse {
    return {
      id: data.id,
      name: data.name,
      shortcut: data.shortcut,
      subject: data.subject,
      content: data.content,
      category: data.category,
      isPublic: data.is_public,
      usageCount: data.usage_count,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Ticketing Service
 */
export function createTicketingService(): TicketingService {
  return new TicketingService();
}
