/**
 * Dashboard Routes (Flat)
 *
 * GET /v1/dashboard?projectId=... - Get dashboard metrics for a project
 */

import { and, count, eq, ne, not, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { projects, tasks, updates } from "@v2e/database";

import { getDemoDb } from "../db.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { deriveSupervisorTaskState } from "../lib/task-state.js";

const dashboardRouter = new Hono();

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

dashboardRouter.get("/", async (c) => {
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

  const db = getDemoDb();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
  }

  const projectTasks = await db
    .select({
      status: tasks.status,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const statusCounts = {
    active: 0,
    blocked: 0,
    done: 0,
  };
  let overdueCount = 0;
  let tasksBlockedToday = 0;
  const todayYmd = new Date().toISOString().slice(0, 10);
  projectTasks.forEach((task) => {
    const uiState = deriveSupervisorTaskState(task);
    if (uiState === "In-progress") statusCounts.active += 1;
    if (uiState === "Blocked") statusCounts.blocked += 1;
    if (uiState === "Blocked" && task.dueDate.slice(0, 10) === todayYmd) {
      tasksBlockedToday += 1;
    }
    if (uiState === "Overdue") overdueCount += 1;
    if (task.status === "Done") statusCounts.done += 1;
  });

  const tasksBySeverity = await db
    .select({
      severity: tasks.severity,
      count: count(),
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.severity);

  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  tasksBySeverity.forEach((row) => {
    if (row.severity === "Critical") severityCounts.critical = row.count;
    if (row.severity === "High") severityCounts.high = row.count;
    if (row.severity === "Medium") severityCounts.medium = row.count;
    if (row.severity === "Low") severityCounts.low = row.count;
  });

  const [updateStats] = await db
    .select({ n: count() })
    .from(updates)
    .where(eq(updates.projectId, projectId));

  const linkedToExistingTask = sql`(
    ${updates.linkedTaskId} IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ${tasks}
      WHERE ${tasks.id} = ${updates.linkedTaskId}
      AND ${tasks.createdAt} < ${updates.createdAt}
    )
  )`;

  const [reviewQueueRow] = await db
    .select({ n: count() })
    .from(updates)
    .where(
      and(
        eq(updates.projectId, projectId),
        ne(updates.status, "Escalated"),
        not(linkedToExistingTask),
      ),
    );

  return c.json({
    projectId: project.id,
    projectName: project.name,
    tasksByStatus: statusCounts,
    tasksBlockedToday,
    tasksBySeverity: severityCounts,
    overdueCount,
    recentUpdatesCount: updateStats?.n || 0,
    reviewQueueCount: reviewQueueRow?.n ?? 0,
    upcomingStandupDate: null,
    lastUpdatedAt: new Date().toISOString(),
  });
});

export { dashboardRouter };
