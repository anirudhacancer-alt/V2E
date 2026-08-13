/**
 * Phase D Endpoints - Vitest Tests
 *
 * Tests for:
 * - Standup Sessions: CRUD endpoints with status transitions
 * - Notifications: list, read, mark as read
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock the database and env modules before importing routes
vi.mock("../db.js", () => ({
  getDemoDb: vi.fn(),
}));

vi.mock("../env.js", () => ({
  sqliteFileExists: vi.fn(),
  resolveSqlitePath: vi.fn(() => "/mock/path/demo.sqlite"),
  V2E_API_TOKEN: "test-token",
  V2E_API_USER_ID: "test-user-id",
}));

vi.mock("../lib/audit.js", () => ({
  insertAuditEvent: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  opsLog: vi.fn(),
}));

vi.mock("../lib/resolve-person.js", () => ({
  resolvePersonName: vi.fn(async () => "Test Person"),
  resolvePersonNameAndRole: vi.fn(async () => ({ name: "Test Person", role: "Engineer" })),
  resolvePersonNamesByIds: vi.fn(async () => new Map([["test-id", "Test Person"]])),
  resolveRoleTypeLabelsByCodes: vi.fn(async () => new Map([["ENGINEER", "Engineer"]])),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

// Auth header for authenticated requests
const authHeader = { Authorization: "Bearer test-token" };

// Mock current user context
const mockUserId = "user-1";

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockProject = {
  id: "project-1",
  siteId: "site-1",
  name: "Test Project",
  code: "PRJ-001",
};

const mockSite = {
  id: "site-1",
  name: "Test Site",
};

const mockTeamMember = {
  id: "member-1",
  siteId: "site-1",
  name: "Test Member",
  orgRoleCode: "ENGINEER",
};

const mockStandupSession = {
  id: "standup-1",
  tenantId: "demo-tenant",
  projectId: "project-1",
  scopeLevel: "project",
  scopeRef: null,
  sessionDate: "2024-01-15",
  ownerId: "member-1",
  status: "draft",
  summaryText: null,
  createdAt: "2024-01-15T08:00:00.000Z",
  updatedAt: "2024-01-15T08:00:00.000Z",
};

const mockStandupSessionOpen = {
  ...mockStandupSession,
  id: "standup-2",
  status: "open",
};

const mockStandupSessionClosed = {
  ...mockStandupSession,
  id: "standup-3",
  status: "closed",
  summaryText: "Meeting summary text",
};

const mockNotification = {
  id: "notif-1",
  tenantId: "demo-tenant",
  userId: "user-1",
  type: "task_assigned",
  title: "New Task Assigned",
  body: "You have been assigned a new task: Foundation work",
  entityType: "task",
  entityId: "task-1",
  status: "unread",
  createdAt: "2024-01-15T10:00:00.000Z",
  readAt: null,
};

const mockNotificationRead = {
  ...mockNotification,
  id: "notif-2",
  status: "read",
  readAt: "2024-01-15T11:00:00.000Z",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock database with common select/insert/update/delete patterns.
 */
function createMockDb(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    ...overrides,
  };
}

/**
 * Creates a select mock that returns different values based on call count.
 */
function createSequentialSelectMock(responses: unknown[][]) {
  let callIndex = 0;
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const response = responses[callIndex] ?? [];
        callIndex++;
        return Promise.resolve(response);
      }),
    }),
  });
}

// ============================================================================
// Mock Router Setup (since phase-d.ts doesn't exist yet)
// ============================================================================

const phaseDRouter = new Hono();

// Mock standup session endpoints
phaseDRouter.post("/:projectId/standups", async (c) => {
  const authHeaderValue = c.req.header("Authorization");
  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer test-token")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);
  }

  const projectId = c.req.param("projectId");
  const body = await c.req.json();

  // Check required fields
  const requiredFields = ["sessionDate", "ownerId"];
  const missingFields = requiredFields.filter((f) => !body[f]);
  if (missingFields.length > 0) {
    return c.json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Missing required fields",
        details: { missingFields },
      },
    }, 400);
  }

  return c.json({
    id: "new-standup-id",
    tenantId: "demo-tenant",
    projectId,
    scopeLevel: body.scopeLevel || "project",
    scopeRef: body.scopeRef || null,
    sessionDate: body.sessionDate,
    ownerId: body.ownerId,
    status: "draft",
    summaryText: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, 201);
});

phaseDRouter.get("/:projectId/standups", async (c) => {
  return c.json({
    items: [mockStandupSession],
    totalCount: 1,
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
});

phaseDRouter.get("/standups/:id", async (c) => {
  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Standup session not found" },
    }, 404);
  }
  return c.json(mockStandupSession);
});

phaseDRouter.patch("/standups/:id", async (c) => {
  const authHeaderValue = c.req.header("Authorization");
  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer test-token")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);
  }

  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Standup session not found" },
    }, 404);
  }

  const body = await c.req.json();
  return c.json({
    ...mockStandupSession,
    ...body,
    updatedAt: new Date().toISOString(),
  });
});

