/**
 * Error Handling Middleware
 *
 * Standardized error responses and logging
 *
 * Features:
 * - Consistent error response format
 * - Error logging with context
 * - Stack trace in development
 * - Sentry integration for production
 * - Validation error formatting
 * - Custom error classes
 *
 * Priority 1 Launch Blocker Feature
 */

import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { AuthUser } from '../../types/database';

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
// CUSTOM ERROR CLASSES
// =============================================

export class APIError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends APIError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends APIError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

export class ConflictError extends APIError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

export class ValidationError extends APIError {
  errors: Record<string, string[]>;

  constructor(message: string = 'Validation Error', errors: Record<string, string[]> = {}) {
    super(message, 422);
    this.errors = errors;
  }
}

export class RateLimitError extends APIError {
  retryAfter?: number;

  constructor(message: string = 'Too Many Requests', retryAfter?: number) {
    super(message, 429);
    this.retryAfter = retryAfter;
  }
}

export class InternalServerError extends APIError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, false); // Not operational - unexpected error
  }
}

// =============================================
// ERROR RESPONSE INTERFACE
// =============================================

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  errors?: Record<string, string[]>; // For validation errors
  stack?: string; // Only in development
}

// =============================================
// ERROR HANDLER MIDDLEWARE
// =============================================

/**
 * Global error handler
 */
export function errorHandler(
  err: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  logError(err, req);

  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production' && shouldReportToSentry(err)) {
    Sentry.captureException(err, {
      tags: {
        path: req.path,
        method: req.method,
      },
      user: req.user
        ? {
            id: req.user.id,
            email: req.user.email,
          }
        : undefined,
    });
  }

  // Build error response
  const response = buildErrorResponse(err, req);

  // Send response
  res.status(response.statusCode).json(response);
}

/**
 * Build standardized error response
 */
function buildErrorResponse(err: Error | APIError, req: Request): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error response
  let statusCode = 500;
  let errorName = 'InternalServerError';
  let message = 'An unexpected error occurred';
  let errors: Record<string, string[]> | undefined;

  // Handle APIError
  if (err instanceof APIError) {
    statusCode = err.statusCode;
    errorName = err.constructor.name.replace('Error', '');
    message = err.message;

    if (err instanceof ValidationError) {
      errors = err.errors;
    }
  }
  // Handle known error types
  else if (err.name === 'ValidationError') {
    statusCode = 422;
    errorName = 'ValidationError';
    message = err.message;
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorName = 'Unauthorized';
    message = 'Authentication required';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorName = 'TokenExpired';
    message = 'Token has expired';
  } else if (err.message.includes('duplicate key') || err.message.includes('unique constraint')) {
    statusCode = 409;
    errorName = 'Conflict';
    message = 'Resource already exists';
  }

  return {
    success: false,
    error: errorName,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'] as string | undefined,
    errors,
    stack: isDevelopment ? err.stack : undefined,
  };
}

/**
 * Log error with context
 */
function logError(err: Error | APIError, req: Request): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isOperational = err instanceof APIError ? err.isOperational : false;

  // Only log non-operational errors or in development
  if (!isOperational || isDevelopment) {
    console.error('Error:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err instanceof APIError ? err.statusCode : 500,
      path: req.path,
      method: req.method,
      user: req.user?.id,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Determine if error should be reported to Sentry
 */
function shouldReportToSentry(err: Error | APIError): boolean {
  // Don't report operational errors (4xx)
  if (err instanceof APIError) {
    return !err.isOperational || err.statusCode >= 500;
  }

  // Report all other errors
  return true;
}

// =============================================
// 404 NOT FOUND HANDLER
// =============================================

/**
 * Handle 404 Not Found
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

// =============================================
// ASYNC ERROR WRAPPER
// =============================================

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// =============================================
// ERROR UTILITIES
// =============================================

/**
 * Assert condition or throw error
 */
export function assert(condition: boolean, message: string, ErrorClass = BadRequestError): asserts condition {
  if (!condition) {
    throw new ErrorClass(message);
  }
}

/**
 * Assert value exists or throw 404
 */
export function assertExists<T>(value: T | null | undefined, message: string = 'Resource not found'): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(message);
  }
}

/**
 * Assert user has permission or throw 403
 */
export function assertPermission(hasPermission: boolean, message: string = 'Permission denied'): asserts hasPermission {
  if (!hasPermission) {
    throw new ForbiddenError(message);
  }
}

// =============================================
// VALIDATION ERROR HELPERS
// =============================================

/**
 * Create validation error from field errors
 */
export function createValidationError(
  errors: Record<string, string | string[]>
): ValidationError {
  const formattedErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(errors)) {
    formattedErrors[field] = Array.isArray(messages) ? messages : [messages];
  }

  return new ValidationError('Validation failed', formattedErrors);
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): void {
  const errors: Record<string, string[]> = {};

  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors[field] = [`${field} is required`];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw createValidationError(errors);
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName: string = 'email'): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw createValidationError({
      [fieldName]: ['Invalid email format'],
    });
  }
}

/**
 * Validate array length
 */
export function validateArrayLength(
  array: any[],
  min: number,
  max: number,
  fieldName: string = 'items'
): void {
  const errors: Record<string, string[]> = {};

  if (array.length < min) {
    errors[fieldName] = [`Must have at least ${min} ${fieldName}`];
  }

  if (array.length > max) {
    errors[fieldName] = [`Cannot have more than ${max} ${fieldName}`];
  }

  if (Object.keys(errors).length > 0) {
    throw createValidationError(errors);
  }
}

// =============================================
// EXPORTS
// =============================================

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  assert,
  assertExists,
  assertPermission,
  createValidationError,
  validateRequired,
  validateEmail,
  validateArrayLength,
  // Error classes
  APIError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
};
