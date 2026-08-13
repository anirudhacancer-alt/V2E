/**
 * Files Routes (§12.24)
 *
 * Routes for file management (upload, metadata, content, delete).
 */

import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { files } from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
  ValidationError,
  isValidationError,
} from "../lib/data-integrity.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

// ============================================================================
// Constants
// ============================================================================

// Resolve uploads directory relative to api package
const UPLOADS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../uploads"
);

// ============================================================================
// Router Setup
// ============================================================================

const filesRouter = new Hono();

// ============================================================================
// Helper Functions
// ============================================================================

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

function validationErrorResponse(
  c: Context,
  e: ValidationError,
  status: 400 | 409 = 400
) {
  return c.json(
    {
      error: {
        code: e.code,
        message: e.message,
        details: e.details ?? {},
      },
    },
    status
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

// ============================================================================
// Files Routes (§12.24)
// ============================================================================

/**
 * POST /v1/files
 * Upload a file and create metadata record.
 * Accepts multipart/form-data with a "file" field.
 */
filesRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing or invalid file in form data",
            details: {},
          },
        },
        400
      );
    }

    const fileId = randomUUID();
    const ext = path.extname(file.name) || "";
    const storageKey = `${fileId}${ext}`;
    const filePath = path.join(UPLOADS_DIR, storageKey);

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const now = new Date().toISOString();

    await db.insert(files).values({
      id: fileId,
      storageKey,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      checksum: null,
      uploadedByUserId: null,
      createdAt: now,
    });

    opsLog("info", "file.created", { fileId, fileName: file.name });

    await insertAuditEvent(db, {
      eventType: "file.created",
      projectId: null,
      entityType: "file",
      entityId: fileId,
      payload: { fileName: file.name, mimeType: file.type, sizeBytes: buffer.length },
    });

    return c.json(
      {
        id: fileId,
        storageKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: buffer.length,
        checksum: null,
        uploadedByUserId: null,
        createdAt: now,
        url: `/uploads/${storageKey}`,
      },
      201
    );
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    if (isValidationError(e)) return validationErrorResponse(c, e);
    throw e;
  }
});

/**
 * GET /v1/files/:fileId
 * Get file metadata by ID.
 */
filesRouter.get("/:fileId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const fileId = c.req.param("fileId");
  const db = getDemoDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!file) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "File not found",
            details: { fileId },
          },
        },
        404
      );
    }

    return c.json({
      ...file,
      url: `/uploads/${file.storageKey}`,
    });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * GET /v1/files/:fileId/content
 * Serve file content with proper MIME type.
 */
filesRouter.get("/:fileId/content", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const fileId = c.req.param("fileId");
  const db = getDemoDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!file) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "File not found",
            details: { fileId },
          },
        },
        404
      );
    }

    const filePath = path.join(UPLOADS_DIR, file.storageKey);

    if (!fs.existsSync(filePath)) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "File content not found on disk",
            details: { fileId, storageKey: file.storageKey },
          },
        },
        404
      );
    }

    const content = fs.readFileSync(filePath);

    c.header("Content-Type", file.mimeType);
    c.header("Content-Length", file.sizeBytes.toString());
    c.header("Content-Disposition", `inline; filename="${file.fileName}"`);

    return c.body(content);
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

/**
 * DELETE /v1/files/:fileId
 * Delete file record and optionally the disk file.
 */
filesRouter.delete("/:fileId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const fileId = c.req.param("fileId");
  const db = getDemoDb();

  try {
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, fileId));

    if (!file) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "File not found",
            details: { fileId },
          },
        },
        404
      );
    }

    // Delete from database
    await db.delete(files).where(eq(files.id, fileId));

    // Delete from disk if exists
    const filePath = path.join(UPLOADS_DIR, file.storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    opsLog("info", "file.deleted", { fileId, fileName: file.fileName });

    await insertAuditEvent(db, {
      eventType: "file.deleted",
      projectId: null,
      entityType: "file",
      entityId: fileId,
      payload: { fileName: file.fileName },
    });

    return c.json({ success: true, id: fileId });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

export { filesRouter };
