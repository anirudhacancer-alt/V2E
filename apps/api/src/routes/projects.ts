import {
  eq,
  count,
  and,
  inArray,
  ne,
  asc,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  projects,
  sites,
  tasks,
  teamMembers,
  roleTypes,
  users,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@v2e/contracts";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";

const projectsRouter = new Hono();

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

/** Canonical `role_types.code` for execution lead / site supervisor (see `org-canonical.ts`). */
const SITE_SUPERVISOR_ROLE_CODE = "SITE_SUPERVISOR";

// GET /v1/projects — project catalog for shell / project picker (must be registered before `/:projectId/*`)
// Filters: siteId, isActive, type, status
projectsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  // Parse query filters
  const siteIdFilter = c.req.query("siteId");
  const isActiveFilter = c.req.query("isActive");
  const typeFilter = c.req.query("type");
  const statusFilter = c.req.query("status");

  try {
    // Build filter conditions
    const conditions: ReturnType<typeof eq>[] = [];
    if (siteIdFilter) {
      conditions.push(eq(projects.siteId, siteIdFilter));
    }
    if (isActiveFilter !== undefined) {
      const activeVal = isActiveFilter === "true" ? "true" : "false";
      conditions.push(eq(projects.isActive, activeVal));
    }
    if (typeFilter) {
      conditions.push(eq(projects.type, typeFilter));
    }
    if (statusFilter) {
      conditions.push(eq(projects.status, statusFilter));
    }

    const baseQuery = db
      .select({
        project: projects,
        siteName: sites.name,
        siteId: sites.id,
        projectManagerId: sites.projectManagerId,
      })
      .from(projects)
      .innerJoin(sites, eq(projects.siteId, sites.id));

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(asc(projects.code))
      : await baseQuery.orderBy(asc(projects.code));

    const projectIds = rows.map((r) => r.project.id);
    if (projectIds.length === 0) {
      return c.json({ items: [] });
    }

    const taskCountRows = await db
      .select({
        projectId: tasks.projectId,
        n: count(),
      })
      .from(tasks)
      .where(inArray(tasks.projectId, projectIds))
      .groupBy(tasks.projectId);

    const openTaskCountRows = await db
      .select({
        projectId: tasks.projectId,
        n: count(),
      })
      .from(tasks)
      .where(and(inArray(tasks.projectId, projectIds), ne(tasks.status, "Done")))
      .groupBy(tasks.projectId);

    const taskCountByProject = new Map(taskCountRows.map((r) => [r.projectId, r.n]));
    const openTaskCountByProject = new Map(openTaskCountRows.map((r) => [r.projectId, r.n]));

    const siteIds = [...new Set(rows.map((r) => r.siteId))];

    const supervisorRows = await db
      .select({
        siteId: teamMembers.siteId,
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        roleLabel: roleTypes.name,
      })
      .from(teamMembers)
      .innerJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
      .where(
        and(
          inArray(teamMembers.siteId, siteIds),
          eq(teamMembers.orgRoleCode, SITE_SUPERVISOR_ROLE_CODE),
        ),
      );

    const supervisorsBySite = new Map<
      string,
      { id: string; name: string; email: string | null; roleLabel: string }
    >();
    const sortedSupervisors = [...supervisorRows].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const s of sortedSupervisors) {
      if (!supervisorsBySite.has(s.siteId)) {
        supervisorsBySite.set(s.siteId, {
          id: s.id,
          name: s.name,
          email: s.email,
          roleLabel: s.roleLabel,
        });
      }
    }

    const pmIds = [...new Set(rows.map((r) => r.projectManagerId))];
    const pmRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        roleLabel: roleTypes.name,
      })
      .from(users)
      .innerJoin(roleTypes, eq(users.orgRoleCode, roleTypes.code))
      .where(inArray(users.id, pmIds));

    const pmById = new Map(
      pmRows.map((r) => [
        r.id,
        { id: r.id, name: r.name, email: r.email, roleLabel: r.roleLabel },
      ]),
    );

    const items = rows.map((r) => {
      const p = r.project;
      const sup = supervisorsBySite.get(r.siteId);
      const pm = pmById.get(r.projectManagerId);
      return {
        id: p.id,
        siteId: p.siteId,
        code: p.code,
        name: p.name,
        type: p.type,
        status: p.status,
        siteName: r.siteName,
        siteSupervisorId: sup?.id ?? null,
        siteSupervisorName: sup?.name ?? null,
        siteSupervisorEmail: sup?.email ?? null,
        siteSupervisorRole: sup?.roleLabel ?? null,
        siteManagerId: pm?.id ?? null,
        siteManagerName: pm?.name ?? null,
        siteManagerEmail: pm?.email ?? null,
        siteManagerRole: pm?.roleLabel ?? null,
        isActive: p.isActive === "true",
        taskCount: taskCountByProject.get(p.id) ?? 0,
        openTaskCount: openTaskCountByProject.get(p.id) ?? 0,
      };
    });

    return c.json({ items });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

