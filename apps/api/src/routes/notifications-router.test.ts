import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../db.js", () => ({
  getDemoDb: vi.fn(),
}));

vi.mock("../env.js", () => ({
  sqliteFileExists: vi.fn(),
  resolveSqlitePath: vi.fn(() => "/mock/path/demo.sqlite"),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set("userId", "user-1");
    await next();
  }),
}));

import { getDemoDb } from "../db.js";
import { sqliteFileExists } from "../env.js";
import { notificationsRouter } from "./notifications.js";

const mockedGetDemoDb = vi.mocked(getDemoDb);
const mockedSqliteFileExists = vi.mocked(sqliteFileExists);

function createSelectChain(result: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(result),
          }),
        }),
      }),
    }),
  };
}

describe("notifications router", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSqliteFileExists.mockReturnValue(true);
    app = new Hono();
    app.route("/", notificationsRouter);
  });

  it("lists notifications for the authenticated user", async () => {
    mockedGetDemoDb.mockReturnValue({
      select: vi.fn().mockReturnValue(createSelectChain([
        {
          id: "notif-1",
          tenantId: "demo",
          userId: "user-1",
          type: "task.assigned",
          title: "Task assigned",
          body: "You own task-1",
          entityType: "task",
          entityId: "task-1",
          status: "unread",
          createdAt: "2026-03-27T10:00:00Z",
          readAt: null,
        },
      ])),
    } as any);

    const res = await app.request("/?status=unread&type=task.assigned");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].userId).toBe("user-1");
    expect(body.total).toBe(1);
  });

  it("returns 404 when a notification is not owned by the authenticated user", async () => {
    mockedGetDemoDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const res = await app.request("/notif-foreign");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when updating a notification not owned by the authenticated user", async () => {
    mockedGetDemoDb.mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const res = await app.request("/notif-foreign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
