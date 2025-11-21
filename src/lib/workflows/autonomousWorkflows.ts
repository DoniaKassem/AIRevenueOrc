/**
 * Autonomous BDR Workflow Definitions
 * Pre-built sequences for common outreach scenarios
 */

export interface WorkflowStep {
  stepNumber: number;
  action: 'research' | 'engage' | 'follow_up' | 'qualify' | 'handoff' | 'wait' | 'decision';
  delayDays?: number;
  conditions?: WorkflowCondition[];
  config?: Record<string, any>;
  nextSteps?: {
    if: string; // Condition expression
    then: number; // Step number to jump to
  }[];
}

export interface WorkflowCondition {
  type: 'response_received' | 'intent_threshold' | 'qualification_score' | 'contact_count' | 'time_elapsed';
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggerType: 'manual' | 'intent_score' | 'new_prospect' | 'status_change';
  triggerConditions?: WorkflowCondition[];
  steps: WorkflowStep[];
  maxTouches?: number;
  exitConditions?: WorkflowCondition[];
}

/**
 * Cold Outreach Sequence
 * For prospects with no prior engagement
 */
export const COLD_OUTREACH_SEQUENCE: WorkflowDefinition = {
  id: 'cold_outreach',
  name: 'Cold Outreach Sequence',
  description: 'Multi-touch sequence for reaching cold prospects with high intent',
  triggerType: 'intent_score',
  triggerConditions: [
    {
      type: 'intent_threshold',
      operator: 'gte',
      value: 50,
    },
  ],
  maxTouches: 6,
  steps: [
    {
      stepNumber: 1,
      action: 'research',
      config: {
        depth: 'comprehensive',
        sources: ['company', 'news', 'linkedin', 'intent'],
      },
    },
    {
      stepNumber: 2,
      action: 'engage',
      delayDays: 0,
      config: {
        channel: 'email',
        messageType: 'initial_outreach',
        personalization: 'high',
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 10, // Jump to qualification
        },
        {
          if: 'no_response',
          then: 3, // Continue to follow-up
        },
      ],
    },
    {
      stepNumber: 3,
      action: 'wait',
      delayDays: 3,
    },
    {
      stepNumber: 4,
      action: 'follow_up',
      config: {
        messageType: 'value_add',
        includeResource: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 10,
        },
        {
          if: 'no_response',
          then: 5,
        },
      ],
    },
    {
      stepNumber: 5,
      action: 'wait',
      delayDays: 4,
    },
    {
      stepNumber: 6,
      action: 'follow_up',
      config: {
        messageType: 'case_study',
        includeProof: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 10,
        },
        {
          if: 'no_response',
          then: 7,
        },
      ],
    },
    {
      stepNumber: 7,
      action: 'wait',
      delayDays: 7,
    },
    {
      stepNumber: 8,
      action: 'follow_up',
      config: {
        messageType: 'breakup',
        offerLastChance: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 10,
        },
        {
          if: 'no_response',
          then: 9,
        },
      ],
    },
    {
      stepNumber: 9,
      action: 'decision',
      config: {
        decisionType: 'mark_unresponsive',
      },
    },
    {
      stepNumber: 10,
      action: 'qualify',
      config: {
        framework: 'BANT',
        minimumScore: 70,
      },
      nextSteps: [
        {
          if: 'qualified',
          then: 11,
        },
        {
          if: 'not_qualified',
          then: 12,
        },
      ],
    },
    {
      stepNumber: 11,
      action: 'handoff',
      config: {
        handoffType: 'sales_qualified',
        generateBriefing: true,
      },
    },
    {
      stepNumber: 12,
      action: 'decision',
      config: {
        decisionType: 'nurture_sequence',
      },
    },
  ],
  exitConditions: [
    {
      type: 'response_received',
      operator: 'eq',
      value: true,
    },
    {
      type: 'contact_count',
      operator: 'gte',
      value: 6,
    },
  ],
};

/**
 * Warm Lead Nurture Sequence
 * For prospects who showed interest but aren't ready to buy
 */
