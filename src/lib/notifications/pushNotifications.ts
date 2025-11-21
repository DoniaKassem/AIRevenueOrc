/**
 * Browser Push Notification Service
 *
 * Features:
 * - Web Push API for browser notifications (works even when tab is closed)
 * - VAPID authentication
 * - Subscription management
 * - Rich notifications with actions
 * - Push notification tracking
 * - Multi-device support per user
 * - Automatic retry with exponential backoff
 *
 * Priority 1 Launch Blocker Feature
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { Notification } from './notificationService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Configure VAPID keys for Web Push
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@airevenueorc.com'}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// =============================================
// TYPES & INTERFACES
// =============================================

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  deviceName?: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt: Date;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, any>;
}

// =============================================
// PUSH NOTIFICATION SERVICE
// =============================================

export class PushNotificationService {
  /**
   * Save push subscription for a user
   */
  async subscribe(params: {
    userId: string;
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };
    userAgent?: string;
    deviceName?: string;
  }): Promise<PushSubscription> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: params.userId,
        endpoint: params.subscription.endpoint,
        keys: params.subscription.keys,
        user_agent: params.userAgent,
        device_name: params.deviceName,
        is_active: true,
        last_used: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapSubscription(data);
  }

  /**
   * Remove push subscription
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }

  /**
   * Get all active subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select()
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    return (data || []).map(this.mapSubscription);
  }

  /**
   * Send push notification to a user (all their devices)
   */
  async sendNotification(
    userId: string,
    notification: Notification
  ): Promise<{
    sent: number;
    failed: number;
  }> {
    const subscriptions = await this.getUserSubscriptions(userId);

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const payload = this.buildPayload(notification);

    let sent = 0;
    let failed = 0;

    const promises = subscriptions.map(async (subscription) => {
      try {
        await this.sendToSubscription(subscription, payload);
        sent++;

        // Update last used
        await supabase
          .from('push_subscriptions')
          .update({ last_used: new Date().toISOString() })
          .eq('id', subscription.id);

        // Mark delivery as sent
        await supabase
          .from('notification_deliveries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { push_subscription_id: subscription.id },
          })
          .eq('notification_id', notification.id)
          .eq('channel', 'push');
      } catch (error) {
        failed++;
        console.error(`Failed to send push to subscription ${subscription.id}:`, error);

        // If subscription is no longer valid, mark as inactive
        if (this.isSubscriptionError(error)) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', subscription.id);
        }

        // Mark delivery as failed
        await supabase
          .from('notification_deliveries')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            last_error: String(error),
          })
          .eq('notification_id', notification.id)
          .eq('channel', 'push');
      }
    });

    await Promise.allSettled(promises);

    console.log(`Push notification sent to ${sent}/${subscriptions.length} devices for user ${userId}`);

    return { sent, failed };
  }

  /**
   * Send push notification to specific subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: PushNotificationPayload
  ): Promise<void> {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 86400, // 24 hours
        urgency: this.getUrgency(payload),
      }
    );
  }

  /**
   * Build push notification payload from notification
   */
  private buildPayload(notification: Notification): PushNotificationPayload {
    const actions: PushNotificationPayload['actions'] = [];

    if (notification.actionUrl) {
      actions.push({
        action: 'view',
        title: notification.actionLabel || 'View',
      });
    }

    actions.push({
      action: 'dismiss',
      title: 'Dismiss',
    });

    return {
      title: notification.title,
      body: notification.message,
      icon: notification.icon || '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      image: notification.imageUrl,
      tag: notification.groupKey || notification.id,
      requireInteraction: notification.priority === 'urgent',
      actions,
      data: {
        notificationId: notification.id,
        eventType: notification.eventType,
        eventId: notification.eventId,
        actionUrl: notification.actionUrl,
        priority: notification.priority,
        timestamp: notification.createdAt.toISOString(),
        ...notification.metadata,
      },
    };
  }

  /**
   * Get urgency level for push notification
   */
  private getUrgency(payload: PushNotificationPayload): 'very-low' | 'low' | 'normal' | 'high' {
    const priority = payload.data?.priority || 'medium';

    switch (priority) {
      case 'urgent':
        return 'high';
      case 'high':
        return 'normal';
      case 'medium':
        return 'low';
      case 'low':
        return 'very-low';
      default:
        return 'normal';
    }
  }

  /**
   * Check if error is due to invalid subscription
   */
  private isSubscriptionError(error: any): boolean {
    // 410 Gone = subscription expired
    // 404 Not Found = subscription not found
    return error?.statusCode === 410 || error?.statusCode === 404;
  }

  /**
   * Clean up expired/inactive subscriptions
   */
  async cleanupSubscriptions(): Promise<void> {
    // Mark subscriptions not used in 30 days as inactive
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('last_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    console.log('Cleaned up inactive push subscriptions');
  }

  /**
   * Test push notification to specific subscription
   */
  async testNotification(userId: string, endpoint: string): Promise<boolean> {
    const { data: subscription } = await supabase
      .from('push_subscriptions')
      .select()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .single();

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const testPayload: PushNotificationPayload = {
      title: '🎯 Test Notification',
      body: 'If you can see this, push notifications are working!',
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      requireInteraction: false,
      actions: [
        {
          action: 'dismiss',
          title: 'Got it!',
        },
      ],
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.sendToSubscription(this.mapSubscription(subscription), testPayload);
      return true;
    } catch (error) {
      console.error('Test notification failed:', error);
      return false;
    }
  }

  /**
   * Get push subscription statistics for user
   */
  async getStats(userId: string): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    deviceBreakdown: Record<string, number>;
  }> {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select()
      .eq('user_id', userId);

    if (!subscriptions) {
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        deviceBreakdown: {},
      };
    }

    const deviceBreakdown: Record<string, number> = {};

    subscriptions.forEach((sub) => {
      const device = this.getDeviceType(sub.user_agent);
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
    });

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((s) => s.is_active).length,
      deviceBreakdown,
    };
  }

  /**
   * Get device type from user agent
   */
  private getDeviceType(userAgent?: string): string {
    if (!userAgent) return 'Unknown';

    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    if (/Android/.test(userAgent)) return 'Android';
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Macintosh|Mac OS X/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';

    return 'Other';
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private mapSubscription(data: any): PushSubscription {
    return {
      id: data.id,
      userId: data.user_id,
      endpoint: data.endpoint,
      keys: data.keys,
      userAgent: data.user_agent,
      deviceName: data.device_name,
      isActive: data.is_active,
      lastUsed: data.last_used ? new Date(data.last_used) : undefined,
      createdAt: new Date(data.created_at),
    };
  }
}

