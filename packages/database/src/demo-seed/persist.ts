import * as schema from "../schema.js";
import { openDemoDb } from "../db.js";
import {
  departmentStringToCode,
  legacyUserRoleStringToRoleTypeCode,
} from "../org-canonical.js";
import { deriveLocationDisplayLabel } from "./location-rules.js";
import { deriveLocationListLabel } from "../location-list-label.js";
import { getDemoLeadIdentity } from "./org-mappings.js";
import type { MaterializedDemoBundle } from "./types.js";
import type {
  CommitmentRow,
  TaskDependencyRow,
  WorkCycleRow,
} from "./phase-b-entities.js";

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function resolveTeamMemberUserId(
  bundle: MaterializedDemoBundle,
  row: Record<string, string>,
  uniqueUserIdByName: Map<string, string>,
  userIdByEmail: Map<string, string>
): string | null {
  const email = row.email?.trim().toLowerCase();
  if (email && userIdByEmail.has(email)) {
    return userIdByEmail.get(email) ?? null;
  }

  const name = row.name?.trim();
  if (name && uniqueUserIdByName.has(name)) {
    return uniqueUserIdByName.get(name) ?? null;
  }

  const leadIdentity = getDemoLeadIdentity(bundle.datasetKey);
  if (
    (email && email === leadIdentity.email.trim().toLowerCase()) ||
    (name && name === leadIdentity.name.trim())
  ) {
    return leadIdentity.userId;
  }

  return null;
}

function derivePersistedReviewStatus(reviewRequired: number, humanReviewRequired: number) {
  if (humanReviewRequired === 1) {
    return "needs_human_review";
  }
  if (reviewRequired === 1) {
    return "pending";
  }
  return "accepted";
}

export async function clearDemoDb(db: ReturnType<typeof openDemoDb>) {
  // Phase D entities (delete first due to FK constraints)
  await db.delete(schema.outboxEvents);
  await db.delete(schema.pushQueue);
  await db.delete(schema.emailQueue);
  await db.delete(schema.deliveryAttempts);
  await db.delete(schema.deviceTokens);
  await db.delete(schema.notifications);
  await db.delete(schema.notificationPreferences);
  await db.delete(schema.standupSessions);
  // Phase C entities
  await db.delete(schema.improvementActions);
  // Phase B entities
  await db.delete(schema.taskDependencies);
  await db.delete(schema.commitments);
  await db.delete(schema.workCycles);
  // Core entities
  await db.delete(schema.auditEvents);
  await db.delete(schema.attendances);
  await db.delete(schema.attendanceSessions);
  await db.delete(schema.taskAttachments);
  await db.delete(schema.tasks);
  await db.delete(schema.updateRiskRecommendedActions);
  await db.delete(schema.updateRiskDownstreamEffects);
  await db.delete(schema.updateAttachments);
  await db.delete(schema.updateAiOutputs);
  await db.delete(schema.updates);
  await db.delete(schema.teamMembers);
  await db.delete(schema.locations);
  await db.delete(schema.projects);
  await db.delete(schema.sites);
  await db.delete(schema.departments);
  await db.delete(schema.roleTypes);
  await db.delete(schema.users);
}

