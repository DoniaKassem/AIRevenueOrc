/**
 * CRM Base Interface
 * Abstract interface for CRM integrations (Salesforce, HubSpot, etc.)
 */

export type CRMProvider = 'salesforce' | 'hubspot' | 'microsoft_dynamics' | 'pipedrive' | 'custom';

export type CRMEntityType = 'contact' | 'lead' | 'account' | 'opportunity' | 'task' | 'event' | 'note';

export type SyncDirection = 'pull' | 'push' | 'bidirectional';

export type SyncStrategy = 'real_time' | 'hourly' | 'daily' | 'manual';

/**
 * CRM Connection Configuration
 */
export interface CRMConnection {
  id: string;
  organizationId: string;
  provider: CRMProvider;
  isActive: boolean;

  // OAuth credentials
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;

  // API credentials (for non-OAuth)
  apiKey?: string;
  apiSecret?: string;

  // Instance info
  instanceUrl?: string;
  domain?: string;

  // Sync configuration
  syncEnabled: boolean;
  syncStrategy: SyncStrategy;
  syncDirection: SyncDirection;
  lastSyncAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  connectedBy: string;
}

/**
 * CRM Entity (unified structure)
 */
export interface CRMEntity {
  // Internal ID
  internalId?: string;

  // CRM ID
  crmId: string;
  crmType: CRMEntityType;

  // Common fields (normalized across CRMs)
  fields: Record<string, any>;

  // Raw data from CRM
  raw: Record<string, any>;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

/**
 * Sync Result
 */
export interface SyncResult {
  success: boolean;
  entityType: CRMEntityType;
  direction: SyncDirection;

  // Statistics
  pulled: number;
  pushed: number;
  updated: number;
  created: number;
  deleted: number;
  failed: number;
  skipped: number;

  // Errors
  errors: Array<{
    entityId?: string;
    error: string;
    details?: any;
  }>;

  // Timing
  startedAt: Date;
  completedAt: Date;
  duration: number; // milliseconds
}

/**
 * Field Mapping
 */
export interface FieldMapping {
  id: string;
  connectionId: string;
  entityType: CRMEntityType;

  // Field mappings: internal field -> CRM field
  mappings: Record<string, string>;

  // Custom field mappings
  customMappings?: Array<{
    internalField: string;
    crmField: string;
    transform?: string; // Optional transformation function
  }>;

  // Sync settings
  syncEnabled: boolean;
  syncDirection: SyncDirection;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Abstract CRM Client
 * Base class for all CRM integrations
 */
export abstract class CRMClient {
  protected connection: CRMConnection;

  constructor(connection: CRMConnection) {
    this.connection = connection;
  }

  /**
   * Test connection to CRM
   */
  abstract testConnection(): Promise<{ success: boolean; error?: string }>;

  /**
   * Authenticate with CRM (OAuth flow)
   */
  abstract authenticate(params: {
    code?: string;
    redirectUri?: string;
  }): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }>;

  /**
   * Refresh access token
   */
  abstract refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }>;

  /**
   * Get entity by ID
   */
  abstract getEntity(entityType: CRMEntityType, id: string): Promise<CRMEntity | null>;

