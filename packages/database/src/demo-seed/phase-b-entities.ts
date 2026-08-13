/**
 * Phase B Entity Generation
 *
 * Generates persisted Phase B entities:
 * - WorkCycles: weekly/bi-weekly planning horizons
 * - Commitments: derived from tasks with reliability tracking
 * - TaskDependencies: explicit sequencing and constraint management
 *
 * See: docs/data-model/plans/phase-B-persisted-commitments-and-dependencies.md
 */

import {
  addUtcDays,
  offsetFromHash,
  sortBySeed,
  startOfUtcDay,
  startOfWeekUtc,
  toIso,
  withUtcTime,
} from "./helpers.js";
import { legacyUserRoleStringToRoleTypeCode } from "../org-canonical.js";
import type { CsvRow } from "./types.js";

// ============================================================================
// Phase B Configuration
// ============================================================================

export const PHASE_B_CONFIG = {
  /** Number of work cycles per project (1-2). */
  workCyclesPerProject: { min: 1, max: 2 },
  /** Number of commitments per project (10-15). */
  commitmentsPerProject: { min: 10, max: 15 },
  /** Number of dependency chains per project (3-5). */
  dependencyChainsPerProject: { min: 3, max: 5 },
  /** Length of serial dependency chains (2-4 tasks). */
  serialChainLength: { min: 2, max: 4 },
  /** Work cycle duration in days. */
  workCycleDurationDays: 7,
  /** Commitment status distribution. */
  commitmentStatusRatios: {
    planned: 0.25,
    in_progress: 0.35,
    completed: 0.2,
    at_risk: 0.1,
    missed: 0.05,
    carried_over: 0.05,
  },
  /** Dependency type distribution. */
  dependencyTypeRatios: {
    finish_to_start: 0.7,
    blocks: 0.2,
    start_to_start: 0.05,
    finish_to_finish: 0.05,
  },
} as const;

export const PHASE_B_VALIDATION_TARGETS = {
  /** Minimum work cycles per project. */
  minWorkCyclesPerProject: 1,
  /** Minimum commitments per project. */
  minCommitmentsPerProject: 8,
  /** Minimum task dependencies per project. */
  minDependenciesPerProject: 3,
  /** Minimum serial chains per project. */
  minSerialChains: 2,
  /** Minimum carried-over commitments. */
  minCarriedOverCommitments: 1,
} as const;

// ============================================================================
// Types
// ============================================================================

export type CommitmentStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "at_risk"
  | "missed"
  | "carried_over";

export type DependencyType =
  | "finish_to_start"
  | "blocks"
  | "start_to_start"
  | "finish_to_finish";

