/**
 * Research Orchestrator
 * Coordinates multi-source research, scheduling, and quality management
 */

import { supabase } from '../supabase';
import {
  aggregateCompanyResearch,
  type CompanyIntelligence,
  type ResearchSource,
} from './researchProviders';
import { routeAIRequest } from '../ai/modelRouter';

export interface ResearchJob {
  id: string;
  companyProfileId: string;
  companyName: string;
  websiteUrl?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ResearchSchedule {
  id: string;
  companyProfileId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun?: string;
  nextRun: string;
  isActive: boolean;
}

export interface ResearchQualityReport {
  overallScore: number;
  completeness: number;
  freshness: number;
  sourceCount: number;
  missingData: string[];
  recommendations: string[];
}

/**
 * Research Orchestrator Class
 */
export class ResearchOrchestrator {
  /**
   * Execute comprehensive research on a company
   */
  async executeResearch(
    teamId: string,
    companyProfileId: string,
    companyName: string,
    websiteUrl?: string
  ): Promise<CompanyIntelligence> {
    console.log(`Starting research for ${companyName}...`);

    try {
      // Create research job
      const job = await this.createResearchJob(companyProfileId, companyName, websiteUrl);

      // Update job status
      await this.updateJobStatus(job.id, 'running', 25);

      // Gather data from all sources
      const intelligence = await aggregateCompanyResearch(companyName, websiteUrl);

      await this.updateJobStatus(job.id, 'running', 50);

      // Enhance with AI analysis
      const aiAnalysis = await this.enhanceWithAI(intelligence, teamId);

      await this.updateJobStatus(job.id, 'running', 75);

      // Store results
      await this.storeResearchResults(teamId, companyProfileId, intelligence, aiAnalysis);

      await this.updateJobStatus(job.id, 'completed', 100);

      return {
        ...intelligence,
        aggregatedData: {
          ...intelligence.aggregatedData,
          aiAnalysis,
        },
      };
    } catch (error: any) {
      console.error('Research execution failed:', error);
      throw error;
    }
  }

  /**
   * Create a research job
   */
  private async createResearchJob(
    companyProfileId: string,
    companyName: string,
    websiteUrl?: string
  ): Promise<ResearchJob> {
    const { data, error } = await supabase
      .from('research_jobs')
      .insert({
        company_profile_id: companyProfileId,
        company_name: companyName,
        website_url: websiteUrl,
        status: 'pending',
        progress: 0,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      companyProfileId: data.company_profile_id,
      companyName: data.company_name,
      websiteUrl: data.website_url,
      status: data.status,
      progress: data.progress,
      startedAt: data.started_at,
    };
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: ResearchJob['status'],
    progress: number,
    error?: string
  ): Promise<void> {
    const updates: any = { status, progress };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    if (error) {
      updates.error = error;
    }

    await supabase.from('research_jobs').update(updates).eq('id', jobId);
  }

  /**
   * Enhance research with AI analysis
   */
  private async enhanceWithAI(
    intelligence: CompanyIntelligence,
    teamId: string
  ): Promise<any> {
    const prompt = `Analyze this company intelligence and provide strategic insights:

Company: ${intelligence.companyName}

Overview: ${JSON.stringify(intelligence.aggregatedData.overview, null, 2)}
Funding: ${JSON.stringify(intelligence.aggregatedData.funding, null, 2)}
Recent News: ${JSON.stringify(intelligence.aggregatedData.news?.slice(0, 3), null, 2)}
Buying Signals: ${JSON.stringify(intelligence.aggregatedData.signals, null, 2)}

Provide:
1. Executive Summary (2-3 sentences about the company)
2. Market Position (their competitive standing)
3. Growth Indicators (signs of growth or challenges)
4. Ideal Customer Profile (who they sell to)
5. Pain Points (likely challenges they face)
6. Buying Committee (key decision-maker roles)
7. Engagement Strategy (how to approach them)
8. Value Proposition Alignment (how our solution fits)

Format as JSON.`;

    try {
      const response = await routeAIRequest(prompt, {
        taskType: 'company-research',
        teamId,
        fallbackEnabled: true,
      });

      const analysis = JSON.parse(response.response);
      return analysis;
    } catch (error) {
      console.error('AI enhancement failed:', error);
      return {
        executiveSummary: `${intelligence.companyName} is a company in the technology sector.`,
        note: 'AI analysis unavailable',
      };
    }
  }

  /**
   * Store research results in database
   */
  private async storeResearchResults(
    teamId: string,
    companyProfileId: string,
    intelligence: CompanyIntelligence,
    aiAnalysis: any
  ): Promise<void> {
    // Store each source separately
    for (const source of intelligence.sources) {
      await supabase.from('company_research_sources').upsert({
        company_profile_id: companyProfileId,
        source_type: source.type,
        source_name: source.name,
        source_data: source.data,
        quality_score: Math.round(source.confidence * 100),
        last_updated: source.lastUpdated,
      });
    }

    // Update company profile with aggregated data
    await supabase.from('company_profiles').update({
      research_data: intelligence.aggregatedData,
      ai_analysis: aiAnalysis,
      research_quality_score: intelligence.qualityScore,
      research_completeness: intelligence.completeness,
      research_freshness: intelligence.freshness,
      last_researched_at: new Date().toISOString(),
    }).eq('id', companyProfileId);

    // Detect and log changes
    await this.detectChanges(companyProfileId, intelligence);
  }

  /**
   * Detect significant changes from previous research
   */
  private async detectChanges(
    companyProfileId: string,
    newIntelligence: CompanyIntelligence
  ): Promise<void> {
    // Get previous research
    const { data: previous } = await supabase
      .from('company_profiles')
      .select('research_data')
      .eq('id', companyProfileId)
      .single();

    if (!previous?.research_data) return;

    const changes: any[] = [];

    // Check funding changes
    if (
      newIntelligence.aggregatedData.funding?.total !==
      previous.research_data.funding?.total
    ) {
      changes.push({
        type: 'funding',
        description: `Funding changed from $${previous.research_data.funding?.total} to $${newIntelligence.aggregatedData.funding?.total}`,
        detected_at: new Date().toISOString(),
      });
    }

    // Check for new signals
    const oldSignals = previous.research_data.signals || [];
    const newSignals = newIntelligence.aggregatedData.signals || [];

    if (newSignals.length > oldSignals.length) {
      changes.push({
        type: 'new_signals',
        description: `${newSignals.length - oldSignals.length} new buying signals detected`,
        detected_at: new Date().toISOString(),
      });
    }

    // Store changes
    if (changes.length > 0) {
      for (const change of changes) {
        await supabase.from('company_change_log').insert({
          company_profile_id: companyProfileId,
          change_type: change.type,
          change_description: change.description,
          detected_at: change.detected_at,
        });
      }
    }
  }

  /**
   * Schedule automated research
   */
  async scheduleResearch(
    teamId: string,
    companyProfileId: string,
    frequency: 'daily' | 'weekly' | 'monthly'
  ): Promise<ResearchSchedule> {
    const nextRun = this.calculateNextRun(frequency);

    const { data, error } = await supabase
      .from('research_schedules')
      .upsert({
        team_id: teamId,
        company_profile_id: companyProfileId,
        frequency,
        next_run: nextRun,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      companyProfileId: data.company_profile_id,
      frequency: data.frequency,
      lastRun: data.last_run,
      nextRun: data.next_run,
      isActive: data.is_active,
    };
  }

  /**
   * Calculate next run time based on frequency
   */
  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): string {
    const now = new Date();

    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }

    return now.toISOString();
  }

