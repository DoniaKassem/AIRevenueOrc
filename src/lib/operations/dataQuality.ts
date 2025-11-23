/**
 * Data Quality & Enrichment
 * Data validation, deduplication, enrichment, and quality scoring
 */

import { supabase } from '../supabase';

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  object: 'prospect' | 'account' | 'deal' | 'custom';
  ruleType: 'validation' | 'format' | 'completeness' | 'consistency' | 'accuracy';
  severity: 'error' | 'warning' | 'info';

  // Condition
  condition: {
    field: string;
    operator: 'is_empty' | 'is_not_empty' | 'matches_pattern' | 'not_matches_pattern' | 'equals' | 'not_equals';
    value?: any;
    pattern?: string;
  };

  // Action
  action: 'flag' | 'fix' | 'block' | 'notify';
  fixValue?: any;
  notifyUsers?: string[];

  isActive: boolean;
  violationCount: number;
  createdAt: Date;
}

export interface DataQualityViolation {
  id: string;
  ruleId: string;
  objectType: string;
  objectId: string;
  field: string;
  currentValue: any;
  suggestedValue?: any;
  severity: 'error' | 'warning' | 'info';
  status: 'open' | 'fixed' | 'ignored';
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface DuplicateDetection {
  id: string;
  object: 'prospect' | 'account' | 'deal';
  masterRecord: string;
  duplicateRecords: string[];
  matchScore: number; // 0-100
  matchFields: string[];
  status: 'pending' | 'merged' | 'ignored';
  mergedBy?: string;
  mergedAt?: Date;
  createdAt: Date;
}

export interface DataEnrichment {
  id: string;
  provider: 'clearbit' | 'fullcontact' | 'zoominfo' | 'apollo' | 'custom';
  object: 'prospect' | 'account';
  objectId: string;
  enrichedFields: string[];
  enrichedData: Record<string, any>;
  confidence: number; // 0-100
  cost: number;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  enrichedAt: Date;
}

export interface DataQualityScore {
  objectType: string;
  objectId: string;
  score: number; // 0-100
  breakdown: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
  };
  missingFields: string[];
  invalidFields: string[];
  lastCalculated: Date;
}

