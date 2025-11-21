# Real-time Notification System - Deployment Guide

**Priority 1 Launch Blocker Feature**

This document provides complete deployment instructions for the real-time notification system, including infrastructure requirements, environment variables, and operational procedures.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Environment Variables](#environment-variables)
4. [Installation Steps](#installation-steps)
5. [WebSocket Server Setup](#websocket-server-setup)
6. [Email Delivery Setup](#email-delivery-setup)
7. [Push Notifications Setup](#push-notifications-setup)
8. [Cron Jobs](#cron-jobs)
9. [Monitoring & Observability](#monitoring--observability)
10. [Troubleshooting](#troubleshooting)
11. [Performance Optimization](#performance-optimization)

---

## 🎯 System Overview

The notification system consists of 4 main components:

1. **Core Notification Engine** - Routes notifications to appropriate channels
2. **WebSocket Server** - Real-time in-app notifications via persistent connections
3. **Email Delivery Service** - Transactional and digest emails via SendGrid
4. **Push Notification Service** - Browser push notifications via Web Push API

### Architecture

```
┌─────────────────┐
│  Event Occurs   │
│ (Lead created,  │
│  Deal won, etc) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Notification Engine    │
│  - Check preferences    │
│  - Apply priority rules │
│  - Route to channels    │
└────┬───────┬────────┬───┘
     │       │        │
     ▼       ▼        ▼
┌────────┐ ┌────┐ ┌──────┐
│WebSocket Email  Push  │
│ Server │ │    │ │Notify│
└────────┘ └────┘ └──────┘
```

---

## 🏗️ Infrastructure Requirements

### Server Requirements

**Backend Server:**
- Node.js 18+
- 2 CPU cores minimum (4 recommended)
- 4GB RAM minimum (8GB recommended)
- 20GB disk space
- Supports WebSocket connections

**Database:**
- PostgreSQL 14+ (via Supabase)
- 100GB storage minimum
- Connection pooling enabled

### External Services

**Required:**
- ✅ **SendGrid** - Email delivery (or Amazon SES)
- ✅ **Supabase** - Database and auth
- ✅ **Redis** (optional but recommended) - WebSocket scaling

**Optional:**
- ⚡ **Twilio** - SMS notifications (for urgent alerts)
- 📊 **Sentry** - Error tracking
- 📈 **DataDog/New Relic** - Performance monitoring

### Network Requirements

- WebSocket support (port 80/443)
- Outbound HTTPS (443) for SendGrid API
- Inbound HTTPS for webhook callbacks

---

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```bash
# =============================================
# CORE CONFIGURATION
# =============================================

# Application
NODE_ENV=production
APP_URL=https://app.airevenueorc.com
JWT_SECRET=your-jwt-secret-here

# =============================================
# DATABASE (Supabase)
# =============================================

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# =============================================
# EMAIL (SendGrid)
# =============================================

SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=notifications@airevenueorc.com
EMAIL_FROM_NAME=AI Revenue Orc

# Alternative: Amazon SES
# AWS_ACCESS_KEY_ID=your-aws-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret
# AWS_REGION=us-east-1

# =============================================
# WEB PUSH (VAPID)
# =============================================

# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_EMAIL=admin@airevenueorc.com

# =============================================
# WEBSOCKET SERVER
# =============================================

WS_PORT=8080
WS_MAX_CONNECTIONS=10000
WS_HEARTBEAT_INTERVAL=30000  # 30 seconds

# =============================================
# REDIS (for WebSocket scaling)
# =============================================

REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# =============================================
# SMS (Optional - Twilio)
# =============================================

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# =============================================
# MONITORING
# =============================================

SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
DATADOG_API_KEY=your-datadog-key
```

---

## 📦 Installation Steps

### 1. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js ws jsonwebtoken

# Email
npm install @sendgrid/mail

# Push notifications
npm install web-push

# TypeScript types
npm install -D @types/ws @types/jsonwebtoken
```

### 2. Run Database Migration

```bash
# Apply notification system schema
supabase db push

# Or using psql directly:
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/migrations/20251121000018_notification_system.sql
```

### 3. Generate VAPID Keys

```bash
# Generate Web Push VAPID keys
npx web-push generate-vapid-keys

# Output:
# Public Key: BNxxxxxxxxxxxxxx...
# Private Key: xxxxxxxxxxxxxxx...

# Add to .env file
```

### 4. Configure SendGrid

1. Create account at https://sendgrid.com
2. Generate API key with "Mail Send" permissions
3. Verify sender email address
4. Set up webhook for tracking:
   - Event: `delivered`, `opened`, `clicked`, `bounced`, `spam_report`, `unsubscribed`
   - URL: `https://your-app.com/api/notifications/webhook`
   - Method: POST

### 5. Verify Installation

```bash
# Check database tables
npm run db:check

# Test notification creation
npm run test:notification

# Test email delivery
npm run test:email
```

---

## 🔌 WebSocket Server Setup

### Basic Server Setup

Create `src/server/websocket.ts`:

```typescript
import http from 'http';
import express from 'express';
import { createWebSocketServer } from '../lib/notifications/websocket';

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = createWebSocketServer(server);

server.listen(process.env.WS_PORT || 8080, () => {
  console.log(`WebSocket server running on port ${process.env.WS_PORT || 8080}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wsServer.shutdown();
  server.close();
});
```

### Production Deployment

**Option 1: Same Server as API**

```typescript
// Add WebSocket to existing Express app
import { createWebSocketServer } from './lib/notifications/websocket';

const app = express();
const server = http.createServer(app);

// API routes
app.use('/api', apiRoutes);

// WebSocket on same server
createWebSocketServer(server);

server.listen(3000);
```

**Option 2: Separate WebSocket Server**

Deploy WebSocket server separately for better scaling:

```yaml
# docker-compose.yml
services:
  websocket:
    build: .
    command: npm run start:websocket
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - WS_PORT=8080
    deploy:
      replicas: 3
```

### Scaling with Redis

For multiple WebSocket servers, use Redis pub/sub:

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

// Publish notification to all WebSocket servers
await redis.publish('notifications', JSON.stringify({
  userId: 'user-123',
  notification: { ... }
}));

// Subscribe in each WebSocket server
await redis.subscribe('notifications', (message) => {
  const { userId, notification } = JSON.parse(message);
  wsServer.broadcastToUser(userId, notification);
});
```

### Load Balancer Configuration

**Nginx:**

```nginx
upstream websocket {
  server ws1.example.com:8080;
  server ws2.example.com:8080;
  server ws3.example.com:8080;
}

server {
  listen 443 ssl;
  server_name app.airevenueorc.com;

  location /ws/notifications {
    proxy_pass http://websocket;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;
  }
}
```

---

## 📧 Email Delivery Setup

### SendGrid Configuration

1. **Domain Authentication**
   - Add DNS records for SPF, DKIM, DMARC
   - Improves deliverability to 99%+

2. **IP Warmup**
   - Start with low volume (100/day)
   - Gradually increase over 2-4 weeks
   - Monitor bounce rates

3. **Suppression Lists**
   - Automatically managed by SendGrid
   - Respect unsubscribe requests (required by law)

### Email Templates

Templates are generated programmatically in `emailNotifications.ts`, but you can also use SendGrid's template editor for complex designs.

### Testing Emails

```bash
# Test single notification email
curl -X POST http://localhost:3000/api/notifications/test-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "type": "lead.created"
  }'

# Test digest email
curl -X POST http://localhost:3000/api/notifications/test-digest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "frequency": "daily"
  }'
```

### Webhook Endpoint

Implement webhook handler for tracking:

```typescript
// src/api/notifications/webhook.ts
import { createEmailNotificationService } from '@/lib/notifications/emailNotifications';

const emailService = createEmailNotificationService();

export async function handleWebhook(req: Request, res: Response) {
  const events = req.body; // Array of events from SendGrid

  await emailService.handleWebhook(events.map(event => ({
    type: event.event,
    notificationId: event.notification_id,
    email: event.email,
    timestamp: new Date(event.timestamp * 1000),
    metadata: event,
  })));

  res.status(200).send('OK');
}
```

---

## 🔔 Push Notifications Setup

### Service Worker Setup

Create `public/sw.js`:

```javascript
// Copy code from pushNotifications.ts clientSideCode
// This handles push events and notification clicks
```

### Frontend Integration

```typescript
// In your React/Next.js app
import { subscribeToPushNotifications } from '@/lib/notifications/client';

function NotificationSettings() {
  const handleEnablePush = async () => {
    const subscription = await subscribeToPushNotifications();
    if (subscription) {
      console.log('Push notifications enabled!');
    }
  };

  return (
    <button onClick={handleEnablePush}>
      Enable Push Notifications
    </button>
  );
}
```

### API Endpoint for Subscriptions

```typescript
// POST /api/push/subscribe
import { createPushNotificationService } from '@/lib/notifications/pushNotifications';

const pushService = createPushNotificationService();

export async function subscribe(req: Request, res: Response) {
  const { subscription, userAgent, deviceName } = req.body;
  const userId = req.user.id; // From auth middleware

  const result = await pushService.subscribe({
    userId,
    subscription,
    userAgent,
    deviceName,
  });

  res.json(result);
}
```

### Testing Push Notifications

```bash
# Test push notification
curl -X POST http://localhost:3000/api/push/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/..."
  }'
```

---

## ⏰ Cron Jobs

Set up the following cron jobs:

### 1. Process Notification Batches (Digest Emails)

```bash
# Every hour
0 * * * * curl -X POST http://localhost:3000/api/notifications/process-batches
```

Or using node-cron:

```typescript
import cron from 'node-cron';
import { createNotificationService } from '@/lib/notifications/notificationService';

const notificationService = createNotificationService();

// Every hour
cron.schedule('0 * * * *', async () => {
  await notificationService.processBatches();
});
```

### 2. Cleanup Expired Notifications

```bash
# Daily at 2 AM
0 2 * * * psql $DATABASE_URL -c "SELECT cleanup_expired_notifications();"
```

### 3. Auto-archive Old Notifications

```bash
# Daily at 3 AM
0 3 * * * psql $DATABASE_URL -c "SELECT auto_archive_notifications();"
```

### 4. Unsnooze Notifications

```bash
# Every 5 minutes
*/5 * * * * psql $DATABASE_URL -c "SELECT unsnooze_notifications();"
```

### 5. Cleanup Inactive Push Subscriptions

```bash
# Weekly on Sunday at 4 AM
0 4 * * 0 curl -X POST http://localhost:3000/api/push/cleanup
```

### Complete Cron Setup

Create `src/jobs/notifications.ts`:

```typescript
import cron from 'node-cron';
import { createNotificationService } from '@/lib/notifications/notificationService';
import { createPushNotificationService } from '@/lib/notifications/pushNotifications';

const notificationService = createNotificationService();
const pushService = createPushNotificationService();

export function startNotificationJobs() {
  // Process batches every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Processing notification batches...');
    await notificationService.processBatches();
  });

  // Cleanup push subscriptions weekly
  cron.schedule('0 4 * * 0', async () => {
    console.log('Cleaning up push subscriptions...');
    await pushService.cleanupSubscriptions();
  });

  console.log('Notification cron jobs started');
}
```

---

## 📊 Monitoring & Observability

### Metrics to Track

**System Health:**
- WebSocket connections (active, total)
- Notification throughput (notifications/sec)
- Email delivery rate (%)
- Push delivery rate (%)
- Average delivery time per channel

**Business Metrics:**
- Notification open rate
- Notification click-through rate
- User engagement by event type
- Digest vs instant preference ratio

### Logging

```typescript
import { Logger } from '@/lib/logging';

const logger = new Logger('notifications');

// Log notification creation
logger.info('Notification created', {
  notificationId: notification.id,
  userId: notification.userId,
  eventType: notification.eventType,
  priority: notification.priority,
});

// Log delivery failures
logger.error('Notification delivery failed', {
  notificationId: notification.id,
  channel: 'email',
  error: error.message,
});
```

### Sentry Integration

```typescript
import * as Sentry from '@sentry/node';

try {
  await notificationService.createNotification({ ... });
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'notifications',
      action: 'create',
    },
    extra: {
      userId,
      eventType,
    },
  });
}
```

### Health Check Endpoint

```typescript
// GET /api/notifications/health
export async function healthCheck(req: Request, res: Response) {
  const checks = {
    database: await checkDatabase(),
    websocket: await checkWebSocket(),
    sendgrid: await checkSendGrid(),
    redis: await checkRedis(),
  };

  const healthy = Object.values(checks).every(c => c.healthy);

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 🔧 Troubleshooting

### WebSocket Issues

**Problem: Connections dropping frequently**

Solution:
- Increase `WS_HEARTBEAT_INTERVAL`
- Check load balancer timeout settings
- Verify firewall isn't blocking WebSocket

**Problem: High memory usage**

Solution:
- Limit max connections per server
- Implement connection pooling
- Add Redis for distributed state

### Email Issues

**Problem: Emails going to spam**

Solution:
- Set up DKIM, SPF, DMARC
- Warm up IP address properly
- Reduce sending frequency
- Check content for spam triggers

**Problem: High bounce rate**

Solution:
- Validate email addresses before sending
- Remove bounced emails from list
- Check email content and formatting

### Push Notification Issues

**Problem: Notifications not appearing**

Solution:
- Check browser permissions
- Verify VAPID keys are correct
- Test with service worker debugger
- Check subscription is active

---

## ⚡ Performance Optimization

### Database Optimization

```sql
-- Add partial indexes for common queries
CREATE INDEX idx_notifications_urgent_unread
  ON notifications(user_id, created_at DESC)
  WHERE priority = 'urgent' AND status = 'unread';

-- Partition notifications table by month
CREATE TABLE notifications_2025_01 PARTITION OF notifications
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Caching Strategy

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// Cache user preferences (TTL: 1 hour)
async function getUserPreferences(userId: string) {
  const cached = await redis.get(`prefs:${userId}`);
  if (cached) return JSON.parse(cached);

  const prefs = await db.getPreferences(userId);
  await redis.setEx(`prefs:${userId}`, 3600, JSON.stringify(prefs));
  return prefs;
}

// Invalidate cache on update
async function updatePreferences(userId: string, prefs: any) {
  await db.updatePreferences(userId, prefs);
  await redis.del(`prefs:${userId}`);
}
```

### Batch Processing

```typescript
// Batch multiple notifications into single email
const pendingNotifications = await db.getPendingNotifications();

// Group by user
const byUser = groupBy(pendingNotifications, 'userId');

// Send batch email to each user
for (const [userId, notifications] of Object.entries(byUser)) {
  await emailService.sendDigestEmail({
    userId,
    notifications,
    frequency: 'instant',
  });
}
```

---

## 📈 Scaling Recommendations

### Phase 1: 0-10K users
- Single server with WebSocket
- SendGrid free tier (100 emails/day)
- Basic monitoring

### Phase 2: 10K-100K users
- Separate WebSocket server
- SendGrid Essential ($20/month, 50K emails/month)
- Redis for caching
- Load balancer

### Phase 3: 100K-1M users
- Multiple WebSocket servers with Redis pub/sub
- SendGrid Pro ($90/month, 1M emails/month)
- Dedicated email queue workers
- Advanced monitoring (DataDog)
- Database read replicas

### Phase 4: 1M+ users
- Kubernetes deployment with auto-scaling
- SendGrid Premier (custom pricing)
- Multi-region deployment
- CDN for static assets
- Database sharding

---

## ✅ Launch Checklist

Before going live:

- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] SendGrid domain verified
- [ ] VAPID keys generated
- [ ] WebSocket server running
- [ ] Cron jobs scheduled
- [ ] Health check endpoint working
- [ ] Monitoring dashboards configured
- [ ] Load testing completed
- [ ] Error tracking configured (Sentry)
- [ ] Backup/restore procedures tested
- [ ] Documentation updated
- [ ] Team trained on system

---

## 🚀 Next Steps

After successful deployment:

1. **Monitor for 48 hours** - Watch for errors, performance issues
2. **Gather user feedback** - Are notifications helpful? Too frequent?
3. **A/B test email templates** - Optimize open/click rates
4. **Add more event types** - Expand notification coverage
5. **Build analytics dashboard** - Track engagement metrics
6. **Implement machine learning** - Smart notification timing

---

## 📞 Support

For issues or questions:

- **Technical Issues**: Create issue on GitHub
- **SendGrid Issues**: support@sendgrid.com
- **Emergency**: Page on-call engineer

---

**Status**: ✅ Complete - Ready for deployment
**Last Updated**: 2025-11-21
**Version**: 1.0.0