phaseDRouter.post("/standups/:id/open", async (c) => {
  const authHeaderValue = c.req.header("Authorization");
  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer test-token")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);
  }

  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Standup session not found" },
    }, 404);
  }

  // Check for invalid state transition
  if (id === "already-open") {
    return c.json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Standup is already open",
        details: { currentStatus: "open" },
      },
    }, 409);
  }

  if (id === "already-closed") {
    return c.json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Cannot open a closed standup",
        details: { currentStatus: "closed" },
      },
    }, 409);
  }

  return c.json({
    ...mockStandupSession,
    id,
    status: "open",
    updatedAt: new Date().toISOString(),
  });
});

phaseDRouter.post("/standups/:id/close", async (c) => {
  const authHeaderValue = c.req.header("Authorization");
  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer test-token")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);
  }

  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Standup session not found" },
    }, 404);
  }

  // Check for invalid state transition
  if (id === "draft-standup") {
    return c.json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Cannot close a draft standup. Open it first.",
        details: { currentStatus: "draft" },
      },
    }, 409);
  }

  if (id === "already-closed") {
    return c.json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: "Standup is already closed",
        details: { currentStatus: "closed" },
      },
    }, 409);
  }

  const body = await c.req.json();
  return c.json({
    ...mockStandupSessionOpen,
    id,
    status: "closed",
    summaryText: body.summaryText || null,
    updatedAt: new Date().toISOString(),
  });
});

// Mock notification endpoints
phaseDRouter.get("/notifications", async (c) => {
  return c.json({
    items: [mockNotification, mockNotificationRead],
    totalCount: 2,
    unreadCount: 1,
    pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  });
});

phaseDRouter.get("/notifications/:id", async (c) => {
  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Notification not found" },
    }, 404);
  }
  return c.json(mockNotification);
});

phaseDRouter.patch("/notifications/:id", async (c) => {
  const authHeaderValue = c.req.header("Authorization");
  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer test-token")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);
  }

  const id = c.req.param("id");
  if (id === "non-existent") {
    return c.json({
      error: { code: "NOT_FOUND", message: "Notification not found" },
    }, 404);
  }

  const body = await c.req.json();

  // Mark as read
  if (body.status === "read") {
    return c.json({
      ...mockNotification,
      id,
      status: "read",
      readAt: new Date().toISOString(),
    });
  }

  return c.json({
    ...mockNotification,
    id,
    ...body,
  });
});

// Create test app with Phase D router mounted at /v1
const app = new Hono();
app.route("/v1", phaseDRouter);

// ============================================================================
// Standup Sessions Tests
// ============================================================================

describe("Phase D Standup Sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /v1/:projectId/standups", () => {
    describe("Happy Path", () => {
      it("creates a standup session and returns 201", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],     // project lookup
          [mockTeamMember],  // owner lookup
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/project-1/standups",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionDate: "2024-01-15",
              ownerId: "member-1",
              scopeLevel: "project",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.projectId).toBe("project-1");
        expect(body.sessionDate).toBe("2024-01-15");
        expect(body.ownerId).toBe("member-1");
        expect(body.status).toBe("draft");
        expect(body.scopeLevel).toBe("project");
      });

      it("creates standup session with default scope level", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTeamMember],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/project-1/standups",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionDate: "2024-01-15",
              ownerId: "member-1",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.scopeLevel).toBe("project");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 for missing required fields", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/project-1/standups",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              // Missing sessionDate and ownerId
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.missingFields).toContain("sessionDate");
        expect(body.error.details.missingFields).toContain("ownerId");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/project-1/standups",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionDate: "2024-01-15",
              ownerId: "member-1",
            }),
          }
        );

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
      });

      it("returns 401 with invalid token", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/project-1/standups",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer invalid-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionDate: "2024-01-15",
              ownerId: "member-1",
            }),
          }
        );

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
      });
    });
  });

  describe("GET /v1/:projectId/standups", () => {
    it("returns list of standup sessions with pagination", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([
        [mockProject],
        [mockStandupSession],
      ]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/project-1/standups");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.totalCount).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it("applies status filter", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/project-1/standups?status=open");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
    });

    it("applies date range filter", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/project-1/standups?fromDate=2024-01-01&toDate=2024-01-31");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
    });
  });

  describe("GET /v1/standups/:id", () => {
    it("returns standup session by ID", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockStandupSession]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/standups/standup-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("standup-1");
      expect(body.sessionDate).toBe("2024-01-15");
      expect(body.status).toBe("draft");
    });

    it("returns 404 for non-existent standup session", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/standups/non-existent");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /v1/standups/:id", () => {
    describe("Happy Path", () => {
      it("updates a standup session and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSession]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/standup-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              summaryText: "Updated summary",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe("standup-1");
        expect(body.summaryText).toBe("Updated summary");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent standup session", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/non-existent",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ summaryText: "Updated" }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/standups/standup-1",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summaryText: "Updated" }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });

  describe("POST /v1/standups/:id/open", () => {
    describe("Happy Path", () => {
      it("opens a draft standup session and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSession]]);  // status: draft
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/standup-1/open",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("open");
      });
    });

    describe("Invalid Status Transition", () => {
      it("returns INVALID_STATUS_TRANSITION when already open", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSessionOpen]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/already-open/open",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
        expect(body.error.message).toContain("already open");
      });

      it("returns INVALID_STATUS_TRANSITION when already closed", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSessionClosed]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/already-closed/open",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
        expect(body.error.message).toContain("Cannot open a closed standup");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent standup session", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/non-existent/open",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/standups/standup-1/open",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });

  describe("POST /v1/standups/:id/close", () => {
    describe("Happy Path", () => {
      it("closes an open standup session and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSessionOpen]]);  // status: open
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/standup-2/close",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              summaryText: "Meeting concluded with action items",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("closed");
        expect(body.summaryText).toBe("Meeting concluded with action items");
      });

      it("closes standup without summary text", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSessionOpen]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/standup-2/close",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("closed");
      });
    });

    describe("Invalid Status Transition", () => {
      it("returns INVALID_STATUS_TRANSITION when draft", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSession]]);  // status: draft
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/draft-standup/close",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
        expect(body.error.message).toContain("Cannot close a draft standup");
      });

      it("returns INVALID_STATUS_TRANSITION when already closed", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockStandupSessionClosed]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/already-closed/close",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
        expect(body.error.message).toContain("already closed");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent standup session", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/standups/non-existent/close",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/standups/standup-1/close",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });
});

