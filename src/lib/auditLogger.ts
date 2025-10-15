import { supabase } from './supabase';

export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: any;
  metadata: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogFilters {
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  start_date?: Date;
  end_date?: Date;
  search?: string;
}

export async function logAuditEvent(
  organizationId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: any,
  metadata?: any
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changes: changes || {},
      metadata: metadata || {},
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

export async function getAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }

  if (filters.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  if (filters.entity_id) {
    query = query.eq('entity_id', filters.entity_id);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.start_date) {
    query = query.gte('created_at', filters.start_date.toISOString());
  }

  if (filters.end_date) {
    query = query.lte('created_at', filters.end_date.toISOString());
  }

  if (filters.search) {
    query = query.or(
      `action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error('Error fetching audit logs:', error);
    return { logs: [], total: 0 };
  }

  return {
    logs: data || [],
    total: count || 0,
  };
}

export async function getEntityHistory(
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching entity history:', error);
    return [];
  }

  return data || [];
}

export async function getUserActivity(
  userId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }

  return data || [];
}

export async function getAuditLogStats(
  organizationId: string,
  days: number = 30
): Promise<{
  total_actions: number;
  unique_users: number;
  actions_by_type: Record<string, number>;
  actions_by_entity: Record<string, number>;
  most_active_users: Array<{ user_id: string; action_count: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('user_id, action, entity_type')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString());

  if (error || !logs) {
    return {
      total_actions: 0,
      unique_users: 0,
      actions_by_type: {},
      actions_by_entity: {},
      most_active_users: [],
    };
  }

  const uniqueUsers = new Set(logs.map(log => log.user_id));
  const actionsByType: Record<string, number> = {};
  const actionsByEntity: Record<string, number> = {};
  const userActionCounts: Record<string, number> = {};

  logs.forEach(log => {
    actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    actionsByEntity[log.entity_type] = (actionsByEntity[log.entity_type] || 0) + 1;
    userActionCounts[log.user_id] = (userActionCounts[log.user_id] || 0) + 1;
  });

  const mostActiveUsers = Object.entries(userActionCounts)
    .map(([user_id, action_count]) => ({ user_id, action_count }))
    .sort((a, b) => b.action_count - a.action_count)
    .slice(0, 10);

  return {
    total_actions: logs.length,
    unique_users: uniqueUsers.size,
    actions_by_type: actionsByType,
    actions_by_entity: actionsByEntity,
    most_active_users: mostActiveUsers,
  };
}

export function formatAuditLogAction(action: string): string {
  const actionMap: Record<string, string> = {
    INSERT: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    LOGIN: 'Logged in',
    LOGOUT: 'Logged out',
    EXPORT: 'Exported',
    IMPORT: 'Imported',
    SHARE: 'Shared',
    ASSIGN: 'Assigned',
    UNASSIGN: 'Unassigned',
  };

  return actionMap[action.toUpperCase()] || action;
}

export function formatEntityType(entityType: string): string {
  return entityType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getChangeDescription(changes: any): string {
  if (!changes || typeof changes !== 'object') {
    return 'No changes recorded';
  }

  if (changes.old && changes.new) {
    const changedFields = Object.keys(changes.new).filter(
      key => JSON.stringify(changes.old[key]) !== JSON.stringify(changes.new[key])
    );

    if (changedFields.length === 0) {
      return 'No fields changed';
    }

    return `Changed: ${changedFields.join(', ')}`;
  }

  return 'Record modified';
}

export async function exportAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  format: 'json' | 'csv' = 'csv'
): Promise<string> {
  const { logs } = await getAuditLogs(organizationId, filters, 1, 10000);

  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  }

  const headers = [
    'Timestamp',
    'User ID',
    'Action',
    'Entity Type',
    'Entity ID',
    'Changes',
    'IP Address',
  ];

  const rows = logs.map(log => [
    log.created_at,
    log.user_id,
    log.action,
    log.entity_type,
    log.entity_id,
    JSON.stringify(log.changes),
    log.ip_address || 'N/A',
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

  return csv;
}

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  SHARE: 'SHARE',
  ASSIGN: 'ASSIGN',
  UNASSIGN: 'UNASSIGN',
  SEND_EMAIL: 'SEND_EMAIL',
  MAKE_CALL: 'MAKE_CALL',
  SCHEDULE_MEETING: 'SCHEDULE_MEETING',
  CHANGE_STAGE: 'CHANGE_STAGE',
  WIN_DEAL: 'WIN_DEAL',
  LOSE_DEAL: 'LOSE_DEAL',
};

export const AUDIT_ENTITY_TYPES = {
  PROSPECT: 'prospects',
  DEAL: 'deals',
  ACTIVITY: 'activities',
  CADENCE: 'cadences',
  EMAIL_TEMPLATE: 'email_templates',
  USER: 'users',
  TEAM: 'teams',
  INTEGRATION: 'team_integrations',
  SETTINGS: 'organization_settings',
  ROLE: 'roles',
};

export async function searchAuditLogs(
  organizationId: string,
  searchTerm: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .or(
      `action.ilike.%${searchTerm}%,entity_type.ilike.%${searchTerm}%,entity_id.ilike.%${searchTerm}%`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching audit logs:', error);
    return [];
  }

  return data || [];
}
