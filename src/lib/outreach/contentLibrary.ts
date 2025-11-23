/**
 * Content Library & Template System
 * Pre-built, proven email and message templates for various outreach scenarios
 */

import { supabase } from '../supabase';
import { routeAIRequest } from '../ai/modelRouter';

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subcategory?: string;

  subjectLine: string;
  emailBody: string;

  // Targeting
  targetPersona: string[];     // ['C-Level', 'VP/Director', 'Manager', etc.]
  targetIndustry: string[];    // ['Technology', 'Finance', etc.]
  targetCompanySize: string[]; // ['1-10', '11-50', '51-200', '201-1000', '1000+']

  // Variables available in template
  variables: TemplateVariable[];

  // Performance metrics
  timesUsed: number;
  openRate: number;
  replyRate: number;
  meetingRate: number;

  // Metadata
  createdBy: string;
  isActive: boolean;
  tags: string[];
  notes?: string;
}

export type TemplateCategory =
  | 'cold_email'
  | 'follow_up'
  | 'meeting_request'
  | 'objection_handling'
  | 'break_up'
  | 'value_proposition'
  | 'case_study'
  | 're_engagement'
  | 'referral'
  | 'event_based'
  | 'linkedin';

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  examples: string[];
}

export interface TemplateLibraryStats {
  totalTemplates: number;
  byCategory: Record<TemplateCategory, number>;
  topPerforming: EmailTemplate[];
  recentlyAdded: EmailTemplate[];
}

/**
 * Pre-built template library
 */
