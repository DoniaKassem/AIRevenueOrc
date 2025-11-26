/**
 * Prospect-to-Outreach Pipeline
 * Complete end-to-end workflow: CRM Import → Multi-Source Enrichment → Deep Research → AI Outreach
 */

import { supabase } from '../supabase';
import { SalesforceClient, createSalesforceClient } from '../crm/salesforce';
import { HubSpotClient, createHubSpotClient } from '../crm/hubspot';
import {
  MultiSourceEnrichmentPipeline,
  runEnrichmentPipeline,
  ProspectSignals,
  EnrichmentPipelineResult,
} from '../enrichment/multiSourcePipeline';
import { researchOrchestrator } from '../research/researchOrchestrator';
import {
  EnhancedAIEmailWriter,
  createEnhancedEmailWriter,
  EnhancedEmailResult,
  EmailSequence,
} from '../ai/enhancedEmailWriter';
import {
  transformSignalsToOutreach,
  PersonalizationContext,
} from '../ai/signalToOutreach';
import {
  AdvancedPersonalizationEngine,
  PersonalizedContent,
  generateAdvancedPersonalization,
} from '../ai/advancedPersonalization';
import {
  IndustryMessagingEngine,
  createIndustryMessagingEngine,
} from '../ai/industryMessaging';
import {
  EmailOptimizer,
  createEmailOptimizer,
} from '../ai/emailOptimizer';

// =============================================
// TYPES & INTERFACES
// =============================================

export interface PipelineConfig {
  teamId: string;
  crmSource: 'salesforce' | 'hubspot' | 'manual';
  enrichmentProviders: string[];
  enableDeepResearch: boolean;
  enableAIEnhancement: boolean;
  emailType: 'cold_outreach' | 'follow_up' | 'trigger_based';
  generateSequence: boolean;
  sequenceLength?: number;

  // Advanced personalization options
  enableAdvancedPersonalization?: boolean;
  enableIndustryMessaging?: boolean;
  enableEmailOptimization?: boolean;
  productContext?: {
    productName: string;
    valueProps: string[];
    targetPersonas: string[];
    competitors: string[];
  };
}

export interface PipelineInput {
  // Option 1: Prospect ID (if already in system)
  prospectId?: string;

  // Option 2: CRM entity reference
  crmEntityId?: string;
  crmEntityType?: 'contact' | 'lead';

  // Option 3: Raw prospect data
  prospectData?: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    linkedinUrl?: string;
    phone?: string;
  };
}

export interface PipelineStepResult {
  step: string;
  status: 'completed' | 'failed' | 'skipped';
  duration: number;
  data?: any;
  error?: string;
}

export interface PipelineResult {
  success: boolean;
  prospectId: string;
  steps: PipelineStepResult[];
  totalDuration: number;

  // Outputs
  signals?: ProspectSignals;
  personalizationContext?: PersonalizationContext;
  generatedEmail?: EnhancedEmailResult;
  generatedSequence?: EmailSequence;

  // Advanced AI outputs
  advancedPersonalization?: PersonalizedContent;
  industryMessaging?: {
    industryRelevantOpener: string;
    industryPainPoint: string;
    industryValueProp: string;
    industryProof: string;
    industryCTA: string;
    industryTermsUsed: string[];
    industryTrend: string;
  };

  // Metrics
  enrichmentScore: number;
  personalizationScore: number;
  dataSourcesUsed: string[];
}

export interface BatchPipelineResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    prospectId: string;
    success: boolean;
    error?: string;
  }>;
}

// =============================================
// PROSPECT-TO-OUTREACH PIPELINE
// =============================================

