/**
 * Work Cycles Routes
 *
 * Routes for work cycles management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  workCycles,
  projects,
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
// Constants and Types
// ============================================================================

const WORK_CYCLE_STATUSES = ["planned", "active", "closed"] as const;
type WorkCycleStatus = (typeof WORK_CYCLE_STATUSES)[number];

// ============================================================================
// Router Setup
// ============================================================================

/** All routes under `/v1/cycles` (list/create use `projectId` query or JSON body). */
const cyclesRouter = new Hono();

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
// Work Cycles Routes
// ============================================================================

/**
 * POST /v1/cycles
 * Create a work cycle. `projectId` is required in the JSON body.
 */
cyclesRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  let body: {
    projectId: string;
    name: string;
    startDate: string;
    endDate: string;
    status?: string;
    goal?: string;
  };

  try {
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
    const requiredFields = ["projectId", "name", "startDate", "endDate"] as const;
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

    // Verify project exists
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

    // Validate status
    const status = (body.status ?? "planned") as WorkCycleStatus;
    if (!WORK_CYCLE_STATUSES.includes(status)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: WORK_CYCLE_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    // Validate dates
    if (body.endDate < body.startDate) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "endDate must be >= startDate",
            details: { startDate: body.startDate, endDate: body.endDate },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const workCycleId = randomUUID();
    const tenantId = "demo-tenant"; // Demo tenant for pilot

    await db.insert(workCycles).values({
      id: workCycleId,
      tenantId,
      projectId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      status,
      goal: body.goal ?? null,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "work_cycle.created", {
      workCycleId,
      projectId,
      name: body.name,
    });

    await insertAuditEvent(db, {
      eventType: "work_cycle.created",
      projectId,
      entityType: "work_cycle",
      entityId: workCycleId,
      payload: {
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        status,
        goal: body.goal ?? null,
      },
    });

    return c.json(
      {
        id: workCycleId,
        tenantId,
        projectId,
        name: body.name,
        startDate: body.startDate,
        endDate: body.endDate,
        status,
        goal: body.goal ?? null,
        createdAt: now,
        updatedAt: now,
      },
      201
    );
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * GET /v1/cycles?projectId=…
 * List work cycles for a project (`projectId` query required).
 */
cyclesRouter.get("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.query("projectId");
  const statusFilter = c.req.query("status");
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

    // Validate status filter if provided
    if (statusFilter && !WORK_CYCLE_STATUSES.includes(statusFilter as WorkCycleStatus)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status filter",
            details: { validValues: WORK_CYCLE_STATUSES, received: statusFilter },
          },
        },
        400
      );
    }

    // Build query
    const conditions = [eq(workCycles.projectId, projectId)];
    if (statusFilter) {
      conditions.push(eq(workCycles.status, statusFilter));
    }

    const results = await db
      .select()
      .from(workCycles)
      .where(and(...conditions));

    return c.json({
      data: results,
      total: results.length,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * GET /v1/cycles/:workCycleId
 * Get a single work cycle by ID.
 */
cyclesRouter.get("/:workCycleId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const workCycleId = c.req.param("workCycleId");
  const db = getDemoDb();

  try {
    const [workCycle] = await db
      .select()
      .from(workCycles)
      .where(eq(workCycles.id, workCycleId));

    if (!workCycle) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Work cycle not found",
            details: { workCycleId },
          },
        },
        404
      );
    }

    return c.json(workCycle);
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/cycles/:workCycleId
 * Update a work cycle.
 */
cyclesRouter.patch("/:workCycleId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const workCycleId = c.req.param("workCycleId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(workCycles)
      .where(eq(workCycles.id, workCycleId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Work cycle not found",
            details: { workCycleId },
          },
        },
        404
      );
    }

    let body: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      goal?: string;
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
    if (body.status && !WORK_CYCLE_STATUSES.includes(body.status as WorkCycleStatus)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: WORK_CYCLE_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    // Validate dates
    const startDate = body.startDate ?? existing.startDate;
    const endDate = body.endDate ?? existing.endDate;
    if (endDate < startDate) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "endDate must be >= startDate",
            details: { startDate, endDate },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const previousStatus = existing.status;
    const newStatus = body.status ?? existing.status;

    await db
      .update(workCycles)
      .set({
        name: body.name ?? existing.name,
        startDate,
        endDate,
        status: newStatus,
        goal: body.goal !== undefined ? body.goal : existing.goal,
        updatedAt: now,
      })
      .where(eq(workCycles.id, workCycleId));

    opsLog("info", "work_cycle.updated", {
      workCycleId,
      projectId: existing.projectId,
    });

    if (body.status && body.status !== previousStatus) {
      await insertAuditEvent(db, {
        eventType: "work_cycle.status_changed",
        projectId: existing.projectId,
        entityType: "work_cycle",
        entityId: workCycleId,
        payload: {
          previousStatus,
          status: body.status,
        },
      });
    }

    return c.json({
      id: workCycleId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      name: body.name ?? existing.name,
      startDate,
      endDate,
      status: newStatus,
      goal: body.goal !== undefined ? body.goal : existing.goal,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { cyclesRouter };
