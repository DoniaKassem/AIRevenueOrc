/**
 * Team Management API Routes
 *
 * Endpoints:
 * - GET    /api/v1/team/members - List team members
 * - POST   /api/v1/team/invite - Invite new member
 * - PATCH  /api/v1/team/members/:id/role - Update member role
 * - DELETE /api/v1/team/members/:id - Remove member
 * - GET    /api/v1/team/invitations - List pending invitations
 * - POST   /api/v1/team/invitations/:id/resend - Resend invitation
 * - DELETE /api/v1/team/invitations/:id - Cancel invitation
 */

import { Router, Request, Response } from 'express';
import { teamService } from '../../lib/team/teamService';
import { APIError, ValidationError } from '../middleware/errorHandler';
import '../express'; // Import type extensions

const router = Router();

// =============================================
// GET /api/v1/team/members
// List all team members
// =============================================
router.get('/members', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const members = await teamService.getTeamMembers(organizationId);

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    throw new APIError('Failed to fetch team members', 500);
  }
});

// =============================================
// POST /api/v1/team/invite
// Invite a new team member
// =============================================
router.post('/invite', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;

    // Validation
    if (!email || !role) {
      throw new ValidationError('Missing required fields', {
        email: !email ? ['Email is required'] : [],
        role: !role ? ['Role is required'] : [],
      });
    }

    if (!['admin', 'user', 'viewer'].includes(role)) {
      throw new ValidationError('Invalid role', {
        role: ['Role must be one of: admin, user, viewer'],
      });
    }

    // Check if user has permission (only admins can invite)
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can invite team members', 403);
    }

    const invitation = await teamService.inviteMember({
      email,
      role,
      organizationId: req.user!.organizationId,
      invitedBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw new APIError(error.message, 409);
    }
    throw error;
  }
});

// =============================================
// PATCH /api/v1/team/members/:id/role
// Update team member role
// =============================================
router.patch('/members/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validation
    if (!role) {
      throw new ValidationError('Missing required fields', {
        role: ['Role is required'],
      });
    }

    if (!['admin', 'user', 'viewer'].includes(role)) {
      throw new ValidationError('Invalid role', {
        role: ['Role must be one of: admin, user, viewer'],
      });
    }

    // Check if user has permission (only admins)
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can change member roles', 403);
    }

    // Prevent changing own role
    if (id === req.user!.id) {
      throw new APIError('You cannot change your own role', 400);
    }

    await teamService.updateMemberRole(id, role, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// DELETE /api/v1/team/members/:id
// Remove team member
// =============================================
router.delete('/members/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user has permission (only admins)
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can remove team members', 403);
    }

    // Prevent removing yourself
    if (id === req.user!.id) {
      throw new APIError('You cannot remove yourself from the team', 400);
    }

    await teamService.removeMember(id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// GET /api/v1/team/invitations
// List pending invitations
// =============================================
router.get('/invitations', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const invitations = await teamService.getInvitations(organizationId);

    res.json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    throw new APIError('Failed to fetch invitations', 500);
  }
});

// =============================================
// POST /api/v1/team/invitations/:id/resend
// Resend invitation email
// =============================================
router.post('/invitations/:id/resend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user has permission (only admins)
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can resend invitations', 403);
    }

    await teamService.resendInvitation(id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Invitation resent successfully',
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// DELETE /api/v1/team/invitations/:id
// Cancel invitation
// =============================================
router.delete('/invitations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user has permission (only admins)
    if (req.user!.role !== 'admin') {
      throw new APIError('Only admins can cancel invitations', 403);
    }

    await teamService.cancelInvitation(id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