  /**
   * Query entities
   */
  abstract queryEntities(params: {
    entityType: CRMEntityType;
    filter?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<CRMEntity[]>;

  /**
   * Create entity
   */
  abstract createEntity(entityType: CRMEntityType, data: Record<string, any>): Promise<CRMEntity>;

  /**
   * Update entity
   */
  abstract updateEntity(entityType: CRMEntityType, id: string, data: Record<string, any>): Promise<CRMEntity>;

  /**
   * Delete entity
   */
  abstract deleteEntity(entityType: CRMEntityType, id: string): Promise<void>;

  /**
   * Get entity metadata (available fields, types, etc.)
   */
  abstract getEntityMetadata(entityType: CRMEntityType): Promise<{
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
      picklistValues?: string[];
    }>;
  }>;

  /**
   * Log activity (email, call, task, etc.)
   */
  abstract logActivity(params: {
    entityType: 'task' | 'event' | 'note';
    relatedTo: {
      type: CRMEntityType;
      id: string;
    };
    data: Record<string, any>;
  }): Promise<CRMEntity>;

  /**
   * Search entities
   */
  abstract search(query: string, entityTypes?: CRMEntityType[]): Promise<CRMEntity[]>;

  /**
   * Bulk create entities
   */
  abstract bulkCreate(
    entityType: CRMEntityType,
    records: Array<Record<string, any>>
  ): Promise<{ success: number; failed: number; errors: any[] }>;

  /**
   * Bulk update entities
   */
  abstract bulkUpdate(
    entityType: CRMEntityType,
    records: Array<{ id: string; data: Record<string, any> }>
  ): Promise<{ success: number; failed: number; errors: any[] }>;

  /**
   * Get recently modified entities (for incremental sync)
   */
  abstract getRecentlyModified(params: {
    entityType: CRMEntityType;
    since: Date;
    limit?: number;
  }): Promise<CRMEntity[]>;

  /**
   * Helper: Check if token is expired
   */
  protected isTokenExpired(): boolean {
    if (!this.connection.tokenExpiresAt) {
      return false;
    }
    // Refresh 5 minutes before expiry
    return this.connection.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  }

  /**
   * Helper: Ensure valid token
   */
  protected async ensureValidToken(): Promise<void> {
    if (this.isTokenExpired() && this.connection.refreshToken) {
      const { accessToken, expiresAt } = await this.refreshAccessToken(this.connection.refreshToken);
      this.connection.accessToken = accessToken;
      this.connection.tokenExpiresAt = expiresAt;

      // Update connection in database
      await this.updateConnectionTokens(accessToken, expiresAt);
    }
  }

  /**
   * Helper: Update connection tokens in database
   */
  protected abstract updateConnectionTokens(accessToken: string, expiresAt?: Date): Promise<void>;

  /**
   * Helper: Normalize entity to internal format
   */
  protected normalizeEntity(crmEntity: any, entityType: CRMEntityType, fieldMapping?: FieldMapping): CRMEntity {
    const fields: Record<string, any> = {};

    // Apply field mappings if available
    if (fieldMapping) {
      for (const [internalField, crmField] of Object.entries(fieldMapping.mappings)) {
        if (crmEntity[crmField] !== undefined) {
          fields[internalField] = crmEntity[crmField];
        }
      }
    } else {
      // Default mapping (copy all fields)
      Object.assign(fields, crmEntity);
    }

    return {
      crmId: crmEntity.Id || crmEntity.id,
      crmType: entityType,
      fields,
      raw: crmEntity,
      createdAt: new Date(crmEntity.CreatedDate || crmEntity.createdAt || crmEntity.created_at || Date.now()),
      updatedAt: new Date(crmEntity.LastModifiedDate || crmEntity.updatedAt || crmEntity.updated_at || Date.now()),
    };
  }

  /**
   * Helper: Denormalize entity from internal format to CRM format
   */
  protected denormalizeEntity(entity: Partial<CRMEntity>, fieldMapping?: FieldMapping): Record<string, any> {
    const crmData: Record<string, any> = {};

    if (!entity.fields) {
      return crmData;
    }

    // Apply field mappings if available
    if (fieldMapping) {
      for (const [internalField, crmField] of Object.entries(fieldMapping.mappings)) {
        if (entity.fields[internalField] !== undefined) {
          crmData[crmField] = entity.fields[internalField];
        }
      }
    } else {
      // Default mapping (copy all fields)
      Object.assign(crmData, entity.fields);
    }

    return crmData;
  }
}

/**
 * CRM Factory
 * Creates appropriate CRM client based on provider
 */
export interface CRMFactory {
  createClient(connection: CRMConnection): CRMClient;
}

/**
 * Default entity type mappings
 */
export const DEFAULT_ENTITY_FIELDS: Record<CRMEntityType, string[]> = {
  contact: ['firstName', 'lastName', 'email', 'phone', 'title', 'company', 'address', 'city', 'state', 'country', 'postalCode'],
  lead: ['firstName', 'lastName', 'email', 'phone', 'company', 'title', 'status', 'source', 'rating'],
  account: ['name', 'website', 'industry', 'employees', 'revenue', 'address', 'city', 'state', 'country', 'postalCode'],
  opportunity: ['name', 'amount', 'stage', 'probability', 'closeDate', 'accountId', 'contactId'],
  task: ['subject', 'description', 'dueDate', 'status', 'priority', 'relatedTo'],
  event: ['subject', 'description', 'startDate', 'endDate', 'location', 'relatedTo'],
  note: ['title', 'content', 'relatedTo'],
};

/**
 * CRM Sync Errors
 */
export class CRMSyncError extends Error {
  constructor(
    message: string,
    public entityType: CRMEntityType,
    public entityId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'CRMSyncError';
  }
}

export class CRMAuthError extends Error {
  constructor(
    message: string,
    public provider: CRMProvider
  ) {
    super(message);
    this.name = 'CRMAuthError';
  }
}

export class CRMRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'CRMRateLimitError';
  }
}
