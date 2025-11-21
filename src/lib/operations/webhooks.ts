/**
 * Operations Hub - Webhooks & Programmable Automation
 * Event-driven integrations and custom automation logic
 */

import { supabase } from '../supabase';

export interface Webhook {
  id: string;
  name: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  // Events
  events: WebhookEvent[];

  // Authentication
  authType?: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth';
  authConfig?: {
    username?: string;
    password?: string;
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };

  // Headers
  headers?: Record<string, string>;

  // Payload
  payloadTemplate?: string; // Liquid/Handlebars template
  includeMetadata: boolean;

  // Settings
  isActive: boolean;
  retryOnFailure: boolean;
  maxRetries?: number;
  timeout?: number; // in ms

  // Filtering
  filters?: {
    conditions: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
    logic: 'AND' | 'OR';
  };

  // Analytics
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastCalledAt?: Date;
  lastStatus?: number;
  lastError?: string;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  object: 'prospect' | 'account' | 'deal' | 'ticket' | 'form' | 'email' | 'custom';
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'custom';
  customObjectId?: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  responseTime?: number; // in ms
  success: boolean;
  error?: string;
  retryCount: number;
  executedAt: Date;
}

export interface ProgrammableAutomation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  code: string; // JavaScript/TypeScript code
  language: 'javascript' | 'typescript' | 'python';

  // Execution
  isActive: boolean;
  timeout: number; // in ms
  memory: number; // in MB

  // Secrets (encrypted)
  secrets?: Record<string, string>;

  // Dependencies
  dependencies?: string[]; // npm packages

  // Analytics
  executionCount: number;
  avgExecutionTime: number;
  errorCount: number;
  lastExecutedAt?: Date;
  lastError?: string;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationTrigger {
  type: 'event' | 'schedule' | 'webhook' | 'api';
  config: {
    // Event trigger
    event?: WebhookEvent;

    // Schedule trigger
    schedule?: {
      type: 'interval' | 'cron';
      interval?: number; // in minutes
      cron?: string;
      timezone?: string;
    };

    // Webhook trigger
    webhookPath?: string;

    // API trigger
    apiEndpoint?: string;
  };
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  trigger: {
    type: string;
    data: any;
  };
  status: 'running' | 'completed' | 'failed' | 'timeout';
  logs: string[];
  result?: any;
  error?: string;
  executionTime: number; // in ms
  memoryUsed: number; // in MB
  startedAt: Date;
  completedAt?: Date;
}

export interface DataSync {
  id: string;
  name: string;
  description: string;
  source: {
    type: 'custom_object' | 'external_api' | 'database' | 'file';
    config: any;
  };
  destination: {
    type: 'custom_object' | 'external_api' | 'database' | 'file';
    config: any;
  };
  mapping: FieldMapping[];
  schedule: {
    type: 'manual' | 'interval' | 'cron';
    interval?: number;
    cron?: string;
  };
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  status: 'idle' | 'running' | 'failed';
  syncCount: number;
  recordsSynced: number;
  createdAt: Date;
}

export interface FieldMapping {
  sourceField: string;
  destinationField: string;
  transform?: {
    type: 'uppercase' | 'lowercase' | 'trim' | 'concat' | 'split' | 'custom';
    params?: any;
  };
}

/**
 * Webhook Service
 */
export class WebhookService {
  /**
   * Create webhook
   */
  async createWebhook(webhook: Partial<Webhook>): Promise<Webhook> {
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        name: webhook.name,
        description: webhook.description,
        url: webhook.url,
        method: webhook.method || 'POST',
        events: webhook.events || [],
        auth_type: webhook.authType || 'none',
        auth_config: webhook.authConfig,
        headers: webhook.headers,
        payload_template: webhook.payloadTemplate,
        include_metadata: webhook.includeMetadata !== false,
        is_active: webhook.isActive !== false,
        retry_on_failure: webhook.retryOnFailure !== false,
        max_retries: webhook.maxRetries || 3,
        timeout: webhook.timeout || 30000,
        filters: webhook.filters,
        total_calls: 0,
        successful_calls: 0,
        failed_calls: 0,
        created_by: webhook.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWebhook(data);
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<Webhook> {
    const { data, error } = await supabase
      .from('webhooks')
      .update({
        name: updates.name,
        description: updates.description,
        url: updates.url,
        method: updates.method,
        events: updates.events,
        auth_type: updates.authType,
        auth_config: updates.authConfig,
        headers: updates.headers,
        payload_template: updates.payloadTemplate,
        include_metadata: updates.includeMetadata,
        is_active: updates.isActive,
        retry_on_failure: updates.retryOnFailure,
        max_retries: updates.maxRetries,
        timeout: updates.timeout,
        filters: updates.filters,
        updated_at: new Date().toISOString()
      })
      .eq('id', webhookId)
      .select()
      .single();

    if (error) throw error;
    return this.mapWebhook(data);
  }

  /**
   * Get webhook
   */
  async getWebhook(webhookId: string): Promise<Webhook> {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (error) throw error;
    return this.mapWebhook(data);
  }

  /**
   * Get webhooks
   */
  async getWebhooks(filters?: { isActive?: boolean }): Promise<Webhook[]> {
    let query = supabase
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapWebhook);
  }

