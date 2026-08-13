import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  taskAttachments,
  tasks,
  updateAttachments,
  updates,
} from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  DataIntegrityError,
  isDataIntegrityError,
} from "../lib/data-integrity.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

const attachmentsRouter = new Hono();

const VALID_ATTACHMENT_TYPES = ["Image", "Audio", "Video", "Document"] as const;
const VALID_PARENT_TYPES = ["task", "update"] as const;
const UPLOADS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../uploads"
);

type ParentType = (typeof VALID_PARENT_TYPES)[number];
type AttachmentType = (typeof VALID_ATTACHMENT_TYPES)[number];

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

function inferAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (mimeType.startsWith("video/")) return "Video";
  return "Document";
}

function normalizeParentType(value: string | null | undefined): ParentType | null {
  if (!value) return null;
  return VALID_PARENT_TYPES.includes(value as ParentType) ? (value as ParentType) : null;
}

async function persistUpload(params: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const ext = path.extname(params.fileName) || "";
  const storageKey = `${randomUUID()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, storageKey);
  fs.writeFileSync(filePath, Buffer.from(params.bytes));
  return {
    url: `/uploads/${storageKey}`,
    type: inferAttachmentType(params.mimeType),
  };
}

function serializeAttachment(row: {
  id: string;
  url: string;
  type: string;
  uploadedAt: string;
  updateId?: string | null;
  taskId?: string | null;
}) {
  if (row.updateId) {
    return {
      id: row.id,
      parentType: "update" as const,
      parentId: row.updateId,
      taskId: row.taskId ?? null,
      url: row.url,
      type: row.type,
      uploadedAt: row.uploadedAt,
    };
  }
  return {
    id: row.id,
    parentType: "task" as const,
    parentId: row.taskId!,
    url: row.url,
    type: row.type,
    uploadedAt: row.uploadedAt,
  };
}

attachmentsRouter.get("/", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const parentType = normalizeParentType(c.req.query("parentType"));
  const parentId = c.req.query("parentId");
  if (!parentType || !parentId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "parentType and parentId query parameters are required",
        },
      },
      400
    );
  }

  const db = getDemoDb();

  try {
    if (parentType === "update") {
      const rows = await db
        .select()
        .from(updateAttachments)
        .where(eq(updateAttachments.updateId, parentId));
      return c.json({ items: rows.map(serializeAttachment), total: rows.length });
    }

    const rows = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, parentId));
    return c.json({ items: rows.map(serializeAttachment), total: rows.length });
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

attachmentsRouter.get("/:attachmentId", async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const attachmentId = c.req.param("attachmentId");
  const db = getDemoDb();

  try {
    const [taskAttachment] = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId));
    if (taskAttachment) {
      return c.json(serializeAttachment(taskAttachment));
    }

    const [updateAttachment] = await db
      .select()
      .from(updateAttachments)
      .where(eq(updateAttachments.id, attachmentId));
    if (updateAttachment) {
      return c.json(serializeAttachment(updateAttachment));
    }

    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Attachment not found",
          details: { attachmentId },
        },
      },
      404
    );
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

attachmentsRouter.post("/", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();
  const contentType = c.req.header("content-type") ?? "";

  try {
    let parentType: ParentType | null = null;
    let parentId: string | null = null;
    let taskId: string | null = null;
    let url: string | null = null;
    let type: AttachmentType | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      parentType = normalizeParentType(formData.get("parentType")?.toString());
      parentId = formData.get("parentId")?.toString() ?? null;
      taskId = formData.get("taskId")?.toString() ?? null;
      const file = formData.get("file") ?? formData.get("image");
      if (!file || !(file instanceof File)) {
        return c.json(
          { error: { code: "VALIDATION_ERROR", message: "file or image is required" } },
          400
        );
      }
      const upload = await persistUpload({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      url = upload.url;
      type = upload.type;
    } else {
      const body = (await c.req.json()) as Record<string, unknown>;
      parentType = normalizeParentType(
        typeof body.parentType === "string" ? body.parentType : undefined
      );
      parentId = typeof body.parentId === "string" ? body.parentId : null;
      taskId = typeof body.taskId === "string" ? body.taskId : null;

      if (
        typeof body.base64Data === "string" &&
        typeof body.fileName === "string" &&
        typeof body.mimeType === "string"
      ) {
        const upload = await persistUpload({
          fileName: body.fileName,
          mimeType: body.mimeType,
          bytes: Buffer.from(body.base64Data, "base64"),
        });
        url = upload.url;
        type = upload.type;
      } else {
        url = typeof body.url === "string" ? body.url : null;
        const rawType = typeof body.type === "string" ? body.type : null;
        type =
          rawType && VALID_ATTACHMENT_TYPES.includes(rawType as AttachmentType)
            ? (rawType as AttachmentType)
            : null;
      }
    }

    if (!parentType || !parentId || !url || !type) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "parentType, parentId, url/file, and type are required",
          },
        },
        400
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    if (parentType === "update") {
      const [update] = await db
        .select({ id: updates.id, projectId: updates.projectId })
        .from(updates)
        .where(eq(updates.id, parentId));
      if (!update) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "parentId not found in updates",
              details: { parentType, parentId },
            },
          },
          400
        );
      }

      if (taskId) {
        const [task] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(eq(tasks.id, taskId));
        if (!task) {
          return c.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "taskId not found in tasks",
                details: { taskId },
              },
            },
            400
          );
        }
      }

      await db.insert(updateAttachments).values({
        id,
        updateId: parentId,
        taskId,
        url,
        type,
        uploadedAt: now,
      });

      await insertAuditEvent(db, {
        eventType: "update_attachment.created",
        projectId: update.projectId,
        entityType: "attachment",
        entityId: id,
        payload: { parentType, parentId, type },
      });

      return c.json(
        serializeAttachment({
          id,
          updateId: parentId,
          taskId,
          url,
          type,
          uploadedAt: now,
        }),
        201
      );
    }

    const [task] = await db
      .select({ id: tasks.id, projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, parentId));
    if (!task) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "parentId not found in tasks",
            details: { parentType, parentId },
          },
        },
        400
      );
    }

    await db.insert(taskAttachments).values({
      id,
      taskId: parentId,
      url,
      type,
      uploadedAt: now,
    });

    await insertAuditEvent(db, {
      eventType: "task_attachment.created",
      projectId: task.projectId,
      entityType: "attachment",
      entityId: id,
      payload: { parentType, parentId, type },
    });

    return c.json(
      serializeAttachment({
        id,
        taskId: parentId,
        url,
        type,
        uploadedAt: now,
      }),
      201
    );
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

attachmentsRouter.delete("/:attachmentId", requireAuth, async (c) => {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const attachmentId = c.req.param("attachmentId");
  const db = getDemoDb();

  try {
    const [taskAttachment] = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, attachmentId));
    if (taskAttachment) {
      const [task] = await db
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, taskAttachment.taskId));
      await db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));
      await insertAuditEvent(db, {
        eventType: "task_attachment.deleted",
        projectId: task?.projectId ?? null,
        entityType: "attachment",
        entityId: attachmentId,
        payload: { parentType: "task", parentId: taskAttachment.taskId },
      });
      return c.json({ success: true, id: attachmentId });
    }

    const [updateAttachment] = await db
      .select()
      .from(updateAttachments)
      .where(eq(updateAttachments.id, attachmentId));
    if (updateAttachment) {
      const [update] = await db
        .select({ projectId: updates.projectId })
        .from(updates)
        .where(eq(updates.id, updateAttachment.updateId));
      await db.delete(updateAttachments).where(eq(updateAttachments.id, attachmentId));
      await insertAuditEvent(db, {
        eventType: "update_attachment.deleted",
        projectId: update?.projectId ?? null,
        entityType: "attachment",
        entityId: attachmentId,
        payload: { parentType: "update", parentId: updateAttachment.updateId },
      });
      return c.json({ success: true, id: attachmentId });
    }

    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Attachment not found",
          details: { attachmentId },
        },
      },
      404
    );
  } catch (e) {
    if (isDataIntegrityError(e)) return integrityErrorResponse(c, e);
    throw e;
  }
});

export { attachmentsRouter };
