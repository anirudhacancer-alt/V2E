/**
 * Sites Routes (§12.5)
 *
 * CRUD routes for sites management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import { sites, users } from "@v2e/database";

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

const sitesRouter = new Hono();

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
// Sites Routes
// ============================================================================

/**
 * GET /v1/sites
 * List all sites with optional filters.
 * Filters: isActive
 */
sitesRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const isActiveFilter = c.req.query("isActive");

  try {
    const conditions = [];
    if (isActiveFilter !== undefined) {
      conditions.push(eq(sites.isActive, isActiveFilter));
    }

    const results = conditions.length > 0
      ? await db.select().from(sites).where(and(...conditions))
      : await db.select().from(sites);

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
 * GET /v1/sites/:siteId
 * Get a single site by ID.
 */
sitesRouter.get("/:siteId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const siteId = c.req.param("siteId");
  const db = getDemoDb();

  try {
    const [site] = await db
      .select()
      .from(sites)
      .where(eq(sites.id, siteId));

    if (!site) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Site not found",
            details: { siteId },
          },
        },
        404
      );
    }

    return c.json(site);
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/sites
 * Create a new site.
 */
sitesRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      name: string;
      code: string;
      address: string;
      locationLatitude?: string;
      locationLongitude?: string;
      projectManagerId: string;
      isActive?: string;
      metadata?: string;
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
    const requiredFields = ["name", "code", "address", "projectManagerId"] as const;
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

    // Validate projectManagerId exists in users
    const [manager] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.projectManagerId));

    if (!manager) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectManagerId not found in users",
            details: { projectManagerId: body.projectManagerId },
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const siteId = randomUUID();

    await db.insert(sites).values({
      id: siteId,
      name: body.name,
      code: body.code,
      address: body.address,
      locationLatitude: body.locationLatitude ?? null,
      locationLongitude: body.locationLongitude ?? null,
      projectManagerId: body.projectManagerId,
      isActive: body.isActive ?? "true",
      metadata: body.metadata ?? "{}",
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "site.created", { siteId, code: body.code });

    await insertAuditEvent(db, {
      eventType: "site.created",
      projectId: null,
      entityType: "site",
      entityId: siteId,
      payload: { name: body.name, code: body.code },
    });

    return c.json(
      {
        id: siteId,
        name: body.name,
        code: body.code,
        address: body.address,
        locationLatitude: body.locationLatitude ?? null,
        locationLongitude: body.locationLongitude ?? null,
        projectManagerId: body.projectManagerId,
        isActive: body.isActive ?? "true",
        metadata: body.metadata ?? "{}",
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
 * PATCH /v1/sites/:siteId
 * Update a site.
 */
sitesRouter.patch("/:siteId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const siteId = c.req.param("siteId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(sites)
      .where(eq(sites.id, siteId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Site not found",
            details: { siteId },
          },
        },
        404
      );
    }

    let body: {
      name?: string;
      code?: string;
      address?: string;
      locationLatitude?: string | null;
      locationLongitude?: string | null;
      projectManagerId?: string;
      isActive?: string;
      metadata?: string;
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

    // Validate projectManagerId if provided
    if (body.projectManagerId) {
      const [manager] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, body.projectManagerId));

      if (!manager) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "projectManagerId not found in users",
              details: { projectManagerId: body.projectManagerId },
            },
          },
          400
        );
      }
    }

    const now = new Date().toISOString();

    await db
      .update(sites)
      .set({
        name: body.name ?? existing.name,
        code: body.code ?? existing.code,
        address: body.address ?? existing.address,
        locationLatitude: body.locationLatitude !== undefined ? body.locationLatitude : existing.locationLatitude,
        locationLongitude: body.locationLongitude !== undefined ? body.locationLongitude : existing.locationLongitude,
        projectManagerId: body.projectManagerId ?? existing.projectManagerId,
        isActive: body.isActive ?? existing.isActive,
        metadata: body.metadata ?? existing.metadata,
        updatedAt: now,
      })
      .where(eq(sites.id, siteId));

    opsLog("info", "site.updated", { siteId });

    return c.json({
      id: siteId,
      name: body.name ?? existing.name,
      code: body.code ?? existing.code,
      address: body.address ?? existing.address,
      locationLatitude: body.locationLatitude !== undefined ? body.locationLatitude : existing.locationLatitude,
      locationLongitude: body.locationLongitude !== undefined ? body.locationLongitude : existing.locationLongitude,
      projectManagerId: body.projectManagerId ?? existing.projectManagerId,
      isActive: body.isActive ?? existing.isActive,
      metadata: body.metadata ?? existing.metadata,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { sitesRouter };
