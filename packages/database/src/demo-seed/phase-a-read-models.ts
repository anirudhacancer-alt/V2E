/**
 * Phase A Read-Model Fixture Utilities
 *
 * Phase A introduces read-model contracts (Commitment, Dependency,
 * Improvement, Cycle) that are derived from existing task data.
 * No new DB tables are added in Phase A - these are read-model-first.
 *
 * This module provides utilities for:
 * - Deriving commitment-like horizons from task due dates
 * - Computing technical review queue candidates
 * - Generating task dependency summaries (stub for Phase A)
 *
 * See: docs/data-model/plans/phase-A-contracts-and-read-models.md
 */

import {
  PHASE_A_TECHNICAL_REVIEW_CONFIG,
  PHASE_A_HORIZON_CONFIG,
  PHASE_A_VALIDATION_TARGETS,
} from "./config.js";
import { differenceInUtcDays, startOfUtcDay } from "./helpers.js";
import type { CsvRow } from "./types.js";

// ============================================================================
// Horizon Types (matching contracts/commitment.ts)
// ============================================================================

export type CommitmentHorizon = "today" | "this_week" | "look_ahead" | "past";

export interface HorizonGroup {
  horizon: CommitmentHorizon;
  label: string;
  tasks: CsvRow[];
  count: number;
}

// ============================================================================
// Horizon Derivation
// ============================================================================

/**
 * Derives the commitment horizon for a task based on its due date.
 * Maps task due dates to horizon buckets: today, this_week, look_ahead, past.
 */
export function deriveTaskHorizon(
  dueDate: string | Date,
  anchorDate: Date
): CommitmentHorizon {
  const anchor = startOfUtcDay(anchorDate);
  const due = startOfUtcDay(new Date(dueDate));
  const daysDiff = differenceInUtcDays(due, anchor);

  if (daysDiff < 0) {
    return "past";
  }
  if (daysDiff === 0) {
    return "today";
  }
  if (daysDiff <= PHASE_A_HORIZON_CONFIG.thisWeekDays) {
    return "this_week";
  }
  return "look_ahead";
}

/**
 * Gets the display label for a horizon bucket.
 */
export function getHorizonLabel(horizon: CommitmentHorizon): string {
  switch (horizon) {
    case "today":
      return "Today";
    case "this_week":
      return "This Week";
    case "look_ahead":
      return "Look Ahead";
    case "past":
      return "Past";
  }
}

/**
 * Groups tasks by their derived commitment horizon.
 */
export function groupTasksByHorizon(
  tasks: CsvRow[],
  anchorDate: Date
): HorizonGroup[] {
  const groups: Record<CommitmentHorizon, CsvRow[]> = {
    today: [],
    this_week: [],
    look_ahead: [],
    past: [],
  };

  for (const task of tasks) {
    if (task.status === "Done") {
      continue; // Completed tasks don't appear in commitment horizons
    }
    const horizon = deriveTaskHorizon(task.dueDate, anchorDate);
    groups[horizon].push(task);
  }

  const horizonOrder: CommitmentHorizon[] = ["today", "this_week", "look_ahead", "past"];
  return horizonOrder.map((horizon) => ({
    horizon,
    label: getHorizonLabel(horizon),
    tasks: groups[horizon],
    count: groups[horizon].length,
  }));
}

// ============================================================================
// Technical Review Queue
// ============================================================================

export interface TechnicalReviewCandidate {
  task: CsvRow;
  isOverdue: boolean;
  isHighSeverity: boolean;
  priorityScore: number;
}

/**
 * Computes technical review queue candidates from tasks.
 * Priority is based on: blocked status, severity, overdue status.
 */
export function computeTechnicalReviewQueue(
  tasks: CsvRow[],
  anchorDate: Date
): TechnicalReviewCandidate[] {
  const anchor = startOfUtcDay(anchorDate);
  const candidates: TechnicalReviewCandidate[] = [];

  for (const task of tasks) {
    // Include blocked and review status tasks
    const isIncludedStatus = (
      PHASE_A_TECHNICAL_REVIEW_CONFIG.includedStatuses as readonly string[]
    ).includes(task.status);
    if (!isIncludedStatus) {
      continue;
    }

    const dueDate = startOfUtcDay(new Date(task.dueDate));
    const isOverdue = dueDate.getTime() < anchor.getTime();
    const isHighSeverity = (
      PHASE_A_TECHNICAL_REVIEW_CONFIG.prioritySeverities as readonly string[]
    ).includes(task.severity);

    // Priority score: higher = more urgent
    let priorityScore = 0;
    if (task.status === "Blocked") priorityScore += 100;
    if (task.severity === "Critical") priorityScore += 50;
    if (task.severity === "High") priorityScore += 30;
    if (isOverdue) priorityScore += 20;

    candidates.push({
      task,
      isOverdue,
      isHighSeverity,
      priorityScore,
    });
  }

  // Sort by priority score descending
  return candidates.sort((a, b) => b.priorityScore - a.priorityScore);
}

