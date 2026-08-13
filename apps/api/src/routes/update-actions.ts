/**
 * Update routes
 *
 * CRUD-adjacent update handlers: list/detail/patch plus update-scoped commands
 * such as transcription, review confirmation, and escalation.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  TranscriptionService,
  GatewayClient,
  TranscriptionError,
  type AIProcessedOutput,
} from "@v2e/ai";
import {
  updates,
  updateAiOutputs,
  updateRiskDownstreamEffects,
  updateRiskRecommendedActions,
  updateAttachments,
  tasks,
  roleTypes,
  locations,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { resolvePersonName } from "../lib/resolve-person.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import {
  parseProjectIdFromUnknown,
  projectIdBodyError,
  projectScopeMismatchError,
} from "../lib/project-scope.js";
import { normalizeReviewRequirement } from "@v2e/contracts";
import {
  resolveSqlitePath,
  sqliteFileExists,
  AI_GATEWAY_URL,
  LOW_CONFIDENCE_THRESHOLD,
} from "../env.js";
import { localUploadExists } from "../lib/local-upload-files.js";
import { resolveAbsoluteAudioUrlForFetch } from "../lib/resolve-upload-url.js";
import { requireAuth } from "../middleware/auth.js";
import { handleSupervisorUpdatesList } from "../lib/supervisor-updates-list.js";

const updateActionsRouter = new Hono();

// Initialize AI services with custom gateway URL
const gatewayClient = new GatewayClient({ baseUrl: AI_GATEWAY_URL });
const transcriptionService = new TranscriptionService(gatewayClient);

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function getIdempotencyKey(c: Context): string | undefined {
  return c.req.header("Idempotency-Key") ?? c.req.header("idempotency-key") ?? undefined;
}

function dbNotReady(c: Context) {
  const sqlitePath = resolveSqlitePath();
  return c.json(
    {
      error: {
        code: "DB_NOT_FOUND",
        message:
          "Demo SQLite file is missing. Seed it from the repo root: pnpm --filter @v2e/database db:seed",
        details: { path: sqlitePath },
      },
    },
    503
  );
}

/**
 * GET /v1/updates
 *
 * Supervisor list read model — **`projectId` query required** (field app).
 */
updateActionsRouter.get("/", async (c) => handleSupervisorUpdatesList(c));

/**
 * POST /v1/updates/:updateId/transcribe
 *
 * Triggers transcription for an update's audio file.
 * Requires the update to have an audioUrl set.
 */
updateActionsRouter.post("/:updateId/transcribe", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let scopeBody: Record<string, unknown> = {};
  try {
    scopeBody = (await c.req.json()) as Record<string, unknown>;
  } catch {
    /* empty body allowed */
  }
  const projectId = parseProjectIdFromUnknown(scopeBody);
  if (!projectId) {
    return projectIdBodyError(c);
  }

  const updateId = c.req.param("updateId");
  if (!updateId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "updateId is required in path" } },
      400
    );
  }
  const idemKey = getIdempotencyKey(c);
  const db = getDemoDb();

  const [update] = await db
    .select()
    .from(updates)
    .where(eq(updates.id, updateId));

  if (!update) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Update not found",
          details: { updateId },
        },
      },
      404
    );
  }

  if (update.projectId !== projectId) {
    return projectScopeMismatchError(c, { updateId, expectedProjectId: projectId });
  }

  if (
    idemKey &&
    update.transcribeIdempotencyKey === idemKey &&
    update.transcript?.trim()
  ) {
    opsLog("info", "transcribe.idempotent_replay", { updateId, projectId });
    return c.json({
      updateId,
      transcript: update.transcript,
      language: "en",
      duration: undefined,
      modelUsed: "cached",
      processingTimeMs: 0,
      idempotentReplay: true,
    });
  }

  if (!update.audioUrl) {
    return c.json(
      {
        error: {
          code: "NO_AUDIO",
          message: "Update does not have an audio file to transcribe",
          details: { updateId },
        },
      },
      400
    );
  }

  const t0 = Date.now();
  try {
    const audioFetchUrl = resolveAbsoluteAudioUrlForFetch(update.audioUrl);
    if (!audioFetchUrl) {
      return c.json(
        {
          error: {
            code: "NO_AUDIO",
            message: "Update does not have a resolvable audio URL for transcription",
            details: { updateId },
          },
        },
        400
      );
    }

    const result = await transcriptionService.transcribe({
      audioUrl: audioFetchUrl,
      language: "en",
    });

    const now = new Date().toISOString();
    await db
      .update(updates)
      .set({
        transcript: result.text,
        updatedAt: now,
        transcribeIdempotencyKey: idemKey ?? update.transcribeIdempotencyKey,
      })
      .where(eq(updates.id, updateId));

    opsLog("info", "transcribe.success", {
      updateId,
      projectId,
      processingTimeMs: Date.now() - t0,
      modelUsed: result.modelUsed,
    });
    await insertAuditEvent(db, {
      eventType: "update.transcribe_completed",
      projectId,
      entityType: "update",
      entityId: updateId,
      payload: {
        modelUsed: result.modelUsed,
        processingTimeMs: result.processingTimeMs,
      },
    });

    return c.json({
      updateId,
      transcript: result.text,
      language: result.language,
      duration: result.duration,
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    opsLog("error", "transcribe.failed", {
      updateId,
      projectId,
      message: (error as Error).message,
    });
    await insertAuditEvent(db, {
      eventType: "update.transcribe_failed",
      projectId,
      entityType: "update",
      entityId: updateId,
      payload: { message: (error as Error).message },
    }).catch(() => {});

    if (error instanceof TranscriptionError) {
      const statusCode = (error.statusCode || 500) as 400 | 404 | 500 | 503;
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        statusCode
      );
    }

    return c.json(
      {
        error: {
          code: "TRANSCRIPTION_FAILED",
          message: (error as Error).message || "Transcription failed",
        },
      },
      500
    );
  }
});

