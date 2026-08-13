/**
 * Team Members Routes (§12.7)
 *
 * CRUD routes for team members management.
 */

import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  teamMembers,
  sites,
  projects,
  roleTypes,
  departments,
  users,
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

const membersRouter = new Hono();

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

/** Same integrity check as `projects.ts` team-member lists (orgRoleCode must resolve). */
async function assertNoUnresolvedMemberRoles(
  db: ReturnType<typeof getDemoDb>,
  siteId: string,
  context: Record<string, unknown>
) {
  const bad = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .leftJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
    .where(and(eq(teamMembers.siteId, siteId), isNull(roleTypes.code)));
  if (bad.length > 0) {
    throw new DataIntegrityError(
      "team_members.orgRoleCode not present in role_types",
      { ...context, siteId, teamMemberIds: bad.map((b) => b.id) }
    );
  }
}

// ============================================================================
// Team Members Routes
// ============================================================================

/**
 * GET /v1/members
 * List all team members with optional filters.
 * Filters: siteId, projectId, userId, departmentCode, orgRoleCode, isActive
 *
 * When **`projectId`** is set: resolves the project’s site, returns **`items`** with
 * `roleTypeName` (same shape as the legacy `GET /v1/projects/:projectId/members` read model).
 * Other filters apply in addition. Unknown `projectId` → **404**.
 */
membersRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const siteIdFilter = c.req.query("siteId");
  const projectIdFilter = c.req.query("projectId");
  const userIdFilter = c.req.query("userId");
  const departmentCodeFilter = c.req.query("departmentCode");
  const orgRoleCodeFilter = c.req.query("orgRoleCode");
  const isActiveFilter = c.req.query("isActive");

  try {
    // If projectId is provided, align with projects-router team list (join role types, `items` payload).
    if (projectIdFilter) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectIdFilter));

      if (!project) {
        return c.json(
          { error: { code: "NOT_FOUND", message: "Project not found" } },
          404
        );
      }

      if (siteIdFilter && siteIdFilter !== project.siteId) {
        return c.json({ items: [], total: 0 });
      }

      await assertNoUnresolvedMemberRoles(db, project.siteId, {
        projectId: projectIdFilter,
      });

      const rows = await db
        .select({
            id: teamMembers.id,
            name: teamMembers.name,
            userId: teamMembers.userId,
            orgRoleCode: teamMembers.orgRoleCode,
            roleTypeName: roleTypes.name,
          email: teamMembers.email,
          isActive: teamMembers.isActive,
          departmentCode: teamMembers.departmentCode,
        })
        .from(teamMembers)
        .innerJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
        .where(eq(teamMembers.siteId, project.siteId));

      let filtered = rows;
      if (departmentCodeFilter) {
        filtered = filtered.filter(
          (m) => m.departmentCode === departmentCodeFilter
        );
      }
      if (userIdFilter) {
        filtered = filtered.filter((m) => m.userId === userIdFilter);
      }
      if (orgRoleCodeFilter) {
        filtered = filtered.filter((m) => m.orgRoleCode === orgRoleCodeFilter);
      }
      if (isActiveFilter !== undefined) {
        filtered = filtered.filter((m) => m.isActive === isActiveFilter);
      }

      const items = filtered.map((m) => ({
        id: m.id,
        name: m.name,
        userId: m.userId ?? null,
        orgRoleCode: m.orgRoleCode,
        roleTypeName: m.roleTypeName,
        email: m.email,
        isActive: m.isActive === "true",
      }));

      return c.json({ items, total: items.length });
    }

    // Standard filtering without projectId
    const conditions = [];
    if (siteIdFilter) {
      conditions.push(eq(teamMembers.siteId, siteIdFilter));
    }
    if (userIdFilter) {
      conditions.push(eq(teamMembers.userId, userIdFilter));
    }
    if (departmentCodeFilter) {
      conditions.push(eq(teamMembers.departmentCode, departmentCodeFilter));
    }
    if (orgRoleCodeFilter) {
      conditions.push(eq(teamMembers.orgRoleCode, orgRoleCodeFilter));
    }
    if (isActiveFilter !== undefined) {
      conditions.push(eq(teamMembers.isActive, isActiveFilter));
    }

    const results = conditions.length > 0
      ? await db.select().from(teamMembers).where(and(...conditions))
      : await db.select().from(teamMembers);

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
 * GET /v1/members/:teamMemberId
 * Get a single team member by ID.
 */
