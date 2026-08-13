import { z } from "zod";
import {
  TaskStatusEnum,
  SeverityEnum,
  UpdateCategoryEnum,
  DepartmentEnum,
  RoleTypeCodeSchema,
} from "./enums.js";
import { TaskCardSchema } from "./task.js";
import {
  AIProcessedOutputSchema,
  ReviewReasonEnum,
} from "./update.js";
import {
  PlannedItemSchema,
  CompletedItemSchema,
} from "./standup.js";

/**
 * Carry-forward: task **Active** (`TaskStatus`), **due yesterday** (UTC), still incomplete.
 * Not blockers — those appear under `activeBlockers`. Replaces legacy CSV/API “yesterday blocked” naming.
 */
export const StandupPrepCarryForwardItemSchema = z.object({
  id: z.string().uuid(),
  taskTitle: z.string(),
  description: z.string(),
  severity: SeverityEnum,
  location: z.string().nullable().optional(),
  ownerName: z.string(),
});

/** Standup prep list rows: optional link to a project task for owner + navigation */
export const StandupPrepPlannedItemSchema = PlannedItemSchema.extend({
  linkedTaskId: z.string().uuid().nullable().optional(),
  ownerName: z.string(),
});

export const StandupPrepCompletedItemSchema = CompletedItemSchema.extend({
  linkedTaskId: z.string().uuid().nullable().optional(),
  ownerName: z.string(),
});

// ============================================================================
// Pagination
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// ============================================================================
// Dashboard Metrics
// ============================================================================

export const TaskCountsByStatusSchema = z.object({
  active: z.number().int().min(0),
  blocked: z.number().int().min(0),
  done: z.number().int().min(0),
});

export type TaskCountsByStatus = z.infer<typeof TaskCountsByStatusSchema>;

export const TaskCountsBySeveritySchema = z.object({
  critical: z.number().int().min(0),
  high: z.number().int().min(0),
  medium: z.number().int().min(0),
  low: z.number().int().min(0),
});

export type TaskCountsBySeverity = z.infer<typeof TaskCountsBySeveritySchema>;

export const DashboardMetricsSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  tasksByStatus: TaskCountsByStatusSchema,
  tasksBlockedToday: z.number().int().min(0).optional(),
  tasksBySeverity: TaskCountsBySeveritySchema,
  overdueCount: z.number().int().min(0),
  recentUpdatesCount: z.number().int().min(0),
  upcomingStandupDate: z.date().optional(),
  lastUpdatedAt: z.date(),
});

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

// ============================================================================
// Update List Response
// ============================================================================

export const NoteStateEnum = z.enum(["Review", "Linked", "Escalated"]);
export type NoteState = z.infer<typeof NoteStateEnum>;

export const UpdateListItemSchema = z.object({
  id: z.string().uuid(),
  transcript: z.string(),
  category: UpdateCategoryEnum.optional(),
  location: z.string().optional(),
  severity: SeverityEnum.optional(),
  status: z.enum(["Pending", "Processed", "CreatedNewTask", "Escalated", "Saved"]),
  /** Product-facing queue for supervisor lists */
  noteState: NoteStateEnum,
  recordedByName: z.string(),
  recordedByRole: z.string(),
  hasAudio: z.boolean(),
  hasAttachments: z.boolean(),
  attachmentCount: z.number().int().min(0),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
  /** false once supervisor has opened the update detail/review */
  isUnread: z.boolean(),
  blockerSubtype: z.string().nullable().optional(),
  /** Compact “Block · Zone · Level · Area” when parts exist */
  locationHierarchy: z.string().optional(),
  /** One-line compact label from `locations.listLabel` for list cards */
  locationList: z.string().min(1),
  linkedTaskId: z.string().uuid().nullable().optional(),
  linkedTaskTitle: z.string().nullable().optional(),
  linkedTaskStatus: z.string().nullable().optional(),
  reviewPrompt: z.string().nullable().optional(),
  reviewReasons: z.array(ReviewReasonEnum).optional(),
  nextActionHint: z.string(),
});

export type UpdateListItem = z.infer<typeof UpdateListItemSchema>;

export const UpdateListResponseSchema = z.object({
  items: z.array(UpdateListItemSchema),
  pagination: PaginationSchema,
});

export type UpdateListResponse = z.infer<typeof UpdateListResponseSchema>;

// ============================================================================
// Task List Response
// ============================================================================

