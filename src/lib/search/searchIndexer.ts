/**
 * Search Indexer Service
 *
 * Syncs data from PostgreSQL to Typesense for instant search
 *
 * Features:
 * - Bulk initial indexing of all data
 * - Real-time sync via PostgreSQL triggers
 * - Batch operations for performance
 * - Error handling and retry logic
 * - Index health monitoring
 * - Incremental updates
 *
 * Priority 1 Launch Blocker Feature
 */

import Typesense from 'typesense';
import { createClient } from '@supabase/supabase-js';
import { SearchableObjectType } from './searchService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const typesense = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: parseInt(process.env.TYPESENSE_PORT || '8108'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 2,
});

// =============================================
// TYPES & INTERFACES
// =============================================

export interface IndexingJob {
  id: string;
  collectionName: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRecords: number;
  indexedRecords: number;
  failedRecords: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface IndexStats {
  collectionName: string;
  totalDocuments: number;
  lastIndexedAt: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
  syncLag?: number; // milliseconds behind real-time
}

// =============================================
// SEARCH INDEXER SERVICE
// =============================================

export class SearchIndexer {
  private batchSize = 1000;
  private maxRetries = 3;

  /**
   * Run full index of all collections
   */
  async indexAll(): Promise<IndexingJob[]> {
    const collections = [
      'prospects',
      'accounts',
      'deals',
      'tickets',
      'emails',
      'tasks',
      'campaigns',
      'articles',
    ];

    const jobs: IndexingJob[] = [];

    for (const collection of collections) {
      try {
        const job = await this.indexCollection(collection);
        jobs.push(job);
      } catch (error) {
        console.error(`Failed to index collection ${collection}:`, error);
        jobs.push({
          id: `job-${Date.now()}`,
          collectionName: collection,
          type: 'full',
          status: 'failed',
          totalRecords: 0,
          indexedRecords: 0,
          failedRecords: 0,
          error: String(error),
        });
      }
    }

    return jobs;
  }

  /**
   * Index a specific collection
   */
  async indexCollection(collectionName: string): Promise<IndexingJob> {
    const job: IndexingJob = {
      id: `job-${Date.now()}-${collectionName}`,
      collectionName,
      type: 'full',
      status: 'running',
      totalRecords: 0,
      indexedRecords: 0,
      failedRecords: 0,
      startedAt: new Date(),
    };

    try {
      // Get total count
      const { count } = await supabase
        .from(collectionName)
        .select('*', { count: 'exact', head: true });

      job.totalRecords = count || 0;

      console.log(`Starting indexing of ${collectionName}: ${job.totalRecords} records`);

      // Process in batches
      let offset = 0;

      while (offset < job.totalRecords) {
        const { data, error } = await supabase
          .from(collectionName)
          .select('*')
          .range(offset, offset + this.batchSize - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          // Transform and index batch
          const documents = data.map((record) =>
            this.transformRecord(record, collectionName)
          );

          await this.indexBatch(collectionName, documents);

          job.indexedRecords += data.length;
          console.log(
            `Indexed ${job.indexedRecords}/${job.totalRecords} ${collectionName}`
          );
        }

        offset += this.batchSize;
      }

      job.status = 'completed';
      job.completedAt = new Date();

      console.log(`Completed indexing ${collectionName}: ${job.indexedRecords} records`);
    } catch (error) {
      job.status = 'failed';
      job.error = String(error);
      job.completedAt = new Date();

      console.error(`Failed to index ${collectionName}:`, error);
    }

    // Save job to database
    await this.saveIndexingJob(job);

    return job;
  }

  /**
   * Index a batch of documents
   */
  private async indexBatch(collectionName: string, documents: any[]): Promise<void> {
    if (documents.length === 0) return;

    try {
      // Use upsert to handle both inserts and updates
      await typesense
        .collections(collectionName)
        .documents()
        .import(documents, { action: 'upsert' });
    } catch (error) {
      console.error(`Failed to index batch in ${collectionName}:`, error);

      // Retry with exponential backoff
      await this.retryIndexBatch(collectionName, documents);
    }
  }

  /**
   * Retry failed batch with exponential backoff
   */
  private async retryIndexBatch(
    collectionName: string,
    documents: any[],
    attempt: number = 1
  ): Promise<void> {
    if (attempt > this.maxRetries) {
      console.error(`Max retries reached for ${collectionName}, skipping batch`);
      return;
    }

    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await typesense
        .collections(collectionName)
        .documents()
        .import(documents, { action: 'upsert' });
    } catch (error) {
      console.error(`Retry ${attempt} failed for ${collectionName}:`, error);
      await this.retryIndexBatch(collectionName, documents, attempt + 1);
    }
  }

