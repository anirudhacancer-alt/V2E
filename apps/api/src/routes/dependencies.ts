/**
 * Task Dependencies Routes
 *
 * Routes for task dependencies management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  taskDependencies,
  projects,
  tasks,
  teamMembers,
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

const DEPENDENCY_TYPES = [
  "blocks",
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
] as const;
type DependencyType = (typeof DEPENDENCY_TYPES)[number];

// ============================================================================
// Router Setup
// ============================================================================

/** All routes under `/v1/dependencies` (create/delete use JSON body or `:dependencyId` path). */
const dependenciesRouter = new Hono();

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

/**
 * Detect cycles in task dependency graph using DFS.
 * Returns true if adding the edge (predecessor -> successor) would create a cycle.
 */
async function wouldCreateCycle(
  db: ReturnType<typeof getDemoDb>,
  projectId: string,
  predecessorTaskId: string,
  successorTaskId: string,
  excludeDependencyId?: string
): Promise<boolean> {
  // Build adjacency list: predecessor -> [successors]
  const deps = await db
    .select({
      id: taskDependencies.id,
      predecessor: taskDependencies.predecessorTaskId,
      successor: taskDependencies.successorTaskId,
      isHard: taskDependencies.isHardConstraint,
    })
    .from(taskDependencies)
    .where(
      and(
        eq(taskDependencies.projectId, projectId),
        eq(taskDependencies.isHardConstraint, 1)
      )
    );

  // Filter out the edge we're potentially updating
  const edges = deps.filter((d) => d.id !== excludeDependencyId);

  // Add the proposed edge
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = adjacency.get(edge.predecessor) ?? [];
    existing.push(edge.successor);
    adjacency.set(edge.predecessor, existing);
  }

  // Add proposed edge
  const existingSuccessors = adjacency.get(predecessorTaskId) ?? [];
  existingSuccessors.push(successorTaskId);
  adjacency.set(predecessorTaskId, existingSuccessors);

  // DFS from successorTaskId to see if we can reach predecessorTaskId
  const visited = new Set<string>();
  const stack = [successorTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === predecessorTaskId) {
      return true; // Cycle detected
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const successors = adjacency.get(current) ?? [];
    for (const successor of successors) {
      stack.push(successor);
    }
  }

  return false;
}

// ============================================================================
// Task Dependencies Routes
// ============================================================================

/**
 * POST /v1/dependencies
 * Create a task dependency. `projectId`, successor (`successorTaskId` or legacy `taskId`), and other fields are in the JSON body.
 */