export class ProspectToOutreachPipeline {
  private config: PipelineConfig;
  private emailWriter: EnhancedAIEmailWriter;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.emailWriter = createEnhancedEmailWriter();
  }

  /**
   * Execute the complete pipeline for a single prospect
   */
  async execute(input: PipelineInput): Promise<PipelineResult> {
    const startTime = Date.now();
    const steps: PipelineStepResult[] = [];
    let prospectId: string;

    console.log(`[Pipeline] Starting prospect-to-outreach pipeline...`);

    // STEP 1: Import/Create Prospect
    const importResult = await this.executeStep('import_prospect', async () => {
      return this.importOrCreateProspect(input);
    });
    steps.push(importResult);

    if (importResult.status === 'failed') {
      return this.buildFailedResult(prospectId!, steps, startTime);
    }
    prospectId = importResult.data.prospectId;

    // STEP 2: Run Multi-Source Enrichment
    let enrichmentResult: EnrichmentPipelineResult | undefined;
    const enrichStep = await this.executeStep('multi_source_enrichment', async () => {
      enrichmentResult = await runEnrichmentPipeline(this.config.teamId, prospectId);
      return enrichmentResult;
    });
    steps.push(enrichStep);

    // STEP 3: Deep Company Research (if enabled)
    if (this.config.enableDeepResearch) {
      const researchStep = await this.executeStep('deep_research', async () => {
        return this.executeDeepResearch(prospectId);
      });
      steps.push(researchStep);
    }

    // STEP 4: Get/Update Signals
    const signalsStep = await this.executeStep('get_signals', async () => {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('enrichment_data')
        .eq('id', prospectId)
        .single();
      return prospect?.enrichment_data;
    });
    steps.push(signalsStep);

    const signals = signalsStep.data as ProspectSignals;

    // STEP 5: Transform to Personalization Context
    let personalizationContext: PersonalizationContext | undefined;
    const transformStep = await this.executeStep('transform_signals', async () => {
      if (signals) {
        personalizationContext = await transformSignalsToOutreach(
          signals,
          this.config.enableAIEnhancement
        );
        return personalizationContext;
      }
      return null;
    });
    steps.push(transformStep);

    // STEP 6: Advanced Personalization (if enabled)
    let advancedPersonalization: PersonalizedContent | undefined;
    if (this.config.enableAdvancedPersonalization) {
      const advancedStep = await this.executeStep('advanced_personalization', async () => {
        advancedPersonalization = await generateAdvancedPersonalization(
          prospectId,
          this.config.productContext
        );
        return advancedPersonalization;
      });
      steps.push(advancedStep);
    }

    // STEP 7: Industry-Specific Messaging (if enabled)
    let industryMessaging: PipelineResult['industryMessaging'];
    if (this.config.enableIndustryMessaging && signals) {
      const industryStep = await this.executeStep('industry_messaging', async () => {
        const engine = createIndustryMessagingEngine();
        const valueProposition = this.config.productContext?.valueProps?.[0] ||
          'Help you achieve better results';
        industryMessaging = await engine.generateIndustryMessaging(signals, valueProposition);
        return industryMessaging;
      });
      steps.push(industryStep);
    }

    // STEP 8: Generate Email
    let generatedEmail: EnhancedEmailResult | undefined;
    const emailStep = await this.executeStep('generate_email', async () => {
      generatedEmail = await this.emailWriter.generateEmail({
        prospectId,
        emailType: this.config.emailType,
      });
      return generatedEmail;
    });
    steps.push(emailStep);

    // STEP 9: Optimize Email (if enabled)
    if (this.config.enableEmailOptimization && generatedEmail) {
      const optimizeStep = await this.executeStep('optimize_email', async () => {
        const optimizer = createEmailOptimizer();
        const optimized = await optimizer.optimizeEmailBeforeSend(
          this.config.teamId,
          { subject: generatedEmail!.subject, body: generatedEmail!.body },
          {
            title: signals?.professional.title,
            industry: signals?.company.industry,
            seniority: signals?.professional.seniority,
            buyingStage: signals?.intent.buyingStage,
          }
        );

        // Apply optimizations if changes were made
        if (optimized.changes.length > 0) {
          generatedEmail = {
            ...generatedEmail!,
            subject: optimized.optimizedSubject,
            body: optimized.optimizedBody,
            metadata: {
              ...generatedEmail!.metadata,
              optimized: true,
              optimizationChanges: optimized.changes,
              expectedImprovements: optimized.expectedImprovements,
            },
          };
        }
        return optimized;
      });
      steps.push(optimizeStep);
    }

    // STEP 10: Generate Sequence (if enabled)
    let generatedSequence: EmailSequence | undefined;
    if (this.config.generateSequence) {
      const sequenceStep = await this.executeStep('generate_sequence', async () => {
        generatedSequence = await this.emailWriter.generateSequence(
          prospectId,
          this.config.sequenceLength || 5
        );
        return generatedSequence;
      });
      steps.push(sequenceStep);
    }

    // Calculate metrics
    const dataSourcesUsed = enrichmentResult?.sourceResults
      .filter(r => r.success)
      .map(r => r.source) || [];

    const enrichmentScore = signals?.metadata.qualityScore || 0;
    const personalizationScore = personalizationContext?.personalizationScore || 0;

    // Log pipeline execution
    await this.logPipelineExecution(prospectId, steps, {
      enrichmentScore,
      personalizationScore,
      dataSourcesUsed,
    });

    return {
      success: true,
      prospectId,
      steps,
      totalDuration: Date.now() - startTime,
      signals,
      personalizationContext,
      generatedEmail,
      generatedSequence,
      advancedPersonalization,
      industryMessaging,
      enrichmentScore,
      personalizationScore,
      dataSourcesUsed,
    };
  }

  /**
   * Execute pipeline for multiple prospects in batch
   */
  async executeBatch(
    inputs: PipelineInput[],
    concurrency: number = 3
  ): Promise<BatchPipelineResult> {
    const results: BatchPipelineResult['results'] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < inputs.length; i += concurrency) {
      const batch = inputs.slice(i, i + concurrency);

      const batchResults = await Promise.allSettled(
        batch.map(input => this.execute(input))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];

        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
          results.push({
            prospectId: result.value.prospectId,
            success: true,
          });
        } else {
          failed++;
          results.push({
            prospectId: batch[j].prospectId || 'unknown',
            success: false,
            error: result.status === 'rejected'
              ? result.reason?.message
              : 'Pipeline failed',
          });
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + concurrency < inputs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      total: inputs.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Import from CRM or create prospect
   */
  private async importOrCreateProspect(input: PipelineInput): Promise<{ prospectId: string }> {
    // If we already have a prospect ID, just return it
    if (input.prospectId) {
      return { prospectId: input.prospectId };
    }

    // If we have raw prospect data, create/upsert the prospect
    if (input.prospectData) {
      const { data: existing } = await supabase
        .from('prospects')
        .select('id')
        .eq('email', input.prospectData.email)
        .eq('team_id', this.config.teamId)
        .single();

      if (existing) {
        // Update existing
        await supabase
          .from('prospects')
          .update({
            first_name: input.prospectData.firstName,
            last_name: input.prospectData.lastName,
            company: input.prospectData.company,
            title: input.prospectData.title,
            linkedin_url: input.prospectData.linkedinUrl,
            phone: input.prospectData.phone,
          })
          .eq('id', existing.id);

        return { prospectId: existing.id };
      }

      // Create new
      const { data: newProspect, error } = await supabase
        .from('prospects')
        .insert({
          team_id: this.config.teamId,
          email: input.prospectData.email,
          first_name: input.prospectData.firstName,
          last_name: input.prospectData.lastName,
          company: input.prospectData.company,
          title: input.prospectData.title,
          linkedin_url: input.prospectData.linkedinUrl,
          phone: input.prospectData.phone,
          status: 'new',
          source: 'pipeline_import',
        })
        .select()
        .single();

      if (error) throw error;
      return { prospectId: newProspect.id };
    }

    // If we have CRM entity reference, import from CRM
    if (input.crmEntityId) {
      return this.importFromCRM(input.crmEntityId, input.crmEntityType || 'contact');
    }

    throw new Error('No valid input provided for prospect creation');
  }

  /**
   * Import prospect from CRM
   */
  private async importFromCRM(
    entityId: string,
    entityType: 'contact' | 'lead'
  ): Promise<{ prospectId: string }> {
    if (this.config.crmSource === 'salesforce') {
      return this.importFromSalesforce(entityId, entityType);
    } else if (this.config.crmSource === 'hubspot') {
      return this.importFromHubSpot(entityId, entityType);
    }

    throw new Error(`Unsupported CRM source: ${this.config.crmSource}`);
  }

  /**
   * Import from Salesforce
   */
  private async importFromSalesforce(
    entityId: string,
    entityType: 'contact' | 'lead'
  ): Promise<{ prospectId: string }> {
    // Get Salesforce connection
    const { data: connection } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('team_id', this.config.teamId)
      .eq('provider', 'salesforce')
      .eq('is_active', true)
      .single();

    if (!connection) {
      throw new Error('Salesforce not connected');
    }

    const sfClient = createSalesforceClient(
      connection,
      process.env.SALESFORCE_CLIENT_ID || '',
      process.env.SALESFORCE_CLIENT_SECRET || ''
    );

    const entity = await sfClient.getEntity(entityType, entityId);
    if (!entity) {
      throw new Error(`${entityType} not found in Salesforce`);
    }

    // Map Salesforce fields to prospect
    const prospectData = {
      email: entity.data.Email,
      firstName: entity.data.FirstName,
      lastName: entity.data.LastName,
      company: entity.data.Company || entity.data.Account?.Name,
      title: entity.data.Title,
      phone: entity.data.Phone || entity.data.MobilePhone,
      linkedinUrl: entity.data.LinkedIn_URL__c, // Custom field example
    };

    return this.importOrCreateProspect({ prospectData });
  }

  /**
   * Import from HubSpot
   */
  private async importFromHubSpot(
    entityId: string,
    entityType: 'contact' | 'lead'
  ): Promise<{ prospectId: string }> {
    // Get HubSpot connection
    const { data: connection } = await supabase
      .from('crm_connections')
      .select('*')
      .eq('team_id', this.config.teamId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!connection) {
      throw new Error('HubSpot not connected');
    }

    const hsClient = createHubSpotClient(connection);
    const entity = await hsClient.getEntity('contact', entityId);

    if (!entity) {
      throw new Error('Contact not found in HubSpot');
    }

    // Map HubSpot fields to prospect
    const prospectData = {
      email: entity.data.email,
      firstName: entity.data.firstname,
      lastName: entity.data.lastname,
      company: entity.data.company,
      title: entity.data.jobtitle,
      phone: entity.data.phone || entity.data.mobilephone,
      linkedinUrl: entity.data.linkedinbio,
    };

    return this.importOrCreateProspect({ prospectData });
  }

  /**
   * Execute deep company research
   */
  private async executeDeepResearch(prospectId: string): Promise<any> {
    // Get prospect's company
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, company_profiles(*)')
      .eq('id', prospectId)
      .single();

    if (!prospect?.company) {
      return { skipped: true, reason: 'No company information' };
    }

    // Find or create company profile
    let companyProfileId: string;

    if (prospect.company_profiles?.id) {
      companyProfileId = prospect.company_profiles.id;
    } else {
      // Create company profile
      const { data: newProfile } = await supabase
        .from('company_profiles')
        .insert({
          team_id: this.config.teamId,
          name: prospect.company,
          domain: this.extractDomain(prospect.email),
        })
        .select()
        .single();

      if (!newProfile) {
        return { skipped: true, reason: 'Could not create company profile' };
      }

      companyProfileId = newProfile.id;

      // Link prospect to company
      await supabase
        .from('prospects')
        .update({ company_profile_id: companyProfileId })
        .eq('id', prospectId);
    }

    // Execute research
    const research = await researchOrchestrator.executeResearch(
      this.config.teamId,
      companyProfileId,
      prospect.company,
      this.extractDomain(prospect.email)
    );

    // Update prospect signals with research data
    const { data: currentProspect } = await supabase
      .from('prospects')
      .select('enrichment_data')
      .eq('id', prospectId)
      .single();

    if (currentProspect?.enrichment_data) {
      const signals = currentProspect.enrichment_data as ProspectSignals;

      // Add research insights
      signals.research = {
        ...signals.research,
        companyNews: research.aggregatedData?.news?.slice(0, 5).map((n: any) => ({
          title: n.title,
          summary: n.description || '',
          date: n.publishedAt,
          sentiment: 'neutral' as const,
          relevance: 80,
        })),
        painPoints: research.aggregatedData?.aiAnalysis?.painPoints || [],
        priorities: research.aggregatedData?.aiAnalysis?.priorities || [],
        buyingCommittee: research.aggregatedData?.aiAnalysis?.buyingCommittee || [],
      };

      // Update metadata
      signals.metadata.sources.push('deep_research');
      signals.metadata.freshness = 100;

      await supabase
        .from('prospects')
        .update({ enrichment_data: signals })
        .eq('id', prospectId);
    }

    return research;
  }

  /**
   * Execute a pipeline step with timing and error handling
   */
  private async executeStep(
    stepName: string,
    fn: () => Promise<any>
  ): Promise<PipelineStepResult> {
    const startTime = Date.now();

    try {
      const data = await fn();
      return {
        step: stepName,
        status: 'completed',
        duration: Date.now() - startTime,
        data,
      };
    } catch (error) {
      console.error(`[Pipeline] Step ${stepName} failed:`, error);
      return {
        step: stepName,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build failed result
   */
  private buildFailedResult(
    prospectId: string,
    steps: PipelineStepResult[],
    startTime: number
  ): PipelineResult {
    return {
      success: false,
      prospectId,
      steps,
      totalDuration: Date.now() - startTime,
      enrichmentScore: 0,
      personalizationScore: 0,
      dataSourcesUsed: [],
    };
  }

  /**
   * Extract domain from email
   */
  private extractDomain(email: string): string | undefined {
    if (!email || !email.includes('@')) return undefined;
    const domain = email.split('@')[1];
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    return commonDomains.includes(domain) ? undefined : domain;
  }

  /**
   * Log pipeline execution
   */
  private async logPipelineExecution(
    prospectId: string,
    steps: PipelineStepResult[],
    metrics: {
      enrichmentScore: number;
      personalizationScore: number;
      dataSourcesUsed: string[];
    }
  ): Promise<void> {
    await supabase.from('pipeline_executions').insert({
      team_id: this.config.teamId,
      prospect_id: prospectId,
      pipeline_type: 'prospect_to_outreach',
      config: this.config,
      steps,
      enrichment_score: metrics.enrichmentScore,
      personalization_score: metrics.personalizationScore,
      data_sources_used: metrics.dataSourcesUsed,
      executed_at: new Date().toISOString(),
    }).catch(err => {
      // Don't fail pipeline if logging fails
      console.error('[Pipeline] Failed to log execution:', err);
    });
  }
}

// =============================================
// CONVENIENCE FUNCTIONS
// =============================================

/**
 * Run the complete prospect-to-outreach pipeline
 */
export async function runProspectToOutreachPipeline(
  teamId: string,
  input: PipelineInput,
  options: Partial<PipelineConfig> = {}
): Promise<PipelineResult> {
  const config: PipelineConfig = {
    teamId,
    crmSource: options.crmSource || 'manual',
    enrichmentProviders: options.enrichmentProviders || ['zoominfo', 'clearbit', 'linkedin'],
    enableDeepResearch: options.enableDeepResearch ?? true,
    enableAIEnhancement: options.enableAIEnhancement ?? true,
    emailType: options.emailType || 'cold_outreach',
    generateSequence: options.generateSequence ?? false,
    sequenceLength: options.sequenceLength || 5,
    // Advanced AI options
    enableAdvancedPersonalization: options.enableAdvancedPersonalization ?? false,
    enableIndustryMessaging: options.enableIndustryMessaging ?? false,
    enableEmailOptimization: options.enableEmailOptimization ?? false,
    productContext: options.productContext,
  };

  const pipeline = new ProspectToOutreachPipeline(config);
  return pipeline.execute(input);
}

/**
 * Run pipeline with all advanced AI features enabled
 */
export async function runAdvancedPipeline(
  teamId: string,
  input: PipelineInput,
  productContext?: PipelineConfig['productContext']
): Promise<PipelineResult> {
  return runProspectToOutreachPipeline(teamId, input, {
    enableDeepResearch: true,
    enableAIEnhancement: true,
    generateSequence: true,
    enableAdvancedPersonalization: true,
    enableIndustryMessaging: true,
    enableEmailOptimization: true,
    productContext,
  });
}

/**
 * Import prospects from Salesforce and run pipeline
 */
export async function importFromSalesforceAndEnrich(
  teamId: string,
  salesforceIds: string[],
  entityType: 'contact' | 'lead' = 'contact'
): Promise<BatchPipelineResult> {
  const config: PipelineConfig = {
    teamId,
    crmSource: 'salesforce',
    enrichmentProviders: ['zoominfo', 'clearbit', 'linkedin', 'builtwith', 'newsapi'],
    enableDeepResearch: true,
    enableAIEnhancement: true,
    emailType: 'cold_outreach',
    generateSequence: true,
    sequenceLength: 5,
  };

  const pipeline = new ProspectToOutreachPipeline(config);

  const inputs: PipelineInput[] = salesforceIds.map(id => ({
    crmEntityId: id,
    crmEntityType: entityType,
  }));

  return pipeline.executeBatch(inputs, 2);
}

/**
 * Import prospects from HubSpot and run pipeline
 */
export async function importFromHubSpotAndEnrich(
  teamId: string,
  hubspotIds: string[]
): Promise<BatchPipelineResult> {
  const config: PipelineConfig = {
    teamId,
    crmSource: 'hubspot',
    enrichmentProviders: ['zoominfo', 'clearbit', 'linkedin', 'builtwith', 'newsapi'],
    enableDeepResearch: true,
    enableAIEnhancement: true,
    emailType: 'cold_outreach',
    generateSequence: true,
    sequenceLength: 5,
  };

  const pipeline = new ProspectToOutreachPipeline(config);

  const inputs: PipelineInput[] = hubspotIds.map(id => ({
    crmEntityId: id,
    crmEntityType: 'contact' as const,
  }));

  return pipeline.executeBatch(inputs, 2);
}

/**
 * Quick enrich and generate email for a prospect
 */
export async function quickEnrichAndEmail(
  teamId: string,
  prospectId: string
): Promise<PipelineResult> {
  return runProspectToOutreachPipeline(teamId, { prospectId }, {
    enableDeepResearch: false,
    generateSequence: false,
  });
}
