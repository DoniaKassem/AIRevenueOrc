import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const router = Router();

const NotificationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['unread', 'read', 'all']).default('all'),
});

router.get('/', async (req, res) => {
  try {
    const query = NotificationQuerySchema.parse(req.query);
    const sql = neon(process.env.DATABASE_URL!);

    let data: any[] = [];
    try {
      let statusCondition = '';
      if (query.status === 'unread') {
        statusCondition = 'WHERE read_at IS NULL';
      } else if (query.status === 'read') {
        statusCondition = 'WHERE read_at IS NOT NULL';
      }
      
      const result = await sql`
        SELECT id::text, organization_id::text, user_id::text, event_type, 
               title, message, priority, action_url, status, read_at, 
               metadata, created_at
        FROM notifications
        ${sql.unsafe(statusCondition)}
        ORDER BY created_at DESC NULLS LAST
        LIMIT ${query.limit} OFFSET ${query.offset}
      `;
      data = result || [];
    } catch (dbError) {
      data = [];
    }

    const transformedData = (data || []).map((n: any) => ({
      id: n.id,
      eventType: n.event_type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      isRead: n.read_at !== null,
      createdAt: n.created_at,
      metadata: n.metadata,
      actionUrl: n.action_url,
    }));

    res.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    let count = 0;
    try {
      const result = await sql`
        SELECT COUNT(*) as count FROM notifications WHERE read_at IS NULL
      `;
      count = Number(result?.[0]?.count || 0);
    } catch (dbError) {
      count = 0;
    }

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
    });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = neon(process.env.DATABASE_URL!);

    let updated: any = null;
    try {
      const result = await sql`
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE id = ${id}::uuid
        RETURNING id::text, read_at
      `;
      updated = result?.[0];
    } catch (dbError) {
      updated = null;
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: updated.id,
        isRead: true,
        readAt: updated.read_at,
      },
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
});

router.post('/mark-all-read', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    try {
      await sql`
        UPDATE notifications SET read_at = NOW() WHERE read_at IS NULL
      `;
    } catch (dbError) {
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
});

export default router;
