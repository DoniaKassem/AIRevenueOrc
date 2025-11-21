-- =============================================
-- Universal Smart Search System Schema
-- Priority 1 Launch Blocker Feature
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- SEARCH ANALYTICS
-- =============================================

-- Track all search queries for analytics and improvement
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Query details
  query TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  search_time INTEGER, -- milliseconds

  -- Filters used
  filters JSONB,

  -- User interaction
  clicked_result_id TEXT,
  clicked_result_type TEXT,
  clicked_position INTEGER,

  searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_analytics_org ON search_analytics(organization_id);
CREATE INDEX idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_query ON search_analytics(query);
CREATE INDEX idx_search_analytics_searched_at ON search_analytics(searched_at DESC);
CREATE INDEX idx_search_analytics_result_count ON search_analytics(result_count) WHERE result_count = 0;

-- Composite index for common queries
CREATE INDEX idx_search_analytics_org_query_date
  ON search_analytics(organization_id, query, searched_at DESC);

-- =============================================
-- SAVED SEARCHES
-- =============================================

-- User's saved search queries
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Search details
  name TEXT NOT NULL,
  query JSONB NOT NULL, -- Stores the full SearchQuery object

  -- Display
  is_pinned BOOLEAN DEFAULT FALSE,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_pinned ON saved_searches(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_saved_searches_last_used ON saved_searches(last_used_at DESC);

-- Ensure unique search names per user
CREATE UNIQUE INDEX idx_saved_searches_user_name ON saved_searches(user_id, name);

-- =============================================
-- SEARCH INDEXING JOBS
-- =============================================

-- Track bulk indexing jobs
CREATE TABLE search_indexing_jobs (
  id TEXT PRIMARY KEY,
  collection_name TEXT NOT NULL,
  type TEXT CHECK (type IN ('full', 'incremental')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',

  -- Progress tracking
  total_records INTEGER DEFAULT 0,
  indexed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error tracking
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_indexing_jobs_collection ON search_indexing_jobs(collection_name);
CREATE INDEX idx_indexing_jobs_status ON search_indexing_jobs(status);
CREATE INDEX idx_indexing_jobs_created_at ON search_indexing_jobs(created_at DESC);

-- =============================================
-- SEARCH SYNC QUEUE
-- =============================================

-- Queue for failed real-time sync operations (retry mechanism)
CREATE TABLE search_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Event details
  table_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
  record_id UUID NOT NULL,
  payload JSONB NOT NULL,

  -- Retry tracking
  status TEXT CHECK (status IN ('pending', 'processing', 'processed', 'failed')) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_status ON search_sync_queue(status);
CREATE INDEX idx_sync_queue_table ON search_sync_queue(table_name);
CREATE INDEX idx_sync_queue_created_at ON search_sync_queue(created_at DESC);

-- Composite index for retry processing
CREATE INDEX idx_sync_queue_retry
  ON search_sync_queue(status, retry_count)
  WHERE status = 'pending';

-- =============================================
-- SEARCH POPULAR QUERIES (Materialized View)
-- =============================================

-- Track popular queries for autocomplete suggestions
CREATE TABLE search_popular_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  search_count INTEGER DEFAULT 1,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  avg_result_count FLOAT,

  UNIQUE(organization_id, query)
);

CREATE INDEX idx_popular_queries_org ON search_popular_queries(organization_id);
CREATE INDEX idx_popular_queries_count ON search_popular_queries(search_count DESC);
CREATE INDEX idx_popular_queries_last_searched ON search_popular_queries(last_searched_at DESC);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update saved search timestamp and count
CREATE OR REPLACE FUNCTION update_saved_search_usage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_used_at = NOW();
  NEW.use_count = COALESCE(NEW.use_count, 0) + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update popular queries
CREATE OR REPLACE FUNCTION update_popular_queries()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO search_popular_queries (organization_id, query, search_count, last_searched_at, avg_result_count)
  VALUES (
    NEW.organization_id,
    NEW.query,
    1,
    NEW.searched_at,
    NEW.result_count
  )
  ON CONFLICT (organization_id, query)
  DO UPDATE SET
    search_count = search_popular_queries.search_count + 1,
    last_searched_at = NEW.searched_at,
    avg_result_count = (
      (search_popular_queries.avg_result_count * search_popular_queries.search_count + NEW.result_count) /
      (search_popular_queries.search_count + 1)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old search analytics (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_search_analytics()
RETURNS void AS $$
BEGIN
  DELETE FROM search_analytics
  WHERE searched_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up processed sync queue items
CREATE OR REPLACE FUNCTION cleanup_sync_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM search_sync_queue
  WHERE status = 'processed'
    AND processed_at < NOW() - INTERVAL '7 days';

  -- Also delete failed items that are too old
  DELETE FROM search_sync_queue
  WHERE status = 'failed'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on saved searches
CREATE TRIGGER trigger_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Track popular queries from analytics
CREATE TRIGGER trigger_update_popular_queries
  AFTER INSERT ON search_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_popular_queries();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_popular_queries ENABLE ROW LEVEL SECURITY;

-- Search analytics: Users can view their org's analytics
CREATE POLICY "Users can view org search analytics"
  ON search_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = search_analytics.organization_id
    )
  );

CREATE POLICY "Service can insert search analytics"
  ON search_analytics FOR INSERT
  WITH CHECK (true); -- Service role only

-- Saved searches: Users can manage their own
CREATE POLICY "Users can manage their own saved searches"
  ON saved_searches FOR ALL
  USING (auth.uid() = user_id);

-- Indexing jobs: Service role only
CREATE POLICY "Service can manage indexing jobs"
  ON search_indexing_jobs FOR ALL
  USING (true); -- Service role only

-- Sync queue: Service role only
CREATE POLICY "Service can manage sync queue"
  ON search_sync_queue FOR ALL
  USING (true); -- Service role only

-- Popular queries: Users can view their org's popular queries
CREATE POLICY "Users can view org popular queries"
  ON search_popular_queries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = search_popular_queries.organization_id
    )
  );

