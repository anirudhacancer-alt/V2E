import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  real,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/** Demo bundle tables — column names align with docs/demo/datasets CSV exports. */

/** Shared master: execution/support departments (work packages / disciplines). */
export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  isSiteFunction: integer("isSiteFunction").notNull().default(sql`0`),
  isExecutionDiscipline: integer("isExecutionDiscipline").notNull().default(sql`0`),
  isActive: integer("isActive").notNull().default(sql`1`),
  sortOrder: integer("sortOrder").notNull(),
});

/** Shared master: org role taxonomy (replaces flat `UserRoleEnum` over time). */
export const roleTypes = sqliteTable("role_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  level: text("level").notNull(),
  isManagerial: integer("isManagerial").notNull().default(sql`0`),
  isFieldBased: integer("isFieldBased").notNull().default(sql`0`),
  isCrewRole: integer("isCrewRole").notNull().default(sql`0`),
  isActive: integer("isActive").notNull().default(sql`1`),
  sortOrder: integer("sortOrder").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  /** FK to `role_types.code` (canonical org role). */
  orgRoleCode: text("orgRoleCode").notNull().references(() => roleTypes.code),
  /** FK to `departments.code` when the person is tied to a discipline; else null. */
  departmentCode: text("departmentCode").references(() => departments.code),
  specialty: text("specialty").notNull().default(""),
  phone: text("phone").notNull(),
  employeeId: text("employeeId").notNull(),
  avatarUrl: text("avatarUrl"),
  preferencesPushNotificationsEnabled: text("preferences_pushNotificationsEnabled").notNull(),
  preferencesDarkModeEnabled: text("preferences_darkModeEnabled").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address").notNull(),
  locationLatitude: text("locationLatitude"),
  locationLongitude: text("locationLongitude"),
  projectManagerId: text("projectManagerId").notNull(),
  isActive: text("isActive").notNull(),
  metadata: text("metadata").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  siteId: text("siteId").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** construction | factory | retail | warehouse | venue | ngo | other */
  type: text("type").notNull().default("other"),
  /** planning | active | on_hold | completed | cancelled */
  status: text("status").notNull().default("active"),
  isActive: text("isActive").notNull(),
  metadata: text("metadata").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

/**
 * Latest generated standup AI summary for a project (keyed by UTC calendar `summaryDate`).
 * One row per project; refreshed when the supervisor generates a new summary for that day.
 */
export const projectStandupAiSummaries = sqliteTable("project_standup_ai_summaries", {
  projectId: text("projectId").primaryKey(),
  id: text("id").notNull(),
  summaryDate: text("summaryDate").notNull(),
  summaryText: text("summaryText").notNull(),
  modelUsed: text("modelUsed").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

/** Demo seed location master rows (from each contract folder `locations.csv`). */
export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  projectId: text("projectId").notNull(),
  siteType: text("siteType").notNull(),
  level1: text("level1").notNull(),
  level2: text("level2"),
  level3: text("level3"),
  level4: text("level4"),
  displayLabel: text("displayLabel").notNull(),
  /** Compact one-line label for supervisor list cards (Twr · L02 · …), derived at seed. */
  listLabel: text("listLabel").notNull(),
  isActive: integer("isActive").notNull().default(sql`1`),
  sortOrder: integer("sortOrder").notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  siteId: text("siteId").notNull(),
  /** Optional FK to `users.id` when this roster row maps to a login identity. */
  userId: text("userId").references(() => users.id),
  name: text("name").notNull(),
  orgRoleCode: text("orgRoleCode").notNull().references(() => roleTypes.code),
  departmentCode: text("departmentCode").references(() => departments.code),
  specialty: text("specialty").notNull().default(""),
  reportsToUserId: text("reportsToUserId"),
  email: text("email"),
  phone: text("phone"),
  isActive: text("isActive").notNull(),
  joinedAt: text("joinedAt").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const updates = sqliteTable("updates", {
  id: text("id").primaryKey(),
  siteId: text("siteId").notNull(),
  projectId: text("projectId").notNull(),
  /** voice | text | photo | checklist | system — canonical capture channel */
  sourceType: text("sourceType").notNull().default("voice"),
  /** 1 = supervisor review / follow-up required before treating as clean */
  needsReview: integer("needsReview").notNull().default(sql`0`),
  recordedBy: text("recordedBy").notNull(),
  transcript: text("transcript").notNull(),
  audioUrl: text("audioUrl"),
  audioDuration: text("audioDuration"),
  status: text("status").notNull(),
  /** 1 = supervisor has opened / acknowledged; 0 = unread in list */
  isRead: integer("isRead").notNull().default(sql`0`),
  readAt: text("readAt"),
  /** Last Idempotency-Key header value that completed a successful transcription */
  transcribeIdempotencyKey: text("transcribeIdempotencyKey"),
  /** Last Idempotency-Key header value that completed a successful extraction */
  extractIdempotencyKey: text("extractIdempotencyKey"),
  /**
   * Human follow-up note on an existing task (task predates the note).
   * Distinct from `tasks.sourceUpdateId`, which links a task spawned from a voice/AI update.
   */
  linkedTaskId: text("linkedTaskId"),
  /** FK to demo `locations` master row (same as tasks / AI output). */
  locationId: text("locationId").notNull().references(() => locations.id),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const updateAiOutputs = sqliteTable("update_ai_outputs", {
  id: text("id").primaryKey(),
  updateId: text("updateId").notNull().unique(),
  category: text("category").notNull(),
  /** FK to `departments.code` when extraction resolved a discipline. */
  departmentCode: text("departmentCode").references(() => departments.code),
  location: text("location"),
  locationId: text("locationId").notNull().references(() => locations.id),
  /** When category is Blocker: material delay, access, drawing approval, QC, dependency, etc. */
  blockerSubtype: text("blockerSubtype"),
  locationBlock: text("locationBlock"),
  locationZone: text("locationZone"),
  locationLevel: text("locationLevel"),
  locationArea: text("locationArea"),
  vendor: text("vendor"),
  severity: text("severity").notNull(),
  ownerRoleCode: text("ownerRoleCode").notNull().references(() => roleTypes.code),
  ownerId: text("ownerId"),
  dueDate: text("dueDate").notNull(),
  generatedTaskDescription: text("generatedTaskDescription").notNull(),
  riskImpact: text("riskImpact").notNull(),
  scheduleRisk: text("scheduleRisk").notNull(),
  confidence: real("confidence").notNull(),
  /** 1 = supervisor must explicitly confirm the AI ask before the review is cleared */
  reviewRequired: integer("reviewRequired").notNull().default(sql`0`),
  /** Explicit supervisor-facing ask, e.g. "Confirm: new task proposal" */
  reviewPrompt: text("reviewPrompt"),
  /** JSON array of ReviewReason enum values */
  reviewReasonsJson: text("reviewReasonsJson").notNull().default(sql`'[]'`),
  /** JSON array of ReviewField enum values */
  reviewFieldsJson: text("reviewFieldsJson").notNull().default(sql`'[]'`),
  /** 1 = supervisor must confirm review before creating a task (low model confidence) */
  humanReviewRequired: integer("humanReviewRequired")
    .notNull()
    .default(sql`0`),
  /** Canonical persisted review lifecycle for the AI output row. */
  reviewStatus: text("reviewStatus").notNull().default("pending"),
  reviewedAt: text("reviewedAt"),
  reviewedBy: text("reviewedBy"),
  /** Optional JSON: snapshot of AI-suggested fields at review time for audit */
  suggestedSnapshotJson: text("suggestedSnapshotJson"),
});

export const updateAttachments = sqliteTable("update_attachments", {
  id: text("id").primaryKey(),
  updateId: text("updateId").notNull(),
  /** Denormalized link for “all media on this task” queries (follow-up + voice-spawn transcripts). */
  taskId: text("taskId"),
  url: text("url").notNull(),
  type: text("type").notNull(),
  uploadedAt: text("uploadedAt").notNull(),
});

/**
 * Standup as a **point in time** (calendar session) — not a full KPI/history row.
 * Attendance is recorded against this session.
 */
export const attendanceSessions = sqliteTable("attendance_sessions", {
  id: text("id").primaryKey(),
  siteId: text("siteId").notNull(),
  projectId: text("projectId").notNull(),
  /** UTC calendar day for the session, `YYYY-MM-DD` */
  sessionDate: text("sessionDate").notNull(),
  conductedBy: text("conductedBy").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const attendances = sqliteTable("attendances", {
  id: text("id").primaryKey(),
  sessionId: text("sessionId").notNull(),
  teamMemberId: text("teamMemberId").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  recordedAt: text("recordedAt").notNull(),
});

export const updateRiskDownstreamEffects = sqliteTable(
  "update_risk_downstream_effects",
  {
    updateId: text("updateId").notNull(),
    order: integer("order").notNull(),
    effect: text("effect").notNull(),
  },
  (t) => [primaryKey({ columns: [t.updateId, t.order] })]
);

export const updateRiskRecommendedActions = sqliteTable(
  "update_risk_recommended_actions",
  {
    updateId: text("updateId").notNull(),
    order: integer("order").notNull(),
    action: text("action").notNull(),
  },
  (t) => [primaryKey({ columns: [t.updateId, t.order] })]
);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  siteId: text("siteId").notNull(),
  projectId: text("projectId").notNull(),
  /** task | blocker | escalation | commitment-linked | improvement-linked */
  kind: text("kind").notNull().default("task"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ownerId: text("ownerId").notNull(),
  /** FK to team_members.id — who reported the work item (nullable in demo). */
  reporterTeamMemberId: text("reporterTeamMemberId"),
  assigneeRoleCode: text("assigneeRoleCode").notNull().references(() => roleTypes.code),
  severity: text("severity").notNull(),
  departmentCode: text("departmentCode").references(() => departments.code),
  /** User id who created the task (supervisor or derived from AI review flow). */
  createdBy: text("createdBy"),
  /** User id who last updated the task in demo. */
  updatedBy: text("updatedBy"),
  location: text("location").notNull(),
  locationId: text("locationId").notNull().references(() => locations.id),
  status: text("status").notNull(),
  source: text("source").notNull(),
  sourceUpdateId: text("sourceUpdateId"),
  startDate: text("startDate").notNull(),
  dueDate: text("dueDate").notNull(),
  completedAt: text("completedAt"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

export const taskAttachments = sqliteTable("task_attachments", {
  id: text("id").primaryKey(),
  taskId: text("taskId").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  uploadedAt: text("uploadedAt").notNull(),
});

/** Pilot audit trail for mutations and workflow events (queryable JSON payload). */
export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  occurredAt: text("occurredAt").notNull(),
  eventType: text("eventType").notNull(),
  projectId: text("projectId"),
  siteId: text("siteId"),
  entityType: text("entityType").notNull(),
  entityId: text("entityId").notNull(),
  actor: text("actor"),
  payload: text("payload").notNull(),
});

// ============================================================================
// Phase B: Agile Execution Layer
// ============================================================================

/**
 * Work cycles - weekly/bi-weekly planning horizons.
 * Commitments are optionally grouped under a work cycle.
 */
export const workCycles = sqliteTable("work_cycles", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  projectId: text("projectId").notNull().references(() => projects.id),
  name: text("name").notNull(),
  startDate: text("startDate").notNull(),
  endDate: text("endDate").notNull(),
  /** planned | active | closed */
  status: text("status").notNull().default("planned"),
  goal: text("goal"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

/**
 * Commitments - what teams commit to deliver in standup/planning cycles.
 * Tracks reliability and carry-over patterns.
 */
export const commitments = sqliteTable("commitments", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  projectId: text("projectId").notNull().references(() => projects.id),
  siteId: text("siteId").notNull().references(() => sites.id),
  /** FK to work_cycles.id - nullable in phase 1. */
  workCycleId: text("workCycleId").references(() => workCycles.id),
  /** FK to standup sessions when persisted. */
  standupSessionId: text("standupSessionId"),
  /** FK to tasks.id - nullable if standalone commitment. */
  sourceTaskId: text("sourceTaskId").references(() => tasks.id),
  title: text("title").notNull(),
  description: text("description"),
  /** FK to team_members.id (owner). */
  ownerId: text("ownerId").notNull().references(() => teamMembers.id),
  /** FK to role_types.code (role responsible). */
  assigneeRoleCode: text("assigneeRoleCode").notNull().references(() => roleTypes.code),
  /** planned | in_progress | completed | at_risk | missed | carried_over */
  status: text("status").notNull().default("planned"),
  /** Date when commitment was made (YYYY-MM-DD). */
  commitDate: text("commitDate").notNull(),
  /** Target delivery date (YYYY-MM-DD). */
  targetDate: text("targetDate").notNull(),
  /** When completed (ISO timestamp). */
  completedAt: text("completedAt"),
  /** FK to commitments.id - for carry-over chain. */
  carriedOverFromCommitmentId: text("carriedOverFromCommitmentId"),
  /** Reason for at_risk or missed status. */
  riskReason: text("riskReason"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

/**
 * Task dependencies - explicit sequencing and constraint management.
 * Enforces project-scope integrity and prevents cycles.
 */
export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  projectId: text("projectId").notNull().references(() => projects.id),
  /** FK to tasks.id - the task that must complete first. */
  predecessorTaskId: text("predecessorTaskId").notNull().references(() => tasks.id),
  /** FK to tasks.id - the task that depends on predecessor. */
  successorTaskId: text("successorTaskId").notNull().references(() => tasks.id),
  /** blocks | finish_to_start | start_to_start | finish_to_finish */
  dependencyType: text("dependencyType").notNull().default("finish_to_start"),
  /** Delay in days after predecessor completes. */
  lagDays: integer("lagDays").notNull().default(0),
  /** If true, successor cannot start unless explicitly overridden. */
  isHardConstraint: integer("isHardConstraint").notNull().default(1),
  /** Explanation for this dependency. */
  reason: text("reason"),
  /** FK to team_members.id (who created). */
  createdBy: text("createdBy").notNull().references(() => teamMembers.id),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// ============================================================================
// Phase C: Improvement Actions
// ============================================================================

/**
 * Improvement actions - structured countermeasures for repeated issues.
 * Closes the DMAIC loop for recurring problems.
 */
export const improvementActions = sqliteTable("improvement_actions", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  projectId: text("projectId").notNull().references(() => projects.id),
  siteId: text("siteId").notNull().references(() => sites.id),
  title: text("title").notNull(),
  problemStatement: text("problemStatement").notNull(),
  /** quality | schedule | safety | maintenance | retail_execution | other */
  category: text("category").notNull().default("other"),
  /** Root cause analysis result. */
  rootCause: text("rootCause"),
  /** FK to team_members.id (owner). */
  ownerId: text("ownerId").notNull().references(() => teamMembers.id),
  /** open | in_progress | validated | closed */
  status: text("status").notNull().default("open"),
  /** Target completion date. */
  targetDate: text("targetDate"),
  /** JSON array of linked task IDs. */
  linkedTaskIdsJson: text("linkedTaskIdsJson").notNull().default("[]"),
  /** JSON array of linked blocker IDs. */
  linkedBlockerIdsJson: text("linkedBlockerIdsJson").notNull().default("[]"),
  /** JSON array of linked commitment IDs. */
  linkedCommitmentIdsJson: text("linkedCommitmentIdsJson").notNull().default("[]"),
  /** Note on effectiveness of the countermeasure. */
  effectivenessNote: text("effectivenessNote"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// ============================================================================
// Phase D: Standup Sessions and Notifications
// ============================================================================

/**
 * Standup sessions - persisted meeting instances.
 * Scoped by project and optional org hierarchy level.
 */
export const standupSessions = sqliteTable("standup_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  projectId: text("projectId").notNull().references(() => projects.id),
  /** team | department | site | plant | region */
  scopeLevel: text("scopeLevel").notNull(),
  /** Reference to the scoped entity (e.g., department code, site ID). */
  scopeRef: text("scopeRef"),
  /** Session date in YYYY-MM-DD format. */
  sessionDate: text("sessionDate").notNull(),
  /** FK to team_members.id (owner/conductor). */
  ownerId: text("ownerId").notNull().references(() => teamMembers.id),
  /** draft | active | closed */
  status: text("status").notNull().default("draft"),
  /** AI-generated or manual summary text. */
  summaryText: text("summaryText"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

/**
 * Notifications - user-facing notification instances.
 * Supports in-app, email, and push delivery channels.
 */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  /** FK to users.id (recipient). */
  userId: text("userId").notNull().references(() => users.id),
  /** Notification type (e.g., task_assigned, blocker_escalated, standup_reminder). */
  type: text("type").notNull(),
  /** Display title. */
  title: text("title").notNull(),
  /** Display body text. */
  body: text("body").notNull(),
  /** Optional entity type for deep linking (e.g., task, commitment). */
  entityType: text("entityType"),
  /** Optional entity ID for deep linking. */
  entityId: text("entityId"),
  /** unread | read | archived */
  status: text("status").notNull().default("unread"),
  createdAt: text("createdAt").notNull(),
  /** When the notification was read by the user. */
  readAt: text("readAt"),
});

/**
 * Notification preferences - per-user settings for notification channels.
 */
export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  /** FK to users.id. */
  userId: text("userId").notNull().references(() => users.id),
  /** in_app | email | push */
  channel: text("channel").notNull(),
  /** Event type this preference applies to. */
  eventType: text("eventType").notNull(),
  /** 1 = enabled, 0 = disabled */
  isEnabled: integer("isEnabled").notNull().default(sql`1`),
});

/**
 * Delivery attempts - audit trail for notification delivery.
 */
export const deliveryAttempts = sqliteTable("delivery_attempts", {
  id: text("id").primaryKey(),
  /** FK to notifications.id. */
  notificationId: text("notificationId").notNull().references(() => notifications.id),
  /** in_app | email | push */
  channel: text("channel").notNull(),
  /** pending | success | failed */
  status: text("status").notNull(),
  /** When the delivery was attempted. */
  attemptedAt: text("attemptedAt").notNull(),
  /** Raw provider response for debugging. */
  providerResponse: text("providerResponse"),
});

/**
 * Transactional outbox for domain events (§17). Worker consumes `pending` rows
 * and creates in-app notifications / delivery attempts without blocking writes.
 */
export const outboxEvents = sqliteTable("outbox_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  eventType: text("eventType").notNull(),
  payload: text("payload").notNull(),
  /** pending | processing | delivered | failed */
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("nextAttemptAt"),
  processedAt: text("processedAt"),
  lastError: text("lastError"),
  createdAt: text("createdAt").notNull(),
});

// ============================================================================
// Email and Push Notification Queues
// ============================================================================

/**
 * Email queue - staging table for outbound emails.
 * Worker processes pending rows and sends via configured provider (SendGrid, SES, etc.).
 */
export const emailQueue = sqliteTable("email_queue", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  /** FK to notifications.id (optional - not all emails are notification-triggered). */
  notificationId: text("notificationId").references(() => notifications.id),
  /** Recipient email address. */
  toEmail: text("toEmail").notNull(),
  /** Optional CC recipients (JSON array). */
  ccEmails: text("ccEmails"),
  /** Email subject line. */
  subject: text("subject").notNull(),
  /** Plain text body. */
  bodyText: text("bodyText").notNull(),
  /** HTML body (optional). */
  bodyHtml: text("bodyHtml"),
  /** Email template ID (for provider-side templates). */
  templateId: text("templateId"),
  /** Template variables (JSON object). */
  templateVars: text("templateVars"),
  /** pending | processing | sent | failed | bounced */
  status: text("status").notNull().default("pending"),
  /** Number of send attempts. */
  attempts: integer("attempts").notNull().default(0),
  /** Next retry time for failed sends. */
  nextAttemptAt: text("nextAttemptAt"),
  /** When the email was successfully sent. */
  sentAt: text("sentAt"),
  /** Provider message ID (for tracking opens/clicks). */
  providerMessageId: text("providerMessageId"),
  /** Last error message on failure. */
  lastError: text("lastError"),
  createdAt: text("createdAt").notNull(),
});

/**
 * Push notification queue - staging table for mobile push notifications.
 * Worker processes pending rows and sends via configured provider (FCM, APNs, etc.).
 */
export const pushQueue = sqliteTable("push_queue", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  /** FK to notifications.id (optional). */
  notificationId: text("notificationId").references(() => notifications.id),
  /** FK to users.id - recipient. */
  userId: text("userId").notNull().references(() => users.id),
  /** Device token for the push provider. */
  deviceToken: text("deviceToken").notNull(),
  /** ios | android | web */
  platform: text("platform").notNull(),
  /** Notification title. */
  title: text("title").notNull(),
  /** Notification body text. */
  body: text("body").notNull(),
  /** Custom data payload (JSON object for deep linking etc.). */
  data: text("data"),
  /** Badge count to display (iOS). */
  badge: integer("badge"),
  /** Sound file to play. */
  sound: text("sound"),
  /** pending | processing | sent | failed | unregistered */
  status: text("status").notNull().default("pending"),
  /** Number of send attempts. */
  attempts: integer("attempts").notNull().default(0),
  /** Next retry time for failed sends. */
  nextAttemptAt: text("nextAttemptAt"),
  /** When the push was successfully sent. */
  sentAt: text("sentAt"),
  /** Provider message ID. */
  providerMessageId: text("providerMessageId"),
  /** Last error message on failure. */
  lastError: text("lastError"),
  createdAt: text("createdAt").notNull(),
});

/**
 * Device tokens - user device registration for push notifications.
 * Users can have multiple devices registered.
 */
export const deviceTokens = sqliteTable("device_tokens", {
  id: text("id").primaryKey(),
  tenantId: text("tenantId").notNull(),
  /** FK to users.id. */
  userId: text("userId").notNull().references(() => users.id),
  /** Device token from push provider. */
  token: text("token").notNull(),
  /** ios | android | web */
  platform: text("platform").notNull(),
  /** Device model/info for debugging. */
  deviceInfo: text("deviceInfo"),
  /** App version that registered this token. */
  appVersion: text("appVersion"),
  /** Whether this token is still valid. */
  isActive: integer("isActive").notNull().default(sql`1`),
  /** When the token was last used to send a push. */
  lastUsedAt: text("lastUsedAt"),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
});

// ============================================================================
// Phase G: Files and Attachments API
// ============================================================================

/**
 * Canonical file metadata for uploads.
 * Provides tracking and metadata for file uploads, independent of attachment context.
 */
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  storageKey: text("storageKey").notNull(),
  fileName: text("fileName").notNull(),
  mimeType: text("mimeType").notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  checksum: text("checksum"),
  uploadedByUserId: text("uploadedByUserId"),
  createdAt: text("createdAt").notNull(),
});

export const schema = {
  departments,
  roleTypes,
  users,
  sites,
  projects,
  projectStandupAiSummaries,
  locations,
  teamMembers,
  updates,
  updateAiOutputs,
  updateAttachments,
  updateRiskDownstreamEffects,
  updateRiskRecommendedActions,
  tasks,
  taskAttachments,
  attendanceSessions,
  attendances,
  auditEvents,
  // Phase B
  workCycles,
  commitments,
  taskDependencies,
  // Phase C
  improvementActions,
  // Phase D
  standupSessions,
  notifications,
  notificationPreferences,
  deliveryAttempts,
  outboxEvents,
  // Email/Push delivery infrastructure
  emailQueue,
  pushQueue,
  deviceTokens,
  // Phase G
  files,
};