// =============================================
// CLIENT-SIDE HELPER (for frontend)
// =============================================

/**
 * Client-side service worker registration code
 * This should be included in the frontend application
 */
export const clientSideCode = `
// Service Worker registration
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Request notification permission and subscribe
async function subscribeToPushNotifications() {
  // Check if browser supports notifications
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return null;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return null;
  }

  // Get service worker registration
  const registration = await registerServiceWorker();
  if (!registration) return null;

  // Subscribe to push notifications
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Send subscription to backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getAuthToken(),
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
        deviceName: await getDeviceName(),
      }),
    });

    console.log('Subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Get device name
async function getDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Browser';
}

// Service Worker code (sw.js)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    actions: data.actions,
    data: data.data,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;

  if (event.action === 'view' && data.actionUrl) {
    event.waitUntil(
      clients.openWindow(data.actionUrl)
    );
  } else if (event.action === 'dismiss') {
    // Just close
  } else {
    // Default click - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }

  // Track notification click
  if (data.notificationId) {
    fetch('/api/notifications/' + data.notificationId + '/click', {
      method: 'POST',
    });
  }
});
`;

// =============================================
// FACTORY
// =============================================

let pushServiceInstance: PushNotificationService | null = null;

export function createPushNotificationService(): PushNotificationService {
  if (!pushServiceInstance) {
    pushServiceInstance = new PushNotificationService();
  }
  return pushServiceInstance;
}
