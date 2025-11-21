/**
 * HubSpot CRM Connector
 * Integrates with HubSpot using their REST API
 */

import axios, { AxiosInstance } from 'axios';
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
 * HubSpot entity type mappings
 */
const HUBSPOT_ENTITY_MAPPING: Record<CRMEntityType, string> = {
  contact: 'contacts',
  lead: 'contacts', // HubSpot doesn't have separate Leads, uses Contacts with lifecycle stage
  account: 'companies',
  opportunity: 'deals',
  task: 'tasks',
  event: 'meetings',
  note: 'notes',
};

/**
 * HubSpot property name mappings
 */
const HUBSPOT_PROPERTY_MAPPING: Record<string, string> = {
  firstName: 'firstname',
  lastName: 'lastname',
  email: 'email',
  phone: 'phone',
  company: 'company',
  website: 'website',
  city: 'city',
  state: 'state',
  country: 'country',
  postalCode: 'zip',
};

/**
 * HubSpot Client
 */
export class HubSpotClient extends CRMClient {
  private api: AxiosInstance;
  private clientId: string;
  private clientSecret: string;

  constructor(connection: CRMConnection, clientId: string, clientSecret: string) {
    super(connection);
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    // Initialize axios instance
    this.api = axios.create({
      baseURL: 'https://api.hubapi.com',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.accessToken}`,
      },
    });

    // Add response interceptor for rate limiting
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          throw new CRMRateLimitError('Rate limit exceeded', retryAfter);
        }
        throw error;
      }
    );
  }

  /**
   * Test connection to HubSpot
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureValidToken();

      // Test with a simple API call
      await this.api.get('/crm/v3/objects/contacts', {
        params: { limit: 1 },
      });

      return { success: true };
    } catch (error) {
      console.error('[HubSpot] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Authenticate with HubSpot (OAuth 2.0)
   */
  async authenticate(params: { code?: string; redirectUri?: string }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    try {
      if (!params.code) {
        throw new CRMAuthError('Authorization code required', 'hubspot');
      }

      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: params.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/crm/hubspot/callback`,
        code: params.code,
      });

