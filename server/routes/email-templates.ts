import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    let data: any[] = [];
    try {
      const result = await sql`
        SELECT id::text, name, subject, body, is_active, created_at
        FROM email_templates
        WHERE is_active = true
        ORDER BY name ASC
      `;
      data = result || [];
    } catch (dbError) {
      data = [];
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email templates',
    });
  }
});

export default router;