// ============================================================================
// Phase A Validation Metrics
// ============================================================================
//
// Dependency summaries for API responses are computed from `task_dependencies` in the API
// (`apps/api/src/lib/dependencies.ts`); use `DependencySummarySchema` in `@v2e/contracts`.

export interface PhaseAMetrics {
  horizonCounts: Record<CommitmentHorizon, number>;
  technicalReviewQueueCount: number;
  highSeverityBlockedCount: number;
  criticalTaskCount: number;
  /** Validation errors (empty if valid). */
  errors: string[];
}

/**
 * Collects Phase A validation metrics from materialized seed data.
 */
export function collectPhaseAMetrics(
  tasks: CsvRow[],
  anchorDate: Date
): PhaseAMetrics {
  const horizonGroups = groupTasksByHorizon(tasks, anchorDate);
  const horizonCounts: Record<CommitmentHorizon, number> = {
    today: 0,
    this_week: 0,
    look_ahead: 0,
    past: 0,
  };
  for (const group of horizonGroups) {
    horizonCounts[group.horizon] = group.count;
  }

  const reviewQueue = computeTechnicalReviewQueue(tasks, anchorDate);
  const technicalReviewQueueCount = reviewQueue.length;
  const highSeverityBlockedCount = reviewQueue.filter(
    (c) => c.isHighSeverity && c.task.status === "Blocked"
  ).length;
  const criticalTaskCount = tasks.filter((t) => t.severity === "Critical").length;

  const errors: string[] = [];

  // Validate horizon coverage
  if (horizonCounts.today < PHASE_A_VALIDATION_TARGETS.minDueToday) {
    errors.push(
      `Phase A: tasks due today too low (${horizonCounts.today} < ${PHASE_A_VALIDATION_TARGETS.minDueToday})`
    );
  }
  if (horizonCounts.this_week < PHASE_A_VALIDATION_TARGETS.minDueThisWeek) {
    errors.push(
      `Phase A: tasks due this week too low (${horizonCounts.this_week} < ${PHASE_A_VALIDATION_TARGETS.minDueThisWeek})`
    );
  }
  if (horizonCounts.look_ahead < PHASE_A_VALIDATION_TARGETS.minDueLookAhead) {
    errors.push(
      `Phase A: tasks due look-ahead too low (${horizonCounts.look_ahead} < ${PHASE_A_VALIDATION_TARGETS.minDueLookAhead})`
    );
  }
  if (horizonCounts.past < PHASE_A_VALIDATION_TARGETS.minPastOverdue) {
    errors.push(
      `Phase A: overdue/past tasks too low (${horizonCounts.past} < ${PHASE_A_VALIDATION_TARGETS.minPastOverdue})`
    );
  }

  // Validate technical review queue coverage
  if (technicalReviewQueueCount < PHASE_A_VALIDATION_TARGETS.minBlockedTasks) {
    errors.push(
      `Phase A: blocked/review tasks too low (${technicalReviewQueueCount} < ${PHASE_A_VALIDATION_TARGETS.minBlockedTasks})`
    );
  }
  if (
    highSeverityBlockedCount <
    PHASE_A_TECHNICAL_REVIEW_CONFIG.minHighSeverityBlocked
  ) {
    errors.push(
      `Phase A: high-severity blocked tasks too low (${highSeverityBlockedCount} < ${PHASE_A_TECHNICAL_REVIEW_CONFIG.minHighSeverityBlocked})`
    );
  }
  if (criticalTaskCount < PHASE_A_TECHNICAL_REVIEW_CONFIG.minCriticalTasks) {
    errors.push(
      `Phase A: critical tasks too low (${criticalTaskCount} < ${PHASE_A_TECHNICAL_REVIEW_CONFIG.minCriticalTasks})`
    );
  }

  return {
    horizonCounts,
    technicalReviewQueueCount,
    highSeverityBlockedCount,
    criticalTaskCount,
    errors,
  };
}

/**
 * Validates Phase A read-model fixture requirements.
 * Returns errors if seed data does not support Phase A read-model derivation.
 */
export function validatePhaseAFixtures(
  tasks: CsvRow[],
  anchorDate: Date
): string[] {
  const metrics = collectPhaseAMetrics(tasks, anchorDate);
  return metrics.errors;
}
