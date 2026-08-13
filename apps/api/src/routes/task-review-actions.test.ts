import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

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

vi.mock("../lib/audit.js", () => ({
  insertAuditEvent: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn((c: unknown, next: () => Promise<void>) => next()),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { taskReviewsRouter } from "./task-reviews.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

const app = new Hono();
app.route("/tasks", taskReviewsRouter);

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
    }),
  };
}

function createDbMock(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnValue(createSelectChain([])),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    ...overrides,
  } as unknown as ReturnType<typeof getDemoDb>;
}

describe("Task review action routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
  });

  it("submits a task for review via POST /tasks/:taskId/review/submit", async () => {
    const db = createDbMock({
      select: vi
        .fn()
        .mockReturnValueOnce(
          createSelectChain([
            {
              id: "task-1",
              projectId: "project-1",
              status: "in_progress",
            },
          ])
        )
        .mockReturnValueOnce(createSelectChain([{ id: "member-1" }])),
    });
    mockedGetDemoDb.mockReturnValue(db);

    const res = await app.request("/tasks/task-1/review/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        submittedBy: "member-1",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("task-1");
    expect(body.status).toBe("done");
    expect(db.update).toHaveBeenCalled();
  });

  it("approves a reviewed task via POST /tasks/:taskId/review/approve", async () => {
    const db = createDbMock({
      select: vi
        .fn()
        .mockReturnValueOnce(
          createSelectChain([
            {
              id: "task-1",
              projectId: "project-1",
              status: "done",
            },
          ])
        )
        .mockReturnValueOnce(createSelectChain([{ id: "member-1" }])),
    });
    mockedGetDemoDb.mockReturnValue(db);

    const res = await app.request("/tasks/task-1/review/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        approvedBy: "member-1",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("task-1");
    expect(body.status).toBe("done");
    expect(body.approval.approvedBy).toBe("member-1");
  });

  it("requests rework via POST /tasks/:taskId/review/request-rework", async () => {
    const db = createDbMock({
      select: vi
        .fn()
        .mockReturnValueOnce(
          createSelectChain([
            {
              id: "task-1",
              projectId: "project-1",
              status: "done",
            },
          ])
        )
        .mockReturnValueOnce(createSelectChain([{ id: "member-1" }])),
    });
    mockedGetDemoDb.mockReturnValue(db);

    const res = await app.request("/tasks/task-1/review/request-rework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        requestedBy: "member-1",
        reason: "Need a clearer completion note",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("task-1");
    expect(body.status).toBe("in_progress");
    expect(body.rework.requestedBy).toBe("member-1");
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 503 when the database is not ready", async () => {
    mockedSqliteFileExists.mockReturnValue(false);
    mockedGetDemoDb.mockReturnValue(createDbMock());

    const res = await app.request("/tasks/task-1/review/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "project-1",
        submittedBy: "member-1",
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("DB_NOT_FOUND");
  });
});
