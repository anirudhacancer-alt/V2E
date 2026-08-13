/**
 * Supervisor updates list for `GET /v1/updates?projectId=…` (field-app read model).
 */

import {
  and,
  count,
  eq,
  gte,
  inArray,
  lte,
  ne,
  not,
  sql,
} from "drizzle-orm";
import type { Context } from "hono";
import {
  locations,
  tasks,
  updateAiOutputs,
  updateAttachments,
  updates,
} from "@v2e/database";
import { normalizeReviewRequirement } from "@v2e/contracts";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "./data-integrity.js";
import { resolvePersonNameAndRole } from "./resolve-person.js";
import { opsLog } from "./logger.js";
import { resolveSqlitePath, sqliteFileExists, LOW_CONFIDENCE_THRESHOLD } from "../env.js";
import {
  parseRequiredProjectIdQuery,
  projectIdQueryError,
} from "./project-scope.js";

function integrityErrorResponse(c: Context, e: DataIntegrityError) {
  opsLog("error", "data_integrity", {
    message: e.message,
    details: e.details,
  });
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

function formatLocationHierarchy(parts: {
  block: string | null;
  zone: string | null;
  level: string | null;
  area: string | null;
}): string | undefined {
  const segs = [parts.block, parts.zone, parts.level, parts.area].filter(
    (s): s is string => !!s && s.trim().length > 0
  );
  if (segs.length === 0) return undefined;
  return segs.join(" · ");
}

function updateNextActionHint(
  status: string,
  linked: { id: string } | undefined
): string {
  if (status === "Escalated") return "Escalated — review";
  if (status === "CreatedNewTask" && linked) return "Open linked task";
  if (linked) return "View linked task";
  if (status === "Pending") return "Review update";
  if (status === "Processed") return "Review update";
  if (status === "Saved") return "Review update";
  return "Review update";
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

type NoteState = "Review" | "Linked" | "Escalated";

function deriveNoteState(
  status: string,
  updateCreatedAt: string,
  humanLinkedTask: { createdAt: string } | undefined
): NoteState {
  if (status === "Escalated") return "Escalated";
  if (
    humanLinkedTask &&
    humanLinkedTask.createdAt.localeCompare(updateCreatedAt) < 0
  ) {
    return "Linked";
  }
  return "Review";
}

/**
 * `GET /v1/updates` list for supervisor UI — requires `projectId` query.
 */
export async function handleSupervisorUpdatesList(c: Context) {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const projectId = parseRequiredProjectIdQuery(c);
  if (!projectId) {
    return projectIdQueryError(c);
  }

  const page = parseInt(c.req.query("page") || "1", 10);
  const pageSize = Math.min(parseInt(c.req.query("pageSize") || "20", 10), 100);
  const status = c.req.query("status");
  const noteState = c.req.query("noteState") as NoteState | undefined;
  const updatedAfter = c.req.query("updatedAfter");
  const updatedBefore = c.req.query("updatedBefore");

  const db = getDemoDb();

  try {
    const linkedToExistingTask = sql`(
    ${updates.linkedTaskId} IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM ${tasks}
      WHERE ${tasks.id} = ${updates.linkedTaskId}
      AND ${tasks.createdAt} < ${updates.createdAt}
    )
  )`;

    const updateConditions = [eq(updates.projectId, projectId)];
    if (noteState === "Escalated") {
      updateConditions.push(eq(updates.status, "Escalated"));
    } else if (noteState === "Linked") {
      updateConditions.push(ne(updates.status, "Escalated"));
      updateConditions.push(linkedToExistingTask);
    } else if (noteState === "Review") {
      updateConditions.push(ne(updates.status, "Escalated"));
      updateConditions.push(not(linkedToExistingTask));
    } else if (status) {
      updateConditions.push(eq(updates.status, status));
    }
    if (!noteState && !status && updatedAfter && updatedBefore) {
      updateConditions.push(gte(updates.updatedAt, updatedAfter));
      updateConditions.push(lte(updates.updatedAt, updatedBefore));
    }
    const whereClause = and(...updateConditions);

    const [totalResult] = await db
      .select({ n: count() })
      .from(updates)
      .where(whereClause);
    const total = totalResult?.n || 0;

    const offset = (page - 1) * pageSize;
    const updateList = await db
      .select()
      .from(updates)
      .where(whereClause)
      .orderBy(sql`${updates.updatedAt} DESC`)
      .limit(pageSize)
      .offset(offset);

    const updateIds = updateList.map((u) => u.id);
    const linkedTaskRows =
      updateIds.length === 0
        ? []
        : await db
            .select({
              id: tasks.id,
              title: tasks.title,
              status: tasks.status,
              sourceUpdateId: tasks.sourceUpdateId,
              createdAt: tasks.createdAt,
            })
            .from(tasks)
            .where(inArray(tasks.sourceUpdateId, updateIds));
    const linkedByUpdateId = new Map(
      linkedTaskRows
        .filter((t): t is typeof t & { sourceUpdateId: string } => !!t.sourceUpdateId)
        .map((t) => [t.sourceUpdateId, t])
    );

    const linkedTaskIdsFromColumn = updateList
      .map((u) => u.linkedTaskId)
      .filter((id): id is string => !!id);
    const linkedViaColumnRows =
      linkedTaskIdsFromColumn.length === 0
        ? []
        : await db
            .select({
              id: tasks.id,
              title: tasks.title,
              status: tasks.status,
              sourceUpdateId: tasks.sourceUpdateId,
              createdAt: tasks.createdAt,
            })
            .from(tasks)
            .where(inArray(tasks.id, linkedTaskIdsFromColumn));
    const linkedTaskById = new Map(linkedViaColumnRows.map((t) => [t.id, t]));

    const aiOutputRows =
      updateIds.length === 0
        ? []
        : await db
            .select()
            .from(updateAiOutputs)
            .where(inArray(updateAiOutputs.updateId, updateIds));
    const aiByUpdateId = new Map(aiOutputRows.map((a) => [a.updateId, a]));

    const updateLocationIds = [...new Set(updateList.map((u) => u.locationId))];
    const listLabelByLocationId = new Map<string, string>();
    if (updateLocationIds.length > 0) {
      const locRows = await db
        .select({ id: locations.id, listLabel: locations.listLabel })
        .from(locations)
        .where(
          and(
            eq(locations.projectId, projectId),
            inArray(locations.id, updateLocationIds)
          )
        );
      for (const r of locRows) {
        listLabelByLocationId.set(r.id, r.listLabel);
      }
    }

    const items = await Promise.all(
      updateList.map(async (u) => {
        const person = await resolvePersonNameAndRole(db, u.recordedBy);

        const aiOutput = aiByUpdateId.get(u.id);

        const [attachCount] = await db
          .select({ n: count() })
          .from(updateAttachments)
          .where(eq(updateAttachments.updateId, u.id));

        const fromColumn = u.linkedTaskId
          ? linkedTaskById.get(u.linkedTaskId)
          : undefined;
        const linked = fromColumn ?? linkedByUpdateId.get(u.id);
        const readFlag = u.isRead ?? 0;
        const hierarchy = formatLocationHierarchy({
          block: aiOutput?.locationBlock ?? null,
          zone: aiOutput?.locationZone ?? null,
          level: aiOutput?.locationLevel ?? null,
          area: aiOutput?.locationArea ?? null,
        });

        const fromMaster = listLabelByLocationId.get(u.locationId);
        if (!fromMaster?.trim()) {
          throw new DataIntegrityError(
            "update.locationId has no non-empty locations.listLabel for this project",
            { updateId: u.id, locationId: u.locationId, projectId }
          );
        }
        const locationList = fromMaster.trim();

        const noteStateValue = deriveNoteState(
          u.status,
          u.createdAt,
          u.linkedTaskId && fromColumn
            ? { createdAt: fromColumn.createdAt }
            : undefined
        );
        const reviewRequirement = aiOutput
          ? normalizeReviewRequirement({
              requirement: {
                required:
                  (aiOutput.reviewRequired ?? aiOutput.humanReviewRequired ?? 0) === 1,
                reasons: parseJsonArray(aiOutput.reviewReasonsJson) as ReturnType<
                  typeof normalizeReviewRequirement
                >["reasons"],
                fields: parseJsonArray(aiOutput.reviewFieldsJson) as ReturnType<
                  typeof normalizeReviewRequirement
                >["fields"],
                prompt: aiOutput.reviewPrompt ?? undefined,
              },
              confidence: aiOutput.confidence,
              lowConfidenceThreshold: LOW_CONFIDENCE_THRESHOLD,
              taskProposalSuggested:
                Boolean(aiOutput.generatedTaskDescription?.trim()) && !aiOutput.reviewedAt,
            })
          : null;

        return {
          id: u.id,
          transcript: u.transcript,
          category: aiOutput?.category || null,
          location: aiOutput?.location || null,
          severity: aiOutput?.severity || null,
          status: u.status,
          noteState: noteStateValue,
          recordedByName: person.name,
          recordedByRole: person.role,
          hasAudio: !!u.audioUrl,
          hasAttachments: (attachCount?.n || 0) > 0,
          attachmentCount: attachCount?.n || 0,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          isUnread: readFlag === 0,
          blockerSubtype: aiOutput?.blockerSubtype ?? null,
          locationHierarchy: hierarchy,
          locationList,
          linkedTaskId: linked?.id ?? null,
          linkedTaskTitle: linked?.title ?? null,
          linkedTaskStatus: linked?.status ?? null,
          reviewPrompt:
            noteStateValue === "Review" ? reviewRequirement?.prompt ?? null : null,
          reviewReasons:
            noteStateValue === "Review" ? reviewRequirement?.reasons ?? [] : [],
          nextActionHint: updateNextActionHint(u.status, linked),
        };
      })
    );

    return c.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    if (isDataIntegrityError(e)) {
      return integrityErrorResponse(c, e);
    }
    throw e;
  }
}