membersRouter.get("/:teamMemberId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const teamMemberId = c.req.param("teamMemberId");
  const db = getDemoDb();

  try {
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId));

    if (!member) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Team member not found",
            details: { teamMemberId },
          },
        },
        404
      );
    }

    return c.json(member);
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * POST /v1/members
 * Create a new team member.
 */
membersRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    let body: {
      siteId: string;
      name: string;
      userId?: string | null;
      orgRoleCode: string;
      departmentCode?: string;
      specialty?: string;
      reportsToUserId?: string;
      email?: string;
      phone?: string;
      isActive?: string;
      joinedAt: string;
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
    const requiredFields = ["siteId", "name", "orgRoleCode", "joinedAt"] as const;
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

    // Validate siteId exists
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.id, body.siteId));

    if (!site) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "siteId not found in sites",
            details: { siteId: body.siteId },
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

    if (body.userId) {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, body.userId));

      if (!userRow) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "userId not found in users",
              details: { userId: body.userId },
            },
          },
          400
        );
      }
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
    const teamMemberId = randomUUID();

    await db.insert(teamMembers).values({
      id: teamMemberId,
      siteId: body.siteId,
      userId: body.userId ?? null,
      name: body.name,
      orgRoleCode: body.orgRoleCode,
      departmentCode: body.departmentCode ?? null,
      specialty: body.specialty ?? "",
      reportsToUserId: body.reportsToUserId ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      isActive: body.isActive ?? "true",
      joinedAt: body.joinedAt,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "team_member.created", { teamMemberId, siteId: body.siteId });

    await insertAuditEvent(db, {
      eventType: "team_member.created",
      projectId: null,
      siteId: body.siteId,
      entityType: "team_member",
      entityId: teamMemberId,
      payload: { siteId: body.siteId, name: body.name, orgRoleCode: body.orgRoleCode },
    });

    return c.json(
      {
        id: teamMemberId,
        siteId: body.siteId,
        userId: body.userId ?? null,
        name: body.name,
        orgRoleCode: body.orgRoleCode,
        departmentCode: body.departmentCode ?? null,
        specialty: body.specialty ?? "",
        reportsToUserId: body.reportsToUserId ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        isActive: body.isActive ?? "true",
        joinedAt: body.joinedAt,
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
 * PATCH /v1/members/:teamMemberId
 * Update a team member.
 */
membersRouter.patch("/:teamMemberId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const teamMemberId = c.req.param("teamMemberId");
  const db = getDemoDb();

  try {
    const [existing] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Team member not found",
            details: { teamMemberId },
          },
        },
        404
      );
    }

    let body: {
      name?: string;
      userId?: string | null;
      orgRoleCode?: string;
      departmentCode?: string | null;
      specialty?: string;
      reportsToUserId?: string | null;
      email?: string | null;
      phone?: string | null;
      isActive?: string;
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

    if (body.userId !== undefined && body.userId !== null) {
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, body.userId));

      if (!userRow) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "userId not found in users",
              details: { userId: body.userId },
            },
          },
          400
        );
      }
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
      .update(teamMembers)
      .set({
        name: body.name ?? existing.name,
        userId: body.userId !== undefined ? body.userId : existing.userId,
        orgRoleCode: body.orgRoleCode ?? existing.orgRoleCode,
        departmentCode: body.departmentCode !== undefined ? body.departmentCode : existing.departmentCode,
        specialty: body.specialty ?? existing.specialty,
        reportsToUserId: body.reportsToUserId !== undefined ? body.reportsToUserId : existing.reportsToUserId,
        email: body.email !== undefined ? body.email : existing.email,
        phone: body.phone !== undefined ? body.phone : existing.phone,
        isActive: body.isActive ?? existing.isActive,
        updatedAt: now,
      })
      .where(eq(teamMembers.id, teamMemberId));

    opsLog("info", "team_member.updated", { teamMemberId });

    return c.json({
      id: teamMemberId,
      siteId: existing.siteId,
      userId: body.userId !== undefined ? body.userId : existing.userId,
      name: body.name ?? existing.name,
      orgRoleCode: body.orgRoleCode ?? existing.orgRoleCode,
      departmentCode: body.departmentCode !== undefined ? body.departmentCode : existing.departmentCode,
      specialty: body.specialty ?? existing.specialty,
      reportsToUserId: body.reportsToUserId !== undefined ? body.reportsToUserId : existing.reportsToUserId,
      email: body.email !== undefined ? body.email : existing.email,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      isActive: body.isActive ?? existing.isActive,
      joinedAt: existing.joinedAt,
      createdAt: existing.createdAt,
      updatedAt: now,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

export { membersRouter };
