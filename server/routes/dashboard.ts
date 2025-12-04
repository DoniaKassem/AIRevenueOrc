import { Router } from 'express';
import { neon } from '@neondatabase/serverless';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);

    let totalProspects = 0;
    let activeDeals = 0;
    let pipelineValue = 0;
    let emailsSent = 0;
    let callsMade = 0;
    let activeCadences = 0;

    try {
      const prospectsResult = await sqlClient`SELECT COUNT(*)::integer as count FROM prospects`;
      totalProspects = prospectsResult?.[0]?.count || 0;
    } catch (e) {
      console.error('Error fetching prospects count:', e);
    }

    try {
      const dealsResult = await sqlClient`
        SELECT 
          COUNT(*)::integer as count,
          COALESCE(SUM(amount::numeric), 0)::numeric as pipeline_value
        FROM deals 
        WHERE stage NOT IN ('closed_won', 'closed_lost')
      `;
      activeDeals = dealsResult?.[0]?.count || 0;
      pipelineValue = parseFloat(dealsResult?.[0]?.pipeline_value) || 0;
    } catch (e) {
      console.error('Error fetching deals stats:', e);
    }

    try {
      const emailsResult = await sqlClient`
        SELECT COUNT(*)::integer as count 
        FROM email_logs 
        WHERE sent_at >= NOW() - INTERVAL '30 days'
      `;
      emailsSent = emailsResult?.[0]?.count || 0;
    } catch (e) {
      console.error('Error fetching emails count:', e);
    }

    try {
      const callsResult = await sqlClient`
        SELECT COUNT(*)::integer as count 
        FROM call_logs 
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;
      callsMade = callsResult?.[0]?.count || 0;
    } catch (e) {
      console.error('Error fetching calls count:', e);
    }

    try {
      const cadencesResult = await sqlClient`
        SELECT COUNT(*)::integer as count 
        FROM cadences 
        WHERE is_active = true
      `;
      activeCadences = cadencesResult?.[0]?.count || 0;
    } catch (e) {
      console.error('Error fetching cadences count:', e);
    }

    res.json({
      success: true,
      data: {
        totalProspects,
        activeDeals,
        pipelineValue,
        emailsSent,
        callsMade,
        activeCadences,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
