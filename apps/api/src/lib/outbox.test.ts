import { describe, expect, it, vi } from "vitest";
import { deliveryAttempts, notifications } from "@v2e/database";

import { processOutboxBatch } from "./outbox.js";

type SelectStep =
  | { type: "where"; result: unknown }
  | { type: "from"; result: unknown }
  | { type: "whereLimit"; result: unknown }
  | { type: "whereOrderByLimit"; result: unknown };

function createSelectMock(steps: SelectStep[]) {
  let index = 0;
  return vi.fn().mockImplementation(() => {
    const step = steps[index++];
    if (!step) {
      throw new Error(`Missing select mock step at index ${index - 1}`);
    }

    if (step.type === "from") {
      return {
        from: vi.fn().mockResolvedValue(step.result),
      };
    }

    if (step.type === "where") {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(step.result),
        }),
      };
    }

    if (step.type === "whereLimit") {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(step.result),
          }),
        }),
      };
    }

    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(step.result),
          }),
        }),
      }),
    };
  });
}

describe("processOutboxBatch", () => {
  it("creates an in-app notification for a direct notifyUserId recipient", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const updates: Array<{ table: unknown; values: unknown }> = [];

    const db = {
      select: createSelectMock([
        { type: "where", result: [] },
        { type: "from", result: [] },
        {
          type: "whereOrderByLimit",
          result: [
            {
              id: "outbox-1",
              tenantId: "demo",
              eventType: "task.assigned",
              payload: JSON.stringify({
                notifyUserId: "user-1",
                entityType: "task",
                entityId: "task-1",
                title: "Task assigned",
                body: "You own task-1",
              }),
              status: "pending",
              attempts: 0,
              nextAttemptAt: null,
              processedAt: null,
              lastError: null,
              createdAt: "2026-03-27T10:00:00Z",
            },
          ],
        },
        {
          type: "whereLimit",
          result: [{ id: "user-1", email: "user@example.com" }],
        },
        { type: "whereLimit", result: [] },
        { type: "whereLimit", result: [] },
        { type: "whereLimit", result: [] },
      ]),
      insert: vi.fn((table) => ({
        values: vi.fn(async (values) => {
          inserts.push({ table, values });
        }),
      })),
      update: vi.fn((table) => ({
        set: vi.fn((values) => ({
          where: vi.fn(async () => {
            updates.push({ table, values });
          }),
        })),
      })),
    };

    const result = await processOutboxBatch(db as any);

    expect(result).toEqual({ processed: 1, errors: 0 });
    expect(inserts.some((entry) => entry.table === notifications)).toBe(true);
    expect(inserts.some((entry) => entry.table === deliveryAttempts)).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].values).toMatchObject({
      status: "delivered",
    });
  });
});
