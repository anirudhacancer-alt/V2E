/**
 * Standups Routes
 *
 * Routes for standup session management.
 */

import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  standupSessions,
  projects,
  teamMembers,
  attendanceSessions,
  attendances,
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

const STANDUP_SESSION_STATUSES = ["draft", "active", "closed"] as const;
type StandupSessionStatus = (typeof STANDUP_SESSION_STATUSES)[number];

const SCOPE_LEVELS = ["team", "department", "site", "plant", "region"] as const;
type ScopeLevel = (typeof SCOPE_LEVELS)[number];

// Valid standup session status transitions
const STANDUP_TRANSITIONS: Record<StandupSessionStatus, StandupSessionStatus[]> = {
  draft: ["active"],
  active: ["closed"],
  closed: [], // Terminal
};

// ============================================================================
// Router Setup
// ============================================================================

/** All routes under `/v1/standups` (list/create use `projectId` query or JSON body). */
const standupsRouter = new Hono();

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
// Standup Sessions Routes
// ============================================================================

/**
 * GET /v1/standups?projectId=…
 * List standup sessions for a project (`projectId` query required).
 */
standupsRouter.get("/", async (c) => {
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

    // Query params
    const status = c.req.query("status");
    const sessionDate = c.req.query("sessionDate");

    // Build conditions
    const conditions = [eq(standupSessions.projectId, projectId)];
    if (status) {
      conditions.push(eq(standupSessions.status, status));
    }
    if (sessionDate) {
      conditions.push(eq(standupSessions.sessionDate, sessionDate));
    }

    const sessions = await db
      .select()
      .from(standupSessions)
      .where(and(...conditions))
      .orderBy(desc(standupSessions.sessionDate), desc(standupSessions.createdAt));

    return c.json({
      items: sessions,
      total: sessions.length,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * POST /v1/standups
 * Create a standup session. `projectId` is required in the JSON body.
 */
standupsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      projectId: string;
      scopeLevel: string;
      scopeRef?: string;
      sessionDate: string;
      ownerId: string;
      status?: string;
      summaryText?: string;
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
    const requiredFields = ["projectId", "scopeLevel", "sessionDate", "ownerId"] as const;
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

    // Validate scopeLevel
    if (!SCOPE_LEVELS.includes(body.scopeLevel as ScopeLevel)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid scopeLevel value",
            details: { validValues: SCOPE_LEVELS, received: body.scopeLevel },
          },
        },
        400
      );
    }

    // Validate status
    const status = (body.status ?? "draft") as StandupSessionStatus;
    if (!STANDUP_SESSION_STATUSES.includes(status)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: STANDUP_SESSION_STATUSES, received: body.status },
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

    // Validate sessionDate format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.sessionDate)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "sessionDate must be in YYYY-MM-DD format",
            details: { received: body.sessionDate },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const standupSessionId = randomUUID();
    const tenantId = "demo-tenant";

    await db.insert(standupSessions).values({
      id: standupSessionId,
      tenantId,
      projectId,
      scopeLevel: body.scopeLevel,
      scopeRef: body.scopeRef ?? null,
      sessionDate: body.sessionDate,
      ownerId: body.ownerId,
      status,
      summaryText: body.summaryText ?? null,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "standup_session.created", {
      standupSessionId,
      projectId,
      sessionDate: body.sessionDate,
    });

    await insertAuditEvent(db, {
      eventType: "standup_session.created",
      projectId,
      entityType: "standup_session",
      entityId: standupSessionId,
      payload: {
        scopeLevel: body.scopeLevel,
        scopeRef: body.scopeRef ?? null,
        sessionDate: body.sessionDate,
        ownerId: body.ownerId,
        status,
      },
    });

    return c.json(
      {
        id: standupSessionId,
        tenantId,
        projectId,
        scopeLevel: body.scopeLevel,
        scopeRef: body.scopeRef ?? null,
        sessionDate: body.sessionDate,
        ownerId: body.ownerId,
        status,
        summaryText: body.summaryText ?? null,
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
 * GET /v1/standups/:standupId
 * Get a single standup session.
 */
standupsRouter.get("/:standupId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const standupId = c.req.param("standupId")!;
  const db = getDemoDb();

  try {
    const [session] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!session) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    return c.json(session);
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/standups/:standupId
 * Update a standup session.
 */
standupsRouter.patch("/:standupId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const standupId = c.req.param("standupId")!;
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    let body: {
      scopeLevel?: string;
      scopeRef?: string;
      sessionDate?: string;
      ownerId?: string;
      status?: string;
      summaryText?: string;
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

    // Validate scopeLevel if provided
    if (body.scopeLevel && !SCOPE_LEVELS.includes(body.scopeLevel as ScopeLevel)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid scopeLevel value",
            details: { validValues: SCOPE_LEVELS, received: body.scopeLevel },
          },
        },
        400
      );
    }

    // Validate status if provided
    if (body.status && !STANDUP_SESSION_STATUSES.includes(body.status as StandupSessionStatus)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: STANDUP_SESSION_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    // Validate sessionDate format if provided
    if (body.sessionDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.sessionDate)) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "sessionDate must be in YYYY-MM-DD format",
              details: { received: body.sessionDate },
            },
          },
          400
        );
      }
    }

    // Validate owner if provided
    if (body.ownerId) {
      const [project] = await db
        .select({ siteId: projects.siteId })
        .from(projects)
        .where(eq(projects.id, existing.projectId));

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

      if (project && owner.siteId !== project.siteId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "Owner does not belong to project site",
              details: { ownerId: body.ownerId, projectId: existing.projectId },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();
    const previousStatus = existing.status;
    const newStatus = body.status ?? existing.status;

    await db
      .update(standupSessions)
      .set({
        scopeLevel: body.scopeLevel ?? existing.scopeLevel,
        scopeRef: body.scopeRef !== undefined ? body.scopeRef : existing.scopeRef,
        sessionDate: body.sessionDate ?? existing.sessionDate,
        ownerId: body.ownerId ?? existing.ownerId,
        status: newStatus,
        summaryText: body.summaryText !== undefined ? body.summaryText : existing.summaryText,
        updatedAt: now,
      })
      .where(eq(standupSessions.id, standupId));

    opsLog("info", "standup_session.updated", {
      standupId,
      projectId: existing.projectId,
    });

    if (body.status && body.status !== previousStatus) {
      await insertAuditEvent(db, {
        eventType: "standup_session.status_changed",
        projectId: existing.projectId,
        entityType: "standup_session",
        entityId: standupId,
        payload: {
          previousStatus,
          status: body.status,
        },
      });
    }

    return c.json({
      id: standupId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      scopeLevel: body.scopeLevel ?? existing.scopeLevel,
      scopeRef: body.scopeRef !== undefined ? body.scopeRef : existing.scopeRef,
      sessionDate: body.sessionDate ?? existing.sessionDate,
      ownerId: body.ownerId ?? existing.ownerId,
      status: newStatus,
      summaryText: body.summaryText !== undefined ? body.summaryText : existing.summaryText,
      createdAt: existing.createdAt,
      updatedAt: now,
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

/**
 * POST /v1/standups/:standupId/open
 * Open (activate) a standup session.
 * Body: { projectId }
 */
standupsRouter.post("/:standupId/open", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: { projectId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "INVALID_JSON", message: "JSON body required" } }, 400);
  }

  const standupId = c.req.param("standupId");

  const projectId = body.projectId;
  if (!projectId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "projectId is required in body" } }, 400);
  }

  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    if (existing.projectId !== projectId) {
      return c.json({ error: { code: "PROJECT_MISMATCH", message: "Standup does not belong to the specified project" } }, 400);
    }

    const currentStatus = existing.status as StandupSessionStatus;
    const allowedTransitions = STANDUP_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes("active")) {
      return c.json(
        {
          error: {
            code: "STANDUP_INVALID_STATE_TRANSITION",
            message: `Cannot open standup from ${currentStatus} status`,
            details: {
              currentStatus,
              targetStatus: "active",
              allowedTransitions,
            },
          },
        },
        409
      );
    }

    const now = new Date().toISOString();

    await db
      .update(standupSessions)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(standupSessions.id, standupId));

    opsLog("info", "standup_session.opened", {
      standupId,
      projectId: existing.projectId,
    });

    await insertAuditEvent(db, {
      eventType: "standup_session.opened",
      projectId: existing.projectId,
      entityType: "standup_session",
      entityId: standupId,
      payload: {
        previousStatus: currentStatus,
        status: "active",
      },
    });

    return c.json({
      id: standupId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      scopeLevel: existing.scopeLevel,
      scopeRef: existing.scopeRef,
      sessionDate: existing.sessionDate,
      ownerId: existing.ownerId,
      status: "active",
      summaryText: existing.summaryText,
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

/**
 * POST /v1/standups/:standupId/close
 * Close a standup session.
 * Body: { projectId }
 */
standupsRouter.post("/:standupId/close", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: { projectId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "INVALID_JSON", message: "JSON body required" } }, 400);
  }

  const standupId = c.req.param("standupId");

  const projectId = body.projectId;
  if (!projectId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "projectId is required in body" } }, 400);
  }

  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    if (existing.projectId !== projectId) {
      return c.json({ error: { code: "PROJECT_MISMATCH", message: "Standup does not belong to the specified project" } }, 400);
    }

    const currentStatus = existing.status as StandupSessionStatus;
    const allowedTransitions = STANDUP_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes("closed")) {
      return c.json(
        {
          error: {
            code: "STANDUP_INVALID_STATE_TRANSITION",
            message: `Cannot close standup from ${currentStatus} status`,
            details: {
              currentStatus,
              targetStatus: "closed",
              allowedTransitions,
            },
          },
        },
        409
      );
    }

    const now = new Date().toISOString();

    await db
      .update(standupSessions)
      .set({
        status: "closed",
        updatedAt: now,
      })
      .where(eq(standupSessions.id, standupId));

    opsLog("info", "standup_session.closed", {
      standupId,
      projectId: existing.projectId,
    });

    await insertAuditEvent(db, {
      eventType: "standup_session.closed",
      projectId: existing.projectId,
      entityType: "standup_session",
      entityId: standupId,
      payload: {
        previousStatus: currentStatus,
        status: "closed",
      },
    });

    return c.json({
      id: standupId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      scopeLevel: existing.scopeLevel,
      scopeRef: existing.scopeRef,
      sessionDate: existing.sessionDate,
      ownerId: existing.ownerId,
      status: "closed",
      summaryText: existing.summaryText,
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

/**
 * GET /v1/standups/:standupId/attendance
 * List attendance rows associated with the standup session date/project.
 */
standupsRouter.get("/:standupId/attendance", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const standupId = c.req.param("standupId");
  const db = getDemoDb();

  try {
    const [standup] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!standup) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    const sessions = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.projectId, standup.projectId),
          eq(attendanceSessions.sessionDate, standup.sessionDate)
        )
      );

    const items = [];
    for (const session of sessions) {
      const rows = await db
        .select()
        .from(attendances)
        .where(eq(attendances.sessionId, session.id));
      items.push(...rows);
    }

    return c.json({ items, total: items.length });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * POST /v1/standups/:standupId/attendance
 * Create an attendance row for the standup session date/project.
 * Body: { projectId, teamMemberId, status, notes? }
 */
