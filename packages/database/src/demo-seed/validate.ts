import {
  MAX_HISTORY_DAYS,
  PHASE_B_VALIDATION_TARGETS,
  RECENT_VALIDATION_MINIMUMS,
  VALIDATION_TARGETS,
  VALIDATION_TOLERANCE,
} from "./config.js";
import { collectPhaseAMetrics, validatePhaseAFixtures } from "./phase-a-read-models.js";
import { differenceInUtcDays, startOfUtcDay, startOfWeekUtc } from "./helpers.js";
import {
  validateLocationMasterRows,
  validateTaskAndAiLocationLinks,
  validateUpdateLocationLinks,
} from "./location-rules.js";
import { resolveDemoDatasetPack } from "./domain-packs.js";
import { validateCanonicalOrgAndLocationLabels } from "./org-integrity-rules.js";
import {
  DEMO_SITE_SUPERVISOR_EMAIL,
  DEMO_SITE_SUPERVISOR_NAME,
  DEMO_SITE_SUPERVISOR_USER_ID,
  getDemoLeadIdentity,
} from "./org-mappings.js";
import type {
  CommitmentStatusKey,
  DemoBundleRows,
  DemoSeedMetrics,
  NoteState,
  PhaseBMetrics,
  TaskStatusKey,
  UpdateStatusKey,
} from "./types.js";
import type {
  CommitmentRow,
  TaskDependencyRow,
  WorkCycleRow,
} from "./phase-b-entities.js";

type BundleLike = { rows: DemoBundleRows; datasetKey: string };

/** Linked = human follow-up (`updates.linkedTaskId`); not used for voice→task spawn. */
export function deriveNoteState(
  status: string,
  updateCreatedAt: string,
  humanLinkedTask?: { createdAt: string }
): NoteState {
  if (status === "Escalated") {
    return "Escalated";
  }
  if (
    humanLinkedTask &&
    humanLinkedTask.createdAt.localeCompare(updateCreatedAt) < 0
  ) {
    return "Linked";
  }
  return "Review";
}

function zeroTaskCounts(): Record<TaskStatusKey, number> {
  return {
    New: 0,
    Planned: 0,
    Review: 0,
    "In-progress": 0,
    Blocked: 0,
    Done: 0,
  };
}

function zeroUpdateCounts(): Record<UpdateStatusKey, number> {
  return {
    Pending: 0,
    Processed: 0,
    CreatedNewTask: 0,
    Escalated: 0,
    Saved: 0,
  };
}

function zeroNoteCounts(): Record<NoteState, number> {
  return {
    Review: 0,
    Linked: 0,
    Escalated: 0,
  };
}

const ALLOWED_TASK_STATUSES = new Set([
  "Review",
  "New",
  "Planned",
  "In-progress",
  "Blocked",
  "Done",
]);
const ALLOWED_UPDATE_STATUSES = new Set([
  "Pending",
  "Processed",
  "CreatedNewTask",
  "Escalated",
  "Saved",
]);

const ALLOWED_REVIEW_UNCERTAINTY_REASONS = new Set([
  "low_confidence_extraction",
  "category_uncertain",
  "location_uncertain",
  "severity_uncertain",
  "owner_uncertain",
  "due_date_uncertain",
]);
const REQUIRED_SUPERVISOR_ID = DEMO_SITE_SUPERVISOR_USER_ID;
const REQUIRED_SUPERVISOR_EMAIL = DEMO_SITE_SUPERVISOR_EMAIL;
const REQUIRED_SUPERVISOR_NAME = DEMO_SITE_SUPERVISOR_NAME;

function isSupervisorRole(role: string): boolean {
  return /supervisor|manager|lead/i.test(role);
}

