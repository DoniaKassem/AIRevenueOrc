/**
 * Operations Hub - Custom Objects
 * Create and manage custom data structures beyond standard CRM objects
 */

import { supabase } from '../supabase';

export interface CustomObject {
  id: string;
  name: string;
  pluralName: string;
  apiName: string; // e.g., custom_product
  description: string;
  icon?: string;

  // Schema
  properties: CustomProperty[];
  associations?: CustomAssociation[];

  // Settings
  isSearchable: boolean;
  enableActivities: boolean;
  enableWorkflows: boolean;
  primaryDisplayProperty?: string;
  secondaryDisplayProperties?: string[];

  // Permissions
  permissions: {
    create?: string[]; // role IDs
    read?: string[];
    update?: string[];
    delete?: string[];
  };

  // Metadata
  recordCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomProperty {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'multi_select' | 'email' | 'phone' | 'url' | 'textarea' | 'rich_text' | 'file' | 'reference';
  description?: string;

  // Validation
  required: boolean;
  unique: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    options?: string[]; // For select/multi_select
  };

  // Reference
  referenceObject?: string; // For reference type

  // Display
  displayOrder: number;
  showInTable: boolean;
  showInForm: boolean;
  groupName?: string;

  // Default
  defaultValue?: any;
}

export interface CustomAssociation {
  id: string;
  fromObject: string; // custom object ID or 'prospect', 'account', etc.
  toObject: string;
  relationshipType: 'one_to_one' | 'one_to_many' | 'many_to_many';
  label: string;
  inverseLabel?: string;
}

export interface CustomObjectRecord {
  id: string;
  objectId: string;
  properties: Record<string, any>;
  associations?: Record<string, string[]>; // objectId -> record IDs
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom Object Service
 */
export class CustomObjectService {
  /**
   * Create custom object
   */
  async createCustomObject(object: Partial<CustomObject>): Promise<CustomObject> {
    // Generate API name
    const apiName = object.apiName || this.generateApiName(object.name || 'object');

    const { data, error } = await supabase
      .from('custom_objects')
      .insert({
        name: object.name,
        plural_name: object.pluralName,
        api_name: apiName,
        description: object.description,
        icon: object.icon,
        properties: object.properties || [],
        associations: object.associations,
        is_searchable: object.isSearchable !== false,
        enable_activities: object.enableActivities || false,
        enable_workflows: object.enableWorkflows || false,
        primary_display_property: object.primaryDisplayProperty,
        secondary_display_properties: object.secondaryDisplayProperties,
        permissions: object.permissions || {},
        record_count: 0,
        created_by: object.createdBy
      })
      .select()
      .single();

    if (error) throw error;

    // Create table for records
    await this.createRecordTable(apiName, object.properties || []);

    return this.mapObject(data);
  }

  /**
   * Update custom object
   */
  async updateCustomObject(objectId: string, updates: Partial<CustomObject>): Promise<CustomObject> {
    const current = await this.getCustomObject(objectId);

    // Check if properties changed (need to alter table)
    if (updates.properties) {
      await this.updateRecordTable(current.apiName, updates.properties);
    }

    const { data, error } = await supabase
      .from('custom_objects')
      .update({
        name: updates.name,
        plural_name: updates.pluralName,
        description: updates.description,
        icon: updates.icon,
        properties: updates.properties,
        associations: updates.associations,
        is_searchable: updates.isSearchable,
        enable_activities: updates.enableActivities,
        enable_workflows: updates.enableWorkflows,
        primary_display_property: updates.primaryDisplayProperty,
        secondary_display_properties: updates.secondaryDisplayProperties,
        permissions: updates.permissions,
        updated_at: new Date().toISOString()
      })
      .eq('id', objectId)
      .select()
      .single();

    if (error) throw error;
    return this.mapObject(data);
  }

  /**
   * Get custom object
   */
  async getCustomObject(objectId: string): Promise<CustomObject> {
    const { data, error } = await supabase
      .from('custom_objects')
      .select('*')
      .eq('id', objectId)
      .single();

    if (error) throw error;
    return this.mapObject(data);
  }

  /**
   * Get custom objects
   */
  async getCustomObjects(): Promise<CustomObject[]> {
    const { data } = await supabase
      .from('custom_objects')
      .select('*')
      .order('created_at', { ascending: false });

    return (data || []).map(this.mapObject);
  }

  /**
   * Delete custom object
   */
  async deleteCustomObject(objectId: string): Promise<void> {
    const object = await this.getCustomObject(objectId);

    // Drop record table
    await this.dropRecordTable(object.apiName);

    await supabase
      .from('custom_objects')
      .delete()
      .eq('id', objectId);
  }

