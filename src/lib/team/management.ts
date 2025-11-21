/**
 * Team Management System
 * Manages team hierarchies, territories, and quotas
 */

import { supabase } from '../supabase';

export interface TeamHierarchy {
  id: string;
  organizationId: string;
  name: string;
  parentTeamId?: string;
  managerId?: string;

  // Team settings
  description?: string;
  teamType: 'sales' | 'marketing' | 'customer_success' | 'bdr' | 'custom';

  // Hierarchy
  level: number; // 0 = root, 1 = sub-team, etc.
  path: string; // e.g., "root/sales/enterprise"

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Territory {
  id: string;
  organizationId: string;
  name: string;
  description?: string;

  // Territory definition
  territoryType: 'geographic' | 'account_based' | 'industry' | 'product' | 'custom';

  // Geographic territories
  countries?: string[];
  regions?: string[];
  states?: string[];
  cities?: string[];
  postalCodes?: string[];

  // Account-based territories
  accountIds?: string[];
  accountTiers?: string[]; // e.g., 'enterprise', 'mid-market', 'smb'
  revenueRange?: { min: number; max: number };

  // Industry-based territories
  industries?: string[];

  // Custom criteria
  customCriteria?: Record<string, any>;

  // Assignments
  assignedUserIds: string[];
  assignedTeamIds: string[];

  // Rules
  isExclusive: boolean; // If true, accounts can only belong to one territory
  priority: number; // Higher priority wins in conflicts

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Quota {
  id: string;
  organizationId: string;

  // Assignment
  userId?: string;
  teamId?: string;

  // Quota details
  name: string;
  quotaType: 'revenue' | 'pipeline' | 'meetings' | 'calls' | 'emails' | 'opportunities' | 'custom';

  // Target
  target: number;
  unit: string; // e.g., 'USD', 'count'

  // Time period
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;

  // Progress
  currentValue: number;
  attainment: number; // Percentage: (current / target) * 100

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'member' | 'manager' | 'admin';

  // Reporting
  reportsTo?: string; // User ID of manager

  // Territory assignments
  territoryIds: string[];

  // Status
  isActive: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

/**
 * Team Management Service
 */
export class TeamManagementService {
  /**
   * Create team
   */
  async createTeam(params: {
    organizationId: string;
    name: string;
    teamType: 'sales' | 'marketing' | 'customer_success' | 'bdr' | 'custom';
    parentTeamId?: string;
    managerId?: string;
    description?: string;
    createdBy: string;
  }): Promise<TeamHierarchy> {
    // Calculate level and path
    let level = 0;
    let path = params.name.toLowerCase().replace(/\s+/g, '_');

    if (params.parentTeamId) {
      const { data: parent } = await supabase
        .from('team_hierarchies')
        .select('level, path')
        .eq('id', params.parentTeamId)
        .single();

      if (parent) {
        level = parent.level + 1;
        path = `${parent.path}/${path}`;
      }
    }

    const { data, error } = await supabase
      .from('team_hierarchies')
      .insert({
        organization_id: params.organizationId,
        name: params.name,
        team_type: params.teamType,
        parent_team_id: params.parentTeamId,
        manager_id: params.managerId,
        description: params.description,
        level,
        path,
        created_by: params.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create team: ${error.message}`);
    }

    return this.mapToTeamHierarchy(data);
  }

  /**
   * Get team hierarchy tree
   */
  async getTeamTree(organizationId: string): Promise<TeamHierarchy[]> {
    const { data: teams } = await supabase
      .from('team_hierarchies')
      .select('*')
      .eq('organization_id', organizationId)
      .order('level', { ascending: true })
      .order('name', { ascending: true });

    if (!teams) return [];

    return teams.map(t => this.mapToTeamHierarchy(t));
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<Array<TeamMember & { user: any }>> {
    const { data: members } = await supabase
      .from('team_members')
      .select(`
        *,
        user:users(id, email, first_name, last_name, avatar_url)
      `)
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (!members) return [];

    return members.map(m => ({
      id: m.id,
      userId: m.user_id,
      teamId: m.team_id,
      role: m.role,
      reportsTo: m.reports_to,
      territoryIds: m.territory_ids || [],
      isActive: m.is_active,
      joinedAt: new Date(m.joined_at),
      leftAt: m.left_at ? new Date(m.left_at) : undefined,
      user: m.user,
    }));
  }

  /**
   * Add team member
   */
  async addTeamMember(params: {
    userId: string;
    teamId: string;
    role: 'member' | 'manager' | 'admin';
    reportsTo?: string;
    territoryIds?: string[];
  }): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        user_id: params.userId,
        team_id: params.teamId,
        role: params.role,
        reports_to: params.reportsTo,
        territory_ids: params.territoryIds || [],
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add team member: ${error.message}`);
    }

    return {
      id: data.id,
      userId: data.user_id,
      teamId: data.team_id,
      role: data.role,
      reportsTo: data.reports_to,
      territoryIds: data.territory_ids || [],
      isActive: data.is_active,
      joinedAt: new Date(data.joined_at),
    };
  }

  /**
   * Remove team member
   */
  async removeTeamMember(userId: string, teamId: string): Promise<void> {
    await supabase
      .from('team_members')
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('team_id', teamId);
  }

  /**
   * Create territory
   */
  async createTerritory(params: {
    organizationId: string;
    name: string;
    territoryType: 'geographic' | 'account_based' | 'industry' | 'product' | 'custom';
    description?: string;
    countries?: string[];
    regions?: string[];
    states?: string[];
    cities?: string[];
    industries?: string[];
    accountTiers?: string[];
    customCriteria?: Record<string, any>;
    assignedUserIds?: string[];
    assignedTeamIds?: string[];
    isExclusive?: boolean;
    priority?: number;
    createdBy: string;
  }): Promise<Territory> {
    const { data, error } = await supabase
      .from('territories')
      .insert({
        organization_id: params.organizationId,
        name: params.name,
        territory_type: params.territoryType,
        description: params.description,
        countries: params.countries,
        regions: params.regions,
        states: params.states,
        cities: params.cities,
        industries: params.industries,
        account_tiers: params.accountTiers,
        custom_criteria: params.customCriteria,
        assigned_user_ids: params.assignedUserIds || [],
        assigned_team_ids: params.assignedTeamIds || [],
        is_exclusive: params.isExclusive || false,
        priority: params.priority || 0,
        created_by: params.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create territory: ${error.message}`);
    }

    return this.mapToTerritory(data);
  }

  /**
   * Get territories
   */
  async getTerritories(organizationId: string): Promise<Territory[]> {
    const { data: territories } = await supabase
      .from('territories')
      .select('*')
      .eq('organization_id', organizationId)
      .order('priority', { ascending: false });

    if (!territories) return [];

    return territories.map(t => this.mapToTerritory(t));
  }

  /**
   * Assign territory to user
   */
  async assignTerritory(territoryId: string, userId: string): Promise<void> {
    const { data: territory } = await supabase
      .from('territories')
      .select('assigned_user_ids')
      .eq('id', territoryId)
      .single();

    if (!territory) {
      throw new Error('Territory not found');
    }

    const userIds = territory.assigned_user_ids || [];
    if (!userIds.includes(userId)) {
      userIds.push(userId);

      await supabase
        .from('territories')
        .update({ assigned_user_ids: userIds })
        .eq('id', territoryId);
    }
  }

  /**
   * Check territory ownership for account
   */
  async findAccountTerritory(accountId: string): Promise<Territory | null> {
    // Get account details
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (!account) return null;

    // Get all territories ordered by priority
    const { data: territories } = await supabase
      .from('territories')
      .select('*')
      .eq('organization_id', account.team_id)
      .order('priority', { ascending: false });

    if (!territories) return null;

    // Check each territory
    for (const territory of territories) {
      if (this.accountMatchesTerritory(account, territory)) {
        return this.mapToTerritory(territory);
      }
    }

    return null;
  }

  /**
   * Create quota
   */
  async createQuota(params: {
    organizationId: string;
    userId?: string;
    teamId?: string;
    name: string;
    quotaType: 'revenue' | 'pipeline' | 'meetings' | 'calls' | 'emails' | 'opportunities' | 'custom';
    target: number;
    unit: string;
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    startDate: Date;
    endDate: Date;
    createdBy: string;
  }): Promise<Quota> {
    const { data, error } = await supabase
      .from('quotas')
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        team_id: params.teamId,
        name: params.name,
        quota_type: params.quotaType,
        target: params.target,
        unit: params.unit,
        period: params.period,
        start_date: params.startDate.toISOString(),
        end_date: params.endDate.toISOString(),
        current_value: 0,
        attainment: 0,
        created_by: params.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create quota: ${error.message}`);
    }

    return this.mapToQuota(data);
  }

  /**
   * Get quotas for user
   */
  async getUserQuotas(userId: string): Promise<Quota[]> {
    const { data: quotas } = await supabase
      .from('quotas')
      .select('*')
      .eq('user_id', userId)
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: false });

    if (!quotas) return [];

    return quotas.map(q => this.mapToQuota(q));
  }

  /**
   * Get quotas for team
   */
  async getTeamQuotas(teamId: string): Promise<Quota[]> {
    const { data: quotas } = await supabase
      .from('quotas')
      .select('*')
      .eq('team_id', teamId)
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: false });

