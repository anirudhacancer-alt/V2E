/**
 * Phase C Entity Generation
 *
 * Generates persisted Phase C entities:
 * - ImprovementActions: structured countermeasures for repeated issues
 *
 * See: docs/data-model/plans/phase-C-technical-review-and-improvements.md
 */

import {
  addUtcDays,
  offsetFromHash,
  sortBySeed,
  startOfUtcDay,
  toIso,
  withUtcTime,
} from "./helpers.js";
import type { CsvRow } from "./types.js";
import type { CommitmentRow } from "./phase-b-entities.js";

// ============================================================================
// Phase C Configuration
// ============================================================================

export const PHASE_C_CONFIG = {
  /** Number of improvement actions per project (3-5). */
  improvementActionsPerProject: { min: 3, max: 5 },
  /** Improvement action category distribution. */
  categoryRatios: {
    quality: 0.35,
    schedule: 0.30,
    safety: 0.20,
    maintenance: 0.10,
    other: 0.05,
  },
  /** Improvement action status distribution. */
  statusRatios: {
    open: 0.25,
    in_progress: 0.35,
    validated: 0.25,
    closed: 0.15,
  },
  /** Percentage of actions that should be overdue. */
  overduePct: 0.20,
  /** Percentage of actions with linked tasks. */
  linkedTasksPct: 0.60,
  /** Percentage of actions with linked commitments. */
  linkedCommitmentsPct: 0.40,
} as const;

export const PHASE_C_VALIDATION_TARGETS = {
  /** Minimum improvement actions per project. */
  minImprovementActionsPerProject: 3,
  /** Minimum overdue actions (open/in_progress with past targetDate). */
  minOverdueActions: 1,
  /** Minimum actions with linked tasks. */
  minLinkedTaskActions: 1,
} as const;

// ============================================================================
// Types
// ============================================================================

export type ImprovementActionCategory =
  | "quality"
  | "schedule"
  | "safety"
  | "maintenance"
  | "other";

export type ImprovementActionStatus =
  | "open"
  | "in_progress"
  | "validated"
  | "closed";

