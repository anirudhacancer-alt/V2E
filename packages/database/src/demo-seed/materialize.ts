import {
  BLOCKED_OPEN_BUCKET_RATIOS,
  MAX_HISTORY_DAYS,
  SEED_TARGETS,
  TASK_STATUS_RATIOS,
  UPDATE_STATUS_BY_RECENCY,
  UPDATE_RECENCY_RATIOS,
} from "./config.js";
import {
  addBusinessDays,
  addUtcDays,
  addUtcHours,
  addUtcMinutes,
  allocateCounts,
  businessDayProgress,
  businessDaysRemainingInWeek,
  clamp,
  expandCounts,
  isBusinessDay,
  maxDate,
  offsetFromHash,
  sortBySeed,
  startOfUtcDay,
  startOfWeekUtc,
  toIso,
  withUtcTime,
} from "./helpers.js";
import {
  collectSeedMetrics,
  deriveNoteState,
} from "./validate.js";
import {
  generateWorkCycles,
  generateCommitments,
  generateTaskDependencies,
  type WorkCycleRow,
  type CommitmentRow,
  type TaskDependencyRow,
} from "./phase-b-entities.js";
import {
  applyOrgDepartmentFields,
  DEMO_SITE_SUPERVISOR_EMAIL,
  DEMO_SITE_SUPERVISOR_NAME,
  DEMO_SITE_SUPERVISOR_USER_ID,
  getDemoLeadIdentity,
} from "./org-mappings.js";
import type {
  CsvRow,
  DemoBundleRows,
  LoadedDemoBundle,
  MaterializedDemoBundle,
  UpdateStatusKey,
} from "./types.js";

type TaskBucket =
  | "doneThisWeek"
  | "doneLastWeek"
  | "doneLast60"
  | "overdueRecent"
  | "overdueOlder"
  | "dueToday"
  | "dueTomorrow"
  | "dueThisWeek"
  | "dueNextWeek"
  | "dueWeekPlus2";

type OpenTaskBucket = Exclude<
  TaskBucket,
  "doneThisWeek" | "doneLastWeek" | "doneLast60"
>;

type UpdateRecencyBucket = "last3d" | "thisWeek" | "last2Weeks" | "last60d";

type SeedReviewReason =
  | "low_confidence_extraction"
  | "category_uncertain"
  | "location_uncertain"
  | "severity_uncertain"
  | "owner_uncertain"
  | "due_date_uncertain";

type SeedReviewField =
  | "extraction"
  | "category"
  | "location"
  | "severity"
  | "owner"
  | "dueDate"
  | "taskProposal";

type SeedReviewRequirement = {
  required: boolean;
  reasons: SeedReviewReason[];
  fields: SeedReviewField[];
  prompt?: string;
};

const OPEN_TASK_BUCKET_ORDER: OpenTaskBucket[] = [
  "overdueRecent",
  "overdueOlder",
  "dueToday",
  "dueTomorrow",
  "dueThisWeek",
  "dueNextWeek",
  "dueWeekPlus2",
];

