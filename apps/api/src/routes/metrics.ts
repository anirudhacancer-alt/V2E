/**
 * Reliability Metrics Routes
 *
 * Routes for execution reliability and pilot metrics.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  improvementActions,
  projects,
  tasks,
  commitments,
  taskDependencies,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";

// ============================================================================
// Router Setup
// ============================================================================

const metricsRouter = new Hono();

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
// Reliability Dashboard Routes
// ============================================================================

/**
 * GET /v1/metrics/reliability?projectId=
 * Get execution reliability metrics for a project.
 */
metricsRouter.get("/reliability", async (c) => {
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

  try {
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

    // Calculate commitment reliability
    const allCommitments = await db
      .select({
        status: commitments.status,
      })
      .from(commitments)
      .where(eq(commitments.projectId, projectId));

    const completedCommitments = allCommitments.filter(
      (c) => c.status === "completed"
    ).length;
    const missedCommitments = allCommitments.filter(
      (c) => c.status === "missed"
    ).length;
    const totalRelevant = completedCommitments + missedCommitments;
    const commitmentReliability =
      totalRelevant > 0
        ? Math.round((completedCommitments / totalRelevant) * 100 * 100) / 100
        : null;

    // Calculate blocked task aging
    const blockedTasks = await db
      .select({
        id: tasks.id,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "blocked")));

    const now = new Date();
    let totalBlockedDays = 0;
    for (const task of blockedTasks) {
      const createdAt = new Date(task.createdAt);
      const diffDays = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalBlockedDays += diffDays;
    }
    const averageBlockedAgingDays =
      blockedTasks.length > 0
        ? Math.round((totalBlockedDays / blockedTasks.length) * 100) / 100
        : 0;

    // Calculate dependency health - tasks blocked by hard constraints
    const hardDependencies = await db
      .select({
        successorTaskId: taskDependencies.successorTaskId,
      })
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.projectId, projectId),
          eq(taskDependencies.isHardConstraint, 1)
        )
      );

    // Get unique successor task IDs that are blocked by hard constraints
    const blockedByHardConstraint = new Set(
      hardDependencies.map((d) => d.successorTaskId)
    );

    // Check how many of those tasks are not yet done
    const successorTaskStatuses = await db
      .select({
        id: tasks.id,
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const taskStatusMap = new Map(
      successorTaskStatuses.map((t) => [t.id, t.status])
    );

    let tasksBlockedByHardConstraints = 0;
    for (const taskId of blockedByHardConstraint) {
      const status = taskStatusMap.get(taskId);
      if (status && status !== "done" && status !== "canceled") {
        tasksBlockedByHardConstraints++;
      }
    }

    // Calculate at-risk commitments
    const atRiskCommitments = allCommitments.filter(
      (c) => c.status === "at_risk"
    ).length;
    const carriedOverCommitments = allCommitments.filter(
      (c) => c.status === "carried_over"
    ).length;

    return c.json({
      projectId,
      metrics: {
        commitmentReliability: {
          value: commitmentReliability,
          unit: "percent",
          completed: completedCommitments,
          missed: missedCommitments,
          total: allCommitments.length,
        },
        blockedTaskAging: {
          averageDays: averageBlockedAgingDays,
          blockedTaskCount: blockedTasks.length,
        },
        dependencyHealth: {
          tasksBlockedByHardConstraints,
          totalHardDependencies: hardDependencies.length,
        },
        commitmentHealth: {
          atRisk: atRiskCommitments,
          carriedOver: carriedOverCommitments,
          inProgress: allCommitments.filter((c) => c.status === "in_progress")
            .length,
          planned: allCommitments.filter((c) => c.status === "planned").length,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * GET /v1/metrics/pilot?projectId=
 * Get pilot KPIs for a project.
 */
metricsRouter.get("/pilot", async (c) => {
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

  try {
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

    // Task metrics
    const allTasks = await db
      .select({
        id: tasks.id,
        status: tasks.status,
        severity: tasks.severity,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));

    const tasksByStatus = {
      open: allTasks.filter((t) => t.status === "open").length,
      in_progress: allTasks.filter((t) => t.status === "in_progress").length,
      blocked: allTasks.filter((t) => t.status === "blocked").length,
      done: allTasks.filter((t) => t.status === "done").length,
      canceled: allTasks.filter((t) => t.status === "canceled").length,
    };

    const tasksBySeverity = {
      high: allTasks.filter((t) => t.severity === "high").length,
      medium: allTasks.filter((t) => t.severity === "medium").length,
      low: allTasks.filter((t) => t.severity === "low").length,
    };

    // Calculate average cycle time for completed tasks
    const completedTasks = allTasks.filter((t) => t.completedAt);
    let totalCycleDays = 0;
    for (const task of completedTasks) {
      const created = new Date(task.createdAt);
      const completed = new Date(task.completedAt!);
      const diffDays =
        (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      totalCycleDays += diffDays;
    }
    const averageCycleTimeDays =
      completedTasks.length > 0
        ? Math.round((totalCycleDays / completedTasks.length) * 100) / 100
        : null;

    // Commitment metrics
    const allCommitments = await db
      .select({
        status: commitments.status,
      })
      .from(commitments)
      .where(eq(commitments.projectId, projectId));

    const commitmentsByStatus = {
      planned: allCommitments.filter((c) => c.status === "planned").length,
      in_progress: allCommitments.filter((c) => c.status === "in_progress")
        .length,
      completed: allCommitments.filter((c) => c.status === "completed").length,
      at_risk: allCommitments.filter((c) => c.status === "at_risk").length,
      missed: allCommitments.filter((c) => c.status === "missed").length,
      carried_over: allCommitments.filter((c) => c.status === "carried_over")
        .length,
    };

    // Improvement action metrics
    const allImprovementActions = await db
      .select({
        status: improvementActions.status,
        category: improvementActions.category,
      })
      .from(improvementActions)
      .where(eq(improvementActions.projectId, projectId));

    const improvementActionsByStatus = {
      open: allImprovementActions.filter((a) => a.status === "open").length,
      in_progress: allImprovementActions.filter(
        (a) => a.status === "in_progress"
      ).length,
      validated: allImprovementActions.filter((a) => a.status === "validated")
        .length,
      closed: allImprovementActions.filter((a) => a.status === "closed").length,
    };

    const improvementActionsByCategory = {
      quality: allImprovementActions.filter((a) => a.category === "quality")
        .length,
      schedule: allImprovementActions.filter((a) => a.category === "schedule")
        .length,
      safety: allImprovementActions.filter((a) => a.category === "safety")
        .length,
      maintenance: allImprovementActions.filter(
        (a) => a.category === "maintenance"
      ).length,
      retail_execution: allImprovementActions.filter(
        (a) => a.category === "retail_execution"
      ).length,
      other: allImprovementActions.filter((a) => a.category === "other").length,
    };

    return c.json({
      projectId,
      metrics: {
        tasks: {
          total: allTasks.length,
          byStatus: tasksByStatus,
          bySeverity: tasksBySeverity,
          averageCycleTimeDays,
        },
        commitments: {
          total: allCommitments.length,
          byStatus: commitmentsByStatus,
        },
        improvementActions: {
          total: allImprovementActions.length,
          byStatus: improvementActionsByStatus,
          byCategory: improvementActionsByCategory,
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { metricsRouter };