  /**
   * Create record
   */
  async createRecord(objectId: string, record: Partial<CustomObjectRecord>): Promise<CustomObjectRecord> {
    const object = await this.getCustomObject(objectId);

    // Validate properties
    this.validateProperties(record.properties!, object.properties);

    const { data, error } = await supabase
      .from(`custom_${object.apiName}`)
      .insert({
        ...record.properties,
        associations: record.associations,
        created_by: record.createdBy,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update record count
    await supabase
      .from('custom_objects')
      .update({ record_count: object.recordCount + 1 })
      .eq('id', objectId);

    return this.mapRecord(data, objectId);
  }

  /**
   * Update record
   */
  async updateRecord(objectId: string, recordId: string, updates: Partial<CustomObjectRecord>): Promise<CustomObjectRecord> {
    const object = await this.getCustomObject(objectId);

    if (updates.properties) {
      this.validateProperties(updates.properties, object.properties);
    }

    const { data, error } = await supabase
      .from(`custom_${object.apiName}`)
      .update({
        ...updates.properties,
        associations: updates.associations,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRecord(data, objectId);
  }

  /**
   * Get record
   */
  async getRecord(objectId: string, recordId: string): Promise<CustomObjectRecord> {
    const object = await this.getCustomObject(objectId);

    const { data, error } = await supabase
      .from(`custom_${object.apiName}`)
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) throw error;
    return this.mapRecord(data, objectId);
  }

  /**
   * Get records
   */
  async getRecords(objectId: string, filters?: {
    search?: string;
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
  }): Promise<CustomObjectRecord[]> {
    const object = await this.getCustomObject(objectId);

    let query = supabase
      .from(`custom_${object.apiName}`)
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.filters) {
      for (const [key, value] of Object.entries(filters.filters)) {
        query = query.eq(key, value);
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(d => this.mapRecord(d, objectId));
  }

  /**
   * Delete record
   */
  async deleteRecord(objectId: string, recordId: string): Promise<void> {
    const object = await this.getCustomObject(objectId);

    await supabase
      .from(`custom_${object.apiName}`)
      .delete()
      .eq('id', recordId);

    // Update record count
    await supabase
      .from('custom_objects')
      .update({ record_count: Math.max(0, object.recordCount - 1) })
      .eq('id', objectId);
  }

  /**
   * Create association
   */
  async createAssociation(
    fromObjectId: string,
    fromRecordId: string,
    toObjectId: string,
    toRecordId: string
  ): Promise<void> {
    await supabase
      .from('custom_object_associations')
      .insert({
        from_object_id: fromObjectId,
        from_record_id: fromRecordId,
        to_object_id: toObjectId,
        to_record_id: toRecordId
      });
  }

  /**
   * Get associations
   */
  async getAssociations(objectId: string, recordId: string, toObjectId?: string): Promise<any[]> {
    let query = supabase
      .from('custom_object_associations')
      .select('*')
      .eq('from_object_id', objectId)
      .eq('from_record_id', recordId);

    if (toObjectId) {
      query = query.eq('to_object_id', toObjectId);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Validate properties
   */
  private validateProperties(data: Record<string, any>, schema: CustomProperty[]): void {
    for (const prop of schema) {
      const value = data[prop.name];

      // Required check
      if (prop.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Property ${prop.label} is required`);
      }

      // Skip further validation if empty and not required
      if (!value) continue;

      // Type validation
      if (prop.type === 'number' && isNaN(Number(value))) {
        throw new Error(`Property ${prop.label} must be a number`);
      }

      if (prop.type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(`Property ${prop.label} must be a boolean`);
      }

      // Validation rules
      if (prop.validation) {
        const val = prop.validation;

        if (val.min !== undefined && Number(value) < val.min) {
          throw new Error(`Property ${prop.label} must be at least ${val.min}`);
        }

        if (val.max !== undefined && Number(value) > val.max) {
          throw new Error(`Property ${prop.label} must be at most ${val.max}`);
        }

        if (val.minLength !== undefined && String(value).length < val.minLength) {
          throw new Error(`Property ${prop.label} must be at least ${val.minLength} characters`);
        }

        if (val.maxLength !== undefined && String(value).length > val.maxLength) {
          throw new Error(`Property ${prop.label} must be at most ${val.maxLength} characters`);
        }

        if (val.pattern && !new RegExp(val.pattern).test(String(value))) {
          throw new Error(`Property ${prop.label} format is invalid`);
        }

        if (val.options && !val.options.includes(value)) {
          throw new Error(`Property ${prop.label} must be one of: ${val.options.join(', ')}`);
        }
      }
    }
  }

  /**
   * Create record table
   */
  private async createRecordTable(apiName: string, properties: CustomProperty[]): Promise<void> {
    // This would create a dynamic table in PostgreSQL
    // For now, we'll use a generic JSONB approach
    console.log(`Creating table custom_${apiName} with properties:`, properties);
  }

  /**
   * Update record table
   */
  private async updateRecordTable(apiName: string, properties: CustomProperty[]): Promise<void> {
    // This would alter the table schema
    console.log(`Updating table custom_${apiName} with properties:`, properties);
  }

  /**
   * Drop record table
   */
  private async dropRecordTable(apiName: string): Promise<void> {
    // This would drop the table
    console.log(`Dropping table custom_${apiName}`);
  }

  /**
   * Generate API name
   */
  private generateApiName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Map database record to CustomObject
   */
  private mapObject(data: any): CustomObject {
    return {
      id: data.id,
      name: data.name,
      pluralName: data.plural_name,
      apiName: data.api_name,
      description: data.description,
      icon: data.icon,
      properties: data.properties,
      associations: data.associations,
      isSearchable: data.is_searchable,
      enableActivities: data.enable_activities,
      enableWorkflows: data.enable_workflows,
      primaryDisplayProperty: data.primary_display_property,
      secondaryDisplayProperties: data.secondary_display_properties,
      permissions: data.permissions,
      recordCount: data.record_count,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to CustomObjectRecord
   */
  private mapRecord(data: any, objectId: string): CustomObjectRecord {
    const { id, associations, created_by, created_at, updated_at, ...properties } = data;

    return {
      id,
      objectId,
      properties,
      associations,
      createdBy: created_by,
      createdAt: new Date(created_at),
      updatedAt: new Date(updated_at)
    };
  }
}

/**
 * Create Custom Object Service
 */
export function createCustomObjectService(): CustomObjectService {
  return new CustomObjectService();
}