    if (!quotas) return [];

    return quotas.map(q => this.mapToQuota(q));
  }

  /**
   * Update quota progress
   */
  async updateQuotaProgress(quotaId: string, currentValue: number): Promise<void> {
    // Get quota target
    const { data: quota } = await supabase
      .from('quotas')
      .select('target')
      .eq('id', quotaId)
      .single();

    if (!quota) return;

    const attainment = (currentValue / quota.target) * 100;

    await supabase
      .from('quotas')
      .update({
        current_value: currentValue,
        attainment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotaId);
  }

  /**
   * Get team performance summary
   */
  async getTeamPerformance(teamId: string, startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    totalMeetings: number;
    totalCalls: number;
    totalEmails: number;
    totalOpportunities: number;
    quotaAttainment: number;
    topPerformers: Array<{ userId: string; userName: string; attainment: number }>;
  }> {
    // Get team members
    const members = await this.getTeamMembers(teamId);
    const userIds = members.map(m => m.userId);

    // Get activities in date range
    const { data: activities } = await supabase
      .from('bdr_activities')
      .select('*')
      .in('user_id', userIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const meetings = activities?.filter(a => a.activity_type === 'meeting_scheduled').length || 0;
    const calls = activities?.filter(a => a.activity_type === 'phone_call_made').length || 0;
    const emails = activities?.filter(a => a.activity_type === 'email_sent').length || 0;

    // Get team quotas
    const teamQuotas = await this.getTeamQuotas(teamId);
    const avgAttainment = teamQuotas.length > 0
      ? teamQuotas.reduce((sum, q) => sum + q.attainment, 0) / teamQuotas.length
      : 0;

    // Get top performers
    const topPerformers = [];
    for (const member of members) {
      const userQuotas = await this.getUserQuotas(member.userId);
      const userAttainment = userQuotas.length > 0
        ? userQuotas.reduce((sum, q) => sum + q.attainment, 0) / userQuotas.length
        : 0;

      topPerformers.push({
        userId: member.userId,
        userName: `${member.user.first_name} ${member.user.last_name}`,
        attainment: userAttainment,
      });
    }

    topPerformers.sort((a, b) => b.attainment - a.attainment);

    return {
      totalRevenue: 0, // Would calculate from opportunities
      totalMeetings: meetings,
      totalCalls: calls,
      totalEmails: emails,
      totalOpportunities: 0, // Would calculate from CRM
      quotaAttainment: avgAttainment,
      topPerformers: topPerformers.slice(0, 5),
    };
  }

  // Private helper methods

  private accountMatchesTerritory(account: any, territory: any): boolean {
    // Geographic match
    if (territory.countries && territory.countries.length > 0) {
      if (!territory.countries.includes(account.country)) {
        return false;
      }
    }

    if (territory.states && territory.states.length > 0) {
      if (!territory.states.includes(account.state)) {
        return false;
      }
    }

    if (territory.cities && territory.cities.length > 0) {
      if (!territory.cities.includes(account.city)) {
        return false;
      }
    }

    // Industry match
    if (territory.industries && territory.industries.length > 0) {
      if (!territory.industries.includes(account.industry)) {
        return false;
      }
    }

    // Account tier match
    if (territory.account_tiers && territory.account_tiers.length > 0) {
      const accountTier = this.determineAccountTier(account);
      if (!territory.account_tiers.includes(accountTier)) {
        return false;
      }
    }

    return true;
  }

  private determineAccountTier(account: any): string {
    const revenue = account.annual_revenue || 0;
    const employees = account.employees || 0;

    if (revenue > 100000000 || employees > 1000) return 'enterprise';
    if (revenue > 10000000 || employees > 100) return 'mid_market';
    return 'smb';
  }

  private mapToTeamHierarchy(data: any): TeamHierarchy {
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      parentTeamId: data.parent_team_id,
      managerId: data.manager_id,
      description: data.description,
      teamType: data.team_type,
      level: data.level,
      path: data.path,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
    };
  }

  private mapToTerritory(data: any): Territory {
    return {
      id: data.id,
      organizationId: data.organization_id,
      name: data.name,
      description: data.description,
      territoryType: data.territory_type,
      countries: data.countries,
      regions: data.regions,
      states: data.states,
      cities: data.cities,
      postalCodes: data.postal_codes,
      industries: data.industries,
      accountTiers: data.account_tiers,
      customCriteria: data.custom_criteria,
      assignedUserIds: data.assigned_user_ids || [],
      assignedTeamIds: data.assigned_team_ids || [],
      isExclusive: data.is_exclusive,
      priority: data.priority,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
    };
  }

  private mapToQuota(data: any): Quota {
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      teamId: data.team_id,
      name: data.name,
      quotaType: data.quota_type,
      target: data.target,
      unit: data.unit,
      period: data.period,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      currentValue: data.current_value,
      attainment: data.attainment,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
    };
  }
}

/**
 * Create team management service
 */
export function createTeamManagementService(): TeamManagementService {
  return new TeamManagementService();
}
