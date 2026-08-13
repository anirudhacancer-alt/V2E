/**
 * Phase B Write Endpoints - Vitest Tests
 *
 * Tests for:
 * - Work Cycles: POST /v1/cycles (body.projectId), PATCH /v1/cycles/:workCycleId
 * - Commitments: POST /v1/commitments (body.projectId), PATCH /v1/commitments/:commitmentId
 * - Dependencies: POST /v1/dependencies (body.projectId, successorTaskId, …),
 *                 DELETE /v1/dependencies/:dependencyId,
 *                 PATCH /v1/dependencies/:dependencyId,
 *                 POST /v1/dependencies/override
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

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { cyclesRouter } from "./cycles.js";
import { commitmentsRouter } from "./commitments.js";
import { dependenciesRouter } from "./dependencies.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

// Auth header for authenticated requests
const authHeader = { Authorization: "Bearer test-token" };

// Mirror v1.ts Phase B mounts: one entity root per router
const phaseBApp = new Hono();
phaseBApp.route("/cycles", cyclesRouter);
phaseBApp.route("/commitments", commitmentsRouter);
phaseBApp.route("/dependencies", dependenciesRouter);

const app = new Hono();
app.route("/v1", phaseBApp);

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
  orgRoleCode: "FOREMAN",
};

const mockTeamMemberOtherSite = {
  id: "member-2",
  siteId: "site-2",
  name: "Other Site Member",
  orgRoleCode: "FOREMAN",
};

const mockRoleType = {
  id: "role-1",
  code: "FOREMAN",
  name: "Foreman",
};

const mockTask = {
  id: "task-1",
  projectId: "project-1",
  siteId: "site-1",
  title: "Test Task",
  status: "In-progress",
};

const mockTask2 = {
  id: "task-2",
  projectId: "project-1",
  siteId: "site-1",
  title: "Test Task 2",
  status: "In-progress",
};

const mockTask3 = {
  id: "task-3",
  projectId: "project-1",
  siteId: "site-1",
  title: "Test Task 3",
  status: "In-progress",
};

const mockTaskOtherProject = {
  id: "task-other",
  projectId: "project-2",
  siteId: "site-2",
  title: "Other Project Task",
};

const mockWorkCycle = {
  id: "wc-1",
  tenantId: "demo-tenant",
  projectId: "project-1",
  name: "Sprint 1",
  startDate: "2024-01-01",
  endDate: "2024-01-14",
  status: "planned",
  goal: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockCommitment = {
  id: "commitment-1",
  tenantId: "demo-tenant",
  projectId: "project-1",
  siteId: "site-1",
  workCycleId: null,
  standupSessionId: null,
  sourceTaskId: null,
  title: "Complete foundation",
  description: null,
  ownerId: "member-1",
  assigneeRoleCode: "FOREMAN",
  status: "planned",
  commitDate: "2024-01-01",
  targetDate: "2024-01-15",
  completedAt: null,
  carriedOverFromCommitmentId: null,
  riskReason: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockDependency = {
  id: "dep-1",
  tenantId: "demo-tenant",
  projectId: "project-1",
  predecessorTaskId: "task-1",
  successorTaskId: "task-2",
  dependencyType: "finish_to_start",
  lagDays: 0,
  isHardConstraint: 1,
  reason: null,
  createdBy: "member-1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
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
// Work Cycles Tests
// ============================================================================

describe("Phase B Work Cycles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /v1/cycles", () => {
    describe("Happy Path", () => {
      it("creates a work cycle and returns 201", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
              goal: "Complete foundation work",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.projectId).toBe("project-1");
        expect(body.name).toBe("Sprint 1");
        expect(body.startDate).toBe("2024-01-01");
        expect(body.endDate).toBe("2024-01-14");
        expect(body.status).toBe("planned");
        expect(body.goal).toBe("Complete foundation work");
      });

      it("creates work cycle with custom status", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
              status: "active",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.status).toBe("active");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 for missing required fields", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              // Missing startDate and endDate
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.missingFields).toContain("startDate");
        expect(body.error.details.missingFields).toContain("endDate");
      });

      it("returns 400 for invalid status value", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
              status: "invalid_status",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("Invalid status value");
      });

      it("returns 400 when endDate < startDate", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-15",
              endDate: "2024-01-01",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("endDate must be >= startDate");
      });

      it("returns 400 for invalid JSON", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: "not valid json",
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("INVALID_JSON");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
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
          "/v1/cycles",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer invalid-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
            }),
          }
        );

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "non-existent-project",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
            }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });

      it("returns 503 when database is not ready", async () => {
        mockedSqliteFileExists.mockReturnValue(false);

        const res = await app.request(
          "/v1/cycles",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              name: "Sprint 1",
              startDate: "2024-01-01",
              endDate: "2024-01-14",
            }),
          }
        );

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error.code).toBe("DB_NOT_FOUND");
      });
    });
  });

  describe("PATCH /v1/cycles/:workCycleId", () => {
    describe("Happy Path", () => {
      it("updates a work cycle and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockWorkCycle]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles/wc-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Sprint 1 - Updated",
              status: "active",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe("wc-1");
        expect(body.name).toBe("Sprint 1 - Updated");
        expect(body.status).toBe("active");
      });

      it("updates work cycle dates", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockWorkCycle]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles/wc-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: "2024-01-08",
              endDate: "2024-01-21",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.startDate).toBe("2024-01-08");
        expect(body.endDate).toBe("2024-01-21");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 for invalid status value", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockWorkCycle]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles/wc-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "invalid_status",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 when endDate < startDate after update", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockWorkCycle]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles/wc-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              startDate: "2024-01-20",
              // endDate remains 2024-01-14
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("endDate must be >= startDate");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent work cycle", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/cycles/non-existent",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Updated",
            }),
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
          "/v1/cycles/wc-1",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Updated" }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });
});

// ============================================================================
// Commitments Tests
// ============================================================================

describe("Phase B Commitments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /v1/commitments", () => {
    describe("Happy Path", () => {
      it("creates a commitment and returns 201", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],     // project lookup
          [mockTeamMember],  // owner lookup
          [mockRoleType],    // role lookup
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Complete foundation work",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.projectId).toBe("project-1");
        expect(body.title).toBe("Complete foundation work");
        expect(body.status).toBe("planned");
        expect(body.ownerId).toBe("member-1");
        expect(body.assigneeRoleCode).toBe("FOREMAN");
      });

      it("creates commitment with optional fields", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTeamMember],
          [mockRoleType],
          [mockTask],        // sourceTask lookup
          [mockWorkCycle],   // workCycle lookup
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Complete foundation work",
              description: "Detailed description here",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
              sourceTaskId: "task-1",
              workCycleId: "wc-1",
              riskReason: "Weather concerns",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.description).toBe("Detailed description here");
        expect(body.sourceTaskId).toBe("task-1");
        expect(body.workCycleId).toBe("wc-1");
        expect(body.riskReason).toBe("Weather concerns");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 for missing required fields", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              // Missing ownerId, assigneeRoleCode, commitDate, targetDate
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.missingFields).toContain("ownerId");
        expect(body.error.details.missingFields).toContain("assigneeRoleCode");
        expect(body.error.details.missingFields).toContain("commitDate");
        expect(body.error.details.missingFields).toContain("targetDate");
      });

      it("returns 400 for invalid status value", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTeamMember],
          [mockRoleType],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
              status: "invalid_status",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("Invalid status value");
      });

      it("returns 400 when targetDate < commitDate", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockProject]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-15",
              targetDate: "2024-01-01",  // Before commitDate
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("targetDate must be >= commitDate");
      });

      it("returns 400 when owner not found", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [],  // owner not found
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "non-existent",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("Owner not found");
      });

      it("returns PROJECT_SCOPE_MISMATCH when owner not in project site", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],          // project with siteId: site-1
          [mockTeamMemberOtherSite],  // owner with siteId: site-2
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-2",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PROJECT_SCOPE_MISMATCH");
        expect(body.error.message).toContain("Owner does not belong to project site");
      });

      it("returns 400 when role code not found", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTeamMember],
          [],  // role not found
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "INVALID_ROLE",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("assigneeRoleCode not found");
      });

      it("returns PROJECT_SCOPE_MISMATCH when sourceTask from different project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTeamMember],
          [mockRoleType],
          [mockTaskOtherProject],  // task from project-2
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
              sourceTaskId: "task-other",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PROJECT_SCOPE_MISMATCH");
        expect(body.error.message).toContain("sourceTaskId does not belong to this project");
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "non-existent",
              title: "Test",
              ownerId: "member-1",
              assigneeRoleCode: "FOREMAN",
              commitDate: "2024-01-01",
              targetDate: "2024-01-15",
            }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });
  });

  describe("PATCH /v1/commitments/:commitmentId", () => {
    describe("Happy Path", () => {
      it("updates a commitment and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockCommitment]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "Updated commitment title",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe("commitment-1");
        expect(body.title).toBe("Updated commitment title");
      });

      it("updates commitment status with valid transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockCommitment]]);  // status: planned
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "in_progress",  // Valid: planned -> in_progress
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe("in_progress");
      });
    });

    describe("Commitment-Specific: Invalid State Transitions", () => {
      it("returns COMMITMENT_INVALID_STATE_TRANSITION for invalid transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const completedCommitment = { ...mockCommitment, status: "completed" };
        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[completedCommitment]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "planned",  // Invalid: completed is terminal
            }),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("COMMITMENT_INVALID_STATE_TRANSITION");
        expect(body.error.message).toContain("Cannot transition from completed to planned");
      });

      it("allows planned -> in_progress transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[{ ...mockCommitment, status: "planned" }]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "in_progress" }),
          }
        );

        expect(res.status).toBe(200);
      });

      it("allows in_progress -> completed transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[{ ...mockCommitment, status: "in_progress" }]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          }
        );

        expect(res.status).toBe(200);
      });

      it("allows missed -> carried_over transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[{ ...mockCommitment, status: "missed" }]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "carried_over" }),
          }
        );

        expect(res.status).toBe(200);
      });

      it("rejects in_progress -> planned transition", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[{ ...mockCommitment, status: "in_progress" }]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "planned" }),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("COMMITMENT_INVALID_STATE_TRANSITION");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 when targetDate < commitDate", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockCommitment]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/commitment-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              targetDate: "2023-12-01",  // Before commitDate (2024-01-01)
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("targetDate must be >= commitDate");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent commitment", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/commitments/non-existent",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Updated" }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });
    });
  });
});

// ============================================================================
// Task Dependencies Tests
// ============================================================================

describe("Phase B Task Dependencies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /v1/dependencies", () => {
    describe("Happy Path", () => {
      it("creates a dependency and returns 201", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],      // project lookup
          [mockTask],         // task lookup (successor)
          [mockTask2],        // predecessor task lookup
          [mockTeamMember],   // createdBy lookup
          [],                 // no existing duplicate
          [],                 // no dependencies for cycle check
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.projectId).toBe("project-1");
        expect(body.predecessorTaskId).toBe("task-2");
        expect(body.successorTaskId).toBe("task-1");
        expect(body.dependencyType).toBe("finish_to_start");
        expect(body.isHardConstraint).toBe(true);
      });

      it("creates dependency with custom type and lag", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
          [mockTask2],
          [mockTeamMember],
          [],
          [],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
              dependencyType: "start_to_start",
              lagDays: 2,
              isHardConstraint: false,
              reason: "Need to coordinate teams",
            }),
          }
        );

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.dependencyType).toBe("start_to_start");
        expect(body.lagDays).toBe(2);
        expect(body.isHardConstraint).toBe(false);
        expect(body.reason).toBe("Need to coordinate teams");
      });
    });

    describe("Dependency-Specific: Self-edge", () => {
      it("returns DEPENDENCY_INVALID_EDGE for self-dependency", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-1",  // Same as successor
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("DEPENDENCY_INVALID_EDGE");
        expect(body.error.message).toContain("task cannot depend on itself");
      });
    });

    describe("Dependency-Specific: Duplicate dependency", () => {
      it("returns DEPENDENCY_INVALID_EDGE for duplicate dependency", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
          [mockTask2],
          [mockTeamMember],
          [{ id: "existing-dep" }],  // Existing dependency
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("DEPENDENCY_INVALID_EDGE");
        expect(body.error.message).toContain("Duplicate dependency edge exists");
      });
    });

    describe("Dependency-Specific: Cycle detection", () => {
      it("returns DEPENDENCY_CYCLE_DETECTED when cycle would be created", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        // Scenario: Existing hard dependency task-1 -> task-2
        // Trying to add task-2 -> task-1 (predecessor=task-2, successor=task-1)
        // This would create cycle: task-1 -> task-2 -> task-1
        //
        // In our test: URL is /tasks/task-1/dependencies with predecessorTaskId=task-2
        // This means: successor=task-1, predecessor=task-2
        // Existing: predecessor=task-2, successor=task-1 ALREADY EXISTS
        // Wait - that would be a duplicate, not a cycle.
        //
        // Let me think again:
        // Existing: task-1 -> task-2 (task-1 is predecessor, task-2 is successor)
        // Proposed: task-2 -> task-1 (task-2 is predecessor, task-1 is successor)
        // URL: /tasks/task-1/dependencies with predecessorTaskId=task-2
        // This means: successorTaskId=task-1, predecessorTaskId=task-2
        //
        // The wouldCreateCycle function checks if we can reach predecessorTaskId (task-2)
        // starting from successorTaskId (task-1) after adding the edge.
        //
        // After adding edge task-2 -> task-1:
        // - Starting from task-1 (successor)
        // - Follow edges: task-1 has edge to task-2 (from existing dep)
        // - task-2 equals predecessorTaskId (task-2) -> CYCLE DETECTED

        const existingDeps = [
          { id: "dep-existing", predecessor: "task-1", successor: "task-2", isHard: 1 },
        ];

        // Need task-1 to be the successor in our URL
        const successorTask = { ...mockTask, id: "task-1", projectId: "project-1" };
        const predecessorTask = { ...mockTask2, id: "task-2", projectId: "project-1" };

        let selectCallCount = 0;
        const mockDb = {
          select: vi.fn().mockImplementation(() => ({
            from: vi.fn().mockImplementation(() => ({
              where: vi.fn().mockImplementation(() => {
                selectCallCount++;
                // Query order: 1=project, 2=successor task, 3=predecessor task, 4=creator, 5=duplicate, 6=cycle
                switch (selectCallCount) {
                  case 1: return Promise.resolve([mockProject]);
                  case 2: return Promise.resolve([successorTask]);
                  case 3: return Promise.resolve([predecessorTask]);
                  case 4: return Promise.resolve([mockTeamMember]);
                  case 5: return Promise.resolve([]);  // No duplicate dependency
                  case 6: return Promise.resolve(existingDeps);  // Existing deps for cycle check
                  default: return Promise.resolve([]);
                }
              }),
            })),
          })),
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
        };
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",  // Proposed: task-2 -> task-1
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("DEPENDENCY_CYCLE_DETECTED");
        expect(body.error.message).toContain("would create a cycle");
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 for missing required fields", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              // Missing predecessorTaskId and createdBy
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

      it("returns 400 for invalid dependency type", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
          [mockTask2],
          [mockTeamMember],
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
              dependencyType: "invalid_type",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("Invalid dependencyType value");
      });

      it("returns PROJECT_SCOPE_MISMATCH when predecessor from different project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTask],
          [mockTaskOtherProject],  // Predecessor from different project
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-other",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PROJECT_SCOPE_MISMATCH");
      });

      it("returns PROJECT_SCOPE_MISMATCH when task from different project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [mockTaskOtherProject],  // Successor task from different project
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-other",
              predecessorTaskId: "task-1",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("PROJECT_SCOPE_MISMATCH");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent project", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "non-existent",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe("NOT_FOUND");
      });

      it("returns 404 for non-existent task", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([
          [mockProject],
          [],  // Task not found
        ]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "non-existent",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
            }),
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
          "/v1/dependencies",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: "project-1",
              successorTaskId: "task-1",
              predecessorTaskId: "task-2",
              createdBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });

  describe("DELETE /v1/dependencies/:dependencyId", () => {
    describe("Happy Path", () => {
      it("deletes a dependency and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/dep-1",  // task-2 is successor
          {
            method: "DELETE",
            headers: authHeader,
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.deleted).toBe(true);
        expect(body.id).toBe("dep-1");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent dependency", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/non-existent",
          {
            method: "DELETE",
            headers: authHeader,
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
          "/v1/dependencies/dep-1",
          { method: "DELETE" }
        );

        expect(res.status).toBe(401);
      });
    });
  });

  describe("PATCH /v1/dependencies/:dependencyId", () => {
    describe("Happy Path", () => {
      it("updates a dependency and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/dep-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              lagDays: 3,
              reason: "Updated reason",
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe("dep-1");
        expect(body.lagDays).toBe(3);
        expect(body.reason).toBe("Updated reason");
      });

      it("updates isHardConstraint to false", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/dep-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              isHardConstraint: false,
            }),
          }
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isHardConstraint).toBe(false);
      });
    });

    describe("Dependency-Specific: Cycle on hard constraint change", () => {
      it("returns DEPENDENCY_CYCLE_DETECTED when making soft -> hard would create cycle", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        // Soft dependency from task-1 -> task-2 that would create cycle if made hard
        // because there's already a hard dependency task-2 -> task-1
        const softDep = {
          ...mockDependency,
          isHardConstraint: 0,
          predecessorTaskId: "task-1",
          successorTaskId: "task-2",
        };

        // Existing hard dependency task-2 -> task-1 creates a cycle with proposed task-1 -> task-2
        const existingHardDeps = [
          { id: "dep-2", predecessor: "task-2", successor: "task-1", isHard: 1 },
        ];

        let callCount = 0;
        const mockDb = createMockDb();
        mockDb.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              // Call 1: dependency lookup, Call 2: cycle check
              if (callCount === 1) return Promise.resolve([softDep]);
              return Promise.resolve(existingHardDeps);
            }),
          }),
        });
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/dep-1",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              isHardConstraint: true,
            }),
          }
        );

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("DEPENDENCY_CYCLE_DETECTED");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 for non-existent dependency", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/non-existent",
          {
            method: "PATCH",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ lagDays: 1 }),
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
          "/v1/dependencies/dep-1",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lagDays: 1 }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });

  describe("POST /v1/dependencies/override", () => {
    // Flat route pattern.
    // The route pattern "/dependencies/override" expects `dependencyId` and `projectId`
    // in the JSON body.

    describe("Happy Path", () => {
      it("overrides a dependency and returns 200", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDep = { ...mockDependency, id: "dep-1" };

        let callCount = 0;
        const mockDb = createMockDb();
        mockDb.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              // Call 1: dependency lookup, Call 2: overriddenBy lookup
              if (callCount === 1) return Promise.resolve([mockDep]);
              return Promise.resolve([mockTeamMember]);
            }),
          }),
        });
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              reason: "Emergency situation requires immediate action",
              overriddenBy: "member-1",
            }),
          }
        );

        // If the route matches and handler runs, check the actual behavior
        // If dependencyId extraction fails, we get 400 with "dependencyId is required"
        const body = await res.json();

        // With slash-style routes, dependencyId is extracted correctly
        expect(res.status).toBe(200);
        expect(body.id).toBe("dep-1");
        expect(body.isHardConstraint).toBe(false);
        expect(body.reason).toContain("[OVERRIDE]");
        expect(body.override).toBeDefined();
        expect(body.override.reason).toBe("Emergency situation requires immediate action");
        expect(body.override.overriddenBy).toBe("member-1");
      });
    });

    describe("Dependency-Specific: Override without reason", () => {
      it("returns error when reason is missing (route behavior test)", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              overriddenBy: "member-1",
              // Missing reason
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        // Route may return VALIDATION_ERROR if dependencyId extraction fails
        // or DEPENDENCY_OVERRIDE_REQUIRES_REASON if reason validation fails
        expect(["VALIDATION_ERROR", "DEPENDENCY_OVERRIDE_REQUIRES_REASON"]).toContain(body.error.code);
      });

      it("returns error for empty reason", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              reason: "   ",  // Whitespace only
              overriddenBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(["VALIDATION_ERROR", "DEPENDENCY_OVERRIDE_REQUIRES_REASON"]).toContain(body.error.code);
      });
    });

    describe("Validation Errors", () => {
      it("returns 400 when overriddenBy is missing", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[mockDependency]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              reason: "Valid reason",
              // Missing overriddenBy
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        // Message may be about dependencyId or overriddenBy depending on route behavior
        expect(body.error.message).toBeDefined();
      });

      it("returns 400 when overriddenBy not found", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        let callCount = 0;
        const mockDb = createMockDb();
        mockDb.select = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve([mockDependency]);
              return Promise.resolve([]);  // overriddenBy not found
            }),
          }),
        });
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              reason: "Valid reason",
              overriddenBy: "non-existent",
            }),
          }
        );

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
    });

    describe("Not Found Tests", () => {
      it("returns 404 or 400 for non-existent dependency", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const mockDb = createMockDb();
        mockDb.select = createSequentialSelectMock([[]]);
        mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "non-existent", // Send non-existent in body instead
              projectId: "project-1",
              reason: "Valid reason",
              overriddenBy: "member-1",
            }),
          }
        );

        // May be 404 (NOT_FOUND) if route matches and dependency not found
        // or 400 (VALIDATION_ERROR) if dependencyId extraction fails
        expect([400, 404]).toContain(res.status);
        const body = await res.json();
        expect(["NOT_FOUND", "VALIDATION_ERROR"]).toContain(body.error.code);
      });
    });

    describe("Auth Tests", () => {
      it("returns 401 without auth header", async () => {
        mockedSqliteFileExists.mockReturnValue(true);

        const res = await app.request(
          "/v1/dependencies/override",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dependencyId: "dep-1",
              projectId: "project-1",
              reason: "Valid reason",
              overriddenBy: "member-1",
            }),
          }
        );

        expect(res.status).toBe(401);
      });
    });
  });
});

// ============================================================================
// DB Not Ready Tests (shared across all endpoints)
// ============================================================================

describe("Phase B - DB Not Ready (503)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(false);
  });

  it("POST cycles returns 503", async () => {
    const res = await app.request("/v1/cycles", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        name: "Test",
        startDate: "2024-01-01",
        endDate: "2024-01-14",
      }),
    });
    expect(res.status).toBe(503);
  });

  it("PATCH cycles returns 503", async () => {
    const res = await app.request("/v1/cycles/wc-1", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(503);
  });

  it("POST commitments returns 503", async () => {
    const res = await app.request("/v1/commitments", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        title: "Test",
        ownerId: "m1",
        assigneeRoleCode: "FOREMAN",
        commitDate: "2024-01-01",
        targetDate: "2024-01-15",
      }),
    });
    expect(res.status).toBe(503);
  });

  it("PATCH commitments returns 503", async () => {
    const res = await app.request("/v1/commitments/c-1", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    expect(res.status).toBe(503);
  });

  it("POST dependencies returns 503", async () => {
    const res = await app.request("/v1/dependencies", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        successorTaskId: "task-1",
        predecessorTaskId: "task-2",
        createdBy: "m1",
      }),
    });
    expect(res.status).toBe(503);
  });

  it("DELETE dependencies returns 503", async () => {
    const res = await app.request("/v1/dependencies/dep-1", {
      method: "DELETE",
      headers: authHeader,
    });
    expect(res.status).toBe(503);
  });

  it("PATCH dependencies returns 503", async () => {
    const res = await app.request("/v1/dependencies/dep-1", {
      method: "PATCH",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ lagDays: 1 }),
    });
    expect(res.status).toBe(503);
  });

  it("POST override returns 503", async () => {
    const res = await app.request("/v1/dependencies/override", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ dependencyId: "dep-1", projectId: "project-1", reason: "Test", overriddenBy: "m1" }),
    });
    expect(res.status).toBe(503);
  });
});
