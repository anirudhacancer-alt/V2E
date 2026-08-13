import { randomUUID } from "node:crypto";
import type { DemoDb } from "@v2e/database";
import { auditEvents } from "@v2e/database";

import { enqueueOutboxEvent } from "./outbox.js";

export type AuditEventType =
  | "update.created"
  | "update.transcript_patched"
  | "update.marked_read"
  | "update.location_patched"
  | "update.transcribe_completed"
  | "update.transcribe_failed"
  | "update.extract_completed"
  | "update.extract_failed"
  | "update.extraction_review_confirmed"
  | "update.escalated"
  | "task.created"
  | "task.assigned"
  | "task.overdue"
  | "task.status_changed"
  | "standup.summary_generated"
  | "standup.patched"
  // Phase B: Agile Execution Layer
  | "dependency.created"
  | "dependency.deleted"
  | "dependency.override"
  | "commitment.created"
  | "commitment.missed"
  | "commitment.status_changed"
  | "work_cycle.created"
  | "work_cycle.status_changed"
  // Phase C: Improvement Actions & Technical Review
  | "improvement_action.created"
  | "improvement_action.status_changed"
  | "task.approved"
  | "task.rework_requested"
  | "task.submitted_for_technical_review"
  // Phase D: Standup Sessions & Notifications
  | "standup_session.created"
  | "standup_session.status_changed"
  | "standup_session.opened"
  | "standup_session.closed"
  | "standup_session.summary_generated"
  // Phase D: Standup Attendance & AI Summaries
  | "attendance_record.created"
  | "attendance_record.status_changed"
  | "project_standup_ai_summary.created"
  | "project_standup_ai_summary.updated"
  // Phase E: Platform Entity CRUD
  | "user.created"
  | "department.created"
  | "role_type.created"
  | "location.created"
  | "site.created"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "team_member.created"
  // Phase G: Files and Attachments
  | "file.created"
  | "file.deleted"
  | "update_attachment.created"
  | "update_attachment.deleted"
  | "task_attachment.created"
  | "task_attachment.deleted"
  | "update_ai_output.created"
  | "update_ai_output.updated";

export async function insertAuditEvent(
  db: DemoDb,
  input: {
    eventType: AuditEventType;
    projectId?: string | null;
    siteId?: string | null;
    entityType: string;
    entityId: string;
    actor?: string | null;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(auditEvents).values({
    id: randomUUID(),
    occurredAt: now,
    eventType: input.eventType,
    projectId: input.projectId ?? null,
    siteId: input.siteId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    actor: input.actor ?? "bearer",
    payload: JSON.stringify({
      ...(input.siteId ? { siteId: input.siteId } : {}),
      ...input.payload,
    }),
  });

  await enqueueOutboxEvent(db, {
    tenantId: "demo",
    eventType: input.eventType,
    payload: {
      projectId: input.projectId ?? null,
      siteId: input.siteId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      actor: input.actor ?? "bearer",
      ...input.payload,
    },
  });
}