function parseProjectMetadata(raw: string): Record<string, unknown> {
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function projectEntityJson(p: {
  id: string;
  siteId: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  isActive: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: p.id,
    siteId: p.siteId,
    code: p.code,
    name: p.name,
    description: p.description,
    type: p.type,
    status: p.status,
    isActive: p.isActive === "true",
    metadata: parseProjectMetadata(p.metadata),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** POST /v1/projects — create project (flat REST). */
projectsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  let raw: unknown;
  try {
    raw = await c.req.json();
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

  const parsed = CreateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project payload",
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const data = parsed.data;

  try {
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, data.siteId));
    if (!site) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "siteId not found",
            details: { siteId: data.siteId },
          },
        },
        400
      );
    }

    const [dup] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.siteId, data.siteId), eq(projects.code, data.code)));

    if (dup) {
      return c.json(
        {
          error: {
            code: "CONFLICT",
            message: "A project with this code already exists for this site",
            details: { siteId: data.siteId, code: data.code },
          },
        },
        409
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const type = data.type ?? "other";
    const status = data.status ?? "active";
    const isActiveStr = data.isActive ? "true" : "false";
    const metadataStr = JSON.stringify(data.metadata ?? {});

    await db.insert(projects).values({
      id,
      siteId: data.siteId,
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      type,
      status,
      isActive: isActiveStr,
      metadata: metadataStr,
      createdAt: now,
      updatedAt: now,
    });

    opsLog("info", "project.created", { projectId: id, code: data.code });

    await insertAuditEvent(db, {
      eventType: "project.created",
      projectId: id,
      entityType: "project",
      entityId: id,
      payload: { code: data.code, siteId: data.siteId, name: data.name },
    });

    return c.json(
      projectEntityJson({
        id,
        siteId: data.siteId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        type,
        status,
        isActive: isActiveStr,
        metadata: metadataStr,
        createdAt: now,
        updatedAt: now,
      }),
      201
    );
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/** GET /v1/projects/:projectId — single project row (canonical fields). */
projectsRouter.get("/:projectId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.param("projectId");
  const db = getDemoDb();

  try {
    const [row] = await db.select().from(projects).where(eq(projects.id, projectId));

    if (!row) {
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

    return c.json(projectEntityJson(row));
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/** PATCH /v1/projects/:projectId — update project. */
projectsRouter.patch("/:projectId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.param("projectId");
  const db = getDemoDb();

  let raw: unknown;
  try {
    raw = await c.req.json();
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

  const parsed = UpdateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project update payload",
          details: parsed.error.flatten(),
        },
      },
      400
    );
  }

  const body = parsed.data;
  if (Object.keys(body).length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "At least one field is required",
        },
      },
      400
    );
  }

  try {
    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));

    if (!existing) {
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

    if (body.siteId && body.siteId !== existing.siteId) {
      const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, body.siteId));
      if (!site) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "siteId not found",
              details: { siteId: body.siteId },
            },
          },
          400
        );
      }
    }

    const nextSiteId = body.siteId ?? existing.siteId;
    const nextCode = body.code ?? existing.code;
    if (body.code !== undefined || body.siteId !== undefined) {
      const [dup] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.siteId, nextSiteId), eq(projects.code, nextCode)));

      if (dup && dup.id !== projectId) {
        return c.json(
          {
            error: {
              code: "CONFLICT",
              message: "A project with this code already exists for this site",
              details: { siteId: nextSiteId, code: nextCode },
            },
          },
          409
        );
      }
    }

    const now = new Date().toISOString();
    const nextDescription =
      body.description !== undefined ? body.description : existing.description;
    const nextType = body.type ?? existing.type;
    const nextStatus = body.status ?? existing.status;
    const nextIsActive =
      body.isActive !== undefined ? (body.isActive ? "true" : "false") : existing.isActive;
    const nextMetadata =
      body.metadata !== undefined ? JSON.stringify(body.metadata) : existing.metadata;

    await db
      .update(projects)
      .set({
        siteId: nextSiteId,
        code: nextCode,
        name: body.name ?? existing.name,
        description: nextDescription,
        type: nextType,
        status: nextStatus,
        isActive: nextIsActive,
        metadata: nextMetadata,
        updatedAt: now,
      })
      .where(eq(projects.id, projectId));

    opsLog("info", "project.updated", { projectId });

    await insertAuditEvent(db, {
      eventType: "project.updated",
      projectId,
      entityType: "project",
      entityId: projectId,
      payload: body as Record<string, unknown>,
    });

    const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    return c.json(projectEntityJson(row));
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

/** DELETE /v1/projects/:projectId — soft-delete (deactivate + cancelled). */
projectsRouter.delete("/:projectId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = c.req.param("projectId");
  const db = getDemoDb();

  try {
    const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));

    if (!existing) {
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

    const now = new Date().toISOString();

    await db
      .update(projects)
      .set({
        isActive: "false",
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(projects.id, projectId));

    opsLog("info", "project.deleted", { projectId });

    await insertAuditEvent(db, {
      eventType: "project.deleted",
      projectId,
      entityType: "project",
      entityId: projectId,
      payload: { soft: true },
    });

    const [row] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
    }

    return c.json(projectEntityJson(row));
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
});

export { projectsRouter };
