/**
 * Rate Limiting Middleware
 *
 * Prevents API abuse with flexible rate limiting
 *
 * Features:
 * - Per-user rate limiting
 * - Per-IP rate limiting
 * - Per-endpoint rate limiting
 * - Sliding window algorithm
 * - Redis-backed for distributed systems
 * - Custom limits per tier/plan
 * - Rate limit headers (X-RateLimit-*)
 *
 * Priority 1 Launch Blocker Feature
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

// Redis client (optional, falls back to in-memory)
let redis: ReturnType<typeof createClient> | null = null;

if (process.env.REDIS_URL) {
  redis = createClient({ url: process.env.REDIS_URL });
  redis.connect().catch(console.error);
}

// In-memory fallback for development
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

// =============================================
// TYPES & INTERFACES
// =============================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetAt: Date;
}

// =============================================
// RATE LIMIT MIDDLEWARE
// =============================================

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
    handler = defaultHandler,
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);

      // Get current count
      const info = await getRateLimitInfo(key, windowMs, max);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, info.remaining));
      res.setHeader('X-RateLimit-Reset', Math.floor(info.resetAt.getTime() / 1000));

      // Check if limit exceeded
      if (info.current > info.limit) {
        res.setHeader('Retry-After', Math.ceil((info.resetAt.getTime() - Date.now()) / 1000));
        return handler(req, res);
      }

      // Increment counter (unless configured to skip)
      if (!skipSuccessfulRequests && !skipFailedRequests) {
        await incrementCounter(key, windowMs);
      } else {
        // Handle skip logic after response
        const originalSend = res.send;
        res.send = function (data: any) {
          const statusCode = res.statusCode;
          const shouldSkip =
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);

          if (!shouldSkip) {
            incrementCounter(key, windowMs).catch(console.error);
          }

          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow request to proceed
      next();
    }
  };
}

/**
 * Get rate limit info for a key
 */
async function getRateLimitInfo(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitInfo> {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (redis) {
    // Use Redis with sliding window
    const count = await redis.zCount(key, windowStart, now);

    return {
      limit: max,
      current: count,
      remaining: max - count,
      resetAt: new Date(now + windowMs),
    };
  } else {
    // Use in-memory store
    const record = inMemoryStore.get(key);

    if (!record || record.resetAt < now) {
      return {
        limit: max,
        current: 0,
        remaining: max,
        resetAt: new Date(now + windowMs),
      };
    }

    return {
      limit: max,
      current: record.count,
      remaining: max - record.count,
      resetAt: new Date(record.resetAt),
    };
  }
}

/**
 * Increment counter for a key
 */
async function incrementCounter(key: string, windowMs: number): Promise<void> {
  const now = Date.now();

  if (redis) {
    // Add to sorted set with score = timestamp
    await redis.zAdd(key, { score: now, value: now.toString() });

    // Remove old entries outside window
    await redis.zRemRangeByScore(key, 0, now - windowMs);

    // Set expiry
    await redis.expire(key, Math.ceil(windowMs / 1000));
  } else {
    // Use in-memory store
    const record = inMemoryStore.get(key);

    if (!record || record.resetAt < now) {
      inMemoryStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
    } else {
      record.count++;
    }

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      cleanupExpired();
    }
  }
}

/**
 * Default key generator (per user or per IP)
 */
function defaultKeyGenerator(req: Request): string {
  // If authenticated, use user ID
  if (req.user) {
    return `ratelimit:user:${req.user.id}`;
  }

  // Otherwise use IP address
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `ratelimit:ip:${ip}`;
}

/**
 * Default rate limit exceeded handler
 */
function defaultHandler(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: 'TooManyRequests',
    message: 'Too many requests, please try again later',
  });
}

/**
 * Clean up expired in-memory entries
 */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, record] of inMemoryStore.entries()) {
    if (record.resetAt < now) {
      inMemoryStore.delete(key);
    }
  }
}

// =============================================
// PRESET RATE LIMITERS
// =============================================

/**
 * General API rate limiter
 * 100 requests per minute per user
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many API requests, please slow down',
});

/**
 * Strict rate limiter (for expensive operations)
 * 10 requests per minute per user
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests for this operation',
});

/**
 * Auth rate limiter (for login/register)
 * 5 requests per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ratelimit:auth:${ip}`;
  },
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * Search rate limiter
 * 60 requests per minute per user
 */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many search requests',
});

/**
 * Email rate limiter
 * 100 emails per hour per user
 */
export const emailRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: 'Email rate limit exceeded',
  keyGenerator: (req) => {
    if (req.user) {
      return `ratelimit:email:${req.user.id}`;
    }
    return `ratelimit:email:unknown`;
  },
});

/**
 * Bulk email rate limiter (more generous)
 * 10 bulk jobs per day per user
 */
export const bulkEmailRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  message: 'Daily bulk email limit exceeded',
  keyGenerator: (req) => {
    if (req.user) {
      return `ratelimit:bulk-email:${req.user.id}`;
    }
    return `ratelimit:bulk-email:unknown`;
  },
});

/**
 * AI rate limiter (for AI operations)
 * 50 requests per hour per user
 */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: 'AI rate limit exceeded',
  keyGenerator: (req) => {
    if (req.user) {
      return `ratelimit:ai:${req.user.id}`;
    }
    return `ratelimit:ai:unknown`;
  },
});

/**
 * Create custom rate limiter per tier
 */
export function createTierRateLimit(tier: 'free' | 'starter' | 'pro' | 'enterprise') {
  const limits = {
    free: { windowMs: 60 * 1000, max: 20 },
    starter: { windowMs: 60 * 1000, max: 60 },
    pro: { windowMs: 60 * 1000, max: 200 },
    enterprise: { windowMs: 60 * 1000, max: 1000 },
  };

  const config = limits[tier];

  return rateLimit({
    ...config,
    message: `Rate limit exceeded for ${tier} tier`,
    keyGenerator: (req) => {
      if (req.user) {
        return `ratelimit:${tier}:${req.user.id}`;
      }
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `ratelimit:${tier}:${ip}`;
    },
  });
}

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(
  userId: string,
  type: string = 'general'
): Promise<RateLimitInfo> {
  const key = `ratelimit:${type}:${userId}`;
  const windowMs = 60 * 1000;
  const max = 100;

  return getRateLimitInfo(key, windowMs, max);
}

/**
 * Reset rate limit for a user (admin only)
 */
export async function resetRateLimit(userId: string, type: string = 'general'): Promise<void> {
  const key = `ratelimit:${type}:${userId}`;

  if (redis) {
    await redis.del(key);
  } else {
    inMemoryStore.delete(key);
  }
}

// =============================================
// EXPORTS
// =============================================

export default {
  rateLimit,
  generalRateLimit,
  strictRateLimit,
  authRateLimit,
  searchRateLimit,
  emailRateLimit,
  bulkEmailRateLimit,
  aiRateLimit,
  createTierRateLimit,
  getRateLimitStatus,
  resetRateLimit,
};
