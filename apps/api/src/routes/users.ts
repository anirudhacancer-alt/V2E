/**
 * Users Routes (§12.2)
 *
 * CRUD routes for users management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  users,
  departments,
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

// ============================================================================
// Router Setup
// ============================================================================

const usersRouter = new Hono();

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
// Users Routes
// ============================================================================

/**
 * GET /v1/users
 * List all users with optional filters.
 * Filters: departmentCode, orgRoleCode, isActive
 */
usersRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const departmentCode = c.req.query("departmentCode");
  const orgRoleCode = c.req.query("orgRoleCode");

  try {
    const conditions = [];
    if (departmentCode) {
      conditions.push(eq(users.departmentCode, departmentCode));
    }
    if (orgRoleCode) {
      conditions.push(eq(users.orgRoleCode, orgRoleCode));
    }

    const results = conditions.length > 0
      ? await db.select().from(users).where(and(...conditions))
      : await db.select().from(users);

    return c.json({
      data: results,
      total: results.length,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * GET /v1/users/:userId
 * Get a single user by ID.
 */
usersRouter.get("/:userId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const userId = c.req.param("userId");
  const db = getDemoDb();

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            details: { userId },
          },
        },
        404
      );
    }

    return c.json(user);
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/users
 * Create a new user.
 */
usersRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      email: string;
      name: string;
      orgRoleCode: string;
      departmentCode?: string;
      specialty?: string;
      phone: string;
      employeeId: string;
      avatarUrl?: string;
      preferencesPushNotificationsEnabled?: string;
      preferencesDarkModeEnabled?: string;
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
    const requiredFields = ["email", "name", "orgRoleCode", "phone", "employeeId"] as const;
    const missingFields = requiredFields.filter((f) => !body[f as keyof typeof body]);

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

    // Validate orgRoleCode exists
    const [roleRow] = await db
      .select({ code: roleTypes.code })
      .from(roleTypes)
      .where(eq(roleTypes.code, body.orgRoleCode));

    if (!roleRow) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "orgRoleCode not found in role_types",
            details: { orgRoleCode: body.orgRoleCode },
          },
        },
        400
      );
    }

    // Validate departmentCode if provided
    if (body.departmentCode) {
      const [deptRow] = await db
        .select({ code: departments.code })
        .from(departments)
        .where(eq(departments.code, body.departmentCode));

      if (!deptRow) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "departmentCode not found in departments",
              details: { departmentCode: body.departmentCode },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();
    const userId = randomUUID();

    await db.insert(users).values({
      id: userId,
      email: body.email,
      name: body.name,
      orgRoleCode: body.orgRoleCode,
      departmentCode: body.departmentCode ?? null,
      specialty: body.specialty ?? "",
      phone: body.phone,
      employeeId: body.employeeId,
      avatarUrl: body.avatarUrl ?? null,
      preferencesPushNotificationsEnabled: body.preferencesPushNotificationsEnabled ?? "false",
      preferencesDarkModeEnabled: body.preferencesDarkModeEnabled ?? "false",
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "user.created", { userId, email: body.email });

    await insertAuditEvent(db, {
      eventType: "user.created",
      projectId: null,
      entityType: "user",
      entityId: userId,
      payload: { email: body.email, name: body.name, orgRoleCode: body.orgRoleCode },
    });

    return c.json(
      {
        id: userId,
        email: body.email,
        name: body.name,
        orgRoleCode: body.orgRoleCode,
        departmentCode: body.departmentCode ?? null,
        specialty: body.specialty ?? "",
        phone: body.phone,
        employeeId: body.employeeId,
        avatarUrl: body.avatarUrl ?? null,
        preferencesPushNotificationsEnabled: body.preferencesPushNotificationsEnabled ?? "false",
        preferencesDarkModeEnabled: body.preferencesDarkModeEnabled ?? "false",
        createdAt: now,
        updatedAt: now,
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
 * PATCH /v1/users/:userId
 * Update a user.
 */
usersRouter.patch("/:userId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const userId = c.req.param("userId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
            details: { userId },
          },
        },
        404
      );
    }

    let body: {
      email?: string;
      name?: string;
      orgRoleCode?: string;
      departmentCode?: string | null;
      specialty?: string;
      phone?: string;
      employeeId?: string;
      avatarUrl?: string | null;
      preferencesPushNotificationsEnabled?: string;
      preferencesDarkModeEnabled?: string;
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

    // Validate orgRoleCode if provided
    if (body.orgRoleCode) {
      const [roleRow] = await db
        .select({ code: roleTypes.code })
        .from(roleTypes)
        .where(eq(roleTypes.code, body.orgRoleCode));

      if (!roleRow) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "orgRoleCode not found in role_types",
              details: { orgRoleCode: body.orgRoleCode },
            },
          },
          400
        );
      }
    }

    // Validate departmentCode if provided and not null
    if (body.departmentCode !== undefined && body.departmentCode !== null) {
      const [deptRow] = await db
        .select({ code: departments.code })
        .from(departments)
        .where(eq(departments.code, body.departmentCode));

      if (!deptRow) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "departmentCode not found in departments",
              details: { departmentCode: body.departmentCode },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();

    await db
      .update(users)
      .set({
        email: body.email ?? existing.email,
        name: body.name ?? existing.name,
        orgRoleCode: body.orgRoleCode ?? existing.orgRoleCode,
        departmentCode: body.departmentCode !== undefined ? body.departmentCode : existing.departmentCode,
        specialty: body.specialty ?? existing.specialty,
        phone: body.phone ?? existing.phone,
        employeeId: body.employeeId ?? existing.employeeId,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
        preferencesPushNotificationsEnabled: body.preferencesPushNotificationsEnabled ?? existing.preferencesPushNotificationsEnabled,
        preferencesDarkModeEnabled: body.preferencesDarkModeEnabled ?? existing.preferencesDarkModeEnabled,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    opsLog("info", "user.updated", { userId });

    return c.json({
      id: userId,
      email: body.email ?? existing.email,
      name: body.name ?? existing.name,
      orgRoleCode: body.orgRoleCode ?? existing.orgRoleCode,
      departmentCode: body.departmentCode !== undefined ? body.departmentCode : existing.departmentCode,
      specialty: body.specialty ?? existing.specialty,
      phone: body.phone ?? existing.phone,
      employeeId: body.employeeId ?? existing.employeeId,
      avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
      preferencesPushNotificationsEnabled: body.preferencesPushNotificationsEnabled ?? existing.preferencesPushNotificationsEnabled,
      preferencesDarkModeEnabled: body.preferencesDarkModeEnabled ?? existing.preferencesDarkModeEnabled,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { usersRouter };
