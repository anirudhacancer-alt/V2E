/**
 * Task Dependency Summary Helper
 *
 * Computes real dependency summaries from the task_dependencies table.
 * Replaces stub implementations from Phase A.
 *
 * Phase H: Real dependency computation for the technical review queue and task cards.
 */

import { eq, inArray } from "drizzle-orm";
import type { DependencySummary } from "@v2e/contracts";
import type { DemoDb } from "@v2e/database";
import { taskDependencies, tasks } from "@v2e/database";

/**
 * Compute dependency summary for a single task.
 */
export async function computeDependencySummary(
  db: DemoDb,
  taskId: string
): Promise<DependencySummary> {
  // Get all dependencies for this task (both as predecessor and successor)
  const [asPredecessor, asSuccessor] = await Promise.all([
    // This task blocks others (successors)
    db
      .select({
        successorTaskId: taskDependencies.successorTaskId,
        isHardConstraint: taskDependencies.isHardConstraint,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.predecessorTaskId, taskId)),
    // This task is blocked by others (predecessors)
    db
      .select({
        predecessorTaskId: taskDependencies.predecessorTaskId,
        isHardConstraint: taskDependencies.isHardConstraint,
      })
      .from(taskDependencies)
      .where(eq(taskDependencies.successorTaskId, taskId)),
  ]);

  const dependencyCount = asPredecessor.length + asSuccessor.length;
  const blocksCount = asPredecessor.length;

  // Check which predecessors are not done (blocking)
  const predecessorIds = asSuccessor.map((d) => d.predecessorTaskId);
  let blockedByCount = 0;
  let isDependencyBlocked = false;

  if (predecessorIds.length > 0) {
    const predecessorStatuses = await db
      .select({
        id: tasks.id,
        status: tasks.status,
      })
      .from(tasks)
      .where(inArray(tasks.id, predecessorIds));

    const statusById = new Map(predecessorStatuses.map((p) => [p.id, p.status]));

    for (const dep of asSuccessor) {
      const predecessorStatus = statusById.get(dep.predecessorTaskId);
      if (predecessorStatus !== "Done") {
        blockedByCount++;
        if (dep.isHardConstraint) {
          isDependencyBlocked = true;
        }
      }
    }
  }

  return {
    dependencyCount,
    blockedByCount,
    blocksCount,
    isDependencyBlocked,
  };
}

/**
 * Compute dependency summaries for multiple tasks in a batch.
 * More efficient than calling computeDependencySummary for each task individually.
 */
export async function computeDependencySummaries(
  db: DemoDb,
  taskIds: string[]
): Promise<Map<string, DependencySummary>> {
  if (taskIds.length === 0) {
    return new Map();
  }

  // Get all dependencies where any of the tasks are involved
  const allAsPredecessor = await db
    .select({
      predecessorTaskId: taskDependencies.predecessorTaskId,
      successorTaskId: taskDependencies.successorTaskId,
      isHardConstraint: taskDependencies.isHardConstraint,
    })
    .from(taskDependencies)
    .where(inArray(taskDependencies.predecessorTaskId, taskIds));

  // These tasks are blocked by others
  const allAsSuccessor = await db
    .select({
      predecessorTaskId: taskDependencies.predecessorTaskId,
      successorTaskId: taskDependencies.successorTaskId,
      isHardConstraint: taskDependencies.isHardConstraint,
    })
    .from(taskDependencies)
    .where(inArray(taskDependencies.successorTaskId, taskIds));

  // Collect all predecessor IDs to check their statuses
  const allPredecessorIds = [
    ...new Set(allAsSuccessor.map((d) => d.predecessorTaskId)),
  ];

  const predecessorStatuses =
    allPredecessorIds.length > 0
      ? await db
          .select({
            id: tasks.id,
            status: tasks.status,
          })
          .from(tasks)
          .where(inArray(tasks.id, allPredecessorIds))
      : [];

  const statusById = new Map(predecessorStatuses.map((p) => [p.id, p.status]));

  // Initialize summaries for all tasks
  const summaries = new Map<string, DependencySummary>();
  for (const taskId of taskIds) {
    summaries.set(taskId, {
      dependencyCount: 0,
      blockedByCount: 0,
      blocksCount: 0,
      isDependencyBlocked: false,
    });
  }

  // Count as predecessor (this task blocks others)
  for (const dep of allAsPredecessor) {
    const summary = summaries.get(dep.predecessorTaskId)!;
    summary.dependencyCount++;
    summary.blocksCount++;
  }

  // Count as successor (this task is blocked by others)
  for (const dep of allAsSuccessor) {
    const summary = summaries.get(dep.successorTaskId)!;
    summary.dependencyCount++;

    const predecessorStatus = statusById.get(dep.predecessorTaskId);
    if (predecessorStatus !== "Done") {
      summary.blockedByCount++;
      if (dep.isHardConstraint) {
        summary.isDependencyBlocked = true;
      }
    }
  }

  return summaries;
}
