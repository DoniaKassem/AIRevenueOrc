/**
 * Marketing Automation
 * Workflow engine for automated marketing nurturing and actions
 */

import { supabase } from '../supabase';
import { createMarketingCampaigns } from './campaigns';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'archived';

  // Trigger
  trigger: WorkflowTrigger;

  // Actions
  actions: WorkflowAction[];

  // Settings
  allowMultipleEnrollments: boolean;
  removeOnGoalAchievement: boolean;
  goalCriteria?: SegmentCriteria;

  // Stats
  stats: {
    enrolled: number;
    active: number;
    completed: number;
    goalAchieved: number;
  };

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type:
    | 'contact_created'
    | 'form_submitted'
    | 'page_visited'
    | 'email_opened'
    | 'email_clicked'
    | 'list_membership'
    | 'property_changed'
    | 'deal_stage_changed'
    | 'scheduled';

  config: {
    formId?: string;
    pageUrl?: string;
    campaignId?: string;
    listId?: string;
    propertyName?: string;
    propertyValue?: any;
    dealStage?: string;
    scheduleTime?: string; // cron expression
  };

  filters?: SegmentCriteria;
}

export interface WorkflowAction {
  id: string;
  type:
    | 'send_email'
    | 'delay'
    | 'if_then_branch'
    | 'update_property'
    | 'add_to_list'
    | 'remove_from_list'
    | 'create_task'
    | 'send_notification'
    | 'webhook'
    | 'ai_action';

  config: any; // Type-specific configuration

  // Branching
  nextAction?: string; // ID of next action
  branchActions?: {
    yes?: string; // Action ID for "yes" branch
    no?: string; // Action ID for "no" branch
  };
}

export interface WorkflowEnrollment {
  id: string;
  workflowId: string;
  prospectId: string;
  status: 'active' | 'completed' | 'removed';
  currentActionId?: string;
  enrolledAt: Date;
  completedAt?: Date;
}

export interface SegmentCriteria {
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  logic: 'AND' | 'OR';
}

/**
 * Marketing Automation Service
 */
export class MarketingAutomation {
  private campaigns = createMarketingCampaigns();

