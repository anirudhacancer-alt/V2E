/**
 * Authentication Middleware
 *
 * Lightweight auth for pilot/internal use.
 * Validates Bearer token against V2E_API_TOKEN env var.
 */

import type { Context, Next, MiddlewareHandler } from "hono";
import { V2E_API_TOKEN, V2E_API_USER_ID } from "../env.js";

/** Context variables set by auth middleware */
export interface AuthVariables {
  userId: string;
}

/**
 * Extract Bearer token from Authorization header.
 * Returns null if header is missing or malformed.
 */
function extractBearerToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Required authentication middleware.
 * Rejects requests without a valid Bearer token.
 *
 * On success, sets `c.set('userId', V2E_API_USER_ID)` for downstream handlers.
 * On failure, returns 401 JSON error.
 *
 * Usage:
 * ```ts
 * import { requireAuth } from '../middleware/auth.js';
 * router.post('/protected', requireAuth, async (c) => { ... });
 * ```
 */
export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const token = extractBearerToken(c);

  if (!token) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing Authorization header. Expected: Bearer <token>",
        },
      },
      401
    );
  }

  if (token !== V2E_API_TOKEN) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API token",
        },
      },
      401
    );
  }

  // Token valid - set user context for downstream handlers
  c.set("userId", V2E_API_USER_ID);
  await next();
  return;
};

/**
 * Optional authentication middleware.
 * Sets userId if valid token is present, but does not reject otherwise.
 *
 * Useful for routes that work with or without authentication,
 * potentially providing enhanced features for authenticated users.
 *
 * Usage:
 * ```ts
 * import { optionalAuth } from '../middleware/auth.js';
 * router.get('/public', optionalAuth, async (c) => {
 *   const userId = c.get('userId'); // may be undefined
 * });
 * ```
 */
export const optionalAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const token = extractBearerToken(c);

  if (token && token === V2E_API_TOKEN) {
    c.set("userId", V2E_API_USER_ID);
  }

  await next();
  return;
};
