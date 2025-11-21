/**
 * CRM Sync Engine
 * Orchestrates data synchronization between AIRevenueOrc and CRMs
 */

import {
  CRMClient,
  CRMConnection,
  CRMEntity,
  CRMEntityType,
  SyncDirection,
  SyncResult,
  FieldMapping,
  CRMSyncError
} from './base';
import { createSalesforceClient } from './salesforce';
import { createHubSpotClient } from './hubspot';
import { supabase } from '../supabase';

export interface SyncJob {
  id: string;
  connectionId: string;
  entityType: CRMEntityType;
  direction: SyncDirection;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  result?: SyncResult;
  error?: string;
}

export interface SyncConflict {
  id: string;
  connectionId: string;
  entityType: CRMEntityType;
  internalId: string;
  crmId: string;
  conflictType: 'update_conflict' | 'delete_conflict';
  internalData: Record<string, any>;
  crmData: Record<string, any>;
  resolvedAt?: Date;
  resolution?: 'use_internal' | 'use_crm' | 'manual';
}

/**
 * Sync Engine
 */
export class SyncEngine {
  private client: CRMClient;
  private connection: CRMConnection;
  private fieldMappings: Map<CRMEntityType, FieldMapping> = new Map();

  constructor(client: CRMClient, connection: CRMConnection) {
    this.client = client;
    this.connection = connection;
  }

  /**
   * Initialize sync engine (load field mappings)
   */
  async initialize(): Promise<void> {
    // Load field mappings from database
    const { data: mappings } = await supabase
      .from('crm_field_mappings')
      .select('*')
      .eq('connection_id', this.connection.id)
      .eq('sync_enabled', true);

    if (mappings) {
      for (const mapping of mappings) {
        this.fieldMappings.set(mapping.entity_type, {
          id: mapping.id,
          connectionId: mapping.connection_id,
          entityType: mapping.entity_type,
          mappings: mapping.mappings,
          customMappings: mapping.custom_mappings,
          syncEnabled: mapping.sync_enabled,
          syncDirection: mapping.sync_direction,
          createdAt: new Date(mapping.created_at),
          updatedAt: new Date(mapping.updated_at),
        });
      }
    }
  }