  /**
   * Run scheduled research jobs
   */
  async runScheduledJobs(teamId: string): Promise<void> {
    const { data: schedules } = await supabase
      .from('research_schedules')
      .select('*, company_profiles(*)')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .lte('next_run', new Date().toISOString());

    if (!schedules || schedules.length === 0) return;

    for (const schedule of schedules) {
      try {
        await this.executeResearch(
          teamId,
          schedule.company_profile_id,
          schedule.company_profiles.name,
          schedule.company_profiles.website
        );

        // Update schedule
        await supabase
          .from('research_schedules')
          .update({
            last_run: new Date().toISOString(),
            next_run: this.calculateNextRun(schedule.frequency),
          })
          .eq('id', schedule.id);
      } catch (error) {
        console.error(`Scheduled research failed for ${schedule.company_profile_id}:`, error);
      }
    }
  }

  /**
   * Generate quality report
   */
  async generateQualityReport(companyProfileId: string): Promise<ResearchQualityReport> {
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', companyProfileId)
      .single();

    if (!profile) {
      throw new Error('Company profile not found');
    }

    const { data: sources } = await supabase
      .from('company_research_sources')
      .select('*')
      .eq('company_profile_id', companyProfileId);

    const missingData: string[] = [];
    const recommendations: string[] = [];

    // Check completeness
    if (!profile.research_data?.overview) {
      missingData.push('Company overview');
      recommendations.push('Run initial research to gather company overview');
    }

    if (!profile.research_data?.funding) {
      missingData.push('Funding information');
    }

    if (!profile.research_data?.news || profile.research_data.news.length === 0) {
      missingData.push('Recent news');
      recommendations.push('Enable news monitoring to track company updates');
    }

    if (!profile.research_data?.techStack) {
      missingData.push('Technology stack');
      recommendations.push('Analyze company website to identify tech stack');
    }

    // Check freshness
    const daysSinceResearch = profile.last_researched_at
      ? (Date.now() - new Date(profile.last_researched_at).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    if (daysSinceResearch > 30) {
      recommendations.push('Research data is outdated - schedule refresh');
    }

    if (daysSinceResearch > 90) {
      recommendations.push('Consider increasing research frequency');
    }

    // Check source diversity
    if (!sources || sources.length < 3) {
      recommendations.push('Add more research sources for comprehensive intelligence');
    }

    return {
      overallScore: profile.research_quality_score || 0,
      completeness: profile.research_completeness || 0,
      freshness: profile.research_freshness || 0,
      sourceCount: sources?.length || 0,
      missingData,
      recommendations,
    };
  }

  /**
   * Get research history
   */
  async getResearchHistory(companyProfileId: string, limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('company_profile_id', companyProfileId)
      .order('started_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Get company changes
   */
  async getCompanyChanges(companyProfileId: string, daysBack: number = 90): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const { data } = await supabase
      .from('company_change_log')
      .select('*')
      .eq('company_profile_id', companyProfileId)
      .gte('detected_at', since.toISOString())
      .order('detected_at', { ascending: false });

    return data || [];
  }
}

// Export singleton instance
export const researchOrchestrator = new ResearchOrchestrator();
