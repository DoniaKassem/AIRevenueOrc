# Workflow Automation Guide

Complete guide to building N8N-style workflows with external API integrations, LinkedIn automation, and advanced signal extraction.

---

## Table of Contents

1. [Overview](#overview)
2. [External API Connectors](#external-api-connectors)
3. [LinkedIn Automation](#linkedin-automation)
4. [Signal Extraction](#signal-extraction)
5. [Workflow Builder](#workflow-builder)
6. [Configuration](#configuration)
7. [Use Cases & Examples](#use-cases--examples)
8. [Best Practices](#best-practices)

---

## Overview

AIRevenueOrc provides a comprehensive workflow automation system similar to N8N/Zapier, enabling you to:

- **Enrich prospects** automatically with data from Clearbit, ZoomInfo, Apollo.io
- **Automate LinkedIn** outreach with profile views, connection requests, and messaging
- **Extract intent signals** from websites, job postings, news, and social media
- **Build visual workflows** with drag-and-drop interface
- **Trigger automations** based on events, schedules, or webhooks

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Workflow Engine                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Triggers   │  │   Actions    │  │  Conditions  │ │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤ │
│  │ • Webhook    │  │ • Enrich     │  │ • If/Then    │ │
│  │ • Schedule   │  │ • LinkedIn   │  │ • Switch     │ │
│  │ • Event      │  │ • Signal     │  │ • Filter     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    Data Sources                         │
├─────────────────────────────────────────────────────────┤
│  Clearbit │ ZoomInfo │ Apollo │ BuiltWith │ NewsAPI    │
└─────────────────────────────────────────────────────────┘
```

---

## External API Connectors

### Supported Providers

#### 1. Clearbit
**Purpose**: Person and company enrichment

**Features**:
- Person enrichment by email
- Company enrichment by domain
- Employment history
- Social profiles
- Company firmographics

**Usage**:
```typescript
import { ClearbitConnector } from '@/lib/enrichment/externalApiConnectors';

const clearbit = new ClearbitConnector('your-api-key');

// Enrich person
const person = await clearbit.enrichPerson('john@acme.com');
console.log(person.name, person.title, person.company);

// Enrich company
const company = await clearbit.enrichCompany('acme.com');
console.log(company.employees, company.revenue, company.tech);
```

#### 2. ZoomInfo
**Purpose**: Contact and firmographic data

**Features**:
- Direct phone numbers
- Mobile numbers
- Job titles and seniority
- Company size and revenue
- Intent signals

**Usage**:
```typescript
import { ZoomInfoConnector } from '@/lib/enrichment/externalApiConnectors';

const zoominfo = new ZoomInfoConnector('your-api-key');

// Enrich person
const person = await zoominfo.enrichPerson('john@acme.com', 'John', 'Doe', 'Acme Inc');
console.log(person.directPhone, person.mobilePhone, person.seniority);

// Enrich company
const company = await zoominfo.enrichCompany('acme.com');
console.log(company.revenue, company.employees, company.technologies);
```

#### 3. Apollo.io
**Purpose**: B2B contact database

**Features**:
- Contact matching
- Email verification
- Company search
- Prospect discovery
- Org charts

**Usage**:
```typescript
import { ApolloConnector } from '@/lib/enrichment/externalApiConnectors';

const apollo = new ApolloConnector('your-api-key');

// Enrich person
const person = await apollo.enrichPerson('john@acme.com', 'John', 'Doe');
console.log(person.phoneNumbers, person.seniority, person.departments);

// Search for people at company
const prospects = await apollo.searchPeople({
  companyDomain: 'acme.com',
  title: 'VP Sales',
  seniority: 'director',
  limit: 25
});
```

#### 4. BuiltWith
**Purpose**: Technology stack detection

**Features**:
- Technology tracking
- Competitor analysis
- Market share data
- Technology adoption timeline

**Usage**:
```typescript
import { BuiltWithConnector } from '@/lib/enrichment/externalApiConnectors';

const builtwith = new BuiltWithConnector('your-api-key');

// Get tech stack
const techStack = await builtwith.getTechStack('acme.com');
console.log(techStack.technologies); // ['React', 'Salesforce', 'AWS']
console.log(techStack.categories); // ['Frontend', 'CRM', 'Cloud']
```

#### 5. NewsAPI
**Purpose**: Company news and intent signals

**Features**:
- Real-time news monitoring
- Funding announcements
- Product launches
- Acquisitions/mergers
- Sentiment analysis

**Usage**:
```typescript
import { NewsApiConnector } from '@/lib/enrichment/externalApiConnectors';

const newsapi = new NewsApiConnector('your-api-key');

// Get company news (last 30 days)
const signals = await newsapi.getCompanyNews('Acme Inc', 30);

for (const signal of signals) {
  console.log(signal.type); // 'funding', 'news_mention', etc.
  console.log(signal.description);
  console.log(signal.confidence);
}
```

### Enrichment Orchestrator

**Auto-enriches prospects/companies across all providers:**

```typescript
import { createEnrichmentOrchestrator } from '@/lib/enrichment/externalApiConnectors';

// Create orchestrator (auto-loads API keys from team integrations)
const orchestrator = await createEnrichmentOrchestrator(teamId);

// Enrich prospect with all providers
const results = await orchestrator.enrichProspect(prospectId);

// Results include data from all enabled providers
for (const result of results) {
  console.log(`${result.provider}: ${result.success ? 'Success' : 'Failed'}`);
  if (result.success) {
    console.log(result.data);
  }
}

// Enrich company with all providers
const companyResults = await orchestrator.enrichCompany(companyProfileId, 'acme.com');
```

---

## LinkedIn Automation

### Features

- **Profile Views**: Automated profile visits with tracking
- **Connection Requests**: AI-generated personalized notes
- **Messaging**: Multi-step messaging sequences
- **Rate Limiting**: Respects LinkedIn limits
- **Activity Logging**: Complete audit trail

### LinkedIn Agent Configuration

```typescript
import { startLinkedInAgent } from '@/lib/automation/linkedInAgent';

const config = {
  teamId: 'your-team-id',
  agentName: 'Sales Prospecting Agent',
  enabled: true,
  dailyActionLimits: {
    profileViews: 50,      // Max profile views per day
    connectionRequests: 20, // Max connection requests per day
    messages: 30,          // Max messages per day
    likes: 50,             // Max post likes per day
    comments: 10,          // Max post comments per day
  },
  autoMessageTemplates: {
    connectionRequest: 'Hi {firstName}, I noticed we both work in {industry}. Would love to connect!',
    firstMessage: 'Thanks for connecting, {firstName}! I saw that you work at {company}...',
    followUp: 'Following up on my previous message...',
  },
  targetCriteria: {
    industries: ['Software', 'Technology'],
    titles: ['VP', 'Director', 'Manager'],
    seniorities: ['director', 'vp', 'c-level'],
    locations: ['United States', 'Canada'],
    companySize: ['51-200', '201-500', '500+'],
  },
};

// Start the agent
const agent = await startLinkedInAgent(config);

// Agent will automatically:
// 1. Find prospects with LinkedIn URLs
// 2. View profiles
// 3. Send connection requests (2-3 days after view)
// 4. Send first message (after connection accepted)
// 5. Respect daily limits
```

### LinkedIn Workflows

**Example: 3-Step LinkedIn Sequence**

```typescript
// 1. Profile View
{
  type: 'linkedin_profile_view',
  targetProfile: {
    linkedInUrl: 'https://linkedin.com/in/john-doe',
    firstName: 'John',
    lastName: 'Doe',
  }
}

// Wait 2-3 days

// 2. Connection Request with AI-generated note
{
  type: 'linkedin_connect',
  targetProfile: { ... },
  note: 'Hi John, I noticed your work in AI/ML at Acme. Would love to connect!'
}

// Wait for connection acceptance

// 3. First Message
{
  type: 'linkedin_message',
  targetProfile: { ... },
  message: 'Thanks for connecting! I saw that Acme recently raised funding...'
}
```

### Rate Limiting

The LinkedIn agent automatically enforces:
- **Profile views**: 50/day
- **Connection requests**: 20/day (LinkedIn limit: ~25/day)
- **Messages**: 30/day
- **Human-like delays**: 2-5 minutes between actions
- **Daily reset**: Stats reset at midnight

---

## Signal Extraction

### Signal Types

#### 1. Behavioral Signals
**User actions showing interest**
- Website visits
- Content downloads
- Search queries
- Email opens/clicks

#### 2. Technographic Signals
**Technology stack indicators**
- Current technologies used
- Recent tech adoptions
- Competitor tool usage
- Integration requirements

#### 3. Firmographic Signals
**Company data points**
- Funding rounds
- Hiring patterns
- Company growth
- Market expansion

#### 4. Contextual Signals
**Indirect indicators**
- News mentions
- Social media activity
- Industry trends
- Event participation

### Signal Extraction Engine

```typescript
import { SignalExtractionOrchestrator } from '@/lib/research/advancedSignalExtraction';

const orchestrator = new SignalExtractionOrchestrator(teamId);

// Extract all signals for a company
const analysis = await orchestrator.extractSignals(companyProfileId);

console.log('Total signals:', analysis.totalSignals);
console.log('Intent score:', analysis.overallIntentScore); // 0-100
console.log('Recommended action:', analysis.recommendedAction); // engage_immediately, engage_soon, nurture, monitor

// Signals by category
console.log(analysis.signalsByCategory);
// { behavioral: 5, technographic: 3, firmographic: 7, contextual: 2 }

// Detailed signals
for (const signal of analysis.signals) {
  console.log(`${signal.type} (${signal.strength}): ${signal.description}`);
  console.log(`Confidence: ${signal.confidence}%`);
  console.log(`Evidence: ${signal.evidence}`);
}
```

### Signal Extractors

#### Website Signal Extractor
Analyzes company websites for buying intent:
- Careers page (hiring = growth)
- Pricing page (solution-aware)
- Blog (content marketing = budget)
- Technology stack
- Keywords and pain points

#### Job Posting Analyzer
Extracts signals from job postings:
- Hiring volume (growth indicator)
- Technology stack from job descriptions
- Department expansion
- Seniority of roles

#### News & Social Analyzer
Monitors news for trigger events:
- Funding announcements
- Product launches
- Acquisitions/mergers
- Market expansion
- Executive changes

#### AI-Powered Analyzer
Uses LLMs to extract nuanced signals from unstructured data.

### Intent Scoring

**Score Calculation**:
```
Intent Score = Σ (signal_strength × category_weight × confidence)

Signal Strength Weights:
- weak: 0.5
- medium: 1.0
- strong: 1.5
- very_strong: 2.0

Category Multipliers:
- behavioral: 1.2 (highest - actual user actions)
- technographic: 1.0
- firmographic: 0.9
- contextual: 0.8 (lowest - indirect signals)

Final Score: 0-100 (normalized + volume boost)
```

**Recommended Actions**:
- **75-100**: Engage immediately (hot lead)
- **55-74**: Engage soon (warm lead)
- **35-54**: Nurture (lukewarm)
- **0-34**: Monitor (cold)

---

## Workflow Builder

### Creating Workflows

#### Visual Builder (UI)
Navigate to **Integrations > Workflows** and use the drag-and-drop builder.

#### Programmatic Creation
```typescript
import { createFlow } from '@/lib/flowEngine';

const flowId = await createFlow(
  teamId,
  'Enrich and Score New Prospects',
  'Automatically enrich prospects and calculate intent score',
  'prospect_created', // Trigger type
  {}, // Trigger config
  {
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        label: 'Prospect Created',
        config: {},
        position: { x: 100, y: 100 },
      },
      {
        id: 'enrich',
        type: 'action',
        label: 'Enrich Prospect',
        config: {
          actionType: 'enrich_prospect',
        },
        position: { x: 100, y: 250 },
      },
      {
        id: 'extract_signals',
        type: 'action',
        label: 'Extract Signals',
        config: {
          actionType: 'extract_signals',
        },
        position: { x: 100, y: 400 },
      },
      {
        id: 'condition',
        type: 'condition',
        label: 'Intent Score > 70?',
        config: {
          condition: 'intentScore > 70',
        },
        position: { x: 100, y: 550 },
      },
      {
        id: 'linkedin_connect',
        type: 'action',
        label: 'LinkedIn Connect',
        config: {
          actionType: 'linkedin_connect',
        },
        position: { x: 300, y: 700 },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'enrich' },
      { id: 'e2', source: 'enrich', target: 'extract_signals' },
      { id: 'e3', source: 'extract_signals', target: 'condition' },
      { id: 'e4', source: 'condition', target: 'linkedin_connect', condition: 'intentScore > 70' },
    ],
    version: '1.0',
  },
  userId
);
```

### Executing Workflows

```typescript
import { executeFlow } from '@/lib/flowEngine';

// Execute workflow with trigger data
const result = await executeFlow(flowId, {
  prospectId: 'prospect-uuid',
  email: 'john@acme.com',
});

console.log('Status:', result.status); // 'completed' or 'failed'
console.log('Duration:', result.duration); // milliseconds
console.log('Output:', result.output);
```

### Workflow Node Types

#### Available Actions
- `create_prospect` - Create new prospect
- `update_deal` - Update deal status
- `send_email` - Send email to prospect
- `create_activity` - Log activity
- `enrich_prospect` - Enrich prospect with external data
- `enrich_company` - Enrich company with external data
- `extract_signals` - Extract intent signals
- `linkedin_profile_view` - View LinkedIn profile
- `linkedin_connect` - Send LinkedIn connection request
- `linkedin_message` - Send LinkedIn message

---

## Configuration

### Setup Enrichment Providers

1. Navigate to **Settings > Integrations**
2. Enable provider (Clearbit, ZoomInfo, etc.)
3. Enter API key
4. Configure credits (if applicable)

**Database Setup**:
```sql
INSERT INTO enrichment_providers (team_id, provider_key, provider_name, api_key_encrypted, is_enabled)
VALUES (
  'your-team-id',
  'clearbit',
  'Clearbit',
  'your-encrypted-api-key',
  true
);
```

### Setup LinkedIn Integration

1. Create LinkedIn OAuth App
2. Get OAuth access token
3. Add to team integrations:

```sql
INSERT INTO team_integrations (team_id, provider_key, credentials)
VALUES (
  'your-team-id',
  'linkedin',
  '{"access_token": "your-access-token"}'::jsonb
);
```

### Environment Variables

```bash
# Optional: Override default limits
LINKEDIN_DAILY_PROFILE_VIEWS=50
LINKEDIN_DAILY_CONNECTION_REQUESTS=20
LINKEDIN_DAILY_MESSAGES=30

# Enrichment Provider Keys (or store in database)
CLEARBIT_API_KEY=your-key
ZOOMINFO_API_KEY=your-key
APOLLO_API_KEY=your-key
BUILTWITH_API_KEY=your-key
NEWSAPI_KEY=your-key
```

---

## Use Cases & Examples

### Use Case 1: Automated Lead Enrichment Pipeline

**Goal**: Automatically enrich new prospects with external data and calculate intent score.

**Workflow**:
1. **Trigger**: New prospect created
2. **Action**: Enrich with Clearbit + ZoomInfo
3. **Action**: Extract company signals
4. **Condition**: Intent score >= 75?
5. **Action (Yes)**: Add to "Hot Leads" list + notify sales
6. **Action (No)**: Add to nurture cadence

**Code**:
```typescript
const flow = {
  trigger: 'prospect_created',
  steps: [
    { action: 'enrich_prospect' },
    { action: 'enrich_company' },
    { action: 'extract_signals' },
    {
      condition: 'intentScore >= 75',
      then: ['add_to_hot_leads', 'notify_sales'],
      else: ['add_to_nurture'],
    },
  ],
};
```

### Use Case 2: LinkedIn Multi-Touch Campaign

**Goal**: Automated 3-step LinkedIn outreach for high-intent prospects.

**Workflow**:
1. **Trigger**: Prospect intent score > 70
2. **Action**: View LinkedIn profile
3. **Delay**: 2 days
4. **Action**: Send connection request
5. **Wait**: Connection accepted
6. **Action**: Send first message
7. **Delay**: 7 days
8. **Action**: Send follow-up

**Code**:
```typescript
const linkedInSequence = [
  { action: 'linkedin_profile_view' },
  { delay: '2 days' },
  { action: 'linkedin_connect' },
  { waitFor: 'connection_accepted' },
  { action: 'linkedin_message', template: 'first_message' },
  { delay: '7 days' },
  { action: 'linkedin_message', template: 'follow_up' },
];
```

### Use Case 3: Trigger-Based Outreach

**Goal**: Reach out to companies that just raised funding.

**Workflow**:
1. **Monitor**: Company news for funding signals
2. **Condition**: Funding amount > $5M?
3. **Action**: Find decision makers (Apollo search)
4. **Action**: Enrich contacts
5. **Action**: LinkedIn outreach
6. **Action**: Send email sequence

**Code**:
```typescript
// News monitor (runs daily)
const newsSignals = await newsapi.getCompanyNews(companyName);
const fundingSignal = newsSignals.find(s => s.type === 'funding');

if (fundingSignal && fundingSignal.metadata.fundingAmount > 5000000) {
  // Find decision makers
  const prospects = await apollo.searchPeople({
    companyDomain: company.website,
    seniority: 'c-level',
    departments: ['executive'],
  });

  // Start outreach
  for (const prospect of prospects) {
    await executeFlow('funding-trigger-outreach', { prospect });
  }
}
```

### Use Case 4: Technology-Based Targeting

**Goal**: Target companies using competitor tools.

**Workflow**:
1. **Action**: Detect tech stack (BuiltWith)
2. **Condition**: Uses HubSpot?
3. **Action**: Extract pain points
4. **Action**: Generate personalized message
5. **Action**: LinkedIn + Email outreach

---

## Best Practices

### Enrichment

1. **Waterfall strategy**: Try multiple providers in sequence
2. **Cache results**: Store enriched data to avoid duplicate API calls
3. **Monitor credits**: Track API usage and credit consumption
4. **Handle failures gracefully**: Continue workflow even if enrichment fails

### LinkedIn Automation

1. **Stay within limits**: Never exceed daily quotas
2. **Use realistic delays**: 2-5 minutes between actions
3. **Personalize messages**: Use AI-generated notes, not templates
4. **Monitor acceptance rates**: Track connection request acceptance
5. **Respect opt-outs**: Honor unsubscribe requests immediately

### Signal Extraction

1. **Multi-source validation**: Combine signals from multiple sources
2. **Weight by recency**: Recent signals have higher value
3. **Set thresholds**: Only act on high-confidence signals (>70%)
4. **Update regularly**: Re-extract signals every 30 days
5. **Combine with human input**: Use AI as assistance, not replacement

### Workflow Design

1. **Start simple**: Begin with 3-5 nodes
2. **Add error handling**: Include failure paths
3. **Test thoroughly**: Use test mode before going live
4. **Monitor execution**: Check execution logs regularly
5. **Iterate**: Continuously optimize based on results

---

## Troubleshooting

### Enrichment Issues

**Problem**: API returns 404 (not found)
- **Solution**: Provider doesn't have data for this contact/company

**Problem**: Rate limit exceeded
- **Solution**: Wait and retry, or implement exponential backoff

**Problem**: Invalid API key
- **Solution**: Check credentials in enrichment_providers table

### LinkedIn Issues

**Problem**: Connection requests not sending
- **Solution**: Check daily limit not exceeded

**Problem**: Profile views failing
- **Solution**: Verify LinkedIn access token is valid

**Problem**: Messages not delivered
- **Solution**: Ensure prospect is connected on LinkedIn

### Signal Extraction Issues

**Problem**: Low signal count
- **Solution**: Enable more signal sources (news, jobs, social)

**Problem**: Incorrect intent score
- **Solution**: Verify signal weights in aggregator configuration

---

## API Reference

### Enrichment API

```typescript
// Enrich prospect
POST /api/enrichment/prospect
{
  "prospectId": "uuid",
  "providers": ["clearbit", "zoominfo"]
}

// Enrich company
POST /api/enrichment/company
{
  "companyProfileId": "uuid",
  "domain": "acme.com",
  "providers": ["clearbit", "builtwith"]
}

// Get enrichment credits
GET /api/enrichment/credits?provider=clearbit
```

### LinkedIn API

```typescript
// Start LinkedIn agent
POST /api/linkedin/agent/start
{
  "enabled": true,
  "dailyLimits": { ... }
}

// Get LinkedIn activities
GET /api/linkedin/activities?prospectId=uuid

// LinkedIn action stats
GET /api/linkedin/stats?date=2025-11-23
```

### Signals API

```typescript
// Extract signals
POST /api/signals/extract
{
  "companyProfileId": "uuid"
}

// Get signals
GET /api/signals?companyProfileId=uuid&category=behavioral

// Signal summary
GET /api/signals/summary?companyProfileId=uuid
```

---

**Questions or Issues?**

Check the [main README](../README.md) or open an issue on GitHub.
