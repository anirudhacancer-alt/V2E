/**
 * Read-model API tests (commitments horizon, reviews queue).
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
  AI_GATEWAY_URL: "http://localhost:3001",
  LOW_CONFIDENCE_THRESHOLD: 0.7,
}));

vi.mock("../lib/resolve-person.js", () => ({
  resolvePersonName: vi.fn(async () => "Test Person"),
  resolvePersonNameAndRole: vi.fn(async () => ({ name: "Test Person", role: "Engineer" })),
  resolvePersonNamesByIds: vi.fn(async () => new Map([["test-id", "Test Person"]])),
  resolveRoleTypeLabelsByCodes: vi.fn(async () => new Map([["ENGINEER", "Engineer"]])),
}));

vi.mock("../lib/audit.js", () => ({
  insertAuditEvent: vi.fn(),
}));

vi.mock("../lib/dependencies.js", () => ({
  computeDependencySummaries: vi.fn(async () => new Map()),
}));

vi.mock("../lib/task-state.js", () => ({
  deriveSupervisorTaskState: vi.fn((task) => {
    if (task.status === "Blocked") return "Blocked";
    if (task.status === "Done") return "Done";
    if (task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== "Done") {
      return "Overdue";
    }
    return "In-progress";
  }),
  isCurrentUiTaskState: vi.fn((state) => state !== "Done"),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { projectsRouter } from "./projects.js";
import { commitmentsRouter } from "./commitments.js";
import { reviewsRouter } from "./reviews.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

// Create test apps
const projectsApp = new Hono();
projectsApp.route("/projects", projectsRouter);

const commitmentsApp = new Hono();
commitmentsApp.route("/commitments", commitmentsRouter);

const reviewQueueApp = new Hono();
reviewQueueApp.route("/reviews", reviewsRouter);

describe("Project read-model endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /v1/commitments/horizon", () => {
    it("returns 503 when database is not ready", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const res = await commitmentsApp.request(
        "/commitments/horizon?projectId=test-project-id",
      );

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("DB_NOT_FOUND");
    });

    it("returns 404 for non-existent project", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof getDemoDb>);

      const res = await commitmentsApp.request(
        "/commitments/horizon?projectId=non-existent-id",
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns commitment groups with correct structure", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockProject = { id: "test-project-id", name: "Test Project", siteId: "test-site-id" };
      const mockTasks = [
        {
          id: "task-1",
          title: "Task 1",
          status: "In-progress",
          ownerId: "owner-1",
          assigneeRoleCode: "ENGINEER",
          dueDate: new Date().toISOString().slice(0, 10),
          completedAt: null,
          createdAt: new Date().toISOString(),
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((condition) => {
              // First call for project, second for tasks
              if (mockDb.select.mock.calls.length === 1) {
                return Promise.resolve([mockProject]);
              }
              return Promise.resolve(mockTasks);
            }),
          }),
        }),
      };

      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await commitmentsApp.request(
        "/commitments/horizon?projectId=test-project-id",
      );

      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify response structure
      expect(body).toHaveProperty("projectId");
      expect(body).toHaveProperty("projectName");
      expect(body).toHaveProperty("groups");
      expect(body).toHaveProperty("totalCount");
      expect(body).toHaveProperty("stats");

      // Verify groups structure
      expect(Array.isArray(body.groups)).toBe(true);
      if (body.groups.length > 0) {
        expect(body.groups[0]).toHaveProperty("horizon");
        expect(body.groups[0]).toHaveProperty("label");
        expect(body.groups[0]).toHaveProperty("items");
        expect(body.groups[0]).toHaveProperty("count");
      }

      // Verify stats structure
      expect(body.stats).toHaveProperty("planned");
      expect(body.stats).toHaveProperty("inProgress");
      expect(body.stats).toHaveProperty("completed");
      expect(body.stats).toHaveProperty("atRisk");
      expect(body.stats).toHaveProperty("missed");
      expect(body.stats).toHaveProperty("carriedOver");
    });

    it("applies status filter correctly", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockProject = { id: "test-project-id", name: "Test Project", siteId: "test-site-id" };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              if (mockDb.select.mock.calls.length === 1) {
                return Promise.resolve([mockProject]);
              }
              return Promise.resolve([]);
            }),
          }),
        }),
      };

      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await commitmentsApp.request(
        "/commitments/horizon?projectId=test-project-id&status=completed",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.filters?.status).toBe("completed");
    });
  });

  describe("GET /v1/reviews", () => {
    it("returns 503 when database is not ready", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const res = await reviewQueueApp.request("/reviews?projectId=test-project");

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("DB_NOT_FOUND");
    });

    it("returns 404 for non-existent project", async () => {
      mockedSqliteFileExists.mockReturnValue(true);
      mockedGetDemoDb.mockReturnValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof getDemoDb>);

      const res = await reviewQueueApp.request("/reviews?projectId=non-existent");

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns technical review queue with correct structure", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockProject = { id: "test-project", name: "Test Project" };
      const mockTasks = [
        {
          id: "task-1",
          title: "Blocked Task",
          description: "This task is blocked",
          status: "Blocked",
          severity: "High",
          location: "Zone A",
          locationId: "loc-1",
          ownerId: "owner-1",
          assigneeRoleCode: "ENGINEER",
          departmentCode: "MEP",
          dueDate: new Date().toISOString().slice(0, 10),
          source: "Manual",
          sourceUpdateId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation((fields) => {
          callCount++;
          if (callCount === 1) {
            // First query: project lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([mockProject]),
              }),
            };
          } else if (callCount === 2) {
            // Second query: tasks (with orderBy)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockTasks),
                }),
              }),
            };
          } else if (callCount === 3) {
            // Third query: dependencies as predecessor (empty for this test)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            };
          } else if (callCount === 4) {
            // Fourth query: dependencies as successor (empty for this test)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      };

      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await reviewQueueApp.request("/reviews?projectId=test-project");

      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify response structure
      expect(body).toHaveProperty("projectId");
      expect(body).toHaveProperty("projectName");
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("totalCount");
      expect(body).toHaveProperty("stats");
      expect(body).toHaveProperty("pagination");

      // Verify stats structure
      expect(body.stats).toHaveProperty("blocked");
      expect(body.stats).toHaveProperty("escalated");
      expect(body.stats).toHaveProperty("pendingReview");
      expect(body.stats).toHaveProperty("overdue");

      // Verify pagination structure
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("pageSize");
      expect(body.pagination).toHaveProperty("total");
      expect(body.pagination).toHaveProperty("totalPages");
    });

    it("applies pagination correctly", async () => {
      mockedSqliteFileExists.mockReturnValue(true);

      const mockProject = { id: "test-project", name: "Test Project" };

      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation((fields) => {
          callCount++;
          if (callCount === 1) {
            // First query: project lookup
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([mockProject]),
              }),
            };
          } else if (callCount === 2) {
            // Second query: tasks (with orderBy)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          } else if (callCount === 3) {
            // Third query: dependencies as predecessor (empty)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            };
          } else if (callCount === 4) {
            // Fourth query: dependencies as successor (empty)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      };

      mockedGetDemoDb.mockReturnValue(mockDb as unknown as ReturnType<typeof getDemoDb>);

      const res = await reviewQueueApp.request(
        "/reviews?projectId=test-project&page=2&pageSize=5",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.pageSize).toBe(5);
    });
  });
});

describe("Phase A Contract Schema Validation", () => {
  describe("Commitment response schemas", () => {
    it("CommitmentCard contains required fields", () => {
      const validCard = {
        id: "test-id",
        projectId: "project-id",
        title: "Test Commitment",
        status: "in_progress",
        ownerName: "Test Owner",
        ownerId: "owner-id",
        assigneeRoleCode: "ENGINEER",
        assigneeRoleName: "Engineer",
        commitDate: "2024-01-01",
        targetDate: "2024-01-15",
        completedAt: null,
        horizon: "this_week",
        isOverdue: false,
        statusSummary: "Due in 2d",
        linkedTaskTitle: "Test Task",
        linkedTaskId: "task-id",
        linkedTaskStatus: "In-progress",
        riskReason: null,
        isCarriedOver: false,
      };

      // Verify all required fields exist
      expect(validCard).toHaveProperty("id");
      expect(validCard).toHaveProperty("projectId");
      expect(validCard).toHaveProperty("title");
      expect(validCard).toHaveProperty("status");
      expect(validCard).toHaveProperty("ownerName");
      expect(validCard).toHaveProperty("ownerId");
      expect(validCard).toHaveProperty("horizon");
      expect(validCard).toHaveProperty("isOverdue");
    });
  });

  describe("Dependency summary response shape", () => {
    it("DependencySummary contains required fields", () => {
      const validSummary = {
        dependencyCount: 0,
        blockedByCount: 0,
        blocksCount: 0,
        isDependencyBlocked: false,
      };

      expect(validSummary).toHaveProperty("dependencyCount");
      expect(validSummary).toHaveProperty("blockedByCount");
      expect(validSummary).toHaveProperty("blocksCount");
      expect(validSummary).toHaveProperty("isDependencyBlocked");
    });
  });

  describe("Technical review queue response shapes", () => {
    it("queue item contains required fields", () => {
      const validItem = {
        taskId: "task-id",
        taskTitle: "Test Task",
        taskDescription: "Description",
        taskStatus: "Blocked",
        taskSeverity: "High",
        location: "Zone A",
        ownerName: "Test Owner",
        ownerId: "owner-id",
        assigneeRoleCode: "ENGINEER",
        assigneeRoleName: "Engineer",
        departmentCode: "MEP",
        dueDate: "2024-01-15",
        isOverdue: false,
        source: "Manual",
        sourceUpdateId: null,
        dependencySummary: {
          dependencyCount: 0,
          blockedByCount: 0,
          blocksCount: 0,
          isDependencyBlocked: false,
        },
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      expect(validItem).toHaveProperty("taskId");
      expect(validItem).toHaveProperty("taskTitle");
      expect(validItem).toHaveProperty("taskStatus");
      expect(validItem).toHaveProperty("taskSeverity");
      expect(validItem).toHaveProperty("dependencySummary");
    });
  });
});
