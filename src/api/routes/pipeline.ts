/**
 * Pipeline API Routes
 * Endpoints for the prospect-to-outreach pipeline
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  runProspectToOutreachPipeline,
  runAdvancedPipeline,
  importFromSalesforceAndEnrich,
  importFromHubSpotAndEnrich,
  quickEnrichAndEmail,
  PipelineInput,
  PipelineConfig,
} from '../../lib/workflows/prospectToOutreachPipeline';
import { runEnrichmentPipeline } from '../../lib/enrichment/multiSourcePipeline';
import { generatePersonalizedEmail, generateOutreachSequence } from '../../lib/ai/enhancedEmailWriter';
import { transformSignalsToOutreach } from '../../lib/ai/signalToOutreach';
import { generateAdvancedPersonalization } from '../../lib/ai/advancedPersonalization';
import { analyzeEmailPerformance, optimizeEmail, createEmailOptimizer } from '../../lib/ai/emailOptimizer';
import { generateIndustryTailoredEmail, createIndustryMessagingEngine } from '../../lib/ai/industryMessaging';
import { supabase } from '../../lib/supabase';

const router = Router();

/**
 * POST /api/v1/pipeline/run
 * Run the complete prospect-to-outreach pipeline
 */
router.post('/run', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, prospectData, crmEntityId, crmEntityType, options } = req.body;

    if (!prospectId && !prospectData && !crmEntityId) {
      return res.status(400).json({
        error: 'Must provide prospectId, prospectData, or crmEntityId',
      });
    }

    const input: PipelineInput = {};
    if (prospectId) input.prospectId = prospectId;
    if (prospectData) input.prospectData = prospectData;
    if (crmEntityId) {
      input.crmEntityId = crmEntityId;
      input.crmEntityType = crmEntityType || 'contact';
    }

    const result = await runProspectToOutreachPipeline(
      req.user!.teamId,
      input,
      options || {}
    );

    res.json({
      success: result.success,
      data: {
        prospectId: result.prospectId,
        steps: result.steps,
        totalDuration: result.totalDuration,
        enrichmentScore: result.enrichmentScore,
        personalizationScore: result.personalizationScore,
        dataSourcesUsed: result.dataSourcesUsed,
        generatedEmail: result.generatedEmail ? {
          subject: result.generatedEmail.subject,
          body: result.generatedEmail.body,
          alternativeSubjects: result.generatedEmail.alternativeSubjects,
          signalsUsed: result.generatedEmail.signalsUsed,
        } : null,
        generatedSequence: result.generatedSequence,
        advancedPersonalization: result.advancedPersonalization,
        industryMessaging: result.industryMessaging,
      },
    });
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Pipeline execution failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/run-advanced
 * Run the complete pipeline with all advanced AI features enabled
 */