export const WARM_LEAD_NURTURE: WorkflowDefinition = {
  id: 'warm_lead_nurture',
  name: 'Warm Lead Nurture',
  description: 'Long-term nurture sequence for interested but not-ready prospects',
  triggerType: 'status_change',
  triggerConditions: [
    {
      type: 'qualification_score',
      operator: 'gte',
      value: 40,
    },
    {
      type: 'qualification_score',
      operator: 'lt',
      value: 70,
    },
  ],
  maxTouches: 12,
  steps: [
    {
      stepNumber: 1,
      action: 'engage',
      delayDays: 0,
      config: {
        messageType: 'nurture_intro',
        setExpectation: true,
      },
    },
    {
      stepNumber: 2,
      action: 'wait',
      delayDays: 7,
    },
    {
      stepNumber: 3,
      action: 'follow_up',
      config: {
        messageType: 'educational_content',
        contentType: 'blog_post',
      },
    },
    {
      stepNumber: 4,
      action: 'wait',
      delayDays: 14,
    },
    {
      stepNumber: 5,
      action: 'follow_up',
      config: {
        messageType: 'case_study',
        includeROI: true,
      },
    },
    {
      stepNumber: 6,
      action: 'wait',
      delayDays: 14,
    },
    {
      stepNumber: 7,
      action: 'follow_up',
      config: {
        messageType: 'industry_insights',
        personalizeToIndustry: true,
      },
    },
    {
      stepNumber: 8,
      action: 'wait',
      delayDays: 21,
    },
    {
      stepNumber: 9,
      action: 'follow_up',
      config: {
        messageType: 'product_update',
        highlightNewFeatures: true,
      },
    },
    {
      stepNumber: 10,
      action: 'wait',
      delayDays: 30,
    },
    {
      stepNumber: 11,
      action: 'qualify',
      config: {
        recheckIntent: true,
        updateScore: true,
      },
      nextSteps: [
        {
          if: 'score_improved',
          then: 12,
        },
        {
          if: 'score_same',
          then: 2,
        },
      ],
    },
    {
      stepNumber: 12,
      action: 'decision',
      config: {
        decisionType: 'move_to_active',
      },
    },
  ],
};

/**
 * Meeting Booked Follow-up
 * Automated sequence after a meeting is scheduled
 */
export const MEETING_BOOKED_FOLLOWUP: WorkflowDefinition = {
  id: 'meeting_booked_followup',
  name: 'Meeting Booked Follow-up',
  description: 'Automated follow-up sequence for scheduled meetings',
  triggerType: 'status_change',
  triggerConditions: [
    {
      type: 'qualification_score',
      operator: 'gte',
      value: 70,
    },
  ],
  steps: [
    {
      stepNumber: 1,
      action: 'engage',
      delayDays: 0,
      config: {
        messageType: 'meeting_confirmation',
        includeCalendarInvite: true,
        includeAgenda: true,
      },
    },
    {
      stepNumber: 2,
      action: 'wait',
      delayDays: 1,
      conditions: [
        {
          type: 'time_elapsed',
          operator: 'eq',
          value: 'day_before_meeting',
        },
      ],
    },
    {
      stepNumber: 3,
      action: 'follow_up',
      config: {
        messageType: 'meeting_reminder',
        includePreparationTips: true,
      },
    },
    {
      stepNumber: 4,
      action: 'wait',
      delayDays: 1,
      conditions: [
        {
          type: 'time_elapsed',
          operator: 'eq',
          value: 'day_after_meeting',
        },
      ],
    },
    {
      stepNumber: 5,
      action: 'follow_up',
      config: {
        messageType: 'meeting_followup',
        summarizeDiscussion: true,
        includeNextSteps: true,
      },
    },
    {
      stepNumber: 6,
      action: 'handoff',
      config: {
        handoffType: 'post_meeting',
        includeNotes: true,
      },
    },
  ],
};

/**
 * Objection Handling Workflow
 * Triggered when common objections are detected
 */