export interface WorkCycleRow {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "closed";
  goal: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommitmentRow {
  id: string;
  tenantId: string;
  projectId: string;
  siteId: string;
  workCycleId: string | null;
  standupSessionId: string | null;
  sourceTaskId: string | null;
  title: string;
  description: string | null;
  ownerId: string;
  assigneeRoleCode: string;
  status: CommitmentStatus;
  commitDate: string;
  targetDate: string;
  completedAt: string | null;
  carriedOverFromCommitmentId: string | null;
  riskReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependencyRow {
  id: string;
  tenantId: string;
  projectId: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: DependencyType;
  lagDays: number;
  isHardConstraint: number;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Work Cycle Generation
// ============================================================================

/**
 * Generates work cycles for a project.
 * Creates 1-2 weekly cycles centered around the anchor date.
 */
export function generateWorkCycles(
  projectId: string,
  _siteId: string,
  tenantId: string,
  anchorDate: Date,
  seed: string
): WorkCycleRow[] {
  const workCycles: WorkCycleRow[] = [];
  const weekStart = startOfWeekUtc(anchorDate);

  const numCycles = offsetFromHash(
    seed,
    `${projectId}:cycles:count`,
    PHASE_B_CONFIG.workCyclesPerProject.min,
    PHASE_B_CONFIG.workCyclesPerProject.max
  );

  for (let i = 0; i < numCycles; i++) {
    const cycleStart = addUtcDays(weekStart, -7 * i);
    const cycleEnd = addUtcDays(cycleStart, PHASE_B_CONFIG.workCycleDurationDays - 1);

    // Determine status based on anchor date
    let status: WorkCycleRow["status"];
    if (cycleEnd.getTime() < startOfUtcDay(anchorDate).getTime()) {
      status = "closed";
    } else if (cycleStart.getTime() <= startOfUtcDay(anchorDate).getTime()) {
      status = "active";
    } else {
      status = "planned";
    }

    const cycleId = `wc-${projectId.slice(0, 8)}-${i + 1}`;
    const createdAt = withUtcTime(addUtcDays(cycleStart, -2), 9, 0);

    workCycles.push({
      id: cycleId,
      tenantId,
      projectId,
      name: `Week ${i === 0 ? "Current" : i === 1 ? "Previous" : `${i + 1}`}`,
      startDate: toIso(cycleStart).slice(0, 10),
      endDate: toIso(cycleEnd).slice(0, 10),
      status,
      goal: i === 0
        ? "Complete active scope and resolve blockers"
        : "Archive completed work",
      createdAt: toIso(createdAt),
      updatedAt: toIso(withUtcTime(anchorDate, 10, 0)),
    });
  }

  return workCycles;
}

// ============================================================================
// Commitment Generation
// ============================================================================

/**
 * Derives commitment status from task status and dates.
 */
function deriveCommitmentStatus(
  task: CsvRow,
  anchorDate: Date,
  seed: string
): CommitmentStatus {
  const anchor = startOfUtcDay(anchorDate);
  const dueDate = startOfUtcDay(new Date(task.dueDate));

  if (task.status === "Done") {
    return "completed";
  }

  if (task.status === "Blocked") {
    // Some blocked tasks are at risk, some are carried over
    const roll = offsetFromHash(seed, `${task.id}:blocked-status`, 0, 100);
    if (roll < 60) return "at_risk";
    if (roll < 85) return "carried_over";
    return "missed";
  }

  if (dueDate.getTime() < anchor.getTime()) {
    // Overdue
    const roll = offsetFromHash(seed, `${task.id}:overdue-status`, 0, 100);
    if (roll < 40) return "missed";
    if (roll < 70) return "carried_over";
    return "at_risk";
  }

  if (task.status === "In-progress") {
    return "in_progress";
  }

  return "planned";
}

/**
 * Generates commitments derived from tasks.
 * Each commitment tracks reliability of task delivery.
 */
export function generateCommitments(
  tasks: CsvRow[],
  workCycles: WorkCycleRow[],
  teamMembers: CsvRow[],
  projectId: string,
  siteId: string,
  tenantId: string,
  anchorDate: Date,
  seed: string
): CommitmentRow[] {
  const commitments: CommitmentRow[] = [];
  const activeWorkCycle = workCycles.find((wc) => wc.status === "active");

  // Select tasks for commitments
  const eligibleTasks = tasks.filter(
    (t) =>
      t.projectId === projectId &&
      ["In-progress", "Blocked", "Done", "Planned"].includes(t.status)
  );

  const numCommitments = Math.min(
    eligibleTasks.length,
    offsetFromHash(
      seed,
      `${projectId}:commitments:count`,
      PHASE_B_CONFIG.commitmentsPerProject.min,
      PHASE_B_CONFIG.commitmentsPerProject.max
    )
  );

  const selectedTasks = sortBySeed(
    eligibleTasks,
    `${seed}:commitments`,
    (t) => t.id
  ).slice(0, numCommitments);

  // Track carried-over commitments for linkage
  const carriedOverCommitments: CommitmentRow[] = [];

  for (let i = 0; i < selectedTasks.length; i++) {
    const task = selectedTasks[i];
    const status = deriveCommitmentStatus(task, anchorDate, seed);

    // Find owner from team members
    const owner = teamMembers.find((tm) => tm.id === task.ownerId) ||
      teamMembers[i % teamMembers.length];

    if (!owner) continue;

    const commitId = `commit-${task.id.slice(0, 8)}-${i}`;
    const commitDate = task.createdAt.slice(0, 10);
    const targetDate = task.dueDate.slice(0, 10);

    // Determine completedAt for completed commitments
    let completedAt: string | null = null;
    if (status === "completed" && task.completedAt) {
      completedAt = task.completedAt;
    }

    // Risk reason for at_risk or missed
    let riskReason: string | null = null;
    if (status === "at_risk") {
      const reasons = [
        "Material delivery delayed",
        "Predecessor task incomplete",
        "Resource unavailable",
        "Scope change impact",
      ];
      riskReason = reasons[offsetFromHash(seed, `${task.id}:risk-reason`, 0, reasons.length - 1)];
    } else if (status === "missed") {
      const reasons = [
        "Dependencies not met",
        "Critical blocker unresolved",
        "Insufficient resources",
      ];
      riskReason = reasons[offsetFromHash(seed, `${task.id}:miss-reason`, 0, reasons.length - 1)];
    }

    // Create carried-over linkage
    let carriedOverFromCommitmentId: string | null = null;
    if (status === "carried_over" && carriedOverCommitments.length > 0) {
      const sourceIdx = offsetFromHash(
        seed,
        `${task.id}:carry-over-source`,
        0,
        carriedOverCommitments.length - 1
      );
      carriedOverFromCommitmentId = carriedOverCommitments[sourceIdx]?.id || null;
    }

    const createdAt = task.createdAt;
    const updatedAt = task.updatedAt;

    const commitment: CommitmentRow = {
      id: commitId,
      tenantId,
      projectId,
      siteId,
      workCycleId: activeWorkCycle?.id || null,
      standupSessionId: null,
      sourceTaskId: task.id,
      title: task.title,
      description: task.description || null,
      ownerId: owner.id,
      assigneeRoleCode: legacyUserRoleStringToRoleTypeCode(task.assigneeRole || owner.role || "Foreman"),
      status,
      commitDate,
      targetDate,
      completedAt,
      carriedOverFromCommitmentId,
      riskReason,
      createdAt,
      updatedAt,
    };

    commitments.push(commitment);

    // Track for carry-over linkage
    if (status === "missed" || status === "at_risk") {
      carriedOverCommitments.push(commitment);
    }
  }

  return commitments;
}

// ============================================================================
// Task Dependency Generation
// ============================================================================

/**
 * Detects cycles in a dependency graph using DFS.
 * Returns true if adding the edge would create a cycle.
 */
function wouldCreateCycle(
  predecessorId: string,
  successorId: string,
  existingDeps: TaskDependencyRow[]
): boolean {
  // Build adjacency list
  const graph = new Map<string, string[]>();
  for (const dep of existingDeps) {
    const successors = graph.get(dep.predecessorTaskId) || [];
    successors.push(dep.successorTaskId);
    graph.set(dep.predecessorTaskId, successors);
  }

  // Add proposed edge
  const successors = graph.get(predecessorId) || [];
  successors.push(successorId);
  graph.set(predecessorId, successors);

  // DFS from successor to check if we can reach predecessor
  const visited = new Set<string>();
  const stack = [successorId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === predecessorId) {
      return true; // Cycle detected
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const nextNodes = graph.get(current) || [];
    stack.push(...nextNodes);
  }

  return false;
}

/**
 * Picks a dependency type based on configured ratios.
 */
function pickDependencyType(seed: string, id: string): DependencyType {
  const roll = offsetFromHash(seed, `${id}:dep-type`, 0, 100);
  let cumulative = 0;

  for (const [type, ratio] of Object.entries(PHASE_B_CONFIG.dependencyTypeRatios)) {
    cumulative += ratio * 100;
    if (roll < cumulative) {
      return type as DependencyType;
    }
  }

  return "finish_to_start";
}

/**
 * Generates task dependencies with serial chains, parallel chains, and carry-over patterns.
 */
export function generateTaskDependencies(
  tasks: CsvRow[],
  teamMembers: CsvRow[],
  projectId: string,
  tenantId: string,
  anchorDate: Date,
  seed: string
): TaskDependencyRow[] {
  const dependencies: TaskDependencyRow[] = [];

  // Filter tasks for this project that can have dependencies
  const projectTasks = tasks.filter(
    (t) =>
      t.projectId === projectId &&
      !["Done"].includes(t.status) // Don't create deps on done tasks as successors
  );

  if (projectTasks.length < 4) {
    return dependencies;
  }

  const sortedTasks = sortBySeed(projectTasks, `${seed}:deps`, (t) => t.id);

  // Get a team member for createdBy
  const creator = teamMembers.find((tm) => tm.siteId) || teamMembers[0];
  if (!creator) return dependencies;

  const numChains = offsetFromHash(
    seed,
    `${projectId}:dep-chains:count`,
    PHASE_B_CONFIG.dependencyChainsPerProject.min,
    PHASE_B_CONFIG.dependencyChainsPerProject.max
  );

  let depIndex = 0;
  let taskIndex = 0;

  // Generate serial chains
  for (let chain = 0; chain < numChains && taskIndex < sortedTasks.length - 1; chain++) {
    const chainLength = offsetFromHash(
      seed,
      `${projectId}:chain:${chain}:length`,
      PHASE_B_CONFIG.serialChainLength.min,
      Math.min(PHASE_B_CONFIG.serialChainLength.max, sortedTasks.length - taskIndex)
    );

    const chainTasks = sortedTasks.slice(taskIndex, taskIndex + chainLength);
    taskIndex += chainLength;

    // Create serial dependencies within the chain
    for (let i = 0; i < chainTasks.length - 1; i++) {
      const predecessor = chainTasks[i];
      const successor = chainTasks[i + 1];

      // Check for cycles
      if (wouldCreateCycle(predecessor.id, successor.id, dependencies)) {
        continue;
      }

      // Self-edge check
      if (predecessor.id === successor.id) {
        continue;
      }

      const depId = `dep-${projectId.slice(0, 8)}-${depIndex}`;
      const depType = pickDependencyType(seed, depId);
      const isHard = depType === "blocks" ? 1 : offsetFromHash(seed, `${depId}:hard`, 0, 1);

      // Lag days: 0-2 for most, 0 for blocks
      const lagDays = depType === "blocks"
        ? 0
        : offsetFromHash(seed, `${depId}:lag`, 0, 2);

      const createdAt = withUtcTime(
        addUtcDays(anchorDate, -offsetFromHash(seed, `${depId}:age`, 2, 14)),
        9,
        30
      );

      dependencies.push({
        id: depId,
        tenantId,
        projectId,
        predecessorTaskId: predecessor.id,
        successorTaskId: successor.id,
        dependencyType: depType,
        lagDays,
        isHardConstraint: isHard,
        reason: `${depType === "blocks" ? "Blocking dependency" : "Sequential work"}: ${predecessor.title.slice(0, 30)} -> ${successor.title.slice(0, 30)}`,
        createdBy: creator.id,
        createdAt: toIso(createdAt),
        updatedAt: toIso(withUtcTime(anchorDate, 10, 15)),
      });

      depIndex++;
    }
  }

  // Generate some parallel dependencies (start-to-start)
  const remainingTasks = sortedTasks.slice(taskIndex);
  const parallelPairs = Math.min(2, Math.floor(remainingTasks.length / 2));

  for (let i = 0; i < parallelPairs && i * 2 + 1 < remainingTasks.length; i++) {
    const predecessor = remainingTasks[i * 2];
    const successor = remainingTasks[i * 2 + 1];

    if (!predecessor || !successor || predecessor.id === successor.id) continue;
    if (wouldCreateCycle(predecessor.id, successor.id, dependencies)) continue;

    const depId = `dep-${projectId.slice(0, 8)}-${depIndex}`;

    const createdAt = withUtcTime(
      addUtcDays(anchorDate, -offsetFromHash(seed, `${depId}:age`, 1, 7)),
      10,
      0
    );

    dependencies.push({
      id: depId,
      tenantId,
      projectId,
      predecessorTaskId: predecessor.id,
      successorTaskId: successor.id,
      dependencyType: "start_to_start",
      lagDays: 0,
      isHardConstraint: 0,
      reason: `Parallel work: can start together`,
      createdBy: creator.id,
      createdAt: toIso(createdAt),
      updatedAt: toIso(withUtcTime(anchorDate, 10, 30)),
    });

    depIndex++;
  }

  return dependencies;
}

// ============================================================================
// Phase B Metrics Collection
// ============================================================================

export interface PhaseBMetrics {
  workCycleCount: number;
  commitmentCount: number;
  commitmentStatusCounts: Record<CommitmentStatus, number>;
  dependencyCount: number;
  serialChainCount: number;
  parallelDependencyCount: number;
  carriedOverCount: number;
  errors: string[];
}

/**
 * Collects Phase B validation metrics.
 */
export function collectPhaseBMetrics(
  workCycles: WorkCycleRow[],
  commitments: CommitmentRow[],
  dependencies: TaskDependencyRow[]
): PhaseBMetrics {
  const errors: string[] = [];

  const commitmentStatusCounts: Record<CommitmentStatus, number> = {
    planned: 0,
    in_progress: 0,
    completed: 0,
    at_risk: 0,
    missed: 0,
    carried_over: 0,
  };

  for (const commitment of commitments) {
    if (commitment.status in commitmentStatusCounts) {
      commitmentStatusCounts[commitment.status]++;
    }
  }

  // Count serial chains (dependencies where successorTaskId appears as predecessorTaskId elsewhere)
  const predecessorSet = new Set(dependencies.map((d) => d.predecessorTaskId));
  const successorSet = new Set(dependencies.map((d) => d.successorTaskId));
  const chainNodes = new Set([...predecessorSet].filter((x) => successorSet.has(x)));
  const serialChainCount = chainNodes.size > 0 ? chainNodes.size + 1 : dependencies.length > 0 ? 1 : 0;

  const parallelDependencyCount = dependencies.filter(
    (d) => d.dependencyType === "start_to_start" || d.dependencyType === "finish_to_finish"
  ).length;

  const carriedOverCount = commitmentStatusCounts.carried_over;

  // Validation
  if (workCycles.length < PHASE_B_VALIDATION_TARGETS.minWorkCyclesPerProject) {
    errors.push(
      `Phase B: work cycles too low (${workCycles.length} < ${PHASE_B_VALIDATION_TARGETS.minWorkCyclesPerProject})`
    );
  }

  if (commitments.length < PHASE_B_VALIDATION_TARGETS.minCommitmentsPerProject) {
    errors.push(
      `Phase B: commitments too low (${commitments.length} < ${PHASE_B_VALIDATION_TARGETS.minCommitmentsPerProject})`
    );
  }

  if (dependencies.length < PHASE_B_VALIDATION_TARGETS.minDependenciesPerProject) {
    errors.push(
      `Phase B: dependencies too low (${dependencies.length} < ${PHASE_B_VALIDATION_TARGETS.minDependenciesPerProject})`
    );
  }

  return {
    workCycleCount: workCycles.length,
    commitmentCount: commitments.length,
    commitmentStatusCounts,
    dependencyCount: dependencies.length,
    serialChainCount,
    parallelDependencyCount,
    carriedOverCount,
    errors,
  };
}

/**
 * Validates Phase B fixtures.
 * Returns errors if seed data does not meet requirements.
 */
export function validatePhaseBFixtures(
  workCycles: WorkCycleRow[],
  commitments: CommitmentRow[],
  dependencies: TaskDependencyRow[],
  tasks: CsvRow[]
): string[] {
  const metrics = collectPhaseBMetrics(workCycles, commitments, dependencies);
  const errors = [...metrics.errors];

  // Validate project-scope integrity
  const projectIds = new Set(tasks.map((t) => t.projectId));

  for (const wc of workCycles) {
    if (!projectIds.has(wc.projectId)) {
      errors.push(`Work cycle ${wc.id} references unknown projectId ${wc.projectId}`);
    }
  }

  for (const commitment of commitments) {
    if (!projectIds.has(commitment.projectId)) {
      errors.push(`Commitment ${commitment.id} references unknown projectId ${commitment.projectId}`);
    }
    if (commitment.sourceTaskId) {
      const task = tasks.find((t) => t.id === commitment.sourceTaskId);
      if (task && task.projectId !== commitment.projectId) {
        errors.push(
          `Commitment ${commitment.id} has PROJECT_SCOPE_MISMATCH: commitment.projectId=${commitment.projectId}, task.projectId=${task.projectId}`
        );
      }
    }
  }

  for (const dep of dependencies) {
    const predecessor = tasks.find((t) => t.id === dep.predecessorTaskId);
    const successor = tasks.find((t) => t.id === dep.successorTaskId);

    if (!predecessor) {
      errors.push(`Dependency ${dep.id} references unknown predecessorTaskId ${dep.predecessorTaskId}`);
    }
    if (!successor) {
      errors.push(`Dependency ${dep.id} references unknown successorTaskId ${dep.successorTaskId}`);
    }

    if (predecessor && successor) {
      if (predecessor.projectId !== dep.projectId) {
        errors.push(
          `Dependency ${dep.id} has PROJECT_SCOPE_MISMATCH: dep.projectId=${dep.projectId}, predecessor.projectId=${predecessor.projectId}`
        );
      }
      if (successor.projectId !== dep.projectId) {
        errors.push(
          `Dependency ${dep.id} has PROJECT_SCOPE_MISMATCH: dep.projectId=${dep.projectId}, successor.projectId=${successor.projectId}`
        );
      }
    }

    if (dep.predecessorTaskId === dep.successorTaskId) {
      errors.push(`Dependency ${dep.id} has self-edge (predecessor === successor)`);
    }
  }

  // Validate no cycles in dependency graph
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const successors = graph.get(dep.predecessorTaskId) || [];
    successors.push(dep.successorTaskId);
    graph.set(dep.predecessorTaskId, successors);
  }

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        errors.push(`Dependency graph contains a cycle`);
        break;
      }
    }
  }

  return errors;
}
