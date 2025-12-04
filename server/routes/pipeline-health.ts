import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { calculateDealHealth, DealHealthMetrics } from '../../src/lib/pipelineHealthMonitor';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);

    const dealsResult = await sqlClient`
      SELECT 
        id::text, 
        name, 
        account_id::text, 
        owner_id::text, 
        team_id::text, 
        stage, 
        amount::text, 
        probability, 
        close_date, 
        risk_score, 
        forecast_category, 
        metadata, 
        ai_analysis,
        created_at, 
        updated_at,
        closed_at
      FROM deals
      WHERE stage NOT IN ('closed_won', 'closed_lost')
      ORDER BY created_at DESC
    `;

    const deals = (dealsResult || []).map(d => ({
      id: d.id,
      name: d.name,
      account_id: d.account_id,
      owner_id: d.owner_id,
      team_id: d.team_id,
      stage: d.stage,
      amount: d.amount,
      value: parseFloat(d.amount || '0'),
      probability: d.probability ? d.probability / 100 : 0,
      close_date: d.close_date,
      expected_close_date: d.close_date,
      risk_score: d.risk_score,
      forecast_category: d.forecast_category,
      metadata: d.metadata,
      ai_analysis: d.ai_analysis,
      created_at: d.created_at,
      updated_at: d.updated_at,
      closed_at: d.closed_at,
      contacts: [],
    }));

    const dealIds = deals.map(d => d.id);
    
    let activitiesWithDealId: any[] = [];

    if (dealIds.length > 0) {
      const activitiesResult = await sqlClient`
        SELECT 
          ba.id::text,
          ba.prospect_id::text,
          ba.activity_type as type,
          ba.channel,
          ba.direction,
          ba.subject,
          ba.message_preview,
          ba.created_at,
          dc.deal_id::text
        FROM bdr_activities ba
        INNER JOIN deal_contacts dc ON ba.prospect_id = dc.prospect_id
        WHERE dc.deal_id = ANY(${dealIds}::uuid[])
        ORDER BY ba.created_at DESC
      `;

      activitiesWithDealId = (activitiesResult || []).map(a => ({
        id: a.id,
        deal_id: a.deal_id,
        prospect_id: a.prospect_id,
        type: a.type,
        channel: a.channel,
        direction: a.direction,
        subject: a.subject,
        message_preview: a.message_preview,
        created_at: a.created_at,
      }));
    }

    const healthMetrics: DealHealthMetrics[] = deals.map(deal => {
      return calculateDealHealth(deal, activitiesWithDealId);
    });

    res.json({
      success: true,
      deals,
      healthMetrics,
    });
  } catch (error) {
    console.error('Error fetching pipeline health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pipeline health',
      message: error instanceof Error ? error.message : 'Unknown error',
      deals: [],
      healthMetrics: [],
    });
  }
});

export default router;
