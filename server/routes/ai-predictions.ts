import { Router, Request, Response } from 'express';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const router = Router();

const sqlClient = neon(process.env.DATABASE_URL!);

router.get('/predictions', async (req: Request, res: Response) => {
  try {
    let predictions: any[] = [];
    
    try {
      predictions = await sqlClient`
        SELECT 
          id::text, 
          entity_type, 
          entity_id::text, 
          prospect_id::text, 
          prediction_type, 
          score, 
          confidence, 
          reasoning, 
          model_version, 
          created_at
        FROM ai_predictions
        ORDER BY created_at DESC
        LIMIT 20
      `;
    } catch (dbError: any) {
      console.log('Database returned empty or null result, returning empty array');
      predictions = [];
    }

    const transformedPredictions = (predictions || []).map(p => ({
      id: p.id,
      entity_type: p.entity_type,
      entity_id: p.entity_id,
      prospect_id: p.prospect_id,
      prediction_type: p.prediction_type,
      score: p.score ? parseFloat(p.score) : 0,
      confidence: p.confidence ? parseFloat(p.confidence) : 0,
      reasoning: p.reasoning,
      model_version: p.model_version,
      created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
    }));

    res.json({
      success: true,
      data: transformedPredictions,
    });
  } catch (error: any) {
    console.error('Error fetching AI predictions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch AI predictions',
    });
  }
});

const runAgentSchema = z.object({
  use_ai: z.boolean().optional().default(true),
});

router.post('/agents/run/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { use_ai } = runAgentSchema.parse(req.body);

    if (agentId === 'prioritize') {
      let prospectIds: string[] = [];
      
      try {
        const result = await sqlClient`SELECT id::text FROM prospects LIMIT 100`;
        prospectIds = result.map((row: any) => row.id);
      } catch (dbError) {
        console.log('Error fetching prospects, returning empty array');
        prospectIds = [];
      }

      if (prospectIds.length === 0) {
        return res.json({
          success: true,
          message: 'No prospects found to prioritize',
          results: [],
        });
      }

      const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/ai/prioritize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_ids: prospectIds,
          use_ai,
        }),
      });

      const result = await response.json();
      return res.json(result);

    } else if (agentId === 'deal-analyzer') {
      let dealIds: string[] = [];
      
      try {
        const result = await sqlClient`
          SELECT id::text FROM deals 
          WHERE stage NOT IN ('closed_won', 'closed_lost') 
          LIMIT 50
        `;
        dealIds = result.map((row: any) => row.id);
      } catch (dbError) {
        console.log('Error fetching deals, returning empty array');
        dealIds = [];
      }

      if (dealIds.length === 0) {
        return res.json({
          success: true,
          message: 'No active deals found to analyze',
          results: [],
        });
      }

      const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/ai/deal/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_ids: dealIds,
          use_ai,
        }),
      });

      const result = await response.json();
      return res.json(result);

    } else {
      return res.status(400).json({
        success: false,
        error: `Unknown agent: ${agentId}. Supported agents: prioritize, deal-analyzer`,
      });
    }
  } catch (error: any) {
    console.error('Error running AI agent:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run AI agent',
    });
  }
});

export default router;