export const TaskListFiltersSchema = z.object({
  status: TaskStatusEnum.optional(),
  severity: SeverityEnum.optional(),
  department: DepartmentEnum.optional(),
  ownerId: z.string().uuid().optional(),
  overdueOnly: z.coerce.boolean().default(false),
});

export type TaskListFilters = z.infer<typeof TaskListFiltersSchema>;

export const TaskListResponseSchema = z.object({
  items: z.array(TaskCardSchema),
  pagination: PaginationSchema,
  filters: TaskListFiltersSchema,
});

export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;

// ============================================================================
// Standup Prep Response
// ============================================================================

/** Snapshot of the last persisted AI standup summary for this project/day (from SQLite). */
export const LastStandupSnapshotSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  summaryText: z.string().nullable(),
  modelUsed: z.string().optional(),
});

export type LastStandupSnapshot = z.infer<typeof LastStandupSnapshotSchema>;

/** `carryForwardDueYesterday` = Active tasks due yesterday (slipped work); `activeBlockers` = blocked tasks — see docs/field-app/standup-prep-from-tasks.md */
export const StandupPrepResponseSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  date: z.date(),

  // Yesterday's work
  yesterdayCompleted: z.array(StandupPrepCompletedItemSchema),
  carryForwardDueYesterday: z.array(StandupPrepCarryForwardItemSchema),

  // Today's plan
  plannedItems: z.array(StandupPrepPlannedItemSchema),

  /** Persisted AI summary for today (if generated); `null` if none for this UTC calendar day. */
  lastStandup: LastStandupSnapshotSchema.nullable(),

  // Current blockers from tasks
  activeBlockers: z.array(z.object({
    taskId: z.string().uuid(),
    taskTitle: z.string(),
    severity: SeverityEnum,
    location: z.string().optional().nullable(),
    /** Task description — stand-in for “why” until a dedicated blocker reason exists */
    reason: z.string(),
    /** Resolved from tasks.ownerId → team member name */
    ownerName: z.string(),
  })),

  // Attendance prep
  expectedAttendees: z.array(z.object({
    teamMemberId: z.string().uuid(),
    name: z.string(),
    orgRoleCode: RoleTypeCodeSchema,
    roleTypeName: z.string().min(1),
  })),

  // Summary stats
  stats: z.object({
    tasksActive: z.number().int().min(0),
    tasksBlocked: z.number().int().min(0),
    tasksCompleted: z.number().int().min(0),
    overdueCount: z.number().int().min(0),
  }),
});

export type StandupPrepResponse = z.infer<typeof StandupPrepResponseSchema>;

// ============================================================================
// Project List Response
// ============================================================================

export const ProjectListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  siteName: z.string(),
  siteSupervisorId: z.string().uuid().nullable().optional(),
  siteSupervisorName: z.string().nullable().optional(),
  siteSupervisorEmail: z.string().nullable().optional(),
  siteSupervisorRole: z.string().nullable().optional(),
  siteManagerId: z.string().uuid().nullable().optional(),
  siteManagerName: z.string().nullable().optional(),
  siteManagerEmail: z.string().nullable().optional(),
  siteManagerRole: z.string().nullable().optional(),
  isActive: z.boolean(),
  taskCount: z.number().int().min(0),
  openTaskCount: z.number().int().min(0),
});

export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;

export const ProjectListResponseSchema = z.object({
  items: z.array(ProjectListItemSchema),
});

export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

// ============================================================================
// AI/Transcription Contracts
// ============================================================================

export const TranscriptionRequestSchema = z.object({
  audioUrl: z.string().url().optional(),
  audioBase64: z.string().optional(),
  mimeType: z.string().default("audio/webm"),
  language: z.string().default("en"),
  model: z.string().default("whisper"),
}).refine(
  (data) => data.audioUrl || data.audioBase64,
  { message: "Either audioUrl or audioBase64 must be provided" }
);

export type TranscriptionRequest = z.infer<typeof TranscriptionRequestSchema>;

export const TranscriptionResponseSchema = z.object({
  text: z.string(),
  language: z.string(),
  duration: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  modelUsed: z.string(),
  processingTimeMs: z.number(),
});

export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

export const ExtractionRequestSchema = z.object({
  updateId: z.string().uuid(),
  transcript: z.string().min(1),
  projectContext: z.object({
    projectId: z.string().uuid(),
    projectName: z.string(),
    departments: z.array(DepartmentEnum),
    locations: z.array(z.string()),
  }).optional(),
  model: z.string().default("gpt-4-1-mini"),
});

