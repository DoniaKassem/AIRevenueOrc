/**
 * Email Notification Delivery Service
 *
 * Features:
 * - SendGrid integration for reliable email delivery
 * - Beautiful HTML email templates
 * - Email tracking (opens, clicks)
 * - Bounce and complaint handling
 * - Unsubscribe management
 * - Digest emails (hourly, daily, weekly)
 * - Email preferences and quiet hours
 * - Transactional vs marketing email separation
 *
 * Priority 1 Launch Blocker Feature
 */

import sgMail from '@sendgrid/mail';
import { createClient } from '@supabase/supabase-js';
import { Notification, NotificationEventType } from './notificationService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// =============================================
// TYPES & INTERFACES
// =============================================

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailNotificationParams {
  to: string;
  toName?: string;
  notification: Notification;
  unsubscribeUrl: string;
}

export interface DigestEmailParams {
  to: string;
  toName?: string;
  notifications: Notification[];
  frequency: 'hourly' | 'daily' | 'weekly';
  unsubscribeUrl: string;
}

export interface EmailTrackingEvent {
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam_report' | 'unsubscribed';
  notificationId?: string;
  email: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// =============================================
// EMAIL NOTIFICATION SERVICE
// =============================================

export class EmailNotificationService {
  private fromEmail: string;
  private fromName: string;
  private baseUrl: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'notifications@airevenueorc.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'AI Revenue Orc';
    this.baseUrl = process.env.APP_URL || 'https://app.airevenueorc.com';
  }

