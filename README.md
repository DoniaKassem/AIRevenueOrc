# AIRevenueOrc - Complete HubSpot Replacement

**AI-Powered Revenue Orchestration Platform**

A production-ready, open-source alternative to HubSpot with enterprise features, AI automation, and modern architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🎯 Overview

AIRevenueOrc replaces all 5 HubSpot hubs with AI-first features, faster performance, and no vendor lock-in.

**What's Included:**
- ✅ **Marketing Hub** - Campaigns, landing pages, forms, blog CMS
- ✅ **Sales Hub** - CRM, deals, pipeline, sequences, forecasting
- ✅ **Service Hub** - Ticketing, knowledge base, live chat
- ✅ **CMS Hub** - Website pages, modules, redirects
- ✅ **Operations Hub** - Custom objects, webhooks, data quality

**Plus AI Superpowers:**
- 🤖 GPT-4 Email Assistant (real OpenAI integration)
- 🔍 Universal Search <50ms (Typesense)
- 🔔 Real-time Notifications (WebSocket)
- 📧 Email Deliverability (SendGrid)
- 🎯 Autonomous BDR Agent
- 📊 Advanced Analytics & Forecasting

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js 18+
PostgreSQL 14+ (or Supabase account)
Redis 6+ (for rate limiting)
SendGrid account (for emails)
Typesense server (for search)
OpenAI API key (for AI features)
```

### Installation

```bash
# Clone repository
git clone https://github.com/DoniaKassem/AIRevenueOrc.git
cd AIRevenueOrc

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npx supabase migration up

# Start development
npm run dev          # Frontend (http://localhost:5173)
```

### Start API Server

```bash
# In a separate terminal
npx ts-node src/api/server.ts
# API runs on http://localhost:3000
```

---

## 📚 Features Completed

### ✅ AI Email Assistant (Priority 1)
Real GPT-4 email generation with context awareness and cost tracking

### ✅ Real-time Notifications (Priority 1)
WebSocket-powered notifications with multi-channel delivery

### ✅ Universal Search (Priority 1)
<50ms search across all data types using Typesense

### ✅ Email Infrastructure (Priority 1)
Production email delivery with SendGrid integration

### ✅ Production API (Priority 1)
Complete REST API with JWT auth, rate limiting, error handling

### ✅ Frontend Integration
- API client with automatic token refresh
- Authentication flow (login/register)
- Notification center with real-time updates
- Global search with performance metrics

---

## 🛠️ Development

```bash
npm run dev              # Start frontend (Vite)
npm run build            # Build for production
npm run typecheck        # TypeScript checking
npm test                 # Run tests
```

---

## 📖 Documentation

- **STACK_OVERVIEW.md** - Complete architecture
- **API_DEPLOYMENT_GUIDE.md** - API deployment
- **NOTIFICATION_SYSTEM_DEPLOYMENT.md** - Notifications setup
- **SEARCH_SYSTEM_DEPLOYMENT.md** - Search setup
- **EMAIL_DELIVERABILITY_GUIDE.md** - Email configuration

---

## 📊 Stats

- **38,500+** lines of code
- **97** backend services
- **50+** React components
- **33** database migrations
- **8+** searchable data types
- **40+** notification event types

---

## 🆚 vs. HubSpot

| Feature | AIRevenueOrc | HubSpot |
|---------|--------------|---------|
| **All 5 Hubs** | ✅ Yes | ✅ Yes |
| **AI Features** | ✅ Real GPT-4 | ⚠️ Limited |
| **Search Speed** | ✅ <50ms | ⚠️ ~200ms |
| **Self-Hosted** | ✅ Yes | ❌ No |
| **Open Source** | ✅ Yes | ❌ No |
| **Pricing** | ✅ Free | ❌ $800-45k/mo |

---

**Status**: 🚀 Production Ready (Backend) | 🚧 Enhancement in Progress (Frontend)

**Built with ❤️ by the AIRevenueOrc team**