      const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt,
      };
    } catch (error) {
      console.error('[HubSpot] Authentication failed:', error);
      throw new CRMAuthError(
        error instanceof Error ? error.message : 'Authentication failed',
        'hubspot'
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
      const response = await axios.post('https://api.hubapi.com/oauth/v1/token', {
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      });

      const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      // Update API instance with new token
      this.api.defaults.headers.Authorization = `Bearer ${response.data.access_token}`;

      return {
        accessToken: response.data.access_token,
        expiresAt,
      };
    } catch (error) {
      console.error('[HubSpot] Token refresh failed:', error);
      throw new CRMAuthError(
        error instanceof Error ? error.message : 'Token refresh failed',
        'hubspot'
      );
    }
  }

  /**
   * Get entity by ID
   */
  async getEntity(entityType: CRMEntityType, id: string): Promise<CRMEntity | null> {
    try {
      await this.ensureValidToken();

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];
      const response = await this.api.get(`/crm/v3/objects/${objectType}/${id}`, {
        params: {
          properties: this.getPropertiesForType(entityType),
        },
      });

      return this.normalizeEntity(response.data, entityType);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`[HubSpot] Failed to get ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[params.entityType];

      // Build search request
      const searchRequest: any = {
        properties: this.getPropertiesForType(params.entityType),
        limit: params.limit || 100,
      };

      // Add filters
      if (params.filter && Object.keys(params.filter).length > 0) {
        searchRequest.filterGroups = [
          {
            filters: Object.entries(params.filter).map(([property, value]) => ({
              propertyName: property,
              operator: 'EQ',
              value: String(value),
            })),
          },
        ];
      }

      // Add sorts
      if (params.orderBy) {
        searchRequest.sorts = [
          {
            propertyName: params.orderBy,
            direction: 'ASCENDING',
          },
        ];
      }

      // Add pagination
      if (params.offset) {
        searchRequest.after = String(params.offset);
      }

      const response = await this.api.post(`/crm/v3/objects/${objectType}/search`, searchRequest);

      return response.data.results.map((record: any) => this.normalizeEntity(record, params.entityType));
    } catch (error) {
      console.error(`[HubSpot] Failed to query ${params.entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];

      // Convert to HubSpot properties format
      const properties = this.convertToHubSpotProperties(data);

      const response = await this.api.post(`/crm/v3/objects/${objectType}`, {
        properties,
      });

      return this.normalizeEntity(response.data, entityType);
    } catch (error) {
      console.error(`[HubSpot] Failed to create ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];

      // Convert to HubSpot properties format
      const properties = this.convertToHubSpotProperties(data);

      const response = await this.api.patch(`/crm/v3/objects/${objectType}/${id}`, {
        properties,
      });

      return this.normalizeEntity(response.data, entityType);
    } catch (error) {
      console.error(`[HubSpot] Failed to update ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];
      await this.api.delete(`/crm/v3/objects/${objectType}/${id}`);
    } catch (error) {
      console.error(`[HubSpot] Failed to delete ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];
      const response = await this.api.get(`/crm/v3/properties/${objectType}`);

      const fields = response.data.results.map((prop: any) => ({
        name: prop.name,
        label: prop.label,
        type: prop.type,
        required: prop.required || false,
        picklistValues: prop.options?.map((opt: any) => opt.value),
      }));

      return { fields };
    } catch (error) {
      console.error(`[HubSpot] Failed to get metadata for ${entityType}:`, error);
      throw new CRMSyncError(
        error instanceof Error ? error.message : 'Failed to get metadata',
        entityType
      );
    }
  }

  /**
   * Log activity (Task, Meeting, or Note)
   */
  async logActivity(params: {
    entityType: 'task' | 'event' | 'note';
    relatedTo: { type: CRMEntityType; id: string };
    data: Record<string, any>;
  }): Promise<CRMEntity> {
    try {
      await this.ensureValidToken();

      const objectType = HUBSPOT_ENTITY_MAPPING[params.entityType];

      // Create the activity
      const properties = this.convertToHubSpotProperties(params.data);
      const response = await this.api.post(`/crm/v3/objects/${objectType}`, {
        properties,
      });

      const activityId = response.data.id;

      // Associate with the related entity
      const relatedObjectType = HUBSPOT_ENTITY_MAPPING[params.relatedTo.type];
      await this.api.put(
        `/crm/v3/objects/${objectType}/${activityId}/associations/${relatedObjectType}/${params.relatedTo.id}/default`
      );

      return this.normalizeEntity(response.data, params.entityType);
    } catch (error) {
      console.error('[HubSpot] Failed to log activity:', error);
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

      const types = entityTypes || (['contact', 'account', 'opportunity'] as CRMEntityType[]);
      const results: CRMEntity[] = [];

      for (const entityType of types) {
        const objectType = HUBSPOT_ENTITY_MAPPING[entityType];

        const searchRequest = {
          query,
          properties: this.getPropertiesForType(entityType),
          limit: 10,
        };

        try {
          const response = await this.api.post(`/crm/v3/objects/${objectType}/search`, searchRequest);

          const entities = response.data.results.map((record: any) =>
            this.normalizeEntity(record, entityType)
          );

          results.push(...entities);
        } catch (error) {
          // Continue with other types if one fails
          console.warn(`[HubSpot] Search failed for ${entityType}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('[HubSpot] Search failed:', error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];

      const inputs = records.map(record => ({
        properties: this.convertToHubSpotProperties(record),
      }));

      const response = await this.api.post(`/crm/v3/objects/${objectType}/batch/create`, {
        inputs,
      });

      let success = 0;
      let failed = 0;
      const errors: any[] = [];

      if (response.data.results) {
        success = response.data.results.length;
      }

      if (response.data.errors) {
        failed = response.data.errors.length;
        errors.push(...response.data.errors);
      }

      return { success, failed, errors };
    } catch (error) {
      console.error(`[HubSpot] Bulk create failed for ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[entityType];

      const inputs = records.map(record => ({
        id: record.id,
        properties: this.convertToHubSpotProperties(record.data),
      }));

      const response = await this.api.post(`/crm/v3/objects/${objectType}/batch/update`, {
        inputs,
      });

      let success = 0;
      let failed = 0;
      const errors: any[] = [];

      if (response.data.results) {
        success = response.data.results.length;
      }

      if (response.data.errors) {
        failed = response.data.errors.length;
        errors.push(...response.data.errors);
      }

      return { success, failed, errors };
    } catch (error) {
      console.error(`[HubSpot] Bulk update failed for ${entityType}:`, error);
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

      const objectType = HUBSPOT_ENTITY_MAPPING[params.entityType];

      const searchRequest = {
        properties: this.getPropertiesForType(params.entityType),
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hs_lastmodifieddate',
                operator: 'GTE',
                value: params.since.getTime().toString(),
              },
            ],
          },
        ],
        sorts: [
          {
            propertyName: 'hs_lastmodifieddate',
            direction: 'DESCENDING',
          },
        ],
        limit: params.limit || 100,
      };

      const response = await this.api.post(`/crm/v3/objects/${objectType}/search`, searchRequest);

      return response.data.results.map((record: any) => this.normalizeEntity(record, params.entityType));
    } catch (error) {
      console.error(`[HubSpot] Failed to get recently modified ${params.entityType}:`, error);
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

  private getPropertiesForType(entityType: CRMEntityType): string[] {
    const commonProps = ['hs_object_id', 'createdate', 'lastmodifieddate'];

    const typeSpecificProps: Record<CRMEntityType, string[]> = {
      contact: ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'lifecyclestage'],
      lead: ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'],
      account: ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'city', 'state', 'country'],
      opportunity: ['dealname', 'amount', 'dealstage', 'probability', 'closedate', 'pipeline'],
      task: ['hs_task_subject', 'hs_task_body', 'hs_task_status', 'hs_task_priority', 'hs_timestamp'],
      event: ['hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time'],
      note: ['hs_note_body', 'hs_timestamp'],
    };

    return [...commonProps, ...(typeSpecificProps[entityType] || [])];
  }

  private convertToHubSpotProperties(data: Record<string, any>): Record<string, any> {
    const properties: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Map to HubSpot property names if available
      const hubspotKey = HUBSPOT_PROPERTY_MAPPING[key] || key;
      properties[hubspotKey] = value;
    }

    return properties;
  }

  protected normalizeEntity(hubspotRecord: any, entityType: CRMEntityType): CRMEntity {
    const fields: Record<string, any> = {};

    // HubSpot stores data in properties object
    if (hubspotRecord.properties) {
      for (const [key, value] of Object.entries(hubspotRecord.properties)) {
        fields[key] = value;
      }
    }

    return {
      crmId: hubspotRecord.id,
      crmType: entityType,
      fields,
      raw: hubspotRecord,
      createdAt: new Date(hubspotRecord.createdAt || hubspotRecord.properties?.createdate || Date.now()),
      updatedAt: new Date(hubspotRecord.updatedAt || hubspotRecord.properties?.lastmodifieddate || Date.now()),
    };
  }
}

/**
 * Create HubSpot client
 */
export function createHubSpotClient(
  connection: CRMConnection,
  clientId: string,
  clientSecret: string
): HubSpotClient {
  return new HubSpotClient(connection, clientId, clientSecret);
}

/**
 * Get HubSpot OAuth authorization URL
 */
export function getHubSpotAuthUrl(clientId: string, redirectUri: string, scopes: string[], state?: string): string {
  const baseUrl = 'https://app.hubspot.com/oauth/authorize';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
  });

  if (state) {
    params.append('state', state);
  }

  return `${baseUrl}?${params.toString()}`;
}
