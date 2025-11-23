# Production API - Deployment Guide

**Priority 1 Launch Blocker Feature - Final Component**

Complete guide for deploying the production-ready REST API.

---

## 🎯 Overview

Production-grade Express API with:
- ✅ JWT Authentication & RBAC
- ✅ Rate Limiting (Redis-backed)
- ✅ Standardized Error Handling
- ✅ Request/Response Validation
- ✅ API Versioning (/v1)
- ✅ CORS & Security Headers
- ✅ Health Checks
- ✅ Graceful Shutdown
- ✅ Sentry Error Tracking

---

## 📦 Installation

### 1. Install Dependencies

```bash
npm install express cors helmet compression morgan
npm install jsonwebtoken redis
npm install @sentry/node @sentry/profiling-node

# TypeScript types
npm install -D @types/express @types/cors @types/compression @types/morgan @types/jsonwebtoken
```

### 2. Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://app.airevenueorc.com,https://www.airevenueorc.com

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Redis (for rate limiting)
REDIS_URL=redis://localhost:6379

# Sentry (error tracking)
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Rate Limits (optional overrides)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### 3. Generate Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Or use:
openssl rand -base64 64
```

---

## 🚀 Running the Server

### Development

```bash
# Start with hot reload
npm run dev

# Or with ts-node
npx ts-node src/api/server.ts
```

### Production

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or with PM2 (recommended)
pm2 start dist/api/server.js --name "api-server" -i 4
```

---

## 🔐 Authentication

### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

### Using Access Token

```bash
GET /api/v1/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "organizationId": "org-456",
      "role": "user"
    }
  }
}
```

### Refresh Token

```bash
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

# Response:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### API Key Authentication (for integrations)

```bash
GET /api/v1/search
Authorization: ApiKey sk_live_xxxxxxxxxxxxxxxxx

# Or:
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxx
```

---

## 🛡️ Rate Limiting

### Default Limits

- **General API**: 100 requests/minute per user
- **Authentication**: 5 attempts/15 minutes per IP
- **Search**: 60 requests/minute per user
- **Email**: 100 emails/hour per user
- **AI Operations**: 50 requests/hour per user

### Rate Limit Headers

Every response includes:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000000
```

### When Rate Limit Exceeded

```bash
HTTP/1.1 429 Too Many Requests
Retry-After: 45

{
  "success": false,
  "error": "TooManyRequests",
  "message": "Too many requests, please try again later"
}
```

---

## ⚠️ Error Handling

### Standardized Error Response

```json
{
  "success": false,
  "error": "NotFound",
  "message": "Resource not found",
  "statusCode": 404,
  "timestamp": "2025-11-21T10:30:00.000Z",
  "path": "/api/v1/prospects/unknown-id",
  "method": "GET",
  "requestId": "req_1700000000_abc123"
}
```

### Validation Errors

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Validation failed",
  "statusCode": 422,
  "errors": {
    "email": ["Invalid email format"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

### Error Codes

- `400` - Bad Request
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## 🏥 Health Checks

### Basic Health Check

```bash
GET /health

# Response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-21T10:30:00.000Z",
  "uptime": 123456,
  "memory": {
    "rss": 123456789,
    "heapTotal": 987654321,
    "heapUsed": 456789123
  }
}
```

### Readiness Check (with dependencies)

```bash
GET /health/ready

# Response:
{
  "success": true,
  "status": "ready",
  "checks": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

## 🔒 Security

### CORS Configuration

Configured in environment variables:

```bash
ALLOWED_ORIGINS=https://app.airevenueorc.com,https://www.airevenueorc.com
```

### Security Headers (via Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### Input Validation

All inputs are validated before processing:

```typescript
import { validateRequired, validateEmail } from '@/api/middleware/errorHandler';

// Validate required fields
validateRequired(req.body, ['email', 'password']);

// Validate email format
validateEmail(req.body.email);
```

---

## 📊 Monitoring

### Sentry Setup

```bash
# Install
npm install @sentry/node @sentry/profiling-node

# Configure
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# Automatic error tracking in production
```

### Request Logging

Production uses `combined` log format:

```
::1 - - [21/Nov/2025:10:30:00 +0000] "GET /api/v1/prospects HTTP/1.1" 200 1234
```

Development uses `dev` format:

```
GET /api/v1/prospects 200 45.123 ms - 1234
```

### Custom Metrics

```typescript
// Track API usage
await supabase.from('api_usage').insert({
  user_id: req.user.id,
  endpoint: req.path,
  method: req.method,
  status_code: res.statusCode,
  response_time_ms: Date.now() - req.startTime,
});
```

---

## 🚀 Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
```

```bash
# Build
docker build -t airevenueorc-api .

# Run
docker run -p 3000:3000 --env-file .env airevenueorc-api
```

### PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start with cluster mode (4 instances)
pm2 start dist/api/server.js --name "api-server" -i 4

# Monitor
pm2 monit

# Logs
pm2 logs api-server

# Restart
pm2 restart api-server

# Stop
pm2 stop api-server
```

### Systemd Service

```ini
# /etc/systemd/system/airevenueorc-api.service
[Unit]
Description=AI Revenue Orc API
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/var/www/airevenueorc
ExecStart=/usr/bin/node dist/api/server.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/var/www/airevenueorc/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable airevenueorc-api
sudo systemctl start airevenueorc-api

# Check status
sudo systemctl status airevenueorc-api

# View logs
sudo journalctl -u airevenueorc-api -f
```

---

## 🔧 Configuration

### Redis (for rate limiting)

```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis

# Test connection
redis-cli ping
# Response: PONG

# Configure in .env
REDIS_URL=redis://localhost:6379
```

Without Redis, rate limiting falls back to in-memory (not recommended for production with multiple instances).

### Load Balancer (Nginx)

```nginx
upstream api_backend {
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  listen 443 ssl http2;
  server_name api.airevenueorc.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location /api {
    proxy_pass http://api_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## 📈 Scaling

### Horizontal Scaling

1. Use Redis for rate limiting (required for multiple instances)
2. Deploy multiple API instances behind load balancer
3. Use sticky sessions if needed (or stateless design)

### Vertical Scaling

- Start: 1 CPU, 2GB RAM (handles ~100 req/s)
- Medium: 2 CPU, 4GB RAM (handles ~500 req/s)
- Large: 4 CPU, 8GB RAM (handles ~2000 req/s)

### Auto-Scaling (K8s)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## ✅ Pre-Launch Checklist

- [ ] Environment variables configured
- [ ] JWT secrets generated (min 32 chars)
- [ ] Redis configured (for rate limiting)
- [ ] Sentry configured (for error tracking)
- [ ] CORS origins configured
- [ ] Health checks working
- [ ] Rate limiting tested
- [ ] Authentication tested
- [ ] Error handling tested
- [ ] Load testing completed (1000+ req/s)
- [ ] Monitoring dashboards set up
- [ ] SSL certificates configured
- [ ] Firewall rules configured
- [ ] Backup procedures tested
- [ ] Documentation updated

---

## 📞 Support

- **API Issues**: Check health endpoint first
- **Rate Limit Issues**: Review limits for your tier
- **Auth Issues**: Verify JWT secrets match
- **Performance Issues**: Check Redis connection

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-21
**Version**: 1.0.0