function cloneRows(rows: CsvRow[]): CsvRow[] {
  return rows.map((row) => ({ ...row }));
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

const REVIEW_REASON_ORDER: SeedReviewReason[] = [
  "low_confidence_extraction",
  "category_uncertain",
  "location_uncertain",
  "severity_uncertain",
  "owner_uncertain",
  "due_date_uncertain",
];

const REVIEW_FIELD_ORDER: SeedReviewField[] = [
  "extraction",
  "taskProposal",
  "category",
  "location",
  "severity",
  "owner",
  "dueDate",
];

const REVIEW_FIELD_LABELS: Record<SeedReviewField, string> = {
  extraction: "AI extraction",
  taskProposal: "new task proposal",
  category: "category",
  location: "location",
  severity: "severity",
  owner: "owner",
  dueDate: "due date",
};

function orderedUnique<T extends string>(
  values: Iterable<T>,
  order: readonly T[]
): T[] {
  const set = new Set(values);
  return order.filter((value) => set.has(value));
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? "";
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildReviewPrompt(requirement: {
  reasons: SeedReviewReason[];
  fields: SeedReviewField[];
}): string {
  const fieldLabels = orderedUnique(
    requirement.fields.filter(
      (field): field is Exclude<SeedReviewField, "extraction" | "taskProposal"> =>
        field !== "extraction" && field !== "taskProposal"
    ),
    REVIEW_FIELD_ORDER.filter(
      (field): field is Exclude<SeedReviewField, "extraction" | "taskProposal"> =>
        field !== "extraction" && field !== "taskProposal"
    )
  ).map((field) => REVIEW_FIELD_LABELS[field]);

  const hasLowConfidence = requirement.reasons.includes("low_confidence_extraction");
  const hasTaskProposal = requirement.fields.includes("taskProposal");

  if (hasLowConfidence && hasTaskProposal) {
    if (fieldLabels.length > 0) {
      return `Confirm: AI extraction, new task proposal, and ${joinLabels(fieldLabels)}`;
    }
    return "Confirm: AI extraction and new task proposal";
  }
  if (hasTaskProposal) {
    if (fieldLabels.length > 0) {
      return `Confirm: new task proposal and ${joinLabels(fieldLabels)}`;
    }
    return "Confirm: new task proposal";
  }
  if (fieldLabels.length > 0) {
    return `Confirm: ${joinLabels(fieldLabels)}`;
  }
  return "Confirm: AI extraction";
}

function normalizeSeedReviewRequirement(input: {
  requirement?: Partial<SeedReviewRequirement> | null;
  confidence: number;
  lowConfidenceThreshold?: number;
  taskProposalSuggested?: boolean;
}): SeedReviewRequirement {
  const threshold = input.lowConfidenceThreshold ?? 0.65;
  const rawReasons = new Set<SeedReviewReason>(
    (input.requirement?.reasons ?? []) as SeedReviewReason[]
  );
  const rawFields = new Set<SeedReviewField>(
    (input.requirement?.fields ?? []) as SeedReviewField[]
  );

  if (input.confidence < threshold) {
    rawReasons.add("low_confidence_extraction");
    rawFields.add("extraction");
  }
  if (input.taskProposalSuggested) {
    rawFields.add("taskProposal");
  }

  // Review must always be justified by uncertainty reasons, not just task-proposal intent.
  if (input.requirement?.required && rawReasons.size === 0) {
    rawReasons.add("low_confidence_extraction");
    rawFields.add("extraction");
  }

  const reasons = orderedUnique(rawReasons, REVIEW_REASON_ORDER);
  const fields = orderedUnique(rawFields, REVIEW_FIELD_ORDER);
  const required =
    input.requirement?.required !== undefined
      ? input.requirement.required
      : reasons.length > 0;

  let prompt = input.requirement?.prompt?.trim();
  if (!prompt && required) {
    prompt = buildReviewPrompt({ reasons, fields });
  } else if (prompt && !prompt.toLowerCase().startsWith("confirm:")) {
    prompt = `Confirm: ${prompt}`;
  }

  return {
    required,
    reasons,
    fields,
    prompt,
  };
}

function hasExplicitReviewMetadata(row: CsvRow): boolean {
  return (
    row.reviewRequired === "1" ||
    Boolean(row.reviewPrompt?.trim()) ||
    Boolean(row.reviewedAt?.trim()) ||
    Boolean(row.reviewedBy?.trim()) ||
    (row.reviewReasonsJson !== undefined &&
      row.reviewReasonsJson.trim() !== "" &&
      row.reviewReasonsJson.trim() !== "[]") ||
    (row.reviewFieldsJson !== undefined &&
      row.reviewFieldsJson.trim() !== "" &&
      row.reviewFieldsJson.trim() !== "[]")
  );
}

function currentWeekCompletionRate(anchor: Date): number {
  return clamp(0.15 + businessDayProgress(anchor) * 0.7, 0.15, 0.9);
}

function earliestAllowed(anchor: Date, seed: string, id: string): Date {
  return withUtcTime(
    addUtcDays(anchor, -MAX_HISTORY_DAYS),
    7,
    offsetFromHash(seed, `${id}:earliest`, 0, 45)
  );
}

function buildDueThisWeekWeights(anchor: Date) {
  const remaining = businessDaysRemainingInWeek(anchor);
  if (remaining <= 1) {
    return { dueToday: 1, dueTomorrow: 0, dueThisWeek: 0 };
  }
  if (remaining === 2) {
    return { dueToday: 0.55, dueTomorrow: 0.45, dueThisWeek: 0 };
  }
  return { dueToday: 0.25, dueTomorrow: 0.2, dueThisWeek: 0.55 };
}

function pickTaskDueDate(bucket: TaskBucket, anchor: Date, seed: string, id: string) {
  const minute = offsetFromHash(seed, `${id}:${bucket}:minute`, 0, 50);
  switch (bucket) {
    case "overdueRecent":
      return withUtcTime(
        addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}`, 1, 3)),
        16,
        minute
      );
    case "overdueOlder":
      return withUtcTime(
        addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}`, 4, 14)),
        16,
        minute
      );
    case "dueToday":
      return withUtcTime(anchor, 16, minute);
    case "dueTomorrow":
      return withUtcTime(addBusinessDays(anchor, 1), 16, minute);
    case "dueThisWeek": {
      const remaining = businessDaysRemainingInWeek(anchor);
      const futureDays = remaining >= 3 ? offsetFromHash(seed, `${id}:${bucket}`, 2, remaining - 1) : 1;
      return withUtcTime(addBusinessDays(anchor, futureDays), 16, minute);
    }
    case "dueNextWeek": {
      const nextWeek = addUtcDays(startOfWeekUtc(anchor), 7);
      return withUtcTime(
        addBusinessDays(nextWeek, offsetFromHash(seed, `${id}:${bucket}`, 0, 4)),
        16,
        minute
      );
    }
    case "dueWeekPlus2": {
      const weekPlus2 = addUtcDays(startOfWeekUtc(anchor), 14);
      return withUtcTime(
        addBusinessDays(weekPlus2, offsetFromHash(seed, `${id}:${bucket}`, 0, 4)),
        16,
        minute
      );
    }
    case "doneThisWeek": {
      const weekday = Math.max(0, Math.min(4, businessDaysRemainingInWeek(anchor) === 0 ? 4 : 5 - businessDaysRemainingInWeek(anchor)));
      return withUtcTime(
        addBusinessDays(startOfWeekUtc(anchor), offsetFromHash(seed, `${id}:${bucket}`, 0, weekday)),
        15,
        minute
      );
    }
    case "doneLastWeek": {
      const lastWeek = addUtcDays(startOfWeekUtc(anchor), -7);
      return withUtcTime(
        addBusinessDays(lastWeek, offsetFromHash(seed, `${id}:${bucket}`, 0, 4)),
        15,
        minute
      );
    }
    case "doneLast60":
      return withUtcTime(
        addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}`, 15, 50)),
        15,
        minute
      );
  }
}

function clampCreatedAt(anchor: Date, seed: string, id: string, createdAt: Date): Date {
  return maxDate(createdAt, earliestAllowed(anchor, seed, id));
}

function assignTaskDates(
  row: CsvRow,
  bucket: TaskBucket,
  status: "In-progress" | "Blocked" | "Done",
  anchor: Date,
  seed: string
): CsvRow {
  const dueDate = pickTaskDueDate(bucket, anchor, seed, row.id);

  let leadDays = 5;
  if (bucket === "overdueOlder") {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 10, 18);
  } else if (bucket === "overdueRecent") {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 7, 12);
  } else if (bucket === "dueNextWeek" || bucket === "dueWeekPlus2") {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 4, 10);
  } else if (bucket === "doneLast60") {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 6, 16);
  } else if (bucket === "doneLastWeek" || bucket === "doneThisWeek") {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 3, 10);
  } else {
    leadDays = offsetFromHash(seed, `${row.id}:${bucket}:lead`, 2, 7);
  }

  const createdAt = clampCreatedAt(
    anchor,
    seed,
    row.id,
    withUtcTime(
      addUtcDays(dueDate, -leadDays),
      7 + offsetFromHash(seed, `${row.id}:created-hour`, 0, 3),
      offsetFromHash(seed, `${row.id}:created-minute`, 0, 50)
    )
  );

  let startDate = addUtcHours(
    createdAt,
    offsetFromHash(seed, `${row.id}:start-offset`, 2, 14)
  );
  let updatedAt = withUtcTime(
    addUtcDays(anchor, -offsetFromHash(seed, `${row.id}:updated-days`, 0, 4)),
    9 + offsetFromHash(seed, `${row.id}:updated-hour`, 0, 8),
    offsetFromHash(seed, `${row.id}:updated-minute`, 0, 50)
  );
  let completedAt = "";

  if (status === "Done") {
    completedAt = toIso(
      addUtcHours(
        dueDate,
        offsetFromHash(seed, `${row.id}:completed-offset`, 2, 22)
      )
    );
    updatedAt = addUtcHours(new Date(completedAt), 1);
  } else if (updatedAt.getTime() <= createdAt.getTime()) {
    updatedAt = addUtcHours(
      createdAt,
      offsetFromHash(seed, `${row.id}:updated-after-created`, 8, 48)
    );
  }

  if (startDate.getTime() >= dueDate.getTime()) {
    startDate = addUtcHours(createdAt, 2);
  }

  return {
    ...row,
    status,
    sourceUpdateId: "",
    createdAt: toIso(createdAt),
    startDate: toIso(startDate),
    dueDate: toIso(dueDate),
    completedAt,
    updatedAt: toIso(updatedAt),
  };
}

function materializeUsers(rows: CsvRow[], anchor: Date, seed: string) {
  const datasetKey = seed.split(":")[0] ?? "";
  const leadIdentity = getDemoLeadIdentity(datasetKey);
  return sortBySeed(rows, `${seed}:users`, (row) => row.id).map((row, index) => {
    const createdAt = withUtcTime(
      addUtcDays(anchor, -(45 - Math.min(index * 2, 24))),
      8 + (index % 4),
      0
    );
    const isSupervisor = row.role === leadIdentity.legacyRole;
    return {
      ...row,
      ...(isSupervisor
        ? {
            id: leadIdentity.userId || DEMO_SITE_SUPERVISOR_USER_ID,
            email: leadIdentity.email || DEMO_SITE_SUPERVISOR_EMAIL,
            name: leadIdentity.name || DEMO_SITE_SUPERVISOR_NAME,
          }
        : {}),
      createdAt: toIso(createdAt),
      updatedAt: toIso(addUtcHours(createdAt, 6)),
    };
  });
}

function materializeSites(rows: CsvRow[], anchor: Date) {
  return rows.map((row) => ({
    ...row,
    createdAt: toIso(withUtcTime(addUtcDays(anchor, -58), 8, 0)),
    updatedAt: toIso(withUtcTime(addUtcDays(anchor, -7), 9, 30)),
  }));
}

function materializeProjects(rows: CsvRow[], anchor: Date) {
  return rows.map((row) => ({
    ...row,
    createdAt: toIso(withUtcTime(addUtcDays(anchor, -57), 8, 20)),
    updatedAt: toIso(withUtcTime(addUtcDays(anchor, -4), 10, 0)),
  }));
}

function materializeTeamMembers(rows: CsvRow[], anchor: Date, seed: string) {
  const datasetKey = seed.split(":")[0] ?? "";
  const leadIdentity = getDemoLeadIdentity(datasetKey);
  return sortBySeed(rows, `${seed}:team`, (row) => row.id).map((row, index) => {
    const joinedAt = withUtcTime(
      addUtcDays(anchor, -(50 - Math.min(index * 3, 28))),
      7 + (index % 3),
      15
    );
    const isSiteSupervisor = row.role === leadIdentity.legacyRole;
    return {
      ...row,
      ...(isSiteSupervisor
        ? {
            ...(leadIdentity.teamMemberId ? { id: leadIdentity.teamMemberId } : {}),
            name: leadIdentity.name || DEMO_SITE_SUPERVISOR_NAME,
            email: leadIdentity.email || DEMO_SITE_SUPERVISOR_EMAIL,
          }
        : {}),
      joinedAt: toIso(joinedAt),
      createdAt: toIso(addUtcHours(joinedAt, 4)),
      updatedAt: toIso(addUtcDays(joinedAt, 1)),
    };
  });
}

function pickUpdateCreatedAt(
  bucket: UpdateRecencyBucket,
  anchor: Date,
  seed: string,
  id: string
) {
  const minute = offsetFromHash(seed, `${id}:${bucket}:minute`, 0, 50);
  if (bucket === "last3d") {
    return withUtcTime(
      addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}:days`, 0, 2)),
      8 + offsetFromHash(seed, `${id}:${bucket}:hour`, 0, 8),
      minute
    );
  }
  if (bucket === "thisWeek") {
    return withUtcTime(
      addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}:days`, 3, 6)),
      8 + offsetFromHash(seed, `${id}:${bucket}:hour`, 0, 8),
      minute
    );
  }
  if (bucket === "last2Weeks") {
    return withUtcTime(
      addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}:days`, 7, 14)),
      8 + offsetFromHash(seed, `${id}:${bucket}:hour`, 0, 8),
      minute
    );
  }
  return withUtcTime(
    addUtcDays(anchor, -offsetFromHash(seed, `${id}:${bucket}:days`, 15, 55)),
    8 + offsetFromHash(seed, `${id}:${bucket}:hour`, 0, 8),
    minute
  );
}