export const OBJECTION_HANDLING: WorkflowDefinition = {
  id: 'objection_handling',
  name: 'Objection Handling',
  description: 'Automated responses to common objections',
  triggerType: 'manual',
  steps: [
    {
      stepNumber: 1,
      action: 'decision',
      config: {
        decisionType: 'classify_objection',
        objectionTypes: ['price', 'timing', 'competition', 'no_need', 'decision_maker'],
      },
      nextSteps: [
        {
          if: 'objection_price',
          then: 2,
        },
        {
          if: 'objection_timing',
          then: 5,
        },
        {
          if: 'objection_competition',
          then: 8,
        },
        {
          if: 'objection_no_need',
          then: 11,
        },
        {
          if: 'objection_decision_maker',
          then: 14,
        },
      ],
    },
    // Price objection path
    {
      stepNumber: 2,
      action: 'engage',
      config: {
        messageType: 'price_objection_roi',
        includeROICalculator: true,
      },
    },
    {
      stepNumber: 3,
      action: 'wait',
      delayDays: 2,
    },
    {
      stepNumber: 4,
      action: 'follow_up',
      config: {
        messageType: 'price_objection_case_study',
        includeCostSavings: true,
      },
    },
    // Timing objection path
    {
      stepNumber: 5,
      action: 'engage',
      config: {
        messageType: 'timing_objection_quick_wins',
        emphasizeQuickValue: true,
      },
    },
    {
      stepNumber: 6,
      action: 'wait',
      delayDays: 7,
    },
    {
      stepNumber: 7,
      action: 'follow_up',
      config: {
        messageType: 'timing_objection_check_in',
        askAboutTimeline: true,
      },
    },
    // Competition objection path
    {
      stepNumber: 8,
      action: 'engage',
      config: {
        messageType: 'competition_differentiation',
        includeBattleCard: true,
      },
    },
    {
      stepNumber: 9,
      action: 'wait',
      delayDays: 3,
    },
    {
      stepNumber: 10,
      action: 'follow_up',
      config: {
        messageType: 'competition_comparison',
        includeComparisonChart: true,
      },
    },
    // No need objection path
    {
      stepNumber: 11,
      action: 'engage',
      config: {
        messageType: 'no_need_education',
        identifyPainPoints: true,
      },
    },
    {
      stepNumber: 12,
      action: 'wait',
      delayDays: 5,
    },
    {
      stepNumber: 13,
      action: 'follow_up',
      config: {
        messageType: 'no_need_industry_trends',
        showMarketChanges: true,
      },
    },
    // Decision maker objection path
    {
      stepNumber: 14,
      action: 'engage',
      config: {
        messageType: 'decision_maker_champion',
        buildChampion: true,
      },
    },
    {
      stepNumber: 15,
      action: 'wait',
      delayDays: 2,
    },
    {
      stepNumber: 16,
      action: 'follow_up',
      config: {
        messageType: 'decision_maker_intro',
        requestIntroduction: true,
      },
    },
  ],
};

/**
 * Re-engagement Workflow
 * For prospects who went cold after initial engagement
 */
export const RE_ENGAGEMENT_SEQUENCE: WorkflowDefinition = {
  id: 're_engagement',
  name: 'Re-engagement Sequence',
  description: 'Re-activate prospects who went cold',
  triggerType: 'manual',
  maxTouches: 4,
  steps: [
    {
      stepNumber: 1,
      action: 'research',
      config: {
        checkForChanges: true,
        sources: ['news', 'linkedin', 'hiring'],
      },
    },
    {
      stepNumber: 2,
      action: 'engage',
      delayDays: 0,
      config: {
        messageType: 're_engagement_trigger',
        referenceChange: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 7,
        },
        {
          if: 'no_response',
          then: 3,
        },
      ],
    },
    {
      stepNumber: 3,
      action: 'wait',
      delayDays: 5,
    },
    {
      stepNumber: 4,
      action: 'follow_up',
      config: {
        messageType: 're_engagement_value',
        highlightNewFeatures: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 7,
        },
        {
          if: 'no_response',
          then: 5,
        },
      ],
    },
    {
      stepNumber: 5,
      action: 'wait',
      delayDays: 10,
    },
    {
      stepNumber: 6,
      action: 'follow_up',
      config: {
        messageType: 're_engagement_final',
        offerIncentive: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 7,
        },
        {
          if: 'no_response',
          then: 8,
        },
      ],
    },
    {
      stepNumber: 7,
      action: 'qualify',
      config: {
        recheckIntent: true,
      },
      nextSteps: [
        {
          if: 'qualified',
          then: 9,
        },
        {
          if: 'not_qualified',
          then: 8,
        },
      ],
    },
    {
      stepNumber: 8,
      action: 'decision',
      config: {
        decisionType: 'mark_unresponsive',
      },
    },
    {
      stepNumber: 9,
      action: 'decision',
      config: {
        decisionType: 'move_to_active',
      },
    },
  ],
};

