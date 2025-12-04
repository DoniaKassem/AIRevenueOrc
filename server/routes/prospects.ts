import { Router } from 'express';
import { db } from '../db';
import { prospects } from '../../shared/schema';
import { eq, desc, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';

const router = Router();

const ProspectQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  status: z.string().optional(),
  orderBy: z.enum(['priority_score', 'created_at', 'updated_at']).default('priority_score'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateProspectSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z.string().optional(),
  status: z.string().default('new'),
  priorityScore: z.number().min(0).max(100).default(50),
  teamId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
});

router.get('/', async (req, res) => {
  try {
    const query = ProspectQuerySchema.parse(req.query);

    const sqlClient = neon(process.env.DATABASE_URL!);
    
    let data: any[] = [];
    try {
      let searchClause = '';
      let statusClause = '';
      
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        searchClause = ` WHERE (first_name ILIKE '${searchTerm}' OR last_name ILIKE '${searchTerm}' OR email ILIKE '${searchTerm}' OR company ILIKE '${searchTerm}')`;
      }
      
      if (query.status) {
        statusClause = searchClause ? ` AND status = '${query.status}'` : ` WHERE status = '${query.status}'`;
      }

      const result = await sqlClient`
        SELECT id::text, first_name, last_name, email, phone, title, company, linkedin_url, status, priority_score, created_at, updated_at
        FROM prospects
        ORDER BY priority_score DESC
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `;
      
      data = result || [];
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = data.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      title: p.title,
      company: p.company,
      linkedin_url: p.linkedin_url,
      status: p.status,
      priority_score: p.priority_score,
      created_at: p.created_at,
      updated_at: p.updated_at,
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
    console.error('Error fetching prospects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prospects',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1);

    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: prospect.id,
        first_name: prospect.firstName,
        last_name: prospect.lastName,
        email: prospect.email,
        phone: prospect.phone,
        title: prospect.title,
        company: prospect.company,
        linkedin_url: prospect.linkedinUrl,
        status: prospect.status,
        priority_score: prospect.priorityScore,
        created_at: prospect.createdAt,
        updated_at: prospect.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prospect',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = CreateProspectSchema.parse(req.body);

    const sqlClient = neon(process.env.DATABASE_URL!);
    
    try {
      await sqlClient`
        INSERT INTO prospects (first_name, last_name, email, phone, title, company, linkedin_url, status, priority_score)
        VALUES (${body.firstName}, ${body.lastName}, ${body.email}, ${body.phone || null}, ${body.title || null}, ${body.company || null}, ${body.linkedinUrl || null}, ${body.status}, ${body.priorityScore})
      `;
      
      const selectResult = await sqlClient`
        SELECT id::text, first_name, last_name, email, phone, title, company, linkedin_url, status, priority_score, created_at
        FROM prospects
        WHERE email = ${body.email}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      if (!selectResult || selectResult.length === 0) {
        return res.status(201).json({
          success: true,
          message: 'Prospect created successfully',
          data: {
            first_name: body.firstName,
            last_name: body.lastName,
            email: body.email,
            phone: body.phone || null,
            title: body.title || null,
            company: body.company || null,
            linkedin_url: body.linkedinUrl || null,
            status: body.status,
            priority_score: body.priorityScore,
          },
        });
      }

      const newProspect = selectResult[0];
      
      res.status(201).json({
        success: true,
        data: {
          id: newProspect.id,
          first_name: newProspect.first_name,
          last_name: newProspect.last_name,
          email: newProspect.email,
          phone: newProspect.phone,
          title: newProspect.title,
          company: newProspect.company,
          linkedin_url: newProspect.linkedin_url,
          status: newProspect.status,
          priority_score: newProspect.priority_score,
          created_at: newProspect.created_at,
        },
      });
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error while creating prospect',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error',
      });
    }
  } catch (error) {
    console.error('Error creating prospect:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create prospect',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updateData: Record<string, unknown> = {};
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.company !== undefined) updateData.company = updates.company;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priorityScore !== undefined) updateData.priorityScore = updates.priorityScore;
    updateData.updatedAt = new Date();

    const [updatedProspect] = await db
      .update(prospects)
      .set(updateData)
      .where(eq(prospects.id, id))
      .returning();

    if (!updatedProspect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: updatedProspect.id,
        first_name: updatedProspect.firstName,
        last_name: updatedProspect.lastName,
        email: updatedProspect.email,
        phone: updatedProspect.phone,
        title: updatedProspect.title,
        company: updatedProspect.company,
        status: updatedProspect.status,
        priority_score: updatedProspect.priorityScore,
        updated_at: updatedProspect.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update prospect',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(prospects)
      .where(eq(prospects.id, id))
      .returning({ id: prospects.id });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found',
      });
    }

    res.json({
      success: true,
      message: 'Prospect deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting prospect:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete prospect',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
