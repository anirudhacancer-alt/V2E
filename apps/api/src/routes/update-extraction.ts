import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { updateAiOutputs } from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

const updateExtractionRouter = new Hono();

function integrityErrorResponse(c: Context, e: DataIntegrityError) {
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

function serializeAiOutput(row: typeof updateAiOutputs.$inferSelect) {
  return {
    ...row,
    reviewRequired: row.reviewRequired === 1,
    humanReviewRequired: row.humanReviewRequired === 1,
  };
}

/**
 * GET /v1/updates/:updateId/extraction
 * Get AI extraction by update id.
 */
updateExtractionRouter.get("/:updateId/extraction", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const updateId = c.req.param("updateId");
  const db = getDemoDb();

  try {
    const [aiOutput] = await db
      .select()
      .from(updateAiOutputs)
      .where(eq(updateAiOutputs.updateId, updateId));

    if (!aiOutput) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Extraction not found",
            details: { updateId },
          },
        },
        404
      );
    }

    return c.json(serializeAiOutput(aiOutput));
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * PATCH /v1/updates/:updateId/extraction
 * Patch extraction review fields by update id.
 */
updateExtractionRouter.patch("/:updateId/extraction", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const updateId = c.req.param("updateId");
  const db = getDemoDb();

  let body: {
    reviewStatus?: "pending" | "accepted" | "rejected" | "needs_human_review" | "superseded";
    reviewedAt?: string;
    reviewedBy?: string;
    humanReviewRequired?: boolean;
    reviewRequired?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON",
        },
      },
      400
    );
  }

  try {
    const [existing] = await db
      .select()
      .from(updateAiOutputs)
      .where(eq(updateAiOutputs.updateId, updateId));

    if (!existing) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Extraction not found",
            details: { updateId },
          },
        },
        404
      );
    }

    const patch: Partial<typeof updateAiOutputs.$inferInsert> = {};

    if (body.reviewStatus !== undefined) patch.reviewStatus = body.reviewStatus;
    if (body.reviewedAt !== undefined) patch.reviewedAt = body.reviewedAt;
    if (body.reviewedBy !== undefined) patch.reviewedBy = body.reviewedBy;
    if (body.humanReviewRequired !== undefined) {
      patch.humanReviewRequired = body.humanReviewRequired ? 1 : 0;
    }
    if (body.reviewRequired !== undefined) {
      patch.reviewRequired = body.reviewRequired ? 1 : 0;
    }

    if (Object.keys(patch).length === 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "At least one of reviewStatus, reviewedAt, reviewedBy, humanReviewRequired, reviewRequired is required",
          },
        },
        400
      );
    }

    await db
      .update(updateAiOutputs)
      .set(patch)
      .where(eq(updateAiOutputs.updateId, updateId));

    const [updated] = await db
      .select()
      .from(updateAiOutputs)
      .where(eq(updateAiOutputs.updateId, updateId));

    return c.json(serializeAiOutput(updated));
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

export { updateExtractionRouter };
