/**
 * Role Types Routes (§12.4)
 *
 * CRUD routes for role types management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import { roleTypes } from "@v2e/database";

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

const rolesRouter = new Hono();

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
// Role Types Routes
// ============================================================================

/**
 * GET /v1/roles
 * List all role types with optional filters.
 * Filters: isActive, level
 */
rolesRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const isActiveFilter = c.req.query("isActive");
  const levelFilter = c.req.query("level");

  try {
    const conditions = [];
    if (isActiveFilter !== undefined) {
      const isActive = isActiveFilter === "true" ? 1 : 0;
      conditions.push(eq(roleTypes.isActive, isActive));
    }
    if (levelFilter) {
      conditions.push(eq(roleTypes.level, levelFilter));
    }

    const results = conditions.length > 0
      ? await db.select().from(roleTypes).where(and(...conditions))
      : await db.select().from(roleTypes);

    // Convert integer booleans to actual booleans for response
    const data = results.map((r) => ({
      ...r,
      isManagerial: r.isManagerial === 1,
      isFieldBased: r.isFieldBased === 1,
      isCrewRole: r.isCrewRole === 1,
      isActive: r.isActive === 1,
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
 * GET /v1/roles/:roleTypeId
 * Get a single role type by ID.
 */
rolesRouter.get("/:roleTypeId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const roleTypeId = c.req.param("roleTypeId");
  const db = getDemoDb();

  try {
    const [role] = await db
      .select()
      .from(roleTypes)
      .where(eq(roleTypes.id, roleTypeId));

    if (!role) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Role type not found",
            details: { roleTypeId },
          },
        },
        404
      );
    }

    return c.json({
      ...role,
      isManagerial: role.isManagerial === 1,
      isFieldBased: role.isFieldBased === 1,
      isCrewRole: role.isCrewRole === 1,
      isActive: role.isActive === 1,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/roles
 * Create a new role type.
 */
rolesRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      code: string;
      name: string;
      level: string;
      isManagerial?: boolean;
      isFieldBased?: boolean;
      isCrewRole?: boolean;
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
    const requiredFields = ["code", "name", "level", "sortOrder"] as const;
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

    // Validate code format
    if (!/^[A-Z][A-Z0-9_]*$/.test(body.code)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Role code must be SCREAMING_SNAKE_CASE (e.g., SITE_MANAGER)",
            details: { code: body.code },
          },
        },
        400
      );
    }

    // Check for duplicate code
    const [existingCode] = await db
      .select({ id: roleTypes.id })
      .from(roleTypes)
      .where(eq(roleTypes.code, body.code));

    if (existingCode) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Role type code already exists",
            details: { code: body.code },
          },
        },
        409
      );
    }

    const roleTypeId = randomUUID();

    await db.insert(roleTypes).values({
      id: roleTypeId,
      code: body.code,
      name: body.name,
      level: body.level,
      isManagerial: body.isManagerial ? 1 : 0,
      isFieldBased: body.isFieldBased ? 1 : 0,
      isCrewRole: body.isCrewRole ? 1 : 0,
      isActive: body.isActive !== false ? 1 : 0,
      sortOrder: body.sortOrder,
    });

    opsLog("info", "role_type.created", { roleTypeId, code: body.code });

    await insertAuditEvent(db, {
      eventType: "role_type.created",
      projectId: null,
      entityType: "role_type",
      entityId: roleTypeId,
      payload: { code: body.code, name: body.name, level: body.level },
    });

    return c.json(
      {
        id: roleTypeId,
        code: body.code,
        name: body.name,
        level: body.level,
        isManagerial: body.isManagerial ?? false,
        isFieldBased: body.isFieldBased ?? false,
        isCrewRole: body.isCrewRole ?? false,
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
 * PATCH /v1/roles/:roleTypeId
 * Update a role type.
 */
rolesRouter.patch("/:roleTypeId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const roleTypeId = c.req.param("roleTypeId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(roleTypes)
      .where(eq(roleTypes.id, roleTypeId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Role type not found",
            details: { roleTypeId },
          },
        },
        404
      );
    }

    let body: {
      code?: string;
      name?: string;
      level?: string;
      isManagerial?: boolean;
      isFieldBased?: boolean;
      isCrewRole?: boolean;
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

    // Validate code format if changing
    if (body.code && !/^[A-Z][A-Z0-9_]*$/.test(body.code)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Role code must be SCREAMING_SNAKE_CASE (e.g., SITE_MANAGER)",
            details: { code: body.code },
          },
        },
        400
      );
    }

    // Check for duplicate code if changing
    if (body.code && body.code !== existing.code) {
      const [existingCode] = await db
        .select({ id: roleTypes.id })
        .from(roleTypes)
        .where(eq(roleTypes.code, body.code));

      if (existingCode) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Role type code already exists",
              details: { code: body.code },
            },
          },
          409
        );
      }
    }

    await db
      .update(roleTypes)
      .set({
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        level: body.level ?? existing.level,
        isManagerial: body.isManagerial !== undefined ? (body.isManagerial ? 1 : 0) : existing.isManagerial,
        isFieldBased: body.isFieldBased !== undefined ? (body.isFieldBased ? 1 : 0) : existing.isFieldBased,
        isCrewRole: body.isCrewRole !== undefined ? (body.isCrewRole ? 1 : 0) : existing.isCrewRole,
        isActive: body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      })
      .where(eq(roleTypes.id, roleTypeId));

    opsLog("info", "role_type.updated", { roleTypeId });

    return c.json({
      id: roleTypeId,
      code: body.code ?? existing.code,
      name: body.name ?? existing.name,
      level: body.level ?? existing.level,
      isManagerial: body.isManagerial !== undefined ? body.isManagerial : existing.isManagerial === 1,
      isFieldBased: body.isFieldBased !== undefined ? body.isFieldBased : existing.isFieldBased === 1,
      isCrewRole: body.isCrewRole !== undefined ? body.isCrewRole : existing.isCrewRole === 1,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive === 1,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { rolesRouter };
