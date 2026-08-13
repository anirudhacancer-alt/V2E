/**
 * Technical Reviews Routes
 *
 * Routes for technical review workflow commands:
 * approve, submit for technical review, request-rework.
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  tasks,
  teamMembers,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

// ============================================================================
// Router Setup
// ============================================================================

const taskReviewsRouter = new Hono();

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
// Technical review workflow routes (task-scoped commands)
// ============================================================================

/**
 * POST /v1/tasks/:taskId/review/approve
 * Approve a task after technical review.
 * Body: { projectId, approvedBy, notes? }
 */
taskReviewsRouter.post("/:taskId/review/approve", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: {
    projectId?: string;
    approvedBy?: string;
    notes?: string;
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

  const taskId = c.req.param("taskId");
  if (!taskId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "taskId is required in path",
        },
      },
      400
    );
  }

  const projectId = body.projectId;
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required in body",
        },
      },
      400
    );
  }

  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Task not found",
            details: { taskId },
          },
        },
        404
      );
    }

    if (existing.projectId !== projectId) {
      return c.json(
        {
          error: {
            code: "PROJECT_MISMATCH",
            message: "Task does not belong to the specified project",
            details: { taskId, projectId },
          },
        },
        400
      );
    }

    // Task must be in 'done' status to be approved
    if (existing.status !== "done") {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Task must be in 'done' status to be approved",
            details: { currentStatus: existing.status },
          },
        },
        400
      );
    }

    if (!body.approvedBy) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "approvedBy is required",
            details: {},
          },
        },
        400
      );
    }

    // Validate approvedBy exists
    const [approver] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.id, body.approvedBy));

    if (!approver) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "approvedBy not found in team_members",
            details: { approvedBy: body.approvedBy },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();

    // For now, approval doesn't change status but we log it
    // In a full implementation, this might set a separate approvalStatus field
    opsLog("info", "task.approved", {
      taskId,
      projectId: existing.projectId,
      approvedBy: body.approvedBy,
    });

    await insertAuditEvent(db, {
      eventType: "task.approved",
      projectId: existing.projectId,
      entityType: "task",
      entityId: taskId,
      payload: {
        approvedBy: body.approvedBy,
        notes: body.notes ?? null,
        approvedAt: now,
      },
    });

    return c.json({
      id: taskId,
      status: existing.status,
      approval: {
        approvedBy: body.approvedBy,
        approvedAt: now,
        notes: body.notes ?? null,
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * POST /v1/tasks/:taskId/review/submit
 * Submit a task for technical review.
 * Body: { projectId, submittedBy, notes? }
 */
taskReviewsRouter.post("/:taskId/review/submit", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: {
    projectId?: string;
    submittedBy?: string;
    notes?: string;
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

  const taskId = c.req.param("taskId");
  if (!taskId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "taskId is required in path",
        },
      },
      400
    );
  }

  const projectId = body.projectId;
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required in body",
        },
      },
      400
    );
  }

  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Task not found",
            details: { taskId },
          },
        },
        404
      );
    }

    if (existing.projectId !== projectId) {
      return c.json(
        {
          error: {
            code: "PROJECT_MISMATCH",
            message: "Task does not belong to the specified project",
            details: { taskId, projectId },
          },
        },
        400
      );
    }

    // Task must be in 'in_progress' status to be submitted for review
    if (existing.status !== "in_progress") {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Task must be in 'in_progress' status to submit for technical review",
            details: { currentStatus: existing.status },
          },
        },
        400
      );
    }

    if (!body.submittedBy) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "submittedBy is required",
            details: {},
          },
        },
        400
      );
    }

    // Validate submittedBy exists
    const [submitter] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.id, body.submittedBy));

    if (!submitter) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "submittedBy not found in team_members",
            details: { submittedBy: body.submittedBy },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();

    // Transition task to 'done' status which puts it in the technical review queue
    await db
      .update(tasks)
      .set({
        status: "done",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    opsLog("info", "task.submitted_for_technical_review", {
      taskId,
      projectId: existing.projectId,
      submittedBy: body.submittedBy,
    });

    await insertAuditEvent(db, {
      eventType: "task.submitted_for_technical_review",
      projectId: existing.projectId,
      entityType: "task",
      entityId: taskId,
      payload: {
        submittedBy: body.submittedBy,
        notes: body.notes ?? null,
        previousStatus: "in_progress",
        newStatus: "done",
        submittedAt: now,
      },
    });

    return c.json({
      id: taskId,
      status: "done",
      submission: {
        submittedBy: body.submittedBy,
        submittedAt: now,
        notes: body.notes ?? null,
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * POST /v1/tasks/:taskId/review/request-rework
 * Request rework on a task (returns it to in_progress).
 * Body: { projectId, requestedBy, reason }
 */
taskReviewsRouter.post("/:taskId/review/request-rework", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: {
    projectId?: string;
    requestedBy?: string;
    reason?: string;
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

  const taskId = c.req.param("taskId");
  if (!taskId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "taskId is required in path",
        },
      },
      400
    );
  }

  const projectId = body.projectId;
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required in body",
        },
      },
      400
    );
  }

  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Task not found",
            details: { taskId },
          },
        },
        404
      );
    }

    if (existing.projectId !== projectId) {
      return c.json(
        {
          error: {
            code: "PROJECT_MISMATCH",
            message: "Task does not belong to the specified project",
            details: { taskId, projectId },
          },
        },
        400
      );
    }

    // Task must be in 'done' status to request rework
    if (existing.status !== "done") {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Task must be in 'done' status to request rework",
            details: { currentStatus: existing.status },
          },
        },
        400
      );
    }

    if (!body.requestedBy || !body.reason) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "requestedBy and reason are required",
            details: {
              missingFields: [
                !body.requestedBy ? "requestedBy" : null,
                !body.reason ? "reason" : null,
              ].filter(Boolean),
            },
          },
        },
        400
      );
    }

    // Validate requestedBy exists
    const [requester] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.id, body.requestedBy));

    if (!requester) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "requestedBy not found in team_members",
            details: { requestedBy: body.requestedBy },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();

    // Update task status back to in_progress
    await db
      .update(tasks)
      .set({
        status: "in_progress",
        completedAt: null,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    opsLog("info", "task.rework_requested", {
      taskId,
      projectId: existing.projectId,
      requestedBy: body.requestedBy,
    });

    await insertAuditEvent(db, {
      eventType: "task.rework_requested",
      projectId: existing.projectId,
      entityType: "task",
      entityId: taskId,
      payload: {
        requestedBy: body.requestedBy,
        reason: body.reason,
        previousStatus: "done",
        newStatus: "in_progress",
        requestedAt: now,
      },
    });

    return c.json({
      id: taskId,
      status: "in_progress",
      rework: {
        requestedBy: body.requestedBy,
        reason: body.reason,
        requestedAt: now,
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { taskReviewsRouter };