router.post('/run-advanced', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, prospectData, crmEntityId, crmEntityType, productContext } = req.body;

    if (!prospectId && !prospectData && !crmEntityId) {
      return res.status(400).json({
        error: 'Must provide prospectId, prospectData, or crmEntityId',
      });
    }

    const input: PipelineInput = {};
    if (prospectId) input.prospectId = prospectId;
    if (prospectData) input.prospectData = prospectData;
    if (crmEntityId) {
      input.crmEntityId = crmEntityId;
      input.crmEntityType = crmEntityType || 'contact';
    }

    const result = await runAdvancedPipeline(
      req.user!.teamId,
      input,
      productContext
    );

    res.json({
      success: result.success,
      data: {
        prospectId: result.prospectId,
        steps: result.steps,
        totalDuration: result.totalDuration,
        enrichmentScore: result.enrichmentScore,
        personalizationScore: result.personalizationScore,
        dataSourcesUsed: result.dataSourcesUsed,
        generatedEmail: result.generatedEmail ? {
          subject: result.generatedEmail.subject,
          body: result.generatedEmail.body,
          alternativeSubjects: result.generatedEmail.alternativeSubjects,
          signalsUsed: result.generatedEmail.signalsUsed,
          metadata: result.generatedEmail.metadata,
        } : null,
        generatedSequence: result.generatedSequence,
        advancedPersonalization: result.advancedPersonalization ? {
          persona: result.advancedPersonalization.persona,
          competitiveContext: result.advancedPersonalization.competitiveContext,
          triggerAnalysis: result.advancedPersonalization.triggerAnalysis,
          strategy: result.advancedPersonalization.strategy,
          subjectLines: result.advancedPersonalization.subjectLines,
          emailVariants: result.advancedPersonalization.emailVariants,
          followUpSequence: result.advancedPersonalization.followUpSequence,
          personalizationDepth: result.advancedPersonalization.personalizationDepth,
          confidenceScore: result.advancedPersonalization.confidenceScore,
          reasoningChain: result.advancedPersonalization.reasoningChain,
        } : null,
        industryMessaging: result.industryMessaging,
      },
    });
  } catch (error) {
    console.error('Advanced pipeline error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Advanced pipeline execution failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/enrich
 * Run enrichment only (without email generation)
 */
router.post('/enrich', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    const result = await runEnrichmentPipeline(req.user!.teamId, prospectId);

    res.json({
      success: result.success,
      data: {
        prospectId: result.prospectId,
        signals: result.signals,
        sourceResults: result.sourceResults,
        totalDuration: result.totalDuration,
        creditsUsed: result.creditsUsed,
      },
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Enrichment failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/generate-email
 * Generate a personalized email for an enriched prospect
 */
router.post('/generate-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, emailType, tone, length, customInstructions } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    const result = await generatePersonalizedEmail(prospectId, {
      emailType: emailType || 'cold_outreach',
      tone,
      length,
      customInstructions,
    });

    res.json({
      success: true,
      data: {
        subject: result.subject,
        body: result.body,
        previewText: result.previewText,
        alternativeSubjects: result.alternativeSubjects,
        personalizationScore: result.personalizationScore,
        signalsUsed: result.signalsUsed,
        talkingPointsUsed: result.talkingPointsUsed,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Email generation failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/generate-sequence
 * Generate a complete outreach sequence
 */
router.post('/generate-sequence', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, sequenceLength } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    const result = await generateOutreachSequence(prospectId, sequenceLength || 5);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Sequence generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Sequence generation failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/get-talking-points
 * Get personalization context and talking points for a prospect
 */
router.post('/get-talking-points', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, enhanceWithAI } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    // Get prospect signals
    const { data: prospect } = await supabase
      .from('prospects')
      .select('enrichment_data')
      .eq('id', prospectId)
      .single();

    if (!prospect?.enrichment_data) {
      return res.status(400).json({
        error: 'Prospect has not been enriched. Run enrichment first.',
      });
    }

    const context = await transformSignalsToOutreach(
      prospect.enrichment_data,
      enhanceWithAI !== false
    );

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('Talking points error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get talking points',
    });
  }
});

/**
 * POST /api/v1/pipeline/import/salesforce
 * Import and enrich prospects from Salesforce
 */
router.post('/import/salesforce', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entityIds, entityType } = req.body;

    if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
      return res.status(400).json({ error: 'entityIds array is required' });
    }

    if (entityIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 entities per batch' });
    }

    const result = await importFromSalesforceAndEnrich(
      req.user!.teamId,
      entityIds,
      entityType || 'contact'
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Salesforce import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Salesforce import failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/import/hubspot
 * Import and enrich prospects from HubSpot
 */
router.post('/import/hubspot', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds array is required' });
    }

    if (contactIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 contacts per batch' });
    }

    const result = await importFromHubSpotAndEnrich(req.user!.teamId, contactIds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('HubSpot import error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'HubSpot import failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/quick-enrich
 * Quick enrich and generate email (skip deep research)
 */
router.post('/quick-enrich', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    const result = await quickEnrichAndEmail(req.user!.teamId, prospectId);

    res.json({
      success: result.success,
      data: {
        prospectId: result.prospectId,
        enrichmentScore: result.enrichmentScore,
        personalizationScore: result.personalizationScore,
        dataSourcesUsed: result.dataSourcesUsed,
        generatedEmail: result.generatedEmail,
        totalDuration: result.totalDuration,
      },
    });
  } catch (error) {
    console.error('Quick enrich error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Quick enrich failed',
    });
  }
});

/**
 * GET /api/v1/pipeline/status/:prospectId
 * Get pipeline status and enrichment data for a prospect
 */
router.get('/status/:prospectId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId } = req.params;

    const { data: prospect } = await supabase
      .from('prospects')
      .select(`
        id,
        email,
        first_name,
        last_name,
        title,
        company,
        enrichment_data,
        enriched_at,
        intent_score,
        quality_score
      `)
      .eq('id', prospectId)
      .eq('team_id', req.user!.teamId)
      .single();

    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    // Get enrichment history
    const { data: enrichmentHistory } = await supabase
      .from('enrichment_requests')
      .select('provider, status, created_at, credits_used')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get generated emails
    const { data: generatedEmails } = await supabase
      .from('ai_email_generations')
      .select('purpose, subject, generated_at')
      .eq('prospect_id', prospectId)
      .order('generated_at', { ascending: false })
      .limit(5);

    res.json({
      success: true,
      data: {
        prospect: {
          id: prospect.id,
          email: prospect.email,
          name: `${prospect.first_name} ${prospect.last_name}`,
          title: prospect.title,
          company: prospect.company,
          enrichedAt: prospect.enriched_at,
          intentScore: prospect.intent_score,
          qualityScore: prospect.quality_score,
        },
        signals: prospect.enrichment_data,
        enrichmentHistory,
        generatedEmails,
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Status check failed',
    });
  }
});

// =============================================
// ADVANCED AI PERSONALIZATION ENDPOINTS
// =============================================

/**
 * POST /api/v1/pipeline/advanced-personalization
 * Generate deeply personalized content using multi-step AI reasoning
 */
router.post('/advanced-personalization', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, productContext } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    const result = await generateAdvancedPersonalization(prospectId, productContext);

    res.json({
      success: true,
      data: {
        persona: result.persona,
        competitiveContext: result.competitiveContext,
        triggerAnalysis: result.triggerAnalysis,
        strategy: result.strategy,
        subjectLines: result.subjectLines,
        emailVariants: result.emailVariants,
        followUpSequence: result.followUpSequence,
        personalizationDepth: result.personalizationDepth,
        confidenceScore: result.confidenceScore,
        reasoningChain: result.reasoningChain,
      },
    });
  } catch (error) {
    console.error('Advanced personalization error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Advanced personalization failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/analyze-performance
 * Analyze email performance and get optimization insights
 */
router.post('/analyze-performance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { daysBack } = req.body;

    const report = await analyzeEmailPerformance(req.user!.teamId, daysBack || 30);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Performance analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Performance analysis failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/optimize-email
 * Optimize an email before sending based on historical performance
 */
router.post('/optimize-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, prospectContext } = req.body;

    if (!email || !email.subject || !email.body) {
      return res.status(400).json({ error: 'email with subject and body is required' });
    }

    const result = await optimizeEmail(req.user!.teamId, email, prospectContext || {});

    res.json({
      success: true,
      data: {
        optimizedSubject: result.optimizedSubject,
        optimizedBody: result.optimizedBody,
        changes: result.changes,
        expectedImprovements: result.expectedImprovements,
      },
    });
  } catch (error) {
    console.error('Email optimization error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Email optimization failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/analyze-reply
 * Analyze a prospect's reply and get recommended response
 */
router.post('/analyze-reply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { originalEmail, replyContent, prospectContext } = req.body;

    if (!originalEmail || !replyContent) {
      return res.status(400).json({ error: 'originalEmail and replyContent are required' });
    }

    const optimizer = createEmailOptimizer();
    const analysis = await optimizer.analyzeReply(originalEmail, replyContent, prospectContext || {});

    res.json({
      success: true,
      data: {
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        keyObjections: analysis.keyObjections,
        followUpRecommendation: analysis.followUpRecommendation,
        suggestedResponse: analysis.suggestedResponse,
      },
    });
  } catch (error) {
    console.error('Reply analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Reply analysis failed',
    });
  }
});

/**
 * POST /api/v1/pipeline/learn-from-success
 * Record a successful email interaction for future optimization
 */
router.post('/learn-from-success', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, outcome, prospectContext } = req.body;

    if (!email || !outcome) {
      return res.status(400).json({ error: 'email and outcome are required' });
    }

    const optimizer = createEmailOptimizer();
    await optimizer.learnFromSuccess(req.user!.teamId, email, outcome, prospectContext || {});

    res.json({
      success: true,
      message: 'Success pattern recorded for future optimization',
    });
  } catch (error) {
    console.error('Learn from success error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record success pattern',
    });
  }
});