async function confirmUpdateReview(c: Context) {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json(
      { error: { code: "INVALID_JSON", message: "JSON body required" } },
      400
    );
  }

  const projectId = parseProjectIdFromUnknown(body);
  if (!projectId) {
    return projectIdBodyError(c);
  }

  const updateId = c.req.param("updateId");
  if (!updateId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "updateId is required in path" } },
      400
    );
  }
  const db = getDemoDb();

  const [update] = await db
    .select()
    .from(updates)
    .where(eq(updates.id, updateId));

  if (!update) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Update not found", details: { updateId } } },
      404
    );
  }

  if (update.projectId !== projectId) {
    return projectScopeMismatchError(c, { updateId, expectedProjectId: projectId });
  }

  let reviewedBy: string | undefined;
  if (typeof body.reviewedBy === "string") {
    reviewedBy = body.reviewedBy;
  }

  const [row] = await db
    .select({ updateId: updateAiOutputs.updateId })
    .from(updateAiOutputs)
    .where(eq(updateAiOutputs.updateId, updateId));

  if (!row) {
    return c.json(
      {
        error: {
          code: "NO_AI_OUTPUT",
          message: "No extraction output exists for this update yet",
          details: { updateId },
        },
      },
      404
    );
  }

  const now = new Date().toISOString();
  await db
    .update(updateAiOutputs)
    .set({
      reviewRequired: 0,
      humanReviewRequired: 0,
      reviewStatus: "accepted",
      reviewedAt: now,
      reviewedBy: reviewedBy ?? null,
    })
    .where(eq(updateAiOutputs.updateId, updateId));

  await db
    .update(updates)
    .set({ needsReview: 0, updatedAt: now })
    .where(eq(updates.id, updateId));

  await insertAuditEvent(db, {
    eventType: "update.extraction_review_confirmed",
    projectId,
    entityType: "update",
    entityId: updateId,
    payload: { reviewedBy: reviewedBy ?? null },
  });

  return c.json({ updateId, reviewedAt: now, reviewedBy: reviewedBy ?? null });
}

/**
 * POST /v1/updates/:updateId/confirm-review
 *
 * Called when a human approves an update's extraction outcome
 * where generating a task is NOT suggested or recommended.
 * It acknowledges the read, transitions status to 'Processed',
 * and creates an audit event.
 */
updateActionsRouter.post("/:updateId/confirm-review", requireAuth, confirmUpdateReview);

/**
 * POST /v1/updates/:updateId/escalate
 *
 * Marks an update as escalated for supervisor / PM follow-up.
 * Body: { projectId }
 */
updateActionsRouter.post("/:updateId/escalate", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json(
      { error: { code: "INVALID_JSON", message: "JSON body required" } },
      400
    );
  }
  const projectId = parseProjectIdFromUnknown(body);
  if (!projectId) {
    return projectIdBodyError(c);
  }

  const updateId = c.req.param("updateId");
  if (!updateId) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "updateId is required in path" } }, 400);
  }
  const db = getDemoDb();

  const [update] = await db.select().from(updates).where(eq(updates.id, updateId));

  if (!update) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Update not found", details: { updateId } } },
      404
    );
  }

  if (update.projectId !== projectId) {
    return projectScopeMismatchError(c, { updateId, expectedProjectId: projectId });
  }

  const now = new Date().toISOString();

  if (update.status === "Escalated") {
    return c.json({
      updateId,
      status: "Escalated",
      updatedAt: update.updatedAt,
      alreadyEscalated: true,
    });
  }

  await db
    .update(updates)
    .set({
      status: "Escalated",
      updatedAt: now,
    })
    .where(eq(updates.id, updateId));

  opsLog("info", "update.escalated", { updateId, projectId });

  await insertAuditEvent(db, {
    eventType: "update.escalated",
    projectId,
    entityType: "update",
    entityId: updateId,
    payload: {},
  });

  return c.json({
    updateId,
    status: "Escalated",
    updatedAt: now,
    alreadyEscalated: false,
  });
});

