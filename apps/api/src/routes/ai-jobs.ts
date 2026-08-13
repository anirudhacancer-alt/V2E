import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import {
  GatewayClient,
  StandupSummaryService,
  ExtractionService,
  StandupSummaryError,
  type AIProcessedOutput,
  type StandupSummaryInput,
} from "@v2e/ai";
import {
  departments,
  departmentStringToCode,
  extractionOwnerRoleToRoleTypeCode,
  locations,
  projects,
  roleTypes,
  sites,
  tasks,
  teamMembers,
  updateAiOutputs,
  updateRiskDownstreamEffects,
  updateRiskRecommendedActions,
  updates,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { insertAuditEvent } from "../lib/audit.js";
import { applyPostExtractionAutoTask } from "../lib/extraction-auto-task.js";
import { opsLog } from "../lib/logger.js";
import {
  AI_GATEWAY_URL,
  LOW_CONFIDENCE_THRESHOLD,
  sqliteFileExists,
  resolveSqlitePath,
} from "../env.js";
import { requireAuth } from "../middleware/auth.js";
import { parseProjectIdFromUnknown, projectIdBodyError, projectScopeMismatchError } from "../lib/project-scope.js";
import { normalizeReviewRequirement } from "@v2e/contracts";
import { deriveSupervisorTaskState } from "../lib/task-state.js";
import {
  standupPrepDateBounds,
  plannedForTodayTasks,
  completedYesterdayTasks,
  type TaskRowForStandup,
} from "../lib/standup-prep-from-tasks.js";
import { assertNoUnresolvedMemberRoles } from "../lib/member-integrity.js";

const aiJobsRouter = new Hono();

const gatewayClient = new GatewayClient({ baseUrl: AI_GATEWAY_URL });
const extractionService = new ExtractionService(gatewayClient);
const standupSummaryService = new StandupSummaryService(gatewayClient);

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

async function loadAiOutputFromDb(
  db: ReturnType<typeof getDemoDb>,
  updateId: string
): Promise<AIProcessedOutput | null> {
  const [row] = await db
    .select()
    .from(updateAiOutputs)
    .where(eq(updateAiOutputs.updateId, updateId));
  if (!row) {
    return null;
  }
  const [ownerRt] = await db
    .select({ name: roleTypes.name })
    .from(roleTypes)
    .where(eq(roleTypes.code, row.ownerRoleCode))
    .limit(1);
  if (!ownerRt) {
    throw new DataIntegrityError(
      "update_ai_outputs.ownerRoleCode not found in role_types",
      { updateId }
    );
  }
  const effects = await db
    .select({ effect: updateRiskDownstreamEffects.effect })
    .from(updateRiskDownstreamEffects)
    .where(eq(updateRiskDownstreamEffects.updateId, updateId))
    .orderBy(updateRiskDownstreamEffects.order);
  const actions = await db
    .select({ action: updateRiskRecommendedActions.action })
    .from(updateRiskRecommendedActions)
    .where(eq(updateRiskRecommendedActions.updateId, updateId))
    .orderBy(updateRiskRecommendedActions.order);
  return {
    extractedInfo: {
      category: row.category as AIProcessedOutput["extractedInfo"]["category"],
      department: row.departmentCode ?? undefined,
      location: row.location ?? undefined,
      vendor: row.vendor ?? undefined,
      severity: row.severity as AIProcessedOutput["extractedInfo"]["severity"],
    },
    suggestedAssignment: {
      ownerRole: ownerRt.name,
      ownerId: row.ownerId ?? undefined,
      dueDate: row.dueDate,
    },
    generatedTaskDescription: row.generatedTaskDescription,
    riskAssessment: {
      impact: row.riskImpact,
      downstreamEffects: effects.map((e) => e.effect),
      scheduleRisk: row.scheduleRisk as AIProcessedOutput["riskAssessment"]["scheduleRisk"],
      recommendedActions: actions.map((a) => a.action),
    },
    confidence: row.confidence,
    reviewRequirement: normalizeReviewRequirement({
      requirement: {
        required: (row.reviewRequired ?? row.humanReviewRequired ?? 0) === 1,
        reasons: parseJsonArray(row.reviewReasonsJson) as AIProcessedOutput["reviewRequirement"]["reasons"],
        fields: parseJsonArray(row.reviewFieldsJson) as AIProcessedOutput["reviewRequirement"]["fields"],
        prompt: row.reviewPrompt ?? undefined,
      },
      confidence: row.confidence,
      lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
      taskProposalSuggested:
        Boolean(row.generatedTaskDescription?.trim()) && !row.reviewedAt,
    }),
  };
}

aiJobsRouter.post("/voice-note-extraction", requireAuth, async (c) => {
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

  const updateId = typeof scopeBody.updateId === "string" ? scopeBody.updateId : undefined;
  if (!updateId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "updateId is required in JSON body" } },
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

  if (!update.transcript || update.transcript.trim().length === 0) {
    return c.json(
      {
        error: {
          code: "NO_TRANSCRIPT",
          message: "Update does not have a transcript to extract from",
          details: { updateId },
        },
      },
      400
    );
  }

  if (idemKey && update.extractIdempotencyKey === idemKey) {
    try {
      const cached = await loadAiOutputFromDb(db, updateId);
      if (cached) {
        opsLog("info", "extract.idempotent_replay", { updateId, projectId });
        const [replayTask] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.sourceUpdateId, updateId))
          .limit(1);
        const autoTaskOutcome = replayTask
          ? ({
              kind: "created" as const,
              taskId: replayTask.id,
              band: "medium" as const,
            })
          : ({ kind: "skipped" as const, reason: "idempotent_replay" });
        return c.json({
          updateId,
          aiOutput: cached,
          modelUsed: "cached",
          processingTimeMs: 0,
          version: 1,
          idempotentReplay: true,
          reviewRequirement: cached.reviewRequirement,
          autoTaskOutcome,
        });
      }
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
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, update.projectId));

  const t0 = Date.now();
  const result = await extractionService.extract({
    updateId,
    transcript: update.transcript,
    projectContext: project
      ? {
          projectId: project.id,
          projectName: project.name,
          departments: [
            "Civil",
            "Structure",
            "MEP",
            "Electrical",
            "Plumbing",
            "Finishing",
            "Steel",
            "Carpentry",
          ],
          locations: ["Floor 1", "Floor 2", "Basement", "Roof", "Exterior"],
        }
      : undefined,
  });

  const aiOutput = result.aiOutput;
  const rawDept = (aiOutput.extractedInfo.department ?? "").trim();
  let deptCode: string | null = null;
  if (rawDept) {
    const mapped = departmentStringToCode(rawDept);
    if (!mapped) {
      return c.json(
        {
          error: {
            code: "EXTRACTION_DEPARTMENT_UNRESOLVED",
            message:
              "Extraction returned a department string that does not map to a canonical departments.code",
            details: { rawDepartment: rawDept },
          },
        },
        400
      );
    }
    const [deptRow] = await db
      .select({ code: departments.code })
      .from(departments)
      .where(eq(departments.code, mapped))
      .limit(1);
    if (!deptRow) {
      throw new DataIntegrityError(
        "mapped departments.code missing from departments table",
        { updateId, mappedDepartmentCode: mapped }
      );
    }
    deptCode = deptRow.code;
  }

  const [loc] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, update.locationId))
    .limit(1);
  if (!loc) {
    throw new DataIntegrityError("updates.locationId not found in locations", {
      updateId,
      locationId: update.locationId,
    });
  }

  const mappedRole = extractionOwnerRoleToRoleTypeCode(
    aiOutput.suggestedAssignment.ownerRole
  );
  if (!mappedRole) {
    return c.json(
      {
        error: {
          code: "EXTRACTION_OWNER_ROLE_UNRESOLVED",
          message:
            "Extraction returned an owner role string that does not map to a canonical role_types.code",
          details: { rawOwnerRole: aiOutput.suggestedAssignment.ownerRole },
        },
      },
      400
    );
  }
  const [roleRow] = await db
    .select({ code: roleTypes.code })
    .from(roleTypes)
    .where(eq(roleTypes.code, mappedRole))
    .limit(1);
  if (!roleRow) {
    throw new DataIntegrityError(
      "mapped owner role code missing from role_types table",
      { updateId, mappedRoleCode: mappedRole }
    );
  }

  const reviewRequirement = normalizeReviewRequirement({
    requirement: aiOutput.reviewRequirement,
    confidence: aiOutput.confidence,
    lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
    taskProposalSuggested: Boolean(
      aiOutput.generatedTaskDescription && aiOutput.generatedTaskDescription.trim().length > 0
    ),
  });
  const reviewReasonsJson = JSON.stringify(reviewRequirement.reasons);
  const reviewFieldsJson = JSON.stringify(reviewRequirement.fields);
  const reviewPrompt = reviewRequirement.prompt ?? null;

  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(updateAiOutputs)
    .where(eq(updateAiOutputs.updateId, updateId))
    .limit(1);
  const aiOutputRowId = existing[0]?.id ?? randomUUID();

  if (existing[0]) {
    await db
      .update(updateAiOutputs)
      .set({
        category: aiOutput.extractedInfo.category,
        departmentCode: deptCode,
        location: aiOutput.extractedInfo.location ?? null,
        locationId: update.locationId,
        blockerSubtype:
          aiOutput.extractedInfo.category === "Blocker"
            ? aiOutput.extractedInfo.vendor ?? null
            : null,
        vendor: aiOutput.extractedInfo.vendor ?? null,
        severity: aiOutput.extractedInfo.severity,
        ownerRoleCode: roleRow.code,
        ownerId: aiOutput.suggestedAssignment.ownerId ?? null,
        dueDate: aiOutput.suggestedAssignment.dueDate,
        generatedTaskDescription: aiOutput.generatedTaskDescription,
        riskImpact: aiOutput.riskAssessment.impact,
        scheduleRisk: aiOutput.riskAssessment.scheduleRisk,
        confidence: aiOutput.confidence,
        reviewRequired: reviewRequirement.required ? 1 : 0,
        reviewPrompt,
        reviewReasonsJson,
        reviewFieldsJson,
        humanReviewRequired: reviewRequirement.reasons.includes("low_confidence_extraction") ? 1 : 0,
        reviewStatus: reviewRequirement.required ? "pending" : "accepted",
        reviewedAt: null,
        reviewedBy: null,
        suggestedSnapshotJson: null,
      })
      .where(eq(updateAiOutputs.updateId, updateId));

    await db
      .delete(updateRiskDownstreamEffects)
      .where(eq(updateRiskDownstreamEffects.updateId, updateId));
    await db
      .delete(updateRiskRecommendedActions)
      .where(eq(updateRiskRecommendedActions.updateId, updateId));
  } else {
    await db.insert(updateAiOutputs).values({
      id: aiOutputRowId,
      updateId,
      category: aiOutput.extractedInfo.category,
      departmentCode: deptCode,
      location: aiOutput.extractedInfo.location ?? null,
      locationId: update.locationId,
      blockerSubtype:
        aiOutput.extractedInfo.category === "Blocker"
          ? aiOutput.extractedInfo.vendor ?? null
          : null,
      vendor: aiOutput.extractedInfo.vendor ?? null,
      severity: aiOutput.extractedInfo.severity,
      ownerRoleCode: roleRow.code,
      ownerId: aiOutput.suggestedAssignment.ownerId ?? null,
      dueDate: aiOutput.suggestedAssignment.dueDate,
      generatedTaskDescription: aiOutput.generatedTaskDescription,
      riskImpact: aiOutput.riskAssessment.impact,
      scheduleRisk: aiOutput.riskAssessment.scheduleRisk,
      confidence: aiOutput.confidence,
      reviewRequired: reviewRequirement.required ? 1 : 0,
      reviewPrompt,
      reviewReasonsJson,
      reviewFieldsJson,
      humanReviewRequired: reviewRequirement.reasons.includes("low_confidence_extraction") ? 1 : 0,
      reviewStatus: reviewRequirement.required ? "pending" : "accepted",
      reviewedAt: null,
      reviewedBy: null,
      suggestedSnapshotJson: null,
    });
  }

  if (aiOutput.riskAssessment.downstreamEffects.length > 0) {
    await db.insert(updateRiskDownstreamEffects).values(
      aiOutput.riskAssessment.downstreamEffects.map((effect, index) => ({
        updateId,
        order: index,
        effect,
      }))
    );
  }
  if (aiOutput.riskAssessment.recommendedActions.length > 0) {
    await db.insert(updateRiskRecommendedActions).values(
      aiOutput.riskAssessment.recommendedActions.map((action, index) => ({
        updateId,
        order: index,
        action,
      }))
    );
  }

  await db
    .update(updates)
    .set({
      updatedAt: now,
      extractIdempotencyKey: idemKey ?? update.extractIdempotencyKey,
    })
    .where(eq(updates.id, updateId));

  const autoTaskOutcome = await applyPostExtractionAutoTask(db, {
    updateId,
    projectId,
    siteId: update.siteId,
    confidence: aiOutput.confidence,
    departmentCode: deptCode,
    ownerRoleCode: roleRow.code,
    ownerId: aiOutput.suggestedAssignment.ownerId ?? null,
    generatedTaskDescription: aiOutput.generatedTaskDescription,
    extractionSeverity: aiOutput.extractedInfo.severity,
    dueDate: aiOutput.suggestedAssignment.dueDate,
    locationId: update.locationId,
  });

  opsLog("info", "extract.success", {
    updateId,
    projectId,
    processingTimeMs: Date.now() - t0,
    modelUsed: result.modelUsed,
  });

  await insertAuditEvent(db, {
    eventType: "update.extract_completed",
    projectId,
    entityType: "update",
    entityId: updateId,
    payload: {
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
      autoTaskOutcome,
    },
  });

  return c.json({
    updateId,
    aiOutput,
    modelUsed: result.modelUsed,
    processingTimeMs: result.processingTimeMs,
    version: 1,
    reviewRequirement,
    autoTaskOutcome,
  });
});

