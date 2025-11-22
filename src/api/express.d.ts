/**
 * Express Request Type Extensions
 * Extends the Express Request interface to include user authentication
 */

import { AuthUser } from '../types/database';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
