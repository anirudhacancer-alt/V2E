import fs from "node:fs/promises";
import path from "node:path";
import { KNOWN_DATASET_KEYS_BY_CONTRACT } from "./domain-packs.js";

export const DEFAULT_CONTRACTS = [
  "1328", // RES-1328 - Residential Construction
  "1330", // COM-1330 - Commercial Construction
  "2101", // PROC-2101 - Factory Process
  "2102", // PKG-2102 - Factory Packaging
  "3101", // RGM-3101 - Retail Go-to-Market
  "3102", // RGM-3102 - Retail Go-to-Market (alternate)
  "3201", // WH-3201 - Warehouse Logistics
  "3202", // FAC-3202 - Factory Maintenance
  "3203", // VEN-3203 - Venue Operations
  "3204", // HC-3204 - Healthcare Operations
  "3205", // NGO-3205 - NGO Field Operations
];
export const MAX_HISTORY_DAYS = 60;

export const TASK_STATUS_RATIOS = {
  "In-progress": 0.5,
  Blocked: 0.2,
  Done: 0.3,
} as const;

export const UPDATE_STATUS_RATIOS = {
  Pending: 0.25,
  Processed: 0.2,
  CreatedNewTask: 0.35,
  Escalated: 0.1,
  Saved: 0.1,
} as const;

export const UPDATE_RECENCY_RATIOS = {
  last3d: 0.45,
  thisWeek: 0.3,
  last2Weeks: 0.2,
  last60d: 0.05,
} as const;

export const UPDATE_STATUS_BY_RECENCY = {
  last3d: {
    Pending: 0.3,
    Processed: 0.22,
    CreatedNewTask: 0.25,
    Escalated: 0.08,
    Saved: 0.15,
  },
  thisWeek: {
    Pending: 0.12,
    Processed: 0.28,
    CreatedNewTask: 0.36,
    Escalated: 0.08,
    Saved: 0.16,
  },
  last2Weeks: {
    Pending: 0.08,
    Processed: 0.25,
    CreatedNewTask: 0.42,
    Escalated: 0.13,
    Saved: 0.12,
  },
  last60d: {
    Pending: 0,
    Processed: 0.17,
    CreatedNewTask: 0.5,
    Escalated: 0.17,
    Saved: 0.16,
  },
} as const;

export const BLOCKED_OPEN_BUCKET_RATIOS = {
  overdueRecent: 0,
  overdueOlder: 0,
  dueToday: 0.08,
  dueTomorrow: 0.12,
  dueThisWeek: 0.3,
  dueNextWeek: 0.3,
  dueWeekPlus2: 0.2,
} as const;

export const SEED_TARGETS = {
  overduePct: 0.1,
  dueThisWeekPct: 0.55,
  unreadReviewPct: 0.25,
  createdFromUpdatePct: 0.1,
} as const;

export const VALIDATION_TARGETS = {
  taskDonePct: 0.3,
  taskBlockedPct: 0.2,
  taskOverduePct: 0.1,
  /** Human follow-up notes (`linkedTaskId`) — roughly half of updates in demo bundles */
  noteLinkedPct: 0.5,
  noteEscalatedPct: 0.1,
} as const;

export const VALIDATION_TOLERANCE = {
  ratio: 0.03,
  /** Linked share varies with Escalated on the human-follow-up half */
  noteLinkedRatio: 0.25, // Increased tolerance for date drift and seed variations
  overdueRatio: 0.02,
} as const;

export const RECENT_VALIDATION_MINIMUMS = {
  plannedToday: 3,
  blockedToday: 2,
  escalationsToday: 2,
  recentEscalations: 1,
} as const;

// ============================================================================
// Phase A Read-Model Fixture Configuration
// ============================================================================
// Phase A introduces read-model contracts (Commitment, Dependency,
// Improvement, Cycle) that are derived from existing task data.
// No new DB tables are added in Phase A - these are read-model-first.
//
// Seed data must support derivation of:
// - Commitment horizons: today, this_week, look_ahead, past
// - Technical review queue: blocked/high-severity tasks
// - Task dependency summaries: count placeholders (0 in Phase A)
// ============================================================================

/**
 * Phase A read-model horizon configuration.
 * Used to bucket tasks into commitment-like horizons for field app grouping.
 */
export const PHASE_A_HORIZON_CONFIG = {
  /** Tasks due within this many days are "today" horizon. */
  todayDays: 0,
  /** Tasks due within this many days (after today) are "this_week" horizon. */
  thisWeekDays: 7,
  /** Tasks due within this many days (after this_week) are "look_ahead" horizon. */
  lookAheadDays: 14,
  /** Tasks due before today are "past" horizon. */
} as const;

/**
 * Phase A technical review queue configuration.
 * Defines which tasks appear in technical review queue read-model.
 */
