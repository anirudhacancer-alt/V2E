/**
 * Phase D Entity Generation
 *
 * Generates persisted Phase D entities:
 * - StandupSessions: standup meeting instances with lifecycle tracking
 * - Notifications: user-facing notification instances
 *
 * See: docs/data-model/plans/phase-D-standup-session-persistence-and-notifications.md
 */

import {
  addUtcDays,
  addUtcMinutes,
  offsetFromHash,
  sortBySeed,
  startOfUtcDay,
  toIso,
  withUtcTime,
  isBusinessDay,
  addBusinessDays,
} from "./helpers.js";
import type { CsvRow } from "./types.js";

// ============================================================================
// Phase D Configuration
// ============================================================================

export const PHASE_D_CONFIG = {
  /** Number of standup sessions per project (2-3). */
  standupSessionsPerProject: { min: 2, max: 3 },
  /** Session status distribution. */
  sessionStatusRatios: {
    draft: 0.15,
    active: 0.35,
    closed: 0.50,
  },
  /** Days back to span sessions. */
  sessionDaysBack: 7,
  /** Number of notifications per user (2-4). */
  notificationsPerUser: { min: 2, max: 4 },
  /** Notification status distribution. */
  notificationStatusRatios: {
    unread: 0.40,
    read: 0.60,
  },
  /** Notification type distribution. */
  notificationTypeRatios: {
    task_assigned: 0.25,
    blocker_escalated: 0.20,
    commitment_at_risk: 0.20,
    standup_reminder: 0.15,
    improvement_action: 0.10,
    task_overdue: 0.10,
  },
} as const;

export const PHASE_D_VALIDATION_TARGETS = {
  /** Minimum standup sessions per project. */
  minStandupSessionsPerProject: 2,
  /** Minimum notifications per user. */
  minNotificationsPerUser: 1,
  /** Minimum unread notifications overall. */
  minUnreadNotifications: 2,
} as const;

// ============================================================================
// Types
// ============================================================================

export type StandupSessionStatus = "draft" | "active" | "closed";
export type NotificationStatus = "unread" | "read";
export type NotificationType =
  | "task_assigned"
  | "blocker_escalated"
  | "commitment_at_risk"
  | "standup_reminder"
  | "improvement_action"
  | "task_overdue";

