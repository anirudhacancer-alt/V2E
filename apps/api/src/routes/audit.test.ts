/**
 * Audit Events Router - Vitest Tests (Phase H)
 *
 * Tests for:
 * - GET /v1/audit (filtered list)
 * - GET /v1/audit/:auditEventId
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the database and env modules before importing routes
vi.mock("../db.js", () => ({
  getDemoDb: vi.fn(),
}));

vi.mock("../env.js", () => ({
  sqliteFileExists: vi.fn(),
  resolveSqlitePath: vi.fn(() => "/mock/path/demo.sqlite"),
}));

vi.mock("../lib/logger.js", () => ({
  opsLog: vi.fn(),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { auditRouter } from "./audit.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockAuditEvent = {
  id: "audit-1",
  occurredAt: "2026-03-27T10:00:00Z",
  eventType: "task.created",
  projectId: "project-1",
  siteId: "site-42",
  entityType: "task",
  entityId: "task-1",
  actor: "user-1",
  payload: JSON.stringify({ title: "Test Task", status: "open" }),
};

const mockAuditEvent2 = {
  id: "audit-2",
  occurredAt: "2026-03-27T11:00:00Z",
  eventType: "task.status_changed",
  projectId: "project-1",
  siteId: "site-42",
  entityType: "task",
  entityId: "task-1",
  actor: "user-1",
  payload: JSON.stringify({ previousStatus: "open", status: "in_progress" }),
};

/** Two-query list mock: count then rows (same pattern as existing tests). */
function mockListDb(rows: typeof mockAuditEvent[], total: number) {
  let callCount = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ n: total }]),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(rows),
              }),
            }),
          }),
        }),
      };
    }),
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

describe("Audit Events Routes (Phase H)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
    app = new Hono();
    app.route("/", auditRouter);
  });

  describe("GET /v1/audit", () => {
    it("should return paginated list of audit events", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First call: count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 2 }]),
              }),
            };
          }
          // Second call: data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([mockAuditEvent, mockAuditEvent2]),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toMatchObject({
        id: mockAuditEvent.id,
        eventType: mockAuditEvent.eventType,
        entityType: mockAuditEvent.entityType,
        entityId: mockAuditEvent.entityId,
        actor: mockAuditEvent.actor,
        projectId: mockAuditEvent.projectId,
        siteId: mockAuditEvent.siteId,
      });
      expect(body.data[0].payload).toEqual({ title: "Test Task", status: "open" });
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.total).toBe(2);
    });

    it("should filter by projectId", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 1 }]),
              }),
            };
          }
          // Data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([mockAuditEvent]),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/?projectId=project-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it("should filter by entityType", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 2 }]),
              }),
            };
          }
          // Data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([mockAuditEvent, mockAuditEvent2]),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/?entityType=task");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });

    it("should filter by actor", async () => {
      mockedGetDemoDb.mockReturnValue(mockListDb([mockAuditEvent], 1));

      const res = await app.request("/?actor=user-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].actor).toBe("user-1");
    });

    it("should filter by eventType", async () => {
      mockedGetDemoDb.mockReturnValue(mockListDb([mockAuditEvent], 1));

      const res = await app.request("/?eventType=task.created");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].eventType).toBe("task.created");
    });

    it("should filter by from and to (occurredAt range)", async () => {
      mockedGetDemoDb.mockReturnValue(mockListDb([mockAuditEvent2], 1));

      const res = await app.request(
        "/?from=2026-03-27T10:30:00Z&to=2026-03-27T12:00:00Z"
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("audit-2");
    });

    it("should filter by siteId", async () => {
      const withSite = {
        ...mockAuditEvent,
        siteId: "site-42",
        payload: JSON.stringify({ title: "Test", siteId: "site-42" }),
      };
      mockedGetDemoDb.mockReturnValue(mockListDb([withSite], 1));

      const res = await app.request("/?siteId=site-42");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].payload.siteId).toBe("site-42");
    });

    it("should handle pagination parameters", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 50 }]),
              }),
            };
          }
          // Data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(Array(10).fill(mockAuditEvent)),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/?page=2&pageSize=10");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.pageSize).toBe(10);
      expect(body.pagination.total).toBe(50);
      expect(body.pagination.totalPages).toBe(5);
    });

    it("should cap pageSize at MAX_PAGE_SIZE (100)", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 150 }]),
              }),
            };
          }
          // Data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(Array(100).fill(mockAuditEvent)),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/?pageSize=200");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.pagination.pageSize).toBe(100);
    });

    it("should return empty array when no events match", async () => {
      let callCount = 0;
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Count query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ n: 0 }]),
              }),
            };
          }
          // Data query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }),
      } as any);

      const res = await app.request("/?projectId=non-existent");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it("should return 503 when database is not ready", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const res = await app.request("/");
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error.code).toBe("DB_NOT_FOUND");
    });
  });

  describe("GET /v1/audit/:auditEventId", () => {
    it("should return a single audit event by ID", async () => {
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockAuditEvent]),
          }),
        }),
      } as any);

      const res = await app.request("/audit-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toMatchObject({
        id: mockAuditEvent.id,
        eventType: mockAuditEvent.eventType,
        entityType: mockAuditEvent.entityType,
        entityId: mockAuditEvent.entityId,
        actor: mockAuditEvent.actor,
        projectId: mockAuditEvent.projectId,
        occurredAt: mockAuditEvent.occurredAt,
      });
      expect(body.payload).toEqual({ title: "Test Task", status: "open" });
    });

    it("should return 404 when audit event not found", async () => {
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.request("/non-existent");
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.details.auditEventId).toBe("non-existent");
    });

    it("should return 503 when database is not ready", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const res = await app.request("/audit-1");
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body.error.code).toBe("DB_NOT_FOUND");
    });
  });
});
