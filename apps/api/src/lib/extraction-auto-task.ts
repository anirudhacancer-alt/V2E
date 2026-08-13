/**
 * Server-side task creation after AI extraction (hybrid confidence bands).
 * Client-initiated POST /tasks still enforces HUMAN_REVIEW_REQUIRED when applicable.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  locations,
  tasks,
  teamMembers,
  updateAiOutputs,
  updateAttachments,
  updates,
} from "@v2e/database";
import { normalizeReviewRequirement } from "@v2e/contracts";

import type { getDemoDb } from "../db.js";
import { insertAuditEvent } from "./audit.js";
import {
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "../env.js";

export type Db = ReturnType<typeof getDemoDb>;

/** Same demo actor as manual task creation in tasks routes. */
export const DEMO_TASK_ACTOR_ID = "bcea1e0f-b972-4f75-8563-c9f64aa9756f";

function mapExtractionSeverityToTask(
  raw: string,
): "Critical" | "High" | "Medium" | "Low" {
  const s = raw.trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (
    cap === "Critical" ||
    cap === "High" ||
    cap === "Medium" ||
    cap === "Low"
  ) {
    return cap;
  }
  return "Medium";
}

function formatDueYmd(due: string): string {
  const t = due.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

async function resolveOwnerId(
  db: Db,
  siteId: string,
  ownerRoleCode: string,
  preferred: string | null,
): Promise<string | null> {
  if (preferred) {
    const [m] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, preferred));
    if (m && m.siteId === siteId && m.orgRoleCode === ownerRoleCode) {
      return m.id;
    }
  }
  const [row] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.siteId, siteId),
        eq(teamMembers.orgRoleCode, ownerRoleCode),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export type PostExtractionAutoTaskResult =
  | { kind: "skipped"; reason: string }
  | { kind: "created"; taskId: string; band: "medium" | "high" };

/**
 * Creates a task from persisted extraction when confidence is in the auto band
 * and required fields resolve. Idempotent: skips if a task already exists for
 * `sourceUpdateId`.
 */
export async function applyPostExtractionAutoTask(
  db: Db,
  params: {
    updateId: string;
    projectId: string;
    siteId: string;
    confidence: number;
    departmentCode: string | null;
    ownerRoleCode: string;
    ownerId: string | null;
    generatedTaskDescription: string;
    extractionSeverity: string;
    dueDate: string;
    locationId: string;
  },
): Promise<PostExtractionAutoTaskResult> {
  const {
    updateId,
    projectId,
    siteId,
    confidence,
    departmentCode,
    ownerRoleCode,
    ownerId,
    generatedTaskDescription,
    extractionSeverity,
    dueDate,
    locationId,
  } = params;

  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    return { kind: "skipped", reason: "low_confidence" };
  }
  if (!departmentCode?.trim()) {
    return { kind: "skipped", reason: "missing_department" };
  }
  if (!generatedTaskDescription?.trim()) {
    return { kind: "skipped", reason: "missing_description" };
  }

  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.sourceUpdateId, updateId));
  if (existing) {
    return { kind: "skipped", reason: "task_already_exists" };
  }

  const resolvedOwnerId = await resolveOwnerId(
    db,
    siteId,
    ownerRoleCode,
    ownerId,
  );
  if (!resolvedOwnerId) {
    return { kind: "skipped", reason: "no_owner" };
  }

  const [loc] = await db
    .select({
      id: locations.id,
      displayLabel: locations.displayLabel,
    })
    .from(locations)
    .where(
      and(eq(locations.id, locationId), eq(locations.projectId, projectId)),
    );
  if (!loc) {
    return { kind: "skipped", reason: "invalid_location" };
  }

  const band: "medium" | "high" =
    confidence >= HIGH_CONFIDENCE_THRESHOLD ? "high" : "medium";

  const now = new Date().toISOString();
  const today = now.split("T")[0];
  const taskId = randomUUID();
  const title = (
    generatedTaskDescription.split("\n")[0]?.trim() || "Task"
  ).slice(0, 200);

  await db.insert(tasks).values({
    id: taskId,
    siteId,
    projectId,
    kind: "task",
    reporterTeamMemberId: null,
    title,
    description: generatedTaskDescription,
    severity: mapExtractionSeverityToTask(extractionSeverity),
    departmentCode,
    createdBy: DEMO_TASK_ACTOR_ID,
    updatedBy: DEMO_TASK_ACTOR_ID,
    location: loc.displayLabel,
    locationId: loc.id,
    ownerId: resolvedOwnerId,
    assigneeRoleCode: ownerRoleCode,
    status: "In-progress",
    source: "voice_update",
    sourceUpdateId: updateId,
    startDate: today,
    dueDate: formatDueYmd(dueDate),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(updates)
    .set({
      status: "CreatedNewTask",
      updatedAt: now,
    })
    .where(eq(updates.id, updateId));

  await db
    .update(updateAttachments)
    .set({ taskId })
    .where(eq(updateAttachments.updateId, updateId));

  if (band === "high") {
    await db
      .update(updateAiOutputs)
      .set({
        reviewRequired: 0,
        humanReviewRequired: 0,
        reviewStatus: "accepted",
        reviewReasonsJson: "[]",
        reviewFieldsJson: "[]",
        reviewPrompt: null,
        reviewedAt: now,
        reviewedBy: DEMO_TASK_ACTOR_ID,
      })
      .where(eq(updateAiOutputs.updateId, updateId));
  } else {
    const rr = normalizeReviewRequirement({
      requirement: {
        required: true,
        reasons: ["new_task_proposed"],
        fields: ["taskProposal"],
      },
      confidence,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
      taskProposalSuggested: true,
    });
    await db
      .update(updateAiOutputs)
      .set({
        reviewRequired: 1,
        humanReviewRequired: 1,
        reviewStatus: "needs_human_review",
        reviewReasonsJson: JSON.stringify(rr.reasons),
        reviewFieldsJson: JSON.stringify(rr.fields),
        reviewPrompt: rr.prompt ?? null,
        reviewedAt: null,
        reviewedBy: null,
      })
      .where(eq(updateAiOutputs.updateId, updateId));
  }

  await insertAuditEvent(db, {
    eventType: "task.created",
    projectId,
    entityType: "task",
    entityId: taskId,
    payload: {
      sourceUpdateId: updateId,
      source: "voice_update",
      autoFromExtraction: true,
      band,
    },
  });

  return { kind: "created", taskId, band };
}
