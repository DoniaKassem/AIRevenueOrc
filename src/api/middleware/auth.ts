/**
 * Authentication & Authorization Middleware
 *
 * JWT-based authentication with role-based access control
 *
 * Features:
 * - JWT token validation
 * - Refresh token support
 * - Role-based permissions (admin, user, viewer)
 * - Organization-based multi-tenancy
 * - API key authentication (for integrations)
 * - Session management
 *
 * Priority 1 Launch Blocker Feature
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// =============================================
// TYPES & INTERFACES
// =============================================

export interface AuthUser {
  id: string;
  email: string;
  organizationId: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
}

export interface JWTPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
  iat: number;
  exp: number;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      apiKey?: string;
    }
  }
}

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

/**
 * Require authentication via JWT or API key
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'No authentication token provided',
    });
  }

  // Check if it's an API key (starts with 'sk_' or 'pk_')
  if (token.startsWith('sk_') || token.startsWith('pk_')) {
    return authenticateWithApiKey(token, req, res, next);
  }

  // Otherwise, treat as JWT
  return authenticateWithJWT(token, req, res, next);
}

/**
 * Authenticate with JWT token
 */
async function authenticateWithJWT(
  token: string,
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, organization_id, role, permissions')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Check if user is active
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Account suspended',
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      organizationId: user.organization_id,
      role: user.role,
      permissions: user.permissions || [],
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'Token has expired',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }
}

/**
 * Authenticate with API key
 */
async function authenticateWithApiKey(
  apiKey: string,
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get API key from database
    const { data: key, error } = await supabase
      .from('api_keys')
      .select('*, users(id, email, organization_id, role, permissions)')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single();

    if (error || !key) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    // Check if expired
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API key expired',
      });
    }

    // Check IP whitelist
    if (key.ip_whitelist && key.ip_whitelist.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;
      if (!key.ip_whitelist.includes(clientIp)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'IP address not whitelisted',
        });
      }
    }

    // Update last used
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id);

    // Attach user to request
    const user = key.users;
    req.user = {
      id: user.id,
      email: user.email,
      organizationId: user.organization_id,
      role: user.role,
      permissions: key.scopes || user.permissions || [],
    };
    req.apiKey = apiKey;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  // Try to authenticate but don't fail
  requireAuth(req, res, (err?: any) => {
    if (err) {
      // Continue without user
      return next();
    }
    next();
  });
}

/**
 * Extract token from request headers
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Bearer token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // API key
  if (authHeader.startsWith('ApiKey ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

// =============================================
// AUTHORIZATION MIDDLEWARE
// =============================================

/**
 * Require specific role
 */
export function requireRole(...roles: Array<'admin' | 'user' | 'viewer'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Requires role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Require specific permission
 */
export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const hasPermission = permissions.some(permission =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Requires permission: ${permissions.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require user or admin role (not viewer)
 */
export const requireUserOrAdmin = requireRole('admin', 'user');

/**
 * Require organization access
 */
export function requireOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  const organizationId = req.params.organizationId || req.body.organizationId || req.query.organizationId;

  if (!organizationId) {
    return res.status(400).json({
      success: false,
      error: 'BadRequest',
      message: 'Organization ID required',
    });
  }

  if (req.user.organizationId !== organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Access denied to this organization',
    });
  }

  next();
}

// =============================================
// TOKEN GENERATION
// =============================================

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '15m', // Short-lived access token
    }
  );
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(user: {
  id: string;
  email: string;
  organizationId: string;
  role: string;
}): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET!,
    {
      expiresIn: '7d', // Long-lived refresh token
    }
  );
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JWTPayload;

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return null;
    }

    // Generate new tokens
    return {
      accessToken: generateAccessToken({
        id: user.id,
        email: user.email,
        organizationId: user.organization_id,
        role: user.role,
      }),
      refreshToken: generateRefreshToken({
        id: user.id,
        email: user.email,
        organizationId: user.organization_id,
        role: user.role,
      }),
    };
  } catch (error) {
    return null;
  }
}

// =============================================
// API KEY MANAGEMENT
// =============================================

/**
 * Generate API key
 */
export function generateApiKey(): string {
  const prefix = 'sk_live_'; // Secret key for live environment
  const random = crypto.randomBytes(32).toString('hex');
  return prefix + random;
}

/**
 * Create API key for user
 */
export async function createApiKey(params: {
  userId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date;
  ipWhitelist?: string[];
}): Promise<{
  id: string;
  key: string;
  name: string;
}> {
  const apiKey = generateApiKey();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: params.userId,
      key: apiKey,
      name: params.name,
      scopes: params.scopes,
      expires_at: params.expiresAt?.toISOString(),
      ip_whitelist: params.ipWhitelist,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error('Failed to create API key');
  }

  return {
    id: data.id,
    key: apiKey,
    name: data.name,
  };
}

/**
 * Revoke API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<void> {
  await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('user_id', userId);
}

// =============================================
// SESSION MANAGEMENT
// =============================================

/**
 * Create session
 */
export async function createSession(params: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');

  await supabase.from('sessions').insert({
    user_id: params.userId,
    session_token: sessionToken,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  });

  return sessionToken;
}

/**
 * Validate session
 */
export async function validateSession(sessionToken: string): Promise<AuthUser | null> {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, users(id, email, organization_id, role, permissions)')
    .eq('session_token', sessionToken)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (error || !session) {
    return null;
  }

  const user = session.users;
  return {
    id: user.id,
    email: user.email,
    organizationId: user.organization_id,
    role: user.role,
    permissions: user.permissions || [],
  };
}

/**
 * Revoke session
 */
export async function revokeSession(sessionToken: string): Promise<void> {
  await supabase
    .from('sessions')
    .update({ is_active: false })
    .eq('session_token', sessionToken);
}

// =============================================
// EXPORTS
// =============================================

import crypto from 'crypto';

export default {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireUserOrAdmin,
  requireOrganization,
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  generateApiKey,
  createApiKey,
  revokeApiKey,
  createSession,
  validateSession,
  revokeSession,
};