export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;

export const ExtractionResponseSchema = z.object({
  updateId: z.string().uuid(),
  aiOutput: AIProcessedOutputSchema,
  modelUsed: z.string(),
  processingTimeMs: z.number(),
  version: z.number().int().min(1),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

// ============================================================================
// Error Response
// ============================================================================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// Phase A Read Model Response Schemas
// ============================================================================

import {
  CommitmentCardSchema,
  CommitmentHorizonEnum,
  CommitmentStatusEnum,
} from "./commitment.js";
import {
  DependencyCardSchema,
  DependencySummarySchema,
} from "./dependency.js";

// ----------------------------------------------------------------------------
// Commitment List Response (grouped by horizon)
// ----------------------------------------------------------------------------

export const CommitmentGroupSchema = z.object({
  horizon: CommitmentHorizonEnum,
  label: z.string(),
  items: z.array(CommitmentCardSchema),
  count: z.number().int().min(0),
});

export type CommitmentGroup = z.infer<typeof CommitmentGroupSchema>;

export const CommitmentListResponseSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  /** Commitments grouped by horizon: today, this_week, look_ahead, past */
  groups: z.array(CommitmentGroupSchema),
  /** Total commitment count across all groups. */
  totalCount: z.number().int().min(0),
  /** Summary stats for the project. */
  stats: z.object({
    planned: z.number().int().min(0),
    inProgress: z.number().int().min(0),
    completed: z.number().int().min(0),
    atRisk: z.number().int().min(0),
    missed: z.number().int().min(0),
    carriedOver: z.number().int().min(0),
  }),
  /** Filter parameters applied. */
  filters: z.object({
    status: CommitmentStatusEnum.optional(),
    ownerId: z.string().uuid().optional(),
    horizon: CommitmentHorizonEnum.optional(),
  }).optional(),
});

export type CommitmentListResponse = z.infer<typeof CommitmentListResponseSchema>;

// ----------------------------------------------------------------------------
// Dependency list response (task-centric view)
// ----------------------------------------------------------------------------

export const DependencyListResponseSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  projectId: z.string().uuid(),
  /** Dependencies where this task is the successor (tasks blocking this one). */
  predecessors: z.array(DependencyCardSchema),
  /** Dependencies where this task is the predecessor (tasks this one blocks). */
  successors: z.array(DependencyCardSchema),
  /** Summary counts. */
  summary: DependencySummarySchema,
});

export type DependencyListResponse = z.infer<typeof DependencyListResponseSchema>;

// ----------------------------------------------------------------------------
// Technical Review Queue Response
// ----------------------------------------------------------------------------

export const TechnicalReviewQueueItemSchema = z.object({
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  taskStatus: TaskStatusEnum,
  taskSeverity: SeverityEnum,
  /** Location display string. */
  location: z.string(),
  /** Owner name. */
  ownerName: z.string(),
  ownerId: z.string().uuid(),
  /** Assignee role. */
  assigneeRoleCode: RoleTypeCodeSchema,
  assigneeRoleName: z.string(),
  /** Department code if set. */
  departmentCode: DepartmentEnum.nullable().optional(),
  /** Due date. */
  dueDate: z.coerce.date(),
  /** true if overdue. */
  isOverdue: z.boolean(),
  /** Source of the task (VoiceUpdate, AIGenerated, etc). */
  source: z.string().optional(),
  /** Linked update ID if task originated from update. */
  sourceUpdateId: z.string().uuid().nullable().optional(),
  /** Dependency summary for task. */
  dependencySummary: DependencySummarySchema,
  /** When task was last updated. */
  updatedAt: z.coerce.date(),
  /** When task was created. */
  createdAt: z.coerce.date(),
});

export type TechnicalReviewQueueItem = z.infer<typeof TechnicalReviewQueueItemSchema>;

export const TechnicalReviewQueueResponseSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string(),
  /** Items pending technical review (typically blocked or escalated tasks). */
  items: z.array(TechnicalReviewQueueItemSchema),
  /** Total count of items in queue. */
  totalCount: z.number().int().min(0),
  /** Summary stats. */
  stats: z.object({
    blocked: z.number().int().min(0),
    escalated: z.number().int().min(0),
    pendingReview: z.number().int().min(0),
    overdue: z.number().int().min(0),
  }),
  pagination: PaginationSchema,
});
