/**
 * Search API Routes
 *
 * RESTful API endpoints for Universal Smart Search
 *
 * Endpoints:
 * - POST   /api/search              - Universal search
 * - GET    /api/search/suggest      - Autocomplete suggestions
 * - POST   /api/search/save         - Save a search
 * - GET    /api/search/saved        - Get saved searches
 * - POST   /api/search/saved/:id    - Execute saved search
 * - DELETE /api/search/saved/:id    - Delete saved search
 * - GET    /api/search/analytics    - Search analytics
 * - POST   /api/search/index/full   - Trigger full reindex (admin)
 * - POST   /api/search/index/:id    - Reindex specific record
 * - GET    /api/search/health       - Search system health
 *
 * Priority 1 Launch Blocker Feature
 */

import { Router, Request, Response } from 'express';
import { createSearchService, SearchQuery } from '@/lib/search/searchService';
import { createSearchIndexer } from '@/lib/search/searchIndexer';

const router = Router();
const searchService = createSearchService();
const searchIndexer = createSearchIndexer();

// =============================================
// MIDDLEWARE
// =============================================

/**
 * Auth middleware - extracts user from JWT
 * (Implementation depends on your auth setup)
 */
function requireAuth(req: Request, res: Response, next: Function) {
  // Example: Extract user from JWT token
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify token and attach user to request
  // req.user = verifyToken(token);

  // For now, assume user is attached by upstream middleware
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

/**
 * Admin middleware - checks if user is admin
 */
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}

// =============================================
// SEARCH ENDPOINTS
// =============================================

/**
 * POST /api/search
 * Universal search across all objects
 */
router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      q,
      types,
      statuses,
      owners,
      tags,
      dateFrom,
      dateTo,
      facets,
      page,
      perPage,
      sortBy,
      sortOrder,
    } = req.body;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const query: SearchQuery = {
      q: q.trim(),
      organizationId: req.user.organizationId,
      userId: req.user.id,
      types,
      statuses,
      owners,
      tags,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      facets,
      page: page || 1,
      perPage: perPage || 20,
      sortBy,
      sortOrder,
    };

    const results = await searchService.search(query);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/search/suggest
 * Autocomplete suggestions
 */
router.get('/search/suggest', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, types, limit } = req.query;

    if (!q || (q as string).trim().length === 0) {
      return res.json({
        success: true,
        data: { suggestions: [], results: [] },
      });
    }

    const suggestions = await searchService.suggest({
      q: (q as string).trim(),
      organizationId: req.user.organizationId,
      types: types ? (types as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : 5,
    });

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({
      success: false,
      error: 'Suggestions failed',
    });
  }
});

/**
 * POST /api/search/track-click
 * Track when user clicks a search result (for relevance tuning)
 */
router.post('/search/track-click', requireAuth, async (req: Request, res: Response) => {
  try {
    const { searchId, resultId, resultType, position } = req.body;

    // Update search analytics with click
    // This would update the search_analytics record

    res.json({ success: true });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ success: false });
  }
});

// =============================================
// SAVED SEARCHES
// =============================================

/**
 * POST /api/search/save
 * Save a search for quick access
 */
router.post('/search/save', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, query, isPinned } = req.body;

    if (!name || !query) {
      return res.status(400).json({ error: 'Name and query are required' });
    }

    const savedSearch = await searchService.saveSearch({
      userId: req.user.id,
      name,
      query,
      isPinned: isPinned || false,
    });

    res.json({
      success: true,
      data: savedSearch,
    });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save search',
    });
  }
});

/**
 * GET /api/search/saved
 * Get all saved searches for user
 */
router.get('/search/saved', requireAuth, async (req: Request, res: Response) => {
  try {
    const savedSearches = await searchService.getSavedSearches(req.user.id);

    res.json({
      success: true,
      data: savedSearches,
    });
  } catch (error) {
    console.error('Get saved searches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved searches',
    });
  }
});

/**
 * POST /api/search/saved/:id
 * Execute a saved search
 */
