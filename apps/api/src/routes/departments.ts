/**
 * Departments Routes (§12.3)
 *
 * CRUD routes for departments management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import { departments } from "@v2e/database";

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
// Router Setup
// ============================================================================

const departmentsRouter = new Hono();

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
// Departments Routes
// ============================================================================

/**
 * GET /v1/departments
 * List all departments with optional filters.
 * Filters: isActive, category
 */
departmentsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const isActiveFilter = c.req.query("isActive");
  const categoryFilter = c.req.query("category");

  try {
    const conditions = [];
    if (isActiveFilter !== undefined) {
      const isActive = isActiveFilter === "true" ? 1 : 0;
      conditions.push(eq(departments.isActive, isActive));
    }
    if (categoryFilter) {
      conditions.push(eq(departments.category, categoryFilter));
    }

    const results = conditions.length > 0
      ? await db.select().from(departments).where(and(...conditions))
      : await db.select().from(departments);

    // Convert integer booleans to actual booleans for response
    const data = results.map((d) => ({
      ...d,
      isSiteFunction: d.isSiteFunction === 1,
      isExecutionDiscipline: d.isExecutionDiscipline === 1,
      isActive: d.isActive === 1,
    }));

    return c.json({
      data,
      total: data.length,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * GET /v1/departments/:departmentId
 * Get a single department by ID.
 */
departmentsRouter.get("/:departmentId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const departmentId = c.req.param("departmentId");
  const db = getDemoDb();

  try {
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId));

    if (!dept) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Department not found",
            details: { departmentId },
          },
        },
        404
      );
    }

    return c.json({
      ...dept,
      isSiteFunction: dept.isSiteFunction === 1,
      isExecutionDiscipline: dept.isExecutionDiscipline === 1,
      isActive: dept.isActive === 1,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/departments
 * Create a new department.
 */
departmentsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      code: string;
      name: string;
      category: string;
      isSiteFunction?: boolean;
      isExecutionDiscipline?: boolean;
      isActive?: boolean;
      sortOrder: number;
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
    const requiredFields = ["code", "name", "category", "sortOrder"] as const;
    const missingFields = requiredFields.filter((f) => body[f as keyof typeof body] === undefined);

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

    // Check for duplicate code
    const [existingCode] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.code, body.code));

    if (existingCode) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Department code already exists",
            details: { code: body.code },
          },
        },
        409
      );
    }

    const departmentId = randomUUID();

    await db.insert(departments).values({
      id: departmentId,
      code: body.code,
      name: body.name,
      category: body.category,
      isSiteFunction: body.isSiteFunction ? 1 : 0,
      isExecutionDiscipline: body.isExecutionDiscipline ? 1 : 0,
      isActive: body.isActive !== false ? 1 : 0,
      sortOrder: body.sortOrder,
    });

    opsLog("info", "department.created", { departmentId, code: body.code });

    await insertAuditEvent(db, {
      eventType: "department.created",
      projectId: null,
      entityType: "department",
      entityId: departmentId,
      payload: { code: body.code, name: body.name, category: body.category },
    });

    return c.json(
      {
        id: departmentId,
        code: body.code,
        name: body.name,
        category: body.category,
        isSiteFunction: body.isSiteFunction ?? false,
        isExecutionDiscipline: body.isExecutionDiscipline ?? false,
        isActive: body.isActive !== false,
        sortOrder: body.sortOrder,
      },
      201
    );
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

/**
 * PATCH /v1/departments/:departmentId
 * Update a department.
 */
departmentsRouter.patch("/:departmentId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const departmentId = c.req.param("departmentId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Department not found",
            details: { departmentId },
          },
        },
        404
      );
    }

    let body: {
      code?: string;
      name?: string;
      category?: string;
      isSiteFunction?: boolean;
      isExecutionDiscipline?: boolean;
      isActive?: boolean;
      sortOrder?: number;
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

    // Check for duplicate code if changing
    if (body.code && body.code !== existing.code) {
      const [existingCode] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.code, body.code));

      if (existingCode) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Department code already exists",
              details: { code: body.code },
            },
          },
          409
        );
      }
    }

    await db
      .update(departments)
      .set({
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        category: body.category ?? existing.category,
        isSiteFunction: body.isSiteFunction !== undefined ? (body.isSiteFunction ? 1 : 0) : existing.isSiteFunction,
        isExecutionDiscipline: body.isExecutionDiscipline !== undefined ? (body.isExecutionDiscipline ? 1 : 0) : existing.isExecutionDiscipline,
        isActive: body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      })
      .where(eq(departments.id, departmentId));

    opsLog("info", "department.updated", { departmentId });

    return c.json({
      id: departmentId,
      code: body.code ?? existing.code,
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      isSiteFunction: body.isSiteFunction !== undefined ? body.isSiteFunction : existing.isSiteFunction === 1,
      isExecutionDiscipline: body.isExecutionDiscipline !== undefined ? body.isExecutionDiscipline : existing.isExecutionDiscipline === 1,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive === 1,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { departmentsRouter };