/**
 * GET /v1/updates/:updateId
 *
 * Retrieves a single update by ID with all related data including AI output.
 * The updateId uniquely identifies the resource - no projectId needed.
 */
updateActionsRouter.get("/:updateId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const updateId = c.req.param("updateId");
  const db = getDemoDb();

  try {
  const [update] = await db.select().from(updates).where(eq(updates.id, updateId));

  if (!update) {
    return c.json({ error: { code: "NOT_FOUND", message: "Update not found" } }, 404);
  }

  const recordedByName = await resolvePersonName(db, update.recordedBy);

  // Get AI output if exists
  const [aiOutput] = await db
    .select()
    .from(updateAiOutputs)
    .where(eq(updateAiOutputs.updateId, update.id));

  const attachmentRows = await db
    .select({
      id: updateAttachments.id,
      url: updateAttachments.url,
      type: updateAttachments.type,
    })
    .from(updateAttachments)
    .where(eq(updateAttachments.updateId, update.id));
  const visibleAttachmentRows = attachmentRows.filter(
    (attachment) =>
      !attachment.url.startsWith("/uploads/") || localUploadExists(attachment.url)
  );

  // Get downstream effects and recommended actions if AI output exists
  let downstreamEffects: string[] = [];
  let recommendedActions: string[] = [];

  if (aiOutput) {
    const effects = await db
      .select({ effect: updateRiskDownstreamEffects.effect })
      .from(updateRiskDownstreamEffects)
      .where(eq(updateRiskDownstreamEffects.updateId, updateId))
      .orderBy(updateRiskDownstreamEffects.order);
    downstreamEffects = effects.map((e) => e.effect);

    const actions = await db
      .select({ action: updateRiskRecommendedActions.action })
      .from(updateRiskRecommendedActions)
      .where(eq(updateRiskRecommendedActions.updateId, updateId))
      .orderBy(updateRiskRecommendedActions.order);
    recommendedActions = actions.map((a) => a.action);
  }

  const reviewRequirement = aiOutput
    ? normalizeReviewRequirement({
        requirement: {
          required: (aiOutput.reviewRequired ?? aiOutput.humanReviewRequired ?? 0) === 1,
          reasons: parseJsonArray(aiOutput.reviewReasonsJson) as AIProcessedOutput["reviewRequirement"]["reasons"],
          fields: parseJsonArray(aiOutput.reviewFieldsJson) as AIProcessedOutput["reviewRequirement"]["fields"],
          prompt: aiOutput.reviewPrompt ?? undefined,
        },
        confidence: aiOutput.confidence,
        lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
        taskProposalSuggested:
          Boolean(aiOutput.generatedTaskDescription?.trim()) && !aiOutput.reviewedAt,
      })
    : null;

  let aiAssigneeRoleName: string | null = null;
  if (aiOutput) {
    const [ort] = await db
      .select({ name: roleTypes.name })
      .from(roleTypes)
      .where(eq(roleTypes.code, aiOutput.ownerRoleCode))
      .limit(1);
    if (!ort) {
      throw new DataIntegrityError(
        "update_ai_outputs.ownerRoleCode not found in role_types",
        { updateId }
      );
    }
    aiAssigneeRoleName = ort.name;
  }

  const [sourceTaskRow] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.sourceUpdateId, updateId))
    .limit(1);

  return c.json({
    id: update.id,
    siteId: update.siteId,
    projectId: update.projectId,
    locationId: update.locationId,
    sourceType: update.sourceType,
    needsReview: update.needsReview === 1,
    transcript: update.transcript,
    audioUrl: update.audioUrl,
    audioDuration: update.audioDuration ? parseInt(update.audioDuration, 10) : null,
    category: aiOutput?.category || null,
    location: aiOutput?.location || null,
    severity: aiOutput?.severity || null,
    departmentCode: aiOutput?.departmentCode ?? null,
    status: update.status,
    recordedBy: update.recordedBy,
    recordedByName,
    isRead: (update.isRead ?? 0) === 1,
    readAt: update.readAt ?? null,
    hasAudio: !!update.audioUrl,
    hasAttachments: visibleAttachmentRows.length > 0,
    attachmentCount: visibleAttachmentRows.length,
    attachments: visibleAttachmentRows,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    sourceTaskId: sourceTaskRow?.id ?? null,
    aiOutput: aiOutput
      ? {
          id: aiOutput.id,
          category: aiOutput.category,
          departmentCode: aiOutput.departmentCode,
          location: aiOutput.location,
          blockerSubtype: aiOutput.blockerSubtype ?? null,
          locationBlock: aiOutput.locationBlock ?? null,
          locationZone: aiOutput.locationZone ?? null,
          locationLevel: aiOutput.locationLevel ?? null,
          locationArea: aiOutput.locationArea ?? null,
          vendor: aiOutput.vendor,
          severity: aiOutput.severity,
          assigneeRoleCode: aiOutput.ownerRoleCode,
          assigneeRoleName: aiAssigneeRoleName,
          ownerId: aiOutput.ownerId,
          dueDate: aiOutput.dueDate,
          generatedTaskDescription: aiOutput.generatedTaskDescription,
          riskImpact: aiOutput.riskImpact,
          scheduleRisk: aiOutput.scheduleRisk,
          confidence: aiOutput.confidence,
          downstreamEffects,
          recommendedActions,
          reviewRequirement,
          reviewStatus: aiOutput.reviewStatus,
          reviewedAt: aiOutput.reviewedAt ?? null,
          reviewedBy: aiOutput.reviewedBy ?? null,
          lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
        }
      : null,
  });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return c.json(
        {
          error: {
            code: e.code,
            message: e.message,
            details: e.details ?? {},
          },
        },
        500
      );
    }
    throw e;
  }
});

