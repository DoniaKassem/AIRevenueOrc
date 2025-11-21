/**
 * Salesforce CRM Connector
 * Integrates with Salesforce using jsforce library
 */

import jsforce from 'jsforce';
import {
  CRMClient,
  CRMConnection,
  CRMEntity,
  CRMEntityType,
  FieldMapping,
  CRMAuthError,
  CRMSyncError,
  CRMRateLimitError
} from './base';
import { supabase } from '../supabase';

/**
 * Salesforce entity type mappings
 */
const SF_ENTITY_MAPPING: Record<CRMEntityType, string> = {
  contact: 'Contact',
  lead: 'Lead',
  account: 'Account',
  opportunity: 'Opportunity',
  task: 'Task',
  event: 'Event',
  note: 'Note',
};

/**
 * Salesforce Client
 */
export class SalesforceClient extends CRMClient {
  private conn: jsforce.Connection;
  private clientId: string;
  private clientSecret: string;

  constructor(connection: CRMConnection, clientId: string, clientSecret: string) {
    super(connection);
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    // Initialize jsforce connection
    this.conn = new jsforce.Connection({
      oauth2: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/crm/salesforce/callback`,
      },
      instanceUrl: connection.instanceUrl,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
    });

    // Set up token refresh
    if (connection.refreshToken) {
      this.conn.on('refresh', (accessToken, res) => {
        console.log('[Salesforce] Token refreshed');
        this.connection.accessToken = accessToken;
        this.updateConnectionTokens(accessToken);
      });
    }
  }

  /**
   * Test connection to Salesforce
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureValidToken();

      // Simple query to test connection
      const result = await this.conn.query('SELECT Id FROM User LIMIT 1');

      return { success: true };
    } catch (error) {
      console.error('[Salesforce] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Authenticate with Salesforce (OAuth 2.0)
   */
  async authenticate(params: { code?: string; redirectUri?: string }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    try {
      if (!params.code) {
        throw new CRMAuthError('Authorization code required', 'salesforce');
      }

      // Exchange code for tokens
      const oauth2 = new jsforce.OAuth2({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: params.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/crm/salesforce/callback`,
      });

      const conn = new jsforce.Connection({ oauth2 });
      await conn.authorize(params.code);

      return {
        accessToken: conn.accessToken!,
        refreshToken: conn.refreshToken,
        expiresAt: undefined, // Salesforce tokens don't have explicit expiry
      };
    } catch (error) {
      console.error('[Salesforce] Authentication failed:', error);
      throw new CRMAuthError(
        error instanceof Error ? error.message : 'Authentication failed',
        'salesforce'
      );
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    try {
      const oauth2 = new jsforce.OAuth2({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });

      const conn = new jsforce.Connection({
        oauth2,
        refreshToken,
      });

      // Trigger refresh
      await conn.identity();

      return {
        accessToken: conn.accessToken!,
        expiresAt: undefined,
      };
    } catch (error) {
      console.error('[Salesforce] Token refresh failed:', error);
      throw new CRMAuthError(
        error instanceof Error ? error.message : 'Token refresh failed',
        'salesforce'
      );
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityType: CRMEntityType, id: string): Promise<CRMEntity | null> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const record = await this.conn.sobject(sfObjectType).retrieve(id);

      if (!record) {
        return null;
      }

      return this.normalizeEntity(record, entityType);
    } catch (error) {
      console.error(`[Salesforce] Failed to get ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to get entity',
        entityType,
        id
      );
    }
  }

  /**
   * Query entities
   */
  async queryEntities(params: {
    entityType: CRMEntityType;
    filter?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<CRMEntity[]> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[params.entityType];

      // Build SOQL query
      let soql = `SELECT FIELDS(ALL) FROM ${sfObjectType}`;

      // Add WHERE clause
      if (params.filter && Object.keys(params.filter).length > 0) {
        const conditions = Object.entries(params.filter)
          .map(([field, value]) => {
            if (typeof value === 'string') {
              return `${field} = '${value.replace(/'/g, "\\'")}'`;
            }
            return `${field} = ${value}`;
          })
          .join(' AND ');
        soql += ` WHERE ${conditions}`;
      }

      // Add ORDER BY
      if (params.orderBy) {
        soql += ` ORDER BY ${params.orderBy}`;
      }

      // Add LIMIT
      if (params.limit) {
        soql += ` LIMIT ${params.limit}`;
      }

      // Add OFFSET
      if (params.offset) {
        soql += ` OFFSET ${params.offset}`;
      }

      const result = await this.conn.query(soql);

      return result.records.map(record => this.normalizeEntity(record, params.entityType));
    } catch (error) {
      console.error(`[Salesforce] Failed to query ${params.entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to query entities',
        params.entityType
      );
    }
  }

  /**
   * Create entity
   */
  async createEntity(entityType: CRMEntityType, data: Record<string, any>): Promise<CRMEntity> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const result = await this.conn.sobject(sfObjectType).create(data);

      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Create failed');
      }

      // Fetch the created record
      return (await this.getEntity(entityType, result.id))!;
    } catch (error) {
      console.error(`[Salesforce] Failed to create ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to create entity',
        entityType
      );
    }
  }

  /**
   * Update entity
   */
  async updateEntity(entityType: CRMEntityType, id: string, data: Record<string, any>): Promise<CRMEntity> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const result = await this.conn.sobject(sfObjectType).update({
        Id: id,
        ...data,
      });

      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Update failed');
      }

      // Fetch the updated record
      return (await this.getEntity(entityType, id))!;
    } catch (error) {
      console.error(`[Salesforce] Failed to update ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to update entity',
        entityType,
        id
      );
    }
  }

  /**
   * Delete entity
   */
  async deleteEntity(entityType: CRMEntityType, id: string): Promise<void> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const result = await this.conn.sobject(sfObjectType).delete(id);

      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Delete failed');
      }
    } catch (error) {
      console.error(`[Salesforce] Failed to delete ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to delete entity',
        entityType,
        id
      );
    }
  }

  /**
   * Get entity metadata
   */
  async getEntityMetadata(entityType: CRMEntityType): Promise<{
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
      picklistValues?: string[];
    }>;
  }> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const metadata = await this.conn.sobject(sfObjectType).describe();

      const fields = metadata.fields.map(field => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: !field.nillable && !field.defaultedOnCreate,
        picklistValues: field.picklistValues?.map(pv => pv.value),
      }));

      return { fields };
    } catch (error) {
      console.error(`[Salesforce] Failed to get metadata for ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to get metadata',
        entityType
      );
    }
  }

  /**
   * Log activity (Task, Event, or Note)
   */
  async logActivity(params: {
    entityType: 'task' | 'event' | 'note';
    relatedTo: { type: CRMEntityType; id: string };
    data: Record<string, any>;
  }): Promise<CRMEntity> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[params.entityType];

      // Add relationship field
      const relationshipField = this.getRelationshipField(params.relatedTo.type);
      const activityData = {
        ...params.data,
        [relationshipField]: params.relatedTo.id,
      };

      const result = await this.conn.sobject(sfObjectType).create(activityData);

      if (!result.success) {
        throw new Error(result.errors?.join(', ') || 'Activity log failed');
      }

      return (await this.getEntity(params.entityType, result.id))!;
    } catch (error) {
      console.error('[Salesforce] Failed to log activity:', error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to log activity',
        params.entityType
      );
    }
  }

  /**
   * Search entities
   */
  async search(query: string, entityTypes?: CRMEntityType[]): Promise<CRMEntity[]> {
    try {
      await this.ensureValidToken();

      // Build SOSL query
      const objects = entityTypes
        ? entityTypes.map(t => SF_ENTITY_MAPPING[t])
        : Object.values(SF_ENTITY_MAPPING);

      const sosl = `FIND {${query}} IN ALL FIELDS RETURNING ${objects.join(', ')}`;

      const result = await this.conn.search(sosl);

      const entities: CRMEntity[] = [];

      for (const searchRecord of result.searchRecords) {
        const entityType = this.getSalesforceEntityType(searchRecord.attributes.type);
        if (entityType) {
          entities.push(this.normalizeEntity(searchRecord, entityType));
        }
      }

      return entities;
    } catch (error) {
      console.error('[Salesforce] Search failed:', error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Search failed',
        'contact'
      );
    }
  }

  /**
   * Bulk create entities
   */
  async bulkCreate(
    entityType: CRMEntityType,
    records: Array<Record<string, any>>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const results = await this.conn.sobject(sfObjectType).create(records);

      const resultsArray = Array.isArray(results) ? results : [results];

      let success = 0;
      let failed = 0;
      const errors: any[] = [];

      resultsArray.forEach((result, index) => {
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push({
            index,
            errors: result.errors,
          });
        }
      });

      return { success, failed, errors };
    } catch (error) {
      console.error(`[Salesforce] Bulk create failed for ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Bulk create failed',
        entityType
      );
    }
  }

  /**
   * Bulk update entities
   */
  async bulkUpdate(
    entityType: CRMEntityType,
    records: Array<{ id: string; data: Record<string, any> }>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[entityType];
      const updateRecords = records.map(r => ({ Id: r.id, ...r.data }));

      const results = await this.conn.sobject(sfObjectType).update(updateRecords);

      const resultsArray = Array.isArray(results) ? results : [results];

      let success = 0;
      let failed = 0;
      const errors: any[] = [];

      resultsArray.forEach((result, index) => {
        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push({
            index,
            id: records[index].id,
            errors: result.errors,
          });
        }
      });

      return { success, failed, errors };
    } catch (error) {
      console.error(`[Salesforce] Bulk update failed for ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Bulk update failed',
        entityType
      );
    }
  }

  /**
   * Get recently modified entities (for incremental sync)
   */
  async getRecentlyModified(params: {
    entityType: CRMEntityType;
    since: Date;
    limit?: number;
  }): Promise<CRMEntity[]> {
    try {
      await this.ensureValidToken();

      const sfObjectType = SF_ENTITY_MAPPING[params.entityType];

      // Format date for SOQL
      const sinceStr = params.since.toISOString();

      let soql = `SELECT FIELDS(ALL) FROM ${sfObjectType} WHERE LastModifiedDate > ${sinceStr}`;

      if (params.limit) {
        soql += ` LIMIT ${params.limit}`;
      }

      const result = await this.conn.query(soql);

      return result.records.map(record => this.normalizeEntity(record, params.entityType));
    } catch (error) {
      console.error(`[Salesforce] Failed to get recently modified ${params.entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to get recently modified',
        params.entityType
      );
    }
  }

  /**
   * Update connection tokens in database
   */
  protected async updateConnectionTokens(accessToken: string, expiresAt?: Date): Promise<void> {
    await supabase
      .from('crm_connections')
      .update({
        access_token: accessToken,
        token_expires_at: expiresAt?.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.connection.id);
  }

  // Private helper methods

  private getRelationshipField(entityType: CRMEntityType): string {
    switch (entityType) {
      case 'contact':
        return 'WhoId';
      case 'lead':
        return 'WhoId';
      case 'account':
        return 'WhatId';
      case 'opportunity':
        return 'WhatId';
      default:
        return 'WhatId';
    }
  }

  private getSalesforceEntityType(sfType: string): CRMEntityType | null {
    const mapping: Record<string, CRMEntityType> = {
      Contact: 'contact',
      Lead: 'lead',
      Account: 'account',
      Opportunity: 'opportunity',
      Task: 'task',
      Event: 'event',
      Note: 'note',
    };

    return mapping[sfType] || null;
  }
}

/**
 * Create Salesforce client
 */
export function createSalesforceClient(
  connection: CRMConnection,
  clientId: string,
  clientSecret: string
): SalesforceClient {
  return new SalesforceClient(connection, clientId, clientSecret);
}

/**
 * Get Salesforce OAuth authorization URL
 */
export function getSalesforceAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const oauth2 = new jsforce.OAuth2({
    clientId,
    redirectUri,
  });

  return oauth2.getAuthorizationUrl({
    scope: 'api refresh_token',
    state,
  });
}