/**
 * High-Intent Fast Track
 * Accelerated sequence for prospects with burning intent
 */
export const HIGH_INTENT_FAST_TRACK: WorkflowDefinition = {
  id: 'high_intent_fast_track',
  name: 'High-Intent Fast Track',
  description: 'Accelerated outreach for burning-hot prospects',
  triggerType: 'intent_score',
  triggerConditions: [
    {
      type: 'intent_threshold',
      operator: 'gte',
      value: 75,
    },
  ],
  maxTouches: 3,
  steps: [
    {
      stepNumber: 1,
      action: 'research',
      config: {
        depth: 'quick',
        prioritize: 'timeliness',
      },
    },
    {
      stepNumber: 2,
      action: 'engage',
      delayDays: 0,
      config: {
        channel: 'multi',
        messageType: 'urgent_outreach',
        personalization: 'high',
        includeDirectLine: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 6,
        },
        {
          if: 'no_response',
          then: 3,
        },
      ],
    },
    {
      stepNumber: 3,
      action: 'wait',
      delayDays: 1,
    },
    {
      stepNumber: 4,
      action: 'follow_up',
      config: {
        channel: 'phone',
        messageType: 'urgent_follow_up',
        leaveVoicemail: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 6,
        },
        {
          if: 'no_response',
          then: 5,
        },
      ],
    },
    {
      stepNumber: 5,
      action: 'follow_up',
      delayDays: 2,
      config: {
        messageType: 'last_attempt',
        offerExpedited: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 6,
        },
        {
          if: 'no_response',
          then: 7,
        },
      ],
    },
    {
      stepNumber: 6,
      action: 'handoff',
      config: {
        handoffType: 'immediate',
        priority: 'high',
        notifySales: true,
      },
    },
    {
      stepNumber: 7,
      action: 'decision',
      config: {
        decisionType: 'escalate_to_human',
        reason: 'high_intent_no_response',
      },
    },
  ],
};

/**
 * Event-Based Trigger Workflow
 * Responds to specific company events/triggers
 */
export const EVENT_BASED_OUTREACH: WorkflowDefinition = {
  id: 'event_based_outreach',
  name: 'Event-Based Outreach',
  description: 'Triggered by company events (funding, hiring, product launch)',
  triggerType: 'status_change',
  steps: [
    {
      stepNumber: 1,
      action: 'research',
      config: {
        focusOnEvent: true,
        gatherContext: true,
      },
    },
    {
      stepNumber: 2,
      action: 'engage',
      delayDays: 0,
      config: {
        messageType: 'event_congratulations',
        referenceEvent: true,
        connectToSolution: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 5,
        },
        {
          if: 'no_response',
          then: 3,
        },
      ],
    },
    {
      stepNumber: 3,
      action: 'wait',
      delayDays: 4,
    },
    {
      stepNumber: 4,
      action: 'follow_up',
      config: {
        messageType: 'event_value_prop',
        tieToEvent: true,
      },
      nextSteps: [
        {
          if: 'response_received',
          then: 5,
        },
        {
          if: 'no_response',
          then: 6,
        },
      ],
    },
    {
      stepNumber: 5,
      action: 'qualify',
      config: {
        considerEvent: true,
      },
    },
    {
      stepNumber: 6,
      action: 'decision',
      config: {
        decisionType: 'add_to_nurture',
      },
    },
  ],
};

/**
 * All available workflows
 */
