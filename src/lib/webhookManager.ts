import { supabase } from './supabase';
import crypto from 'crypto';

export interface WebhookEndpoint {
  id: string;
  team_id: string;
  integration_id?: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'inactive';
  last_triggered_at?: string;
  created_at: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  metadata?: any;
}

export interface WebhookDeliveryResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
  processing_time_ms: number;
}

export async function registerWebhook(
  teamId: string,
  integrationId: string | null,
  url: string,
  events: string[]
): Promise<WebhookEndpoint> {
  const secret = generateWebhookSecret();

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      team_id: teamId,
      integration_id: integrationId,
      url,
      secret,
      events,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register webhook: ${error.message}`);
  }

  return data;
}

export async function updateWebhook(
  webhookId: string,
  updates: Partial<{
    url: string;
    events: string[];
    status: 'active' | 'inactive';
  }>
): Promise<void> {
  const { error } = await supabase
    .from('webhook_endpoints')
    .update(updates)
    .eq('id', webhookId);

  if (error) {
    throw new Error(`Failed to update webhook: ${error.message}`);
  }
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', webhookId);

  if (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}

export async function listWebhooks(
  teamId: string,
  integrationId?: string
): Promise<WebhookEndpoint[]> {
  let query = supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('team_id', teamId);

  if (integrationId) {
    query = query.eq('integration_id', integrationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }

  return data || [];
}

export async function triggerWebhook(
  webhookId: string,
  event: string,
  data: any,
  metadata?: any
): Promise<WebhookDeliveryResult> {
  const { data: webhook, error: webhookError } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('id', webhookId)
    .single();

  if (webhookError || !webhook) {
    return {
      success: false,
      error: 'Webhook not found',
      processing_time_ms: 0,
    };
  }

  if (webhook.status !== 'active') {
    return {
      success: false,
      error: 'Webhook is inactive',
      processing_time_ms: 0,
    };
  }

  if (!webhook.events.includes(event) && !webhook.events.includes('*')) {
    return {
      success: false,
      error: `Event ${event} not subscribed`,
      processing_time_ms: 0,
    };
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    metadata,
  };

  const startTime = Date.now();
  const result = await deliverWebhook(webhook.url, payload, webhook.secret);
  const processingTime = Date.now() - startTime;

  await logWebhookDelivery(webhookId, event, payload, result, processingTime);

  await supabase
    .from('webhook_endpoints')
    .update({ last_triggered_at: new Date().toISOString() })
    .eq('id', webhookId);

  return {
    ...result,
    processing_time_ms: processingTime,
  };
}

async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string
): Promise<Omit<WebhookDeliveryResult, 'processing_time_ms'>> {
  try {
    const signature = generateWebhookSignature(payload, secret);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': payload.timestamp,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();

    return {
      success: response.ok,
      status_code: response.status,
      response_body: responseBody.substring(0, 1000),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function logWebhookDelivery(
  webhookId: string,
  eventType: string,
  payload: WebhookPayload,
  result: Omit<WebhookDeliveryResult, 'processing_time_ms'>,
  processingTimeMs: number
): Promise<void> {
  await supabase.from('webhook_logs').insert({
    webhook_id: webhookId,
    event_type: eventType,
    payload,
    response_status: result.status_code,
    response_body: result.response_body,
    processing_time_ms: processingTimeMs,
    error: result.error,
  });
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string
): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function retryFailedWebhooks(
  webhookId: string,
  maxRetries: number = 3
): Promise<{ successful: number; failed: number }> {
  const { data: failedLogs, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('webhook_id', webhookId)
    .is('response_status', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !failedLogs) {
    return { successful: 0, failed: 0 };
  }

  let successful = 0;
  let failed = 0;

  for (const log of failedLogs) {
    const result = await triggerWebhook(
      webhookId,
      log.event_type,
      log.payload.data,
      log.payload.metadata
    );

    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return { successful, failed };
}

export async function getWebhookStats(
  webhookId: string,
  since?: Date
): Promise<{
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  avg_processing_time_ms: number;
  error_rate: number;
}> {
  let query = supabase
    .from('webhook_logs')
    .select('response_status, processing_time_ms')
    .eq('webhook_id', webhookId);

  if (since) {
    query = query.gte('created_at', since.toISOString());
  }

  const { data: logs, error } = await query;

  if (error || !logs) {
    return {
      total_deliveries: 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      avg_processing_time_ms: 0,
      error_rate: 0,
    };
  }

  const total = logs.length;
  const successful = logs.filter(
    log => log.response_status && log.response_status >= 200 && log.response_status < 300
  ).length;
  const failed = total - successful;

  const avgProcessingTime =
    logs.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / Math.max(total, 1);

  const errorRate = total > 0 ? failed / total : 0;

  return {
    total_deliveries: total,
    successful_deliveries: successful,
    failed_deliveries: failed,
    avg_processing_time_ms: Math.round(avgProcessingTime),
    error_rate: Math.round(errorRate * 100) / 100,
  };
}

export const WEBHOOK_EVENTS = {
  PROSPECT_CREATED: 'prospect.created',
  PROSPECT_UPDATED: 'prospect.updated',
  PROSPECT_DELETED: 'prospect.deleted',
  DEAL_CREATED: 'deal.created',
  DEAL_UPDATED: 'deal.updated',
  DEAL_WON: 'deal.won',
  DEAL_LOST: 'deal.lost',
  ACTIVITY_CREATED: 'activity.created',
  EMAIL_SENT: 'email.sent',
  EMAIL_OPENED: 'email.opened',
  EMAIL_CLICKED: 'email.clicked',
  EMAIL_REPLIED: 'email.replied',
  MEETING_SCHEDULED: 'meeting.scheduled',
  CADENCE_COMPLETED: 'cadence.completed',
  INTEGRATION_CONNECTED: 'integration.connected',
  INTEGRATION_ERROR: 'integration.error',
  ALL: '*',
};

export function buildWebhookPayload(
  event: string,
  entityType: string,
  entity: any,
  changes?: any
): WebhookPayload {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      entity_type: entityType,
      entity_id: entity.id,
      entity,
      changes,
    },
    metadata: {
      source: 'revorph',
      version: '1.0',
    },
  };
}
