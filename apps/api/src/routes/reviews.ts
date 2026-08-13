/**
 * Review Queue Routes (Flat)
 *
 * Technical review queue at flat URL with projectId in query.
 */

import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { projects, tasks } from "@v2e/database";

import { getDemoDb } from "../db.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { deriveSupervisorTaskState } from "../lib/task-state.js";
import { resolvePersonNamesByIds, resolveRoleTypeLabelsByCodes } from "../lib/resolve-person.js";
import { computeDependencySummaries } from "../lib/dependencies.js";

const reviewsRouter = new Hono();

function dbNotReady(c: Context) {
  const sqlitePath = resolveSqlitePath();
  return c.json(
    {
      error: {
        code: "DB_NOT_FOUND",
        message: "Demo SQLite file is missing. Seed it from the repo root: pnpm --filter @v2e/database db:seed",
        details: { path: sqlitePath },
      },
    },
    503
  );
}

/**
 * GET /v1/reviews?projectId=...
 * Technical review queue for a project.
 */
reviewsRouter.get("/", async (c) => {
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

  const page = parseInt(c.req.query("page") || "1", 10);
  const pageSize = Math.min(parseInt(c.req.query("pageSize") || "20", 10), 100);

  const db = getDemoDb();

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
  }

  const todayYmd = new Date().toISOString().slice(0, 10);

  // Get tasks that need technical review: Blocked status or high severity
  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      severity: tasks.severity,
      location: tasks.location,
      locationId: tasks.locationId,
      ownerId: tasks.ownerId,
      assigneeRoleCode: tasks.assigneeRoleCode,
      departmentCode: tasks.departmentCode,
      dueDate: tasks.dueDate,
      source: tasks.source,
      sourceUpdateId: tasks.sourceUpdateId,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(sql`${tasks.updatedAt} DESC`);

  // Filter for technical review queue: blocked, critical severity, or escalated source
  const reviewQueue = taskRows.filter((t) => {
    const uiState = deriveSupervisorTaskState(t);
    return (
      uiState === "Blocked" ||
      t.severity === "Critical" ||
      t.source === "Escalated"
    );
  });

  // Paginate
  const total = reviewQueue.length;
  const offset = (page - 1) * pageSize;
  const paginatedItems = reviewQueue.slice(offset, offset + pageSize);

  // Get owner names and role labels
  const ownerIds = [...new Set(paginatedItems.map((t) => t.ownerId))];
  const ownerNameById = await resolvePersonNamesByIds(db, ownerIds);
  const roleCodes = [...new Set(paginatedItems.map((t) => t.assigneeRoleCode))];
  const roleLabelByCode = await resolveRoleTypeLabelsByCodes(db, roleCodes);

  // Compute real dependency summaries for paginated items
  const paginatedTaskIds = paginatedItems.map((t) => t.id);
  const dependencySummaries = await computeDependencySummaries(db, paginatedTaskIds);

  // Map to response items
  const items = paginatedItems.map((t) => {
    const isOverdue = t.dueDate < todayYmd && t.status !== "Done";
    const depSummary = dependencySummaries.get(t.id) ?? {
      dependencyCount: 0,
      blockedByCount: 0,
      blocksCount: 0,
      isDependencyBlocked: false,
    };

    return {
      taskId: t.id,
      taskTitle: t.title,
      taskDescription: t.description,
      taskStatus: t.status,
      taskSeverity: t.severity,
      location: t.location,
      ownerName: ownerNameById.get(t.ownerId) ?? "Unknown",
      ownerId: t.ownerId,
      assigneeRoleCode: t.assigneeRoleCode,
      assigneeRoleName: roleLabelByCode.get(t.assigneeRoleCode) ?? t.assigneeRoleCode,
      departmentCode: t.departmentCode ?? null,
      dueDate: t.dueDate,
      isOverdue,
      source: t.source,
      sourceUpdateId: t.sourceUpdateId ?? null,
      dependencySummary: depSummary,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    };
  });

  // Calculate stats
  const stats = {
    blocked: reviewQueue.filter((t) => deriveSupervisorTaskState(t) === "Blocked").length,
    escalated: reviewQueue.filter((t) => t.source === "Escalated").length,
    pendingReview: reviewQueue.filter((t) => t.severity === "Critical").length,
    overdue: reviewQueue.filter((t) => t.dueDate < todayYmd && t.status !== "Done").length,
  };

  return c.json({
    projectId,
    projectName: project.name,
    items,
    totalCount: total,
    stats,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export { reviewsRouter };
