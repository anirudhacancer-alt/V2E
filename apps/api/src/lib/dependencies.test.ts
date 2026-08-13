/**
 * Unit tests for dependency summary helpers (Phase H).
 */

import { describe, expect, it, vi } from "vitest";

import {
  computeDependencySummary,
  computeDependencySummaries,
} from "./dependencies.js";

describe("dependencies", () => {
  describe("computeDependencySummary", () => {
    it("returns zeros when task has no dependencies", async () => {
      const db = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
      };

      const s = await computeDependencySummary(db as never, "task-a");

      expect(s).toEqual({
        dependencyCount: 0,
        blockedByCount: 0,
        blocksCount: 0,
        isDependencyBlocked: false,
      });
    });

    it("counts blocks and dependencyBlocked when hard predecessor is not Done", async () => {
      const db = {
        select: vi
          .fn()
          // as predecessor: this task blocks one successor
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  successorTaskId: "succ-1",
                  isHardConstraint: false,
                },
              ]),
            }),
          })
          // as successor: one incomplete hard predecessor
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  predecessorTaskId: "pred-1",
                  isHardConstraint: true,
                },
              ]),
            }),
          })
          // predecessor task statuses
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "pred-1", status: "In-progress" },
              ]),
            }),
          }),
      };

      const s = await computeDependencySummary(db as never, "task-mid");

      expect(s.dependencyCount).toBe(2);
      expect(s.blocksCount).toBe(1);
      expect(s.blockedByCount).toBe(1);
      expect(s.isDependencyBlocked).toBe(true);
    });
  });

  describe("computeDependencySummaries", () => {
    it("returns empty map for empty taskIds", async () => {
      const db = { select: vi.fn() };
      const m = await computeDependencySummaries(db as never, []);
      expect(m.size).toBe(0);
      expect(db.select).not.toHaveBeenCalled();
    });

    it("aggregates edges and predecessor status for multiple tasks", async () => {
      const taskIds = ["t1", "t2"];
      const db = {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  predecessorTaskId: "t1",
                  successorTaskId: "t2",
                  isHardConstraint: true,
                },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  predecessorTaskId: "t1",
                  successorTaskId: "t2",
                  isHardConstraint: true,
                },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "t1", status: "Done" },
              ]),
            }),
          }),
      };

      const m = await computeDependencySummaries(db as never, taskIds);

      expect(m.get("t1")).toMatchObject({
        dependencyCount: 1,
        blocksCount: 1,
        blockedByCount: 0,
        isDependencyBlocked: false,
      });
      expect(m.get("t2")).toMatchObject({
        dependencyCount: 1,
        blocksCount: 0,
        blockedByCount: 0,
        isDependencyBlocked: false,
      });
    });
  });
});
