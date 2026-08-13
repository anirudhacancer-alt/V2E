/**
 * Improvement Actions Routes
 *
 * Routes for improvement actions management.
 */

import { and, eq, desc } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  improvementActions,
  projects,
  tasks,
  teamMembers,
  commitments,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
  ValidationError,
  isValidationError,
} from "../lib/data-integrity.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

// ============================================================================
// Constants and Types
// ============================================================================

const IMPROVEMENT_ACTION_STATUSES = ["open", "in_progress", "validated", "closed"] as const;
type ImprovementActionStatus = (typeof IMPROVEMENT_ACTION_STATUSES)[number];

const IMPROVEMENT_ACTION_CATEGORIES = [
  "quality",
  "schedule",
  "safety",
  "maintenance",
  "retail_execution",
  "other",
] as const;
type ImprovementActionCategory = (typeof IMPROVEMENT_ACTION_CATEGORIES)[number];

// Valid status transitions for improvement actions
const IMPROVEMENT_ACTION_TRANSITIONS: Record<ImprovementActionStatus, ImprovementActionStatus[]> = {
  open: ["in_progress"],
  in_progress: ["validated", "open"], // open if rejected
  validated: ["closed"],
  closed: [], // Terminal
};

// ============================================================================
// Router Setup
// ============================================================================

/** All routes under `/v1/improvements` (list/create use `projectId` query or JSON body). */
const improvementsRouter = new Hono();

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
// Improvement Actions Routes
// ============================================================================

/**
 * GET /v1/improvements?projectId=…
 * List improvement actions for a project (`projectId` query required).
 */
improvementsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.query("projectId");
  const db = getDemoDb();

  try {
    if (!projectId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectId query parameter is required",
          },
        },
        400
      );
    }

    // Verify project exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Project not found",
            details: { projectId },
          },
        },
        404
      );
    }

    // Query filters
    const status = c.req.query("status");
    const category = c.req.query("category");
    const ownerId = c.req.query("ownerId");

    // Apply filters
    const conditions = [eq(improvementActions.projectId, projectId)];
    if (status) {
      conditions.push(eq(improvementActions.status, status));
    }
    if (category) {
      conditions.push(eq(improvementActions.category, category));
    }
    if (ownerId) {
      conditions.push(eq(improvementActions.ownerId, ownerId));
    }

    const actions = await db
      .select()
      .from(improvementActions)
      .where(and(...conditions))
      .orderBy(desc(improvementActions.createdAt));

    // Transform JSON fields
    const result = actions.map((action) => ({
      ...action,
      linkedTaskIds: JSON.parse(action.linkedTaskIdsJson),
      linkedBlockerIds: JSON.parse(action.linkedBlockerIdsJson),
      linkedCommitmentIds: JSON.parse(action.linkedCommitmentIdsJson),
    }));

    return c.json({ data: result, total: result.length });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * POST /v1/improvements
 * Create an improvement action. `projectId` is required in the JSON body.
 */
improvementsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      projectId: string;
      title: string;
      problemStatement: string;
      category?: string;
      rootCause?: string;
      ownerId: string;
      status?: string;
      targetDate?: string;
      linkedTaskIds?: string[];
      linkedBlockerIds?: string[];
      linkedCommitmentIds?: string[];
      effectivenessNote?: string;
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

    // Validate required fields
    const requiredFields = ["projectId", "title", "problemStatement", "ownerId"] as const;
    const missingFields = requiredFields.filter(
      (field) => !body[field as keyof typeof body]
    );

    if (missingFields.length > 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields",
            details: { missingFields },
          },
        },
        400
      );
    }

    const projectId = body.projectId;

    const [project] = await db
      .select({ id: projects.id, siteId: projects.siteId })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Project not found",
            details: { projectId },
          },
        },
        404
      );
    }

    // Validate category
    const category = (body.category ?? "other") as ImprovementActionCategory;
    if (!IMPROVEMENT_ACTION_CATEGORIES.includes(category)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid category value",
            details: { validValues: IMPROVEMENT_ACTION_CATEGORIES, received: body.category },
          },
        },
        400
      );
    }

    // Validate status
    const status = (body.status ?? "open") as ImprovementActionStatus;
    if (!IMPROVEMENT_ACTION_STATUSES.includes(status)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: IMPROVEMENT_ACTION_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    // Validate owner exists and belongs to site
    const [owner] = await db
      .select({ id: teamMembers.id, siteId: teamMembers.siteId })
      .from(teamMembers)
      .where(eq(teamMembers.id, body.ownerId));

    if (!owner) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Owner not found",
            details: { ownerId: body.ownerId },
          },
        },
        400
      );
    }

    if (owner.siteId !== project.siteId) {
      return c.json(
        {
          error: {
            code: "PROJECT_SCOPE_MISMATCH",
            message: "Owner does not belong to project site",
            details: { ownerId: body.ownerId, projectId },
          },
        },
        400
      );
    }

    // Validate linked tasks belong to same project
    const linkedTaskIds = body.linkedTaskIds ?? [];
    for (const taskId of linkedTaskIds) {
      const [task] = await db
        .select({ id: tasks.id, projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, taskId));

      if (!task) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Linked task not found",
              details: { taskId },
            },
          },
          400
        );
      }

      if (task.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "Linked task does not belong to this project",
              details: { taskId, projectId },
            },
          },
          400
        );
      }
    }

    // Validate linked commitments belong to same project
    const linkedCommitmentIds = body.linkedCommitmentIds ?? [];
    for (const commitmentId of linkedCommitmentIds) {
      const [commitment] = await db
        .select({ id: commitments.id, projectId: commitments.projectId })
        .from(commitments)
        .where(eq(commitments.id, commitmentId));

      if (!commitment) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Linked commitment not found",
              details: { commitmentId },
            },
          },
          400
        );
      }

      if (commitment.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "Linked commitment does not belong to this project",
              details: { commitmentId, projectId },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();
    const improvementActionId = randomUUID();
    const tenantId = "demo-tenant";

    await db.insert(improvementActions).values({
      id: improvementActionId,
      tenantId,
      projectId,
      siteId: project.siteId,
      title: body.title,
      problemStatement: body.problemStatement,
      category,
      rootCause: body.rootCause ?? null,
      ownerId: body.ownerId,
      status,
      targetDate: body.targetDate ?? null,
      linkedTaskIdsJson: JSON.stringify(linkedTaskIds),
      linkedBlockerIdsJson: JSON.stringify(body.linkedBlockerIds ?? []),
      linkedCommitmentIdsJson: JSON.stringify(linkedCommitmentIds),
      effectivenessNote: body.effectivenessNote ?? null,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "improvement_action.created", {
      improvementActionId,
      projectId,
      title: body.title,
    });

    await insertAuditEvent(db, {
      eventType: "improvement_action.created",
      projectId,
      entityType: "improvement_action",
      entityId: improvementActionId,
      payload: {
        title: body.title,
        category,
        ownerId: body.ownerId,
        status,
      },
    });

    return c.json(
      {
        id: improvementActionId,
        tenantId,
        projectId,
        siteId: project.siteId,
        title: body.title,
        problemStatement: body.problemStatement,
        category,
        rootCause: body.rootCause ?? null,
        ownerId: body.ownerId,
        status,
        targetDate: body.targetDate ?? null,
        linkedTaskIds,
        linkedBlockerIds: body.linkedBlockerIds ?? [],
        linkedCommitmentIds,
        effectivenessNote: body.effectivenessNote ?? null,
        createdAt: now,
        updatedAt: now,
      },
      201
    );
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

/**
 * GET /v1/improvements/:improvementActionId
 * Get a single improvement action.
 */
improvementsRouter.get("/:improvementActionId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const improvementActionId = c.req.param("improvementActionId");
  const db = getDemoDb();

  try {
    const [action] = await db
      .select()
      .from(improvementActions)
      .where(eq(improvementActions.id, improvementActionId));

    if (!action) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Improvement action not found",
            details: { improvementActionId },
          },
        },
        404
      );
    }

    return c.json({
      ...action,
      linkedTaskIds: JSON.parse(action.linkedTaskIdsJson),
      linkedBlockerIds: JSON.parse(action.linkedBlockerIdsJson),
      linkedCommitmentIds: JSON.parse(action.linkedCommitmentIdsJson),
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/improvements/:improvementActionId
 * Update an improvement action.
 */
improvementsRouter.patch("/:improvementActionId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const improvementActionId = c.req.param("improvementActionId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(improvementActions)
      .where(eq(improvementActions.id, improvementActionId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Improvement action not found",
            details: { improvementActionId },
          },
        },
        404
      );
    }

    let body: {
      title?: string;
      problemStatement?: string;
      category?: string;
      rootCause?: string;
      status?: string;
      targetDate?: string;
      linkedTaskIds?: string[];
      linkedBlockerIds?: string[];
      linkedCommitmentIds?: string[];
      effectivenessNote?: string;
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

    // Validate category if provided
    if (body.category && !IMPROVEMENT_ACTION_CATEGORIES.includes(body.category as ImprovementActionCategory)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid category value",
            details: { validValues: IMPROVEMENT_ACTION_CATEGORIES, received: body.category },
          },
        },
        400
      );
    }

    // Validate status transition if status is being changed
    if (body.status && body.status !== existing.status) {
      const currentStatus = existing.status as ImprovementActionStatus;
      const newStatus = body.status as ImprovementActionStatus;

      if (!IMPROVEMENT_ACTION_STATUSES.includes(newStatus)) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid status value",
              details: { validValues: IMPROVEMENT_ACTION_STATUSES, received: body.status },
            },
          },
          400
        );
      }

      const allowedTransitions = IMPROVEMENT_ACTION_TRANSITIONS[currentStatus];
      if (!allowedTransitions.includes(newStatus)) {
        return c.json(
          {
            error: {
              code: "IMPROVEMENT_ACTION_INVALID_STATE_TRANSITION",
              message: `Cannot transition from ${currentStatus} to ${newStatus}`,
              details: {
                currentStatus,
                newStatus,
                allowedTransitions,
              },
            },
          },
          409
        );
      }
    }

    // Validate linked tasks belong to same project if provided
    const linkedTaskIds = body.linkedTaskIds;
    if (linkedTaskIds) {
      for (const taskId of linkedTaskIds) {
        const [task] = await db
          .select({ id: tasks.id, projectId: tasks.projectId })
          .from(tasks)
          .where(eq(tasks.id, taskId));

        if (!task) {
          return c.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Linked task not found",
                details: { taskId },
              },
            },
            400
          );
        }

        if (task.projectId !== existing.projectId) {
          return c.json(
            {
              error: {
                code: "PROJECT_SCOPE_MISMATCH",
                message: "Linked task does not belong to this project",
                details: { taskId, projectId: existing.projectId },
              },
            },
            400
          );
        }
      }
    }

    // Validate linked commitments belong to same project if provided
    const linkedCommitmentIds = body.linkedCommitmentIds;
    if (linkedCommitmentIds) {
      for (const commitmentId of linkedCommitmentIds) {
        const [commitment] = await db
          .select({ id: commitments.id, projectId: commitments.projectId })
          .from(commitments)
          .where(eq(commitments.id, commitmentId));

        if (!commitment) {
          return c.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Linked commitment not found",
                details: { commitmentId },
              },
            },
            400
          );
        }

        if (commitment.projectId !== existing.projectId) {
          return c.json(
            {
              error: {
                code: "PROJECT_SCOPE_MISMATCH",
                message: "Linked commitment does not belong to this project",
                details: { commitmentId, projectId: existing.projectId },
              },
            },
            400
          );
        }
      }
    }

    const now = new Date().toISOString();
    const previousStatus = existing.status;
    const newStatus = body.status ?? existing.status;

    await db
      .update(improvementActions)
      .set({
        title: body.title ?? existing.title,
        problemStatement: body.problemStatement ?? existing.problemStatement,
        category: body.category ?? existing.category,
        rootCause: body.rootCause !== undefined ? body.rootCause : existing.rootCause,
        status: newStatus,
        targetDate: body.targetDate !== undefined ? body.targetDate : existing.targetDate,
        linkedTaskIdsJson: linkedTaskIds
          ? JSON.stringify(linkedTaskIds)
          : existing.linkedTaskIdsJson,
        linkedBlockerIdsJson: body.linkedBlockerIds
          ? JSON.stringify(body.linkedBlockerIds)
          : existing.linkedBlockerIdsJson,
        linkedCommitmentIdsJson: linkedCommitmentIds
          ? JSON.stringify(linkedCommitmentIds)
          : existing.linkedCommitmentIdsJson,
        effectivenessNote:
          body.effectivenessNote !== undefined
            ? body.effectivenessNote
            : existing.effectivenessNote,
        updatedAt: now,
      })
      .where(eq(improvementActions.id, improvementActionId));

    opsLog("info", "improvement_action.updated", {
      improvementActionId,
      projectId: existing.projectId,
    });

    if (body.status && body.status !== previousStatus) {
      await insertAuditEvent(db, {
        eventType: "improvement_action.status_changed",
        projectId: existing.projectId,
        entityType: "improvement_action",
        entityId: improvementActionId,
        payload: {
          previousStatus,
          status: body.status,
        },
      });
    }

    return c.json({
      id: improvementActionId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      siteId: existing.siteId,
      title: body.title ?? existing.title,
      problemStatement: body.problemStatement ?? existing.problemStatement,
      category: body.category ?? existing.category,
      rootCause: body.rootCause !== undefined ? body.rootCause : existing.rootCause,
      ownerId: existing.ownerId,
      status: newStatus,
      targetDate: body.targetDate !== undefined ? body.targetDate : existing.targetDate,
      linkedTaskIds: linkedTaskIds ?? JSON.parse(existing.linkedTaskIdsJson),
      linkedBlockerIds: body.linkedBlockerIds ?? JSON.parse(existing.linkedBlockerIdsJson),
      linkedCommitmentIds: linkedCommitmentIds ?? JSON.parse(existing.linkedCommitmentIdsJson),
      effectivenessNote:
        body.effectivenessNote !== undefined
          ? body.effectivenessNote
          : existing.effectivenessNote,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    if (isValidationError(e)) {
      return validationErrorResponse(c, e, 409);
    }
    throw e;
  }
});

export { improvementsRouter };