  /**
   * Send a single notification email
   */
  async sendNotificationEmail(params: EmailNotificationParams): Promise<void> {
    const template = this.buildNotificationTemplate(
      params.notification,
      params.toName,
      params.unsubscribeUrl
    );

    const trackingId = `${params.notification.id}-email`;

    try {
      await sgMail.send({
        to: params.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: template.subject,
        html: this.injectTracking(template.html, trackingId),
        text: template.text,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
        customArgs: {
          notification_id: params.notification.id,
          event_type: params.notification.eventType,
        },
      });

      console.log(`Email notification sent to ${params.to}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  /**
   * Send digest email with multiple notifications
   */
  async sendDigestEmail(params: DigestEmailParams): Promise<void> {
    const template = this.buildDigestTemplate(
      params.notifications,
      params.frequency,
      params.toName,
      params.unsubscribeUrl
    );

    try {
      await sgMail.send({
        to: params.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: template.subject,
        html: template.html,
        text: template.text,
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
        customArgs: {
          digest_frequency: params.frequency,
          notification_count: params.notifications.length.toString(),
        },
      });

      console.log(`Digest email sent to ${params.to} with ${params.notifications.length} notifications`);
    } catch (error) {
      console.error('Failed to send digest email:', error);
      throw error;
    }
  }

  /**
   * Handle webhook events from SendGrid
   */
  async handleWebhook(events: EmailTrackingEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await this.processTrackingEvent(event);
      } catch (error) {
        console.error('Failed to process tracking event:', error);
      }
    }
  }

  /**
   * Process individual tracking event
   */
  private async processTrackingEvent(event: EmailTrackingEvent): Promise<void> {
    switch (event.type) {
      case 'delivered':
        if (event.notificationId) {
          await supabase
            .from('notification_deliveries')
            .update({
              status: 'delivered',
              delivered_at: event.timestamp.toISOString(),
            })
            .eq('notification_id', event.notificationId)
            .eq('channel', 'email');
        }
        break;

      case 'opened':
        if (event.notificationId) {
          await supabase
            .from('notification_deliveries')
            .update({
              status: 'read',
              read_at: event.timestamp.toISOString(),
            })
            .eq('notification_id', event.notificationId)
            .eq('channel', 'email');
        }
        break;

      case 'clicked':
        if (event.notificationId) {
          await supabase
            .from('notification_deliveries')
            .update({
              clicked_at: event.timestamp.toISOString(),
            })
            .eq('notification_id', event.notificationId)
            .eq('channel', 'email');
        }
        break;

      case 'bounced':
        // Mark as failed and potentially disable email notifications
        if (event.notificationId) {
          await supabase
            .from('notification_deliveries')
            .update({
              status: 'failed',
              failed_at: event.timestamp.toISOString(),
              last_error: 'Email bounced',
            })
            .eq('notification_id', event.notificationId)
            .eq('channel', 'email');
        }

        // Track bounce
        await this.trackBounce(event.email, event.metadata);
        break;

      case 'spam_report':
        // Disable email notifications for this user
        await this.handleSpamReport(event.email);
        break;

      case 'unsubscribed':
        // Update user preferences to disable email notifications
        await this.handleUnsubscribe(event.email);
        break;
    }
  }

  /**
   * Track email bounce
   */
  private async trackBounce(email: string, metadata?: Record<string, any>): Promise<void> {
    await supabase.from('email_bounces').insert({
      email,
      bounce_type: metadata?.bounce_type || 'hard',
      reason: metadata?.reason,
      bounced_at: new Date().toISOString(),
    });

    // If too many bounces, mark email as invalid
    const { count } = await supabase
      .from('email_bounces')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gte('bounced_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (count && count >= 3) {
      // Disable email notifications
      await supabase
        .from('users')
        .update({ email_valid: false })
        .eq('email', email);
    }
  }

  /**
   * Handle spam report
   */
  private async handleSpamReport(email: string): Promise<void> {
    // Find user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) return;

    // Disable all email notifications
    await supabase
      .from('notification_preferences')
      .update({
        channels: supabase.sql`jsonb_set(channels, '{email,enabled}', 'false')`,
      })
      .eq('user_id', user.id);

    console.log(`Disabled email notifications for ${email} due to spam report`);
  }

  /**
   * Handle unsubscribe
   */
  private async handleUnsubscribe(email: string): Promise<void> {
    // Find user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) return;

    // Disable all email notifications
    await supabase
      .from('notification_preferences')
      .update({
        channels: supabase.sql`jsonb_set(channels, '{email,enabled}', 'false')`,
      })
      .eq('user_id', user.id);

    console.log(`User ${email} unsubscribed from email notifications`);
  }

  // =============================================
  // TEMPLATE BUILDERS
  // =============================================

  /**
   * Build single notification email template
   */
  private buildNotificationTemplate(
    notification: Notification,
    recipientName?: string,
    unsubscribeUrl?: string
  ): EmailTemplate {
    const subject = this.getEmailSubject(notification);
    const priorityColor = this.getPriorityColor(notification.priority);
    const priorityLabel = notification.priority.toUpperCase();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .priority-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 10px;
      background-color: ${priorityColor};
      color: #ffffff;
    }
    .content {
      padding: 40px 30px;
    }
    .notification-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 15px 0;
    }
    .notification-message {
      font-size: 16px;
      color: #555;
      margin: 0 0 25px 0;
      line-height: 1.8;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-1px);
    }
    .metadata {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 13px;
      color: #888;
    }
    .footer {
      background-color: #f8f8f8;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #888;
      border-top: 1px solid #e5e5e5;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 AI Revenue Orc</h1>
      <span class="priority-badge">${priorityLabel}</span>
    </div>
    <div class="content">
      ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
      <h2 class="notification-title">${notification.title}</h2>
      <p class="notification-message">${this.formatMessage(notification.message)}</p>
      ${notification.actionUrl ? `
        <a href="${notification.actionUrl}" class="cta-button">
          ${notification.actionLabel || 'View Details'}
        </a>
      ` : ''}
      <div class="metadata">
        <p>Event Type: ${this.formatEventType(notification.eventType)}</p>
        <p>Time: ${notification.createdAt.toLocaleString()}</p>
      </div>
    </div>
    <div class="footer">
      <p>
        You received this notification because you're subscribed to ${this.formatEventType(notification.eventType)} alerts.
      </p>
      ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}">Manage notification preferences</a></p>` : ''}
      <p style="margin-top: 15px; color: #aaa;">
        © ${new Date().getFullYear()} AI Revenue Orc. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
${subject}

${recipientName ? `Hi ${recipientName},\n\n` : ''}${notification.title}

${notification.message}

${notification.actionUrl ? `\n${notification.actionLabel || 'View Details'}: ${notification.actionUrl}\n` : ''}
Event Type: ${this.formatEventType(notification.eventType)}
Time: ${notification.createdAt.toLocaleString()}

${unsubscribeUrl ? `\nManage notification preferences: ${unsubscribeUrl}` : ''}
    `.trim();

    return { subject, html, text };
  }

  /**
   * Build digest email template
   */
  private buildDigestTemplate(
    notifications: Notification[],
    frequency: 'hourly' | 'daily' | 'weekly',
    recipientName?: string,
    unsubscribeUrl?: string
  ): EmailTemplate {
    const subject = this.getDigestSubject(notifications.length, frequency);

    // Group notifications by priority
    const grouped = this.groupByPriority(notifications);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px 20px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px 20px;
    }
    .summary {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    .summary-count {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
      margin: 0;
    }
    .summary-text {
      font-size: 14px;
      color: #666;
      margin: 5px 0 0 0;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 15px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e5e5;
    }
    .notification-item {
      padding: 15px;
      border-left: 3px solid #ddd;
      margin-bottom: 15px;
      background-color: #fafafa;
      border-radius: 4px;
    }
    .notification-item.urgent {
      border-left-color: #ef4444;
      background-color: #fef2f2;
    }
    .notification-item.high {
      border-left-color: #f97316;
      background-color: #fff7ed;
    }
    .notification-item.medium {
      border-left-color: #3b82f6;
      background-color: #eff6ff;
    }
    .notification-title {
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 5px 0;
      font-size: 14px;
    }
    .notification-message {
      font-size: 13px;
      color: #666;
      margin: 0;
    }
    .notification-time {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    .view-all-button {
      display: block;
      text-align: center;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 30px auto 0;
      max-width: 200px;
    }
    .footer {
      background-color: #f8f8f8;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #888;
      border-top: 1px solid #e5e5e5;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 AI Revenue Orc</h1>
      <p>${this.getFrequencyLabel(frequency)} Digest</p>
    </div>
    <div class="content">
      ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
      <div class="summary">
        <p class="summary-count">${notifications.length}</p>
        <p class="summary-text">New notifications</p>
      </div>
      ${this.renderNotificationGroups(grouped)}
      <a href="${this.baseUrl}/notifications" class="view-all-button">
        View All Notifications
      </a>
    </div>
    <div class="footer">
      <p>
        This is your ${frequency} notification digest.
      </p>
      ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}">Manage notification preferences</a></p>` : ''}
      <p style="margin-top: 15px; color: #aaa;">
        © ${new Date().getFullYear()} AI Revenue Orc. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
${subject}

${recipientName ? `Hi ${recipientName},\n\n` : ''}You have ${notifications.length} new notifications:

${notifications.map(n => `
- ${n.title}
  ${n.message}
  ${n.createdAt.toLocaleString()}
`).join('\n')}

View all: ${this.baseUrl}/notifications

${unsubscribeUrl ? `\nManage preferences: ${unsubscribeUrl}` : ''}
    `.trim();

    return { subject, html, text };
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private getEmailSubject(notification: Notification): string {
    const prefix = notification.priority === 'urgent' ? '🚨 URGENT: ' : '';
    return `${prefix}${notification.title}`;
  }

  private getDigestSubject(count: number, frequency: string): string {
    return `Your ${frequency} digest: ${count} new notification${count === 1 ? '' : 's'}`;
  }

  private formatEventType(eventType: NotificationEventType): string {
    return eventType
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatMessage(message: string): string {
    // Convert markdown-style links to HTML
    return message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#3b82f6';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
  }

  private getFrequencyLabel(frequency: string): string {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  }

  private groupByPriority(
    notifications: Notification[]
  ): Record<string, Notification[]> {
    const grouped: Record<string, Notification[]> = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    };

    notifications.forEach(n => {
      grouped[n.priority].push(n);
    });

    return grouped;
  }

  private renderNotificationGroups(grouped: Record<string, Notification[]>): string {
    const priorities: Array<keyof typeof grouped> = ['urgent', 'high', 'medium', 'low'];
    let html = '';

    for (const priority of priorities) {
      const items = grouped[priority];
      if (items.length === 0) continue;

      html += `
        <div class="section">
          <h3 class="section-title">${priority.toUpperCase()} (${items.length})</h3>
          ${items.map(n => `
            <div class="notification-item ${priority}">
              <p class="notification-title">${n.title}</p>
              <p class="notification-message">${n.message}</p>
              <p class="notification-time">${this.getRelativeTime(n.createdAt)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    return html;
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'Just now';
  }

  private injectTracking(html: string, trackingId: string): string {
    // Inject tracking pixel
    const trackingPixel = `<img src="${this.baseUrl}/api/track/open/${trackingId}" width="1" height="1" alt="" />`;
    return html.replace('</body>', `${trackingPixel}</body>`);
  }
}

// =============================================
// FACTORY
// =============================================

let emailServiceInstance: EmailNotificationService | null = null;

export function createEmailNotificationService(): EmailNotificationService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailNotificationService();
  }
  return emailServiceInstance;
}