export const ALL_WORKFLOWS: WorkflowDefinition[] = [
  COLD_OUTREACH_SEQUENCE,
  WARM_LEAD_NURTURE,
  MEETING_BOOKED_FOLLOWUP,
  OBJECTION_HANDLING,
  RE_ENGAGEMENT_SEQUENCE,
  HIGH_INTENT_FAST_TRACK,
  EVENT_BASED_OUTREACH,
];

/**
 * Get workflow by ID
 */
export function getWorkflowById(workflowId: string): WorkflowDefinition | undefined {
  return ALL_WORKFLOWS.find(w => w.id === workflowId);
}

/**
 * Get workflows that match trigger conditions
 */
export function getMatchingWorkflows(
  triggerType: WorkflowDefinition['triggerType'],
  context: Record<string, any>
): WorkflowDefinition[] {
  return ALL_WORKFLOWS.filter(workflow => {
    if (workflow.triggerType !== triggerType) return false;

    if (!workflow.triggerConditions) return true;

    return workflow.triggerConditions.every(condition => {
      return evaluateCondition(condition, context);
    });
  });
}

/**
 * Evaluate a workflow condition
 */
export function evaluateCondition(
  condition: WorkflowCondition,
  context: Record<string, any>
): boolean {
  const contextValue = context[condition.type];

  switch (condition.operator) {
    case 'eq':
      return contextValue === condition.value;
    case 'gt':
      return contextValue > condition.value;
    case 'lt':
      return contextValue < condition.value;
    case 'gte':
      return contextValue >= condition.value;
    case 'lte':
      return contextValue <= condition.value;
    case 'contains':
      return String(contextValue).includes(String(condition.value));
    default:
      return false;
  }
}

/**
 * Get next step in workflow based on current step and conditions
 */
export function getNextStep(
  workflow: WorkflowDefinition,
  currentStep: number,
  context: Record<string, any>
): WorkflowStep | null {
  const current = workflow.steps.find(s => s.stepNumber === currentStep);
  if (!current) return null;

  // Check for conditional next steps
  if (current.nextSteps) {
    for (const nextStep of current.nextSteps) {
      // Evaluate the condition
      const conditionMet = evaluateNextStepCondition(nextStep.if, context);
      if (conditionMet) {
        return workflow.steps.find(s => s.stepNumber === nextStep.then) || null;
      }
    }
  }

  // Default: return next sequential step
  const nextStepNumber = currentStep + 1;
  return workflow.steps.find(s => s.stepNumber === nextStepNumber) || null;
}

/**
 * Evaluate next step condition
 */
function evaluateNextStepCondition(condition: string, context: Record<string, any>): boolean {
  // Simple condition evaluation
  switch (condition) {
    case 'response_received':
      return context.responseReceived === true;
    case 'no_response':
      return context.responseReceived === false;
    case 'qualified':
      return context.qualificationScore >= 70;
    case 'not_qualified':
      return context.qualificationScore < 70;
    case 'score_improved':
      return context.scoreChange > 10;
    case 'score_same':
      return Math.abs(context.scoreChange) <= 10;
    default:
      // Handle objection type conditions
      if (condition.startsWith('objection_')) {
        const objectionType = condition.replace('objection_', '');
        return context.objectionType === objectionType;
      }
      return false;
  }
}

/**
 * Workflow execution state
 */
export interface WorkflowExecutionState {
  workflowId: string;
  prospectId: string;
  currentStep: number;
  startedAt: string;
  lastExecutedAt: string;
  context: Record<string, any>;
  status: 'active' | 'paused' | 'completed' | 'failed';
  completedSteps: number[];
}

/**
 * Execute workflow step
 */
export function shouldExecuteStep(
  step: WorkflowStep,
  executionState: WorkflowExecutionState
): boolean {
  // Check if step conditions are met
  if (!step.conditions) return true;

  return step.conditions.every(condition => {
    return evaluateCondition(condition, executionState.context);
  });
}

/**
 * Calculate next execution time for a step
 */
export function calculateNextExecutionTime(step: WorkflowStep, lastExecuted: Date): Date {
  const delayMs = (step.delayDays || 0) * 24 * 60 * 60 * 1000;
  return new Date(lastExecuted.getTime() + delayMs);
}
