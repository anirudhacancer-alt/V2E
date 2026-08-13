/**
 * Locations Routes (§12.5)
 *
 * CRUD routes for locations management.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import { locations, projects } from "@v2e/database";

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

const locationsRouter = new Hono();

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
// Locations Routes
// ============================================================================

/**
 * GET /v1/locations
 * List all locations with required projectId filter.
 * Filters: projectId (required), isActive
 */
locationsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const projectId = c.req.query("projectId");
  const isActiveFilter = c.req.query("isActive");

  // projectId is required for locations
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId query parameter is required",
          details: {},
        },
      },
      400
    );
  }

  try {
    const conditions = [eq(locations.projectId, projectId)];
    if (isActiveFilter !== undefined) {
      const isActive = isActiveFilter === "true" ? 1 : 0;
      conditions.push(eq(locations.isActive, isActive));
    }

    const results = await db
      .select()
      .from(locations)
      .where(and(...conditions));

    // Convert integer booleans to actual booleans for response
    const data = results.map((loc) => ({
      ...loc,
      isActive: loc.isActive === 1,
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
 * GET /v1/locations/:locationId
 * Get a single location by ID.
 */
locationsRouter.get("/:locationId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const locationId = c.req.param("locationId");
  const db = getDemoDb();

  try {
    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));

    if (!location) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Location not found",
            details: { locationId },
          },
        },
        404
      );
    }

    return c.json({
      ...location,
      isActive: location.isActive === 1,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/locations
 * Create a new location.
 */
locationsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      projectId: string;
      siteType: string;
      level1: string;
      level2?: string;
      level3?: string;
      level4?: string;
      displayLabel?: string;
      listLabel?: string;
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
    const requiredFields = ["projectId", "siteType", "level1", "sortOrder"] as const;
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

    // Validate projectId exists
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, body.projectId));

    if (!project) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "projectId not found in projects",
            details: { projectId: body.projectId },
          },
        },
        400
      );
    }

    const locationId = randomUUID();

    // Generate displayLabel and listLabel if not provided
    const displayLabel = body.displayLabel || [body.level1, body.level2, body.level3, body.level4].filter(Boolean).join(" > ");
    const listLabel = body.listLabel || [body.level1, body.level2, body.level3, body.level4].filter(Boolean).join(" · ");

    await db.insert(locations).values({
      id: locationId,
      projectId: body.projectId,
      siteType: body.siteType,
      level1: body.level1,
      level2: body.level2 ?? null,
      level3: body.level3 ?? null,
      level4: body.level4 ?? null,
      displayLabel,
      listLabel,
      isActive: body.isActive !== false ? 1 : 0,
      sortOrder: body.sortOrder,
    });

    opsLog("info", "location.created", { locationId, projectId: body.projectId });

    await insertAuditEvent(db, {
      eventType: "location.created",
      projectId: body.projectId,
      entityType: "location",
      entityId: locationId,
      payload: { level1: body.level1, siteType: body.siteType },
    });

    return c.json(
      {
        id: locationId,
        projectId: body.projectId,
        siteType: body.siteType,
        level1: body.level1,
        level2: body.level2 ?? null,
        level3: body.level3 ?? null,
        level4: body.level4 ?? null,
        displayLabel,
        listLabel,
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
 * PATCH /v1/locations/:locationId
 * Update a location.
 */
locationsRouter.patch("/:locationId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const locationId = c.req.param("locationId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Location not found",
            details: { locationId },
          },
        },
        404
      );
    }

    let body: {
      siteType?: string;
      level1?: string;
      level2?: string | null;
      level3?: string | null;
      level4?: string | null;
      displayLabel?: string;
      listLabel?: string;
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

    await db
      .update(locations)
      .set({
        siteType: body.siteType ?? existing.siteType,
        level1: body.level1 ?? existing.level1,
        level2: body.level2 !== undefined ? body.level2 : existing.level2,
        level3: body.level3 !== undefined ? body.level3 : existing.level3,
        level4: body.level4 !== undefined ? body.level4 : existing.level4,
        displayLabel: body.displayLabel ?? existing.displayLabel,
        listLabel: body.listLabel ?? existing.listLabel,
        isActive: body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      })
      .where(eq(locations.id, locationId));

    opsLog("info", "location.updated", { locationId });

    return c.json({
      id: locationId,
      projectId: existing.projectId,
      siteType: body.siteType ?? existing.siteType,
      level1: body.level1 ?? existing.level1,
      level2: body.level2 !== undefined ? body.level2 : existing.level2,
      level3: body.level3 !== undefined ? body.level3 : existing.level3,
      level4: body.level4 !== undefined ? body.level4 : existing.level4,
      displayLabel: body.displayLabel ?? existing.displayLabel,
      listLabel: body.listLabel ?? existing.listLabel,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive === 1,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { locationsRouter };
