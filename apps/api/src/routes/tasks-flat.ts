/**
 * Tasks Flat Routes - Phase F
 *
 * Flat (non-project-scoped) routes for task management.
 * Aligns with NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md §12.12
 *
 * These routes provide flat access to tasks across projects.
 * Project-scope integrity is enforced on writes.
 */

import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  tasks,
  updates,
  projects,
  teamMembers,
  updateAttachments,
  taskAttachments,
  locations,
  departments,
  roleTypes,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import {
  resolvePersonName,
  resolvePersonNameAndRole,
  resolveRoleTypeLabelsByCodes,
} from "../lib/resolve-person.js";
import {
  deriveSupervisorTaskState,
  isCurrentUiTaskState,
} from "../lib/task-state.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

const tasksFlatRouter = new Hono();

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/** Allowed `tasks.status` values on PATCH (supervisor workflow). */
const TASK_STATUSES = ["Active", "Blocked", "Done"] as const;

/** Field / supervisor list tabs send these; they map via `deriveSupervisorTaskState`, not raw `tasks.status`. */
function isSupervisorUiStatusParam(status: string | undefined): boolean {
  if (!status) return false;
  return (
    status === "In-progress" ||
    status === "Blocked" ||
    status === "Done" ||
    status === "Overdue"
  );
}