// =============================================
// INDUSTRY-SPECIFIC MESSAGING ENDPOINTS
// =============================================

/**
 * POST /api/v1/pipeline/industry-email
 * Generate an industry-tailored email using sector-specific knowledge
 */
router.post('/industry-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, valueProposition, emailType } = req.body;

    if (!prospectId) {
      return res.status(400).json({ error: 'prospectId is required' });
    }

    if (!valueProposition) {
      return res.status(400).json({ error: 'valueProposition is required' });
    }

    // Get prospect signals
    const { data: prospect } = await supabase
      .from('prospects')
      .select('enrichment_data')
      .eq('id', prospectId)
      .single();

    if (!prospect?.enrichment_data) {
      return res.status(400).json({
        error: 'Prospect has not been enriched. Run enrichment first.',
      });
    }

    const result = await generateIndustryTailoredEmail(
      prospect.enrichment_data,
      valueProposition,
      emailType || 'cold_outreach'
    );

    res.json({
      success: true,
      data: {
        subject: result.subject,
        body: result.body,
        industryScore: result.industryScore,
        elementsUsed: result.elementsUsed,
      },
    });
  } catch (error) {
    console.error('Industry email error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Industry email generation failed',
    });
  }
});

/**
 * GET /api/v1/pipeline/industry-profile/:industry
 * Get industry profile with terminology, challenges, and timing recommendations
 */