export interface StandupSessionRow {
  id: string;
  tenantId: string;
  projectId: string;
  scopeLevel: string;
  scopeRef: string | null;
  sessionDate: string;
  ownerId: string;
  status: StandupSessionStatus;
  summaryText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRow {
  id: string;
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

// ============================================================================
// Notification Templates
// ============================================================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, { title: string; body: string; entityType: string }[]> = {
  task_assigned: [
    { title: "New task assigned", body: "You have been assigned a new task: {detail}", entityType: "task" },
    { title: "Task reassigned to you", body: "A task has been reassigned to you: {detail}", entityType: "task" },
    { title: "High priority task", body: "A high priority task needs your attention: {detail}", entityType: "task" },
  ],
  blocker_escalated: [
    { title: "Blocker escalated", body: "A blocker has been escalated for your review: {detail}", entityType: "task" },
    { title: "Urgent: Blocker requires action", body: "An escalated blocker needs immediate attention: {detail}", entityType: "task" },
    { title: "Blocker awaiting resolution", body: "A critical blocker is awaiting your input: {detail}", entityType: "task" },
  ],
  commitment_at_risk: [
    { title: "Commitment at risk", body: "A commitment is at risk of being missed: {detail}", entityType: "commitment" },
    { title: "Deadline approaching", body: "A commitment deadline is approaching: {detail}", entityType: "commitment" },
    { title: "Action needed on commitment", body: "Your attention is needed on an at-risk commitment: {detail}", entityType: "commitment" },
  ],
  standup_reminder: [
    { title: "Standup starting soon", body: "Your standup session starts in 15 minutes", entityType: "standup" },
    { title: "Daily standup reminder", body: "Time to prepare your standup update for today", entityType: "standup" },
    { title: "Standup session active", body: "The standup session is now active and awaiting updates", entityType: "standup" },
  ],
  improvement_action: [
    { title: "Improvement action assigned", body: "You have been assigned an improvement action: {detail}", entityType: "improvement_action" },
    { title: "Improvement action due soon", body: "An improvement action deadline is approaching: {detail}", entityType: "improvement_action" },
    { title: "Improvement action validated", body: "An improvement action has been validated: {detail}", entityType: "improvement_action" },
  ],
  task_overdue: [
    { title: "Task overdue", body: "A task is now overdue: {detail}", entityType: "task" },
    { title: "Overdue task reminder", body: "You have an overdue task requiring attention: {detail}", entityType: "task" },
    { title: "Past due task alert", body: "A task has passed its due date: {detail}", entityType: "task" },
  ],
};

const STANDUP_SUMMARY_TEMPLATES = [
  "Team discussed {count} active tasks. Key blockers: {blocker}. Focus areas: {area}.",
  "Progress update: {count} tasks in progress, {blocked} blocked. Priority items for tomorrow: {area}.",
  "Daily standup completed. {count} items reviewed. Escalated: {blocker}. Next steps: {area}.",
  "Standup summary - Active work: {count} tasks. Issues flagged: {blocker}. Commitments: {area}.",
  "Team sync complete. {count} tasks discussed. Risks identified: {blocker}. Action items: {area}.",
];

// ============================================================================
// Standup Session Generation
// ============================================================================

/**
 * Picks a session status based on session date and anchor.
 */
function deriveSessionStatus(
  sessionDate: Date,
  anchor: Date,
  seed: string,
  id: string
): StandupSessionStatus {
  const anchorDay = startOfUtcDay(anchor);
  const sessionDay = startOfUtcDay(sessionDate);

  // Future or today sessions can be draft or active
  if (sessionDay.getTime() >= anchorDay.getTime()) {
    const roll = offsetFromHash(seed, `${id}:status`, 0, 100);
    return roll < 40 ? "draft" : "active";
  }

  // Past sessions are mostly closed
  const roll = offsetFromHash(seed, `${id}:status`, 0, 100);
  if (roll < 10) return "draft";
  if (roll < 25) return "active";
  return "closed";
}

/**
 * Generates a standup summary based on project data.
 */
function generateSummary(seed: string, id: string): string {
  const template = STANDUP_SUMMARY_TEMPLATES[
    offsetFromHash(seed, `${id}:summary-template`, 0, STANDUP_SUMMARY_TEMPLATES.length - 1)
  ];

  const counts = [3, 5, 7, 8, 10, 12];
  const blockers = ["material delays", "drawing approvals", "resource constraints", "weather impacts", "coordination issues"];
  const areas = ["electrical rough-in", "MEP coordination", "structural framing", "finishing work", "facade installation"];

  const count = counts[offsetFromHash(seed, `${id}:count`, 0, counts.length - 1)];
  const blocker = blockers[offsetFromHash(seed, `${id}:blocker`, 0, blockers.length - 1)];
  const area = areas[offsetFromHash(seed, `${id}:area`, 0, areas.length - 1)];
  const blocked = offsetFromHash(seed, `${id}:blocked`, 1, 3);

  return template
    .replace("{count}", String(count))
    .replace("{blocker}", blocker)
    .replace("{area}", area)
    .replace("{blocked}", String(blocked));
}

/**
 * Generates standup sessions for a project.
 */
export function generateStandupSessions(
  teamMembers: CsvRow[],
  projectId: string,
  siteId: string,
  tenantId: string,
  anchorDate: Date,
  seed: string
): StandupSessionRow[] {
  const sessions: StandupSessionRow[] = [];
  const anchor = startOfUtcDay(anchorDate);

  // Get team members for this site who can conduct standups
  const siteTeamMembers = teamMembers.filter((tm) => tm.siteId === siteId);
  const supervisors = siteTeamMembers.filter(
    (tm) => /supervisor|manager|lead|foreman/i.test(tm.role || "")
  );
  const conductors = supervisors.length > 0 ? supervisors : siteTeamMembers;

  if (conductors.length === 0) {
    return sessions;
  }

  // Determine number of sessions
  const numSessions = offsetFromHash(
    seed,
    `${projectId}:standup-sessions:count`,
    PHASE_D_CONFIG.standupSessionsPerProject.min,
    PHASE_D_CONFIG.standupSessionsPerProject.max
  );

  // Generate sessions spanning the last week
  for (let i = 0; i < numSessions; i++) {
    const sessionId = `ss-${projectId.slice(0, 8)}-${i}`;

    // Session date - spread across last 7 days, preferring business days
    let sessionDate = addUtcDays(anchor, -i * 2);
    if (!isBusinessDay(sessionDate)) {
      sessionDate = addBusinessDays(sessionDate, -1);
    }

    const status = deriveSessionStatus(sessionDate, anchor, seed, sessionId);

    // Select conductor
    const conductor = conductors[offsetFromHash(seed, `${sessionId}:conductor`, 0, conductors.length - 1)];
    if (!conductor) continue;

    // Summary for active/closed sessions
    const summaryText = status !== "draft" ? generateSummary(seed, sessionId) : null;

    // Timestamps
    const sessionHour = offsetFromHash(seed, `${sessionId}:hour`, 7, 9);
    const createdAt = withUtcTime(sessionDate, sessionHour, 0);
    const updatedAt = status === "closed"
      ? withUtcTime(sessionDate, sessionHour + 1, offsetFromHash(seed, `${sessionId}:upd-min`, 0, 45))
      : withUtcTime(anchor, 10, offsetFromHash(seed, `${sessionId}:upd-min`, 0, 45));

    sessions.push({
      id: sessionId,
      tenantId,
      projectId,
      scopeLevel: "project",
      scopeRef: projectId,
      sessionDate: toIso(sessionDate).slice(0, 10),
      ownerId: conductor.id,
      status,
      summaryText,
      createdAt: toIso(createdAt),
      updatedAt: toIso(updatedAt),
    });
  }

  return sessions;
}

// ============================================================================
// Notification Generation
// ============================================================================

/**
 * Picks a notification type based on configured ratios.
 */
function pickNotificationType(seed: string, id: string): NotificationType {
  const roll = offsetFromHash(seed, `${id}:type`, 0, 100);
  let cumulative = 0;

  for (const [type, ratio] of Object.entries(PHASE_D_CONFIG.notificationTypeRatios)) {
    cumulative += ratio * 100;
    if (roll < cumulative) {
      return type as NotificationType;
    }
  }

  return "task_assigned";
}

/**
 * Generates notifications for demo users.
 */
export function generateNotifications(
  users: CsvRow[],
  tasks: CsvRow[],
  tenantId: string,
  anchorDate: Date,
  seed: string
): NotificationRow[] {
  const notifications: NotificationRow[] = [];
  const anchor = startOfUtcDay(anchorDate);

  // Sort users deterministically
  const sortedUsers = sortBySeed(users, `${seed}:notifications-users`, (u) => u.id);

  // Get task titles for notification content
  const taskTitles = tasks.slice(0, 20).map((t) => t.title || "Task update required");

  let notificationIndex = 0;

  for (const user of sortedUsers) {
    const numNotifications = offsetFromHash(
      seed,
      `${user.id}:notification-count`,
      PHASE_D_CONFIG.notificationsPerUser.min,
      PHASE_D_CONFIG.notificationsPerUser.max
    );

    for (let i = 0; i < numNotifications; i++) {
      const notifId = `notif-${user.id.slice(0, 6)}-${i}`;
      const type = pickNotificationType(seed, notifId);
      const templates = NOTIFICATION_TEMPLATES[type];
      const template = templates[offsetFromHash(seed, `${notifId}:template`, 0, templates.length - 1)];

      // Get detail text from task titles or generic text
      const detail = taskTitles[offsetFromHash(seed, `${notifId}:detail`, 0, taskTitles.length - 1)] || "Review pending items";

      // Determine read status
      const isRead = offsetFromHash(seed, `${notifId}:read`, 0, 100) >= PHASE_D_CONFIG.notificationStatusRatios.unread * 100;
      const status: NotificationStatus = isRead ? "read" : "unread";

      // Created date - spread over last few days
      const daysAgo = offsetFromHash(seed, `${notifId}:days-ago`, 0, 5);
      const createdAt = withUtcTime(
        addUtcDays(anchor, -daysAgo),
        8 + offsetFromHash(seed, `${notifId}:hour`, 0, 10),
        offsetFromHash(seed, `${notifId}:min`, 0, 55)
      );

      // Read timestamp for read notifications
      const readAt = isRead
        ? toIso(addUtcMinutes(createdAt, offsetFromHash(seed, `${notifId}:read-delay`, 15, 240)))
        : null;

      // Entity reference (if applicable)
      const entityId = template.entityType === "task" && tasks.length > 0
        ? tasks[offsetFromHash(seed, `${notifId}:entity`, 0, tasks.length - 1)].id
        : null;

      notifications.push({
        id: notifId,
        tenantId,
        userId: user.id,
        type,
        title: template.title,
        body: template.body.replace("{detail}", detail),
        entityType: template.entityType,
        entityId,
        status,
        createdAt: toIso(createdAt),
        readAt,
      });

      notificationIndex++;
    }
  }

  return notifications;
}

// ============================================================================
// Phase D Metrics Collection
// ============================================================================

export interface PhaseDMetrics {
  standupSessionCount: number;
  sessionStatusDistribution: Record<StandupSessionStatus, number>;
  notificationCount: number;
  notificationStatusDistribution: Record<NotificationStatus, number>;
  notificationTypeDistribution: Record<NotificationType, number>;
  unreadCount: number;
  errors: string[];
}

/**
 * Collects Phase D validation metrics.
 */
export function collectPhaseDMetrics(
  standupSessions: StandupSessionRow[],
  notifications: NotificationRow[]
): PhaseDMetrics {
  const errors: string[] = [];

  const sessionStatusDistribution: Record<StandupSessionStatus, number> = {
    draft: 0,
    active: 0,
    closed: 0,
  };

  const notificationStatusDistribution: Record<NotificationStatus, number> = {
    unread: 0,
    read: 0,
  };

  const notificationTypeDistribution: Record<NotificationType, number> = {
    task_assigned: 0,
    blocker_escalated: 0,
    commitment_at_risk: 0,
    standup_reminder: 0,
    improvement_action: 0,
    task_overdue: 0,
  };

  for (const session of standupSessions) {
    if (session.status in sessionStatusDistribution) {
      sessionStatusDistribution[session.status]++;
    }
  }

  for (const notification of notifications) {
    if (notification.status in notificationStatusDistribution) {
      notificationStatusDistribution[notification.status]++;
    }
    if (notification.type in notificationTypeDistribution) {
      notificationTypeDistribution[notification.type]++;
    }
  }

  const unreadCount = notificationStatusDistribution.unread;

  // Validation
  if (standupSessions.length < PHASE_D_VALIDATION_TARGETS.minStandupSessionsPerProject) {
    errors.push(
      `Phase D: standup sessions too low (${standupSessions.length} < ${PHASE_D_VALIDATION_TARGETS.minStandupSessionsPerProject})`
    );
  }

  if (unreadCount < PHASE_D_VALIDATION_TARGETS.minUnreadNotifications) {
    errors.push(
      `Phase D: unread notifications too low (${unreadCount} < ${PHASE_D_VALIDATION_TARGETS.minUnreadNotifications})`
    );
  }

  return {
    standupSessionCount: standupSessions.length,
    sessionStatusDistribution,
    notificationCount: notifications.length,
    notificationStatusDistribution,
    notificationTypeDistribution,
    unreadCount,
    errors,
  };
}

/**
 * Validates Phase D fixtures.
 */
export function validatePhaseDFixtures(
  standupSessions: StandupSessionRow[],
  notifications: NotificationRow[],
  teamMembers: { id: string }[],
  users: { id: string }[],
  projects: { id: string }[]
): string[] {
  const metrics = collectPhaseDMetrics(standupSessions, notifications);
  const errors = [...metrics.errors];

  const teamMemberIds = new Set(teamMembers.map((tm) => tm.id));
  const userIds = new Set(users.map((u) => u.id));
  const projectIds = new Set(projects.map((p) => p.id));

  // Validate standup sessions
  for (const session of standupSessions) {
    if (!projectIds.has(session.projectId)) {
      errors.push(`StandupSession ${session.id} references unknown projectId ${session.projectId}`);
    }
    if (!teamMemberIds.has(session.ownerId)) {
      errors.push(`StandupSession ${session.id} references unknown ownerId ${session.ownerId}`);
    }
    // Closed sessions should have summaries
    if (session.status === "closed" && !session.summaryText) {
      errors.push(`StandupSession ${session.id} is closed but has no summaryText`);
    }
  }

  // Validate notifications
  for (const notification of notifications) {
    if (!userIds.has(notification.userId)) {
      errors.push(`Notification ${notification.id} references unknown userId ${notification.userId}`);
    }
    // Read notifications should have readAt
    if (notification.status === "read" && !notification.readAt) {
      errors.push(`Notification ${notification.id} is read but has no readAt`);
    }
    // Unread notifications should not have readAt
    if (notification.status === "unread" && notification.readAt) {
      errors.push(`Notification ${notification.id} is unread but has readAt`);
    }
  }

  return errors;
}