export interface ImprovementActionRow {
  id: string;
  tenantId: string;
  projectId: string;
  siteId: string;
  title: string;
  problemStatement: string;
  category: ImprovementActionCategory;
  rootCause: string | null;
  ownerId: string;
  status: ImprovementActionStatus;
  targetDate: string | null;
  linkedTaskIdsJson: string;
  linkedBlockerIdsJson: string;
  linkedCommitmentIdsJson: string;
  effectivenessNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Problem Statement Templates
// ============================================================================

const PROBLEM_TEMPLATES: Record<ImprovementActionCategory, string[]> = {
  quality: [
    "Recurring quality defects in {area} causing rework",
    "Inspection failures on {area} work packages",
    "Non-conformance reports trending up in {area}",
    "Quality control gaps identified in {area} process",
    "Customer complaints about {area} workmanship",
  ],
  schedule: [
    "Repeated delays in {area} task completion",
    "Predecessor bottleneck causing downstream delays",
    "Resource conflicts impacting {area} schedule",
    "Material delivery issues affecting {area} timeline",
    "Crew productivity below target in {area}",
  ],
  safety: [
    "Near-miss incidents trending in {area}",
    "PPE compliance gaps identified in {area}",
    "Housekeeping issues creating hazards in {area}",
    "Safety observation backlog in {area}",
    "Training gaps identified for {area} work",
  ],
  maintenance: [
    "Equipment downtime affecting {area} productivity",
    "Preventive maintenance backlog in {area}",
    "Tool calibration issues in {area}",
    "Spare parts availability issues for {area}",
    "Equipment reliability concerns in {area}",
  ],
  other: [
    "Communication gaps between {area} teams",
    "Documentation issues in {area} process",
    "Process inefficiency identified in {area}",
    "Coordination issues with {area} stakeholders",
    "Change management concerns in {area}",
  ],
};

const ROOT_CAUSE_TEMPLATES: Record<ImprovementActionCategory, string[]> = {
  quality: [
    "Insufficient training on updated specifications",
    "Missing quality checkpoint in work sequence",
    "Unclear acceptance criteria communicated",
    "Tool/equipment calibration drift",
    "Inadequate supervision during critical steps",
  ],
  schedule: [
    "Unrealistic duration estimates in planning",
    "Hidden dependencies not captured in schedule",
    "Crew skill mismatch for assigned tasks",
    "Material lead time underestimated",
    "Weather contingency not factored in",
  ],
  safety: [
    "Inadequate hazard identification during planning",
    "Safety briefing not conducted before task start",
    "PPE availability issues at work location",
    "Fatigue from extended work hours",
    "Insufficient lighting in work area",
  ],
  maintenance: [
    "Preventive maintenance schedule not followed",
    "Incorrect operating procedures used",
    "Spare parts inventory not maintained",
    "Equipment age beyond service life",
    "Operator training gap on equipment",
  ],
  other: [
    "Communication protocol not defined",
    "Role responsibilities unclear",
    "Process documentation outdated",
    "Stakeholder alignment not confirmed",
    "Change impact not fully assessed",
  ],
};

const EFFECTIVENESS_TEMPLATES: Record<ImprovementActionStatus, string[]> = {
  open: [],
  in_progress: [],
  validated: [
    "Countermeasure implemented and showing improvement",
    "Initial metrics indicate positive trend",
    "Team feedback confirms process improvement",
    "Reduced recurrence observed over validation period",
  ],
  closed: [
    "Issue resolved - no recurrence in 30 days",
    "Root cause eliminated - metrics normalized",
    "Process change institutionalized successfully",
    "Improvement sustained over monitoring period",
    "Lessons learned documented and shared",
  ],
};

const ACTION_TITLE_TEMPLATES: Record<ImprovementActionCategory, string[]> = {
  quality: [
    "Implement quality checkpoint for {area}",
    "Enhance inspection protocol for {area}",
    "Develop training program for {area} quality",
    "Standardize {area} work procedures",
    "Improve {area} acceptance criteria clarity",
  ],
  schedule: [
    "Optimize {area} task sequencing",
    "Improve resource allocation for {area}",
    "Reduce {area} material lead time",
    "Enhance {area} dependency tracking",
    "Improve {area} schedule forecasting",
  ],
  safety: [
    "Enhance {area} hazard controls",
    "Improve {area} safety briefing process",
    "Strengthen {area} PPE compliance",
    "Reduce {area} near-miss trends",
    "Improve {area} safety observations",
  ],
  maintenance: [
    "Improve {area} PM compliance",
    "Optimize {area} equipment uptime",
    "Enhance {area} spare parts availability",
    "Improve {area} equipment reliability",
    "Strengthen {area} tool management",
  ],
  other: [
    "Improve {area} team communication",
    "Enhance {area} process documentation",
    "Streamline {area} coordination",
    "Improve {area} change management",
    "Strengthen {area} stakeholder alignment",
  ],
};

// ============================================================================
// Improvement Action Generation
// ============================================================================

/**
 * Picks a category based on configured ratios.
 */
function pickCategory(seed: string, id: string): ImprovementActionCategory {
  const roll = offsetFromHash(seed, `${id}:category`, 0, 100);
  let cumulative = 0;

  for (const [category, ratio] of Object.entries(PHASE_C_CONFIG.categoryRatios)) {
    cumulative += ratio * 100;
    if (roll < cumulative) {
      return category as ImprovementActionCategory;
    }
  }

  return "other";
}

/**
 * Picks a status based on configured ratios.
 */
function pickStatus(seed: string, id: string): ImprovementActionStatus {
  const roll = offsetFromHash(seed, `${id}:status`, 0, 100);
  let cumulative = 0;

  for (const [status, ratio] of Object.entries(PHASE_C_CONFIG.statusRatios)) {
    cumulative += ratio * 100;
    if (roll < cumulative) {
      return status as ImprovementActionStatus;
    }
  }

  return "open";
}

/**
 * Picks a template string and fills in the area placeholder.
 */
function fillTemplate(templates: string[], seed: string, id: string, area: string): string {
  const idx = offsetFromHash(seed, `${id}:template`, 0, templates.length - 1);
  return templates[idx].replace("{area}", area);
}

/**
 * Generates improvement actions for a project.
 */
export function generateImprovementActions(
  tasks: CsvRow[],
  commitments: CommitmentRow[],
  teamMembers: CsvRow[],
  projectId: string,
  siteId: string,
  tenantId: string,
  anchorDate: Date,
  seed: string
): ImprovementActionRow[] {
  const actions: ImprovementActionRow[] = [];
  const anchor = startOfUtcDay(anchorDate);

  // Get tasks from this project that could be linked
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const blockedTasks = projectTasks.filter((t) => t.status === "Blocked");
  const projectCommitments = commitments.filter((c) => c.projectId === projectId);
  const atRiskCommitments = projectCommitments.filter(
    (c) => c.status === "at_risk" || c.status === "missed"
  );

  // Get team members for this site
  const siteTeamMembers = teamMembers.filter((tm) => tm.siteId === siteId);
  if (siteTeamMembers.length === 0) {
    return actions;
  }

  // Determine number of actions for this project
  const numActions = offsetFromHash(
    seed,
    `${projectId}:improvements:count`,
    PHASE_C_CONFIG.improvementActionsPerProject.min,
    PHASE_C_CONFIG.improvementActionsPerProject.max
  );

  // Get location areas for variety
  const areas = [
    "electrical installation",
    "mechanical work",
    "structural framing",
    "finishing work",
    "MEP coordination",
    "site logistics",
    "concrete operations",
    "facade installation",
  ];

  for (let i = 0; i < numActions; i++) {
    const actionId = `ia-${projectId.slice(0, 8)}-${i}`;
    const category = pickCategory(seed, actionId);
    const status = pickStatus(seed, actionId);
    const area = areas[offsetFromHash(seed, `${actionId}:area`, 0, areas.length - 1)];

    // Select owner from team members
    const owner = siteTeamMembers[offsetFromHash(seed, `${actionId}:owner`, 0, siteTeamMembers.length - 1)];
    if (!owner) continue;

    // Generate title and problem statement
    const title = fillTemplate(ACTION_TITLE_TEMPLATES[category], seed, actionId, area);
    const problemStatement = fillTemplate(PROBLEM_TEMPLATES[category], seed, actionId, area);

    // Root cause for in_progress, validated, closed
    const rootCause = ["in_progress", "validated", "closed"].includes(status)
      ? fillTemplate(ROOT_CAUSE_TEMPLATES[category], seed, actionId, area)
      : null;

    // Effectiveness note for validated, closed
    const effectivenessNote =
      EFFECTIVENESS_TEMPLATES[status].length > 0
        ? fillTemplate(EFFECTIVENESS_TEMPLATES[status], seed, actionId, area)
        : null;

    // Target date - some in the past (overdue), some in future
    const shouldBeOverdue =
      ["open", "in_progress"].includes(status) &&
      offsetFromHash(seed, `${actionId}:overdue`, 0, 100) < PHASE_C_CONFIG.overduePct * 100;

    let targetDate: string | null = null;
    if (status !== "closed") {
      if (shouldBeOverdue) {
        targetDate = toIso(addUtcDays(anchor, -offsetFromHash(seed, `${actionId}:overdue-days`, 3, 14))).slice(0, 10);
      } else {
        targetDate = toIso(addUtcDays(anchor, offsetFromHash(seed, `${actionId}:target-days`, 7, 30))).slice(0, 10);
      }
    }

    // Linked tasks - blocked tasks are good candidates
    const linkedTaskIds: string[] = [];
    if (blockedTasks.length > 0 && offsetFromHash(seed, `${actionId}:link-tasks`, 0, 100) < PHASE_C_CONFIG.linkedTasksPct * 100) {
      const numLinked = Math.min(
        blockedTasks.length,
        offsetFromHash(seed, `${actionId}:num-linked-tasks`, 1, 3)
      );
      const sortedBlocked = sortBySeed(blockedTasks, `${seed}:${actionId}:blocked`, (t) => t.id);
      for (let j = 0; j < numLinked; j++) {
        linkedTaskIds.push(sortedBlocked[j].id);
      }
    }

    // Linked commitments - at-risk commitments are good candidates
    const linkedCommitmentIds: string[] = [];
    if (atRiskCommitments.length > 0 && offsetFromHash(seed, `${actionId}:link-commits`, 0, 100) < PHASE_C_CONFIG.linkedCommitmentsPct * 100) {
      const numLinked = Math.min(
        atRiskCommitments.length,
        offsetFromHash(seed, `${actionId}:num-linked-commits`, 1, 2)
      );
      const sortedAtRisk = sortBySeed(atRiskCommitments, `${seed}:${actionId}:at-risk`, (c) => c.id);
      for (let j = 0; j < numLinked; j++) {
        linkedCommitmentIds.push(sortedAtRisk[j].id);
      }
    }

    // Created date - older for closed/validated, newer for open
    const createdDaysAgo =
      status === "closed" ? offsetFromHash(seed, `${actionId}:created-days`, 30, 45) :
      status === "validated" ? offsetFromHash(seed, `${actionId}:created-days`, 20, 35) :
      status === "in_progress" ? offsetFromHash(seed, `${actionId}:created-days`, 10, 25) :
      offsetFromHash(seed, `${actionId}:created-days`, 2, 14);

    const createdAt = withUtcTime(
      addUtcDays(anchor, -createdDaysAgo),
      9,
      offsetFromHash(seed, `${actionId}:created-min`, 0, 45)
    );

    const updatedAt = withUtcTime(
      addUtcDays(anchor, -offsetFromHash(seed, `${actionId}:updated-days`, 0, Math.min(5, createdDaysAgo))),
      10,
      offsetFromHash(seed, `${actionId}:updated-min`, 0, 50)
    );

    actions.push({
      id: actionId,
      tenantId,
      projectId,
      siteId,
      title,
      problemStatement,
      category,
      rootCause,
      ownerId: owner.id,
      status,
      targetDate,
      linkedTaskIdsJson: JSON.stringify(linkedTaskIds),
      linkedBlockerIdsJson: JSON.stringify([]),
      linkedCommitmentIdsJson: JSON.stringify(linkedCommitmentIds),
      effectivenessNote,
      createdAt: toIso(createdAt),
      updatedAt: toIso(updatedAt),
    });
  }

  return actions;
}

// ============================================================================
// Phase C Metrics Collection
// ============================================================================

export interface PhaseCMetrics {
  improvementActionCount: number;
  categoryDistribution: Record<ImprovementActionCategory, number>;
  statusDistribution: Record<ImprovementActionStatus, number>;
  overdueCount: number;
  linkedTaskCount: number;
  linkedCommitmentCount: number;
  errors: string[];
}

/**
 * Collects Phase C validation metrics.
 */
export function collectPhaseCMetrics(
  improvementActions: ImprovementActionRow[],
  anchorDate: Date
): PhaseCMetrics {
  const anchor = startOfUtcDay(anchorDate);
  const errors: string[] = [];

  const categoryDistribution: Record<ImprovementActionCategory, number> = {
    quality: 0,
    schedule: 0,
    safety: 0,
    maintenance: 0,
    other: 0,
  };

  const statusDistribution: Record<ImprovementActionStatus, number> = {
    open: 0,
    in_progress: 0,
    validated: 0,
    closed: 0,
  };

  let overdueCount = 0;
  let linkedTaskCount = 0;
  let linkedCommitmentCount = 0;

  for (const action of improvementActions) {
    if (action.category in categoryDistribution) {
      categoryDistribution[action.category]++;
    }
    if (action.status in statusDistribution) {
      statusDistribution[action.status]++;
    }

    // Check if overdue (open/in_progress with past targetDate)
    if (["open", "in_progress"].includes(action.status) && action.targetDate) {
      const targetDate = new Date(action.targetDate);
      if (targetDate.getTime() < anchor.getTime()) {
        overdueCount++;
      }
    }

    // Count linked items
    try {
      const linkedTasks = JSON.parse(action.linkedTaskIdsJson);
      if (Array.isArray(linkedTasks) && linkedTasks.length > 0) {
        linkedTaskCount++;
      }
    } catch {
      // ignore parse errors
    }

    try {
      const linkedCommits = JSON.parse(action.linkedCommitmentIdsJson);
      if (Array.isArray(linkedCommits) && linkedCommits.length > 0) {
        linkedCommitmentCount++;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Validation
  if (improvementActions.length < PHASE_C_VALIDATION_TARGETS.minImprovementActionsPerProject) {
    errors.push(
      `Phase C: improvement actions too low (${improvementActions.length} < ${PHASE_C_VALIDATION_TARGETS.minImprovementActionsPerProject})`
    );
  }

  return {
    improvementActionCount: improvementActions.length,
    categoryDistribution,
    statusDistribution,
    overdueCount,
    linkedTaskCount,
    linkedCommitmentCount,
    errors,
  };
}

/**
 * Validates Phase C fixtures.
 */
export function validatePhaseCFixtures(
  improvementActions: ImprovementActionRow[],
  tasks: { id: string; projectId: string }[],
  commitments: { id: string; projectId: string }[],
  teamMembers: { id: string }[],
  anchorDate: Date
): string[] {
  const metrics = collectPhaseCMetrics(improvementActions, anchorDate);
  const errors = [...metrics.errors];

  const taskIds = new Set(tasks.map((t) => t.id));
  const commitmentIds = new Set(commitments.map((c) => c.id));
  const teamMemberIds = new Set(teamMembers.map((tm) => tm.id));

  for (const action of improvementActions) {
    // Validate owner exists
    if (!teamMemberIds.has(action.ownerId)) {
      errors.push(`ImprovementAction ${action.id} references unknown ownerId ${action.ownerId}`);
    }

    // Validate linked tasks exist
    try {
      const linkedTasks = JSON.parse(action.linkedTaskIdsJson);
      if (Array.isArray(linkedTasks)) {
        for (const taskId of linkedTasks) {
          if (!taskIds.has(taskId)) {
            errors.push(`ImprovementAction ${action.id} references unknown taskId ${taskId}`);
          }
        }
      }
    } catch {
      errors.push(`ImprovementAction ${action.id} has invalid linkedTaskIdsJson`);
    }

    // Validate linked commitments exist
    try {
      const linkedCommits = JSON.parse(action.linkedCommitmentIdsJson);
      if (Array.isArray(linkedCommits)) {
        for (const commitId of linkedCommits) {
          if (!commitmentIds.has(commitId)) {
            errors.push(`ImprovementAction ${action.id} references unknown commitmentId ${commitId}`);
          }
        }
      }
    } catch {
      errors.push(`ImprovementAction ${action.id} has invalid linkedCommitmentIdsJson`);
    }

    // Validate status/targetDate consistency
    if (action.status === "closed" && action.targetDate) {
      errors.push(`ImprovementAction ${action.id} is closed but still has targetDate`);
    }
  }

  return errors;
}
