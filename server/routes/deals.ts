import { Router } from 'express';
import { db } from '../db';
import { deals } from '../../shared/schema';
import { eq, desc, asc, ilike, or, and, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';

const router = Router();

const DealQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  stage: z.string().optional(),
  orderBy: z.enum(['amount', 'created_at', 'updated_at', 'close_date']).default('created_at'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

const CreateDealSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  stage: z.string().default('discovery'),
  amount: z.union([z.string(), z.number()]).optional().default('0'),
  probability: z.number().min(0).max(100).default(0),
  closeDate: z.string().optional(),
  riskScore: z.number().min(0).max(100).default(0),
  forecastCategory: z.string().default('pipeline'),
  metadata: z.record(z.any()).optional(),
});

const UpdateDealSchema = z.object({
  name: z.string().min(1).optional(),
  accountId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  stage: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().optional().nullable(),
  riskScore: z.number().min(0).max(100).optional(),
  forecastCategory: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  aiAnalysis: z.record(z.any()).optional(),
});

router.get('/', async (req, res) => {
  try {
    const query = DealQuerySchema.parse(req.query);
    const sqlClient = neon(process.env.DATABASE_URL!);

    let data: any[] = [];
    try {
      let whereClause = '';
      const conditions: string[] = [];

      if (query.search) {
        const searchTerm = query.search.replace(/'/g, "''");
        conditions.push(`name ILIKE '%${searchTerm}%'`);
      }

      if (query.stage) {
        conditions.push(`stage = '${query.stage.replace(/'/g, "''")}'`);
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const orderColumn = query.orderBy === 'close_date' ? 'close_date' : query.orderBy;
      const orderDir = query.orderDir.toUpperCase();

      const result = await sqlClient`
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
        ORDER BY created_at DESC
        LIMIT ${query.limit}
        OFFSET ${query.offset}
      `;

      data = result || [];
    } catch (dbError) {
      console.error('Database query error:', dbError);
      data = [];
    }

    const transformedData = data.map(d => ({
      id: d.id,
      name: d.name,
      account_id: d.account_id,
      owner_id: d.owner_id,
      team_id: d.team_id,
      stage: d.stage,
      amount: d.amount,
      probability: d.probability,
      close_date: d.close_date,
      risk_score: d.risk_score,
      forecast_category: d.forecast_category,
      metadata: d.metadata,
      ai_analysis: d.ai_analysis,
      created_at: d.created_at,
      updated_at: d.updated_at,
      closed_at: d.closed_at,
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
    console.error('Error fetching deals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
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
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      });
    }

    const deal = result[0];
    res.json({
      success: true,
      data: {
        id: deal.id,
        name: deal.name,
        account_id: deal.account_id,
        owner_id: deal.owner_id,
        team_id: deal.team_id,
        stage: deal.stage,
        amount: deal.amount,
        probability: deal.probability,
        close_date: deal.close_date,
        risk_score: deal.risk_score,
        forecast_category: deal.forecast_category,
        metadata: deal.metadata,
        ai_analysis: deal.ai_analysis,
        created_at: deal.created_at,
        updated_at: deal.updated_at,
        closed_at: deal.closed_at,
      },
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = CreateDealSchema.parse(req.body);
    const sqlClient = neon(process.env.DATABASE_URL!);

    try {
      const amountValue = typeof body.amount === 'number' ? body.amount.toString() : (body.amount || '0');
      
      await sqlClient`
        INSERT INTO deals (
          name, 
          stage, 
          amount, 
          probability, 
          risk_score, 
          forecast_category, 
          metadata
        )
        VALUES (
          ${body.name}, 
          ${body.stage}, 
          ${amountValue}, 
          ${body.probability}, 
          ${body.riskScore}, 
          ${body.forecastCategory}, 
          ${JSON.stringify(body.metadata || {})}
        )
      `;

      const selectResult = await sqlClient`
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
          created_at
        FROM deals
        WHERE name = ${body.name}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!selectResult || selectResult.length === 0) {
        return res.status(201).json({
          success: true,
          message: 'Deal created successfully',
          data: {
            name: body.name,
            stage: body.stage,
            amount: body.amount,
            probability: body.probability,
          },
        });
      }

      const newDeal = selectResult[0];

      res.status(201).json({
        success: true,
        data: {
          id: newDeal.id,
          name: newDeal.name,
          account_id: newDeal.account_id,
          owner_id: newDeal.owner_id,
          team_id: newDeal.team_id,
          stage: newDeal.stage,
          amount: newDeal.amount,
          probability: newDeal.probability,
          close_date: newDeal.close_date,
          risk_score: newDeal.risk_score,
          forecast_category: newDeal.forecast_category,
          metadata: newDeal.metadata,
          created_at: newDeal.created_at,
        },
      });
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error while creating deal',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error',
      });
    }
  } catch (error) {
    console.error('Error creating deal:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = UpdateDealSchema.parse(req.body);
    const sqlClient = neon(process.env.DATABASE_URL!);

    const setClauses: string[] = [];

    if (body.name !== undefined) {
      setClauses.push(`name = '${body.name.replace(/'/g, "''")}'`);
    }
    if (body.stage !== undefined) {
      setClauses.push(`stage = '${body.stage.replace(/'/g, "''")}'`);
    }
    if (body.amount !== undefined) {
      setClauses.push(`amount = ${body.amount}`);
    }
    if (body.probability !== undefined) {
      setClauses.push(`probability = ${body.probability}`);
    }
    if (body.riskScore !== undefined) {
      setClauses.push(`risk_score = ${body.riskScore}`);
    }
    if (body.forecastCategory !== undefined) {
      setClauses.push(`forecast_category = '${body.forecastCategory.replace(/'/g, "''")}'`);
    }
    
    setClauses.push(`updated_at = NOW()`);
    
    if (body.stage === 'closed_won' || body.stage === 'closed_lost') {
      setClauses.push(`closed_at = NOW()`);
    }

    if (setClauses.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    await sqlClient`
      UPDATE deals 
      SET ${sqlClient.unsafe(setClauses.join(', '))}
      WHERE id = ${id}::uuid
    `;

    const result = await sqlClient`
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
      WHERE id = ${id}::uuid
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      });
    }

    const updatedDeal = result[0];
    res.json({
      success: true,
      data: {
        id: updatedDeal.id,
        name: updatedDeal.name,
        account_id: updatedDeal.account_id,
        owner_id: updatedDeal.owner_id,
        team_id: updatedDeal.team_id,
        stage: updatedDeal.stage,
        amount: updatedDeal.amount,
        probability: updatedDeal.probability,
        close_date: updatedDeal.close_date,
        risk_score: updatedDeal.risk_score,
        forecast_category: updatedDeal.forecast_category,
        metadata: updatedDeal.metadata,
        ai_analysis: updatedDeal.ai_analysis,
        created_at: updatedDeal.created_at,
        updated_at: updatedDeal.updated_at,
        closed_at: updatedDeal.closed_at,
      },
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sqlClient = neon(process.env.DATABASE_URL!);

    const checkResult = await sqlClient`
      SELECT id::text FROM deals WHERE id = ${id}::uuid
    `;

    if (!checkResult || checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      });
    }

    await sqlClient`
      DELETE FROM deals 
      WHERE id = ${id}::uuid
    `;

    res.json({
      success: true,
      message: 'Deal deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete deal',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