dependenciesRouter.post(
  "/",
  requireAuth,
  async (c) => {
    if (!sqliteFileExists()) {
      return dbNotReady(c);
    }

    const db = getDemoDb();

    try {
      let body: {
        projectId: string;
        successorTaskId?: string;
        taskId?: string;
        predecessorTaskId: string;
        dependencyType?: string;
        lagDays?: number;
        isHardConstraint?: boolean;
        reason?: string;
        createdBy: string;
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

      const successorTaskId = body.successorTaskId ?? body.taskId;
      if (!body.projectId || !successorTaskId) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "projectId and successorTaskId (or taskId) are required",
            },
          },
          400
        );
      }
      const projectId = body.projectId;
      const taskId = successorTaskId;

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

      // Verify successor task exists and belongs to project
      const [task] = await db
        .select({ id: tasks.id, projectId: tasks.projectId })
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

      if (task.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "Task does not belong to this project",
              details: { taskId, projectId },
            },
          },
          400
        );
      }

      // Validate required fields
      if (!body.predecessorTaskId || !body.createdBy) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Missing required fields",
              details: { missingFields: ["predecessorTaskId", "createdBy"].filter((f) => !body[f as keyof typeof body]) },
            },
          },
          400
        );
      }

      // Validate no self-edge
      if (body.predecessorTaskId === taskId) {
        return c.json(
          {
            error: {
              code: "DEPENDENCY_INVALID_EDGE",
              message: "A task cannot depend on itself",
              details: { predecessorTaskId: body.predecessorTaskId, successorTaskId: taskId },
            },
          },
          400
        );
      }

      // Validate predecessor task exists and belongs to same project
      const [predecessor] = await db
        .select({ id: tasks.id, projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, body.predecessorTaskId));

      if (!predecessor) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "predecessorTaskId not found",
              details: { predecessorTaskId: body.predecessorTaskId },
            },
          },
          400
        );
      }

      if (predecessor.projectId !== projectId) {
        return c.json(
          {
            error: {
              code: "PROJECT_SCOPE_MISMATCH",
              message: "predecessorTaskId does not belong to this project",
              details: { predecessorTaskId: body.predecessorTaskId, projectId },
            },
          },
          400
        );
      }

      // Validate dependency type
      const dependencyType = (body.dependencyType ?? "finish_to_start") as DependencyType;
      if (!DEPENDENCY_TYPES.includes(dependencyType)) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid dependencyType value",
              details: { validValues: DEPENDENCY_TYPES, received: body.dependencyType },
            },
          },
          400
        );
      }

      // Validate createdBy exists
      const [creator] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.id, body.createdBy));

      if (!creator) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "createdBy not found in team_members",
              details: { createdBy: body.createdBy },
            },
          },
          400
        );
      }

      // Check for duplicate active edge
      const [existingDep] = await db
        .select({ id: taskDependencies.id })
        .from(taskDependencies)
        .where(
          and(
            eq(taskDependencies.projectId, projectId),
            eq(taskDependencies.predecessorTaskId, body.predecessorTaskId),
            eq(taskDependencies.successorTaskId, taskId),
            eq(taskDependencies.dependencyType, dependencyType)
          )
        );

      if (existingDep) {
        return c.json(
          {
            error: {
              code: "DEPENDENCY_INVALID_EDGE",
              message: "Duplicate dependency edge exists",
              details: {
                predecessorTaskId: body.predecessorTaskId,
                successorTaskId: taskId,
                dependencyType,
                existingDependencyId: existingDep.id,
              },
            },
          },
          409
        );
      }

      // Check for cycles (only for hard constraints)
      const isHardConstraint = body.isHardConstraint !== false;
      if (isHardConstraint) {
        const hasCycle = await wouldCreateCycle(
          db,
          projectId,
          body.predecessorTaskId,
          taskId
        );

        if (hasCycle) {
          return c.json(
            {
              error: {
                code: "DEPENDENCY_CYCLE_DETECTED",
                message: "Adding this dependency would create a cycle",
                details: {
                  predecessorTaskId: body.predecessorTaskId,
                  successorTaskId: taskId,
                },
              },
            },
            409
          );
        }
      }

      const now = new Date().toISOString();
      const dependencyId = randomUUID();
      const tenantId = "demo-tenant";

      await db.insert(taskDependencies).values({
        id: dependencyId,
        tenantId,
        projectId,
        predecessorTaskId: body.predecessorTaskId,
        successorTaskId: taskId,
        dependencyType,
        lagDays: body.lagDays ?? 0,
        isHardConstraint: isHardConstraint ? 1 : 0,
        reason: body.reason ?? null,
        createdBy: body.createdBy,
        createdAt: now,
        updatedAt: now,
      });

      opsLog("info", "dependency.created", {
        dependencyId,
        projectId,
        predecessorTaskId: body.predecessorTaskId,
        successorTaskId: taskId,
      });

      await insertAuditEvent(db, {
        eventType: "dependency.created",
        projectId,
        entityType: "task_dependency",
        entityId: dependencyId,
        payload: {
          predecessorTaskId: body.predecessorTaskId,
          successorTaskId: taskId,
          dependencyType,
          isHardConstraint,
          createdBy: body.createdBy,
        },
      });

      return c.json(
        {
          id: dependencyId,
          tenantId,
          projectId,
          predecessorTaskId: body.predecessorTaskId,
          successorTaskId: taskId,
          dependencyType,
          lagDays: body.lagDays ?? 0,
          isHardConstraint,
          reason: body.reason ?? null,
          createdBy: body.createdBy,
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
        return validationErrorResponse(c, e, 409);
      }
      throw e;
    }
  }
);

