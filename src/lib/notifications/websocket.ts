/**
 * WebSocket Server for Real-time Notifications
 *
 * Features:
 * - Real-time notification streaming to connected clients
 * - JWT-based authentication
 * - Presence tracking (online/offline status)
 * - Automatic reconnection handling
 * - Heartbeat/ping-pong for connection health
 * - Room-based broadcasting (organization-level, user-level)
 * - Message queuing for offline users
 *
 * Priority 1 Launch Blocker Feature
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { verify } from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { createNotificationService, Notification } from './notificationService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const notificationService = createNotificationService();

// =============================================
// TYPES & INTERFACES
// =============================================

export interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  organizationId: string;
  isAlive: boolean;
  lastHeartbeat: Date;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'notification' | 'ping' | 'pong' | 'ack' | 'error';
  payload?: any;
  messageId?: string;
  timestamp: string;
}

export interface UserPresence {
  userId: string;
  organizationId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  connections: number;
}

// =============================================
// WEBSOCKET SERVER
// =============================================

export class NotificationWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map(); // userId -> Set of connections
  private presence: Map<string, UserPresence> = new Map(); // userId -> presence
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private presenceInterval: NodeJS.Timeout | null = null;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws/notifications' });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startPresenceTracking();

    console.log('WebSocket server started on /ws/notifications');
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    try {
      // Extract token from query string or headers
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(4001, 'Missing authentication token');
        return;
      }

      // Verify JWT
      const decoded = verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        organizationId: string;
      };

      // Enhance WebSocket with user info
      const authWs = ws as AuthenticatedWebSocket;
      authWs.userId = decoded.userId;
      authWs.organizationId = decoded.organizationId;
      authWs.isAlive = true;
      authWs.lastHeartbeat = new Date();

      // Add to clients map
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId)!.add(authWs);

      // Update presence
      await this.updatePresence(decoded.userId, decoded.organizationId, 'online');

      // Send welcome message
      this.sendMessage(authWs, {
        type: 'notification',
        payload: {
          message: 'Connected to notification stream',
          unreadCount: await notificationService.getUnreadCount(decoded.userId),
        },
        timestamp: new Date().toISOString(),
      });

      // Send any pending notifications
      await this.sendPendingNotifications(authWs, decoded.userId);

      // Set up message handlers
      authWs.on('message', (data: Buffer) => this.handleMessage(authWs, data));
      authWs.on('pong', () => this.handlePong(authWs));
      authWs.on('close', () => this.handleDisconnect(authWs));
      authWs.on('error', (error) => this.handleError(authWs, error));

      console.log(`User ${decoded.userId} connected via WebSocket`);
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      ws.close(4002, 'Authentication failed');
    }
  }

  /**
   * Handle incoming messages from client
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendMessage(ws, {
            type: 'pong',
            messageId: message.messageId,
            timestamp: new Date().toISOString(),
          });
          break;

        case 'ack':
          // Client acknowledges receiving a notification
          if (message.payload?.notificationId) {
            this.handleNotificationAck(ws.userId, message.payload.notificationId);
          }
          break;

        case 'subscribe':
          // Client subscribes to specific event types or channels
          // Can be extended for custom subscriptions
          break;

        case 'unsubscribe':
          // Client unsubscribes from specific event types
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendMessage(ws, {
        type: 'error',
        payload: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle pong response (heartbeat)
   */
  private handlePong(ws: AuthenticatedWebSocket): void {
    ws.isAlive = true;
    ws.lastHeartbeat = new Date();
  }

  /**
   * Handle client disconnect
   */
  private async handleDisconnect(ws: AuthenticatedWebSocket): Promise<void> {
    // Remove from clients map
    const userConnections = this.clients.get(ws.userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.clients.delete(ws.userId);
        // Update presence to offline after grace period
        setTimeout(() => {
          if (!this.clients.has(ws.userId)) {
            this.updatePresence(ws.userId, ws.organizationId, 'offline');
          }
        }, 30000); // 30 second grace period for reconnection
      }
    }

    console.log(`User ${ws.userId} disconnected from WebSocket`);
  }

  /**
   * Handle WebSocket error
   */
  private handleError(ws: AuthenticatedWebSocket, error: Error): void {
    console.error(`WebSocket error for user ${ws.userId}:`, error);
  }

  /**
   * Send message to client
   */
  private sendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast notification to user (all their connections)
   */
  async broadcastToUser(userId: string, notification: Notification): Promise<void> {
    const userConnections = this.clients.get(userId);

    if (userConnections && userConnections.size > 0) {
      const message: WebSocketMessage = {
        type: 'notification',
        payload: notification,
        messageId: notification.id,
        timestamp: new Date().toISOString(),
      };

      userConnections.forEach((ws) => {
        this.sendMessage(ws, message);
      });

      // Mark as delivered
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('notification_id', notification.id)
        .eq('channel', 'in_app')
        .eq('status', 'sent');
    } else {
      // User is offline, notification will be delivered when they connect
      console.log(`User ${userId} is offline, notification ${notification.id} queued`);
    }
  }

  /**
   * Broadcast notification to all users in organization
   */
  async broadcastToOrganization(
    organizationId: string,
    notification: Notification,
    excludeUserId?: string
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    this.clients.forEach((connections, userId) => {
      if (userId !== excludeUserId) {
        connections.forEach((ws) => {
          if (ws.organizationId === organizationId) {
            promises.push(this.broadcastToUser(userId, notification));
          }
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Send pending notifications when user connects
   */
  private async sendPendingNotifications(
    ws: AuthenticatedWebSocket,
    userId: string
  ): Promise<void> {
    try {
      // Get undelivered in-app notifications
      const { data: pendingDeliveries } = await supabase
        .from('notification_deliveries')
        .select('notification_id, notifications(*)')
        .eq('channel', 'in_app')
        .in('status', ['pending', 'sent'])
        .eq('notifications.user_id', userId);

      if (pendingDeliveries && pendingDeliveries.length > 0) {
        for (const delivery of pendingDeliveries) {
          if (delivery.notifications) {
            const notification = delivery.notifications as any;
            this.sendMessage(ws, {
              type: 'notification',
              payload: {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                priority: notification.priority,
                actionUrl: notification.action_url,
                createdAt: notification.created_at,
              },
              messageId: notification.id,
              timestamp: new Date().toISOString(),
            });

            // Mark as delivered
            await supabase
              .from('notification_deliveries')
              .update({
                status: 'delivered',
                delivered_at: new Date().toISOString(),
              })
              .eq('notification_id', notification.id)
              .eq('channel', 'in_app');
          }
        }
      }
    } catch (error) {
      console.error('Failed to send pending notifications:', error);
    }
  }

  /**
   * Handle notification acknowledgment from client
   */
  private async handleNotificationAck(userId: string, notificationId: string): Promise<void> {
    // Mark notification as delivered (if not already)
    await supabase
      .from('notification_deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('notification_id', notificationId)
      .eq('channel', 'in_app')
      .eq('status', 'sent');
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((connections) => {
        connections.forEach((ws) => {
          if (!ws.isAlive) {
            // Connection is dead, terminate it
            ws.terminate();
            return;
          }

          // Mark as not alive, will be set back by pong
          ws.isAlive = false;
          ws.ping();
        });
      });
    }, 30000); // 30 seconds
  }

  /**
   * Start presence tracking
   */
  private startPresenceTracking(): void {
    this.presenceInterval = setInterval(() => {
      this.clients.forEach((connections, userId) => {
        const presence = this.presence.get(userId);
        if (presence) {
          // Update presence based on activity
          const now = new Date();
          const lastActivity = Math.max(
            ...Array.from(connections).map((ws) => ws.lastHeartbeat.getTime())
          );

          const minutesSinceActivity = (now.getTime() - lastActivity) / 1000 / 60;

          if (minutesSinceActivity > 5) {
            presence.status = 'away';
          } else {
            presence.status = 'online';
          }

          presence.lastSeen = new Date(lastActivity);
          presence.connections = connections.size;
        }
      });
    }, 60000); // 1 minute
  }

  /**
   * Update user presence
   */
  private async updatePresence(
    userId: string,
    organizationId: string,
    status: UserPresence['status']
  ): Promise<void> {
    const connections = this.clients.get(userId)?.size || 0;

    const presence: UserPresence = {
      userId,
      organizationId,
      status,
      lastSeen: new Date(),
      connections,
    };

    this.presence.set(userId, presence);

    // Store in database for persistence
    await supabase
      .from('user_presence')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        status,
        last_seen: new Date().toISOString(),
        connections,
      });

    // Broadcast presence update to organization
    const message: WebSocketMessage = {
      type: 'notification',
      payload: {
        type: 'presence_update',
        userId,
        status,
        lastSeen: presence.lastSeen,
      },
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach((connections) => {
      connections.forEach((ws) => {
        if (ws.organizationId === organizationId) {
          this.sendMessage(ws, message);
        }
      });
    });
  }

  /**
   * Get online users in organization
   */
  getOnlineUsers(organizationId: string): UserPresence[] {
    const onlineUsers: UserPresence[] = [];

    this.presence.forEach((presence) => {
      if (presence.organizationId === organizationId && presence.status === 'online') {
        onlineUsers.push(presence);
      }
    });

    return onlineUsers;
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.presence.get(userId) || null;
  }

  /**
   * Shutdown server gracefully
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
    }

    this.clients.forEach((connections) => {
      connections.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });
    });

    this.wss.close();
    console.log('WebSocket server shut down');
  }
}

// =============================================
// FACTORY
// =============================================

let wsServerInstance: NotificationWebSocketServer | null = null;

export function createWebSocketServer(httpServer: HTTPServer): NotificationWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new NotificationWebSocketServer(httpServer);
  }
  return wsServerInstance;
}

export function getWebSocketServer(): NotificationWebSocketServer | null {
  return wsServerInstance;
}