export async function insertDemoBundle(
  db: ReturnType<typeof openDemoDb>,
  bundle: MaterializedDemoBundle
) {
  const userIdByEmail = new Map(
    bundle.rows.users
      .filter((row) => row.email?.trim())
      .map((row) => [row.email.trim().toLowerCase(), row.id])
  );
  const usersByName = new Map<string, string[]>();
  for (const row of bundle.rows.users) {
    const name = row.name?.trim();
    if (!name) continue;
    usersByName.set(name, [...(usersByName.get(name) ?? []), row.id]);
  }
  const uniqueUserIdByName = new Map(
    [...usersByName.entries()]
      .filter(([, ids]) => ids.length === 1)
      .map(([name, ids]) => [name, ids[0]])
  );

  for (const rows of chunk(bundle.rows.departments, 200)) {
    await db
      .insert(schema.departments)
      .values(
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.category ?? "",
          isSiteFunction: Number(row.isSiteFunction ?? 0),
          isExecutionDiscipline: Number(row.isExecutionDiscipline ?? 0),
          isActive: Number(row.isActive ?? 1),
          sortOrder: Number(row.sortOrder ?? 0),
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.roleTypes, 200)) {
    await db
      .insert(schema.roleTypes)
      .values(
        rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          level: row.level ?? "",
          isManagerial: Number(row.isManagerial ?? 0),
          isFieldBased: Number(row.isFieldBased ?? 0),
          isCrewRole: Number(row.isCrewRole ?? 0),
          isActive: Number(row.isActive ?? 1),
          sortOrder: Number(row.sortOrder ?? 0),
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.users, 200)) {
    await db
      .insert(schema.users)
      .values(
        rows.map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name,
          orgRoleCode: legacyUserRoleStringToRoleTypeCode(row.role),
          departmentCode: departmentStringToCode(row.department) ?? undefined,
          specialty: row.specialty ?? "",
          phone: row.phone,
          employeeId: row.employeeId,
          avatarUrl: row.avatarUrl || null,
          preferencesPushNotificationsEnabled:
            row.preferences_pushNotificationsEnabled,
          preferencesDarkModeEnabled: row.preferences_darkModeEnabled,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.sites, 200)) {
    await db
      .insert(schema.sites)
      .values(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          address: row.address,
          locationLatitude: row.locationLatitude || null,
          locationLongitude: row.locationLongitude || null,
          projectManagerId: row.projectManagerId,
          isActive: row.isActive,
          metadata: row.metadata || "{}",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.projects, 200)) {
    await db
      .insert(schema.projects)
      .values(
        rows.map((row) => {
          const r = row as Record<string, string | undefined>;
          return {
            id: row.id,
            siteId: row.siteId,
            code: row.code,
            name: row.name,
            description: row.description || null,
            type: r.type ?? "other",
            status: r.status ?? "active",
            isActive: row.isActive,
            metadata: row.metadata || "{}",
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
        })
      )
      .onConflictDoNothing();
  }

  const projectCodeToId = new Map(
    bundle.rows.projects.map((p) => [p.code.trim(), p.id] as const)
  );

  for (const rows of chunk(bundle.rows.locations, 200)) {
    await db
      .insert(schema.locations)
      .values(
        rows.map((row) => {
          const code = (row.projectCode ?? "").trim();
          const legacyId = (row.projectId ?? "").trim();
          let projectId: string | undefined;
          if (code) {
            projectId = projectCodeToId.get(code);
            if (!projectId) {
              throw new Error(
                `Demo seed: location ${row.id} unknown projectCode "${code}"`
              );
            }
          } else {
            projectId = legacyId || undefined;
            if (!projectId) {
              throw new Error(
                `Demo seed: location ${row.id} missing projectCode (e.g. RES-1328)`
              );
            }
          }
          const displayLabel = deriveLocationDisplayLabel(row);
          const listLabel = deriveLocationListLabel(row);
          return {
            id: row.id,
            projectId,
            siteType: row.siteType,
            level1: row.level1,
            level2: row.level2 && row.level2 !== "" ? row.level2 : null,
            level3: row.level3 && row.level3 !== "" ? row.level3 : null,
            level4: row.level4 && row.level4 !== "" ? row.level4 : null,
            displayLabel,
            listLabel,
            isActive:
              row.isActive !== undefined && row.isActive !== ""
                ? Number(row.isActive)
                : 1,
            sortOrder: Number(row.sortOrder),
          };
        })
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.teamMembers, 200)) {
    await db
      .insert(schema.teamMembers)
      .values(
        rows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          userId: resolveTeamMemberUserId(
            bundle,
            row,
            uniqueUserIdByName,
            userIdByEmail
          ),
          name: row.name,
          orgRoleCode: legacyUserRoleStringToRoleTypeCode(row.role),
          departmentCode: departmentStringToCode(row.department) ?? undefined,
          specialty: row.specialty ?? "",
          reportsToUserId:
            row.reportsToUserId && row.reportsToUserId.trim() !== ""
              ? row.reportsToUserId
              : null,
          email: row.email || null,
          phone: row.phone || null,
          isActive: row.isActive,
          joinedAt: row.joinedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.attendanceSessions, 200)) {
    await db
      .insert(schema.attendanceSessions)
      .values(
        rows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          projectId: row.projectId,
          sessionDate: row.sessionDate,
          conductedBy: row.conductedBy,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.attendances, 500)) {
    await db
      .insert(schema.attendances)
      .values(
        rows.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          teamMemberId: row.teamMemberId,
          status: row.status,
          notes: row.notes || null,
          recordedAt: row.recordedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.updates, 200)) {
    await db
      .insert(schema.updates)
      .values(
        rows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          projectId: row.projectId,
          sourceType: row.sourceType?.trim() || "voice",
          needsReview:
            row.needsReview !== undefined && row.needsReview !== ""
              ? Number(row.needsReview)
              : 0,
          recordedBy: row.recordedBy,
          transcript: row.transcript,
          audioUrl: row.audioUrl || null,
          audioDuration: row.audioDuration || null,
          status: row.status,
          isRead:
            row.isRead !== undefined && row.isRead !== "" ? Number(row.isRead) : 0,
          readAt: row.readAt && row.readAt !== "" ? row.readAt : null,
          transcribeIdempotencyKey: null,
          extractIdempotencyKey: null,
          linkedTaskId: row.linkedTaskId || null,
          locationId: (() => {
            const lid = row.locationId?.trim();
            if (!lid) {
              throw new Error(`Demo seed: update ${row.id} missing locationId`);
            }
            return lid;
          })(),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.updateAi, 200)) {
    await db
      .insert(schema.updateAiOutputs)
      .values(
        rows.map((row) => ({
          id: row.updateId,
          updateId: row.updateId,
          category: row.category,
          departmentCode: departmentStringToCode(row.department) ?? undefined,
          location: row.location || null,
          locationId: (() => {
            const lid = row.locationId?.trim();
            if (!lid) {
              throw new Error(`Demo seed: update_ai ${row.updateId} missing locationId`);
            }
            return lid;
          })(),
          blockerSubtype: row.blockerSubtype || null,
          locationBlock: row.locationBlock || null,
          locationZone: row.locationZone || null,
          locationLevel: row.locationLevel || null,
          locationArea: row.locationArea || null,
          vendor: row.vendor || null,
          severity: row.severity,
          ownerRoleCode: legacyUserRoleStringToRoleTypeCode(row.ownerRole),
          ownerId: row.ownerId || null,
          dueDate: row.dueDate,
          generatedTaskDescription: row.generatedTaskDescription,
          riskImpact: row.riskImpact,
          scheduleRisk: row.scheduleRisk,
          confidence: Number(row.confidence),
          reviewRequired:
            row.reviewRequired !== undefined && row.reviewRequired !== ""
              ? Number(row.reviewRequired)
              : 0,
          reviewPrompt: row.reviewPrompt || null,
          reviewReasonsJson: row.reviewReasonsJson || "[]",
          reviewFieldsJson: row.reviewFieldsJson || "[]",
          humanReviewRequired:
            row.humanReviewRequired !== undefined && row.humanReviewRequired !== ""
              ? Number(row.humanReviewRequired)
              : row.reviewRequired !== undefined && row.reviewRequired !== ""
                ? Number(row.reviewRequired)
                : 0,
          reviewStatus: derivePersistedReviewStatus(
            row.reviewRequired !== undefined && row.reviewRequired !== ""
              ? Number(row.reviewRequired)
              : 0,
            row.humanReviewRequired !== undefined && row.humanReviewRequired !== ""
              ? Number(row.humanReviewRequired)
              : row.reviewRequired !== undefined && row.reviewRequired !== ""
                ? Number(row.reviewRequired)
                : 0
          ),
          reviewedAt: row.reviewedAt || null,
          reviewedBy: row.reviewedBy || null,
          suggestedSnapshotJson: null,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.updateAttachments, 500)) {
    await db
      .insert(schema.updateAttachments)
      .values(
        rows.map((row) => ({
          id: row.id,
          updateId: row.updateId,
          taskId: row.taskId && row.taskId !== "" ? row.taskId : null,
          url: row.url,
          type: row.type,
          uploadedAt: row.uploadedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.riskEffects, 500)) {
    await db
      .insert(schema.updateRiskDownstreamEffects)
      .values(
        rows.map((row) => ({
          updateId: row.updateId,
          order: Number(row.order),
          effect: row.effect,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.riskActions, 500)) {
    await db
      .insert(schema.updateRiskRecommendedActions)
      .values(
        rows.map((row) => ({
          updateId: row.updateId,
          order: Number(row.order),
          action: row.action,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.tasks, 200)) {
    await db
      .insert(schema.tasks)
      .values(
        rows.map((row) => ({
          id: row.id,
          siteId: row.siteId,
          projectId: row.projectId,
          kind: row.kind?.trim() || "task",
          title: row.title,
          description: row.description,
          ownerId: row.ownerId,
          reporterTeamMemberId:
            row.reporterTeamMemberId?.trim() || null,
          assigneeRoleCode: legacyUserRoleStringToRoleTypeCode(row.assigneeRole),
          severity: row.severity,
          departmentCode: departmentStringToCode(row.department) ?? undefined,
          createdBy: row.createdBy?.trim() || null,
          updatedBy: row.updatedBy?.trim() || null,
          location: row.location,
          locationId: (() => {
            const lid = row.locationId?.trim();
            if (!lid) {
              throw new Error(`Demo seed: task ${row.id} missing locationId`);
            }
            return lid;
          })(),
          status: row.status,
          source: row.source,
          sourceUpdateId: row.sourceUpdateId || null,
          startDate: row.startDate,
          dueDate: row.dueDate,
          completedAt: row.completedAt || null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }

  for (const rows of chunk(bundle.rows.taskAttachments, 500)) {
    await db
      .insert(schema.taskAttachments)
      .values(
        rows.map((row) => ({
          id: row.id,
          taskId: row.taskId,
          url: row.url,
          type: row.type,
          uploadedAt: row.uploadedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

// ============================================================================
// Phase B Entity Insertion
// ============================================================================

/**
 * Inserts Phase B work cycles into the database.
 */
export async function insertWorkCycles(
  db: ReturnType<typeof openDemoDb>,
  workCycles: WorkCycleRow[]
) {
  for (const rows of chunk(workCycles, 200)) {
    await db
      .insert(schema.workCycles)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          name: row.name,
          startDate: row.startDate,
          endDate: row.endDate,
          status: row.status,
          goal: row.goal || null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

/**
 * Inserts Phase B commitments into the database.
 */
export async function insertCommitments(
  db: ReturnType<typeof openDemoDb>,
  commitments: CommitmentRow[]
) {
  for (const rows of chunk(commitments, 200)) {
    await db
      .insert(schema.commitments)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          siteId: row.siteId,
          workCycleId: row.workCycleId || null,
          standupSessionId: row.standupSessionId || null,
          sourceTaskId: row.sourceTaskId || null,
          title: row.title,
          description: row.description || null,
          ownerId: row.ownerId,
          assigneeRoleCode: row.assigneeRoleCode,
          status: row.status,
          commitDate: row.commitDate,
          targetDate: row.targetDate,
          completedAt: row.completedAt || null,
          carriedOverFromCommitmentId: row.carriedOverFromCommitmentId || null,
          riskReason: row.riskReason || null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

/**
 * Inserts Phase B task dependencies into the database.
 */
export async function insertTaskDependencies(
  db: ReturnType<typeof openDemoDb>,
  dependencies: TaskDependencyRow[]
) {
  for (const rows of chunk(dependencies, 200)) {
    await db
      .insert(schema.taskDependencies)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          predecessorTaskId: row.predecessorTaskId,
          successorTaskId: row.successorTaskId,
          dependencyType: row.dependencyType,
          lagDays: row.lagDays,
          isHardConstraint: row.isHardConstraint,
          reason: row.reason || null,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

// ============================================================================
// Phase C Entity Insertion
// ============================================================================

import type { ImprovementActionRow } from "./phase-c-entities.js";

/**
 * Inserts Phase C improvement actions into the database.
 */
export async function insertImprovementActions(
  db: ReturnType<typeof openDemoDb>,
  improvementActions: ImprovementActionRow[]
) {
  for (const rows of chunk(improvementActions, 200)) {
    await db
      .insert(schema.improvementActions)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          siteId: row.siteId,
          title: row.title,
          problemStatement: row.problemStatement,
          category: row.category,
          rootCause: row.rootCause || null,
          ownerId: row.ownerId,
          status: row.status,
          targetDate: row.targetDate || null,
          linkedTaskIdsJson: row.linkedTaskIdsJson,
          linkedBlockerIdsJson: row.linkedBlockerIdsJson,
          linkedCommitmentIdsJson: row.linkedCommitmentIdsJson,
          effectivenessNote: row.effectivenessNote || null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

// ============================================================================
// Phase D Entity Insertion
// ============================================================================

import type { StandupSessionRow, NotificationRow } from "./phase-d-entities.js";

/**
 * Inserts Phase D standup sessions into the database.
 */
export async function insertStandupSessions(
  db: ReturnType<typeof openDemoDb>,
  standupSessions: StandupSessionRow[]
) {
  for (const rows of chunk(standupSessions, 200)) {
    await db
      .insert(schema.standupSessions)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          projectId: row.projectId,
          scopeLevel: row.scopeLevel,
          scopeRef: row.scopeRef || null,
          sessionDate: row.sessionDate,
          ownerId: row.ownerId,
          status: row.status,
          summaryText: row.summaryText || null,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }))
      )
      .onConflictDoNothing();
  }
}

/**
 * Inserts Phase D notifications into the database.
 */
export async function insertNotifications(
  db: ReturnType<typeof openDemoDb>,
  notifications: NotificationRow[]
) {
  for (const rows of chunk(notifications, 200)) {
    await db
      .insert(schema.notifications)
      .values(
        rows.map((row) => ({
          id: row.id,
          tenantId: row.tenantId,
          userId: row.userId,
          type: row.type,
          title: row.title,
          body: row.body,
          entityType: row.entityType || null,
          entityId: row.entityId || null,
          status: row.status,
          createdAt: row.createdAt,
          readAt: row.readAt || null,
        }))
      )
      .onConflictDoNothing();
  }
}