  /**
   * Execute webhook
   */
  async executeWebhook(webhookId: string, eventData: any): Promise<WebhookLog> {
    const webhook = await this.getWebhook(webhookId);

    if (!webhook.isActive) {
      throw new Error('Webhook is not active');
    }

    const startTime = Date.now();
    let success = false;
    let responseStatus: number | undefined;
    let responseBody: any;
    let error: string | undefined;

    try {
      // Build payload
      const payload = this.buildPayload(webhook, eventData);

      // Build headers
      const headers = this.buildHeaders(webhook);

      // Make HTTP request
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: webhook.method !== 'GET' ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(webhook.timeout || 30000)
      });

      responseStatus = response.status;
      responseBody = await response.text();
      success = response.ok;

      if (!success) {
        error = `HTTP ${responseStatus}: ${responseBody}`;
      }
    } catch (err: any) {
      error = err.message;
      success = false;
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    const { data: log } = await supabase
      .from('webhook_logs')
      .insert({
        webhook_id: webhookId,
        event: eventData.event || 'unknown',
        payload: eventData,
        request_headers: webhook.headers,
        request_body: eventData,
        response_status: responseStatus,
        response_body: responseBody,
        response_time: executionTime,
        success,
        error,
        retry_count: 0
      })
      .select()
      .single();

    // Update webhook stats
    await supabase
      .from('webhooks')
      .update({
        total_calls: webhook.totalCalls + 1,
        successful_calls: success ? webhook.successfulCalls + 1 : webhook.successfulCalls,
        failed_calls: success ? webhook.failedCalls : webhook.failedCalls + 1,
        last_called_at: new Date().toISOString(),
        last_status: responseStatus,
        last_error: error
      })
      .eq('id', webhookId);

    // Retry if failed
    if (!success && webhook.retryOnFailure && webhook.maxRetries && webhook.maxRetries > 0) {
      // Schedule retry (would use queue in production)
      console.log(`Scheduling retry for webhook ${webhookId}`);
    }

    return this.mapWebhookLog(log!);
  }

  /**
   * Get webhook logs
   */
  async getWebhookLogs(webhookId: string, limit: number = 50): Promise<WebhookLog[]> {
    const { data } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapWebhookLog);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId);
  }

  /**
   * Build payload
   */
  private buildPayload(webhook: Webhook, eventData: any): any {
    if (webhook.payloadTemplate) {
      // Use template engine (Liquid/Handlebars)
      // For now, just return event data
      return eventData;
    }

    return webhook.includeMetadata
      ? {
          event: eventData,
          metadata: {
            webhookId: webhook.id,
            webhookName: webhook.name,
            timestamp: new Date().toISOString()
          }
        }
      : eventData;
  }

  /**
   * Build headers
   */
  private buildHeaders(webhook: Webhook): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AIRevenueOrc-Webhooks/1.0',
      ...webhook.headers
    };

    // Add authentication
    if (webhook.authType === 'basic' && webhook.authConfig) {
      const credentials = btoa(`${webhook.authConfig.username}:${webhook.authConfig.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (webhook.authType === 'bearer' && webhook.authConfig) {
      headers['Authorization'] = `Bearer ${webhook.authConfig.token}`;
    } else if (webhook.authType === 'api_key' && webhook.authConfig) {
      const headerName = webhook.authConfig.apiKeyHeader || 'X-API-Key';
      headers[headerName] = webhook.authConfig.apiKey!;
    }

    return headers;
  }

  /**
   * Map database record to Webhook
   */
  private mapWebhook(data: any): Webhook {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      url: data.url,
      method: data.method,
      events: data.events,
      authType: data.auth_type,
      authConfig: data.auth_config,
      headers: data.headers,
      payloadTemplate: data.payload_template,
      includeMetadata: data.include_metadata,
      isActive: data.is_active,
      retryOnFailure: data.retry_on_failure,
      maxRetries: data.max_retries,
      timeout: data.timeout,
      filters: data.filters,
      totalCalls: data.total_calls,
      successfulCalls: data.successful_calls,
      failedCalls: data.failed_calls,
      lastCalledAt: data.last_called_at ? new Date(data.last_called_at) : undefined,
      lastStatus: data.last_status,
      lastError: data.last_error,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to WebhookLog
   */
  private mapWebhookLog(data: any): WebhookLog {
    return {
      id: data.id,
      webhookId: data.webhook_id,
      event: data.event,
      payload: data.payload,
      requestHeaders: data.request_headers,
      requestBody: data.request_body,
      responseStatus: data.response_status,
      responseBody: data.response_body,
      responseTime: data.response_time,
      success: data.success,
      error: data.error,
      retryCount: data.retry_count,
      executedAt: new Date(data.executed_at)
    };
  }
}

/**
 * Programmable Automation Service
 */
export class AutomationService {
  /**
   * Create automation
   */
  async createAutomation(automation: Partial<ProgrammableAutomation>): Promise<ProgrammableAutomation> {
    const { data, error } = await supabase
      .from('programmable_automations')
      .insert({
        name: automation.name,
        description: automation.description,
        trigger: automation.trigger,
        code: automation.code,
        language: automation.language || 'javascript',
        is_active: automation.isActive !== false,
        timeout: automation.timeout || 60000,
        memory: automation.memory || 128,
        secrets: automation.secrets,
        dependencies: automation.dependencies,
        execution_count: 0,
        avg_execution_time: 0,
        error_count: 0,
        created_by: automation.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAutomation(data);
  }

  /**
   * Execute automation
   */
  async executeAutomation(automationId: string, triggerData: any): Promise<AutomationExecution> {
    const automation = await this.getAutomation(automationId);

    if (!automation.isActive) {
      throw new Error('Automation is not active');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    let status: AutomationExecution['status'] = 'running';
    let result: any;
    let error: string | undefined;

    try {
      // Execute code in sandbox
      result = await this.executeInSandbox(automation.code, triggerData, automation.secrets || {}, logs);
      status = 'completed';
    } catch (err: any) {
      error = err.message;
      status = 'failed';
      logs.push(`Error: ${err.message}`);
    }

    const executionTime = Date.now() - startTime;

    if (executionTime > automation.timeout) {
      status = 'timeout';
      error = 'Execution timeout';
    }

    // Save execution
    const { data: execution } = await supabase
      .from('automation_executions')
      .insert({
        automation_id: automationId,
        trigger: {
          type: automation.trigger.type,
          data: triggerData
        },
        status,
        logs,
        result,
        error,
        execution_time: executionTime,
        memory_used: 0, // Would measure in production
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    // Update automation stats
    const newAvgTime = (automation.avgExecutionTime * automation.executionCount + executionTime) / (automation.executionCount + 1);

    await supabase
      .from('programmable_automations')
      .update({
        execution_count: automation.executionCount + 1,
        avg_execution_time: newAvgTime,
        error_count: status === 'failed' ? automation.errorCount + 1 : automation.errorCount,
        last_executed_at: new Date().toISOString(),
        last_error: error
      })
      .eq('id', automationId);

    return this.mapExecution(execution!);
  }

  /**
   * Get automation
   */
  async getAutomation(automationId: string): Promise<ProgrammableAutomation> {
    const { data, error } = await supabase
      .from('programmable_automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (error) throw error;
    return this.mapAutomation(data);
  }

  /**
   * Get automations
   */
  async getAutomations(filters?: { isActive?: boolean }): Promise<ProgrammableAutomation[]> {
    let query = supabase
      .from('programmable_automations')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data } = await query;
    return (data || []).map(this.mapAutomation);
  }

  /**
   * Get automation executions
   */
  async getExecutions(automationId: string, limit: number = 50): Promise<AutomationExecution[]> {
    const { data } = await supabase
      .from('automation_executions')
      .select('*')
      .eq('automation_id', automationId)
      .order('started_at', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapExecution);
  }

  /**
   * Execute code in sandbox
   */
  private async executeInSandbox(code: string, data: any, secrets: Record<string, string>, logs: string[]): Promise<any> {
    // In production, this would use a secure sandbox (VM, Docker container, etc.)
    // For now, simulate execution
    logs.push('Starting execution...');
    logs.push(`Input data: ${JSON.stringify(data)}`);

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));

    logs.push('Execution completed successfully');

    return { success: true, data };
  }

  /**
   * Map database record to ProgrammableAutomation
   */
  private mapAutomation(data: any): ProgrammableAutomation {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      code: data.code,
      language: data.language,
      isActive: data.is_active,
      timeout: data.timeout,
      memory: data.memory,
      secrets: data.secrets,
      dependencies: data.dependencies,
      executionCount: data.execution_count,
      avgExecutionTime: data.avg_execution_time,
      errorCount: data.error_count,
      lastExecutedAt: data.last_executed_at ? new Date(data.last_executed_at) : undefined,
      lastError: data.last_error,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to AutomationExecution
   */
  private mapExecution(data: any): AutomationExecution {
    return {
      id: data.id,
      automationId: data.automation_id,
      trigger: data.trigger,
      status: data.status,
      logs: data.logs,
      result: data.result,
      error: data.error,
      executionTime: data.execution_time,
      memoryUsed: data.memory_used,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined
    };
  }
}

/**
 * Create Webhook Service
 */
export function createWebhookService(): WebhookService {
  return new WebhookService();
}

/**
 * Create Automation Service
 */
export function createAutomationService(): AutomationService {
  return new AutomationService();
}