/**
 * DELETE /v1/dependencies/:dependencyId
 * Delete a task dependency.
 */
dependenciesRouter.delete(
  "/:dependencyId",
  requireAuth,
  async (c) => {
    if (!sqliteFileExists()) {
      return dbNotReady(c);
    }

    const dependencyId = c.req.param("dependencyId");
    const db = getDemoDb();

    try {
      const [existing] = await db
        .select()
        .from(taskDependencies)
        .where(eq(taskDependencies.id, dependencyId));

      if (!existing) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Dependency not found",
              details: { dependencyId },
            },
          },
          404
        );
      }

      const projectId = existing.projectId;

      await db
        .delete(taskDependencies)
        .where(eq(taskDependencies.id, dependencyId));

      opsLog("info", "dependency.deleted", {
        dependencyId,
        projectId,
      });

      await insertAuditEvent(db, {
        eventType: "dependency.deleted",
        projectId,
        entityType: "task_dependency",
        entityId: dependencyId,
        payload: {
          predecessorTaskId: existing.predecessorTaskId,
          successorTaskId: existing.successorTaskId,
          dependencyType: existing.dependencyType,
        },
      });

      return c.json({ deleted: true, id: dependencyId });
    } catch (e) {
      if (isDataIntegrityError(e)) {
        return integrityErrorResponse(c, e);
      }
      throw e;
    }
  }
);

/**
 * GET /v1/dependencies/:dependencyId
 * Get a single task dependency by ID.
 */