function materializeUpdates(
  rows: CsvRow[],
  anchor: Date,
  seed: string
): CsvRow[] {
  const sorted = sortBySeed(rows, `${seed}:updates`, (row) => row.id);
  const recencyCounts = allocateCounts(sorted.length, UPDATE_RECENCY_RATIOS);
  const recencyBuckets = expandCounts(
    recencyCounts,
    ["last3d", "thisWeek", "last2Weeks", "last60d"]
  );
  const statusPoolByBucket = new Map<UpdateRecencyBucket, UpdateStatusKey[]>();
  (["last3d", "thisWeek", "last2Weeks", "last60d"] as const).forEach((bucket) => {
    const count = recencyCounts[bucket];
    const statusCounts = allocateCounts(count, UPDATE_STATUS_BY_RECENCY[bucket]);
    statusPoolByBucket.set(
      bucket,
      expandCounts(statusCounts, [
        "Pending",
        "Processed",
        "CreatedNewTask",
        "Escalated",
        "Saved",
      ])
    );
  });

  const materialized = sorted.map((row, index) => {
    const bucket = recencyBuckets[index];
    const statusPool = statusPoolByBucket.get(bucket);
    const status = statusPool?.shift();
    if (!status) {
      throw new Error(`Unable to assign update status for recency bucket ${bucket}`);
    }
    const createdAt = pickUpdateCreatedAt(bucket, anchor, seed, row.id);
    const updatedAt = addUtcMinutes(
      createdAt,
      offsetFromHash(seed, `${row.id}:updated-offset`, 20, 300)
    );

    return {
      ...row,
      status,
      createdAt: toIso(createdAt),
      updatedAt: toIso(updatedAt),
      isRead: "1",
      readAt: toIso(addUtcMinutes(createdAt, 45)),
    };
  });

  const anchorYmd = anchor.toISOString().slice(0, 10);
  const escalationsToday = materialized.filter(
    (row) => row.status === "Escalated" && row.updatedAt.slice(0, 10) === anchorYmd
  );

  if (escalationsToday.length < 2) {
    const candidates = materialized
      .filter(
        (row) =>
          row.updatedAt.slice(0, 10) === anchorYmd && row.status !== "Escalated"
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    for (const row of candidates.slice(0, Math.max(0, 2 - escalationsToday.length))) {
      row.status = "Escalated";
    }
  }

  return materialized;
}

function taskBucketCounts(taskCount: number, anchor: Date) {
  const doneCount = allocateCounts(taskCount, TASK_STATUS_RATIOS).Done;
  const openCount = taskCount - doneCount;
  const overdueCount = Math.min(
    openCount,
    Math.round(taskCount * SEED_TARGETS.overduePct)
  );
  const dueThisWeekTotal = Math.max(
    1,
    Math.round(taskCount * SEED_TARGETS.dueThisWeekPct)
  );
  const doneThisWeek = Math.min(
    doneCount,
    Math.round(dueThisWeekTotal * currentWeekCompletionRate(anchor))
  );
  const dueThisWeekOpen =
    businessDaysRemainingInWeek(anchor) === 0
      ? 0
      : Math.max(0, dueThisWeekTotal - doneThisWeek);
  const remainingOpen = Math.max(0, openCount - overdueCount - dueThisWeekOpen);

  return {
    taskStatusCounts: allocateCounts(taskCount, TASK_STATUS_RATIOS),
    doneBuckets: {
      doneThisWeek,
      ...allocateCounts(doneCount - doneThisWeek, {
        doneLastWeek: 0.6,
        doneLast60: 0.4,
      }),
    },
    openBuckets: {
      ...allocateCounts(overdueCount, {
        overdueRecent: 0.4,
        overdueOlder: 0.6,
      }),
      ...allocateCounts(dueThisWeekOpen, buildDueThisWeekWeights(anchor)),
      ...allocateCounts(remainingOpen, {
        dueNextWeek: 0.65,
        dueWeekPlus2: 0.35,
      }),
    },
  };
}

function zeroOpenBucketCounts(): Record<OpenTaskBucket, number> {
  return {
    overdueRecent: 0,
    overdueOlder: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0,
    dueNextWeek: 0,
    dueWeekPlus2: 0,
  };
}

function blockedBucketCap(
  bucket: OpenTaskBucket,
  available: number
): number {
  if (bucket === "dueToday") {
    return Math.max(0, available - 3);
  }
  if (bucket === "dueTomorrow") {
    return Math.max(0, available - 2);
  }
  if (bucket === "dueThisWeek") {
    return Math.max(0, available - 6);
  }
  if (bucket === "dueNextWeek") {
    return Math.max(0, available - 8);
  }
  if (bucket === "dueWeekPlus2") {
    return Math.max(0, available - 4);
  }
  return 0;
}

function allocateBlockedOpenBuckets(
  openBuckets: Record<OpenTaskBucket, number>,
  blockedTotal: number
): Record<OpenTaskBucket, number> {
  const preferredWeights = Object.fromEntries(
    OPEN_TASK_BUCKET_ORDER.map((bucket) => [
      bucket,
      openBuckets[bucket] > 0 ? BLOCKED_OPEN_BUCKET_RATIOS[bucket] : 0,
    ])
  ) as Record<OpenTaskBucket, number>;
  const preferredCounts = allocateCounts(blockedTotal, preferredWeights);
  const blockedCounts = zeroOpenBucketCounts();

  let remaining = blockedTotal;
  for (const bucket of OPEN_TASK_BUCKET_ORDER) {
    const capped = Math.min(
      preferredCounts[bucket] ?? 0,
      blockedBucketCap(bucket, openBuckets[bucket])
    );
    blockedCounts[bucket] = capped;
    remaining -= capped;
  }

  const preferredFillOrder: OpenTaskBucket[] = [
    "dueThisWeek",
    "dueTomorrow",
    "dueToday",
    "dueNextWeek",
    "dueWeekPlus2",
  ];
  for (const bucket of preferredFillOrder) {
    while (
      remaining > 0 &&
      blockedCounts[bucket] < blockedBucketCap(bucket, openBuckets[bucket])
    ) {
      blockedCounts[bucket] += 1;
      remaining -= 1;
    }
  }

  if (remaining > 0) {
    const fallbackFillOrder: OpenTaskBucket[] = [
      "dueThisWeek",
      "dueNextWeek",
      "dueTomorrow",
      "dueToday",
      "dueWeekPlus2",
      "overdueRecent",
      "overdueOlder",
    ];
    for (const bucket of fallbackFillOrder) {
      while (remaining > 0 && blockedCounts[bucket] < openBuckets[bucket]) {
        blockedCounts[bucket] += 1;
        remaining -= 1;
      }
    }
  }

  if (remaining > 0) {
    throw new Error(`Unable to allocate ${blockedTotal} blocked task buckets`);
  }

  return blockedCounts;
}

function materializeTasks(
  rows: CsvRow[],
  anchor: Date,
  seed: string
): { tasks: CsvRow[] } {
  const sorted = sortBySeed(rows, `${seed}:tasks`, (row) => row.id);
  const { taskStatusCounts, doneBuckets, openBuckets } = taskBucketCounts(
    sorted.length,
    anchor
  );
  const doneRows = sorted.slice(0, taskStatusCounts.Done);
  const openRows = sorted.slice(taskStatusCounts.Done);

  const doneBucketList = expandCounts(doneBuckets, [
    "doneThisWeek",
    "doneLastWeek",
    "doneLast60",
  ]);
  const blockedOpenBuckets = allocateBlockedOpenBuckets(
    openBuckets,
    taskStatusCounts.Blocked
  );
  const activeOpenBuckets = OPEN_TASK_BUCKET_ORDER.reduce(
    (result, bucket) => {
      result[bucket] = openBuckets[bucket] - blockedOpenBuckets[bucket];
      return result;
    },
    zeroOpenBucketCounts()
  );

  const materializedDone = doneRows.map((row, index) => {
    const bucket = doneBucketList[index];
    return assignTaskDates(row, bucket, "Done", anchor, seed);
  });

  const openAssignments = [
    ...expandCounts(activeOpenBuckets, OPEN_TASK_BUCKET_ORDER).map((bucket) => ({
      bucket,
      status: "In-progress" as const,
    })),
    ...expandCounts(blockedOpenBuckets, OPEN_TASK_BUCKET_ORDER).map((bucket) => ({
      bucket,
      status: "Blocked" as const,
    })),
  ];

  const materializedOpen = openRows.map((row, index) => {
    const assignment = openAssignments[index];
    if (!assignment) {
      throw new Error("Unable to assign open task bucket");
    }
    const { bucket, status } = assignment;
    return assignTaskDates(row, bucket, status, anchor, seed);
  });

  return {
    tasks: [...materializedDone, ...materializedOpen],
  };
}

function moveTaskBeforeUpdate(
  task: CsvRow,
  update: CsvRow,
  anchor: Date,
  seed: string
) {
  const createdAt = clampCreatedAt(
    anchor,
    seed,
    task.id,
    addUtcHours(
      new Date(update.createdAt),
      -offsetFromHash(seed, `${task.id}:before-update`, 12, 120)
    )
  );

  task.createdAt = toIso(createdAt);
  task.startDate = toIso(addUtcHours(createdAt, 3));
  task.updatedAt = toIso(
    maxDate(new Date(task.updatedAt), new Date(update.updatedAt))
  );
}

/**
 * Connect every update to a task:
 * - First `maxPairs` updates (sorted by id) spawn tasks via `tasks.sourceUpdateId` (voice / AI).
 * - Next `maxPairs` updates set `linkedTaskId` to those same tasks (human follow-up on existing work).
 * Remaining updates (odd count) or overflow get `linkedTaskId` via `linkOrphanUpdatesToTasks`.
 */
function applyUpdateTaskLinkage(
  tasks: CsvRow[],
  updates: CsvRow[],
  anchor: Date,
  seed: string
) {
  const datasetKey = seed.split(":")[0] ?? "";
  const supervisorId = getDemoLeadIdentity(datasetKey).userId;
  for (const u of updates) {
    u.linkedTaskId = "";
  }

  const sortedUpdates = sortBySeed(updates, `${seed}:updates`, (r) => r.id);
  const anchorYmd = anchor.toISOString().slice(0, 10);
  const spawnCandidates = sortBySeed(
    tasks.filter(
      (t) => t.status === "In-progress" && t.dueDate.slice(0, 10) !== anchorYmd
    ),
    `${seed}:tasks-in-progress-for-spawn`,
    (r) => r.id
  );

  const maxPairs = Math.min(
    Math.floor(sortedUpdates.length / 2),
    spawnCandidates.length
  );

  for (let i = 0; i < maxPairs; i += 1) {
    const update = sortedUpdates[i];
    const task = spawnCandidates[i];
    task.sourceUpdateId = update.id;
    task.source = i % 2 === 0 ? "VoiceUpdate" : "AIGenerated";
    task.status = "Review";
    update.status = "CreatedNewTask";
    update.linkedTaskId = "";
    if (new Date(task.createdAt).getTime() >= new Date(update.createdAt).getTime()) {
      moveTaskBeforeUpdate(task, update, anchor, seed);
    }
  }

  for (let i = 0; i < maxPairs; i += 1) {
    const update = sortedUpdates[maxPairs + i];
    const task = spawnCandidates[i];
    update.linkedTaskId = task.id;
    if (update.status === "CreatedNewTask") {
      update.status = "Processed";
    }
    if (new Date(update.createdAt).getTime() <= new Date(task.createdAt).getTime()) {
      const base = new Date(task.createdAt);
      const bumped = addUtcHours(
        base,
        2 + offsetFromHash(seed, `${update.id}:human-after-task`, 0, 8)
      );
      update.createdAt = toIso(bumped);
      update.updatedAt = toIso(
        addUtcMinutes(
          bumped,
          offsetFromHash(seed, `${update.id}:hum-upd`, 30, 120)
        )
      );
    }
  }

  linkOrphanUpdatesToTasks(tasks, updates, seed);

  const spawnedUpdateIds = new Set(
    tasks
      .map((t) => t.sourceUpdateId?.trim())
      .filter((id): id is string => Boolean(id))
  );
  for (const update of updates) {
    if (spawnedUpdateIds.has(update.id)) {
      update.status = "CreatedNewTask";
      update.linkedTaskId = "";
      continue;
    }
    if (update.status === "CreatedNewTask") {
      update.status = "Processed";
    }
    if (update.linkedTaskId?.trim()) {
      // Task mutations on existing tasks are supervisor actions in demo flows.
      update.recordedBy = supervisorId;
    }
  }

  const escalationsToday = updates.filter(
    (row) => row.status === "Escalated" && row.updatedAt.slice(0, 10) === anchorYmd
  );
  if (escalationsToday.length < 2) {
    const todayCandidates = updates
      .filter(
        (row) =>
          row.updatedAt.slice(0, 10) === anchorYmd &&
          row.status !== "Escalated" &&
          row.status !== "CreatedNewTask" &&
          Boolean(row.linkedTaskId?.trim())
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const row of todayCandidates.slice(0, Math.max(0, 2 - escalationsToday.length))) {
      row.status = "Escalated";
    }
  }

  // Keep escalated share above validation floor while preserving linked-share tolerance.
  const escalatedMinCount = Math.ceil(updates.length * 0.07); // target 10% ± 3%
  let escalatedCount = updates.filter((row) => row.status === "Escalated").length;
  if (escalatedCount < escalatedMinCount) {
    const fillCandidates = updates
      .filter(
        (row) =>
          row.status !== "Escalated" &&
          row.status !== "CreatedNewTask" &&
          Boolean(row.linkedTaskId?.trim())
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const row of fillCandidates) {
      if (escalatedCount >= escalatedMinCount) break;
      row.status = "Escalated";
      escalatedCount += 1;
    }
  }
}

function ensureEscalationsToday(updates: CsvRow[], anchor: Date, seed: string) {
  const anchorYmd = anchor.toISOString().slice(0, 10);
  const escalationsToday = updates.filter(
    (row) => row.status === "Escalated" && row.updatedAt.slice(0, 10) === anchorYmd
  );
  if (escalationsToday.length >= 2) return;

  const needed = 2 - escalationsToday.length;
  const chosen = new Set(escalationsToday.map((row) => row.id));
  const fallback = updates
    .filter(
      (row) =>
        !chosen.has(row.id) &&
        row.status !== "CreatedNewTask" &&
        Boolean(row.linkedTaskId?.trim())
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, needed);

  fallback.forEach((row, index) => {
    const updatedAt = withUtcTime(
      anchor,
      11 + index,
      offsetFromHash(seed, `${row.id}:forced-escalation`, 0, 45)
    );
    row.status = "Escalated";
    row.updatedAt = toIso(updatedAt);
    if (new Date(row.createdAt).getTime() >= updatedAt.getTime()) {
      row.createdAt = toIso(addUtcHours(updatedAt, -2));
    }
  });
}

function applyFuturePlanningBuckets(
  tasks: CsvRow[],
  updates: CsvRow[],
  updateAi: CsvRow[],
  anchor: Date,
  seed: string
) {
  const datasetKey = seed.split(":")[0] ?? "";
  const supervisorId = getDemoLeadIdentity(datasetKey).userId;
  const currentWeekStart = startOfWeekUtc(anchor);
  const nextWeekStart = addUtcDays(currentWeekStart, 7);
  const updateById = new Map(updates.map((update) => [update.id, update]));
  const aiByUpdateId = new Map(updateAi.map((ai) => [ai.updateId, ai]));
  const candidates = sortBySeed(
    tasks.filter((task) => {
      const dueAt = new Date(task.dueDate);
      if (Number.isNaN(dueAt.getTime())) return false;
      if (dueAt < nextWeekStart) return false;
      return (
        task.status !== "Done" &&
        task.status !== "Blocked"
      );
    }),
    `${seed}:next-week-planning`,
    (task) => task.id
  );
  if (candidates.length === 0) return;

  const plannedTarget = Math.ceil(candidates.length * 0.96);

  for (let index = 0; index < candidates.length; index += 1) {
    const task = candidates[index];
    const nextStatus: CsvRow["status"] = index < plannedTarget ? "Planned" : "New";
    task.status = nextStatus;

    const sourceUpdateId = task.sourceUpdateId?.trim();
    if (!sourceUpdateId) continue;

    const sourceUpdate = updateById.get(sourceUpdateId);
    if (sourceUpdate) {
      sourceUpdate.status = "CreatedNewTask";
      sourceUpdate.linkedTaskId = "";
    }
    const ai = aiByUpdateId.get(sourceUpdateId);
    if (ai) {
      ai.reviewedAt = ai.reviewedAt || task.updatedAt || task.createdAt;
      ai.reviewedBy = ai.reviewedBy || supervisorId;
    }
  }
}

/**
 * After task/update linkage, align each update's `locationId` with its paired task
 * (spawned task, linked task, or same-index fallback — same resolution as refresh script).
 */
function syncUpdateLocationIdsFromTasks(updates: CsvRow[], tasks: CsvRow[]) {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const taskBySourceUpdate = new Map<string, CsvRow>();
  for (const t of tasks) {
    const sid = t.sourceUpdateId?.trim();
    if (sid) taskBySourceUpdate.set(sid, t);
  }
  for (let i = 0; i < updates.length; i += 1) {
    const u = updates[i];
    if (!u) continue;
    const fromSpawn = taskBySourceUpdate.get(u.id);
    const fromLinked =
      u.linkedTaskId && taskById.has(u.linkedTaskId)
        ? taskById.get(u.linkedTaskId)
        : undefined;
    const fromIndex = tasks[i];
    const task = fromSpawn ?? fromLinked ?? fromIndex;
    const lid = task?.locationId?.trim();
    if (lid) {
      u.locationId = lid;
    }
  }
}

function linkOrphanUpdatesToTasks(tasks: CsvRow[], updates: CsvRow[], seed: string) {
  const hasSpawn = (updateId: string) =>
    tasks.some((t) => t.sourceUpdateId === updateId);

  for (const u of updates) {
    if (hasSpawn(u.id)) continue;
    if (u.linkedTaskId) continue;
    const pool = tasks
      .filter(
        (t) =>
          t.projectId === u.projectId &&
          new Date(t.createdAt).getTime() < new Date(u.createdAt).getTime()
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    if (pool.length > 0) {
      u.linkedTaskId = pool[
        offsetFromHash(seed, `${u.id}:orphan`, 0, pool.length - 1)
      ].id;
      continue;
    }
    const fallback = tasks
      .filter((t) => t.projectId === u.projectId)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (fallback.length === 0) continue;
    const fallbackTask = fallback[
      offsetFromHash(seed, `${u.id}:orphan-fb`, 0, fallback.length - 1)
    ];
    if (fallbackTask) {
      u.linkedTaskId = fallbackTask.id;
      if (new Date(u.createdAt).getTime() <= new Date(fallbackTask.createdAt).getTime()) {
        const base = new Date(fallbackTask.createdAt);
        const bumped = addUtcHours(
          base,
          2 + offsetFromHash(seed, `${u.id}:orphan-after-task`, 0, 8)
        );
        u.createdAt = toIso(bumped);
        u.updatedAt = toIso(
          addUtcMinutes(
            bumped,
            offsetFromHash(seed, `${u.id}:orphan-upd`, 30, 120)
          )
        );
      }
    }
  }
}

function materializeAiRows(
  rows: CsvRow[],
  updates: CsvRow[],
  tasks: CsvRow[],
  anchor: Date,
  seed: string
) {
  const updateById = new Map(updates.map((update) => [update.id, update]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskByUpdateId = new Map(
    tasks
      .filter((task) => task.sourceUpdateId)
      .map((task) => [task.sourceUpdateId, task] as const)
  );

  return rows.map((row) => {
    const update = updateById.get(row.updateId);
    const linkedTask = taskByUpdateId.get(row.updateId);
    const humanLinkedTask =
      update?.linkedTaskId && taskById.has(update.linkedTaskId)
        ? taskById.get(update.linkedTaskId)
        : undefined;
    const categoryForOutput =
      row.category === "Blocker" && !humanLinkedTask ? "GeneralUpdate" : row.category;
    const blockerSubtypeForOutput =
      categoryForOutput === "Blocker" ? row.blockerSubtype || "" : "";
    const fallbackDueDate = update
      ? withUtcTime(
          addBusinessDays(new Date(update.createdAt), 2),
          16,
          offsetFromHash(seed, `${row.updateId}:ai-due`, 0, 50)
        )
      : withUtcTime(addBusinessDays(anchor, 2), 16, 0);
    const explicitReviewMetadata = hasExplicitReviewMetadata(row);
    const noteState = update
      ? deriveNoteState(
          update.status,
          update.createdAt,
          humanLinkedTask ? { createdAt: humanLinkedTask.createdAt } : undefined
        )
      : "Review";
    const reviewState = normalizeSeedReviewRequirement({
      requirement: {
        required: noteState === "Review",
        reasons: parseJsonArray(row.reviewReasonsJson) as SeedReviewReason[],
        fields: parseJsonArray(row.reviewFieldsJson) as SeedReviewField[],
        prompt: noteState === "Review" ? row.reviewPrompt || undefined : undefined,
      },
      confidence:
        explicitReviewMetadata && noteState === "Review" ? 1 : Number(row.confidence),
      taskProposalSuggested:
        explicitReviewMetadata || noteState !== "Review"
          ? false
          : update !== undefined &&
            ["Pending", "Processed", "Saved", "CreatedNewTask"].includes(update.status) &&
            Boolean((row.generatedTaskDescription || linkedTask?.description || "").trim()),
    });
    const reviewedAt = row.reviewedAt
      ? row.reviewedAt
      : reviewState.required || !update
        ? ""
        : toIso(
            addUtcMinutes(
              new Date(update.updatedAt),
              offsetFromHash(seed, `${row.updateId}:reviewed-at`, 20, 180)
            )
          );
    const reviewedBy =
      row.reviewedBy !== undefined
        ? row.reviewedBy
        : reviewedAt
          ? update?.recordedBy || ""
          : "";

    return {
      ...row,
      category: categoryForOutput,
      blockerSubtype: blockerSubtypeForOutput,
      ownerId: linkedTask?.ownerId ?? row.ownerId,
      ownerRole: linkedTask?.assigneeRole ?? row.ownerRole,
      dueDate: linkedTask?.dueDate ?? toIso(fallbackDueDate),
      location: row.location || linkedTask?.location || "",
      locationId: row.locationId || linkedTask?.locationId || "",
      generatedTaskDescription:
        row.generatedTaskDescription || linkedTask?.description || "Follow up",
      reviewRequired: reviewState.required ? "1" : "0",
      reviewPrompt: reviewState.prompt || "",
      reviewReasonsJson: JSON.stringify(reviewState.reasons),
      reviewFieldsJson: JSON.stringify(reviewState.fields),
      humanReviewRequired: reviewState.required ? "1" : "0",
      reviewedAt,
      reviewedBy,
    };
  });
}

function ensureBlockerToday(updateAi: CsvRow[], updates: CsvRow[], anchor: Date) {
  const anchorYmd = anchor.toISOString().slice(0, 10);
  const updateById = new Map(updates.map((u) => [u.id, u]));
  const blockerToday = updateAi.some((ai) => {
    if (ai.category !== "Blocker") return false;
    const update = updateById.get(ai.updateId);
    return Boolean(update && update.updatedAt.slice(0, 10) === anchorYmd);
  });
  if (blockerToday) return;

  const candidate = updateAi.find((ai) => {
    const update = updateById.get(ai.updateId);
    return Boolean(
      update &&
        update.updatedAt.slice(0, 10) === anchorYmd &&
        update.linkedTaskId &&
        update.linkedTaskId.trim().length > 0
    );
  });
  if (!candidate) return;

  candidate.category = "Blocker";
  candidate.blockerSubtype = candidate.blockerSubtype || "Material delay";
}

function normalizeTaskSourceByOrigin(tasks: CsvRow[]) {
  for (const task of tasks) {
    if (task.sourceUpdateId?.trim()) {
      if (task.source === "Manual") {
        task.source = "AIGenerated";
      }
      continue;
    }
    task.source = "Manual";
  }
}

function materializeAttachmentRows(
  rows: CsvRow[],
  parentMap: Map<string, CsvRow>,
  parentKey: "updateId" | "taskId",
  seed: string
) {
  const ordinalByParent = new Map<string, number>();
  return rows.map((row) => {
    const parentId = row[parentKey];
    const parent = parentMap.get(parentId);
    const ordinal = ordinalByParent.get(parentId) ?? 0;
    ordinalByParent.set(parentId, ordinal + 1);

    if (!parent) {
      return row;
    }

    const uploadedAt = addUtcMinutes(
      new Date(parent.createdAt ?? parent.updatedAt),
      offsetFromHash(seed, `${row.id}:attachment`, 2 + ordinal * 3, 18 + ordinal * 4)
    );

    return {
      ...row,
      uploadedAt: toIso(uploadedAt),
    };
  });
}

function utcYmdFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Roll-call sessions (standup as a calendar point) + rows; dates rematerialized vs seed anchor.
 */
function materializeAttendance(
  rows: DemoBundleRows,
  anchor: Date,
  seed: string
) {
  const sessionRows = sortBySeed(
    cloneRows(rows.attendanceSessions),
    `${seed}:attendance-sessions`,
    (r) => r.id
  );
  const latestAnchor = isBusinessDay(anchor) ? anchor : addBusinessDays(anchor, -1);
  const slots: Array<[number, number]> = [
    [7, 15],
    [9, 45],
    [14, 30],
  ];

  const attendanceSessions: CsvRow[] = sessionRows.map((row, index) => {
    const [hour, minute] = slots[index % slots.length];
    const day = addBusinessDays(latestAnchor, -Math.floor(index / slots.length));
    const date = withUtcTime(day, hour, minute);
    const sessionDateYmd = utcYmdFromIso(toIso(date));
    return {
      ...row,
      sessionDate: sessionDateYmd,
      createdAt: toIso(addUtcMinutes(date, 8)),
      updatedAt: toIso(addUtcMinutes(date, 16)),
    };
  });

  const sessionDateById = new Map(
    attendanceSessions.map((r) => [r.id, r.sessionDate])
  );
  const attendances = cloneRows(rows.attendances).map((row) => {
    const ymd = sessionDateById.get(row.sessionId);
    if (!ymd) {
      return row;
    }
    const base = new Date(`${ymd}T12:00:00.000Z`);
    return {
      ...row,
      recordedAt: toIso(
        addUtcMinutes(
          base,
          offsetFromHash(seed, `${row.id}:attendance`, 4, 18)
        )
      ),
    };
  });

  return {
    attendanceSessions,
    attendances,
  };
}

function applyTaskIdsToUpdateAttachments(
  attachments: CsvRow[],
  updates: CsvRow[],
  tasks: CsvRow[]
) {
  const updateById = new Map(updates.map((u) => [u.id, u]));
  const sourceTaskIdByUpdateId = new Map(
    tasks
      .filter((t): t is CsvRow & { sourceUpdateId: string } => Boolean(t.sourceUpdateId))
      .map((t) => [t.sourceUpdateId, t.id] as const)
  );
  for (const row of attachments) {
    const u = updateById.get(row.updateId);
    let tid = "";
    if (u) {
      if (u.linkedTaskId) {
        tid = u.linkedTaskId;
      } else {
        const spawned = sourceTaskIdByUpdateId.get(u.id);
        if (spawned) {
          tid = spawned;
        }
      }
    }
    row.taskId = tid;
  }
}

/** Task used only for “Linked” note state: human follow-up on an existing task (`linkedTaskId`). */
function resolveHumanLinkedTask(update: CsvRow, taskById: Map<string, CsvRow>) {
  if (!update.linkedTaskId) return undefined;
  return taskById.get(update.linkedTaskId);
}

function setReadState(
  updates: CsvRow[],
  tasks: CsvRow[],
  seed: string
) {
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const reviewUpdates = updates
    .filter((update) => {
      const humanLinked = resolveHumanLinkedTask(update, taskById);
      const noteState = deriveNoteState(
        update.status,
        update.createdAt,
        humanLinked ? { createdAt: humanLinked.createdAt } : undefined
      );
      return noteState === "Review";
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const unreadCount = Math.min(
    reviewUpdates.length,
    Math.round(reviewUpdates.length * SEED_TARGETS.unreadReviewPct)
  );
  const unreadIds = new Set(reviewUpdates.slice(0, unreadCount).map((update) => update.id));

  updates.forEach((update) => {
    const humanLinked = resolveHumanLinkedTask(update, taskById);
    const noteState = deriveNoteState(
      update.status,
      update.createdAt,
      humanLinked ? { createdAt: humanLinked.createdAt } : undefined
    );

    if (noteState !== "Review" || !unreadIds.has(update.id)) {
      update.isRead = "1";
      update.readAt = toIso(
        addUtcMinutes(
          new Date(update.createdAt),
          offsetFromHash(seed, `${update.id}:read-at`, 30, 360)
        )
      );
      return;
    }

    update.isRead = "0";
    update.readAt = "";
  });
}

function applyDefaultColumns(updates: CsvRow[]) {
  return updates.map((row) => ({
    ...row,
    linkedTaskId: row.linkedTaskId || "",
    locationId: row.locationId || "",
    isRead: row.isRead || "0",
    readAt: row.readAt || "",
  }));
}

export function materializeDemoBundle(
  bundle: LoadedDemoBundle,
  anchorDate: Date
): MaterializedDemoBundle {
  const anchor = startOfUtcDay(anchorDate);
  const seed = `${bundle.datasetKey}:${anchor.toISOString().slice(0, 10)}`;

  const users = materializeUsers(cloneRows(bundle.rows.users), anchor, seed);
  const sites = materializeSites(cloneRows(bundle.rows.sites), anchor);
  const projects = materializeProjects(cloneRows(bundle.rows.projects), anchor);
  const teamMembers = materializeTeamMembers(
    cloneRows(bundle.rows.teamMembers),
    anchor,
    seed
  );

  const { tasks } = materializeTasks(
    cloneRows(bundle.rows.tasks),
    anchor,
    seed
  );
  const updates = materializeUpdates(cloneRows(bundle.rows.updates), anchor, seed);
  applyUpdateTaskLinkage(tasks, updates, anchor, seed);
  ensureEscalationsToday(updates, anchor, seed);
  syncUpdateLocationIdsFromTasks(updates, tasks);
  setReadState(updates, tasks, seed);

  const updateAi = materializeAiRows(
    cloneRows(bundle.rows.updateAi),
    updates,
    tasks,
    anchor,
    seed
  );
  applyFuturePlanningBuckets(tasks, updates, updateAi, anchor, seed);
  ensureBlockerToday(updateAi, updates, anchor);
  normalizeTaskSourceByOrigin(tasks);
  applyOrgDepartmentFields(bundle.datasetKey, users, teamMembers, tasks, updateAi);

  const updateById = new Map(updates.map((row) => [row.id, row]));
  const taskById = new Map(tasks.map((row) => [row.id, row]));

  const updateAttachments = materializeAttachmentRows(
    cloneRows(bundle.rows.updateAttachments),
    updateById,
    "updateId",
    seed
  );
  const taskAttachments = materializeAttachmentRows(
    cloneRows(bundle.rows.taskAttachments),
    taskById,
    "taskId",
    seed
  );
  const updatesForRows = applyDefaultColumns(updates);
  applyTaskIdsToUpdateAttachments(updateAttachments, updatesForRows, tasks);

  const attendance = materializeAttendance(bundle.rows, anchor, seed);

  const rows: DemoBundleRows = {
    departments: cloneRows(bundle.rows.departments),
    roleTypes: cloneRows(bundle.rows.roleTypes),
    users,
    sites,
    projects,
    locations: cloneRows(bundle.rows.locations),
    teamMembers,
    updates: updatesForRows,
    updateAi,
    updateAttachments,
    riskEffects: cloneRows(bundle.rows.riskEffects),
    riskActions: cloneRows(bundle.rows.riskActions),
    tasks,
    taskAttachments,
    attendanceSessions: attendance.attendanceSessions,
    attendances: attendance.attendances,
  };

  const materialized = {
    ...bundle,
    rows,
  };

  return {
    ...materialized,
    metrics: collectSeedMetrics(materialized, anchor),
  };
}

// ============================================================================
// Phase B Entity Materialization
// ============================================================================

export interface MaterializedPhaseBEntities {
  workCycles: WorkCycleRow[];
  commitments: CommitmentRow[];
  taskDependencies: TaskDependencyRow[];
}

/**
 * Materializes Phase B entities (work cycles, commitments, task dependencies)
 * from the core demo bundle data.
 */
export function materializePhaseBEntities(
  bundle: MaterializedDemoBundle,
  anchorDate: Date
): MaterializedPhaseBEntities {
  const anchor = startOfUtcDay(anchorDate);
  const seed = `${bundle.datasetKey}:${anchor.toISOString().slice(0, 10)}`;

  // Use a default tenant ID for demo data
  const tenantId = "demo-tenant";

  // Collect all work cycles, commitments, and dependencies across projects
  const allWorkCycles: WorkCycleRow[] = [];
  const allCommitments: CommitmentRow[] = [];
  const allDependencies: TaskDependencyRow[] = [];

  // Group tasks by project
  const tasksByProject = new Map<string, CsvRow[]>();
  for (const task of bundle.rows.tasks) {
    const existing = tasksByProject.get(task.projectId) || [];
    existing.push(task);
    tasksByProject.set(task.projectId, existing);
  }

  // Get site for each project
  const projectToSite = new Map<string, string>();
  for (const project of bundle.rows.projects) {
    projectToSite.set(project.id, project.siteId);
  }

  // Generate Phase B entities for each project
  for (const project of bundle.rows.projects) {
    const projectTasks = tasksByProject.get(project.id) || [];
    const siteId = project.siteId;

    if (projectTasks.length < 4) {
      // Skip projects with too few tasks
      continue;
    }

    // Generate work cycles for this project
    const workCycles = generateWorkCycles(
      project.id,
      siteId,
      tenantId,
      anchor,
      seed
    );
    allWorkCycles.push(...workCycles);

    // Generate commitments derived from tasks
    const commitments = generateCommitments(
      projectTasks,
      workCycles,
      bundle.rows.teamMembers,
      project.id,
      siteId,
      tenantId,
      anchor,
      seed
    );
    allCommitments.push(...commitments);

    // Generate task dependencies
    const dependencies = generateTaskDependencies(
      projectTasks,
      bundle.rows.teamMembers,
      project.id,
      tenantId,
      anchor,
      seed
    );
    allDependencies.push(...dependencies);
  }

  return {
    workCycles: allWorkCycles,
    commitments: allCommitments,
    taskDependencies: allDependencies,
  };
}
