import { supabase } from './supabase';
import { executeWithRateLimitAndRetry } from './apiRateLimiter';

export interface SyncConfig {
  integration_id: string;
  entity_type: 'prospect' | 'deal' | 'activity' | 'contact';
  direction: 'inbound' | 'outbound' | 'bidirectional';
  sync_mode: 'full' | 'incremental';
  field_mappings: FieldMapping[];
  filters?: Record<string, any>;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  transformation?: string;
  default_value?: any;
  is_required: boolean;
}

export interface SyncResult {
  job_id: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors: Array<{ record_id: string; error: string }>;
  duration_ms: number;
}

export interface DataTransformation {
  type: 'map' | 'filter' | 'transform' | 'validate';
  config: any;
}

export async function startSync(config: SyncConfig): Promise<string> {
  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      integration_id: config.integration_id,
      job_type: config.sync_mode === 'full' ? 'full_sync' : 'incremental',
      status: 'pending',
      metadata: {
        entity_type: config.entity_type,
        direction: config.direction,
      },
    })
    .select()
    .single();

  if (error || !job) {
    throw new Error(`Failed to create sync job: ${error?.message}`);
  }

  executeSyncJob(job.id, config).catch(err => {
    console.error('Sync job failed:', err);
    supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        error: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  });

  return job.id;
}

async function executeSyncJob(jobId: string, config: SyncConfig): Promise<void> {
  const startTime = Date.now();

  await supabase
    .from('sync_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  try {
    let result: SyncResult;

    if (config.direction === 'inbound') {
      result = await syncInbound(jobId, config);
    } else if (config.direction === 'outbound') {
      result = await syncOutbound(jobId, config);
    } else {
      const inboundResult = await syncInbound(jobId, config);
      const outboundResult = await syncOutbound(jobId, config);

      result = {
        job_id: jobId,
        records_processed: inboundResult.records_processed + outboundResult.records_processed,
        records_created: inboundResult.records_created + outboundResult.records_created,
        records_updated: inboundResult.records_updated + outboundResult.records_updated,
        records_failed: inboundResult.records_failed + outboundResult.records_failed,
        errors: [...inboundResult.errors, ...outboundResult.errors],
        duration_ms: Date.now() - startTime,
      };
    }

    await supabase
      .from('sync_jobs')
      .update({
        status: 'completed',
        records_processed: result.records_processed,
        records_failed: result.records_failed,
        completed_at: new Date().toISOString(),
        metadata: { result },
      })
      .eq('id', jobId);
  } catch (error: any) {
    await supabase
      .from('sync_jobs')
      .update({
        status: 'failed',
        error: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error;
  }
}

async function syncInbound(jobId: string, config: SyncConfig): Promise<SyncResult> {
  const records = await fetchExternalRecords(config);

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ record_id: string; error: string }> = [];

  for (const record of records) {
    try {
      const transformed = await transformRecord(record, config.field_mappings);
      const result = await upsertRecord(config.entity_type, transformed);

      if (result.created) created++;
      else updated++;
    } catch (error: any) {
      failed++;
      errors.push({
        record_id: record.id || 'unknown',
        error: error.message,
      });
    }
  }

  return {
    job_id: jobId,
    records_processed: records.length,
    records_created: created,
    records_updated: updated,
    records_failed: failed,
    errors,
    duration_ms: 0,
  };
}

async function syncOutbound(jobId: string, config: SyncConfig): Promise<SyncResult> {
  const records = await fetchLocalRecords(config);

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ record_id: string; error: string }> = [];

  for (const record of records) {
    try {
      const transformed = await transformRecord(record, config.field_mappings);
      await executeWithRateLimitAndRetry(
        config.integration_id,
        config.entity_type,
        () => pushToExternalSystem(config, transformed)
      );
      created++;
    } catch (error: any) {
      failed++;
      errors.push({
        record_id: record.id || 'unknown',
        error: error.message,
      });
    }
  }

  return {
    job_id: jobId,
    records_processed: records.length,
    records_created: created,
    records_updated: updated,
    records_failed: failed,
    errors,
    duration_ms: 0,
  };
}

