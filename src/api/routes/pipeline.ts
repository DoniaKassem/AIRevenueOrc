/**
 * Pipeline API Routes
 * Endpoints for the prospect-to-outreach pipeline
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  runProspectToOutreachPipeline,
  importFromSalesforceAndEnrich,
  importFromHubSpotAndEnrich,
  quickEnrichAndEmail,
  PipelineInput,
  PipelineConfig,
} from '../../lib/workflows/prospectToOutreachPipeline';
import { runEnrichmentPipeline } from '../../lib/enrichment/multiSourcePipeline';
import { generatePersonalizedEmail, generateOutreachSequence } from '../../lib/ai/enhancedEmailWriter';
import { transformSignalsToOutreach } from '../../lib/ai/signalToOutreach';
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

export default router;
