/**
 * API Keys Management Routes
 *
 * Endpoints:
 * - GET    /api/v1/api-keys - List API keys
 * - POST   /api/v1/api-keys - Create new API key
 * - DELETE /api/v1/api-keys/:id - Revoke API key
 */

import { Router, Request, Response } from 'express';
import { apiKeyService } from '../../lib/apiKeys/apiKeyService';
import { APIError, ValidationError } from '../middleware/errorHandler';

const router = Router();

// =============================================
// GET /api/v1/api-keys
// List all API keys for the organization
// =============================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;
    const apiKeys = await apiKeyService.getAPIKeys(organizationId);

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    throw new APIError('Failed to fetch API keys', 500);
  }
});

// =============================================
// POST /api/v1/api-keys
// Create a new API key
// =============================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, scopes, expiresIn } = req.body;

    // Validation
    if (!name) {
      throw new ValidationError('Missing required fields', {
        name: ['Name is required'],
      });
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      throw new ValidationError('Invalid scopes', {
        scopes: ['At least one scope is required'],
      });
    }

    // Validate scopes
    const validScopes = ['read', 'write', 'delete', 'admin'];
    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new ValidationError('Invalid scopes', {
        scopes: [`Invalid scopes: ${invalidScopes.join(', ')}`],
      });
    }

    const result = await apiKeyService.createAPIKey({
      name,
      scopes,
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      expiresIn: expiresIn || null,
    });

    res.status(201).json({
      success: true,
      data: {
        apiKey: result.apiKey,
        key: result.key, // Full key returned only on creation
      },
    });
  } catch (error) {
    throw error;
  }
});

// =============================================
// DELETE /api/v1/api-keys/:id
// Revoke an API key
// =============================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await apiKeyService.revokeAPIKey(id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    throw error;
  }
});

export default router;