dependenciesRouter.get("/:dependencyId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const dependencyId = c.req.param("dependencyId");
  const db = getDemoDb();

  try {
    const [dependency] = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.id, dependencyId));

    if (!dependency) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Task dependency not found",
            details: { dependencyId },
          },
        },
        404
      );
    }

    // Convert isHardConstraint from 1/0 to boolean for response
    return c.json({
      ...dependency,
      isHardConstraint: dependency.isHardConstraint === 1,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/**
 * PATCH /v1/dependencies/:dependencyId
 * Update a task dependency (limited fields).
 */
dependenciesRouter.patch(
  "/:dependencyId",
  requireAuth,
  async (c) => {
    if (!sqliteFileExists()) {
      return dbNotReady(c);
    }

    const dependencyIdParam = c.req.param("dependencyId");
    if (!dependencyIdParam) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "dependencyId is required",
          },
        },
        400
      );
    }
    const dependencyId = dependencyIdParam;
    const db = getDemoDb();

    try {
      const [existing] = await db
        .select()
        .from(taskDependencies)
        .where(eq(taskDependencies.id, dependencyId));

      if (!existing) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Dependency not found",
              details: { dependencyId },
            },
          },
          404
        );
      }

      let body: {
        lagDays?: number;
        isHardConstraint?: boolean;
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

      // If changing to hard constraint, check for cycles
      const newIsHard = body.isHardConstraint !== undefined ? body.isHardConstraint : existing.isHardConstraint === 1;
      if (newIsHard && existing.isHardConstraint === 0) {
        const hasCycle = await wouldCreateCycle(
          db,
          existing.projectId,
          existing.predecessorTaskId,
          existing.successorTaskId,
          dependencyId
        );

        if (hasCycle) {
          return c.json(
            {
              error: {
                code: "DEPENDENCY_CYCLE_DETECTED",
                message: "Making this dependency hard would create a cycle",
                details: {
                  predecessorTaskId: existing.predecessorTaskId,
                  successorTaskId: existing.successorTaskId,
                },
              },
            },
            409
          );
        }
      }

      const now = new Date().toISOString();

      await db
        .update(taskDependencies)
        .set({
          lagDays: body.lagDays ?? existing.lagDays,
          isHardConstraint: newIsHard ? 1 : 0,
          reason: body.reason !== undefined ? body.reason : existing.reason,
          updatedAt: now,
        })
        .where(eq(taskDependencies.id, dependencyId));

      opsLog("info", "dependency.updated", {
        dependencyId,
        projectId: existing.projectId,
      });

      return c.json({
        id: dependencyId,
        tenantId: existing.tenantId,
        projectId: existing.projectId,
        predecessorTaskId: existing.predecessorTaskId,
        successorTaskId: existing.successorTaskId,
        dependencyType: existing.dependencyType,
        lagDays: body.lagDays ?? existing.lagDays,
        isHardConstraint: newIsHard,
        reason: body.reason !== undefined ? body.reason : existing.reason,
        createdBy: existing.createdBy,
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
  }
);

/**
 * POST /v1/dependencies/override
 * Override a hard constraint dependency.
 * Body: { dependencyId, projectId, reason, overriddenBy }
 */
dependenciesRouter.post(
  "/override",
  requireAuth,
  async (c) => {
    if (!sqliteFileExists()) {
      return dbNotReady(c);
    }

    let body: {
      dependencyId?: string;
      projectId?: string;
      reason?: string;
      overriddenBy?: string;
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

    const dependencyId = body.dependencyId;
    if (!dependencyId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "dependencyId is required in body",
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
        .from(taskDependencies)
        .where(eq(taskDependencies.id, dependencyId));

      if (!existing) {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Dependency not found",
              details: { dependencyId },
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
              message: "Dependency does not belong to the specified project",
              details: { dependencyId, projectId },
            },
          },
          400
        );
      }

      // Validate reason is provided
      if (!body.reason || !body.reason.trim()) {
        return c.json(
          {
            error: {
              code: "DEPENDENCY_OVERRIDE_REQUIRES_REASON",
              message: "Override requires a reason",
              details: { dependencyId },
            },
          },
          400
        );
      }

      // Validate overriddenBy exists
      if (!body.overriddenBy) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "overriddenBy is required",
              details: {},
            },
          },
          400
        );
      }

      const [overrider] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.id, body.overriddenBy));

      if (!overrider) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "overriddenBy not found in team_members",
              details: { overriddenBy: body.overriddenBy },
            },
          },
          400
        );
      }

      const now = new Date().toISOString();

      // Override by setting isHardConstraint to 0 and updating reason
      await db
        .update(taskDependencies)
        .set({
          isHardConstraint: 0,
          reason: `[OVERRIDE] ${body.reason} (by ${body.overriddenBy} at ${now})`,
          updatedAt: now,
        })
        .where(eq(taskDependencies.id, dependencyId));

      opsLog("info", "dependency.override", {
        dependencyId,
        projectId: existing.projectId,
        overriddenBy: body.overriddenBy,
      });

      await insertAuditEvent(db, {
        eventType: "dependency.override",
        projectId: existing.projectId,
        entityType: "task_dependency",
        entityId: dependencyId,
        payload: {
          predecessorTaskId: existing.predecessorTaskId,
          successorTaskId: existing.successorTaskId,
          reason: body.reason,
          overriddenBy: body.overriddenBy,
          previousIsHardConstraint: existing.isHardConstraint === 1,
        },
      });

      return c.json({
        id: dependencyId,
        tenantId: existing.tenantId,
        projectId: existing.projectId,
        predecessorTaskId: existing.predecessorTaskId,
        successorTaskId: existing.successorTaskId,
        dependencyType: existing.dependencyType,
        lagDays: existing.lagDays,
        isHardConstraint: false,
        reason: `[OVERRIDE] ${body.reason} (by ${body.overriddenBy} at ${now})`,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        updatedAt: now,
        override: {
          reason: body.reason,
          overriddenBy: body.overriddenBy,
          overriddenAt: now,
        },
      });
    } catch (e) {
      if (isDataIntegrityError(e)) {
        return integrityErrorResponse(c, e);
      }
      throw e;
    }
  }
);

export { dependenciesRouter };
