/**
 * Billing & Subscription Routes
 *
 * Endpoints:
 * - GET  /api/v1/billing/subscription - Get current subscription
 * - GET  /api/v1/billing/usage - Get usage metrics
 * - POST /api/v1/billing/change-plan - Change subscription plan
 * - POST /api/v1/billing/cancel - Cancel subscription
 * - GET  /api/v1/billing/invoices - Get billing history
 */

import { Router, Request, Response } from 'express';
import { billingService } from '../../lib/billing/billingService';
import { APIError, ValidationError } from '../middleware/errorHandler';

const router = Router();

// =============================================
// GET /api/v1/billing/subscription
// Get current subscription
// =============================================
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const subscription = await billingService.getSubscription(organizationId);

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    throw new APIError('Failed to fetch subscription', 500);
  }
});

// =============================================
// GET /api/v1/billing/usage
// Get usage metrics
// =============================================
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const usage = await billingService.getUsageMetrics(organizationId);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    throw new APIError('Failed to fetch usage metrics', 500);
  }
});

// =============================================
// POST /api/v1/billing/change-plan
// Change subscription plan
// =============================================
router.post('/change-plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;

    // Validation
    if (!plan) {
      throw new ValidationError('Missing required fields', {
        plan: ['Plan is required'],
      });
    }

    const validPlans = ['free', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      throw new ValidationError('Invalid plan', {
        plan: [`Plan must be one of: ${validPlans.join(', ')}`],
      });
    }

    // Only admins can change plan
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can change subscription plan', 403);
    }

    await billingService.changePlan(req.user!.organizationId, plan);

    res.json({
      success: true,
      message: 'Subscription plan changed successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// POST /api/v1/billing/cancel
// Cancel subscription
// =============================================
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    // Only admins can cancel subscription
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can cancel subscription', 403);
    }

    await billingService.cancelSubscription(req.user!.organizationId);

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// GET /api/v1/billing/invoices
// Get billing history
// =============================================
router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const invoices = await billingService.getInvoices(organizationId);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    throw new APIError('Failed to fetch invoices', 500);
  }
});

export default router;
