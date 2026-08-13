/**
 * Phase G Routes - Vitest Tests
 *
 * Tests for:
 * - Files
 * - Unified attachments
 * - Update extraction subresource
 * - AI jobs (voice-note extraction, standup summary)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import * as fs from "fs";

const { mockExtract, mockSummarize, mockAutoTaskOutcome } = vi.hoisted(() => ({
  mockExtract: vi.fn(),
  mockSummarize: vi.fn(),
  mockAutoTaskOutcome: vi.fn(),
}));

vi.mock("../db.js", () => ({
  getDemoDb: vi.fn(),
}));

vi.mock("../env.js", () => ({
  sqliteFileExists: vi.fn(),
  resolveSqlitePath: vi.fn(() => "/mock/path/demo.sqlite"),
  V2E_API_TOKEN: "test-token",
  V2E_API_USER_ID: "test-user-id",
  AI_GATEWAY_URL: "http://localhost:3001",
  LOW_CONFIDENCE_THRESHOLD: 0.7,
}));

vi.mock("../lib/logger.js", () => ({
  opsLog: vi.fn(),
}));

vi.mock("../lib/audit.js", () => ({
  insertAuditEvent: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn((c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("../lib/extraction-auto-task.js", () => ({
  applyPostExtractionAutoTask: vi.fn((...args) => mockAutoTaskOutcome(...args)),
}));

vi.mock("../lib/standup-prep-from-tasks.js", () => ({
  standupPrepDateBounds: vi.fn(() => ({
    todayYmd: "2026-03-27",
    yesterdayYmd: "2026-03-26",
  })),
  plannedForTodayTasks: vi.fn(() => [
    {
      title: "Install conduit",
      description: "",
      location: "Zone A",
      department: "ELEC",
    },
  ]),
  completedYesterdayTasks: vi.fn(() => [
    {
      title: "Closed punch list",
      description: "",
      location: "Zone B",
    },
  ]),
}));

vi.mock("../lib/task-state.js", () => ({
  deriveSupervisorTaskState: vi.fn((task: { status?: string }) =>
    task.status === "blocked" ? "Blocked" : "In-progress"
  ),
}));

vi.mock("../lib/member-integrity.js", () => ({
  assertNoUnresolvedMemberRoles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@v2e/ai", () => ({
  GatewayClient: vi.fn(),
  ExtractionService: vi.fn().mockImplementation(() => ({
    extract: mockExtract,
  })),
  StandupSummaryService: vi.fn().mockImplementation(() => ({
    summarize: mockSummarize,
  })),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => Buffer.from("test content")),
  unlinkSync: vi.fn(),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { filesRouter } from "./files.js";
import { attachmentsRouter } from "./attachments.js";
import { updateExtractionRouter } from "./update-extraction.js";
import { aiJobsRouter } from "./ai-jobs.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);
const mockedFs = vi.mocked(fs);

const phaseGApp = new Hono();
phaseGApp.route("/files", filesRouter);
phaseGApp.route("/attachments", attachmentsRouter);
phaseGApp.route("/updates", updateExtractionRouter);
phaseGApp.route("/ai", aiJobsRouter);

const mockFile = {
  id: "file-1",
  storageKey: "file-1.jpg",
  fileName: "test.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  checksum: null,
  uploadedByUserId: null,
  createdAt: "2026-03-27T10:00:00Z",
};

const mockUpdateAttachment = {
  id: "att-1",
  updateId: "update-1",
  taskId: null,
  url: "/uploads/file-1.jpg",
  type: "Image",
  uploadedAt: "2026-03-27T10:00:00Z",
};

const mockTaskAttachment = {
  id: "task-att-1",
  taskId: "task-1",
  url: "/uploads/file-2.jpg",
  type: "Image",
  uploadedAt: "2026-03-27T10:00:00Z",
};

const mockAiOutputRow = {
  id: "ai-output-1",
  updateId: "update-1",
  category: "Blocker",
  departmentCode: "ELEC",
  location: "Tower A",
  locationId: "loc-1",
  blockerSubtype: "MaterialDelay",
  locationBlock: "A",
  locationZone: "Zone1",
  locationLevel: "L2",
  locationArea: null,
  vendor: null,
  severity: "High",
  ownerRoleCode: "SITE_SUPERVISOR",
  ownerId: null,
  dueDate: "2026-04-01",
  generatedTaskDescription: "Fix electrical issue",
  riskImpact: "Schedule delay",
  scheduleRisk: "Medium",
  confidence: 0.85,
  reviewRequired: 1,
  reviewPrompt: "Confirm severity",
  reviewReasonsJson: "[]",
  reviewFieldsJson: "[]",
  humanReviewRequired: 0,
  reviewStatus: "pending",
  reviewedAt: null,
  reviewedBy: null,
  suggestedSnapshotJson: null,
};

const mockUpdate = {
  id: "update-1",
  projectId: "11111111-1111-4111-8111-111111111111",
  siteId: "site-1",
  transcript: "There is a blocked electrical issue on floor 2.",
  locationId: "loc-1",
  extractIdempotencyKey: null,
};

const mockProject = {
  id: "11111111-1111-4111-8111-111111111111",
  siteId: "site-1",
  name: "Test Project",
};

const mockTask = {
  id: "task-1",
  projectId: "11111111-1111-4111-8111-111111111111",
};

function createAwaitableResult<T>(result: T) {
  const promise = Promise.resolve(result) as Promise<T> & {
    limit: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
  };
  promise.limit = vi.fn().mockResolvedValue(result);
  promise.orderBy = vi.fn().mockResolvedValue(result);
  return promise;
}

function createSelectChain<T>(result: T) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(createAwaitableResult(result)),
      orderBy: vi.fn().mockResolvedValue(result),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function createDbMock(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnValue(createSelectChain([])),
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
  } as unknown as ReturnType<typeof getDemoDb>;
}

describe("Phase G Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
    mockedFs.existsSync.mockReturnValue(true);
    mockAutoTaskOutcome.mockResolvedValue({
      kind: "created",
      taskId: "task-new",
      band: "medium",
    });
    mockExtract.mockResolvedValue({
      aiOutput: {
        extractedInfo: {
          category: "Blocker",
          department: "Electrical",
          location: "Floor 2",
          vendor: "MaterialDelay",
          severity: "High",
        },
        suggestedAssignment: {
          ownerRole: "Site Supervisor",
          ownerId: null,
          dueDate: "2026-04-01",
        },
        generatedTaskDescription: "Fix electrical issue",
        riskAssessment: {
          impact: "Schedule delay",
          downstreamEffects: ["Crew idle time"],
          scheduleRisk: "Medium",
          recommendedActions: ["Escalate supplier"],
        },
        confidence: 0.85,
        reviewRequirement: {
          required: false,
          reasons: [],
          fields: [],
        },
      },
      modelUsed: "gpt-test",
      processingTimeMs: 321,
    });
    mockSummarize.mockResolvedValue({
      summaryText: "Today we closed punch list items and are watching one blocker.",
      modelUsed: "gpt-test",
      processingTimeMs: 123,
    });

    app = new Hono();
    app.route("/", phaseGApp);
  });

  describe("Files Routes", () => {
    it("uploads a file and creates metadata", async () => {
      mockedGetDemoDb.mockReturnValue(createDbMock());

      const formData = new FormData();
      const blob = new Blob(["test content"], { type: "image/jpeg" });
      formData.append("file", blob, "test.jpg");

      const res = await app.request("/files", { method: "POST", body: formData });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.fileName).toBe("test.jpg");
      expect(body.mimeType).toBe("image/jpeg");
      expect(body.url).toMatch(/^\/uploads\//);
    });

    it("returns file metadata", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockFile])),
        })
      );

      const res = await app.request("/files/file-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("file-1");
      expect(body.url).toBe("/uploads/file-1.jpg");
    });

    it("serves file content", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockFile])),
        })
      );

      const res = await app.request("/files/file-1/content");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Content-Length")).toBe("1024");
    });

    it("deletes file metadata", async () => {
      const db = createDbMock({
        select: vi.fn().mockReturnValue(createSelectChain([mockFile])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/files/file-1", { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("Unified Attachments Routes", () => {
    it("lists update attachments", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockUpdateAttachment])),
        })
      );

      const res = await app.request(
        "/attachments?parentType=update&parentId=update-1"
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].parentType).toBe("update");
      expect(body.items[0].parentId).toBe("update-1");
    });

    it("lists task attachments", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockTaskAttachment])),
        })
      );

      const res = await app.request("/attachments?parentType=task&parentId=task-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].parentType).toBe("task");
      expect(body.items[0].parentId).toBe("task-1");
    });

    it("returns 400 when parentType or parentId is missing", async () => {
      mockedGetDemoDb.mockReturnValue(createDbMock());

      const res = await app.request("/attachments");
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns a single attachment by id", async () => {
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([mockTaskAttachment]))
          .mockReturnValueOnce(createSelectChain([])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/attachments/task-att-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("task-att-1");
      expect(body.parentType).toBe("task");
    });

    it("creates an update attachment", async () => {
      const db = createDbMock({
        select: vi.fn().mockReturnValue(createSelectChain([mockUpdate])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentType: "update",
          parentId: "update-1",
          url: "/uploads/test.jpg",
          type: "Image",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.parentType).toBe("update");
      expect(body.parentId).toBe("update-1");
    });

    it("creates a task attachment", async () => {
      const db = createDbMock({
        select: vi.fn().mockReturnValue(createSelectChain([mockTask])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentType: "task",
          parentId: "task-1",
          url: "/uploads/test.jpg",
          type: "Image",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.parentType).toBe("task");
      expect(body.parentId).toBe("task-1");
    });

    it("deletes an update attachment", async () => {
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([]))
          .mockReturnValueOnce(createSelectChain([mockUpdateAttachment]))
          .mockReturnValueOnce(createSelectChain([mockUpdate])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/attachments/att-1", { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("Update Extraction Subresource Routes", () => {
    it("gets an extraction by update id", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockAiOutputRow])),
        })
      );

      const res = await app.request("/updates/update-1/extraction");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("ai-output-1");
      expect(body.reviewRequired).toBe(true);
      expect(body.humanReviewRequired).toBe(false);
    });

    it("patches extraction review fields", async () => {
      const updatedRow = {
        ...mockAiOutputRow,
        reviewStatus: "accepted",
        reviewedAt: "2026-03-27T12:00:00Z",
        reviewedBy: "user-1",
      };
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([mockAiOutputRow]))
          .mockReturnValueOnce(createSelectChain([updatedRow])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/updates/update-1/extraction", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "accepted",
          reviewedAt: "2026-03-27T12:00:00Z",
          reviewedBy: "user-1",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.reviewStatus).toBe("accepted");
      expect(body.reviewedBy).toBe("user-1");
      expect(db.update).toHaveBeenCalled();
    });

    it("returns 404 when extraction is missing", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([])),
        })
      );

      const res = await app.request("/updates/missing/extraction");
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("AI Jobs Routes", () => {
    it("runs voice-note extraction", async () => {
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([mockUpdate]))
          .mockReturnValueOnce(createSelectChain([mockProject]))
          .mockReturnValueOnce(createSelectChain([{ code: "ELEC" }]))
          .mockReturnValueOnce(createSelectChain([{ id: "loc-1" }]))
          .mockReturnValueOnce(createSelectChain([{ code: "SITE_SUPERVISOR" }]))
          .mockReturnValueOnce(createSelectChain([])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/ai/voice-note-extraction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-1",
        },
        body: JSON.stringify({
          projectId: "11111111-1111-4111-8111-111111111111",
          updateId: "update-1",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.updateId).toBe("update-1");
      expect(body.modelUsed).toBe("gpt-test");
      expect(body.processingTimeMs).toBe(321);
      expect(body.autoTaskOutcome.kind).toBe("created");
      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it("returns 400 when projectId is missing", async () => {
      mockedGetDemoDb.mockReturnValue(createDbMock());

      const res = await app.request("/ai/voice-note-extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updateId: "update-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("MISSING_PROJECT_ID");
    });

    it("returns 400 when updateId is missing", async () => {
      mockedGetDemoDb.mockReturnValue(createDbMock());

      const res = await app.request("/ai/voice-note-extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "11111111-1111-4111-8111-111111111111",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 on project mismatch", async () => {
      mockedGetDemoDb.mockReturnValue(
        createDbMock({
          select: vi.fn().mockReturnValue(createSelectChain([mockUpdate])),
        })
      );

      const res = await app.request("/ai/voice-note-extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "22222222-2222-4222-8222-222222222222",
          updateId: "update-1",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("PROJECT_SCOPE_MISMATCH");
    });

    it("returns cached extraction on idempotent replay", async () => {
      const cachedUpdate = {
        ...mockUpdate,
        extractIdempotencyKey: "idem-1",
      };
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([cachedUpdate]))
          .mockReturnValueOnce(createSelectChain([mockAiOutputRow]))
          .mockReturnValueOnce(createSelectChain([{ name: "Site Supervisor" }]))
          .mockReturnValueOnce(createSelectChain([{ effect: "Crew idle time" }]))
          .mockReturnValueOnce(createSelectChain([{ action: "Escalate supplier" }]))
          .mockReturnValueOnce(createSelectChain([{ id: "task-new" }])),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/ai/voice-note-extraction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "idem-1",
        },
        body: JSON.stringify({
          projectId: "11111111-1111-4111-8111-111111111111",
          updateId: "update-1",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.idempotentReplay).toBe(true);
      expect(body.modelUsed).toBe("cached");
      expect(body.autoTaskOutcome.kind).toBe("created");
      expect(mockExtract).not.toHaveBeenCalled();
    });

    it("generates a standup summary without persistence", async () => {
      const db = createDbMock({
        select: vi
          .fn()
          .mockReturnValueOnce(createSelectChain([mockProject]))
          .mockReturnValueOnce(createSelectChain([{ id: "site-1" }]))
          .mockReturnValueOnce(
            createSelectChain([
              {
                id: "member-1",
                name: "Alex",
                orgRoleCode: "SITE_SUPERVISOR",
                roleTypeName: "Site Supervisor",
                isActive: "true",
              },
            ])
          )
          .mockReturnValueOnce(
            createSelectChain([
              {
                id: "task-1",
                title: "Electrical blocker",
                description: "Waiting on material",
                ownerId: "member-1",
                severity: "High",
                location: "Floor 2",
                departmentCode: "ELEC",
                status: "blocked",
                dueDate: "2026-03-27",
                completedAt: null,
              },
            ])
          ),
      });
      mockedGetDemoDb.mockReturnValue(db);

      const res = await app.request("/ai/standup-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "project-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.projectId).toBe("project-1");
      expect(body.summaryText).toContain("closed punch list");
      expect(body.modelUsed).toBe("gpt-test");
      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("Common Error Cases", () => {
    it("returns 503 when database is not ready for canonical endpoints", async () => {
      mockedSqliteFileExists.mockReturnValue(false);

      const endpoints = [
        { method: "GET", path: "/files/file-1" },
        { method: "GET", path: "/attachments?parentType=update&parentId=update-1" },
        { method: "GET", path: "/updates/update-1/extraction" },
        { method: "POST", path: "/ai/standup-summary", body: JSON.stringify({ projectId: "project-1" }) },
      ];

      for (const endpoint of endpoints) {
        const res = await app.request(endpoint.path, {
          method: endpoint.method,
          headers: endpoint.body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: endpoint.body,
        });
        const body = await res.json();

        expect(res.status).toBe(503);
        expect(body.error.code).toBe("DB_NOT_FOUND");
      }
    });
  });
});
