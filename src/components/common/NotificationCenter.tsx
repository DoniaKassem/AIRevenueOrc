/**
 * Notification Center Component
 *
 * Real-time notification center with WebSocket integration
 *
 * Features:
 * - Real-time notifications via WebSocket
 * - Unread count badge
 * - Mark as read
 * - Notification preferences
 * - Grouped by type
 * - Load more pagination
 */

import { useState, useEffect, useRef } from 'react';
import apiClient, { wsClient } from '../../lib/api-client';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  Settings,
  Mail,
  Users,
  TrendingUp,
  Calendar,
  MessageSquare,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// =============================================
// TYPES
// =============================================

interface Notification {
  id: string;
  eventType: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface NotificationGroup {
  date: string;
  notifications: Notification[];
}

interface NotificationCenterProps {
  className?: string;
}

// =============================================
// COMPONENT
// =============================================

export default function NotificationCenter({ className = '' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, []);

  // Set up WebSocket listener for real-time notifications
  useEffect(() => {
    wsClient.on('notification', handleNewNotification);

    return () => {
      wsClient.off('notification', handleNewNotification);
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPreferences(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await apiClient.getNotifications({
        limit: 20,
        offset: notifications.length,
      });

      setNotifications((prev) => [...prev, ...data]);
      setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
      setHasMore(data.length === 20);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleNewNotification(notification: Notification) {
    setNotifications((prev) => [notification, ...prev]);
    setUnreadCount((prev) => prev + 1);

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
      });
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await apiClient.markNotificationRead(notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      await apiClient.markAllNotificationsRead();

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // Group notifications by date
  const groupedNotifications: NotificationGroup[] = notifications.reduce(
    (groups: NotificationGroup[], notification) => {
      const date = new Date(notification.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const existingGroup = groups.find((g) => g.date === date);

      if (existingGroup) {
        existingGroup.notifications.push(notification);
      } else {
        groups.push({
          date,
          notifications: [notification],
        });
      }

      return groups;
    },
    []
  );

  const getIcon = (eventType: string, priority: string) => {
    const iconClass = priority === 'urgent' || priority === 'high' ? 'text-red-600' : 'text-slate-600';

    switch (eventType) {
      case 'deal_won':
        return <CheckCircle className={`w-5 h-5 text-green-600`} />;
      case 'deal_lost':
        return <XCircle className={`w-5 h-5 text-red-600`} />;
      case 'new_prospect':
        return <Users className={`w-5 h-5 ${iconClass}`} />;
      case 'email_opened':
      case 'email_clicked':
        return <Mail className={`w-5 h-5 ${iconClass}`} />;
      case 'meeting_scheduled':
        return <Calendar className={`w-5 h-5 ${iconClass}`} />;
      case 'reply_received':
        return <MessageSquare className={`w-5 h-5 ${iconClass}`} />;
      case 'deal_stage_changed':
        return <TrendingUp className={`w-5 h-5 ${iconClass}`} />;
      default:
        return <Info className={`w-5 h-5 ${iconClass}`} />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">High</span>;
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          requestNotificationPermission();
        }}
        className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Notification settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preferences Panel (overlay) */}
          {showPreferences && (
            <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl z-10">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Notification Settings</h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Manage your notification preferences in Settings &gt; Notifications
                </p>
                <a
                  href="#settings"
                  className="block w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg transition"
                  onClick={() => {
                    setShowPreferences(false);
                    setIsOpen(false);
                  }}
                >
                  Go to Settings
                </a>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <BellOff className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No notifications</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <>
                {groupedNotifications.map((group) => (
                  <div key={group.date}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{group.date}</p>
                    </div>
                    {group.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition ${
                          !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5">{getIcon(notification.eventType, notification.priority)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {notification.title}
                                  </p>
                                  {getPriorityBadge(notification.priority)}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {notification.message}
                                </p>
                              </div>
                              {!notification.isRead && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition ml-2"
                                  title="Mark as read"
                                >
                                  <Check className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {hasMore && (
                  <div className="p-3 text-center border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={loadNotifications}
                      disabled={loading}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