router.get('/industry-profile/:industry', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { industry } = req.params;

    const engine = createIndustryMessagingEngine();
    const profile = await engine.getIndustryProfile(industry);
    const timing = engine.getTimingRecommendation(industry);

    res.json({
      success: true,
      data: {
        profile,
        timing,
      },
    });
  } catch (error) {
    console.error('Industry profile error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get industry profile',
    });
  }
});

/**
 * POST /api/v1/pipeline/industry-messaging
 * Generate industry-specific messaging components
 */
router.post('/industry-messaging', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prospectId, valueProposition } = req.body;

    if (!prospectId || !valueProposition) {
      return res.status(400).json({ error: 'prospectId and valueProposition are required' });
    }

    // Get prospect signals
    const { data: prospect } = await supabase
      .from('prospects')
      .select('enrichment_data')
      .eq('id', prospectId)
      .single();

    if (!prospect?.enrichment_data) {
      return res.status(400).json({
        error: 'Prospect has not been enriched. Run enrichment first.',
      });
    }

    const engine = createIndustryMessagingEngine();
    const messaging = await engine.generateIndustryMessaging(prospect.enrichment_data, valueProposition);

    res.json({
      success: true,
      data: messaging,
    });
  } catch (error) {
    console.error('Industry messaging error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Industry messaging generation failed',
    });
  }
});

export default router;