/**
 * PATCH /v1/updates/:updateId
 *
 * Updates transcript and/or marks the update as read (supervisor workflow).
 * Body: JSON with `transcript`, `markAsRead`, and/or `locationId`.
 * The updateId uniquely identifies the resource - no projectId needed.
 */
updateActionsRouter.patch("/:updateId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      400
    );
  }

  const updateId = c.req.param("updateId");
  const db = getDemoDb();

  // Get the update
  const [update] = await db.select().from(updates).where(eq(updates.id, updateId));

  if (!update) {
    return c.json({ error: { code: "NOT_FOUND", message: "Update not found" } }, 404);
  }

  const body = {
    transcript: typeof raw.transcript === "string" ? raw.transcript : undefined,
    markAsRead: raw.markAsRead === true,
    locationId: typeof raw.locationId === "string" ? raw.locationId : undefined,
  };

  if (
    body.transcript === undefined &&
    body.markAsRead !== true &&
    body.locationId === undefined
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide transcript, markAsRead: true, and/or locationId",
        },
      },
      400
    );
  }

  const now = new Date().toISOString();
  const patch: {
    transcript?: string;
    updatedAt: string;
    isRead?: number;
    readAt?: string | null;
    locationId?: string;
  } = { updatedAt: now };

  if (body.transcript !== undefined) {
    patch.transcript = body.transcript;
  }
  if (body.markAsRead === true) {
    patch.isRead = 1;
    patch.readAt = now;
  }

  if (body.locationId !== undefined) {
    const [loc] = await db
      .select({ id: locations.id, displayLabel: locations.displayLabel })
      .from(locations)
      .where(
        and(eq(locations.id, body.locationId), eq(locations.projectId, update.projectId)),
      );
    if (!loc) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid or out-of-project locationId",
            details: { locationId: body.locationId, projectId: update.projectId },
          },
        },
        400
      );
    }
    patch.locationId = loc.id;
    const [aiRow] = await db
      .select()
      .from(updateAiOutputs)
      .where(eq(updateAiOutputs.updateId, updateId));
    if (aiRow) {
      await db
        .update(updateAiOutputs)
        .set({
          locationId: loc.id,
          location: loc.displayLabel,
        })
        .where(eq(updateAiOutputs.updateId, updateId));
    }
  }

  await db.update(updates).set(patch).where(eq(updates.id, updateId));

  if (body.transcript !== undefined) {
    await insertAuditEvent(db, {
      eventType: "update.transcript_patched",
      projectId: update.projectId,
      entityType: "update",
      entityId: updateId,
      payload: { transcriptLength: body.transcript.length },
    });
  }
  if (body.markAsRead === true) {
    await insertAuditEvent(db, {
      eventType: "update.marked_read",
      projectId: update.projectId,
      entityType: "update",
      entityId: updateId,
      payload: {},
    });
  }
  if (body.locationId !== undefined) {
    await insertAuditEvent(db, {
      eventType: "update.location_patched",
      projectId: update.projectId,
      entityType: "update",
      entityId: updateId,
      payload: { locationId: body.locationId },
    });
  }

  const [next] = await db.select().from(updates).where(eq(updates.id, updateId));

  return c.json({
    id: updateId,
    transcript: next?.transcript ?? update.transcript,
    updatedAt: next?.updatedAt ?? now,
    isRead: (next?.isRead ?? 0) === 1,
    readAt: next?.readAt ?? null,
    locationId: next?.locationId ?? update.locationId,
  });
});

export { updateActionsRouter };