aiJobsRouter.post("/standup-summary", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  let body: { projectId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
      400
    );
  }

  const projectId = body.projectId;
  if (!projectId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "projectId is required in request body",
        },
      },
      400
    );
  }

  const db = getDemoDb();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) {
    return c.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, 404);
  }

  const { todayYmd, yesterdayYmd } = standupPrepDateBounds();
  const standupDateIso = `${todayYmd}T12:00:00.000Z`;

  const [site] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, project.siteId));

  if (!site) {
    throw new DataIntegrityError("project references missing site row", {
      projectId,
      siteId: project.siteId,
    });
  }

  await assertNoUnresolvedMemberRoles(db, site.id, { projectId });

  const siteMembers = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      orgRoleCode: teamMembers.orgRoleCode,
      roleTypeName: roleTypes.name,
      isActive: teamMembers.isActive,
    })
    .from(teamMembers)
    .innerJoin(roleTypes, eq(teamMembers.orgRoleCode, roleTypes.code))
    .where(eq(teamMembers.siteId, site.id));

  const members = siteMembers.filter((m) => m.isActive === "true");
  const attendancePresent = members.length;
  const attendanceTotal = members.length;

  const projectTaskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      ownerId: tasks.ownerId,
      severity: tasks.severity,
      location: tasks.location,
      departmentCode: tasks.departmentCode,
      status: tasks.status,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const taskRowsFor: TaskRowForStandup[] = projectTaskRows.map((t) => ({
    id: t.id,
    projectId,
    title: t.title,
    description: t.description,
    ownerId: t.ownerId,
    severity: t.severity,
    department: t.departmentCode ?? null,
    location: t.location,
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.completedAt ?? null,
  }));

  const planned = plannedForTodayTasks(taskRowsFor, projectId, todayYmd);
  const completed = completedYesterdayTasks(
    taskRowsFor,
    projectId,
    yesterdayYmd,
  );
  const blocked = projectTaskRows.filter(
    (t) => deriveSupervisorTaskState(t) === "Blocked",
  );

  const summaryInput: StandupSummaryInput = {
    projectName: project.name,
    standupDate: standupDateIso,
    attendancePresent,
    attendanceTotal,
    completedItems: completed.map((item) => ({
      description: item.title,
      location: item.location ?? undefined,
    })),
    blockedItems: blocked.map((task) => ({
      description: task.title,
      severity: task.severity,
      blockerReason: task.description ?? undefined,
    })),
    plannedItems: planned.map((item) => ({
      description: item.title,
      location: item.location ?? undefined,
      department: item.department ?? undefined,
    })),
  };

  try {
    const result = await standupSummaryService.summarize(summaryInput);
    return c.json({
      projectId,
      summaryText: result.summaryText,
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Standup summary generation failed";
    const code =
      error instanceof StandupSummaryError ? error.code : "STANDUP_SUMMARY_FAILED";
    const httpStatus: 502 | 503 =
      error instanceof StandupSummaryError && error.statusCode === 503
        ? 503
        : 502;
    opsLog("error", "standup_summary_failed", { code, message });
    return c.json(
      {
        error: {
          code,
          message,
          details:
            error instanceof StandupSummaryError ? error.details : undefined,
        },
      },
      httpStatus,
    );
  }
});

export { aiJobsRouter };