function startOfDayUtc(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function taskDueSummary(
  dueDateStr: string,
  createdAtStr: string,
  taskStatus: string,
  todayYmd: string
): { dueSummary: string; openDays: number } {
  const today = startOfDayUtc(`${todayYmd}T12:00:00.000Z`);
  const due = startOfDayUtc(dueDateStr);
  const created = startOfDayUtc(createdAtStr);
  const ms = 86_400_000;
  const diffDue = Math.round((due.getTime() - today.getTime()) / ms);
  const openDays = Math.max(
    0,
    Math.round((today.getTime() - created.getTime()) / ms)
  );

  if (taskStatus === "Done") {
    return { dueSummary: "Closed", openDays };
  }
  if (diffDue < 0) {
    return { dueSummary: `Overdue ${Math.abs(diffDue)}d`, openDays };
  }
  if (diffDue === 0) {
    return { dueSummary: "Due today", openDays };
  }
  if (diffDue === 1) {
    return { dueSummary: "Due tomorrow", openDays };
  }
  if (diffDue <= 7) {
    return { dueSummary: `Due in ${diffDue}d`, openDays };
  }
  const d = new Date(dueDateStr);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return { dueSummary: `Due ${month} ${day}`, openDays };
}

function integrityErrorResponse(c: Context, e: DataIntegrityError) {
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

/**
 * GET /v1/tasks
 *
 * List tasks with optional filters (Phase F - flat route per §12.12).
 * Filters: projectId, siteId, sourceUpdateId, status, kind, reporterTeamMemberId, severity, ownerId, dueBefore, dueAfter, overdueOnly, department
 *
 * `status=In-progress|Blocked|Done|Overdue` matches **supervisor UI state** (`deriveSupervisorTaskState`), not raw `tasks.status` (demo DB uses Active/Blocked/Done).
 */
tasksFlatRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  const projectId = c.req.query("projectId");
  const siteId = c.req.query("siteId");
  const sourceUpdateId = c.req.query("sourceUpdateId");
  const status = c.req.query("status");
  const kind = c.req.query("kind");
  const reporterTeamMemberId = c.req.query("reporterTeamMemberId");
  const severity = c.req.query("severity");
  const ownerId = c.req.query("ownerId");
  const dueBefore = c.req.query("dueBefore");
  const dueAfter = c.req.query("dueAfter");
  const overdueOnly = c.req.query("overdueOnly") === "true";
  const department = c.req.query("department");

  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(c.req.query("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
  );

  try {
    const conditions: SQL[] = [];

    if (projectId) {
      conditions.push(eq(tasks.projectId, projectId));
    }
    if (siteId) {
      conditions.push(eq(tasks.siteId, siteId));
    }
    if (sourceUpdateId) {
      conditions.push(eq(tasks.sourceUpdateId, sourceUpdateId));
    }
    const useSupervisorStatusFilter =
      overdueOnly || isSupervisorUiStatusParam(status);
    if (status && !useSupervisorStatusFilter) {
      conditions.push(eq(tasks.status, status));
    }
    if (kind) {
      conditions.push(eq(tasks.kind, kind));
    }
    if (reporterTeamMemberId) {
      conditions.push(eq(tasks.reporterTeamMemberId, reporterTeamMemberId));
    }
    if (severity) {
      conditions.push(eq(tasks.severity, severity));
    }
    if (ownerId) {
      conditions.push(eq(tasks.ownerId, ownerId));
    }
    if (department) {
      conditions.push(eq(tasks.departmentCode, department));
    }
    if (dueBefore) {
      conditions.push(lte(tasks.dueDate, dueBefore));
    }
    if (dueAfter) {
      conditions.push(gte(tasks.dueDate, dueAfter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allTaskRows = await db.select().from(tasks).where(whereClause);

    const filteredRows = allTaskRows
      .filter((task) => {
        const uiState = deriveSupervisorTaskState(task);
        if (overdueOnly) return uiState === "Overdue";
        if (status === "In-progress") return uiState === "In-progress";
        if (status === "Blocked") return uiState === "Blocked";
        if (status === "Done") return task.status === "Done";
        if (status === "Overdue") return uiState === "Overdue";
        if (!status) {
          return task.status === "Done" || isCurrentUiTaskState(uiState);
        }
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const total = filteredRows.length;
    const offset = (page - 1) * pageSize;
    const taskList = filteredRows.slice(offset, offset + pageSize);

    const assigneeRoleCodes = [
      ...new Set(taskList.map((t) => t.assigneeRoleCode)),
    ];
    const roleLabelByCode = await resolveRoleTypeLabelsByCodes(
      db,
      assigneeRoleCodes
    );

    const taskLocationIds = [...new Set(taskList.map((t) => t.locationId))];
    const projectIdsForLocs = [...new Set(taskList.map((t) => t.projectId))];
    const listLabelByLocationId = new Map<string, string>();
    if (taskLocationIds.length > 0 && projectIdsForLocs.length > 0) {
      const locRows = await db
        .select({ id: locations.id, listLabel: locations.listLabel })
        .from(locations)
        .where(
          and(
            inArray(locations.projectId, projectIdsForLocs),
            inArray(locations.id, taskLocationIds)
          )
        );
      for (const r of locRows) {
        listLabelByLocationId.set(r.id, r.listLabel);
      }
    }

    const today = new Date().toISOString().split("T")[0];

    const items = await Promise.all(
      taskList.map(async (t) => {
        const ownerPerson = await resolvePersonNameAndRole(db, t.ownerId);
        const isOverdue = t.dueDate < today && t.status !== "Done";
        const { dueSummary, openDays } = taskDueSummary(
          t.dueDate,
          t.createdAt,
          t.status,
          today
        );
        const fromMaster = listLabelByLocationId.get(t.locationId);
        if (!fromMaster?.trim()) {
          throw new DataIntegrityError(
            "task.locationId has no non-empty locations.listLabel for this project",
            { taskId: t.id, locationId: t.locationId, projectId: t.projectId }
          );
        }
        const locationList = fromMaster.trim();
        const ownerRoleLabel = roleLabelByCode.get(t.assigneeRoleCode)!;

        return {
          id: t.id,
          title: t.title,
          severity: t.severity,
          departmentCode: t.departmentCode ?? null,
          owner: ownerPerson.name,
          ownerId: t.ownerId,
          assigneeRoleCode: t.assigneeRoleCode,
          assigneeRoleName: ownerRoleLabel,
          location: t.location,
          locationList,
          dueDate: t.dueDate,
          status: t.status,
          isOverdue,
          dueSummary,
          openDays,
          source: t.source,
          sourceUpdateId: t.sourceUpdateId,
          updatedAt: t.updatedAt,
        };
      })
    );

    return c.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        projectId: projectId ?? null,
        siteId: siteId ?? null,
        sourceUpdateId: sourceUpdateId ?? null,
        status: status ?? null,
        kind: kind ?? null,
        reporterTeamMemberId: reporterTeamMemberId ?? null,
        severity: severity ?? null,
        ownerId: ownerId ?? null,
        dueBefore: dueBefore ?? null,
        dueAfter: dueAfter ?? null,
        overdueOnly,
        department: department ?? null,
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    opsLog("error", "tasks.list_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
});

/**
 * GET /v1/tasks/:taskId
 *
 * Get a single task by ID (Phase F - flat route per §12.12).
 */
tasksFlatRouter.get("/:taskId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const taskId = c.req.param("taskId");
  const db = getDemoDb();
  const today = new Date().toISOString().split("T")[0];

  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));

    if (!task) {
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

    const ownerName = await resolvePersonName(db, task.ownerId);
    const assigneeRoleLabels = await resolveRoleTypeLabelsByCodes(db, [
      task.assigneeRoleCode,
    ]);
    const assigneeRoleLabel = assigneeRoleLabels.get(task.assigneeRoleCode)!;

    const isOverdue = task.dueDate < today && task.status !== "Done";

    // Get transcript notes
    const noteRows = await db
      .select({
        id: updates.id,
        transcript: updates.transcript,
        status: updates.status,
        createdAt: updates.createdAt,
      })
      .from(updates)
      .where(
        and(
          eq(updates.projectId, task.projectId),
          task.sourceUpdateId
            ? eq(updates.id, task.sourceUpdateId)
            : eq(updates.linkedTaskId, taskId)
        )
      )
      .orderBy(desc(updates.createdAt));

    const noteIds = noteRows.map((n) => n.id);
    const transcriptAttachments =
      noteIds.length > 0
        ? await db
            .select()
            .from(updateAttachments)
            .where(inArray(updateAttachments.updateId, noteIds))
        : [];

    const attByUpdate = new Map<
      string,
      (typeof transcriptAttachments)[number][]
    >();
    for (const a of transcriptAttachments) {
      const list = attByUpdate.get(a.updateId) ?? [];
      list.push(a);
      attByUpdate.set(a.updateId, list);
    }

    const siteAttachments = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId));

    return c.json({
      id: task.id,
      projectId: task.projectId,
      siteId: task.siteId,
      kind: task.kind,
      reporterTeamMemberId: task.reporterTeamMemberId ?? null,
      title: task.title,
      description: task.description,
      severity: task.severity,
      departmentCode: task.departmentCode ?? null,
      createdBy: task.createdBy || null,
      updatedBy: task.updatedBy || null,
      owner: ownerName,
      ownerId: task.ownerId,
      assigneeRoleCode: task.assigneeRoleCode,
      assigneeRoleName: assigneeRoleLabel,
      location: task.location,
      locationId: task.locationId,
      dueDate: task.dueDate,
      startDate: task.startDate,
      status: task.status,
      source: task.source,
      sourceUpdateId: task.sourceUpdateId,
      completedAt: task.completedAt,
      isOverdue,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      transcriptNotes: noteRows.map((n) => ({
        updateId: n.id,
        transcript: n.transcript,
        status: n.status,
        createdAt: n.createdAt,
        attachments: (attByUpdate.get(n.id) ?? []).map((a) => ({
          id: a.id,
          url: a.url,
          type: a.type,
          uploadedAt: a.uploadedAt,
          taskId: a.taskId,
        })),
      })),
      taskAttachments: siteAttachments.map((a) => ({
        id: a.id,
        url: a.url,
        type: a.type,
        uploadedAt: a.uploadedAt,
      })),
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/tasks/:taskId
 *
 * Update a task (Phase F - flat route per §12.12).
 * Body: { status: "In-progress" | "Blocked" | "Done" }
 */
tasksFlatRouter.patch("/:taskId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const taskId = c.req.param("taskId");
  const db = getDemoDb();

  try {
    let body: { status?: string };
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

    if (
      !body.status ||
      !TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])
    ) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid or missing status",
            details: { validValues: TASK_STATUSES, received: body.status },
          },
        },
        400
      );
    }

    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));

    if (!task) {
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

    const now = new Date().toISOString();
    const completedAt =
      body.status === "Done" ? (task.completedAt ?? now) : null;

    await db
      .update(tasks)
      .set({
        status: body.status,
        completedAt,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    opsLog("info", "task.updated", {
      taskId,
      projectId: task.projectId,
      status: body.status,
    });

    await insertAuditEvent(db, {
      eventType: "task.status_changed",
      projectId: task.projectId,
      siteId: task.siteId,
      entityType: "task",
      entityId: taskId,
      payload: {
        previousStatus: task.status,
        status: body.status,
      },
    });

    const ownerName = await resolvePersonName(db, task.ownerId);
    const assigneeRoleLabels = await resolveRoleTypeLabelsByCodes(db, [
      task.assigneeRoleCode,
    ]);
    const assigneeRoleLabel = assigneeRoleLabels.get(task.assigneeRoleCode)!;

    const today = now.split("T")[0];
    const isOverdue = task.dueDate < today && body.status !== "Done";

    return c.json({
      id: taskId,
      projectId: task.projectId,
      siteId: task.siteId,
      title: task.title,
      description: task.description,
      severity: task.severity,
      departmentCode: task.departmentCode ?? null,
      owner: ownerName,
      ownerId: task.ownerId,
      assigneeRoleCode: task.assigneeRoleCode,
      assigneeRoleName: assigneeRoleLabel,
      location: task.location,
      locationId: task.locationId,
      dueDate: task.dueDate,
      startDate: task.startDate,
      status: body.status,
      source: task.source,
      sourceUpdateId: task.sourceUpdateId,
      completedAt,
      isOverdue,
      createdBy: task.createdBy ?? null,
      updatedBy: task.updatedBy ?? null,
      createdAt: task.createdAt,
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
 * POST /v1/tasks
 *
 * Create a new task (Phase F - flat route per §12.12).
 * Project scope is enforced via projectId in body.
 */
tasksFlatRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  let body: {
    projectId: string;
    title: string;
    description: string;
    severity: string;
    departmentCode: string;
    locationId: string;
    ownerId: string;
    assigneeRoleCode: string;
    dueDate: string;
    sourceUpdateId?: string;
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

  const requiredFields = [
    "projectId",
    "title",
    "description",
    "severity",
    "departmentCode",
    "locationId",
    "ownerId",
    "assigneeRoleCode",
    "dueDate",
  ];

  const missingFields = requiredFields.filter((field) => !body[field as keyof typeof body]);

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

  try {
    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, body.projectId));

    if (!project) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Project not found",
            details: { projectId: body.projectId },
          },
        },
        404
      );
    }

    // Validate location belongs to project
    const [location] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, body.locationId),
          eq(locations.projectId, body.projectId)
        )
      );

    if (!location) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid locationId for this project",
            details: { locationId: body.locationId, projectId: body.projectId },
          },
        },
        400
      );
    }

    // Validate owner exists
    const [owner] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, body.ownerId));

    if (!owner) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ownerId",
            details: { ownerId: body.ownerId },
          },
        },
        400
      );
    }

    // Validate department
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, body.departmentCode));

    if (!department) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid departmentCode",
            details: { departmentCode: body.departmentCode },
          },
        },
        400
      );
    }

    // Validate role type
    const [roleType] = await db
      .select()
      .from(roleTypes)
      .where(eq(roleTypes.code, body.assigneeRoleCode));

    if (!roleType) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid assigneeRoleCode",
            details: { assigneeRoleCode: body.assigneeRoleCode },
          },
        },
        400
      );
    }

    // Validate sourceUpdateId if provided
    if (body.sourceUpdateId) {
      const [update] = await db
        .select()
        .from(updates)
        .where(
          and(
            eq(updates.id, body.sourceUpdateId),
            eq(updates.projectId, body.projectId)
          )
        );

      if (!update) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid sourceUpdateId for this project",
              details: {
                sourceUpdateId: body.sourceUpdateId,
                projectId: body.projectId,
              },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();
    const taskId = randomUUID();

    await db.insert(tasks).values({
      id: taskId,
      projectId: body.projectId,
      siteId: project.siteId,
      kind: "task",
      reporterTeamMemberId: null,
      title: body.title,
      description: body.description,
      severity: body.severity,
      departmentCode: body.departmentCode,
      locationId: body.locationId,
      location: location.displayLabel,
      ownerId: body.ownerId,
      assigneeRoleCode: body.assigneeRoleCode,
      dueDate: body.dueDate,
      startDate: now.slice(0, 10),
      status: "Active",
      source: body.sourceUpdateId ? "voice_update" : "manual",
      sourceUpdateId: body.sourceUpdateId || null,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "task.created", {
      taskId,
      projectId: body.projectId,
      title: body.title,
    });

    await insertAuditEvent(db, {
      eventType: "task.created",
      projectId: body.projectId,
      siteId: project.siteId,
      entityType: "task",
      entityId: taskId,
      payload: {
        title: body.title,
        source: body.sourceUpdateId ? "voice_update" : "manual",
        ownerId: body.ownerId,
        notifyUserId: owner.userId ?? null,
      },
    });

    await insertAuditEvent(db, {
      eventType: "task.assigned",
      projectId: body.projectId,
      siteId: project.siteId,
      entityType: "task",
      entityId: taskId,
      payload: {
        title: body.title,
        ownerId: body.ownerId,
        notifyUserId: owner.userId ?? null,
      },
    });

    if (body.dueDate < now.slice(0, 10)) {
      await insertAuditEvent(db, {
        eventType: "task.overdue",
        projectId: body.projectId,
        siteId: project.siteId,
        entityType: "task",
        entityId: taskId,
        payload: {
          title: body.title,
          ownerId: body.ownerId,
          dueDate: body.dueDate,
          notifyUserId: owner.userId ?? null,
        },
      });
    }

    const ownerName = await resolvePersonName(db, body.ownerId);

    return c.json(
      {
        id: taskId,
        projectId: body.projectId,
        siteId: project.siteId,
        title: body.title,
        description: body.description,
        severity: body.severity,
        departmentCode: body.departmentCode,
        owner: ownerName,
        ownerId: body.ownerId,
        assigneeRoleCode: body.assigneeRoleCode,
        assigneeRoleName: roleType.name,
        location: location.displayLabel,
        locationId: body.locationId,
        dueDate: body.dueDate,
        startDate: now.slice(0, 10),
        status: "Active",
        source: body.sourceUpdateId ? "voice_update" : "manual",
        sourceUpdateId: body.sourceUpdateId || null,
        completedAt: null,
        isOverdue: false,
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

export { tasksFlatRouter };
