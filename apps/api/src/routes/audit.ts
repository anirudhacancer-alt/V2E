/**
 * Audit Events Router - Phase H
 *
 * Read-only endpoints for audit trail queries.
 * Aligns with NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md §12.23
 */

import { and, eq, gte, lte, desc, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { auditEvents } from "@v2e/database";

import { getDemoDb } from "../db.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { opsLog } from "../lib/logger.js";

const auditRouter = new Hono();

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Helper: Check if DB is ready
 */
function dbNotReady(c: Context) {
  return c.json(
    {
      error: {
        code: "DB_NOT_FOUND",
        message:
          "Demo SQLite file is missing. Seed it from the repo root: pnpm --filter @v2e/database db:seed",
        details: { path: resolveSqlitePath() },
      },
    },
    503
  );
}

/**
 * GET /v1/audit
 * List audit events with optional filters.
 * Filters: entityType, entityId, projectId, siteId, actor, eventType, from, to
 */
auditRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  // Parse query parameters
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  const projectId = c.req.query("projectId");
  const siteId = c.req.query("siteId");
  const actor = c.req.query("actor");
  const eventType = c.req.query("eventType");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(c.req.query("pageSize") || String(DEFAULT_PAGE_SIZE), 10))
  );

  try {
    // Build filter conditions (Drizzle SQL fragments)
    const conditions: SQL[] = [];

    if (entityType) {
      conditions.push(eq(auditEvents.entityType, entityType));
    }
    if (entityId) {
      conditions.push(eq(auditEvents.entityId, entityId));
    }
    if (projectId) {
      conditions.push(eq(auditEvents.projectId, projectId));
    }
    if (siteId) {
      conditions.push(eq(auditEvents.siteId, siteId));
    }
    if (actor) {
      conditions.push(eq(auditEvents.actor, actor));
    }
    if (eventType) {
      conditions.push(eq(auditEvents.eventType, eventType));
    }
    if (from) {
      conditions.push(gte(auditEvents.occurredAt, from));
    }
    if (to) {
      conditions.push(lte(auditEvents.occurredAt, to));
    }

    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalResult] = await db
      .select({ n: count() })
      .from(auditEvents)
      .where(whereClause);
    const total = totalResult?.n ?? 0;

    // Get paginated results
    const offset = (page - 1) * pageSize;
    const events = await db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        eventType: auditEvents.eventType,
        projectId: auditEvents.projectId,
        siteId: auditEvents.siteId,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        actor: auditEvents.actor,
        payload: auditEvents.payload,
      })
      .from(auditEvents)
      .where(whereClause)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(pageSize)
      .offset(offset);

    // Parse payload JSON for response
    const items = events.map((event) => ({
      ...event,
      payload: JSON.parse(event.payload),
    }));

    return c.json({
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    opsLog("error", "audit_events.list_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
});

/**
 * GET /v1/audit/:auditEventId
 * Get a single audit event by ID.
 */
auditRouter.get("/:auditEventId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const auditEventId = c.req.param("auditEventId");
  const db = getDemoDb();

  try {
    const [event] = await db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        eventType: auditEvents.eventType,
        projectId: auditEvents.projectId,
        siteId: auditEvents.siteId,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        actor: auditEvents.actor,
        payload: auditEvents.payload,
      })
      .from(auditEvents)
      .where(eq(auditEvents.id, auditEventId));

    if (!event) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Audit event not found",
            details: { auditEventId },
          },
        },
        404
      );
    }

    return c.json({
      ...event,
      payload: JSON.parse(event.payload),
    });
  } catch (e) {
    opsLog("error", "audit_events.get_failed", {
      auditEventId,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
});

export { auditRouter };
