# AIRevenueOrc - Complete HubSpot Replacement

**AI-Powered Revenue Orchestration Platform**

A production-ready, open-source alternative to HubSpot with enterprise features, AI automation, and modern architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF)](https://vitejs.dev/)
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
- 🤖 Multi-Model AI (GPT-4, Claude, Gemini)
- 🔍 Universal Search <50ms (Typesense powered)
- 🔔 Real-time Notifications (WebSocket)
- 📧 Production Email Delivery (SendGrid)
- 🎯 Autonomous BDR Agent System
- 📊 Advanced Analytics & Pipeline Forecasting
- 🔐 Enterprise SaaS Features (Team Management, API Keys, Billing)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (or Supabase account)
- **Redis** 6+ (for rate limiting and caching)
- **Typesense** (for search - optional but recommended)
- **SendGrid** account (for email delivery - optional)
- **OpenAI** API key (for AI features - optional)

### Installation

```bash
# Clone repository
git clone https://github.com/DoniaKassem/AIRevenueOrc.git
cd AIRevenueOrc

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section below)

# Run database migrations
npx supabase migration up
# OR manually run migrations from supabase/migrations/

# Start development
npm run dev          # Frontend (http://localhost:5173)
npm run dev:api      # API Server (http://localhost:3000)
```

### Configuration

Edit `.env` file with your credentials:

**Required:**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-secret-min-32-chars
```

**Optional but Recommended:**
```bash
OPENAI_API_KEY=your-openai-key
REDIS_URL=redis://localhost:6379
TYPESENSE_API_KEY=your-typesense-key
SENDGRID_API_KEY=your-sendgrid-key
```

See [`.env.example`](./.env.example) for all configuration options.

### Database Setup

See [**docs/DATABASE_SETUP.md**](./docs/DATABASE_SETUP.md) for complete database setup instructions, including:
- Fresh installation steps
- Migration guide
- Schema reference
- Seeding test data

---

## ✨ Key Features

### 🤖 AI & Automation
- **Multi-Model AI Router** - GPT-4, Claude Sonnet, Google Gemini with automatic routing
- **AI Email Writer** - Context-aware email generation with A/B testing
- **Autonomous BDR Agent** - Automated lead qualification and handoff
- **Lead Scoring** - ML-powered scoring with real-time updates
- **Conversation Intelligence** - Call transcription and sentiment analysis

### 📊 CRM & Sales
- **Complete CRM** - Prospects, accounts, deals pipeline
- **Sales Cadences** - Multi-channel sequences (email, call, LinkedIn, SMS)
- **Pipeline Forecasting** - AI-powered deal prediction
- **Activity Tracking** - Calls, emails, meetings with full history
- **Deal Intelligence** - Risk scoring and next-best-action suggestions

### 🔍 Search & Knowledge
- **Universal Search** - <50ms search across all entities
- **Company Knowledge Base** - AI-powered company research
- **Vector Search** - Semantic search using embeddings
- **Search Analytics** - Track queries and optimize results

### 🔔 Communication
- **Real-time Notifications** - WebSocket-powered with multi-channel delivery
- **Email Infrastructure** - Production-grade delivery with SendGrid
- **Email Tracking** - Opens, clicks, bounces with webhooks
- **Template Management** - Dynamic templates with variable substitution

### 🔐 Enterprise SaaS Features
- **Team Management** - Invite members, role-based permissions
- **API Key Management** - Scoped keys with usage tracking
- **Subscription & Billing** - Multi-tier plans with Stripe integration
- **SSO** - SAML/OAuth authentication
- **Audit Logging** - Complete activity tracking

### 🔗 Integrations
- **Integration Marketplace** - Pre-built connectors
- **Webhook Management** - Event-driven automation
- **Custom Flows** - Visual workflow builder
- **OAuth Framework** - Secure third-party auth

---

## 🛠️ Development

```bash
# Frontend Development
npm run dev              # Start frontend (Vite dev server)
npm run build            # Build for production
npm run preview          # Preview production build

# Backend Development
npm run dev:api          # Start API server with hot reload
npm run build:api        # Build API for production
npm run start:api        # Start production API server

# Code Quality
npm run typecheck        # TypeScript type checking
npm run typecheck:all    # Check both frontend and backend
npm run lint             # ESLint checking
npm run test             # Run test suite
npm run test:coverage    # Generate coverage report
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