  /**
   * Index a single document (for real-time updates)
   */
  async indexDocument(
    collectionName: string,
    recordId: string
  ): Promise<void> {
    try {
      // Fetch record from database
      const { data, error } = await supabase
        .from(collectionName)
        .select('*')
        .eq('id', recordId)
        .single();

      if (error || !data) {
        console.error(`Record not found: ${collectionName}/${recordId}`);
        return;
      }

      // Transform and index
      const document = this.transformRecord(data, collectionName);

      await typesense
        .collections(collectionName)
        .documents()
        .upsert(document);

      console.log(`Indexed document: ${collectionName}/${recordId}`);
    } catch (error) {
      console.error(`Failed to index document ${collectionName}/${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(
    collectionName: string,
    recordId: string
  ): Promise<void> {
    try {
      await typesense
        .collections(collectionName)
        .documents(recordId)
        .delete();

      console.log(`Deleted document: ${collectionName}/${recordId}`);
    } catch (error) {
      // Ignore 404 errors (document already deleted)
      if ((error as any).httpStatus !== 404) {
        console.error(`Failed to delete document ${collectionName}/${recordId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Transform database record to Typesense document
   */
  private transformRecord(record: any, collectionName: string): any {
    const baseDoc = {
      id: record.id,
      organization_id: record.organization_id,
      created_at: this.toTimestamp(record.created_at),
      updated_at: this.toTimestamp(record.updated_at || record.created_at),
    };

    switch (collectionName) {
      case 'prospects':
        return {
          ...baseDoc,
          full_name: `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email,
          email: record.email,
          company: record.company,
          title: record.title,
          phone: record.phone,
          status: record.status,
          lead_score: record.lead_score || 0,
          owner_id: record.owner_id,
          owner_name: record.owner_name,
          tags: record.tags || [],
          notes: record.notes,
        };

      case 'accounts':
        return {
          ...baseDoc,
          name: record.name,
          domain: record.domain,
          industry: record.industry,
          size: record.size,
          description: record.description,
          owner_id: record.owner_id,
          owner_name: record.owner_name,
          tags: record.tags || [],
        };

      case 'deals':
        return {
          ...baseDoc,
          title: record.title,
          description: record.description,
          amount: record.amount || 0,
          stage: record.stage,
          probability: record.probability || 0,
          expected_close_date: record.expected_close_date
            ? this.toTimestamp(record.expected_close_date)
            : undefined,
          owner_id: record.owner_id,
          owner_name: record.owner_name,
          account_name: record.account_name,
          tags: record.tags || [],
        };

      case 'tickets':
        return {
          ...baseDoc,
          subject: record.subject,
          description: record.description,
          status: record.status,
          priority: record.priority,
          category: record.category,
          assigned_to_id: record.assigned_to_id,
          assigned_to_name: record.assigned_to_name,
          requester_name: record.requester_name,
          tags: record.tags || [],
        };

      case 'emails':
        return {
          ...baseDoc,
          id: record.id,
          subject: record.subject,
          body_text: this.stripHtml(record.body_html || record.body_text || ''),
          from_email: record.from_email,
          from_name: record.from_name,
          to_emails: record.to_emails || [],
          direction: record.direction,
          status: record.status,
          opened: record.opened || false,
          clicked: record.clicked || false,
          prospect_id: record.prospect_id,
          sent_at: this.toTimestamp(record.sent_at || record.created_at),
        };

      case 'tasks':
        return {
          ...baseDoc,
          title: record.title,
          description: record.description,
          status: record.status,
          priority: record.priority,
          assigned_to_id: record.assigned_to_id,
          assigned_to_name: record.assigned_to_name,
          due_date: record.due_date ? this.toTimestamp(record.due_date) : undefined,
          completed_at: record.completed_at ? this.toTimestamp(record.completed_at) : undefined,
        };

      case 'campaigns':
        return {
          ...baseDoc,
          name: record.name,
          description: record.description,
          type: record.type,
          status: record.status,
          content: this.stripHtml(record.content || ''),
          owner_id: record.owner_id,
          owner_name: record.owner_name,
        };

      case 'articles':
        return {
          ...baseDoc,
          title: record.title,
          content: this.stripHtml(record.content || ''),
          category: record.category,
          tags: record.tags || [],
          status: record.status,
          author_id: record.author_id,
          author_name: record.author_name,
          views: record.views || 0,
          helpful_count: record.helpful_count || 0,
        };

      default:
        return baseDoc;
    }
  }

  /**
   * Get index statistics for all collections
   */
  async getIndexStats(): Promise<IndexStats[]> {
    const collections = [
      'prospects',
      'accounts',
      'deals',
      'tickets',
      'emails',
      'tasks',
      'campaigns',
      'articles',
    ];

    const stats: IndexStats[] = [];

    for (const collection of collections) {
      try {
        const collectionInfo = await typesense.collections(collection).retrieve();

        stats.push({
          collectionName: collection,
          totalDocuments: collectionInfo.num_documents || 0,
          lastIndexedAt: new Date(), // Would come from indexing_jobs table
          health: this.calculateHealth(collectionInfo),
          syncLag: undefined, // Would calculate based on last update
        });
      } catch (error) {
        stats.push({
          collectionName: collection,
          totalDocuments: 0,
          lastIndexedAt: new Date(0),
          health: 'unhealthy',
        });
      }
    }

    return stats;
  }

  /**
   * Handle real-time change event from database
   */
  async handleChangeEvent(event: {
    table: string;
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    record: any;
    old?: any;
  }): Promise<void> {
    try {
      const collectionName = event.table;

      switch (event.eventType) {
        case 'INSERT':
        case 'UPDATE':
          await this.indexDocument(collectionName, event.record.id);
          break;

        case 'DELETE':
          await this.deleteDocument(collectionName, event.old?.id || event.record.id);
          break;
      }
    } catch (error) {
      console.error('Failed to handle change event:', error);
      // Queue for retry
      await this.queueFailedSync(event);
    }
  }

  /**
   * Queue failed sync for retry
   */
  private async queueFailedSync(event: any): Promise<void> {
    await supabase.from('search_sync_queue').insert({
      table_name: event.table,
      event_type: event.eventType,
      record_id: event.record?.id,
      payload: event,
      status: 'pending',
      retry_count: 0,
    });
  }

  /**
   * Process sync queue (retry failed syncs)
   */
  async processSyncQueue(): Promise<void> {
    const { data: queueItems } = await supabase
      .from('search_sync_queue')
      .select()
      .eq('status', 'pending')
      .lt('retry_count', this.maxRetries)
      .limit(100);

    if (!queueItems || queueItems.length === 0) {
      return;
    }

    for (const item of queueItems) {
      try {
        await this.handleChangeEvent(item.payload);

        // Mark as processed
        await supabase
          .from('search_sync_queue')
          .update({ status: 'processed' })
          .eq('id', item.id);
      } catch (error) {
        // Increment retry count
        await supabase
          .from('search_sync_queue')
          .update({
            retry_count: item.retry_count + 1,
            last_error: String(error),
          })
          .eq('id', item.id);
      }
    }
  }

  /**
   * Reindex specific records by IDs
   */
  async reindexRecords(
    collectionName: string,
    recordIds: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const recordId of recordIds) {
      try {
        await this.indexDocument(collectionName, recordId);
        success++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Clear all documents from a collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    try {
      // Delete collection
      await typesense.collections(collectionName).delete();

      // Recreate it
      // Note: Schema would need to be passed or retrieved
      console.log(`Cleared collection: ${collectionName}`);
    } catch (error) {
      console.error(`Failed to clear collection ${collectionName}:`, error);
      throw error;
    }
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private toTimestamp(dateString: string | Date | null): number {
    if (!dateString) return 0;
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return Math.floor(date.getTime() / 1000);
  }

  private stripHtml(html: string): string {
    // Remove HTML tags
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private calculateHealth(collectionInfo: any): IndexStats['health'] {
    // Simple health check based on document count
    if (collectionInfo.num_documents === 0) return 'unhealthy';
    if (collectionInfo.num_documents < 10) return 'degraded';
    return 'healthy';
  }

  private async saveIndexingJob(job: IndexingJob): Promise<void> {
    await supabase.from('search_indexing_jobs').upsert({
      id: job.id,
      collection_name: job.collectionName,
      type: job.type,
      status: job.status,
      total_records: job.totalRecords,
      indexed_records: job.indexedRecords,
      failed_records: job.failedRecords,
      started_at: job.startedAt?.toISOString(),
      completed_at: job.completedAt?.toISOString(),
      error: job.error,
    });
  }
}

// =============================================
// REAL-TIME SYNC SETUP
// =============================================

/**
 * Set up real-time sync listeners for all tables
 */
export function setupRealtimeSync(indexer: SearchIndexer): void {
  const tables = [
    'prospects',
    'accounts',
    'deals',
    'tickets',
    'emails',
    'tasks',
    'campaigns',
    'articles',
  ];

  for (const table of tables) {
    supabase
      .channel(`search-sync-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          indexer.handleChangeEvent({
            table,
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            record: payload.new,
            old: payload.old,
          });
        }
      )
      .subscribe();
  }

  console.log('Real-time sync listeners set up for all tables');
}

// =============================================
// FACTORY
// =============================================

let searchIndexerInstance: SearchIndexer | null = null;

export function createSearchIndexer(): SearchIndexer {
  if (!searchIndexerInstance) {
    searchIndexerInstance = new SearchIndexer();
  }
  return searchIndexerInstance;
}
