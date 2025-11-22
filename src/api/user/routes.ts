/**
 * User Profile Routes
 *
 * Endpoints:
 * - PATCH /api/v1/me - Update profile
 * - POST  /api/v1/me/change-password - Change password
 * - GET   /api/v1/me/preferences - Get preferences
 * - PATCH /api/v1/me/preferences - Update preferences
 * - POST  /api/v1/me/enable-2fa - Enable 2FA
 * - POST  /api/v1/me/disable-2fa - Disable 2FA
 */

import { Router, Request, Response } from 'express';
import { userService } from '../../lib/user/userService';
import { APIError, ValidationError } from '../middleware/errorHandler';

const router = Router();

// =============================================
// PATCH /api/v1/me
// Update user profile
// =============================================
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;

    await userService.updateProfile({
      userId: req.user!.id,
      name,
      email,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// POST /api/v1/me/change-password
// Change password
// =============================================
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Missing required fields', {
        currentPassword: !currentPassword ? ['Current password is required'] : [],
        newPassword: !newPassword ? ['New password is required'] : [],
      });
    }

    if (newPassword.length < 8) {
      throw new ValidationError('Invalid password', {
        newPassword: ['Password must be at least 8 characters long'],
      });
    }

    await userService.changePassword({
      userId: req.user!.id,
      currentPassword,
      newPassword,
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('incorrect')) {
      throw new APIError('Current password is incorrect', 400);
    }
    throw error;
  }
});

// =============================================
// GET /api/v1/me/preferences
// Get user preferences
// =============================================
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const preferences = await userService.getPreferences(req.user!.id);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    throw new APIError('Failed to fetch preferences', 500);
  }
});

// =============================================
// PATCH /api/v1/me/preferences
// Update user preferences
// =============================================
router.patch('/preferences', async (req: Request, res: Response) => {
  try {
    const { emailNotifications, desktopNotifications, weeklyDigest } = req.body;

    await userService.updatePreferences({
      userId: req.user!.id,
      emailNotifications,
      desktopNotifications,
      weeklyDigest,
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// POST /api/v1/me/enable-2fa
// Enable two-factor authentication
// =============================================
router.post('/enable-2fa', async (req: Request, res: Response) => {
  try {
    const result = await userService.enable2FA(req.user!.id);

    res.json({
      success: true,
      data: result,
      message: 'Two-factor authentication enabled',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// POST /api/v1/me/disable-2fa
// Disable two-factor authentication
// =============================================
router.post('/disable-2fa', async (req: Request, res: Response) => {
  try {
    await userService.disable2FA(req.user!.id);

    res.json({
      success: true,
      message: 'Two-factor authentication disabled',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
