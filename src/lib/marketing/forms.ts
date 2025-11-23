/**
 * Form Builder
 * Create and manage forms with conditional logic, validation, and analytics
 */

import { supabase } from '../supabase';

export interface Form {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'archived';

  // Form Configuration
  fields: FormField[];
  submitButtonText: string;
  successMessage: string;
  redirectUrl?: string;

  // Security
  enableRecaptcha: boolean;
  requireEmailConfirmation: boolean;

  // Notifications
  sendNotification: boolean;
  notificationRecipients?: string[];
  autoResponderEnabled?: boolean;
  autoResponderSubject?: string;
  autoResponderMessage?: string;

  // Styling
  customCss?: string;
  theme?: 'light' | 'dark' | 'custom';

  // Integration
  workflowId?: string;
  listIds?: string[];
  formType?: 'contact' | 'lead' | 'survey' | 'event_registration' | 'custom';

  // Analytics
  submissions: number;
  views: number;
  conversionRate: number;

  // Advanced Features
  enableProgressBar?: boolean;
  allowPartialSubmissions?: boolean;
  maxSubmissionsPerContact?: number;
  expiresAt?: Date;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'dropdown' | 'checkbox' | 'radio' | 'date' | 'time' | 'file' | 'hidden';
  placeholder?: string;
  defaultValue?: any;
  helpText?: string;

  // Validation
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    customErrorMessage?: string;
  };

  // Options (for dropdown, radio, checkbox)
  options?: Array<{
    label: string;
    value: string;
  }>;

  // Conditional Logic
  conditionalLogic?: {
    show: boolean; // show or hide
    conditions: Array<{
      fieldId: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
    logic: 'AND' | 'OR';
  };

  // File Upload Settings
  fileUpload?: {
    maxSize: number; // in MB
    allowedTypes: string[];
    maxFiles: number;
  };

  // Multi-step
  stepNumber?: number;

  // Layout
  width?: 'full' | 'half' | 'third';
  order: number;
}

export interface FormSubmission {
  id: string;
  formId: string;
  prospectId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  referrer: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  data: Record<string, any>;
  isPartial: boolean;
  completedAt?: Date;
  createdAt: Date;
}

export interface FormView {
  formId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  referrer: string;
  viewedAt: Date;
}

export interface FormAnalytics {
  totalSubmissions: number;
  uniqueSubmissions: number;
  totalViews: number;
  conversionRate: number;
  avgCompletionTime: number;
  fieldAnalytics: Array<{
    fieldId: string;
    fieldName: string;
    dropoffRate: number;
    avgTimeSpent: number;
    errorRate: number;
  }>;
  submissionsByDate: Array<{
    date: string;
    submissions: number;
    views: number;
  }>;
  deviceBreakdown: { desktop: number; mobile: number; tablet: number };
  topReferrers: Array<{ referrer: string; count: number }>;
}

/**
 * Form Service
 */