export const TEMPLATE_LIBRARY: Record<string, EmailTemplate> = {
  // COLD OUTREACH TEMPLATES
  cold_problem_agitate_solve: {
    id: 'cold_problem_agitate_solve',
    name: 'Problem-Agitate-Solve',
    category: 'cold_email',
    subcategory: 'first_touch',
    subjectLine: '{{pain_point}} at {{company_name}}?',
    emailBody: `Hi {{first_name}},

I noticed {{company_name}} is {{relevant_observation}} - congrats on the growth!

I'm reaching out because companies at your stage often struggle with {{pain_point}}, which can lead to {{negative_consequence}}.

We help {{target_persona_plural}} at companies like {{competitor_or_similar}} {{value_proposition_specific}}.

The result? {{quantifiable_benefit}}.

Would it make sense to explore how we could help {{company_name}} achieve similar results?

{{cta}}

{{signature}}`,
    targetPersona: ['C-Level', 'VP/Director'],
    targetIndustry: ['Technology', 'SaaS'],
    targetCompanySize: ['51-200', '201-1000'],
    variables: [
      { name: 'pain_point', description: 'Main pain point', required: true, examples: ['scaling sales operations', 'manual lead qualification'] },
      { name: 'negative_consequence', description: 'What happens if not solved', required: true, examples: ['missed revenue opportunities', 'burned-out sales team'] },
      { name: 'quantifiable_benefit', description: 'Specific result', required: true, examples: ['3x more qualified meetings', '40% faster sales cycle'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['cold', 'high-performing', 'b2b'],
  },

  cold_pattern_interrupt: {
    id: 'cold_pattern_interrupt',
    name: 'Pattern Interrupt',
    category: 'cold_email',
    subcategory: 'first_touch',
    subjectLine: 'Quick question about {{company_name}}',
    emailBody: `{{first_name}},

I'll be direct: I'm reaching out cold because {{reason_for_outreach}}.

Here's why I think this is relevant to you:

• {{insight_1}}
• {{insight_2}}
• {{insight_3}}

Not sure if this is a priority for you right now, but if it is, I'd love to share how we've helped {{social_proof_company}} {{specific_result}}.

Worth a 15-minute conversation?

{{signature}}

P.S. - If timing isn't right, I totally understand. Just let me know and I won't follow up.`,
    targetPersona: ['VP/Director', 'Manager'],
    targetIndustry: ['Technology', 'Marketing', 'Sales'],
    targetCompanySize: ['11-50', '51-200', '201-1000'],
    variables: [
      { name: 'reason_for_outreach', description: 'Why reaching out now', required: true, examples: ['I saw you just raised Series A', 'I noticed you\'re hiring 3 SDRs'] },
      { name: 'insight_1', description: 'First insight about their business', required: true, examples: ['You\'re expanding into enterprise'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['cold', 'honest', 'direct'],
  },

  // FOLLOW-UP TEMPLATES
  followup_value_add: {
    id: 'followup_value_add',
    name: 'Value-Add Follow-Up',
    category: 'follow_up',
    subcategory: 'second_touch',
    subjectLine: 'Resource for {{company_name}}',
    emailBody: `Hi {{first_name}},

Following up on my previous email. I figured whether or not we end up working together, this might be helpful:

{{resource_description}}

{{resource_link}}

This helped {{social_proof_company}} {{specific_outcome}}, and I thought it might be relevant given {{relevance_reason}}.

Let me know if you'd like to discuss how {{company_name}} could achieve similar results.

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'resource_description', description: 'What you\'re sharing', required: true, examples: ['our guide on scaling outbound', 'a case study from your industry'] },
      { name: 'resource_link', description: 'URL to resource', required: true, examples: ['https://example.com/guide'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['follow-up', 'value-add', 'helpful'],
  },

  followup_break_up: {
    id: 'followup_break_up',
    name: 'Break-Up Email',
    category: 'break_up',
    subjectLine: 'Closing the loop',
    emailBody: `{{first_name}},

I've reached out a few times about {{value_proposition_short}} but haven't heard back. That's totally fine!

I'm going to assume it's not a priority right now and stop following up.

If I'm wrong and you'd like to revisit this down the line, just reply to this email. Otherwise, I'll stay out of your inbox.

Either way, best of luck with {{company_name}}'s growth!

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'value_proposition_short', description: 'Brief value prop', required: true, examples: ['helping you scale outbound', 'automating your lead qualification'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['break-up', 'last-touch', 'high-reply'],
  },

  // MEETING REQUEST TEMPLATES
  meeting_request_direct: {
    id: 'meeting_request_direct',
    name: 'Direct Meeting Request',
    category: 'meeting_request',
    subjectLine: '15 minutes?',
    emailBody: `{{first_name}},

Based on {{reason_for_relevance}}, I think we could help {{company_name}} {{specific_outcome}}.

Would you be open to a quick 15-minute call this week to explore if there's a fit?

Here's my calendar: {{calendar_link}}

Or if you prefer, I have availability:
• {{time_option_1}}
• {{time_option_2}}
• {{time_option_3}}

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'reason_for_relevance', description: 'Why this is relevant to them', required: true, examples: ['your recent expansion into enterprise', 'the 5 SDRs you just hired'] },
      { name: 'calendar_link', description: 'Calendar booking link', required: false, examples: ['https://calendly.com/you'] },
      { name: 'time_option_1', description: 'First time option', required: true, examples: ['Tuesday at 2pm ET'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['meeting-request', 'direct'],
  },

  // OBJECTION HANDLING TEMPLATES
  objection_price: {
    id: 'objection_price',
    name: 'Price Objection',
    category: 'objection_handling',
    subcategory: 'price',
    subjectLine: 'Re: Pricing',
    emailBody: `{{first_name}},

I completely understand the concern about price - it's an investment, and you want to make sure the ROI is there.

A few things that might help:

1. **ROI**: Our customers typically see {{roi_metric}} within {{timeframe}}. Based on your situation, that would mean {{specific_roi_calculation}}.

2. **Cost of inaction**: Right now, {{current_pain_point}} is costing you {{estimated_cost}}. Even if we only improve this by {{percentage}}%, that's {{savings}} per {{time_period}}.

3. **Flexible options**: We have {{pricing_options}} to help make this work with your budget.

Would it make sense to hop on a call to break down the numbers specific to {{company_name}}?

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'roi_metric', description: 'Typical ROI', required: true, examples: ['3x return', '40% increase in qualified leads'] },
      { name: 'timeframe', description: 'Time to ROI', required: true, examples: ['3 months', 'first quarter'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['objection', 'price', 'roi'],
  },

  objection_timing: {
    id: 'objection_timing',
    name: 'Timing Objection',
    category: 'objection_handling',
    subcategory: 'timing',
    subjectLine: 'Re: Timing',
    emailBody: `{{first_name}},

Totally understand - timing is everything.

Quick question: When you say "not right now," is it:

a) Not a priority (we're focused on other things)
b) Bad timing (end of quarter, middle of a project, etc.)
c) Need to see more info before deciding

Just want to make sure I follow up at the right time with the right information.

If it's (b), when would make more sense? If it's (c), what specific information would be most helpful?

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['objection', 'timing'],
  },

  // EVENT-BASED TEMPLATES
  event_funding_announcement: {
    id: 'event_funding_announcement',
    name: 'Funding Announcement',
    category: 'event_based',
    subcategory: 'funding',
    subjectLine: 'Congrats on the {{funding_round}}!',
    emailBody: `{{first_name}},

Congrats on the {{funding_amount}} {{funding_round}}! Saw the announcement on {{source}}.

As you scale {{focus_area}}, one challenge that often comes up is {{common_challenge}}.

We've helped other companies in similar growth phases (like {{social_proof_company}}) {{specific_outcome}}.

Would it make sense to chat about how we could support {{company_name}}'s growth?

{{signature}}`,
    targetPersona: ['C-Level', 'VP/Director'],
    targetIndustry: ['Technology', 'SaaS'],
    targetCompanySize: ['11-50', '51-200'],
    variables: [
      { name: 'funding_round', description: 'Series A/B/C, etc.', required: true, examples: ['Series A', 'Series B'] },
      { name: 'funding_amount', description: 'Amount raised', required: true, examples: ['$10M', '$25M'] },
      { name: 'focus_area', description: 'What they\'ll scale', required: true, examples: ['your sales team', 'your go-to-market motion'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['event-based', 'funding', 'timely'],
  },

  event_new_hire: {
    id: 'event_new_hire',
    name: 'New Role/Hire',
    category: 'event_based',
    subcategory: 'job_change',
    subjectLine: 'Congrats on the new role!',
    emailBody: `{{first_name}},

Saw you recently joined {{company_name}} as {{title}} - congrats!

Coming into a new role, you're probably focused on {{likely_priority_1}} and {{likely_priority_2}}.

One thing that {{percentage}}% of new {{role_type_plural}} we talk to are struggling with is {{common_challenge}}.

We've helped folks like {{social_proof_name}} at {{social_proof_company}} {{specific_outcome}} within their first {{timeframe}}.

Would it be helpful to see how we could help you hit the ground running at {{company_name}}?

{{signature}}`,
    targetPersona: ['VP/Director', 'Manager'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'likely_priority_1', description: 'First likely priority', required: true, examples: ['building your team', 'setting up processes'] },
      { name: 'likely_priority_2', description: 'Second likely priority', required: true, examples: ['hitting your Q1 goals', 'proving quick wins'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['event-based', 'job-change', 'timing'],
  },

  // LINKEDIN TEMPLATES
  linkedin_connection_note: {
    id: 'linkedin_connection_note',
    name: 'LinkedIn Connection Request',
    category: 'linkedin',
    subjectLine: '',
    emailBody: `Hi {{first_name}}, I help {{target_persona_plural}} at {{target_type}} companies {{value_prop_short}}. Given your role at {{company_name}}, thought it would be great to connect!`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'target_type', description: 'Type of company', required: true, examples: ['high-growth', 'enterprise', 'mid-market'] },
      { name: 'value_prop_short', description: 'Brief value prop', required: true, examples: ['scale their outbound', 'automate lead qualification'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['linkedin', 'connection-request'],
  },

  linkedin_inmail: {
    id: 'linkedin_inmail',
    name: 'LinkedIn InMail',
    category: 'linkedin',
    subjectLine: '{{company_name}} + {{your_company}}?',
    emailBody: `Hi {{first_name}},

I know InMails can be hit-or-miss, so I'll keep this brief.

I help {{target_persona_plural}} at companies like {{company_name}} {{value_proposition}}.

Recent example: {{social_proof_company}} {{specific_result}}.

If this is relevant, I'd love to share how we could help {{company_name}}.

Worth a conversation?

{{signature}}`,
    targetPersona: ['All'],
    targetIndustry: ['All'],
    targetCompanySize: ['All'],
    variables: [
      { name: 'your_company', description: 'Your company name', required: true, examples: ['Acme Corp'] },
      { name: 'value_proposition', description: 'What you do', required: true, examples: ['3x their qualified pipeline'] },
    ],
    timesUsed: 0,
    openRate: 0,
    replyRate: 0,
    meetingRate: 0,
    createdBy: 'system',
    isActive: true,
    tags: ['linkedin', 'inmail'],
  },
};

/**
 * Template Manager Class
 */
export class TemplateManager {
  private teamId: string;

  constructor(teamId: string) {
    this.teamId = teamId;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    // Check database first
    const { data } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('id', templateId)
      .eq('team_id', this.teamId)
      .single();

    if (data) {
      return this.mapDbToTemplate(data);
    }

    // Fall back to built-in templates
    return TEMPLATE_LIBRARY[templateId] || null;
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: TemplateCategory): Promise<EmailTemplate[]> {
    // Get custom templates
    const { data: customTemplates } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('category', category)
      .eq('is_active', true);

    // Get built-in templates
    const builtInTemplates = Object.values(TEMPLATE_LIBRARY).filter(
      t => t.category === category
    );

    const all = [
      ...builtInTemplates,
      ...(customTemplates?.map(this.mapDbToTemplate) || []),
    ];

    return all;
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ subject: string; body: string }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Replace variables in subject and body
    let subject = template.subjectLine;
    let body = template.emailBody;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    // Check for unreplaced variables
    const unreplacedInSubject = subject.match(/{{([^}]+)}}/g);
    const unreplacedInBody = body.match(/{{([^}]+)}}/g);

    if (unreplacedInSubject || unreplacedInBody) {
      console.warn('Unreplaced variables found:', {
        subject: unreplacedInSubject,
        body: unreplacedInBody,
      });
    }

    return { subject, body };
  }

  /**
   * Get personalized template recommendations
   */
  async getRecommendedTemplates(prospect: {
    title?: string;
    company_size?: string;
    industry?: string;
    stage?: string;
  }): Promise<EmailTemplate[]> {
    const persona = this.detectPersona(prospect.title || '');

    const { data } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('is_active', true)
      .order('reply_rate', { ascending: false })
      .limit(10);

    const customTemplates = data?.map(this.mapDbToTemplate) || [];

    // Filter built-in templates by persona
    const relevantBuiltIn = Object.values(TEMPLATE_LIBRARY).filter(t =>
      t.targetPersona.includes(persona) || t.targetPersona.includes('All')
    );

    return [...relevantBuiltIn, ...customTemplates].slice(0, 5);
  }

  /**
   * Track template usage
   */
  async trackTemplateUsage(
    templateId: string,
    outcome: { opened: boolean; replied: boolean; meeting: boolean }
  ): Promise<void> {
    await supabase.rpc('update_template_performance', {
      p_template_id: templateId,
      p_opened: outcome.opened,
      p_replied: outcome.replied,
      p_meeting: outcome.meeting,
    });
  }

  /**
   * AI-enhance template
   */
  async enhanceTemplate(
    baseTemplate: string,
    targetPersona: string,
    targetIndustry: string
  ): Promise<string> {
    const prompt = `Improve this email template for ${targetPersona} in ${targetIndustry} industry:

${baseTemplate}

Make it:
1. More personalized
2. More compelling
3. Clearer value proposition
4. Better call-to-action

Keep all {{variables}} intact. Return only the improved template.`;

    const enhanced = await routeAIRequest(prompt, {
      taskType: 'content-generation',
      maxTokens: 500,
    });

    return enhanced.trim();
  }

  // Private helpers

  private detectPersona(title: string): string {
    const titleLower = title.toLowerCase();

    if (/(ceo|cto|cfo|coo|chief|founder|president)/i.test(titleLower)) {
      return 'C-Level';
    }
    if (/(vp|vice president|director)/i.test(titleLower)) {
      return 'VP/Director';
    }
    if (/(manager|lead|head of)/i.test(titleLower)) {
      return 'Manager';
    }
    return 'All';
  }

  private mapDbToTemplate(data: any): EmailTemplate {
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      subjectLine: data.subject_line,
      emailBody: data.email_body,
      targetPersona: data.target_persona || [],
      targetIndustry: data.target_industry || [],
      targetCompanySize: data.target_company_size || [],
      variables: data.variables || [],
      timesUsed: data.times_used || 0,
      openRate: data.open_rate || 0,
      replyRate: data.reply_rate || 0,
      meetingRate: data.meeting_rate || 0,
      createdBy: data.created_by,
      isActive: data.is_active,
      tags: data.tags || [],
      notes: data.notes,
    };
  }
}

/**
 * Get template library stats
 */
export async function getTemplateLibraryStats(teamId: string): Promise<TemplateLibraryStats> {
  const { data } = await supabase
    .from('outreach_templates')
    .select('*')
    .eq('team_id', teamId);

  const totalTemplates = (data?.length || 0) + Object.keys(TEMPLATE_LIBRARY).length;

  const byCategory: Record<string, number> = {};
  Object.values(TEMPLATE_LIBRARY).forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  data?.forEach((t: any) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  });

  const allTemplates = [
    ...Object.values(TEMPLATE_LIBRARY),
    ...(data?.map((d: any) => ({
      ...d,
      reply_rate: d.reply_rate || 0,
    })) || []),
  ];

  const topPerforming = allTemplates
    .sort((a, b) => (b.replyRate || b.reply_rate || 0) - (a.replyRate || a.reply_rate || 0))
    .slice(0, 5) as EmailTemplate[];

  return {
    totalTemplates,
    byCategory: byCategory as any,
    topPerforming,
    recentlyAdded: [],
  };
}
