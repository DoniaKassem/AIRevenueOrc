import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read_at?: string;
  created_at: string;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  in_app_enabled: boolean;
  notification_types: Record<string, boolean>;
}

export const NOTIFICATION_TYPES = {
  PROSPECT_ASSIGNED: 'prospect_assigned',
  DEAL_WON: 'deal_won',
  DEAL_LOST: 'deal_lost',
  DEAL_STAGE_CHANGED: 'deal_stage_changed',
  EMAIL_REPLIED: 'email_replied',
  MEETING_SCHEDULED: 'meeting_scheduled',
  CADENCE_COMPLETED: 'cadence_completed',
  TASK_DUE: 'task_due',
  TASK_OVERDUE: 'task_overdue',
  MENTION: 'mention',
  TEAM_UPDATE: 'team_update',
  QUOTA_WARNING: 'quota_warning',
  INTEGRATION_ERROR: 'integration_error',
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
};

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  options: {
    link?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  } = {}
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      link: options.link,
      priority: options.priority || 'normal',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data;
}

export async function createBulkNotifications(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  options: {
    link?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  } = {}
): Promise<void> {
  const notifications = userIds.map(userId => ({
    user_id: userId,
    type,
    title,
    message,
    link: options.link,
    priority: options.priority || 'normal',
  }));

  const { error } = await supabase.from('notifications').insert(notifications);

  if (error) {
    console.error('Failed to create bulk notifications:', error);
  }
}

export async function getUserNotifications(
  userId: string,
  options: {
    unread_only?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  if (options.unread_only) {
    query = query.is('read_at', null);
  }

  query = query.order('created_at', { ascending: false });

  if (options.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching notifications:', error);
    return { notifications: [], total: 0, unread_count: 0 };
  }

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  return {
    notifications: data || [],
    total: count || 0,
    unread_count: unreadCount || 0,
  };
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    console.error('Failed to mark notification as read:', error);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('Failed to mark all notifications as read:', error);
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Failed to delete notification:', error);
  }
}

export async function deleteOldNotifications(
  userId: string,
  olderThanDays: number = 30
): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    console.error('Failed to delete old notifications:', error);
  }
}

export function getNotificationIcon(type: string): string {
  const icons: Record<string, string> = {
    [NOTIFICATION_TYPES.PROSPECT_ASSIGNED]: '👤',
    [NOTIFICATION_TYPES.DEAL_WON]: '🎉',
    [NOTIFICATION_TYPES.DEAL_LOST]: '😔',
    [NOTIFICATION_TYPES.DEAL_STAGE_CHANGED]: '📊',
    [NOTIFICATION_TYPES.EMAIL_REPLIED]: '📧',
    [NOTIFICATION_TYPES.MEETING_SCHEDULED]: '📅',
    [NOTIFICATION_TYPES.CADENCE_COMPLETED]: '✅',
    [NOTIFICATION_TYPES.TASK_DUE]: '⏰',
    [NOTIFICATION_TYPES.TASK_OVERDUE]: '🔴',
    [NOTIFICATION_TYPES.MENTION]: '💬',
    [NOTIFICATION_TYPES.TEAM_UPDATE]: '👥',
    [NOTIFICATION_TYPES.QUOTA_WARNING]: '⚠️',
    [NOTIFICATION_TYPES.INTEGRATION_ERROR]: '🔌',
    [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: '📢',
  };

  return icons[type] || '🔔';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'text-slate-600',
    normal: 'text-blue-600',
    high: 'text-orange-600',
    urgent: 'text-red-600',
  };

  return colors[priority] || 'text-slate-600';
}

export async function notifyProspectAssigned(
  userId: string,
  prospectName: string,
  prospectId: string
): Promise<void> {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.PROSPECT_ASSIGNED,
    'New Prospect Assigned',
    `${prospectName} has been assigned to you`,
    { link: `#prospects?id=${prospectId}`, priority: 'normal' }
  );
}

export async function notifyDealWon(
  userId: string,
  dealName: string,
  dealValue: number,
  dealId: string
): Promise<void> {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.DEAL_WON,
    'Deal Won!',
    `Congratulations! ${dealName} closed for $${dealValue.toLocaleString()}`,
    { link: `#pipeline?deal=${dealId}`, priority: 'high' }
  );
}

export async function notifyEmailReplied(
  userId: string,
  prospectName: string,
  prospectId: string
): Promise<void> {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.EMAIL_REPLIED,
    'Email Reply Received',
    `${prospectName} replied to your email`,
    { link: `#prospects?id=${prospectId}`, priority: 'normal' }
  );
}

export async function notifyTaskOverdue(
  userId: string,
  taskName: string,
  taskId: string
): Promise<void> {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.TASK_OVERDUE,
    'Task Overdue',
    `Task "${taskName}" is now overdue`,
    { link: `#tasks?id=${taskId}`, priority: 'urgent' }
  );
}

export async function notifyQuotaWarning(
  userId: string,
  quotaType: string,
  percentageUsed: number
): Promise<void> {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.QUOTA_WARNING,
    'Quota Warning',
    `Your ${quotaType} usage is at ${percentageUsed}%`,
    { link: '#settings?tab=quotas', priority: 'high' }
  );
}

export async function notifySystemAnnouncement(
  userIds: string[],
  title: string,
  message: string,
  link?: string
): Promise<void> {
  await createBulkNotifications(
    userIds,
    NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
    title,
    message,
    { link, priority: 'high' }
  );
}

export async function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): Promise<() => void> {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      payload => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getNotificationStats(
  userId: string,
  days: number = 30
): Promise<{
  total: number;
  unread: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('type, priority, read_at')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString());

  if (error || !notifications) {
    return { total: 0, unread: 0, by_type: {}, by_priority: {} };
  }

  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let unread = 0;

  notifications.forEach(notif => {
    byType[notif.type] = (byType[notif.type] || 0) + 1;
    byPriority[notif.priority] = (byPriority[notif.priority] || 0) + 1;
    if (!notif.read_at) unread++;
  });

  return {
    total: notifications.length,
    unread,
    by_type: byType,
    by_priority: byPriority,
  };
}
