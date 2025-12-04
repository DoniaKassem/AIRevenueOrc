import { Router } from 'express';
import { db } from '../db';
import { notifications } from '../../shared/schema';
import { eq, desc, and, isNull, sql } from 'drizzle-orm';
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

    let data;
    try {
      if (query.status === 'unread') {
        data = await db.select().from(notifications)
          .where(isNull(notifications.readAt))
          .orderBy(desc(notifications.createdAt))
          .limit(query.limit)
          .offset(query.offset);
      } else if (query.status === 'read') {
        data = await db.select().from(notifications)
          .where(sql`${notifications.readAt} IS NOT NULL`)
          .orderBy(desc(notifications.createdAt))
          .limit(query.limit)
          .offset(query.offset);
      } else {
        data = await db.select().from(notifications)
          .orderBy(desc(notifications.createdAt))
          .limit(query.limit)
          .offset(query.offset);
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = (data || []).map(n => ({
      id: n.id,
      eventType: n.eventType,
      title: n.title,
      message: n.message,
      priority: n.priority,
      isRead: n.readAt !== null,
      createdAt: n.createdAt,
      metadata: n.metadata,
      actionUrl: n.actionUrl,
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
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(isNull(notifications.readAt));

    res.json({
      success: true,
      count: Number(result?.count || 0),
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

    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();

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
        readAt: updated.readAt,
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
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(isNull(notifications.readAt));

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