router.post('/search/saved/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page } = req.body;

    const results = await searchService.executeSavedSearch(id, page);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Execute saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute saved search',
    });
  }
});

/**
 * DELETE /api/search/saved/:id
 * Delete a saved search
 */
router.delete('/search/saved/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete from database
    // Would need to add this method to searchService

    res.json({ success: true });
  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete saved search',
    });
  }
});

// =============================================
// ANALYTICS
// =============================================

/**
 * GET /api/search/analytics
 * Get search analytics for organization
 */
router.get('/search/analytics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, userId } = req.query;

    const analytics = await searchService.getSearchAnalytics({
      organizationId: req.user.organizationId,
      userId: userId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
    });
  }
});

/**
 * GET /api/search/popular
 * Get popular search queries
 */
router.get('/search/popular', requireAuth, async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;

    // Query popular queries from database view
    // This would come from the search_popular_queries table

    res.json({
      success: true,
      data: {
        queries: [],
      },
    });
  } catch (error) {
    console.error('Get popular queries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get popular queries',
    });
  }
});

// =============================================
// INDEXING (Admin Only)
// =============================================

/**
 * POST /api/search/index/full
 * Trigger full reindex of all collections (admin only)
 */
router.post('/search/index/full', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Start async indexing job
    const jobs = await searchIndexer.indexAll();

    res.json({
      success: true,
      data: {
        message: 'Full reindex started',
        jobs,
      },
    });
  } catch (error) {
    console.error('Full reindex error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start full reindex',
    });
  }
});

/**
 * POST /api/search/index/:collection
 * Reindex a specific collection (admin only)
 */
router.post('/search/index/:collection', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;

    const job = await searchIndexer.indexCollection(collection);

    res.json({
      success: true,
      data: {
        message: `Reindex started for ${collection}`,
        job,
      },
    });
  } catch (error) {
    console.error('Reindex collection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reindex collection',
    });
  }
});

/**
 * POST /api/search/index/record
 * Reindex specific records (admin only)
 */
router.post('/search/index/record', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { collection, recordIds } = req.body;

    if (!collection || !recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({ error: 'Collection and recordIds array required' });
    }

    const result = await searchIndexer.reindexRecords(collection, recordIds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Reindex records error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reindex records',
    });
  }
});

/**
 * GET /api/search/index/stats
 * Get indexing statistics (admin only)
 */
router.get('/search/index/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await searchIndexer.getIndexStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get index stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get index stats',
    });
  }
});

/**
 * POST /api/search/index/process-queue
 * Process sync queue (retry failed syncs) - admin only
 */
router.post('/search/index/process-queue', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await searchIndexer.processSyncQueue();

    res.json({
      success: true,
      data: { message: 'Sync queue processed' },
    });
  } catch (error) {
    console.error('Process queue error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process sync queue',
    });
  }
});

// =============================================
// HEALTH CHECK
// =============================================

/**
 * GET /api/search/health
 * Health check for search system
 */
router.get('/search/health', async (req: Request, res: Response) => {
  try {
    const stats = await searchIndexer.getIndexStats();

    const allHealthy = stats.every((s) => s.health === 'healthy');
    const anyDegraded = stats.some((s) => s.health === 'degraded');

    const overallHealth = allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy';

    res.status(overallHealth === 'healthy' ? 200 : 503).json({
      success: true,
      status: overallHealth,
      collections: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to check health',
    });
  }
});

// =============================================
// INITIALIZATION
// =============================================

/**
 * POST /api/search/init
 * Initialize search collections (run once during setup)
 */
router.post('/search/init', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await searchService.initializeCollections();

    res.json({
      success: true,
      data: { message: 'Search collections initialized' },
    });
  } catch (error) {
    console.error('Init collections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize collections',
    });
  }
});

export default router;

// =============================================
// USAGE EXAMPLE
// =============================================

/**
 * Integration with Express app:
 *
 * import searchRoutes from './api/search/routes';
 * app.use('/api', searchRoutes);
 *
 * Then endpoints will be available at:
 * - POST /api/search
 * - GET /api/search/suggest
 * - etc.
 */