-- =============================================
-- VIEWS FOR ANALYTICS
-- =============================================

-- Search performance metrics
CREATE VIEW search_performance_metrics AS
SELECT
  organization_id,
  COUNT(*) as total_searches,
  COUNT(*) FILTER (WHERE result_count = 0) as zero_result_searches,
  COUNT(*) FILTER (WHERE result_count > 0) as successful_searches,
  AVG(result_count) as avg_result_count,
  AVG(search_time) as avg_search_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY search_time) as p95_search_time_ms,
  COUNT(DISTINCT user_id) as unique_searchers,
  COUNT(*) FILTER (WHERE clicked_result_id IS NOT NULL) as searches_with_clicks,
  COUNT(*) FILTER (WHERE clicked_result_id IS NOT NULL)::float / NULLIF(COUNT(*), 0) as click_through_rate
FROM search_analytics
WHERE searched_at >= NOW() - INTERVAL '30 days'
GROUP BY organization_id;

-- Top queries by organization
CREATE VIEW top_search_queries AS
SELECT
  organization_id,
  query,
  COUNT(*) as search_count,
  AVG(result_count) as avg_results,
  MAX(searched_at) as last_searched,
  COUNT(DISTINCT user_id) as unique_users
FROM search_analytics
WHERE searched_at >= NOW() - INTERVAL '30 days'
GROUP BY organization_id, query
ORDER BY search_count DESC;

-- Zero-result queries (for improvement)
CREATE VIEW zero_result_queries AS
SELECT
  organization_id,
  query,
  COUNT(*) as occurrence_count,
  MAX(searched_at) as last_occurred,
  COUNT(DISTINCT user_id) as affected_users
FROM search_analytics
WHERE result_count = 0
  AND searched_at >= NOW() - INTERVAL '30 days'
GROUP BY organization_id, query
HAVING COUNT(*) > 1 -- Only show queries that failed multiple times
ORDER BY occurrence_count DESC;

-- Search engagement by user
CREATE VIEW user_search_engagement AS
SELECT
  user_id,
  organization_id,
  COUNT(*) as total_searches,
  COUNT(DISTINCT query) as unique_queries,
  AVG(result_count) as avg_results,
  COUNT(*) FILTER (WHERE clicked_result_id IS NOT NULL) as clicks,
  COUNT(*) FILTER (WHERE clicked_result_id IS NOT NULL)::float / NULLIF(COUNT(*), 0) as ctr,
  MAX(searched_at) as last_search,
  MIN(searched_at) as first_search
FROM search_analytics
WHERE searched_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, organization_id;

-- =============================================
-- INDEXES FOR VIEWS
-- =============================================

-- GIN index for JSONB filters
CREATE INDEX idx_search_analytics_filters_gin ON search_analytics USING gin(filters);

-- GIN index for query JSONB
CREATE INDEX idx_saved_searches_query_gin ON saved_searches USING gin(query);

-- =============================================
-- INITIAL DATA
-- =============================================

-- No initial data needed

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE search_analytics IS 'Tracks all search queries for analytics and improvement';
COMMENT ON TABLE saved_searches IS 'User-saved search queries for quick access';
COMMENT ON TABLE search_indexing_jobs IS 'Tracks bulk indexing jobs for Typesense';
COMMENT ON TABLE search_sync_queue IS 'Queue for retry of failed real-time sync operations';
COMMENT ON TABLE search_popular_queries IS 'Aggregated popular queries for autocomplete';

COMMENT ON COLUMN search_analytics.query IS 'The search query text entered by user';
COMMENT ON COLUMN search_analytics.result_count IS 'Number of results returned';
COMMENT ON COLUMN search_analytics.search_time IS 'Time taken to execute search in milliseconds';
COMMENT ON COLUMN search_analytics.clicked_result_id IS 'ID of result user clicked (for relevance tuning)';
COMMENT ON COLUMN search_analytics.clicked_position IS 'Position in results list (1-based)';

COMMENT ON COLUMN saved_searches.query IS 'Stores the full SearchQuery object as JSONB';
COMMENT ON COLUMN saved_searches.is_pinned IS 'Pinned searches appear at top of list';
COMMENT ON COLUMN saved_searches.use_count IS 'Number of times this search has been executed';

COMMENT ON COLUMN search_sync_queue.retry_count IS 'Number of retry attempts (max 3)';
COMMENT ON COLUMN search_sync_queue.payload IS 'Full event payload for retry';
