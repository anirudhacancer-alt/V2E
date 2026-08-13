/**
 * Commitments Routes
 *
 * Routes for commitments management.
 */

import { and, count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  workCycles,
  commitments,
  projects,
  tasks,
  teamMembers,
  roleTypes,
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
import {
  resolvePersonNamesByIds,
  resolveRoleTypeLabelsByCodes,
} from "../lib/resolve-person.js";

// ============================================================================
// Constants and Types
// ============================================================================

const COMMITMENT_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "at_risk",
  "missed",
  "carried_over",
] as const;
type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];

// Valid commitment status transitions
const COMMITMENT_TRANSITIONS: Record<CommitmentStatus, CommitmentStatus[]> = {
  planned: ["in_progress", "at_risk", "carried_over"],
  in_progress: ["completed", "at_risk", "missed"],
  at_risk: ["in_progress", "completed", "missed", "carried_over"],
  completed: [], // Terminal
  missed: ["carried_over"], // Can only carry over
  carried_over: [], // Terminal (new commitment created)
};

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Router Setup
// ============================================================================

/** All routes under `/v1/commitments` (POST create includes `projectId` in JSON body). */
const commitmentsRouter = new Hono();

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
// Commitments Routes
// ============================================================================

/**
 * POST /v1/commitments
 * Create a commitment. `projectId` is required in the JSON body.
 */
commitmentsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  let body: {
    projectId: string;
    title: string;
    description?: string;
    ownerId: string;
    assigneeRoleCode: string;
    commitDate: string;
    targetDate: string;
    status?: string;
    workCycleId?: string;
    standupSessionId?: string;
    sourceTaskId?: string;
    riskReason?: string;
    carriedOverFromCommitmentId?: string;
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
    const requiredFields = [
      "projectId",
      "title",
      "ownerId",
      "assigneeRoleCode",
      "commitDate",
      "targetDate",
    ] as const;
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
    const status = (body.status ?? "planned") as CommitmentStatus;
    if (!COMMITMENT_STATUSES.includes(status)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status value",
            details: { validValues: COMMITMENT_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    // Validate targetDate >= commitDate
    if (body.targetDate < body.commitDate) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "targetDate must be >= commitDate",
            details: { commitDate: body.commitDate, targetDate: body.targetDate },
          },
        },
        400
      );
    }

    // Validate owner exists and belongs to site
    const [owner] = await db
      .select({
        id: teamMembers.id,
        siteId: teamMembers.siteId,
        orgRoleCode: teamMembers.orgRoleCode,
        userId: teamMembers.userId,
      })
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

    // Validate role code
    const [roleRow] = await db
      .select({ code: roleTypes.code })
      .from(roleTypes)
      .where(eq(roleTypes.code, body.assigneeRoleCode));

    if (!roleRow) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "assigneeRoleCode not found in role_types",
            details: { assigneeRoleCode: body.assigneeRoleCode },
          },
        },
        400
      );
    }

    // Validate sourceTaskId if provided
    if (body.sourceTaskId) {
      const [sourceTask] = await db
        .select({ id: tasks.id, projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, body.sourceTaskId));

      if (!sourceTask) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "sourceTaskId not found",
              details: { sourceTaskId: body.sourceTaskId },
            },
          },
          400
        );
      }

      if (sourceTask.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "sourceTaskId does not belong to this project",
              details: { sourceTaskId: body.sourceTaskId, projectId },
            },
          },
          400
        );
      }
    }

    // Validate workCycleId if provided
    if (body.workCycleId) {
      const [workCycle] = await db
        .select({ id: workCycles.id, projectId: workCycles.projectId })
        .from(workCycles)
        .where(eq(workCycles.id, body.workCycleId));

      if (!workCycle) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "workCycleId not found",
              details: { workCycleId: body.workCycleId },
            },
          },
          400
        );
      }

      if (workCycle.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "workCycleId does not belong to this project",
              details: { workCycleId: body.workCycleId, projectId },
            },
          },
          400
        );
      }
    }

    // Validate carriedOverFromCommitmentId if provided
    if (body.carriedOverFromCommitmentId) {
      const [priorCommitment] = await db
        .select({ id: commitments.id, projectId: commitments.projectId })
        .from(commitments)
        .where(eq(commitments.id, body.carriedOverFromCommitmentId));

      if (!priorCommitment) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "carriedOverFromCommitmentId not found",
              details: { carriedOverFromCommitmentId: body.carriedOverFromCommitmentId },
            },
          },
          400
        );
      }

      if (priorCommitment.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "carriedOverFromCommitmentId does not belong to this project",
              details: { carriedOverFromCommitmentId: body.carriedOverFromCommitmentId, projectId },
            },
          },
          400
        );
      }

      // carried_over status requires prior linkage
      if (status === "carried_over" && !body.carriedOverFromCommitmentId) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "carried_over status requires carriedOverFromCommitmentId",
              details: { status },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();
    const commitmentId = randomUUID();
    const tenantId = "demo-tenant";

    await db.insert(commitments).values({
      id: commitmentId,
      tenantId,
      projectId,
      siteId: project.siteId,
      workCycleId: body.workCycleId ?? null,
      standupSessionId: body.standupSessionId ?? null,
      sourceTaskId: body.sourceTaskId ?? null,
      title: body.title,
      description: body.description ?? null,
      ownerId: body.ownerId,
      assigneeRoleCode: body.assigneeRoleCode,
      status,
      commitDate: body.commitDate,
      targetDate: body.targetDate,
      completedAt: status === "completed" ? now : null,
      carriedOverFromCommitmentId: body.carriedOverFromCommitmentId ?? null,
      riskReason: body.riskReason ?? null,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "commitment.created", {
      commitmentId,
      projectId,
      title: body.title,
    });

    await insertAuditEvent(db, {
      eventType: "commitment.created",
      projectId,
      siteId: project.siteId,
      entityType: "commitment",
      entityId: commitmentId,
      payload: {
        title: body.title,
        ownerId: body.ownerId,
        notifyUserId: owner.userId ?? null,
        status,
        commitDate: body.commitDate,
        targetDate: body.targetDate,
        sourceTaskId: body.sourceTaskId ?? null,
        workCycleId: body.workCycleId ?? null,
      },
    });

    return c.json(
      {
        id: commitmentId,
        tenantId,
        projectId,
        siteId: project.siteId,
        workCycleId: body.workCycleId ?? null,
        standupSessionId: body.standupSessionId ?? null,
        sourceTaskId: body.sourceTaskId ?? null,
        title: body.title,
        description: body.description ?? null,
        ownerId: body.ownerId,
        assigneeRoleCode: body.assigneeRoleCode,
        status,
        commitDate: body.commitDate,
        targetDate: body.targetDate,
        completedAt: status === "completed" ? now : null,
        carriedOverFromCommitmentId: body.carriedOverFromCommitmentId ?? null,
        riskReason: body.riskReason ?? null,
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
 * GET /v1/commitments/horizon?projectId=
 * Phase A read model: task-derived commitments grouped by horizon (was nested under `/projects/:id/commitments`).
 */
commitmentsRouter.get("/horizon", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.query("projectId");
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

  const statusFilter = c.req.query("status");
  const ownerIdFilter = c.req.query("ownerId");
  const horizonFilter = c.req.query("horizon");

  const db = getDemoDb();

  try {
    const [project] = await db
      .select({ id: projects.id, name: projects.name, siteId: projects.siteId })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    const todayYmd = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(todayYmd);
    const weekFromNow = new Date(todayDate.getTime() + 7 * 86400000);
    const weekFromNowYmd = weekFromNow.toISOString().slice(0, 10);

    const taskRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        ownerId: tasks.ownerId,
        assigneeRoleCode: tasks.assigneeRoleCode,
        dueDate: tasks.dueDate,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const ownerIds = [...new Set(taskRows.map((t) => t.ownerId))];
    const ownerNameById = await resolvePersonNamesByIds(db, ownerIds);
    const roleCodes = [...new Set(taskRows.map((t) => t.assigneeRoleCode))];
    const roleLabelByCode = await resolveRoleTypeLabelsByCodes(db, roleCodes);

    type CommitmentItem = {
      id: string;
      projectId: string;
      title: string;
      status: "planned" | "in_progress" | "completed" | "at_risk" | "missed" | "carried_over";
      ownerName: string;
      ownerId: string;
      assigneeRoleCode: string;
      assigneeRoleName: string;
      commitDate: string;
      targetDate: string;
      completedAt: string | null;
      horizon: "today" | "this_week" | "look_ahead" | "past";
      isOverdue: boolean;
      statusSummary: string;
      linkedTaskTitle: string | null;
      linkedTaskId: string;
      linkedTaskStatus: string;
      riskReason: string | null;
      isCarriedOver: boolean;
    };

    const commitmentItems: CommitmentItem[] = taskRows.map((t) => {
      const dueDate = t.dueDate;
      const isOverdue = dueDate < todayYmd && t.status !== "Done";
      const isCompleted = t.status === "Done";

      let horizon: CommitmentItem["horizon"];
      if (dueDate < todayYmd) {
        horizon = "past";
      } else if (dueDate === todayYmd) {
        horizon = "today";
      } else if (dueDate <= weekFromNowYmd) {
        horizon = "this_week";
      } else {
        horizon = "look_ahead";
      }

      let status: CommitmentItem["status"];
      if (isCompleted) {
        status = "completed";
      } else if (isOverdue) {
        status = "missed";
      } else if (t.status === "Blocked") {
        status = "at_risk";
      } else if (t.status === "In-progress") {
        status = "in_progress";
      } else {
        status = "planned";
      }

      let statusSummary: string;
      if (isCompleted) {
        statusSummary = "Completed";
      } else if (isOverdue) {
        statusSummary = "Missed";
      } else if (dueDate === todayYmd) {
        statusSummary = "Due today";
      } else {
        const d = new Date(dueDate);
        const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        const day = d.getUTCDate();
        statusSummary = `Due ${month} ${day}`;
      }

      return {
        id: t.id,
        projectId,
        title: t.title,
        status,
        ownerName: ownerNameById.get(t.ownerId) ?? "Unknown",
        ownerId: t.ownerId,
        assigneeRoleCode: t.assigneeRoleCode,
        assigneeRoleName: roleLabelByCode.get(t.assigneeRoleCode) ?? t.assigneeRoleCode,
        commitDate: t.createdAt.slice(0, 10),
        targetDate: dueDate,
        completedAt: t.completedAt ?? null,
        horizon,
        isOverdue,
        statusSummary,
        linkedTaskTitle: t.title,
        linkedTaskId: t.id,
        linkedTaskStatus: t.status,
        riskReason: t.status === "Blocked" ? "Task is blocked" : null,
        isCarriedOver: false,
      };
    });

    let filtered = commitmentItems;
    if (statusFilter) {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }
    if (ownerIdFilter) {
      filtered = filtered.filter((item) => item.ownerId === ownerIdFilter);
    }
    if (horizonFilter) {
      filtered = filtered.filter((item) => item.horizon === horizonFilter);
    }

    const groups = [
      { horizon: "today" as const, label: "Today", items: filtered.filter((item) => item.horizon === "today") },
      { horizon: "this_week" as const, label: "This Week", items: filtered.filter((item) => item.horizon === "this_week") },
      { horizon: "look_ahead" as const, label: "Look Ahead", items: filtered.filter((item) => item.horizon === "look_ahead") },
      { horizon: "past" as const, label: "Past", items: filtered.filter((item) => item.horizon === "past") },
    ].map((g) => ({ ...g, count: g.items.length }));

    const stats = {
      planned: filtered.filter((item) => item.status === "planned").length,
      inProgress: filtered.filter((item) => item.status === "in_progress").length,
      completed: filtered.filter((item) => item.status === "completed").length,
      atRisk: filtered.filter((item) => item.status === "at_risk").length,
      missed: filtered.filter((item) => item.status === "missed").length,
      carriedOver: filtered.filter((item) => item.status === "carried_over").length,
    };

    return c.json({
      projectId,
      projectName: project.name,
      groups,
      totalCount: filtered.length,
      stats,
      filters: {
        status: statusFilter || undefined,
        ownerId: ownerIdFilter || undefined,
        horizon: horizonFilter || undefined,
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
 * GET /v1/commitments/:commitmentId
 * Get a single commitment by ID.
 */
commitmentsRouter.get("/:commitmentId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const commitmentId = c.req.param("commitmentId");
  const db = getDemoDb();

  try {
    const [commitment] = await db
      .select()
      .from(commitments)
      .where(eq(commitments.id, commitmentId));

    if (!commitment) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Commitment not found",
            details: { commitmentId },
          },
        },
        404
      );
    }

    return c.json(commitment);
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/commitments/:commitmentId
 * Update a commitment.
 */
commitmentsRouter.patch("/:commitmentId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const commitmentId = c.req.param("commitmentId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(commitments)
      .where(eq(commitments.id, commitmentId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Commitment not found",
            details: { commitmentId },
          },
        },
        404
      );
    }

    let body: {
      title?: string;
      description?: string;
      status?: string;
      targetDate?: string;
      riskReason?: string;
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

    // Validate status transition if status is being changed
    if (body.status && body.status !== existing.status) {
      const currentStatus = existing.status as CommitmentStatus;
      const newStatus = body.status as CommitmentStatus;

      if (!COMMITMENT_STATUSES.includes(newStatus)) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid status value",
              details: { validValues: COMMITMENT_STATUSES, received: body.status },
            },
          },
          400
        );
      }

      const allowedTransitions = COMMITMENT_TRANSITIONS[currentStatus];
      if (!allowedTransitions.includes(newStatus)) {
        return c.json(
          {
            error: {
              code: "COMMITMENT_INVALID_STATE_TRANSITION",
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

    // Validate targetDate >= commitDate
    const targetDate = body.targetDate ?? existing.targetDate;
    if (targetDate < existing.commitDate) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "targetDate must be >= commitDate",
            details: { commitDate: existing.commitDate, targetDate },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const previousStatus = existing.status;
    const newStatus = body.status ?? existing.status;
    const completedAt =
      newStatus === "completed"
        ? existing.completedAt ?? now
        : newStatus !== "completed" && existing.completedAt
          ? null
          : existing.completedAt;

    await db
      .update(commitments)
      .set({
        title: body.title ?? existing.title,
        description:
          body.description !== undefined ? body.description : existing.description,
        status: newStatus,
        targetDate,
        completedAt,
        riskReason:
          body.riskReason !== undefined ? body.riskReason : existing.riskReason,
        updatedAt: now,
      })
      .where(eq(commitments.id, commitmentId));

    opsLog("info", "commitment.updated", {
      commitmentId,
      projectId: existing.projectId,
    });

    if (body.status && body.status !== previousStatus) {
      await insertAuditEvent(db, {
        eventType: "commitment.status_changed",
        projectId: existing.projectId,
        siteId: existing.siteId,
        entityType: "commitment",
        entityId: commitmentId,
        payload: {
          previousStatus,
          status: body.status,
        },
      });

      if (body.status === "missed") {
        const [owner] = await db
          .select({ userId: teamMembers.userId })
          .from(teamMembers)
          .where(eq(teamMembers.id, existing.ownerId));
        await insertAuditEvent(db, {
          eventType: "commitment.missed",
          projectId: existing.projectId,
          siteId: existing.siteId,
          entityType: "commitment",
          entityId: commitmentId,
          payload: {
            ownerId: existing.ownerId,
            targetDate,
            notifyUserId: owner?.userId ?? null,
          },
        });
      }
    }

    return c.json({
      id: commitmentId,
      tenantId: existing.tenantId,
      projectId: existing.projectId,
      siteId: existing.siteId,
      workCycleId: existing.workCycleId,
      standupSessionId: existing.standupSessionId,
      sourceTaskId: existing.sourceTaskId,
      title: body.title ?? existing.title,
      description:
        body.description !== undefined ? body.description : existing.description,
      ownerId: existing.ownerId,
      assigneeRoleCode: existing.assigneeRoleCode,
      status: newStatus,
      commitDate: existing.commitDate,
      targetDate,
      completedAt,
      carriedOverFromCommitmentId: existing.carriedOverFromCommitmentId,
      riskReason:
        body.riskReason !== undefined ? body.riskReason : existing.riskReason,
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

// ============================================================================
// Flat Commitments Route (§12.15)
// ============================================================================

/**
 * GET /v1/commitments
 * List commitments with optional filters (flat convenience route per §12.15).
 * Filters: projectId, status, ownerId, workCycleId
 */
commitmentsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  // Parse query parameters
  const projectId = c.req.query("projectId");
  const status = c.req.query("status");
  const ownerId = c.req.query("ownerId");
  const workCycleId = c.req.query("workCycleId");

  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(c.req.query("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
  );

  try {
    // Build filter conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (projectId) {
      conditions.push(eq(commitments.projectId, projectId));
    }
    if (status) {
      if (!COMMITMENT_STATUSES.includes(status as CommitmentStatus)) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid status filter",
              details: { validValues: COMMITMENT_STATUSES, received: status },
            },
          },
          400
        );
      }
      conditions.push(eq(commitments.status, status));
    }
    if (ownerId) {
      conditions.push(eq(commitments.ownerId, ownerId));
    }
    if (workCycleId) {
      conditions.push(eq(commitments.workCycleId, workCycleId));
    }

    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalResult] = await db
      .select({ n: count() })
      .from(commitments)
      .where(whereClause);
    const total = totalResult?.n ?? 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const commitmentRows = await db
      .select()
      .from(commitments)
      .where(whereClause)
      .orderBy(desc(commitments.updatedAt))
      .limit(pageSize)
      .offset(offset);

    // Load owner names
    const ownerIds = [...new Set(commitmentRows.map((c) => c.ownerId))];
    const ownerRows = ownerIds.length > 0
      ? await db
          .select({ id: teamMembers.id, name: teamMembers.name })
          .from(teamMembers)
          .where(
            ownerIds.length === 1
              ? eq(teamMembers.id, ownerIds[0])
              : and(...ownerIds.map((id) => eq(teamMembers.id, id)))
          )
      : [];
    // Use a simple loop for owner ID lookup since we may have multiple IDs
    const ownerNameById = new Map<string, string>();
    for (const row of ownerRows) {
      ownerNameById.set(row.id, row.name);
    }

    // Load role type names
    const roleCodes = [...new Set(commitmentRows.map((c) => c.assigneeRoleCode))];
    const roleRows = roleCodes.length > 0
      ? await db
          .select({ code: roleTypes.code, name: roleTypes.name })
          .from(roleTypes)
      : [];
    const roleNameByCode = new Map(roleRows.map((r) => [r.code, r.name]));

    // Build response items
    const items = commitmentRows.map((commitment) => ({
      id: commitment.id,
      tenantId: commitment.tenantId,
      projectId: commitment.projectId,
      siteId: commitment.siteId,
      workCycleId: commitment.workCycleId,
      standupSessionId: commitment.standupSessionId,
      sourceTaskId: commitment.sourceTaskId,
      title: commitment.title,
      description: commitment.description,
      ownerId: commitment.ownerId,
      ownerName: ownerNameById.get(commitment.ownerId) ?? "Unknown",
      assigneeRoleCode: commitment.assigneeRoleCode,
      assigneeRoleName: roleNameByCode.get(commitment.assigneeRoleCode) ?? commitment.assigneeRoleCode,
      status: commitment.status,
      commitDate: commitment.commitDate,
      targetDate: commitment.targetDate,
      completedAt: commitment.completedAt,
      carriedOverFromCommitmentId: commitment.carriedOverFromCommitmentId,
      riskReason: commitment.riskReason,
      createdAt: commitment.createdAt,
      updatedAt: commitment.updatedAt,
    }));

    return c.json({
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { commitmentsRouter };