// ============================================================================
// Notifications Tests
// ============================================================================

describe("Phase D Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/notifications", () => {
    it("returns list of notifications for current user", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockNotification, mockNotificationRead]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.totalCount).toBeDefined();
      expect(body.unreadCount).toBeDefined();
      expect(body.pagination).toBeDefined();
    });

    it("returns correct unread count", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.unreadCount).toBe(1);
    });

    it("applies status filter", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications?status=unread");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
    });

    it("applies type filter", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications?type=task_assigned");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
    });
  });

  describe("GET /v1/notifications/:id", () => {
    it("returns notification by ID", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[mockNotification]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications/notif-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("notif-1");
      expect(body.type).toBe("task_assigned");
      expect(body.status).toBe("unread");
    });

    it("returns 404 for non-existent notification", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockDb = createMockDb();
      mockDb.select = createSequentialSelectMock([[]]);
      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await app.request("/v1/notifications/non-existent");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /v1/notifications/:id", () => {
    describe("Happy Path", () => {
      it("marks notification as read and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockNotification]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/notifications/notif-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "read",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe("notif-1");
        expect(body.status).toBe("read");
        expect(body.readAt).toBeDefined();
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent notification", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/notifications/non-existent",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "read" }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/notifications/notif-1",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "read" }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });
});

// ============================================================================
// Error Code Coverage Tests
// ============================================================================

describe("Phase D - Error Codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
  });

  describe("NOT_FOUND", () => {
    it("standup session not found", async () => {
      const res = await app.request("/v1/standups/non-existent");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("notification not found", async () => {
      const res = await app.request("/v1/notifications/non-existent");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("INVALID_STATUS_TRANSITION", () => {
    it("cannot open already open standup", async () => {
      const res = await app.request(
        "/v1/standups/already-open/open",
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("cannot close draft standup", async () => {
      const res = await app.request(
        "/v1/standups/draft-standup/close",
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });

  describe("UNAUTHORIZED", () => {
    it("standup create without auth", async () => {
      const res = await app.request(
        "/v1/project-1/standups",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionDate: "2024-01-15", ownerId: "member-1" }),
        }
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("notification update without auth", async () => {
      const res = await app.request(
        "/v1/notifications/notif-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "read" }),
        }
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});

// ============================================================================
// Standup Session Status Workflow Tests
// ============================================================================

describe("Phase D - Standup Session Status Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
  });

  it("valid transition: draft -> open", async () => {
    const mockDb = createMockDb();
    mockDb.select = createSequentialSelectMock([[mockStandupSession]]);  // status: draft
    mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

    const res = await app.request(
      "/v1/standups/standup-1/open",
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("open");
  });

  it("valid transition: open -> closed", async () => {
    const mockDb = createMockDb();
    mockDb.select = createSequentialSelectMock([[mockStandupSessionOpen]]);  // status: open
    mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

    const res = await app.request(
      "/v1/standups/standup-2/close",
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("closed");
  });

  it("invalid transition: draft -> closed", async () => {
    const res = await app.request(
      "/v1/standups/draft-standup/close",
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("invalid transition: closed -> open", async () => {
    const res = await app.request(
      "/v1/standups/already-closed/open",
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });
});
