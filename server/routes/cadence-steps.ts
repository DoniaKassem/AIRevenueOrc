import { Router } from 'express';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';

const router = Router();

const CreateStepsSchema = z.object({
  cadenceId: z.string().uuid(),
  steps: z.array(z.object({
    step_number: z.number(),
    type: z.enum(['email', 'call', 'linkedin', 'sms', 'task']),
    delay_days: z.number().default(0),
    delay_hours: z.number().default(0),
    template_id: z.string().uuid().optional().nullable(),
    content: z.string().optional().nullable(),
  })),
});

router.get('/:cadenceId', async (req, res) => {
  try {
    const { cadenceId } = req.params;
    const sql = neon(process.env.DATABASE_URL!);
    
    let data: any[] = [];
    try {
      const result = await sql`
        SELECT 
          id::text, 
          cadence_id::text, 
          step_number, 
          type, 
          delay_days, 
          delay_hours,
          template_id::text,
          content,
          created_at
        FROM cadence_steps
        WHERE cadence_id = ${cadenceId}::uuid
        ORDER BY step_number ASC
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
    console.error('Error fetching cadence steps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cadence steps',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = CreateStepsSchema.parse(req.body);
    const sql = neon(process.env.DATABASE_URL!);

    try {
      for (const step of body.steps) {
        await sql`
          INSERT INTO cadence_steps (
            cadence_id, 
            step_number, 
            type, 
            delay_days, 
            delay_hours,
            template_id,
            content
          )
          VALUES (
            ${body.cadenceId}::uuid,
            ${step.step_number},
            ${step.type},
            ${step.delay_days},
            ${step.delay_hours},
            ${step.template_id || null}::uuid,
            ${step.content || null}
          )
        `;
      }

      res.status(201).json({
        success: true,
        message: 'Cadence steps created successfully',
        count: body.steps.length,
      });
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error while creating cadence steps',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error',
      });
    }
  } catch (error) {
    console.error('Error creating cadence steps:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create cadence steps',
    });
  }
});

export default router;