export const PHASE_A_TECHNICAL_REVIEW_CONFIG = {
  /** Include tasks with these statuses in technical review queue. */
  includedStatuses: ["Blocked", "Review"] as const,
  /** Include tasks with these severities (Critical/High get priority). */
  prioritySeverities: ["Critical", "High"] as const,
  /** Minimum number of high-severity blocked tasks to ensure in seed. */
  minHighSeverityBlocked: 2,
  /** Minimum number of critical tasks (any status) to ensure in seed. */
  minCriticalTasks: 1,
} as const;

/**
 * Phase A validation targets for read-model derivation.
 * These ensure seed data has sufficient variety for Phase A endpoints.
 */
export const PHASE_A_VALIDATION_TARGETS = {
  /** Minimum tasks due today for commitment horizon derivation. */
  minDueToday: 3,
  /** Minimum tasks due this week (excluding today) for commitment horizon. */
  minDueThisWeek: 5,
  /** Minimum tasks due in look-ahead (next 2 weeks). */
  minDueLookAhead: 4,
  /** Minimum overdue tasks for "past" horizon. */
  minPastOverdue: 2,
  /** Minimum blocked tasks for technical review queue. */
  minBlockedTasks: 4,
  /** Minimum high-severity tasks for technical review queue. */
  minHighSeverityTasks: 3,
} as const;

// ============================================================================
// Phase B Persisted Entity Configuration
// ============================================================================
// Phase B adds persisted entities for commitments, task dependencies, and
// work cycles. These configuration values control seed generation and validation.
// ============================================================================

/**
 * Phase B work cycle configuration.
 */
export const PHASE_B_WORK_CYCLE_CONFIG = {
  /** Minimum work cycles per project. */
  minPerProject: 1,
  /** Maximum work cycles per project. */
  maxPerProject: 2,
  /** Work cycle duration in days. */
  durationDays: 7,
} as const;

/**
 * Phase B commitment configuration.
 */
export const PHASE_B_COMMITMENT_CONFIG = {
  /** Minimum commitments per project. */
  minPerProject: 10,
  /** Maximum commitments per project. */
  maxPerProject: 15,
  /** Status distribution ratios. */
  statusRatios: {
    planned: 0.25,
    in_progress: 0.35,
    completed: 0.2,
    at_risk: 0.1,
    missed: 0.05,
    carried_over: 0.05,
  },
} as const;

/**
 * Phase B task dependency configuration.
 */
export const PHASE_B_DEPENDENCY_CONFIG = {
  /** Minimum dependency chains per project. */
  minChainsPerProject: 3,
  /** Maximum dependency chains per project. */
  maxChainsPerProject: 5,
  /** Minimum serial chain length. */
  minChainLength: 2,
  /** Maximum serial chain length. */
  maxChainLength: 4,
  /** Dependency type distribution ratios. */
  typeRatios: {
    finish_to_start: 0.7,
    blocks: 0.2,
    start_to_start: 0.05,
    finish_to_finish: 0.05,
  },
} as const;

/**
 * Phase B validation targets.
 */
export const PHASE_B_VALIDATION_TARGETS = {
  /** Minimum work cycles per project. */
  minWorkCyclesPerProject: 1,
  /** Minimum commitments per project. */
  minCommitmentsPerProject: 8,
  /** Minimum task dependencies per project. */
  minDependenciesPerProject: 3,
  /** Minimum serial chains. */
  minSerialChains: 2,
  /** Minimum carried-over commitments. */
  minCarriedOverCommitments: 1,
} as const;

export async function resolveDatasetDir(
  repoRoot: string,
  contractId: string
): Promise<{ datasetKey: string; dir: string }> {
  const demoRoot = path.join(repoRoot, "docs", "demo", "datasets");
  const explicitKey = KNOWN_DATASET_KEYS_BY_CONTRACT[contractId];
  const explicitCandidates = [
    ...(explicitKey ? [explicitKey] : []),
    `RES-${contractId}`,
    `COM-${contractId}`,
    `PROC-${contractId}`,
    `PKG-${contractId}`,
    `contract-${contractId}`,
  ];

  for (const candidate of explicitCandidates) {
    const dir = path.join(demoRoot, candidate);
    try {
      await fs.access(dir);
      return { datasetKey: candidate, dir };
    } catch {
      // try the next candidate
    }
  }

  const entries = await fs.readdir(demoRoot, { withFileTypes: true });
  const dynamicMatch = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith(`-${contractId}`)
  );

  if (!dynamicMatch) {
    throw new Error(
      `No demo dataset directory found for contract ${contractId} under ${demoRoot}`
    );
  }

  return {
    datasetKey: dynamicMatch.name,
    dir: path.join(demoRoot, dynamicMatch.name),
  };
}

export function resolveAnchorDate(input?: string): Date {
  if (!input) {
    return new Date();
  }

  const parsed = new Date(`${input}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid --anchor-date value: ${input}`);
  }
  return parsed;
}