  /**
   * Create workflow
   */
  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    const { data, error } = await supabase
      .from('marketing_workflows')
      .insert({
        name: workflow.name,
        description: workflow.description,
        status: 'paused', // Start paused
        trigger: workflow.trigger,
        actions: workflow.actions,
        allow_multiple_enrollments: workflow.allowMultipleEnrollments || false,
        remove_on_goal_achievement: workflow.removeOnGoalAchievement || false,
        goal_criteria: workflow.goalCriteria,
        stats: {
          enrolled: 0,
          active: 0,
          completed: 0,
          goalAchieved: 0
        }
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapWorkflow(data);
  }

  /**
   * Update workflow
   */
  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const { data, error} = await supabase
      .from('marketing_workflows')
      .update({
        name: updates.name,
        description: updates.description,
        trigger: updates.trigger,
        actions: updates.actions,
        allow_multiple_enrollments: updates.allowMultipleEnrollments,
        remove_on_goal_achievement: updates.removeOnGoalAchievement,
        goal_criteria: updates.goalCriteria,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
      .select()
      .single();

    if (error) throw error;
    return this.mapWorkflow(data);
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(workflowId: string): Promise<void> {
    await supabase
      .from('marketing_workflows')
      .update({ status: 'active' })
      .eq('id', workflowId);
  }

  /**
   * Pause workflow
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    await supabase
      .from('marketing_workflows')
      .update({ status: 'paused' })
      .eq('id', workflowId);
  }

  /**
   * Enroll contact in workflow
   */
  async enrollContact(workflowId: string, prospectId: string): Promise<WorkflowEnrollment> {
    // Get workflow
    const { data: workflow } = await supabase
      .from('marketing_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (!workflow || workflow.status !== 'active') {
      throw new Error('Workflow is not active');
    }

    // Check if already enrolled
    if (!workflow.allow_multiple_enrollments) {
      const { data: existing } = await supabase
        .from('workflow_enrollments')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('prospect_id', prospectId)
        .eq('status', 'active')
        .single();

      if (existing) {
        throw new Error('Contact already enrolled in this workflow');
      }
    }

    // Create enrollment
    const { data: enrollment, error } = await supabase
      .from('workflow_enrollments')
      .insert({
        workflow_id: workflowId,
        prospect_id: prospectId,
        status: 'active',
        current_action_id: workflow.actions[0]?.id,
        enrolled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update workflow stats
    await this.updateWorkflowStats(workflowId, { enrolled: 1, active: 1 });

    // Start executing actions
    await this.executeNextAction(enrollment.id);

    return {
      id: enrollment.id,
      workflowId: enrollment.workflow_id,
      prospectId: enrollment.prospect_id,
      status: enrollment.status,
      currentActionId: enrollment.current_action_id,
      enrolledAt: new Date(enrollment.enrolled_at)
    };
  }

  /**
   * Execute next action in workflow
   */
  async executeNextAction(enrollmentId: string): Promise<void> {
    // Get enrollment
    const { data: enrollment } = await supabase
      .from('workflow_enrollments')
      .select('*, marketing_workflows(*)')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment || enrollment.status !== 'active') {
      return;
    }

    const workflow = enrollment.marketing_workflows;
    const currentAction = workflow.actions.find(
      (a: WorkflowAction) => a.id === enrollment.current_action_id
    );

    if (!currentAction) {
      // Workflow complete
      await this.completeEnrollment(enrollmentId);
      return;
    }

    // Execute action
    const nextActionId = await this.executeAction(
      currentAction,
      enrollment.prospect_id,
      enrollment.workflow_id
    );

    if (nextActionId) {
      // Update enrollment to next action
      await supabase
        .from('workflow_enrollments')
        .update({ current_action_id: nextActionId })
        .eq('id', enrollmentId);

      // Continue execution (with small delay to prevent infinite loops)
      setTimeout(() => this.executeNextAction(enrollmentId), 1000);
    } else {
      // No next action, workflow complete
      await this.completeEnrollment(enrollmentId);
    }
  }

  /**
   * Execute a single workflow action
   */
  private async executeAction(
    action: WorkflowAction,
    prospectId: string,
    workflowId: string
  ): Promise<string | null> {
    switch (action.type) {
      case 'send_email':
        await this.executeSendEmail(action, prospectId);
        return action.nextAction || null;

      case 'delay':
        await this.executeDelay(action, prospectId, workflowId);
        return action.nextAction || null;

      case 'if_then_branch':
        const branch = await this.executeIfThenBranch(action, prospectId);
        return branch === 'yes' ? action.branchActions?.yes || null : action.branchActions?.no || null;

      case 'update_property':
        await this.executeUpdateProperty(action, prospectId);
        return action.nextAction || null;

      case 'add_to_list':
        await this.executeAddToList(action, prospectId);
        return action.nextAction || null;

      case 'remove_from_list':
        await this.executeRemoveFromList(action, prospectId);
        return action.nextAction || null;

      case 'create_task':
        await this.executeCreateTask(action, prospectId);
        return action.nextAction || null;

      case 'webhook':
        await this.executeWebhook(action, prospectId);
        return action.nextAction || null;

      default:
        return action.nextAction || null;
    }
  }

  /**
   * Execute: Send Email
   */
  private async executeSendEmail(action: WorkflowAction, prospectId: string): Promise<void> {
    const { templateId, subject, content } = action.config;

    // Get prospect
    const { data: prospect } = await supabase
      .from('prospects')
      .select('email, first_name, last_name')
      .eq('id', prospectId)
      .single();

    if (!prospect?.email) return;

    // Replace variables in content
    let finalContent = content;
    finalContent = finalContent.replace(/{{firstName}}/g, prospect.first_name || '');
    finalContent = finalContent.replace(/{{lastName}}/g, prospect.last_name || '');

    // Queue email
    await supabase.from('workflow_emails').insert({
      prospect_id: prospectId,
      subject,
      html_content: finalContent,
      status: 'queued',
      queued_at: new Date().toISOString()
    });
  }

  /**
   * Execute: Delay
   */
  private async executeDelay(action: WorkflowAction, prospectId: string, workflowId: string): Promise<void> {
    const { amount, unit } = action.config; // amount: number, unit: 'minutes' | 'hours' | 'days'

    let delayMs = 0;
    if (unit === 'minutes') delayMs = amount * 60 * 1000;
    else if (unit === 'hours') delayMs = amount * 60 * 60 * 1000;
    else if (unit === 'days') delayMs = amount * 24 * 60 * 60 * 1000;

    // Schedule next action execution
    const executeAt = new Date(Date.now() + delayMs);

    await supabase.from('workflow_scheduled_actions').insert({
      workflow_id: workflowId,
      prospect_id: prospectId,
      action_id: action.id,
      execute_at: executeAt.toISOString()
    });
  }

  /**
   * Execute: If/Then Branch
   */
  private async executeIfThenBranch(action: WorkflowAction, prospectId: string): Promise<'yes' | 'no'> {
    const { criteria } = action.config;

    // Get prospect
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    if (!prospect) return 'no';

    // Evaluate criteria
    const result = this.evaluateCriteria(prospect, criteria);
    return result ? 'yes' : 'no';
  }

  /**
   * Execute: Update Property
   */
  private async executeUpdateProperty(action: WorkflowAction, prospectId: string): Promise<void> {
    const { propertyName, propertyValue } = action.config;

    await supabase
      .from('prospects')
      .update({ [propertyName]: propertyValue })
      .eq('id', prospectId);
  }

  /**
   * Execute: Add to List
   */
  private async executeAddToList(action: WorkflowAction, prospectId: string): Promise<void> {
    const { listId } = action.config;

    await supabase
      .from('contact_list_members')
      .insert({
        list_id: listId,
        prospect_id: prospectId
      })
      .onConflict('list_id,prospect_id')
      .ignore();
  }

  /**
   * Execute: Remove from List
   */
  private async executeRemoveFromList(action: WorkflowAction, prospectId: string): Promise<void> {
    const { listId } = action.config;

    await supabase
      .from('contact_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('prospect_id', prospectId);
  }

  /**
   * Execute: Create Task
   */
  private async executeCreateTask(action: WorkflowAction, prospectId: string): Promise<void> {
    const { title, description, assigneeId, dueDate } = action.config;

    await supabase.from('bdr_activities').insert({
      prospect_id: prospectId,
      user_id: assigneeId,
      activity_type: 'task',
      subject: title,
      notes: description,
      due_date: dueDate,
      status: 'pending'
    });
  }

  /**
   * Execute: Webhook
   */
  private async executeWebhook(action: WorkflowAction, prospectId: string): Promise<void> {
    const { url, method, headers, body } = action.config;

    // Get prospect data
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single();

    // Replace variables in body
    let finalBody = JSON.stringify(body);
    finalBody = finalBody.replace(/{{prospectId}}/g, prospectId);
    if (prospect) {
      finalBody = finalBody.replace(/{{email}}/g, prospect.email || '');
      finalBody = finalBody.replace(/{{firstName}}/g, prospect.first_name || '');
    }

    // Make request
    await fetch(url, {
      method: method || 'POST',
      headers: headers || { 'Content-Type': 'application/json' },
      body: finalBody
    });
  }

  /**
   * Complete enrollment
   */
  private async completeEnrollment(enrollmentId: string): Promise<void> {
    const { data: enrollment } = await supabase
      .from('workflow_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (enrollment) {
      await this.updateWorkflowStats(enrollment.workflow_id, {
        active: -1,
        completed: 1
      });
    }
  }

  /**
   * Remove contact from workflow
   */
  async removeFromWorkflow(enrollmentId: string): Promise<void> {
    const { data: enrollment } = await supabase
      .from('workflow_enrollments')
      .update({ status: 'removed' })
      .eq('id', enrollmentId)
      .select()
      .single();

    if (enrollment) {
      await this.updateWorkflowStats(enrollment.workflow_id, { active: -1 });
    }
  }

  /**
   * Evaluate criteria against prospect data
   */
  private evaluateCriteria(prospect: any, criteria: SegmentCriteria): boolean {
    const results = criteria.conditions.map(condition => {
      const value = prospect[condition.field];

      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'not_equals':
          return value !== condition.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        case 'is_empty':
          return !value || value === '';
        case 'is_not_empty':
          return !!value && value !== '';
        default:
          return false;
      }
    });

    return criteria.logic === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Update workflow statistics
   */
  private async updateWorkflowStats(
    workflowId: string,
    changes: { enrolled?: number; active?: number; completed?: number; goalAchieved?: number }
  ): Promise<void> {
    const { data: workflow } = await supabase
      .from('marketing_workflows')
      .select('stats')
      .eq('id', workflowId)
      .single();

    if (workflow) {
      const newStats = {
        enrolled: workflow.stats.enrolled + (changes.enrolled || 0),
        active: workflow.stats.active + (changes.active || 0),
        completed: workflow.stats.completed + (changes.completed || 0),
        goalAchieved: workflow.stats.goalAchieved + (changes.goalAchieved || 0)
      };

      await supabase
        .from('marketing_workflows')
        .update({ stats: newStats })
        .eq('id', workflowId);
    }
  }

  /**
   * Get workflow
   */
  async getWorkflow(workflowId: string): Promise<Workflow> {
    const { data, error } = await supabase
      .from('marketing_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error) throw error;
    return this.mapWorkflow(data);
  }

  /**
   * Get all workflows
   */
  async getWorkflows(filters?: {
    status?: Workflow['status'];
    limit?: number;
  }): Promise<Workflow[]> {
    let query = supabase
      .from('marketing_workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data } = await query;
    return (data || []).map(this.mapWorkflow);
  }

  /**
   * Map database record to Workflow
   */
  private mapWorkflow(data: any): Workflow {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status,
      trigger: data.trigger,
      actions: data.actions,
      allowMultipleEnrollments: data.allow_multiple_enrollments,
      removeOnGoalAchievement: data.remove_on_goal_achievement,
      goalCriteria: data.goal_criteria,
      stats: data.stats,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

/**
 * Create Marketing Automation Service
 */
export function createMarketingAutomation(): MarketingAutomation {
  return new MarketingAutomation();
}