async function fetchExternalRecords(config: SyncConfig): Promise<any[]> {
  return [];
}

async function fetchLocalRecords(config: SyncConfig): Promise<any[]> {
  const table = config.entity_type === 'prospect' ? 'prospects' : `${config.entity_type}s`;

  const { data, error } = await supabase.from(table).select('*').limit(1000);

  if (error) {
    throw new Error(`Failed to fetch local records: ${error.message}`);
  }

  return data || [];
}

async function pushToExternalSystem(config: SyncConfig, record: any): Promise<void> {
}

export async function transformRecord(
  record: any,
  mappings: FieldMapping[]
): Promise<any> {
  const transformed: any = {};

  for (const mapping of mappings) {
    let value = record[mapping.source_field];

    if (value === undefined || value === null) {
      if (mapping.is_required) {
        if (mapping.default_value !== undefined) {
          value = mapping.default_value;
        } else {
          throw new Error(`Required field ${mapping.source_field} is missing`);
        }
      } else {
        continue;
      }
    }

    if (mapping.transformation) {
      value = applyTransformation(value, mapping.transformation);
    }

    transformed[mapping.target_field] = value;
  }

  return transformed;
}

function applyTransformation(value: any, transformation: string): any {
  switch (transformation) {
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;

    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;

    case 'trim':
      return typeof value === 'string' ? value.trim() : value;

    case 'date_to_iso':
      return value instanceof Date ? value.toISOString() : value;

    case 'number_to_string':
      return typeof value === 'number' ? value.toString() : value;

    case 'string_to_number':
      return typeof value === 'string' ? parseFloat(value) : value;

    case 'boolean_to_string':
      return typeof value === 'boolean' ? value.toString() : value;

    case 'json_stringify':
      return JSON.stringify(value);

    case 'json_parse':
      return typeof value === 'string' ? JSON.parse(value) : value;

    default:
      return value;
  }
}

async function upsertRecord(
  entityType: string,
  record: any
): Promise<{ created: boolean }> {
  const table = entityType === 'prospect' ? 'prospects' : `${entityType}s`;

  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('email', record.email)
    .maybeSingle();

  if (existing) {
    await supabase.from(table).update(record).eq('id', existing.id);
    return { created: false };
  } else {
    await supabase.from(table).insert(record);
    return { created: true };
  }
}

export async function getSyncJobStatus(jobId: string): Promise<any> {
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get sync job status: ${error.message}`);
  }

  return data;
}

export async function cancelSyncJob(jobId: string): Promise<void> {
  await supabase
    .from('sync_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export function createFieldMapping(
  sourceField: string,
  targetField: string,
  options: Partial<FieldMapping> = {}
): FieldMapping {
  return {
    source_field: sourceField,
    target_field: targetField,
    transformation: options.transformation || 'none',
    default_value: options.default_value,
    is_required: options.is_required || false,
  };
}

export const COMMON_FIELD_MAPPINGS = {
  salesforce_to_revorph: [
    createFieldMapping('FirstName', 'first_name'),
    createFieldMapping('LastName', 'last_name'),
    createFieldMapping('Email', 'email'),
    createFieldMapping('Company', 'company'),
    createFieldMapping('Title', 'job_title'),
    createFieldMapping('Phone', 'phone'),
  ],
  hubspot_to_revorph: [
    createFieldMapping('firstname', 'first_name'),
    createFieldMapping('lastname', 'last_name'),
    createFieldMapping('email', 'email'),
    createFieldMapping('company', 'company'),
    createFieldMapping('jobtitle', 'job_title'),
    createFieldMapping('phone', 'phone'),
  ],
};

export async function scheduleRecurringSync(
  integrationId: string,
  config: SyncConfig,
  frequency: string
): Promise<void> {
  await supabase.from('team_integrations').update({
    sync_frequency: frequency,
    config: { ...config },
  }).eq('id', integrationId);
}