export class FormService {
  /**
   * Create form
   */
  async createForm(form: Partial<Form>): Promise<Form> {
    const { data, error } = await supabase
      .from('forms')
      .insert({
        name: form.name,
        description: form.description,
        status: 'draft',
        fields: form.fields || [],
        submit_button_text: form.submitButtonText || 'Submit',
        success_message: form.successMessage || 'Thank you for your submission!',
        redirect_url: form.redirectUrl,
        enable_recaptcha: form.enableRecaptcha || false,
        require_email_confirmation: form.requireEmailConfirmation || false,
        send_notification: form.sendNotification || false,
        notification_recipients: form.notificationRecipients,
        auto_responder_enabled: form.autoResponderEnabled || false,
        auto_responder_subject: form.autoResponderSubject,
        auto_responder_message: form.autoResponderMessage,
        custom_css: form.customCss,
        theme: form.theme || 'light',
        workflow_id: form.workflowId,
        list_ids: form.listIds,
        form_type: form.formType || 'contact',
        enable_progress_bar: form.enableProgressBar || false,
        allow_partial_submissions: form.allowPartialSubmissions || false,
        max_submissions_per_contact: form.maxSubmissionsPerContact,
        expires_at: form.expiresAt?.toISOString(),
        submissions: 0,
        views: 0,
        conversion_rate: 0
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapForm(data);
  }

  /**
   * Update form
   */
  async updateForm(formId: string, updates: Partial<Form>): Promise<Form> {
    const { data, error } = await supabase
      .from('forms')
      .update({
        name: updates.name,
        description: updates.description,
        status: updates.status,
        fields: updates.fields,
        submit_button_text: updates.submitButtonText,
        success_message: updates.successMessage,
        redirect_url: updates.redirectUrl,
        enable_recaptcha: updates.enableRecaptcha,
        require_email_confirmation: updates.requireEmailConfirmation,
        send_notification: updates.sendNotification,
        notification_recipients: updates.notificationRecipients,
        auto_responder_enabled: updates.autoResponderEnabled,
        auto_responder_subject: updates.autoResponderSubject,
        auto_responder_message: updates.autoResponderMessage,
        custom_css: updates.customCss,
        theme: updates.theme,
        workflow_id: updates.workflowId,
        list_ids: updates.listIds,
        form_type: updates.formType,
        enable_progress_bar: updates.enableProgressBar,
        allow_partial_submissions: updates.allowPartialSubmissions,
        max_submissions_per_contact: updates.maxSubmissionsPerContact,
        expires_at: updates.expiresAt?.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', formId)
      .select()
      .single();

    if (error) throw error;
    return this.mapForm(data);
  }

  /**
   * Publish form
   */
  async publishForm(formId: string): Promise<Form> {
    const { data, error } = await supabase
      .from('forms')
      .update({ status: 'published' })
      .eq('id', formId)
      .select()
      .single();

    if (error) throw error;
    return this.mapForm(data);
  }

  /**
   * Unpublish form
   */
  async unpublishForm(formId: string): Promise<Form> {
    const { data, error } = await supabase
      .from('forms')
      .update({ status: 'draft' })
      .eq('id', formId)
      .select()
      .single();

    if (error) throw error;
    return this.mapForm(data);
  }

  /**
   * Get form
   */
  async getForm(formId: string): Promise<Form> {
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (error) throw error;
    return this.mapForm(data);
  }

  /**
   * Get all forms
   */
  async getForms(filters?: {
    status?: Form['status'];
    formType?: Form['formType'];
    limit?: number;
    offset?: number;
  }): Promise<Form[]> {
    let query = supabase
      .from('forms')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.formType) {
      query = query.eq('form_type', filters.formType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapForm);
  }

  /**
   * Track form view
   */
  async trackFormView(view: Partial<FormView>): Promise<void> {
    await supabase.from('form_views').insert({
      form_id: view.formId,
      session_id: view.sessionId,
      ip_address: view.ipAddress,
      user_agent: view.userAgent,
      referrer: view.referrer,
      viewed_at: new Date().toISOString()
    });

    // Update form views count
    await supabase.rpc('increment_form_views', { p_form_id: view.formId });
  }

  /**
   * Submit form
   */
  async submitForm(submission: Partial<FormSubmission>): Promise<{
    success: boolean;
    submissionId?: string;
    prospectId?: string;
    message: string;
    redirectUrl?: string;
  }> {
    // Get form configuration
    const form = await this.getForm(submission.formId!);

    // Check if form is expired
    if (form.expiresAt && new Date() > form.expiresAt) {
      return {
        success: false,
        message: 'This form has expired'
      };
    }

    // Check max submissions per contact
    if (form.maxSubmissionsPerContact && submission.prospectId) {
      const { count } = await supabase
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', submission.formId)
        .eq('prospect_id', submission.prospectId);

      if (count && count >= form.maxSubmissionsPerContact) {
        return {
          success: false,
          message: 'Maximum submissions reached for this form'
        };
      }
    }

    // Validate required fields
    const validationErrors = this.validateSubmission(form.fields, submission.data!);
    if (validationErrors.length > 0) {
      return {
        success: false,
        message: `Validation failed: ${validationErrors.join(', ')}`
      };
    }

    // Create or update prospect
    let prospectId = submission.prospectId;
    const email = submission.data?.email || submission.email;

    if (email && !prospectId) {
      // Check if prospect exists
      const { data: existingProspect } = await supabase
        .from('prospects')
        .select('id')
        .eq('email', email)
        .single();

      if (existingProspect) {
        prospectId = existingProspect.id;

        // Update prospect with form data
        await this.updateProspectFromFormData(prospectId, submission.data!);
      } else {
        // Create new prospect
        const { data: newProspect } = await supabase
          .from('prospects')
          .insert({
            email,
            first_name: submission.data?.first_name || submission.data?.firstName,
            last_name: submission.data?.last_name || submission.data?.lastName,
            phone: submission.data?.phone,
            company: submission.data?.company,
            job_title: submission.data?.job_title || submission.data?.jobTitle,
            lead_source: 'form',
            lead_source_details: `Form: ${form.name}`,
            utm_source: submission.utmSource,
            utm_medium: submission.utmMedium,
            utm_campaign: submission.utmCampaign
          })
          .select()
          .single();

        prospectId = newProspect?.id;
      }
    }

    // Save form submission
    const { data: savedSubmission, error } = await supabase
      .from('form_submissions')
      .insert({
        form_id: submission.formId,
        prospect_id: prospectId,
        email,
        ip_address: submission.ipAddress,
        user_agent: submission.userAgent,
        referrer: submission.referrer,
        utm_source: submission.utmSource,
        utm_medium: submission.utmMedium,
        utm_campaign: submission.utmCampaign,
        data: submission.data,
        is_partial: submission.isPartial || false,
        completed_at: submission.isPartial ? null : new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        message: 'Failed to save submission'
      };
    }

    // Add to lists
    if (form.listIds && form.listIds.length > 0 && prospectId) {
      for (const listId of form.listIds) {
        await supabase.from('contact_list_members').insert({
          list_id: listId,
          prospect_id: prospectId
        });
      }
    }

    // Trigger workflow
    if (form.workflowId && prospectId) {
      await supabase.from('workflow_enrollments').insert({
        workflow_id: form.workflowId,
        prospect_id: prospectId,
        status: 'active',
        enrollment_source: 'form',
        enrollment_source_id: submission.formId
      });
    }

    // Send notifications
    if (form.sendNotification && form.notificationRecipients) {
      // TODO: Send email notification to recipients
      console.log('Sending notifications to:', form.notificationRecipients);
    }

    // Send auto-responder
    if (form.autoResponderEnabled && email) {
      // TODO: Send auto-responder email
      console.log('Sending auto-responder to:', email);
    }

    return {
      success: true,
      submissionId: savedSubmission.id,
      prospectId,
      message: form.successMessage,
      redirectUrl: form.redirectUrl
    };
  }

  /**
   * Update partial submission
   */
  async updatePartialSubmission(
    submissionId: string,
    data: Record<string, any>,
    isComplete: boolean = false
  ): Promise<void> {
    await supabase
      .from('form_submissions')
      .update({
        data,
        is_partial: !isComplete,
        completed_at: isComplete ? new Date().toISOString() : null
      })
      .eq('id', submissionId);
  }

  /**
   * Get form submissions
   */
  async getSubmissions(formId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    isPartial?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<FormSubmission[]> {
    let query = supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false });

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters?.isPartial !== undefined) {
      query = query.eq('is_partial', filters.isPartial);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data } = await query;
    return (data || []).map(this.mapSubmission);
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(formId: string, dateRange?: { start: Date; end: Date }): Promise<FormAnalytics> {
    let submissionsQuery = supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId);

    let viewsQuery = supabase
      .from('form_views')
      .select('*')
      .eq('form_id', formId);

    if (dateRange) {
      submissionsQuery = submissionsQuery
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      viewsQuery = viewsQuery
        .gte('viewed_at', dateRange.start.toISOString())
        .lte('viewed_at', dateRange.end.toISOString());
    }

    const { data: submissions } = await submissionsQuery;
    const { data: views } = await viewsQuery;

    const totalSubmissions = submissions?.filter(s => !s.is_partial).length || 0;
    const uniqueSubmissions = new Set(submissions?.filter(s => !s.is_partial).map(s => s.email)).size;
    const totalViews = views?.length || 0;
    const conversionRate = totalViews > 0 ? (totalSubmissions / totalViews) * 100 : 0;

    // Calculate completion times
    const completionTimes = submissions
      ?.filter(s => s.completed_at && !s.is_partial)
      .map(s => new Date(s.completed_at!).getTime() - new Date(s.created_at).getTime()) || [];
    const avgCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    // Field analytics (placeholder - would need more detailed tracking)
    const fieldAnalytics: FormAnalytics['fieldAnalytics'] = [];

    // Submissions by date
    const submissionsByDate = this.groupByDate(submissions || []);

    // Device breakdown (placeholder - would parse user agent)
    const deviceBreakdown = {
      desktop: 0,
      mobile: 0,
      tablet: 0
    };

    // Top referrers
    const referrerCounts: Record<string, number> = {};
    views?.forEach(v => {
      if (v.referrer) {
        referrerCounts[v.referrer] = (referrerCounts[v.referrer] || 0) + 1;
      }
    });
    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSubmissions,
      uniqueSubmissions,
      totalViews,
      conversionRate,
      avgCompletionTime,
      fieldAnalytics,
      submissionsByDate,
      deviceBreakdown,
      topReferrers
    };
  }

  /**
   * Duplicate form
   */
  async duplicateForm(formId: string, newName: string): Promise<Form> {
    const original = await this.getForm(formId);

    return this.createForm({
      name: newName,
      description: original.description,
      fields: original.fields,
      submitButtonText: original.submitButtonText,
      successMessage: original.successMessage,
      redirectUrl: original.redirectUrl,
      enableRecaptcha: original.enableRecaptcha,
      requireEmailConfirmation: original.requireEmailConfirmation,
      sendNotification: original.sendNotification,
      notificationRecipients: original.notificationRecipients,
      autoResponderEnabled: original.autoResponderEnabled,
      autoResponderSubject: original.autoResponderSubject,
      autoResponderMessage: original.autoResponderMessage,
      customCss: original.customCss,
      theme: original.theme,
      formType: original.formType,
      enableProgressBar: original.enableProgressBar,
      allowPartialSubmissions: original.allowPartialSubmissions,
      maxSubmissionsPerContact: original.maxSubmissionsPerContact
    });
  }

  /**
   * Delete form
   */
  async deleteForm(formId: string): Promise<void> {
    await supabase
      .from('forms')
      .delete()
      .eq('id', formId);
  }

  /**
   * Get embed code
   */
  getEmbedCode(formId: string, options?: {
    inline?: boolean;
    width?: string;
    height?: string;
  }): string {
    const width = options?.width || '100%';
    const height = options?.height || '600px';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.airevenueorc.com';

    if (options?.inline) {
      return `<div id="airo-form-${formId}" data-form-id="${formId}"></div>
<script src="${baseUrl}/embed/form.js"></script>
<script>AIROForm.render('${formId}', { container: '#airo-form-${formId}' });</script>`;
    }

    return `<iframe
  src="${baseUrl}/forms/${formId}/embed"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: none;"
></iframe>`;
  }

  /**
   * Validate submission data
   */
  private validateSubmission(fields: FormField[], data: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field.name];

      // Required validation
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }

      // Skip further validation if field is empty and not required
      if (!value) continue;

      // Type validation
      if (field.type === 'email' && !this.isValidEmail(value)) {
        errors.push(`${field.label} must be a valid email address`);
      }

      if (field.type === 'phone' && !this.isValidPhone(value)) {
        errors.push(`${field.label} must be a valid phone number`);
      }

      if (field.type === 'number' && isNaN(Number(value))) {
        errors.push(`${field.label} must be a number`);
      }

      // Custom validation
      if (field.validation) {
        const val = field.validation;

        if (val.min !== undefined && Number(value) < val.min) {
          errors.push(`${field.label} must be at least ${val.min}`);
        }

        if (val.max !== undefined && Number(value) > val.max) {
          errors.push(`${field.label} must be at most ${val.max}`);
        }

        if (val.minLength !== undefined && String(value).length < val.minLength) {
          errors.push(`${field.label} must be at least ${val.minLength} characters`);
        }

        if (val.maxLength !== undefined && String(value).length > val.maxLength) {
          errors.push(`${field.label} must be at most ${val.maxLength} characters`);
        }

        if (val.pattern && !new RegExp(val.pattern).test(String(value))) {
          errors.push(val.customErrorMessage || `${field.label} format is invalid`);
        }
      }
    }

    return errors;
  }

  /**
   * Update prospect from form data
   */
  private async updateProspectFromFormData(prospectId: string, data: Record<string, any>): Promise<void> {
    const updates: any = {};

    // Map common fields
    if (data.first_name || data.firstName) {
      updates.first_name = data.first_name || data.firstName;
    }

    if (data.last_name || data.lastName) {
      updates.last_name = data.last_name || data.lastName;
    }

    if (data.phone) {
      updates.phone = data.phone;
    }

    if (data.company) {
      updates.company = data.company;
    }

    if (data.job_title || data.jobTitle) {
      updates.job_title = data.job_title || data.jobTitle;
    }

    if (data.website) {
      updates.website = data.website;
    }

    if (data.linkedin) {
      updates.linkedin = data.linkedin;
    }

    // Store custom fields in metadata
    const customFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!['email', 'first_name', 'firstName', 'last_name', 'lastName', 'phone', 'company', 'job_title', 'jobTitle', 'website', 'linkedin'].includes(key)) {
        customFields[key] = value;
      }
    }

    if (Object.keys(customFields).length > 0) {
      updates.custom_fields = customFields;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('prospects')
        .update(updates)
        .eq('id', prospectId);
    }
  }

  /**
   * Group submissions by date
   */
  private groupByDate(submissions: any[]): Array<{ date: string; submissions: number; views: number }> {
    const groups: Record<string, { submissions: number; views: number }> = {};

    submissions.forEach(s => {
      const date = new Date(s.created_at).toISOString().split('T')[0];
      if (!groups[date]) {
        groups[date] = { submissions: 0, views: 0 };
      }
      groups[date].submissions++;
    });

    return Object.entries(groups)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Validate email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Map database record to Form
   */
  private mapForm(data: any): Form {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status,
      fields: data.fields,
      submitButtonText: data.submit_button_text,
      successMessage: data.success_message,
      redirectUrl: data.redirect_url,
      enableRecaptcha: data.enable_recaptcha,
      requireEmailConfirmation: data.require_email_confirmation,
      sendNotification: data.send_notification,
      notificationRecipients: data.notification_recipients,
      autoResponderEnabled: data.auto_responder_enabled,
      autoResponderSubject: data.auto_responder_subject,
      autoResponderMessage: data.auto_responder_message,
      customCss: data.custom_css,
      theme: data.theme,
      workflowId: data.workflow_id,
      listIds: data.list_ids,
      formType: data.form_type,
      submissions: data.submissions,
      views: data.views,
      conversionRate: data.conversion_rate,
      enableProgressBar: data.enable_progress_bar,
      allowPartialSubmissions: data.allow_partial_submissions,
      maxSubmissionsPerContact: data.max_submissions_per_contact,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  /**
   * Map database record to FormSubmission
   */
  private mapSubmission(data: any): FormSubmission {
    return {
      id: data.id,
      formId: data.form_id,
      prospectId: data.prospect_id,
      email: data.email,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      referrer: data.referrer,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      data: data.data,
      isPartial: data.is_partial,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      createdAt: new Date(data.created_at)
    };
  }
}

/**
 * Create Form Service
 */
export function createFormService(): FormService {
  return new FormService();
}