function ratioWithinTolerance(
  value: number,
  target: number,
  tolerance: number
): boolean {
  return Math.abs(value - target) <= tolerance;
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function collectSeedMetrics(bundle: BundleLike, anchorDate: Date): DemoSeedMetrics {
  const anchor = startOfUtcDay(anchorDate);
  const taskStatusCounts = zeroTaskCounts();
  const updateStatusCounts = zeroUpdateCounts();
  const noteStateCounts = zeroNoteCounts();
  const taskById = new Map(bundle.rows.tasks.map((t) => [t.id, t]));
  const anchorYmd = anchor.toISOString().slice(0, 10);

  let overdueTasks = 0;
  let activeDueToday = 0;
  let blockedDueToday = 0;
  let todayEscalations = 0;
  let recentEscalations = 0;
  let maxTaskCreatedAgeDays = 0;
  let maxUpdateAgeDays = 0;

  bundle.rows.tasks.forEach((task) => {
    if (task.status in taskStatusCounts) {
      taskStatusCounts[task.status as TaskStatusKey] += 1;
    }

    if (task.status !== "Done" && new Date(task.dueDate).getTime() < anchor.getTime()) {
      overdueTasks += 1;
    }
    if (task.status === "In-progress" && task.dueDate.slice(0, 10) === anchorYmd) {
      activeDueToday += 1;
    }
    if (task.status === "Blocked" && task.dueDate.slice(0, 10) === anchorYmd) {
      blockedDueToday += 1;
    }

    maxTaskCreatedAgeDays = Math.max(
      maxTaskCreatedAgeDays,
      differenceInUtcDays(anchor, new Date(task.createdAt))
    );
  });

  bundle.rows.updates.forEach((update) => {
    if (update.status in updateStatusCounts) {
      updateStatusCounts[update.status as UpdateStatusKey] += 1;
    }

    const humanLinked = update.linkedTaskId
      ? taskById.get(update.linkedTaskId)
      : undefined;
    const noteState = deriveNoteState(
      update.status,
      update.createdAt,
      humanLinked ? { createdAt: humanLinked.createdAt } : undefined
    );
    noteStateCounts[noteState] += 1;
    if (
      update.status === "Escalated" &&
      differenceInUtcDays(anchor, new Date(update.createdAt)) <= 2
    ) {
      recentEscalations += 1;
    }
    if (update.status === "Escalated" && update.updatedAt.slice(0, 10) === anchorYmd) {
      todayEscalations += 1;
    }
    maxUpdateAgeDays = Math.max(
      maxUpdateAgeDays,
      differenceInUtcDays(anchor, new Date(update.createdAt))
    );
  });

  // Collect Phase A read-model metrics
  const phaseAMetrics = collectPhaseAMetrics(bundle.rows.tasks, anchorDate);

  return {
    taskStatusCounts,
    updateStatusCounts,
    noteStateCounts,
    overdueTasks,
    activeDueToday,
    blockedDueToday,
    todayEscalations,
    recentEscalations,
    maxTaskCreatedAgeDays,
    maxUpdateAgeDays,
    // Phase A metrics
    horizonCounts: phaseAMetrics.horizonCounts,
    technicalReviewQueueCount: phaseAMetrics.technicalReviewQueueCount,
    highSeverityBlockedCount: phaseAMetrics.highSeverityBlockedCount,
    criticalTaskCount: phaseAMetrics.criticalTaskCount,
  };
}

/** Minimum task count for strict validation. Datasets below this use soft validation. */
const SOFT_VALIDATION_TASK_THRESHOLD = 20;

export type ValidateMaterializedBundleOptions = {
  /** If true, log warnings instead of throwing for ratio/threshold errors. */
  softMode?: boolean;
};

export function validateMaterializedBundle(
  bundle: BundleLike,
  anchorDate: Date,
  options?: ValidateMaterializedBundleOptions
): DemoSeedMetrics {
  // Auto-enable soft mode for small datasets
  const taskCount = bundle.rows.tasks.length;
  const effectiveSoftMode = options?.softMode ?? (taskCount < SOFT_VALIDATION_TASK_THRESHOLD);
  const pack = resolveDemoDatasetPack(bundle.datasetKey);
  const leadIdentity = getDemoLeadIdentity(bundle.datasetKey);
  const masterErrs = validateLocationMasterRows(bundle.rows.locations, pack);
  const locIds = new Set(bundle.rows.locations.map((r) => r.id.trim()).filter(Boolean));
  const linkErrs = validateTaskAndAiLocationLinks(
    bundle.rows.tasks,
    bundle.rows.updateAi,
    locIds
  );
  const updateLocErrs = validateUpdateLocationLinks(bundle.rows.updates, locIds);
  const locationErrors = [...masterErrs, ...linkErrs, ...updateLocErrs];
  if (locationErrors.length > 0) {
    throw new Error(
      `Location validation failed for ${bundle.datasetKey}: ${locationErrors.join("; ")}`
    );
  }

  const orgIntegrityErrs = validateCanonicalOrgAndLocationLabels(bundle.rows);
  if (orgIntegrityErrs.length > 0) {
    throw new Error(
      `Org/location label validation failed for ${bundle.datasetKey}: ${orgIntegrityErrs.join("; ")}`
    );
  }

  const metrics = collectSeedMetrics(bundle, anchorDate);
  const errors: string[] = [];
  const taskTotal = bundle.rows.tasks.length || 1;
  const updateTotal = bundle.rows.updates.length || 1;
  const blockedWithoutOwner = bundle.rows.tasks.filter(
    (task) => !task.ownerId
  ).length;
  const aiByUpdateId = new Map(
    bundle.rows.updateAi.map((row) => [row.updateId, row] as const)
  );
  if (
    !ratioWithinTolerance(
      metrics.taskStatusCounts.Done / taskTotal,
      VALIDATION_TARGETS.taskDonePct,
      VALIDATION_TOLERANCE.ratio
    )
  ) {
    errors.push("task Done ratio drifted from target");
  }

  if (
    !ratioWithinTolerance(
      metrics.taskStatusCounts.Blocked / taskTotal,
      VALIDATION_TARGETS.taskBlockedPct,
      VALIDATION_TOLERANCE.ratio
    )
  ) {
    errors.push("task Blocked ratio drifted from target");
  }

  if (
    !ratioWithinTolerance(
      metrics.overdueTasks / taskTotal,
      VALIDATION_TARGETS.taskOverduePct,
      VALIDATION_TOLERANCE.overdueRatio
    )
  ) {
    errors.push("task overdue ratio drifted from target");
  }

  if (
    !ratioWithinTolerance(
      metrics.noteStateCounts.Linked / updateTotal,
      VALIDATION_TARGETS.noteLinkedPct,
      VALIDATION_TOLERANCE.noteLinkedRatio
    )
  ) {
    errors.push("update Linked ratio drifted from target");
  }

  if (
    !ratioWithinTolerance(
      metrics.noteStateCounts.Escalated / updateTotal,
      VALIDATION_TARGETS.noteEscalatedPct,
      VALIDATION_TOLERANCE.ratio
    )
  ) {
    errors.push("update Escalated ratio drifted from target");
  }

  if (metrics.maxTaskCreatedAgeDays > MAX_HISTORY_DAYS) {
    errors.push(
      `task history exceeded ${MAX_HISTORY_DAYS} days (${metrics.maxTaskCreatedAgeDays})`
    );
  }

  if (metrics.maxUpdateAgeDays > MAX_HISTORY_DAYS) {
    errors.push(
      `update history exceeded ${MAX_HISTORY_DAYS} days (${metrics.maxUpdateAgeDays})`
    );
  }

  if (blockedWithoutOwner > 0) {
    errors.push(`${blockedWithoutOwner} tasks are missing owners`);
  }

  const supervisors = bundle.rows.users.filter((u) => u.role === leadIdentity.legacyRole);
  if (supervisors.length === 0) {
    errors.push(`missing ${leadIdentity.legacyRole} user row`);
  } else {
    const invalidSupervisorIdentity = supervisors.filter(
      (u) =>
        u.id !== (leadIdentity.userId || REQUIRED_SUPERVISOR_ID) ||
        u.email !== (leadIdentity.email || REQUIRED_SUPERVISOR_EMAIL) ||
        u.name !== (leadIdentity.name || REQUIRED_SUPERVISOR_NAME)
    );
    if (invalidSupervisorIdentity.length > 0) {
      errors.push(
        `${leadIdentity.legacyRole} identity mismatch (expected id=${leadIdentity.userId || REQUIRED_SUPERVISOR_ID}, email=${leadIdentity.email || REQUIRED_SUPERVISOR_EMAIL}, name=${leadIdentity.name || REQUIRED_SUPERVISOR_NAME})`
      );
    }
  }

  if (metrics.activeDueToday < RECENT_VALIDATION_MINIMUMS.plannedToday) {
    errors.push(
      `planned-today tasks too low (${metrics.activeDueToday} < ${RECENT_VALIDATION_MINIMUMS.plannedToday})`
    );
  }

  if (metrics.blockedDueToday < RECENT_VALIDATION_MINIMUMS.blockedToday) {
    errors.push(
      `blocked-today tasks too low (${metrics.blockedDueToday} < ${RECENT_VALIDATION_MINIMUMS.blockedToday})`
    );
  }

  if (metrics.todayEscalations < RECENT_VALIDATION_MINIMUMS.escalationsToday) {
    errors.push(
      `today escalations too low (${metrics.todayEscalations} < ${RECENT_VALIDATION_MINIMUMS.escalationsToday})`
    );
  }

  if (metrics.recentEscalations < RECENT_VALIDATION_MINIMUMS.recentEscalations) {
    errors.push(
      `recent escalations too low (${metrics.recentEscalations} < ${RECENT_VALIDATION_MINIMUMS.recentEscalations})`
    );
  }

  const hasSpawn = (uid: string) =>
    bundle.rows.tasks.some((t) => t.sourceUpdateId === uid);
  const taskById = new Map(bundle.rows.tasks.map((t) => [t.id, t]));
  const updateById = new Map(bundle.rows.updates.map((u) => [u.id, u]));
  const userById = new Map(bundle.rows.users.map((u) => [u.id, u]));
  const userIdSet = new Set(bundle.rows.users.map((u) => u.id.trim()).filter(Boolean));
  const teamMemberIdSet = new Set(
    bundle.rows.teamMembers.map((tm) => tm.id.trim()).filter(Boolean)
  );
  const ownerIdResolves = (id: string | undefined) => {
    const x = id?.trim();
    if (!x) return false;
    return userIdSet.has(x) || teamMemberIdSet.has(x);
  };
  const disconnectedUpdates = bundle.rows.updates.filter((u) => {
    if (hasSpawn(u.id)) return false;
    if (u.linkedTaskId && taskById.has(u.linkedTaskId)) return false;
    return true;
  });
  if (disconnectedUpdates.length > 0) {
    errors.push(
      `${disconnectedUpdates.length} updates are not linked to a task (need sourceUpdateId on a task or linkedTaskId)`
    );
  }

  const missingSourceUpdates = bundle.rows.tasks.filter(
    (task) => task.sourceUpdateId && !updateById.has(task.sourceUpdateId)
  );
  if (missingSourceUpdates.length > 0) {
    errors.push(
      `${missingSourceUpdates.length} tasks reference a missing source update`
    );
  }

  const tasksWithUnknownOwner = bundle.rows.tasks.filter(
    (task) => !ownerIdResolves(task.ownerId)
  );
  if (tasksWithUnknownOwner.length > 0) {
    errors.push(
      `${tasksWithUnknownOwner.length} tasks reference ownerId that does not resolve to a user or team_member`
    );
  }

  const humanCreatedTasksWithInvalidSource = bundle.rows.tasks.filter(
    (task) => !task.sourceUpdateId && task.source !== "Manual"
  );
  if (humanCreatedTasksWithInvalidSource.length > 0) {
    errors.push(
      `${humanCreatedTasksWithInvalidSource.length} human-created tasks must use source=Manual (AI-created tasks must use sourceUpdateId)`
    );
  }

  const nonSupervisorTaskMutations = bundle.rows.updates.filter((update) => {
    if (!update.linkedTaskId) return false;
    const actor = userById.get(update.recordedBy);
    if (!actor) return true;
    return !isSupervisorRole(actor.role);
  });
  if (nonSupervisorTaskMutations.length > 0) {
    errors.push(
      `${nonSupervisorTaskMutations.length} task-linked updates are not recorded by a supervisor (task updates must be supervisor or AI flow)`
    );
  }

  const invalidHumanLinks = bundle.rows.updates.filter((update) => {
    if (!update.linkedTaskId) return false;
    const linkedTask = taskById.get(update.linkedTaskId);
    if (!linkedTask) return true;
    return linkedTask.createdAt.localeCompare(update.createdAt) >= 0;
  });
  if (invalidHumanLinks.length > 0) {
    errors.push(
      `${invalidHumanLinks.length} updates have invalid linkedTaskId references`
    );
  }

  const reviewRowsMissingExplicitAsk = bundle.rows.updates.filter((update) => {
    if (update.status === "CreatedNewTask") return false;
    const humanLinked = update.linkedTaskId
      ? taskById.get(update.linkedTaskId)
      : undefined;
    const noteState = deriveNoteState(
      update.status,
      update.createdAt,
      humanLinked ? { createdAt: humanLinked.createdAt } : undefined
    );
    if (noteState !== "Review") return false;
    const ai = aiByUpdateId.get(update.id);
    if (!ai) return false;
    const reasons = parseJsonArray(ai.reviewReasonsJson);
    if (ai.reviewRequired !== "1") return true;
    if (reasons.length === 0) return true;
    return reasons.some((reason) => !ALLOWED_REVIEW_UNCERTAINTY_REASONS.has(reason));
  });
  if (reviewRowsMissingExplicitAsk.length > 0) {
    errors.push(
      `${reviewRowsMissingExplicitAsk.length} review updates are missing valid AI-uncertainty metadata`
    );
  }

  const invalidTaskStatuses = bundle.rows.tasks.filter(
    (task) => !ALLOWED_TASK_STATUSES.has(task.status)
  );
  if (invalidTaskStatuses.length > 0) {
    errors.push(
      `${invalidTaskStatuses.length} tasks have invalid status (allowed: Review, New, Planned, In-progress, Blocked, Done)`
    );
  }

  const invalidUpdateStatuses = bundle.rows.updates.filter(
    (update) => !ALLOWED_UPDATE_STATUSES.has(update.status)
  );
  if (invalidUpdateStatuses.length > 0) {
    errors.push(
      `${invalidUpdateStatuses.length} updates have invalid status (allowed: Pending, Processed, CreatedNewTask, Escalated, Saved)`
    );
  }

  const aiTasksOutsideReviewWithoutSupervisorApproval = bundle.rows.tasks.filter((task) => {
    const sourceUpdateId = task.sourceUpdateId?.trim();
    if (!sourceUpdateId || task.status === "Review") return false;
    const update = updateById.get(sourceUpdateId);
    const ai = aiByUpdateId.get(sourceUpdateId);
    const reviewedAt = ai?.reviewedAt?.trim();
    const reviewedBy = ai?.reviewedBy?.trim();
    return update?.status !== "CreatedNewTask" || !reviewedAt || !reviewedBy;
  });
  if (aiTasksOutsideReviewWithoutSupervisorApproval.length > 0) {
    errors.push(
      `${aiTasksOutsideReviewWithoutSupervisorApproval.length} AI-origin tasks moved out of Review without supervisor-approved CreatedNewTask metadata`
    );
  }

  const nonAiReviewTasks = bundle.rows.tasks.filter(
    (task) => !task.sourceUpdateId && task.status === "Review"
  );
  if (nonAiReviewTasks.length > 0) {
    errors.push(
      `${nonAiReviewTasks.length} non-AI tasks are in Review status (Review is only for AI-created tasks)`
    );
  }

  const aiNewTasksNotConvertedFromUpdate = bundle.rows.tasks.filter((task) => {
    if (task.status !== "New") return false;
    const sourceUpdateId = task.sourceUpdateId?.trim();
    if (!sourceUpdateId) return false; // human-created New tasks are allowed
    const update = updateById.get(sourceUpdateId);
    if (!update) return true;
    return update.status !== "CreatedNewTask";
  });
  if (aiNewTasksNotConvertedFromUpdate.length > 0) {
    errors.push(
      `${aiNewTasksNotConvertedFromUpdate.length} AI-origin New tasks are not backed by CreatedNewTask updates`
    );
  }

  const aiNewTasksMissingSupervisorReview = bundle.rows.tasks.filter((task) => {
    if (task.status !== "New") return false;
    const sourceUpdateId = task.sourceUpdateId?.trim();
    if (!sourceUpdateId) return false; // human-created New tasks are allowed
    const ai = aiByUpdateId.get(sourceUpdateId);
    if (!ai) return true;
    const reviewedAt = ai.reviewedAt?.trim();
    const reviewedBy = ai.reviewedBy?.trim();
    return !reviewedAt || !reviewedBy;
  });
  if (aiNewTasksMissingSupervisorReview.length > 0) {
    errors.push(
      `${aiNewTasksMissingSupervisorReview.length} AI-origin New tasks are missing completed supervisor review metadata (reviewedAt/reviewedBy)`
    );
  }

  const nextWeekStart = startOfWeekUtc(anchorDate);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
  const currentWeekStart = startOfWeekUtc(anchorDate);
  const thursdayCutoff = new Date(currentWeekStart);
  thursdayCutoff.setUTCDate(thursdayCutoff.getUTCDate() + 3);
  thursdayCutoff.setUTCHours(23, 59, 59, 999);
  const fridayCutoff = new Date(currentWeekStart);
  fridayCutoff.setUTCDate(fridayCutoff.getUTCDate() + 4);
  fridayCutoff.setUTCHours(23, 59, 59, 999);

  const futureSprintTasks = bundle.rows.tasks.filter((task) => {
    const dueAt = new Date(task.dueDate);
    if (Number.isNaN(dueAt.getTime())) return false;
    return dueAt >= nextWeekStart;
  });

  const nextWeekNonSprintStatuses = futureSprintTasks.filter(
    (task) => !["New", "Planned", "Review", "Blocked"].includes(task.status)
  );
  if (nextWeekNonSprintStatuses.length > 0) {
    errors.push(
      `${nextWeekNonSprintStatuses.length} future tasks (next week onward) are outside sprint-planning buckets (allowed: New, Planned, Review, Blocked)`
    );
  }

  const planningCandidates = futureSprintTasks.filter((task) =>
    ["New", "Planned"].includes(task.status)
  );

  const thursdaySnapshotRaw = planningCandidates.filter(
    (task) => new Date(task.createdAt).getTime() <= thursdayCutoff.getTime()
  );
  const thursdaySnapshot =
    thursdaySnapshotRaw.length > 0 ? thursdaySnapshotRaw : planningCandidates;
  if (thursdaySnapshot.length === 0) {
    errors.push("future planning basket has no New/Planned tasks to evaluate");
  } else {
    const plannedRatio =
      thursdaySnapshot.filter((task) => task.status === "Planned").length /
      thursdaySnapshot.length;
    if (plannedRatio < 0.8) {
      errors.push(
        `next-week Thursday planned ratio too low (${plannedRatio.toFixed(2)} < 0.80)`
      );
    }
  }

  const fridaySnapshotRaw = planningCandidates.filter(
    (task) => new Date(task.createdAt).getTime() <= fridayCutoff.getTime()
  );
  const fridaySnapshot =
    fridaySnapshotRaw.length > 0 ? fridaySnapshotRaw : planningCandidates;
  if (fridaySnapshot.length === 0) {
    errors.push("future planning basket has no New/Planned tasks to evaluate");
  } else {
    const plannedRatio =
      fridaySnapshot.filter((task) => task.status === "Planned").length /
      fridaySnapshot.length;
    if (plannedRatio < 0.96) {
      errors.push(
        `next-week Friday planned ratio too low (${plannedRatio.toFixed(2)} < 0.96)`
      );
    }
  }

  const blockerUpdatesMissingExistingTaskLink = bundle.rows.updateAi.filter((ai) => {
    if (ai.category !== "Blocker") return false;
    const update = updateById.get(ai.updateId);
    if (!update) return true;
    if (!update.linkedTaskId) return true;
    const linkedTask = taskById.get(update.linkedTaskId);
    if (!linkedTask) return true;
    return linkedTask.createdAt.localeCompare(update.createdAt) >= 0;
  });
  if (blockerUpdatesMissingExistingTaskLink.length > 0) {
    errors.push(
      `${blockerUpdatesMissingExistingTaskLink.length} Blocker AI suggestions are not linked to an existing older task`
    );
  }

  const blockerTodayCount = bundle.rows.updateAi.filter((ai) => {
    if (ai.category !== "Blocker") return false;
    const update = updateById.get(ai.updateId);
    if (!update) return false;
    return update.updatedAt.slice(0, 10) === anchorDate.toISOString().slice(0, 10);
  }).length;
  if (blockerTodayCount < 1) {
    errors.push("requires at least 1 Blocker update today");
  }

  const convertedToTaskRowsInvalid = bundle.rows.updates.filter((update) => {
    if (update.status !== "CreatedNewTask") return false;
    if (update.linkedTaskId?.trim()) return true;
    const spawned = bundle.rows.tasks.some((task) => task.sourceUpdateId === update.id);
    return !spawned;
  });
  if (convertedToTaskRowsInvalid.length > 0) {
    errors.push(
      `${convertedToTaskRowsInvalid.length} CreatedNewTask updates are invalid (must spawn a new task via sourceUpdateId and must not use linkedTaskId)`
    );
  }

  const nonCreatedStatusesMissingLinkedTask = bundle.rows.updates.filter((update) => {
    if (update.status === "CreatedNewTask") return false;
    if (!update.linkedTaskId?.trim()) return true;
    const linkedTask = taskById.get(update.linkedTaskId);
    if (!linkedTask) return true;
    return linkedTask.createdAt.localeCompare(update.createdAt) >= 0;
  });
  if (nonCreatedStatusesMissingLinkedTask.length > 0) {
    errors.push(
      `${nonCreatedStatusesMissingLinkedTask.length} non-CreatedNewTask updates are missing a valid linked existing task`
    );
  }

  // Phase A read-model fixture validation
  // Ensures seed data supports derivation of commitment horizons and technical review queue
  const phaseAErrors = validatePhaseAFixtures(bundle.rows.tasks, anchorDate);
  errors.push(...phaseAErrors);

  if (errors.length > 0) {
    if (effectiveSoftMode) {
      console.warn(
        `[SOFT] Validation warnings for ${bundle.datasetKey} (${taskCount} tasks): ${errors.join("; ")}`
      );
    } else {
      throw new Error(
        `Smart seed validation failed for ${bundle.datasetKey}: ${errors.join("; ")}`
      );
    }
  }

  return metrics;
}

// ============================================================================
// Phase B Validation
// ============================================================================

/**
 * Zero-initialized Phase B commitment status counts.
 */
function zeroCommitmentStatusCounts(): Record<CommitmentStatusKey, number> {
  return {
    planned: 0,
    in_progress: 0,
    completed: 0,
    at_risk: 0,
    missed: 0,
    carried_over: 0,
  };
}

/**
 * Collects Phase B metrics from generated entities.
 */
export function collectPhaseBMetrics(
  workCycles: WorkCycleRow[],
  commitments: CommitmentRow[],
  dependencies: TaskDependencyRow[]
): PhaseBMetrics {
  const commitmentStatusCounts = zeroCommitmentStatusCounts();

  for (const commitment of commitments) {
    if (commitment.status in commitmentStatusCounts) {
      commitmentStatusCounts[commitment.status as CommitmentStatusKey]++;
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

  return {
    workCycleCount: workCycles.length,
    commitmentCount: commitments.length,
    commitmentStatusCounts,
    dependencyCount: dependencies.length,
    serialChainCount,
    parallelDependencyCount,
    carriedOverCount,
  };
}

/**
 * Validates Phase B fixtures for project-scope integrity and dependency graph safety.
 */
export function validatePhaseBFixtures(
  workCycles: WorkCycleRow[],
  commitments: CommitmentRow[],
  dependencies: TaskDependencyRow[],
  tasks: { id: string; projectId: string }[]
): string[] {
  const errors: string[] = [];
  const metrics = collectPhaseBMetrics(workCycles, commitments, dependencies);

  // Validate minimum counts
  if (metrics.workCycleCount < PHASE_B_VALIDATION_TARGETS.minWorkCyclesPerProject) {
    errors.push(
      `Phase B: work cycles too low (${metrics.workCycleCount} < ${PHASE_B_VALIDATION_TARGETS.minWorkCyclesPerProject})`
    );
  }

  if (metrics.commitmentCount < PHASE_B_VALIDATION_TARGETS.minCommitmentsPerProject) {
    errors.push(
      `Phase B: commitments too low (${metrics.commitmentCount} < ${PHASE_B_VALIDATION_TARGETS.minCommitmentsPerProject})`
    );
  }

  if (metrics.dependencyCount < PHASE_B_VALIDATION_TARGETS.minDependenciesPerProject) {
    errors.push(
      `Phase B: dependencies too low (${metrics.dependencyCount} < ${PHASE_B_VALIDATION_TARGETS.minDependenciesPerProject})`
    );
  }

  // Validate project-scope integrity
  const projectIds = new Set(tasks.map((t) => t.projectId));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

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
      const task = taskById.get(commitment.sourceTaskId);
      if (task && task.projectId !== commitment.projectId) {
        errors.push(
          `Commitment ${commitment.id} has PROJECT_SCOPE_MISMATCH: commitment.projectId=${commitment.projectId}, task.projectId=${task.projectId}`
        );
      }
    }
  }

  for (const dep of dependencies) {
    const predecessor = taskById.get(dep.predecessorTaskId);
    const successor = taskById.get(dep.successorTaskId);

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

    // Self-edge check
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