  /**
   * Execute full sync for entity type
   */
  async syncEntityType(entityType: CRMEntityType, direction: SyncDirection): Promise<SyncResult> {
    const startTime = new Date();

    const result: SyncResult = {
      success: false,
      entityType,
      direction,
      pulled: 0,
      pushed: 0,
      updated: 0,
      created: 0,
      deleted: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startedAt: startTime,
      completedAt: new Date(),
      duration: 0,
    };

    try {
      // Create sync job
      const job = await this.createSyncJob(entityType, direction);

      // Execute sync based on direction
      if (direction === 'pull' || direction === 'bidirectional') {
        await this.pullFromCRM(entityType, result);
      }

      if (direction === 'push' || direction === 'bidirectional') {
        await this.pushToCRM(entityType, result);
      }

      result.success = true;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startTime.getTime();

      // Update sync job
      await this.updateSyncJob(job.id, 'completed', result);

      // Update connection last sync time
      await this.updateLastSync();

      return result;
    } catch (error) {
      result.success = false;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startTime.getTime();
      result.errors.push({
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      console.error(`[SyncEngine] Sync failed for ${entityType}:`, error);

      return result;
    }
  }

  /**
   * Execute incremental sync (only recently modified)
   */
  async incrementalSync(entityType: CRMEntityType, since: Date): Promise<SyncResult> {
    const startTime = new Date();

    const result: SyncResult = {
      success: false,
      entityType,
      direction: 'pull',
      pulled: 0,
      pushed: 0,
      updated: 0,
      created: 0,
      deleted: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startedAt: startTime,
      completedAt: new Date(),
      duration: 0,
    };

    try {
      // Get recently modified entities from CRM
      const entities = await this.client.getRecentlyModified({
        entityType,
        since,
        limit: 1000,
      });

      for (const crmEntity of entities) {
        try {
          await this.syncEntityFromCRM(entityType, crmEntity, result);
        } catch (error) {
          result.failed++;
          result.errors.push({
            entityId: crmEntity.crmId,
            error: error instanceof Error ? error.message : 'Failed to sync entity',
          });
        }
      }

      result.success = true;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startTime.getTime();

      return result;
    } catch (error) {
      result.success = false;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startTime.getTime();
      result.errors.push({
        error: error instanceof Error ? error.message : 'Incremental sync failed',
      });

      return result;
    }
  }

  /**
   * Pull entities from CRM to local database
   */
  private async pullFromCRM(entityType: CRMEntityType, result: SyncResult): Promise<void> {
    // Query all entities from CRM
    const crmEntities = await this.client.queryEntities({
      entityType,
      limit: 1000,
    });

    for (const crmEntity of crmEntities) {
      try {
        await this.syncEntityFromCRM(entityType, crmEntity, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          entityId: crmEntity.crmId,
          error: error instanceof Error ? error.message : 'Failed to sync entity',
        });
      }
    }
  }

  /**
   * Push entities from local database to CRM
   */
  private async pushToCRM(entityType: CRMEntityType, result: SyncResult): Promise<void> {
    // Get local entities that need to be pushed
    const { data: localEntities } = await supabase
      .from(this.getTableName(entityType))
      .select('*')
      .eq('team_id', this.connection.organizationId)
      .is('crm_id', null); // Only entities not yet in CRM

    if (!localEntities || localEntities.length === 0) {
      return;
    }

    for (const localEntity of localEntities) {
      try {
        await this.syncEntityToCRM(entityType, localEntity, result);
      } catch (error) {
        result.failed++;
        result.errors.push({
          entityId: localEntity.id,
          error: error instanceof Error ? error.message : 'Failed to push entity',
        });
      }
    }
  }

  /**
   * Sync single entity from CRM to local
   */
  private async syncEntityFromCRM(
    entityType: CRMEntityType,
    crmEntity: CRMEntity,
    result: SyncResult
  ): Promise<void> {
    // Check if entity already exists locally
    const { data: existing } = await supabase
      .from('crm_entity_mappings')
      .select('internal_id')
      .eq('connection_id', this.connection.id)
      .eq('crm_id', crmEntity.crmId)
      .eq('entity_type', entityType)
      .single();

    const fieldMapping = this.fieldMappings.get(entityType);

    if (existing) {
      // Update existing entity
      const updateData = this.mapCRMToInternal(crmEntity, fieldMapping);

      await supabase
        .from(this.getTableName(entityType))
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.internal_id);

      result.updated++;
      result.pulled++;
    } else {
      // Create new entity
      const createData = this.mapCRMToInternal(crmEntity, fieldMapping);

      const { data: newEntity } = await supabase
        .from(this.getTableName(entityType))
        .insert({
          ...createData,
          team_id: this.connection.organizationId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (newEntity) {
        // Create entity mapping
        await supabase.from('crm_entity_mappings').insert({
          connection_id: this.connection.id,
          entity_type: entityType,
          internal_id: newEntity.id,
          crm_id: crmEntity.crmId,
          last_synced_at: new Date().toISOString(),
        });

        result.created++;
        result.pulled++;
      }
    }
  }

  /**
   * Sync single entity from local to CRM
   */
  private async syncEntityToCRM(
    entityType: CRMEntityType,
    localEntity: any,
    result: SyncResult
  ): Promise<void> {
    const fieldMapping = this.fieldMappings.get(entityType);
    const crmData = this.mapInternalToCRM(localEntity, fieldMapping);

    // Create in CRM
    const crmEntity = await this.client.createEntity(entityType, crmData);

    // Create entity mapping
    await supabase.from('crm_entity_mappings').insert({
      connection_id: this.connection.id,
      entity_type: entityType,
      internal_id: localEntity.id,
      crm_id: crmEntity.crmId,
      last_synced_at: new Date().toISOString(),
    });

    result.created++;
    result.pushed++;
  }

  /**
   * Map CRM entity to internal format
   */
  private mapCRMToInternal(crmEntity: CRMEntity, fieldMapping?: FieldMapping): Record<string, any> {
    const data: Record<string, any> = {};

    if (!fieldMapping) {
      // No mapping, use default fields
      return crmEntity.fields;
    }

    // Apply field mappings (CRM field -> Internal field)
    for (const [internalField, crmField] of Object.entries(fieldMapping.mappings)) {
      if (crmEntity.fields[crmField] !== undefined) {
        data[internalField] = crmEntity.fields[crmField];
      }
    }

    // Apply custom mappings with transformations
    if (fieldMapping.customMappings) {
      for (const customMapping of fieldMapping.customMappings) {
        const value = crmEntity.fields[customMapping.crmField];
        if (value !== undefined) {
          // Apply transformation if specified
          if (customMapping.transform) {
            // In production, implement safe transformation execution
            data[customMapping.internalField] = value;
          } else {
            data[customMapping.internalField] = value;
          }
        }
      }
    }

    return data;
  }

  /**
   * Map internal entity to CRM format
   */
  private mapInternalToCRM(internalEntity: any, fieldMapping?: FieldMapping): Record<string, any> {
    const data: Record<string, any> = {};

    if (!fieldMapping) {
      // No mapping, use all fields
      return internalEntity;
    }

    // Apply field mappings (Internal field -> CRM field)
    for (const [internalField, crmField] of Object.entries(fieldMapping.mappings)) {
      if (internalEntity[internalField] !== undefined) {
        data[crmField] = internalEntity[internalField];
      }
    }

    return data;
  }

  /**
   * Get table name for entity type
   */
  private getTableName(entityType: CRMEntityType): string {
    const tableMapping: Record<CRMEntityType, string> = {
      contact: 'prospects',
      lead: 'prospects',
      account: 'accounts',
      opportunity: 'opportunities',
      task: 'bdr_tasks',
      event: 'bdr_activities',
      note: 'notes',
    };

    return tableMapping[entityType];
  }

  /**
   * Create sync job record
   */
  private async createSyncJob(entityType: CRMEntityType, direction: SyncDirection): Promise<SyncJob> {
    const { data } = await supabase
      .from('crm_sync_jobs')
      .insert({
        connection_id: this.connection.id,
        entity_type: entityType,
        direction,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    return {
      id: data.id,
      connectionId: data.connection_id,
      entityType: data.entity_type,
      direction: data.direction,
      status: data.status,
      startedAt: new Date(data.started_at),
    };
  }

  /**
   * Update sync job status
   */
  private async updateSyncJob(jobId: string, status: 'completed' | 'failed', result?: SyncResult): Promise<void> {
    await supabase
      .from('crm_sync_jobs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        result: result ? JSON.stringify(result) : null,
      })
      .eq('id', jobId);
  }

  /**
   * Update connection last sync timestamp
   */
  private async updateLastSync(): Promise<void> {
    await supabase
      .from('crm_connections')
      .update({
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', this.connection.id);
  }

  /**
   * Log activity to CRM
   */
  async logActivityToCRM(params: {
    entityType: 'task' | 'event' | 'note';
    relatedTo: { type: CRMEntityType; internalId: string };
    data: Record<string, any>;
  }): Promise<void> {
    try {
      // Get CRM ID for related entity
      const { data: mapping } = await supabase
        .from('crm_entity_mappings')
        .select('crm_id')
        .eq('connection_id', this.connection.id)
        .eq('entity_type', params.relatedTo.type)
        .eq('internal_id', params.relatedTo.internalId)
        .single();

      if (!mapping) {
        console.warn('[SyncEngine] Related entity not found in CRM, skipping activity log');
        return;
      }

      // Log activity to CRM
      await this.client.logActivity({
        entityType: params.entityType,
        relatedTo: {
          type: params.relatedTo.type,
          id: mapping.crm_id,
        },
        data: params.data,
      });

      // Log sync
      await this.logSync({
        entityType: params.entityType,
        action: 'activity_logged',
        success: true,
      });
    } catch (error) {
      console.error('[SyncEngine] Failed to log activity to CRM:', error);

      await this.logSync({
        entityType: params.entityType,
        action: 'activity_logged',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to log activity',
      });
    }
  }

  /**
   * Log sync operation
   */
  private async logSync(params: {
    entityType: CRMEntityType;
    action: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await supabase.from('crm_sync_log').insert({
      connection_id: this.connection.id,
      entity_type: params.entityType,
      action: params.action,
      success: params.success,
      error: params.error,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Create sync engine for connection
 */
export async function createSyncEngine(connection: CRMConnection): Promise<SyncEngine> {
  // Create appropriate CRM client
  let client: CRMClient;

  if (connection.provider === 'salesforce') {
    client = createSalesforceClient(
      connection,
      process.env.SALESFORCE_CLIENT_ID!,
      process.env.SALESFORCE_CLIENT_SECRET!
    );
  } else if (connection.provider === 'hubspot') {
    client = createHubSpotClient(
      connection,
      process.env.HUBSPOT_CLIENT_ID!,
      process.env.HUBSPOT_CLIENT_SECRET!
    );
  } else {
    throw new Error(`Unsupported CRM provider: ${connection.provider}`);
  }

  const engine = new SyncEngine(client, connection);
  await engine.initialize();

  return engine;
}

/**
 * Schedule automatic sync
 */
export async function scheduleSync(
  connectionId: string,
  entityType: CRMEntityType,
  schedule: 'hourly' | 'daily'
): Promise<void> {
  // In production, use a job queue (BullMQ, etc.)
  // For now, just log the schedule
  console.log(`[SyncEngine] Scheduled ${schedule} sync for ${entityType} on connection ${connectionId}`);
}
