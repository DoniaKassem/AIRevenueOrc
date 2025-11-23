/**
 * Flow Engine Service
 * Executes integration workflows with support for various node types
 */

import { supabase } from './supabase';
import { trackApiCall } from './integrationAnalytics';

export type FlowNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'transform'
  | 'delay'
  | 'loop'
  | 'http_request';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string; // For conditional edges
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
  version: string;
}

export interface FlowExecutionContext {
  flowId: string;
  executionId: string;
  teamId: string;
  triggerData: any;
  variables: Record<string, any>;
  executionLog: Array<{
    nodeId: string;
    timestamp: string;
    status: 'running' | 'completed' | 'failed';
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
  }>;
}

export interface FlowExecutionResult {
  executionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  error?: string;
  output?: any;
  duration: number;
}

/**
 * Create a new flow
 */
export async function createFlow(
  teamId: string,
  name: string,
  description: string,
  triggerType: string,
  triggerConfig: any,
  flowDefinition: FlowDefinition,
  createdBy: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('integration_flows')
    .insert({
      team_id: teamId,
      name,
      description,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      flow_definition: flowDefinition,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating flow:', error);
    return null;
  }

  return data.id;
}

/**
 * Update an existing flow
 */
export async function updateFlow(
  flowId: string,
  updates: {
    name?: string;
    description?: string;
    triggerConfig?: any;
    flowDefinition?: FlowDefinition;
    isActive?: boolean;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('integration_flows')
    .update({
      ...updates,
      trigger_config: updates.triggerConfig,
      flow_definition: updates.flowDefinition,
      is_active: updates.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId);

  if (error) {
    console.error('Error updating flow:', error);
    return false;
  }

  return true;
}

/**
 * Delete a flow
 */
export async function deleteFlow(flowId: string): Promise<boolean> {
  const { error } = await supabase
    .from('integration_flows')
    .delete()
    .eq('id', flowId);

  if (error) {
    console.error('Error deleting flow:', error);
    return false;
  }

  return true;
}

/**
 * Get all flows for a team
 */
export async function getFlows(teamId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('integration_flows')
    .select(`
      *,
      trigger_integration:team_integrations(
        id,
        provider_key,
        integration_providers(name)
      ),
      created_by_user:profiles(
        id,
        full_name,
        email
      )
    `)
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching flows:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a single flow by ID
 */
export async function getFlow(flowId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('integration_flows')
    .select(`
      *,
      trigger_integration:team_integrations(
        id,
        provider_key,
        integration_providers(name)
      )
    `)
    .eq('id', flowId)
    .single();

  if (error) {
    console.error('Error fetching flow:', error);
    return null;
  }

  return data;
}

/**
 * Execute a flow
 */
export async function executeFlow(
  flowId: string,
  triggerData: any = {}
): Promise<FlowExecutionResult> {
  const startTime = Date.now();

  // Get flow definition
  const flow = await getFlow(flowId);
  if (!flow) {
    return {
      executionId: '',
      status: 'failed',
      error: 'Flow not found',
      duration: Date.now() - startTime,
    };
  }

  if (!flow.is_active) {
    return {
      executionId: '',
      status: 'failed',
      error: 'Flow is not active',
      duration: Date.now() - startTime,
    };
  }

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from('integration_flow_executions')
    .insert({
      flow_id: flowId,
      status: 'running',
      trigger_data: triggerData,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (execError || !execution) {
    return {
      executionId: '',
      status: 'failed',
      error: 'Failed to create execution record',
      duration: Date.now() - startTime,
    };
  }

  const context: FlowExecutionContext = {
    flowId,
    executionId: execution.id,
    teamId: flow.team_id,
    triggerData,
    variables: {},
    executionLog: [],
  };

  try {
    // Execute the flow
    const result = await executeFlowNodes(context, flow.flow_definition);

    // Update execution record
    await supabase
      .from('integration_flow_executions')
      .update({
        status: result.status,
        execution_log: context.executionLog,
        error_message: result.error,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      })
      .eq('id', execution.id);

    // Update flow execution count
    await supabase
      .from('integration_flows')
      .update({
        execution_count: flow.execution_count + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', flowId);

    return {
      ...result,
      executionId: execution.id,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('Flow execution error:', error);

    await supabase
      .from('integration_flow_executions')
      .update({
        status: 'failed',
        error_message: error.message,
        execution_log: context.executionLog,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      })
      .eq('id', execution.id);

    return {
      executionId: execution.id,
      status: 'failed',
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute all nodes in the flow definition
 */
async function executeFlowNodes(
  context: FlowExecutionContext,
  flowDefinition: FlowDefinition
): Promise<{ status: 'completed' | 'failed'; error?: string; output?: any }> {
  const { nodes, edges } = flowDefinition;

  // Find the trigger node (starting point)
  const triggerNode = nodes.find(n => n.type === 'trigger');
  if (!triggerNode) {
    return { status: 'failed', error: 'No trigger node found' };
  }

  // Execute nodes starting from trigger
  const visited = new Set<string>();
  let currentOutput = context.triggerData;

  const executeNode = async (nodeId: string, input: any): Promise<any> => {
    if (visited.has(nodeId)) {
      return input; // Prevent infinite loops
    }
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      return input;
    }

    const nodeStartTime = Date.now();

    try {
      context.executionLog.push({
        nodeId,
        timestamp: new Date().toISOString(),
        status: 'running',
        input,
      });

      let output: any;

      switch (node.type) {
        case 'trigger':
          output = input;
          break;

        case 'action':
          output = await executeActionNode(context, node, input);
          break;

        case 'condition':
          output = await executeConditionNode(context, node, input);
          break;

        case 'transform':
          output = await executeTransformNode(context, node, input);
          break;

        case 'delay':
          output = await executeDelayNode(context, node, input);
          break;

        case 'http_request':
          output = await executeHttpRequestNode(context, node, input);
          break;

        default:
          output = input;
      }

      const duration = Date.now() - nodeStartTime;

      // Update log entry
      const logIndex = context.executionLog.findIndex(
        l => l.nodeId === nodeId && l.status === 'running'
      );
      if (logIndex >= 0) {
        context.executionLog[logIndex] = {
          ...context.executionLog[logIndex],
          status: 'completed',
          output,
          duration,
        };
      }

      // Find next nodes
      const outgoingEdges = edges.filter(e => e.source === nodeId);

      for (const edge of outgoingEdges) {
        // Check condition if specified
        if (edge.condition) {
          const conditionMet = evaluateCondition(edge.condition, output, context.variables);
          if (!conditionMet) continue;
        }

        await executeNode(edge.target, output);
      }

      return output;
    } catch (error: any) {
      const duration = Date.now() - nodeStartTime;

      const logIndex = context.executionLog.findIndex(
        l => l.nodeId === nodeId && l.status === 'running'
      );
      if (logIndex >= 0) {
        context.executionLog[logIndex] = {
          ...context.executionLog[logIndex],
          status: 'failed',
          error: error.message,
          duration,
        };
      }

      throw error;
    }
  };

  try {
    currentOutput = await executeNode(triggerNode.id, context.triggerData);
    return { status: 'completed', output: currentOutput };
  } catch (error: any) {
    return { status: 'failed', error: error.message };
  }
}

/**
 * Execute an action node (e.g., create record, send email)
 */
async function executeActionNode(
  context: FlowExecutionContext,
  node: FlowNode,
  input: any
): Promise<any> {
  const { config } = node;
  const actionType = config.actionType;

  switch (actionType) {
    case 'create_prospect':
      return await createProspectAction(context, config, input);

    case 'update_deal':
      return await updateDealAction(context, config, input);

    case 'send_email':
      return await sendEmailAction(context, config, input);

    case 'create_activity':
      return await createActivityAction(context, config, input);

    case 'enrich_prospect':
      return await enrichProspectAction(context, config, input);

    case 'enrich_company':
      return await enrichCompanyAction(context, config, input);

    case 'extract_signals':
      return await extractSignalsAction(context, config, input);

    case 'linkedin_profile_view':
      return await linkedInProfileViewAction(context, config, input);

    case 'linkedin_connect':
      return await linkedInConnectAction(context, config, input);

    case 'linkedin_message':
      return await linkedInMessageAction(context, config, input);

    default:
      console.warn(`Unknown action type: ${actionType}`);
      return input;
  }
}

/**
 * Execute a condition node (branching logic)
 */
async function executeConditionNode(
  context: FlowExecutionContext,
  node: FlowNode,
  input: any
): Promise<any> {
  const { config } = node;
  const condition = config.condition;

  const result = evaluateCondition(condition, input, context.variables);
  return { ...input, conditionResult: result };
}

/**
 * Execute a transform node (data transformation)
 */
async function executeTransformNode(
  context: FlowExecutionContext,
  node: FlowNode,
  input: any
): Promise<any> {
  const { config } = node;
  const transformations = config.transformations || [];

  let output = { ...input };

  for (const transform of transformations) {
    const { field, operation, value } = transform;

    switch (operation) {
      case 'set':
        output[field] = value;
        break;
      case 'append':
        output[field] = (output[field] || '') + value;
        break;
      case 'uppercase':
        output[field] = String(output[field] || '').toUpperCase();
        break;
      case 'lowercase':
        output[field] = String(output[field] || '').toLowerCase();
        break;
      case 'replace':
        output[field] = String(output[field] || '').replace(
          new RegExp(value.from, 'g'),
          value.to
        );
        break;
    }
  }

  return output;
}

/**
 * Execute a delay node (wait for specified duration)
 */
async function executeDelayNode(
  context: FlowExecutionContext,
  node: FlowNode,
  input: any
): Promise<any> {
  const { config } = node;
  const delayMs = config.delayMs || 0;

  await new Promise(resolve => setTimeout(resolve, delayMs));
  return input;
}

/**
 * Execute an HTTP request node
 */
async function executeHttpRequestNode(
  context: FlowExecutionContext,
  node: FlowNode,
  input: any
): Promise<any> {
  const { config } = node;
  const { url, method = 'GET', headers = {}, body } = config;

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await response.json();
    const latency = Date.now() - startTime;

    // Track this as an API call
    await trackApiCall(
      context.teamId,
      context.flowId,
      response.ok,
      latency
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return responseData;
  } catch (error: any) {
    console.error('HTTP request failed:', error);
    throw error;
  }
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(
  condition: string,
  data: any,
  variables: Record<string, any>
): boolean {
  try {
    // Simple condition evaluation (can be enhanced with a proper expression parser)
    // Supports: field == value, field != value, field > value, etc.
    const operators = ['==', '!=', '>', '<', '>=', '<=', 'contains', 'exists'];

    for (const op of operators) {
      if (condition.includes(op)) {
        const [left, right] = condition.split(op).map(s => s.trim());

        const leftValue = getValueFromPath(left, data, variables);
        const rightValue = right.startsWith('{') ? getValueFromPath(right, data, variables) : right.replace(/['"]/g, '');

        switch (op) {
          case '==':
            return leftValue == rightValue;
          case '!=':
            return leftValue != rightValue;
          case '>':
            return Number(leftValue) > Number(rightValue);
          case '<':
            return Number(leftValue) < Number(rightValue);
          case '>=':
            return Number(leftValue) >= Number(rightValue);
          case '<=':
            return Number(leftValue) <= Number(rightValue);
          case 'contains':
            return String(leftValue).includes(String(rightValue));
          case 'exists':
            return leftValue !== undefined && leftValue !== null;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

/**
 * Get value from object path (e.g., "user.email")
 */
function getValueFromPath(
  path: string,
  data: any,
  variables: Record<string, any>
): any {
  // Remove curly braces if present
  path = path.replace(/[{}]/g, '');

  // Check if it's a variable reference
  if (path.startsWith('$')) {
    return variables[path.substring(1)];
  }

  // Navigate object path
  const parts = path.split('.');
  let value = data;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

// Action implementations

async function createProspectAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      team_id: context.teamId,
      first_name: config.firstName || input.firstName,
      last_name: config.lastName || input.lastName,
      email: config.email || input.email,
      company: config.company || input.company,
      title: config.title || input.title,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create prospect: ${error.message}`);
  return { ...input, prospect: data };
}

async function updateDealAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  const { data, error } = await supabase
    .from('deals')
    .update({
      stage: config.stage || input.stage,
      amount: config.amount || input.amount,
    })
    .eq('id', config.dealId || input.dealId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update deal: ${error.message}`);
  return { ...input, deal: data };
}

async function sendEmailAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  // This would integrate with your email sending service
  console.log('Sending email:', {
    to: config.to || input.email,
    subject: config.subject,
    body: config.body,
  });

  return { ...input, emailSent: true };
}

async function createActivityAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      team_id: context.teamId,
      prospect_id: config.prospectId || input.prospectId,
      type: config.activityType || 'note',
      description: config.description,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create activity: ${error.message}`);
  return { ...input, activity: data };
}

/**
 * Get flow execution history
 */
export async function getFlowExecutions(
  flowId: string,
  limit: number = 50
): Promise<any[]> {
  const { data, error } = await supabase
    .from('integration_flow_executions')
    .select('*')
    .eq('flow_id', flowId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching flow executions:', error);
    return [];
  }

  return data || [];
}

// =============================================
// NEW ENRICHMENT & LINKEDIN ACTIONS
// =============================================

/**
 * Enrich prospect with external data
 */
async function enrichProspectAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    // Dynamic import to avoid circular dependencies
    const { enrichProspectWorkflowAction } = await import('./enrichment/externalApiConnectors');

    const prospectId = config.prospectId || input.prospectId || input.prospect?.id;
    if (!prospectId) {
      throw new Error('No prospect ID provided for enrichment');
    }

    const results = await enrichProspectWorkflowAction(context.teamId, prospectId);

    return {
      ...input,
      enrichmentResults: results,
      prospectEnriched: true,
    };
  } catch (error: any) {
    console.error('Prospect enrichment action failed:', error);
    return { ...input, enrichmentError: error.message };
  }
}

/**
 * Enrich company with external data
 */
async function enrichCompanyAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    const { enrichCompanyWorkflowAction } = await import('./enrichment/externalApiConnectors');

    const companyProfileId = config.companyProfileId || input.companyProfileId || input.company?.id;
    const domain = config.domain || input.domain || input.company?.website;

    if (!companyProfileId || !domain) {
      throw new Error('No company ID or domain provided for enrichment');
    }

    const results = await enrichCompanyWorkflowAction(context.teamId, companyProfileId, domain);

    return {
      ...input,
      enrichmentResults: results,
      companyEnriched: true,
    };
  } catch (error: any) {
    console.error('Company enrichment action failed:', error);
    return { ...input, enrichmentError: error.message };
  }
}

/**
 * Extract intent signals from company data
 */
async function extractSignalsAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    const { extractSignalsWorkflowAction } = await import('./research/advancedSignalExtraction');

    const companyProfileId = config.companyProfileId || input.companyProfileId || input.company?.id;
    if (!companyProfileId) {
      throw new Error('No company ID provided for signal extraction');
    }

    const signalAnalysis = await extractSignalsWorkflowAction(context.teamId, companyProfileId);

    return {
      ...input,
      signalAnalysis,
      intentScore: signalAnalysis.overallIntentScore,
      recommendedAction: signalAnalysis.recommendedAction,
    };
  } catch (error: any) {
    console.error('Signal extraction action failed:', error);
    return { ...input, signalExtractionError: error.message };
  }
}

/**
 * View LinkedIn profile (track impression)
 */
async function linkedInProfileViewAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    const prospectId = config.prospectId || input.prospectId || input.prospect?.id;
    const linkedInUrl = config.linkedInUrl || input.linkedInUrl || input.prospect?.linkedin_url;

    if (!linkedInUrl) {
      throw new Error('No LinkedIn URL provided');
    }

    // Log LinkedIn activity
    await supabase.from('linkedin_activities').insert({
      team_id: context.teamId,
      prospect_id: prospectId,
      action_type: 'profile_view',
      target_url: linkedInUrl,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return {
      ...input,
      linkedInProfileViewed: true,
      linkedInUrl,
    };
  } catch (error: any) {
    console.error('LinkedIn profile view action failed:', error);
    return { ...input, linkedInError: error.message };
  }
}

/**
 * Send LinkedIn connection request
 */
async function linkedInConnectAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    const prospectId = config.prospectId || input.prospectId || input.prospect?.id;
    const linkedInUrl = config.linkedInUrl || input.linkedInUrl || input.prospect?.linkedin_url;
    const message = config.message || input.connectionMessage || '';

    if (!linkedInUrl) {
      throw new Error('No LinkedIn URL provided');
    }

    // Log LinkedIn activity
    await supabase.from('linkedin_activities').insert({
      team_id: context.teamId,
      prospect_id: prospectId,
      action_type: 'connection_request',
      target_url: linkedInUrl,
      message,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Update prospect status
    if (prospectId) {
      await supabase
        .from('prospects')
        .update({
          linkedin_connection_status: 'pending',
          linkedin_last_contacted_at: new Date().toISOString(),
        })
        .eq('id', prospectId);
    }

    return {
      ...input,
      linkedInConnectionSent: true,
      linkedInUrl,
    };
  } catch (error: any) {
    console.error('LinkedIn connection action failed:', error);
    return { ...input, linkedInError: error.message };
  }
}

/**
 * Send LinkedIn message
 */
async function linkedInMessageAction(
  context: FlowExecutionContext,
  config: any,
  input: any
): Promise<any> {
  try {
    const prospectId = config.prospectId || input.prospectId || input.prospect?.id;
    const linkedInUrl = config.linkedInUrl || input.linkedInUrl || input.prospect?.linkedin_url;
    const message = config.message || input.message || '';

    if (!linkedInUrl || !message) {
      throw new Error('LinkedIn URL and message are required');
    }

    // Log LinkedIn activity
    await supabase.from('linkedin_activities').insert({
      team_id: context.teamId,
      prospect_id: prospectId,
      action_type: 'message',
      target_url: linkedInUrl,
      message,
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Update prospect message count
    if (prospectId) {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('linkedin_message_count')
        .eq('id', prospectId)
        .single();

      await supabase
        .from('prospects')
        .update({
          linkedin_message_count: (prospect?.linkedin_message_count || 0) + 1,
          linkedin_last_contacted_at: new Date().toISOString(),
        })
        .eq('id', prospectId);
    }

    return {
      ...input,
      linkedInMessageSent: true,
      linkedInUrl,
    };
  } catch (error: any) {
    console.error('LinkedIn message action failed:', error);
    return { ...input, linkedInError: error.message };
  }
}