export interface DataCleaningJob {
  id: string;
  name: string;
  type: 'deduplicate' | 'validate' | 'enrich' | 'normalize' | 'custom';
  object: string;
  filters?: any;
  config: {
    rules?: string[]; // Rule IDs
    provider?: string; // For enrichment
    fields?: string[]; // Fields to process
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  recordsProcessed: number;
  recordsAffected: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  createdBy: string;
  createdAt: Date;
}

/**
 * Data Quality Service
 */
export class DataQualityService {
  /**
   * Create quality rule
   */
  async createRule(rule: Partial<DataQualityRule>): Promise<DataQualityRule> {
    const { data, error } = await supabase
      .from('data_quality_rules')
      .insert({
        name: rule.name,
        description: rule.description,
        object: rule.object,
        rule_type: rule.ruleType,
        severity: rule.severity || 'warning',
        condition: rule.condition,
        action: rule.action || 'flag',
        fix_value: rule.fixValue,
        notify_users: rule.notifyUsers,
        is_active: rule.isActive !== false,
        violation_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapRule(data);
  }

  /**
   * Run quality rules
   */
  async runQualityRules(objectType: string, objectId?: string): Promise<DataQualityViolation[]> {
    // Get active rules for this object type
    const { data: rules } = await supabase
      .from('data_quality_rules')
      .select('*')
      .eq('object', objectType)
      .eq('is_active', true);

    if (!rules || rules.length === 0) return [];

    // Get records to check
    let query = supabase.from(this.getTableName(objectType)).select('*');
    if (objectId) {
      query = query.eq('id', objectId);
    }

    const { data: records } = await query;
    if (!records) return [];

    const violations: DataQualityViolation[] = [];

    // Check each record against each rule
    for (const record of records) {
      for (const rule of rules) {
        const violation = this.checkRule(rule, record, objectType);
        if (violation) {
          violations.push(violation);

          // Save violation
          await supabase.from('data_quality_violations').insert({
            rule_id: rule.id,
            object_type: objectType,
            object_id: record.id,
            field: rule.condition.field,
            current_value: record[rule.condition.field],
            suggested_value: rule.fix_value,
            severity: rule.severity,
            status: 'open'
          });

          // Update rule violation count
          await supabase
            .from('data_quality_rules')
            .update({ violation_count: rule.violation_count + 1 })
            .eq('id', rule.id);
        }
      }
    }

    return violations;
  }

  /**
   * Get violations
   */
  async getViolations(filters?: {
    objectType?: string;
    objectId?: string;
    status?: DataQualityViolation['status'];
    severity?: DataQualityViolation['severity'];
    limit?: number;
  }): Promise<DataQualityViolation[]> {
    let query = supabase
      .from('data_quality_violations')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.objectType) {
      query = query.eq('object_type', filters.objectType);
    }

    if (filters?.objectId) {
      query = query.eq('object_id', filters.objectId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data } = await query;
    return (data || []).map(this.mapViolation);
  }

  /**
   * Fix violation
   */
  async fixViolation(violationId: string, userId: string): Promise<void> {
    const violation = await this.getViolation(violationId);

    if (violation.suggestedValue !== undefined) {
      // Apply fix
      await supabase
        .from(this.getTableName(violation.objectType))
        .update({ [violation.field]: violation.suggestedValue })
        .eq('id', violation.objectId);
    }

    // Mark as fixed
    await supabase
      .from('data_quality_violations')
      .update({
        status: 'fixed',
        resolved_by: userId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', violationId);
  }

  /**
   * Detect duplicates
   */
  async detectDuplicates(objectType: 'prospect' | 'account' | 'deal', config?: {
    matchFields?: string[];
    threshold?: number;
  }): Promise<DuplicateDetection[]> {
    const matchFields = config?.matchFields || this.getDefaultMatchFields(objectType);
    const threshold = config?.threshold || 80;

    // Get all records
    const { data: records } = await supabase
      .from(this.getTableName(objectType))
      .select('*');

    if (!records || records.length < 2) return [];

    const duplicates: DuplicateDetection[] = [];
    const processed = new Set<string>();

    // Compare each record with others
    for (let i = 0; i < records.length; i++) {
      if (processed.has(records[i].id)) continue;

      const matches: string[] = [];
      const masterRecord = records[i];

      for (let j = i + 1; j < records.length; j++) {
        if (processed.has(records[j].id)) continue;

        const score = this.calculateMatchScore(masterRecord, records[j], matchFields);

        if (score >= threshold) {
          matches.push(records[j].id);
          processed.add(records[j].id);
        }
      }

      if (matches.length > 0) {
        const duplicate: DuplicateDetection = {
          id: '',
          object: objectType,
          masterRecord: masterRecord.id,
          duplicateRecords: matches,
          matchScore: threshold,
          matchFields,
          status: 'pending',
          createdAt: new Date()
        };

        // Save duplicate detection
        const { data } = await supabase
          .from('duplicate_detections')
          .insert({
            object: objectType,
            master_record: masterRecord.id,
            duplicate_records: matches,
            match_score: threshold,
            match_fields: matchFields,
            status: 'pending'
          })
          .select()
          .single();

        if (data) {
          duplicates.push(this.mapDuplicate(data));
        }

        processed.add(masterRecord.id);
      }
    }

    return duplicates;
  }

  /**
   * Merge duplicates
   */
  async mergeDuplicates(detectionId: string, userId: string): Promise<void> {
    const detection = await this.getDuplicate(detectionId);

    // Get master record
    const { data: master } = await supabase
      .from(this.getTableName(detection.object))
      .select('*')
      .eq('id', detection.masterRecord)
      .single();

    if (!master) throw new Error('Master record not found');

    // Merge each duplicate into master
    for (const duplicateId of detection.duplicateRecords) {
      const { data: duplicate } = await supabase
        .from(this.getTableName(detection.object))
        .select('*')
        .eq('id', duplicateId)
        .single();

      if (!duplicate) continue;

      // Merge data (keep non-null values from duplicate)
      const mergedData = { ...master };
      for (const [key, value] of Object.entries(duplicate)) {
        if (value && !master[key]) {
          mergedData[key] = value;
        }
      }

      // Update master
      await supabase
        .from(this.getTableName(detection.object))
        .update(mergedData)
        .eq('id', detection.masterRecord);

      // Delete duplicate
      await supabase
        .from(this.getTableName(detection.object))
        .delete()
        .eq('id', duplicateId);
    }

    // Mark as merged
    await supabase
      .from('duplicate_detections')
      .update({
        status: 'merged',
        merged_by: userId,
        merged_at: new Date().toISOString()
      })
      .eq('id', detectionId);
  }

  /**
   * Enrich data
   */
  async enrichData(
    provider: DataEnrichment['provider'],
    objectType: 'prospect' | 'account',
    objectId: string
  ): Promise<DataEnrichment> {
    // Get record
    const { data: record } = await supabase
      .from(this.getTableName(objectType))
      .select('*')
      .eq('id', objectId)
      .single();

    if (!record) throw new Error('Record not found');

    // Call enrichment provider
    const enrichedData = await this.callEnrichmentProvider(provider, record);

    // Update record
    await supabase
      .from(this.getTableName(objectType))
      .update(enrichedData.data)
      .eq('id', objectId);

    // Save enrichment record
    const { data, error } = await supabase
      .from('data_enrichments')
      .insert({
        provider,
        object: objectType,
        object_id: objectId,
        enriched_fields: Object.keys(enrichedData.data),
        enriched_data: enrichedData.data,
        confidence: enrichedData.confidence,
        cost: enrichedData.cost,
        status: 'success'
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapEnrichment(data);
  }

  /**
   * Calculate quality score
   */
  async calculateQualityScore(objectType: string, objectId: string): Promise<DataQualityScore> {
    const { data: record } = await supabase
      .from(this.getTableName(objectType))
      .select('*')
      .eq('id', objectId)
      .single();

    if (!record) throw new Error('Record not found');

    const requiredFields = this.getRequiredFields(objectType);
    const allFields = Object.keys(record);

    // Completeness: % of required fields filled
    const filledFields = requiredFields.filter(f => record[f]).length;
    const completeness = (filledFields / requiredFields.length) * 100;

    // Validity: % of fields with valid values
    const invalidFields = await this.getInvalidFields(objectType, objectId);
    const validity = ((allFields.length - invalidFields.length) / allFields.length) * 100;

    // Accuracy: based on enrichment confidence
    const { data: enrichments } = await supabase
      .from('data_enrichments')
      .select('confidence')
      .eq('object', objectType)
      .eq('object_id', objectId);

    const accuracy = enrichments && enrichments.length > 0
      ? enrichments.reduce((sum, e) => sum + e.confidence, 0) / enrichments.length
      : 70; // Default

    // Consistency: no duplicates, no violations
    const consistency = 100; // Would calculate based on violations

    const score = (completeness + validity + accuracy + consistency) / 4;

    const qualityScore: DataQualityScore = {
      objectType,
      objectId,
      score: Math.round(score),
      breakdown: {
        completeness: Math.round(completeness),
        accuracy: Math.round(accuracy),
        consistency: Math.round(consistency),
        validity: Math.round(validity)
      },
      missingFields: requiredFields.filter(f => !record[f]),
      invalidFields,
      lastCalculated: new Date()
    };

    // Save score
    await supabase.from('data_quality_scores').upsert({
      object_type: objectType,
      object_id: objectId,
      score: qualityScore.score,
      breakdown: qualityScore.breakdown,
      missing_fields: qualityScore.missingFields,
      invalid_fields: qualityScore.invalidFields,
      last_calculated: qualityScore.lastCalculated.toISOString()
    });

    return qualityScore;
  }

  /**
   * Create cleaning job
   */
  async createCleaningJob(job: Partial<DataCleaningJob>): Promise<DataCleaningJob> {
    const { data, error } = await supabase
      .from('data_cleaning_jobs')
      .insert({
        name: job.name,
        type: job.type,
        object: job.object,
        filters: job.filters,
        config: job.config,
        status: 'pending',
        progress: 0,
        records_processed: 0,
        records_affected: 0,
        created_by: job.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCleaningJob(data);
  }

  /**
   * Check rule
   */
  private checkRule(rule: any, record: any, objectType: string): DataQualityViolation | null {
    const { condition } = rule;
    const fieldValue = record[condition.field];
    let violated = false;

    switch (condition.operator) {
      case 'is_empty':
        violated = !fieldValue || fieldValue === '';
        break;
      case 'is_not_empty':
        violated = !!fieldValue && fieldValue !== '';
        break;
      case 'matches_pattern':
        violated = condition.pattern && !new RegExp(condition.pattern).test(String(fieldValue));
        break;
      case 'not_matches_pattern':
        violated = condition.pattern && new RegExp(condition.pattern).test(String(fieldValue));
        break;
      case 'equals':
        violated = fieldValue === condition.value;
        break;
      case 'not_equals':
        violated = fieldValue !== condition.value;
        break;
    }

    if (violated) {
      return {
        id: '',
        ruleId: rule.id,
        objectType,
        objectId: record.id,
        field: condition.field,
        currentValue: fieldValue,
        suggestedValue: rule.fix_value,
        severity: rule.severity,
        status: 'open',
        createdAt: new Date()
      };
    }

    return null;
  }

  /**
   * Calculate match score
   */
  private calculateMatchScore(record1: any, record2: any, fields: string[]): number {
    let matches = 0;
    let total = 0;

    for (const field of fields) {
      const val1 = String(record1[field] || '').toLowerCase().trim();
      const val2 = String(record2[field] || '').toLowerCase().trim();

      if (!val1 || !val2) continue;

      total++;

      if (val1 === val2) {
        matches++;
      } else if (this.isSimilar(val1, val2)) {
        matches += 0.8; // Partial match
      }
    }

    return total > 0 ? (matches / total) * 100 : 0;
  }

  /**
   * Check similarity
   */
  private isSimilar(str1: string, str2: string): boolean {
    // Simple Levenshtein distance check
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return true;

    const distance = this.levenshteinDistance(str1, str2);
    const similarity = 1 - distance / maxLength;

    return similarity > 0.8;
  }

  /**
   * Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Call enrichment provider
   */
  private async callEnrichmentProvider(provider: string, record: any): Promise<{
    data: Record<string, any>;
    confidence: number;
    cost: number;
  }> {
    // In production, this would call actual API
    // For now, return mock data
    return {
      data: {
        industry: 'Technology',
        employee_count: 100,
        annual_revenue: 5000000
      },
      confidence: 85,
      cost: 0.01
    };
  }

  /**
   * Get required fields
   */
  private getRequiredFields(objectType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      prospect: ['email', 'first_name', 'last_name'],
      account: ['name', 'industry'],
      deal: ['name', 'amount', 'stage']
    };
    return fieldMap[objectType] || [];
  }

  /**
   * Get invalid fields
   */
  private async getInvalidFields(objectType: string, objectId: string): Promise<string[]> {
    const { data: violations } = await supabase
      .from('data_quality_violations')
      .select('field')
      .eq('object_type', objectType)
      .eq('object_id', objectId)
      .eq('status', 'open');

    return violations?.map(v => v.field) || [];
  }

  /**
   * Get default match fields
   */
  private getDefaultMatchFields(objectType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      prospect: ['email', 'first_name', 'last_name'],
      account: ['name', 'domain', 'phone'],
      deal: ['name', 'account_id']
    };
    return fieldMap[objectType] || ['name'];
  }

  /**
   * Get table name
   */
  private getTableName(objectType: string): string {
    const tableMap: Record<string, string> = {
      prospect: 'prospects',
      account: 'accounts',
      deal: 'deals'
    };
    return tableMap[objectType] || objectType;
  }

  /**
   * Get violation
   */
  private async getViolation(violationId: string): Promise<DataQualityViolation> {
    const { data, error } = await supabase
      .from('data_quality_violations')
      .select('*')
      .eq('id', violationId)
      .single();

    if (error) throw error;
    return this.mapViolation(data);
  }

  /**
   * Get duplicate
   */
  private async getDuplicate(detectionId: string): Promise<DuplicateDetection> {
    const { data, error } = await supabase
      .from('duplicate_detections')
      .select('*')
      .eq('id', detectionId)
      .single();

    if (error) throw error;
    return this.mapDuplicate(data);
  }

  /**
   * Map database record to DataQualityRule
   */
  private mapRule(data: any): DataQualityRule {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      object: data.object,
      ruleType: data.rule_type,
      severity: data.severity,
      condition: data.condition,
      action: data.action,
      fixValue: data.fix_value,
      notifyUsers: data.notify_users,
      isActive: data.is_active,
      violationCount: data.violation_count,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to DataQualityViolation
   */
  private mapViolation(data: any): DataQualityViolation {
    return {
      id: data.id,
      ruleId: data.rule_id,
      objectType: data.object_type,
      objectId: data.object_id,
      field: data.field,
      currentValue: data.current_value,
      suggestedValue: data.suggested_value,
      severity: data.severity,
      status: data.status,
      resolvedBy: data.resolved_by,
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to DuplicateDetection
   */
  private mapDuplicate(data: any): DuplicateDetection {
    return {
      id: data.id,
      object: data.object,
      masterRecord: data.master_record,
      duplicateRecords: data.duplicate_records,
      matchScore: data.match_score,
      matchFields: data.match_fields,
      status: data.status,
      mergedBy: data.merged_by,
      mergedAt: data.merged_at ? new Date(data.merged_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }

  /**
   * Map database record to DataEnrichment
   */
  private mapEnrichment(data: any): DataEnrichment {
    return {
      id: data.id,
      provider: data.provider,
      object: data.object,
      objectId: data.object_id,
      enrichedFields: data.enriched_fields,
      enrichedData: data.enriched_data,
      confidence: data.confidence,
      cost: data.cost,
      status: data.status,
      error: data.error,
      enrichedAt: new Date(data.enriched_at)
    };
  }

  /**
   * Map database record to DataCleaningJob
   */
  private mapCleaningJob(data: any): DataCleaningJob {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      object: data.object,
      filters: data.filters,
      config: data.config,
      status: data.status,
      progress: data.progress,
      recordsProcessed: data.records_processed,
      recordsAffected: data.records_affected,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      error: data.error,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Data Quality Service
 */
export function createDataQualityService(): DataQualityService {
  return new DataQualityService();
}
