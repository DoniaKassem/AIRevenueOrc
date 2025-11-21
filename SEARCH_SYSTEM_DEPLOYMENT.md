# Universal Smart Search System - Deployment Guide

**Priority 1 Launch Blocker Feature**

This document provides complete deployment instructions for the Universal Smart Search system, including Typesense setup, indexing procedures, and operational best practices.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Typesense Installation](#typesense-installation)
4. [Environment Variables](#environment-variables)
5. [Initial Setup](#initial-setup)
6. [Indexing Strategy](#indexing-strategy)
7. [Real-time Sync](#real-time-sync)
8. [API Integration](#api-integration)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Performance Optimization](#performance-optimization)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

The Universal Smart Search system provides instant, typo-tolerant search across all data types in AIRevenueOrc.

### Architecture

```
┌──────────────┐
│    User      │
│ Types Query  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│   API Endpoint   │
│ /api/search      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Search Service   │
│ - Query parsing  │
│ - Faceting       │
│ - Ranking        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Typesense      │
│ - Full-text      │
│ - Typo tolerance │
│ - < 50ms latency │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Search Indexer   │
│ - Real-time sync │
│ - Batch updates  │
└──────────────────┘
       ▲
       │
┌──────┴───────────┐
│   PostgreSQL     │
│ (Source of truth)│
└──────────────────┘
```

### Key Components

1. **Typesense** - Search engine (< 50ms)
2. **Search Service** - Query interface
3. **Search Indexer** - Data synchronization
4. **API Routes** - REST endpoints
5. **PostgreSQL** - Analytics & queue

---

## 🏗️ Infrastructure Requirements

### Server Requirements

**Typesense Server:**
- CPU: 2+ cores (4 recommended)
- RAM: 2GB minimum (4GB+ recommended)
- Disk: SSD with 50GB+ space
- Network: Low latency to app server

**Sizing Guide:**
- **10K docs**: 512MB RAM, 1 CPU
- **100K docs**: 2GB RAM, 2 CPU
- **1M docs**: 8GB RAM, 4 CPU
- **10M+ docs**: 16GB+ RAM, 8+ CPU

### External Services

**Required:**
- ✅ Typesense Cloud (or self-hosted)
- ✅ PostgreSQL 14+ (Supabase)

**Optional:**
- ⚡ Redis - Query caching
- 📊 Grafana - Metrics dashboards
- 🔍 Sentry - Error tracking

---

## 📦 Typesense Installation

### Option 1: Typesense Cloud (Recommended)

1. Sign up at https://cloud.typesense.org
2. Create a cluster:
   - Choose region (closest to your users)
   - Select plan based on document count
   - Get API key and hostname

3. Configure connection:
```bash
TYPESENSE_HOST=xxx-1.a1.typesense.net
TYPESENSE_PORT=443
TYPESENSE_PROTOCOL=https
TYPESENSE_API_KEY=your-api-key-here
```

**Pricing:**
- Free tier: 10K documents
- Growth: $0.03/hour (~$22/month) for 100K docs
- Production: Custom pricing for 1M+ docs

### Option 2: Self-Hosted with Docker

```bash
# Pull Typesense image
docker pull typesense/typesense:26.0

# Run Typesense
docker run -d \
  -p 8108:8108 \
  -v $(pwd)/typesense-data:/data \
  --name typesense \
  typesense/typesense:26.0 \
  --data-dir /data \
  --api-key=your-secret-api-key \
  --enable-cors
```

### Option 3: Self-Hosted Binary

```bash
# Download
curl -O https://dl.typesense.org/releases/26.0/typesense-server-26.0-linux-amd64.tar.gz

# Extract
tar -xzf typesense-server-26.0-linux-amd64.tar.gz

# Run
./typesense-server \
  --data-dir=/var/lib/typesense \
  --api-key=your-secret-api-key \
  --api-port=8108
```

### Verify Installation

```bash
# Health check
curl http://localhost:8108/health

# Expected response:
# {"ok":true}
```

---

## 🔐 Environment Variables

Add to `.env`:

```bash
# =============================================
# SEARCH CONFIGURATION
# =============================================

# Typesense
TYPESENSE_HOST=localhost  # or xxx-1.a1.typesense.net for cloud
TYPESENSE_PORT=8108       # or 443 for cloud
TYPESENSE_PROTOCOL=http   # or https for cloud
TYPESENSE_API_KEY=your-typesense-api-key

# Search Settings
SEARCH_RESULTS_PER_PAGE=20
SEARCH_MAX_TYPOS=2
SEARCH_PREFIX_ENABLED=true

# Indexing
SEARCH_BATCH_SIZE=1000
SEARCH_INDEX_CONCURRENCY=5

# Analytics Retention
SEARCH_ANALYTICS_RETENTION_DAYS=90
```

---

## 🚀 Initial Setup

### 1. Install Dependencies

```bash
npm install typesense
```

### 2. Run Database Migration

```bash
# Apply search system schema
supabase db push

# Or using psql:
psql -h db.your-project.supabase.co -U postgres -d postgres \
  -f supabase/migrations/20251121000019_search_system.sql
```

### 3. Initialize Collections

```bash
# Via API endpoint
curl -X POST http://localhost:3000/api/search/init \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Or via Node.js script
node -e "
const { createSearchService } = require('./src/lib/search/searchService');
const service = createSearchService();
service.initializeCollections().then(() => console.log('Done'));
"
```

### 4. Initial Bulk Index

```bash
# Index all data (run once during setup)
curl -X POST http://localhost:3000/api/search/index/full \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Or via Node.js script
node -e "
const { createSearchIndexer } = require('./src/lib/search/searchIndexer');
const indexer = createSearchIndexer();
indexer.indexAll().then(jobs => {
  console.log('Indexing complete:', jobs);
});
"
```

**Indexing Time Estimates:**
- 10K records: ~1-2 minutes
- 100K records: ~10-15 minutes
- 1M records: ~1-2 hours

---

## 📊 Indexing Strategy

### Full vs Incremental Indexing

**Full Indexing:**
- Run during initial setup
- Run after schema changes
- Run monthly for data quality

**Incremental Indexing:**
- Automatic via real-time sync
- Runs on every INSERT/UPDATE/DELETE
- Falls back to queue on failure

### Batch Size Tuning

```typescript
// Adjust based on your data size
searchIndexer.batchSize = 1000; // Default

// For large documents (emails, articles)
searchIndexer.batchSize = 500;

// For small documents (prospects)
searchIndexer.batchSize = 2000;
```

### Indexing Best Practices

1. **Index during off-peak hours** - Full reindex uses resources
2. **Monitor progress** - Check logs for completion status
3. **Verify counts** - Compare Typesense vs PostgreSQL counts
4. **Handle failures** - Check sync queue for failed records

---

## ⚡ Real-time Sync

### Setup Real-time Listeners

Add to your main server file:

```typescript
import { createSearchIndexer, setupRealtimeSync } from '@/lib/search/searchIndexer';

const indexer = createSearchIndexer();

// Set up real-time sync
setupRealtimeSync(indexer);

console.log('Real-time search sync enabled');
```

### How It Works

1. User creates/updates/deletes a record in PostgreSQL
2. Supabase triggers a real-time event
3. Search indexer receives event
4. Record is synced to Typesense immediately
5. On failure, event is queued for retry

### Monitoring Sync Health

```bash
# Check sync queue status
psql -c "SELECT status, COUNT(*) FROM search_sync_queue GROUP BY status;"

# Process failed syncs
curl -X POST http://localhost:3000/api/search/index/process-queue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Sync Lag Monitoring

```sql
-- Check sync lag (how far behind is Typesense)
SELECT
  table_name,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  MAX(created_at) as oldest_pending
FROM search_sync_queue
WHERE status = 'pending'
GROUP BY table_name;
```

---

## 🔌 API Integration

### Frontend Integration Example

```typescript
// React component example
import { useState, useEffect } from 'react';

function UniversalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: query,
            perPage: 10,
          }),
        });

        const data = await response.json();
        setResults(data.data.results);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search anything..."
      />
      {loading && <div>Searching...</div>}
      <ul>
        {results.map((result) => (
          <li key={result.id}>
            <a href={result.url}>
              <strong>{result.title}</strong>
              <p>{result.description}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Autocomplete Example

```typescript
// Search with autocomplete
async function searchWithAutocomplete(query: string) {
  const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  const data = await response.json();

  return data.data.suggestions; // ['John Smith', 'John Doe', ...]
}
```

### Advanced Search with Filters

```typescript
// Search with filters
async function advancedSearch() {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: 'enterprise customer',
      types: ['prospect', 'account'],
      statuses: ['active', 'qualified'],
      owners: ['user-123'],
      tags: ['enterprise', 'priority'],
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      facets: ['status', 'owner_id', 'tags'],
      page: 1,
      perPage: 20,
      sortBy: 'updated_at',
      sortOrder: 'desc',
    }),
  });

  return response.json();
}
```

---

## 📈 Monitoring & Maintenance

### Health Checks

```bash
# Search system health
curl http://localhost:3000/api/search/health

# Typesense health
curl http://localhost:8108/health

# Typesense metrics
curl http://localhost:8108/metrics.json
```

### Key Metrics to Monitor

1. **Search Latency** - Should be < 100ms (target < 50ms)
2. **Index Size** - Track document count per collection
3. **Sync Lag** - Time between DB write and index update
4. **Error Rate** - Failed searches or indexing errors
5. **Zero-Result Queries** - Queries returning no results

### Analytics Dashboard

```sql
-- Search performance last 7 days
SELECT * FROM search_performance_metrics;

-- Top 10 searches
SELECT * FROM top_search_queries LIMIT 10;

-- Searches with no results
SELECT * FROM zero_result_queries LIMIT 20;

-- User engagement
SELECT * FROM user_search_engagement
ORDER BY total_searches DESC
LIMIT 10;
```

### Cron Jobs

```bash
# Daily: Process failed syncs
0 2 * * * curl -X POST http://localhost:3000/api/search/index/process-queue

# Weekly: Cleanup old analytics (keep 90 days)
0 3 * * 0 psql $DATABASE_URL -c "SELECT cleanup_old_search_analytics();"

# Weekly: Cleanup sync queue
0 4 * * 0 psql $DATABASE_URL -c "SELECT cleanup_sync_queue();"

# Monthly: Full reindex for data quality
0 1 1 * * curl -X POST http://localhost:3000/api/search/index/full
```

---

## ⚡ Performance Optimization

### Query Optimization

**1. Use Specific Types**

```typescript
// Good - searches only prospects
const results = await search({
  q: 'john',
  types: ['prospect'],
});

// Bad - searches all collections
const results = await search({
  q: 'john',
});
```

**2. Limit Results**

```typescript
// Search with reasonable limit
const results = await search({
  q: 'enterprise',
  perPage: 20, // Don't fetch 1000s of results
});
```

**3. Use Facets Wisely**

```typescript
// Only request facets you'll display
const results = await search({
  q: 'customer',
  facets: ['status', 'owner_id'], // Don't request all facets
});
```

### Indexing Optimization

**1. Exclude Unnecessary Fields**

Only index fields that need to be searchable:

```typescript
// Don't index every field
// Good: Index searchable text
fields: ['name', 'email', 'description']

// Bad: Index everything
fields: ['id', 'created_at', 'updated_at', 'internal_id', ...]
```

**2. Use Appropriate Field Types**

```typescript
// Use correct types for performance
{ name: 'email', type: 'string' },      // Not int32
{ name: 'amount', type: 'float' },      // Not string
{ name: 'created_at', type: 'int64' },  // Timestamp, not string
```

**3. Batch Updates**

```typescript
// Good - batch multiple updates
await indexer.indexBatch(collection, [doc1, doc2, doc3]);

// Bad - individual updates in loop
for (const doc of docs) {
  await indexer.indexDocument(collection, doc.id);
}
```

### Caching Strategy

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// Cache common searches (5 min TTL)
async function searchWithCache(query: SearchQuery) {
  const cacheKey = `search:${JSON.stringify(query)}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Execute search
  const results = await searchService.search(query);

  // Cache results
  await redis.setEx(cacheKey, 300, JSON.stringify(results));

  return results;
}
```

---

## 🔧 Troubleshooting

### Issue: Search Returns No Results

**Diagnosis:**
```bash
# Check if collections exist
curl http://localhost:8108/collections

# Check document count
curl http://localhost:8108/collections/prospects
```

**Solution:**
- Run full reindex: `POST /api/search/index/full`
- Check if data exists in PostgreSQL
- Verify organization_id filter is correct

### Issue: Slow Search Performance

**Diagnosis:**
```bash
# Check Typesense metrics
curl http://localhost:8108/metrics.json

# Look for:
# - High memory usage
# - High CPU usage
# - Large number of documents
```

**Solution:**
- Reduce search scope (use specific types)
- Add more RAM to Typesense server
- Enable query caching with Redis
- Reduce `perPage` limit

### Issue: Sync Lag (Index Behind Database)

**Diagnosis:**
```sql
SELECT COUNT(*) FROM search_sync_queue WHERE status = 'pending';
```

**Solution:**
```bash
# Process sync queue
curl -X POST http://localhost:3000/api/search/index/process-queue

# Check for errors
SELECT * FROM search_sync_queue WHERE status = 'failed' LIMIT 10;

# Reindex specific records
curl -X POST http://localhost:3000/api/search/index/record \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"collection": "prospects", "recordIds": ["id1", "id2"]}'
```

### Issue: High Memory Usage

**Diagnosis:**
- Typesense loads all indexed data into RAM
- Check collection sizes

**Solution:**
- Scale up RAM
- Remove unnecessary fields from index
- Archive old data
- Use multiple Typesense nodes (sharding)

### Issue: Typos Not Working

**Diagnosis:**
- Check `num_typos` setting
- Verify search query length

**Solution:**
```typescript
// Increase typo tolerance
const searchParams = {
  num_typos: 2, // Allow up to 2 typos
  typo_tokens_threshold: 1, // Min tokens before typo
};
```

---

## 📊 Scaling Recommendations

### Phase 1: 0-100K documents
- Single Typesense instance
- 2GB RAM, 2 CPU
- No caching needed
- Basic monitoring

### Phase 2: 100K-1M documents
- Single Typesense instance
- 8GB RAM, 4 CPU
- Redis caching for common queries
- Advanced monitoring (Grafana)

### Phase 3: 1M-10M documents
- Multiple Typesense nodes (sharding)
- 16GB+ RAM per node, 8 CPU
- Redis cluster for caching
- Dedicated indexer workers
- Read replicas

### Phase 4: 10M+ documents
- Typesense cluster with load balancer
- 32GB+ RAM per node
- Multi-region deployment
- Separate collections by tenant
- Advanced query optimization

---

## ✅ Pre-Launch Checklist

Before going live:

- [ ] Typesense installed and running
- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] Collections initialized
- [ ] Full initial index completed
- [ ] Real-time sync enabled
- [ ] API endpoints tested
- [ ] Health check passing
- [ ] Analytics tracking configured
- [ ] Monitoring dashboards set up
- [ ] Backup/restore procedure tested
- [ ] Performance testing completed (100+ concurrent users)
- [ ] Load testing completed
- [ ] Documentation reviewed
- [ ] Team trained on search system

---

## 🚀 Post-Deployment

After successful deployment:

1. **Monitor for 48 hours** - Watch for errors, performance issues
2. **Gather user feedback** - Are results relevant? Fast enough?
3. **Optimize relevance** - Use zero-result queries to improve
4. **A/B test ranking** - Experiment with boosting strategies
5. **Add more collections** - Expand to files, comments, etc.
6. **Implement semantic search** - Add vector search for AI-powered results

---

## 📞 Support

For issues or questions:

- **Typesense Docs**: https://typesense.org/docs/
- **Typesense Support**: support@typesense.org
- **Technical Issues**: Create issue on GitHub
- **Emergency**: Page on-call engineer

---

**Status**: ✅ Ready for deployment
**Last Updated**: 2025-11-21
**Version**: 1.0.0
