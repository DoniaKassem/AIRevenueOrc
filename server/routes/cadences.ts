import { Router } from 'express';
import { db } from '../db';
import { cadences } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';

const router = Router();

const CadenceQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  isActive: z.string().optional(),
  orderBy: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateCadenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  teamId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  settings: z.record(z.any()).optional(),
});

const UpdateCadenceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  teamId: z.string().uuid().optional().nullable(),
  settings: z.record(z.any()).optional(),
});

router.get('/', async (req, res) => {
  try {
    const query = CadenceQuerySchema.parse(req.query);
    const sqlClient = neon(process.env.DATABASE_URL!);

    let data: any[] = [];
    try {
      let whereClause = '';
      
      if (query.isActive !== undefined) {
        const isActiveValue = query.isActive === 'true';
        whereClause = `WHERE is_active = ${isActiveValue}`;
      }

      const result = await sqlClient`
        SELECT 
          id::text, 
          name, 
          description,
          team_id::text, 
          is_active, 
          created_by::text, 
          settings,
          created_at, 
          updated_at
        FROM cadences
        ORDER BY created_at DESC
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `;

      data = result || [];
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = data.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      team_id: c.team_id,
      is_active: c.is_active,
      created_by: c.created_by,
      settings: c.settings,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    res.json({
      success: true,
      data: transformedData,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: transformedData.length,
      },
    });
  } catch (error) {
    console.error('Error fetching cadences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cadences',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sqlClient = neon(process.env.DATABASE_URL!);

    const result = await sqlClient`
      SELECT 
        id::text, 
        name, 
        description,
        team_id::text, 
        is_active, 
        created_by::text, 
        settings,
        created_at, 
        updated_at
      FROM cadences
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cadence not found',
      });
    }

    const cadence = result[0];
    res.json({
      success: true,
      data: {
        id: cadence.id,
        name: cadence.name,
        description: cadence.description,
        team_id: cadence.team_id,
        is_active: cadence.is_active,
        created_by: cadence.created_by,
        settings: cadence.settings,
        created_at: cadence.created_at,
        updated_at: cadence.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching cadence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cadence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = CreateCadenceSchema.parse(req.body);
    const sqlClient = neon(process.env.DATABASE_URL!);

    try {
      await sqlClient`
        INSERT INTO cadences (
          name, 
          description, 
          is_active, 
          settings
        )
        VALUES (
          ${body.name}, 
          ${body.description || null}, 
          ${body.isActive}, 
          ${JSON.stringify(body.settings || {})}
        )
      `;

      const selectResult = await sqlClient`
        SELECT 
          id::text, 
          name, 
          description,
          team_id::text, 
          is_active, 
          created_by::text, 
          settings,
          created_at
        FROM cadences
        WHERE name = ${body.name}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!selectResult || selectResult.length === 0) {
        return res.status(201).json({
          success: true,
          message: 'Cadence created successfully',
          data: {
            name: body.name,
            description: body.description,
            is_active: body.isActive,
          },
        });
      }

      const newCadence = selectResult[0];

      res.status(201).json({
        success: true,
        data: {
          id: newCadence.id,
          name: newCadence.name,
          description: newCadence.description,
          team_id: newCadence.team_id,
          is_active: newCadence.is_active,
          created_by: newCadence.created_by,
          settings: newCadence.settings,
          created_at: newCadence.created_at,
        },
      });
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error while creating cadence',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error',
      });
    }
  } catch (error) {
    console.error('Error creating cadence:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create cadence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = UpdateCadenceSchema.parse(req.body);
    const sqlClient = neon(process.env.DATABASE_URL!);

    const setClauses: string[] = [];

    if (body.name !== undefined) {
      setClauses.push(`name = '${body.name.replace(/'/g, "''")}'`);
    }
    if (body.description !== undefined) {
      setClauses.push(`description = ${body.description === null ? 'NULL' : `'${body.description.replace(/'/g, "''")}'`}`);
    }
    if (body.isActive !== undefined) {
      setClauses.push(`is_active = ${body.isActive}`);
    }
    if (body.settings !== undefined) {
      setClauses.push(`settings = '${JSON.stringify(body.settings).replace(/'/g, "''")}'::jsonb`);
    }
    
    setClauses.push(`updated_at = NOW()`);

    if (setClauses.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    await sqlClient`
      UPDATE cadences 
      SET ${sqlClient.unsafe(setClauses.join(', '))}
      WHERE id = ${id}::uuid
    `;

    const result = await sqlClient`
      SELECT 
        id::text, 
        name, 
        description,
        team_id::text, 
        is_active, 
        created_by::text, 
        settings,
        created_at, 
        updated_at
      FROM cadences
      WHERE id = ${id}::uuid
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cadence not found',
      });
    }

    const updatedCadence = result[0];
    res.json({
      success: true,
      data: {
        id: updatedCadence.id,
        name: updatedCadence.name,
        description: updatedCadence.description,
        team_id: updatedCadence.team_id,
        is_active: updatedCadence.is_active,
        created_by: updatedCadence.created_by,
        settings: updatedCadence.settings,
        created_at: updatedCadence.created_at,
        updated_at: updatedCadence.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating cadence:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update cadence',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
