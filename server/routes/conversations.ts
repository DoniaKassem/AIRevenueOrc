import { Router } from 'express';
import { neon } from '@neondatabase/serverless';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sqlClient = neon(process.env.DATABASE_URL!);
    
    let data: any[] = [];
    try {
      const result = await sqlClient`
        SELECT 
          id::text, 
          team_id, 
          title, 
          type, 
          duration_seconds, 
          started_at, 
          analysis_status, 
          created_at
        FROM conversations
        ORDER BY started_at DESC NULLS LAST
        LIMIT 50
      `;
      
      data = result || [];
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = data.map(c => ({
      id: c.id,
      team_id: c.team_id,
      title: c.title,
      type: c.type,
      duration_seconds: c.duration_seconds || 0,
      started_at: c.started_at,
      analysis_status: c.analysis_status,
      created_at: c.created_at,
    }));

    res.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id/insights', async (req, res) => {
  try {
    const { id } = req.params;
    const sqlClient = neon(process.env.DATABASE_URL!);
    
    let insight: any = null;
    try {
      const result = await sqlClient`
        SELECT 
          id::text,
          conversation_id,
          summary,
          sentiment_score,
          engagement_score,
          talk_ratio,
          key_points,
          action_items,
          questions_asked,
          objections,
          next_steps,
          meddpicc,
          topics,
          keywords,
          pricing_discussed,
          budget_mentioned,
          ai_recommendations,
          model_version,
          created_at
        FROM conversation_insights
        WHERE conversation_id = ${id}::uuid
        LIMIT 1
      `;

      if (result && result.length > 0) {
        insight = result[0];
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      insight = null;
    }

    if (!insight) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: {
        id: insight.id,
        conversation_id: insight.conversation_id,
        summary: insight.summary,
        sentiment_score: insight.sentiment_score ? parseFloat(insight.sentiment_score) : null,
        engagement_score: insight.engagement_score ? parseFloat(insight.engagement_score) : null,
        talk_ratio: insight.talk_ratio,
        key_points: insight.key_points,
        action_items: insight.action_items,
        questions_asked: insight.questions_asked,
        objections: insight.objections,
        next_steps: insight.next_steps,
        meddpicc: insight.meddpicc,
        topics: insight.topics,
        keywords: insight.keywords,
        pricing_discussed: insight.pricing_discussed,
        budget_mentioned: insight.budget_mentioned,
        ai_recommendations: insight.ai_recommendations,
        model_version: insight.model_version,
        created_at: insight.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching conversation insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation insights',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id/transcripts', async (req, res) => {
  try {
    const { id } = req.params;
    const sqlClient = neon(process.env.DATABASE_URL!);
    
    let data: any[] = [];
    try {
      const result = await sqlClient`
        SELECT 
          id::text,
          conversation_id,
          segment_number,
          speaker_role,
          speaker_name,
          text,
          start_time,
          end_time,
          sentiment,
          created_at
        FROM conversation_transcripts
        WHERE conversation_id = ${id}::uuid
        ORDER BY segment_number ASC
      `;
      
      data = result || [];
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = data.map(t => ({
      id: t.id,
      conversation_id: t.conversation_id,
      segment_number: t.segment_number,
      speaker_role: t.speaker_role,
      speaker_name: t.speaker_name,
      text: t.text,
      start_time: t.start_time ? parseFloat(t.start_time) : null,
      end_time: t.end_time ? parseFloat(t.end_time) : null,
      sentiment: t.sentiment,
      created_at: t.created_at,
    }));

    res.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Error fetching conversation transcripts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation transcripts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
