/**
 * Notifications Routes
 *
 * Routes for user notifications management.
 */

import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { notifications } from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
  ValidationError,
  isValidationError,
} from "../lib/data-integrity.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

// ============================================================================
// Constants and Types
// ============================================================================

const NOTIFICATION_STATUSES = ["unread", "read", "archived"] as const;
type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// ============================================================================
// Router Setup
// ============================================================================

const notificationsRouter = new Hono();

// ============================================================================
// Helper Functions
// ============================================================================

function integrityErrorResponse(c: Context, e: DataIntegrityError) {
  opsLog("error", "data_integrity", {
    message: e.message,
    details: e.details,
  });
  return c.json(
    {
      error: {
        code: e.code,
        message: e.message,
        details: e.details ?? {},
      },
    },
    500
  );
}

function validationErrorResponse(
  c: Context,
  e: ValidationError,
  status: 400 | 409 = 400
) {
  return c.json(
    {
      error: {
        code: e.code,
        message: e.message,
        details: e.details ?? {},
      },
    },
    status
  );
}

function dbNotReady(c: Context) {
  const sqlitePath = resolveSqlitePath();
  return c.json(
    {
      error: {
        code: "DB_NOT_FOUND",
        message:
          "Demo SQLite file is missing. Seed it from the repo root: pnpm --filter @v2e/database db:seed",
        details: { path: sqlitePath },
      },
    },
    503
  );
}

// ============================================================================
// Notifications Routes
// ============================================================================

/**
 * GET /v1/notifications
 * List notifications for the current user.
 */
notificationsRouter.get("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const userId = (c as any).get("userId") as string;

  try {
    // Query params
    const status = c.req.query("status");
    const type = c.req.query("type");
    const limit = parseInt(c.req.query("limit") ?? "50", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    // For demo purposes, return all notifications if no specific user filter
    // Build conditions
    const conditions = [eq(notifications.userId, userId)];
    if (status) {
      conditions.push(eq(notifications.status, status));
    }
    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    const query = conditions.length > 0
      ? db
          .select()
          .from(notifications)
          .where(and(...conditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(notifications)
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset);

    const items = await query;

    return c.json({
      items,
      total: items.length,
      limit,
      offset,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * GET /v1/notifications/:notificationId
 * Get a single notification.
 */
notificationsRouter.get("/:notificationId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const notificationId = c.req.param("notificationId")!;
  const db = getDemoDb();
  const userId = (c as any).get("userId") as string;

  try {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    if (!notification) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Notification not found",
            details: { notificationId },
          },
        },
        404
      );
    }

    return c.json(notification);
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/notifications/:notificationId
 * Update notification (mark as read/archived).
 */
notificationsRouter.patch("/:notificationId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const notificationId = c.req.param("notificationId")!;
  const db = getDemoDb();
  const userId = (c as any).get("userId") as string;

  try {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Notification not found",
            details: { notificationId },
          },
        },
        404
      );
    }

    let body: {
      status?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        },
        400
      );
    }

    // Validate status if provided
    if (body.status && !NOTIFICATION_STATUSES.includes(body.status as NotificationStatus)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: NOTIFICATION_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const newStatus = body.status ?? existing.status;
    const readAt = newStatus === "read" && existing.status === "unread"
      ? now
      : existing.readAt;

    await db
      .update(notifications)
      .set({
        status: newStatus,
        readAt,
      })
      .where(eq(notifications.id, notificationId));

    opsLog("info", "notification.updated", {
      notificationId,
      userId: existing.userId,
      status: newStatus,
    });

    return c.json({
      id: notificationId,
      tenantId: existing.tenantId,
      userId: existing.userId,
      type: existing.type,
      title: existing.title,
      body: existing.body,
      entityType: existing.entityType,
      entityId: existing.entityId,
      status: newStatus,
      createdAt: existing.createdAt,
      readAt,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    if (isValidationError(e)) {
      return validationErrorResponse(c, e);
    }
    throw e;
  }
});

export { notificationsRouter };
