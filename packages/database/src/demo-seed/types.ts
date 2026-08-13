export type CsvRow = Record<string, string>;

export const BUNDLE_FILE_NAMES = {
  users: "users.csv",
  sites: "sites.csv",
  projects: "projects.csv",
  locations: "locations.csv",
  teamMembers: "team_members.csv",
  updates: "updates.csv",
  updateAi: "update_ai_outputs.csv",
  updateAttachments: "update_attachments.csv",
  riskEffects: "update_risk_downstream_effects.csv",
  riskActions: "update_risk_recommended_actions.csv",
  tasks: "tasks.csv",
  taskAttachments: "task_attachments.csv",
  attendanceSessions: "attendance_sessions.csv",
  attendances: "attendances.csv",
} as const;

export type BundleFileKey = keyof typeof BUNDLE_FILE_NAMES;

export interface DemoBundleRows {
  /** Shared master (`docs/demo/datasets/shared/departments.csv`). */
  departments: CsvRow[];
  /** Shared master (`docs/demo/datasets/shared/role_types.csv`). */
  roleTypes: CsvRow[];
  users: CsvRow[];
  sites: CsvRow[];
  projects: CsvRow[];
  locations: CsvRow[];
  teamMembers: CsvRow[];
  updates: CsvRow[];
  updateAi: CsvRow[];
  updateAttachments: CsvRow[];
  riskEffects: CsvRow[];
  riskActions: CsvRow[];
  tasks: CsvRow[];
  taskAttachments: CsvRow[];
  attendanceSessions: CsvRow[];
  attendances: CsvRow[];
}

export interface LoadedDemoBundle {
  contractId: string;
  datasetKey: string;
  dir: string;
  rows: DemoBundleRows;
}

export type TaskStatusKey =
  | "New"
  | "Planned"
  | "Review"
  | "In-progress"
  | "Blocked"
  | "Done";
export type UpdateStatusKey =
  | "Pending"
  | "Processed"
  | "CreatedNewTask"
  | "Escalated"
  | "Saved";
export type NoteState = "Review" | "Linked" | "Escalated";

export type CommitmentHorizonKey = "today" | "this_week" | "look_ahead" | "past";

export interface DemoSeedMetrics {
  taskStatusCounts: Record<TaskStatusKey, number>;
  updateStatusCounts: Record<UpdateStatusKey, number>;
  noteStateCounts: Record<NoteState, number>;
  overdueTasks: number;
  activeDueToday: number;
  blockedDueToday: number;
  todayEscalations: number;
  recentEscalations: number;
  maxTaskCreatedAgeDays: number;
  maxUpdateAgeDays: number;
  // Phase A read-model metrics
  /** Task counts by commitment horizon (for read-model derivation). */
  horizonCounts?: Record<CommitmentHorizonKey, number>;
  /** Count of tasks eligible for technical review queue. */
  technicalReviewQueueCount?: number;
  /** Count of high-severity blocked tasks. */
  highSeverityBlockedCount?: number;
  /** Count of critical tasks. */
  criticalTaskCount?: number;
}

export interface MaterializedDemoBundle extends LoadedDemoBundle {
  metrics: DemoSeedMetrics;
}

// ============================================================================
// Phase B Types
// ============================================================================

export type CommitmentStatusKey =
  | "planned"
  | "in_progress"
  | "completed"
  | "at_risk"
  | "missed"
  | "carried_over";

export type DependencyTypeKey =
  | "finish_to_start"
  | "blocks"
  | "start_to_start"
  | "finish_to_finish";

export type WorkCycleStatusKey = "planned" | "active" | "closed";

export interface PhaseBMetrics {
  workCycleCount: number;
  commitmentCount: number;
  commitmentStatusCounts: Record<CommitmentStatusKey, number>;
  dependencyCount: number;
  serialChainCount: number;
  parallelDependencyCount: number;
  carriedOverCount: number;
}

// ============================================================================
// Phase C Types
// ============================================================================

export type ImprovementActionCategoryKey =
  | "quality"
  | "schedule"
  | "safety"
  | "maintenance"
  | "other";

export type ImprovementActionStatusKey =
  | "open"
  | "in_progress"
  | "validated"
  | "closed";

export interface PhaseCMetrics {
  improvementActionCount: number;
  categoryDistribution: Record<ImprovementActionCategoryKey, number>;
  statusDistribution: Record<ImprovementActionStatusKey, number>;
  overdueCount: number;
  linkedTaskCount: number;
  linkedCommitmentCount: number;
}

// ============================================================================
// Phase D Types
// ============================================================================

export type StandupSessionStatusKey = "draft" | "active" | "closed";

export type NotificationStatusKey = "unread" | "read";

export type NotificationTypeKey =
  | "task_assigned"
  | "blocker_escalated"
  | "commitment_at_risk"
  | "standup_reminder"
  | "improvement_action"
  | "task_overdue";

export interface PhaseDMetrics {
  standupSessionCount: number;
  sessionStatusDistribution: Record<StandupSessionStatusKey, number>;
  notificationCount: number;
  notificationStatusDistribution: Record<NotificationStatusKey, number>;
  notificationTypeDistribution: Record<NotificationTypeKey, number>;
  unreadCount: number;
}