standupsRouter.post("/:standupId/attendance", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const standupId = c.req.param("standupId");
  const db = getDemoDb();

  let body: {
    projectId?: string;
    teamMemberId?: string;
    status?: string;
    notes?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "INVALID_JSON", message: "JSON body required" } }, 400);
  }

  if (!body.projectId || !body.teamMemberId || !body.status) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId, teamMemberId, and status are required in body",
        },
      },
      400
    );
  }

  try {
    const [standup] = await db
      .select()
      .from(standupSessions)
      .where(eq(standupSessions.id, standupId));

    if (!standup) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Standup session not found",
            details: { standupId },
          },
        },
        404
      );
    }

    if (standup.projectId !== body.projectId) {
      return c.json(
        {
          error: {
            code: "PROJECT_MISMATCH",
            message: "Standup does not belong to the specified project",
            details: { standupId, projectId: body.projectId },
          },
        },
        400
      );
    }

    const [project] = await db
      .select({ siteId: projects.siteId })
      .from(projects)
      .where(eq(projects.id, standup.projectId));

    const [member] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.id, body.teamMemberId));

    if (!project || !member) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid projectId or teamMemberId",
          },
        },
        400
      );
    }

    const [existingSession] = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.projectId, standup.projectId),
          eq(attendanceSessions.sessionDate, standup.sessionDate)
        )
      );

    const attendanceSessionId = existingSession?.id ?? randomUUID();
    const now = new Date().toISOString();

    if (!existingSession) {
      await db.insert(attendanceSessions).values({
        id: attendanceSessionId,
        siteId: project.siteId,
        projectId: standup.projectId,
        sessionDate: standup.sessionDate,
        conductedBy: standup.ownerId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const attendanceId = randomUUID();
    await db.insert(attendances).values({
      id: attendanceId,
      sessionId: attendanceSessionId,
      teamMemberId: body.teamMemberId,
      status: body.status,
      notes: body.notes ?? null,
      recordedAt: now,
    });

    return c.json(
      {
        id: attendanceId,
        sessionId: attendanceSessionId,
        teamMemberId: body.teamMemberId,
        status: body.status,
        notes: body.notes ?? null,
        recordedAt: now,
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

export { standupsRouter };
