import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { generateDailyTasks, Task } from '../../src/lib/taskPrioritization';

const router = Router();

router.get('/daily/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sqlClient = neon(process.env.DATABASE_URL!);

    let prospects: any[] = [];
    let deals: any[] = [];
    let activities: any[] = [];

    try {
      const prospectsResult = await sqlClient`
        SELECT 
          id::text,
          first_name,
          last_name,
          email,
          phone,
          title,
          company,
          priority_score,
          status,
          created_at,
          updated_at
        FROM prospects
        ORDER BY priority_score DESC NULLS LAST
        LIMIT 100
      `;
      prospects = prospectsResult || [];
    } catch (err) {
      console.error('Error fetching prospects for tasks:', err);
      prospects = [];
    }

    try {
      const dealsResult = await sqlClient`
        SELECT 
          d.id::text,
          d.name,
          d.account_id::text,
          d.owner_id::text,
          d.stage,
          d.amount::text as value,
          d.probability,
          d.close_date as expected_close_date,
          d.risk_score,
          d.created_at,
          d.updated_at,
          p.first_name || ' ' || p.last_name as prospect_name,
          p.company,
          p.id::text as prospect_id
        FROM deals d
        LEFT JOIN prospects p ON d.account_id = p.account_id
        WHERE d.stage NOT IN ('won', 'lost', 'closed_won', 'closed_lost')
        ORDER BY d.close_date ASC NULLS LAST
        LIMIT 100
      `;
      deals = dealsResult || [];
    } catch (err) {
      console.error('Error fetching deals for tasks:', err);
      deals = [];
    }

    try {
      const activitiesResult = await sqlClient`
        SELECT 
          id::text,
          prospect_id::text,
          activity_type,
          channel,
          direction,
          subject,
          created_at
        FROM bdr_activities
        ORDER BY created_at DESC
        LIMIT 500
      `;
      activities = activitiesResult || [];
    } catch (err) {
      console.error('Error fetching activities for tasks:', err);
      activities = [];
    }

    const prospectsData = Array.isArray(prospects) ? prospects.map((p: any) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      title: p.title,
      company: p.company,
      priority_score: p.priority_score,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })) : [];

    const dealsData = Array.isArray(deals) ? deals.map((d: any) => ({
      id: d.id,
      name: d.name,
      account_id: d.account_id,
      owner_id: d.owner_id,
      stage: d.stage,
      value: parseFloat(d.value) || 0,
      probability: d.probability,
      expected_close_date: d.expected_close_date,
      risk_score: d.risk_score,
      created_at: d.created_at,
      updated_at: d.updated_at,
      prospect_name: d.prospect_name,
      company: d.company,
      prospect_id: d.prospect_id,
    })) : [];

    const activitiesData = Array.isArray(activities) ? activities.map((a: any) => ({
      id: a.id,
      prospect_id: a.prospect_id,
      activity_type: a.activity_type,
      channel: a.channel,
      direction: a.direction,
      subject: a.subject,
      created_at: a.created_at,
    })) : [];

    const tasks: Task[] = generateDailyTasks(prospectsData, dealsData, activitiesData);

    res.json({
      success: true,
      data: tasks,
      meta: {
        prospects_count: prospectsData.length,
        deals_count: dealsData.length,
        activities_count: activitiesData.length,
      },
    });
  } catch (error) {
    console.error('Error generating daily tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily tasks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
