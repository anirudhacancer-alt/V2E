import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Context } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { updates, projects, updateAttachments, tasks, locations } from "@v2e/database";

import { getDemoDb } from "../db.js";
import {
  buildSourceTaskIdByUpdateId,
  resolveTaskIdForUpdate,
} from "../lib/resolve-task-for-update.js";
import { insertAuditEvent } from "../lib/audit.js";
import { opsLog } from "../lib/logger.js";
import { resolveSqlitePath, sqliteFileExists } from "../env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to uploads directory (relative to src/routes -> ../../uploads)
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
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

// Validation schema for the create update request
const CreateUpdateFormSchema = z.object({
  projectId: z.string().uuid("projectId must be a valid UUID"),
  transcript: z.string().min(1, "Transcript is required"),
  recordedBy: z.string().uuid("recordedBy must be a valid UUID"),
  locationId: z.string().uuid("locationId must be a valid UUID"),
});

/**
 * Generate a URL for accessing an uploaded audio file.
 * For the demo/MVP, this returns a local file path that could be served statically.
 * In production, this would return a cloud storage URL (S3, GCS, etc.).
 */
function generateUploadUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/**
 * Save an audio file to the uploads directory.
 * Returns the filename if successful.
 */
async function saveAudioFile(file: File, updateId: string): Promise<string> {
  const ext = getExtensionFromMimeType(file.type) || "webm";
  const filename = `${updateId}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  // Convert File to Buffer and write to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(filepath, buffer);

  return filename;
}

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
  };
  return mimeToExt[mimeType] || null;
}

const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

function getImageExtension(mimeType: string): string | null {
  const m: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return m[mimeType] || null;
}

async function resolveTaskIdForUpdateRow(
  db: ReturnType<typeof getDemoDb>,
  projectId: string,
  update: { id: string; linkedTaskId: string | null }
): Promise<string | null> {
  const taskRows = await db
    .select({ id: tasks.id, sourceUpdateId: tasks.sourceUpdateId })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));
  const bySource = buildSourceTaskIdByUpdateId(taskRows);
  return resolveTaskIdForUpdate(update, bySource);
}

async function saveImageFile(
  file: File,
  updateId: string,
  index: number
): Promise<{ filename: string; url: string }> {
  const ext = getImageExtension(file.type) || "jpg";
  const filename = `${updateId}-img-${index}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(filepath, buffer);
  return { filename, url: generateUploadUrl(filename) };
}

/**
 * POST /v1/updates
 * Create a new update with optional audio file upload (flat route per §12.8).
 *
 * Accepts multipart/form-data with:
 * - projectId (uuid, required): Project ID
 * - transcript (text, required): The transcribed text
 * - recordedBy (uuid, required): The team member who recorded this update
 * - locationId (uuid, required): Project-scoped location master row
 * - audio (file, optional): The audio recording file
 *
 * Returns the created update record.
 */
export async function handleCreateUpdate(c: Context) {
  if (!sqliteFileExists()) {
    return dbNotReady(c);
  }

  const db = getDemoDb();

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (err) {
    return c.json(
      {
        error: {
          code: "INVALID_FORM_DATA",
          message: "Failed to parse multipart form data",
          details: { error: err instanceof Error ? err.message : String(err) },
        },
      },
      400
    );
  }

  // Extract and validate required fields
  const projectId = formData.get("projectId");
  const transcript = formData.get("transcript");
  const recordedBy = formData.get("recordedBy");
  const locationId = formData.get("locationId");
  const audioFile = formData.get("audio");
  const imageEntries: File[] = [];
  for (const v of formData.getAll("images")) {
    if (v instanceof File && v.size > 0) {
      imageEntries.push(v);
    }
  }

  // Validate fields
  const parseResult = CreateUpdateFormSchema.safeParse({
    projectId: projectId?.toString() || "",
    transcript: transcript?.toString() || "",
    recordedBy: recordedBy?.toString() || "",
    locationId: locationId?.toString() || "",
  });

  if (!parseResult.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: (parseResult as { error: { flatten: () => unknown } }).error.flatten(),
        },
      },
      400
    );
  }

  const validatedProjectId = parseResult.data.projectId;

  // Validate project exists
  const [project] = await db
    .select({ id: projects.id, siteId: projects.siteId })
    .from(projects)
    .where(eq(projects.id, validatedProjectId));

  if (!project) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Project not found",
        },
      },
      404
    );
  }

  const {
    transcript: validatedTranscript,
    recordedBy: validatedRecordedBy,
    locationId: validatedLocationId,
  } = parseResult.data;

  const [locationRow] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(eq(locations.id, validatedLocationId), eq(locations.projectId, validatedProjectId))
    );

  if (!locationRow) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid or out-of-project locationId",
          details: { locationId: validatedLocationId, projectId: validatedProjectId },
        },
      },
      400
    );
  }

  // Generate UUID for the new update
  const updateId = randomUUID();
  const now = new Date().toISOString();

  // Handle audio file upload if provided
  let audioUrl: string | null = null;
  let audioDuration: string | null = null;
  const savedImageRows: Array<{ url: string }> = [];

  if (audioFile && audioFile instanceof File && audioFile.size > 0) {
    // Validate file type
    const validAudioTypes = [
      "audio/webm",
      "audio/mp3",
      "audio/mpeg",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/ogg",
      "audio/opus",
      "audio/m4a",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
    ];

    if (!validAudioTypes.includes(audioFile.type)) {
      return c.json(
        {
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Audio file must be a valid audio format (webm, mp3, wav, ogg, m4a, aac)",
            details: { providedType: audioFile.type },
          },
        },
        400
      );
    }

    // Limit file size to 50MB for demo
    const maxSize = 50 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return c.json(
        {
          error: {
            code: "FILE_TOO_LARGE",
            message: "Audio file must be less than 50MB",
            details: { providedSize: audioFile.size, maxSize },
          },
        },
        400
      );
    }

    try {
      const filename = await saveAudioFile(audioFile, updateId);
      audioUrl = generateUploadUrl(filename);
      // Note: Audio duration would typically be extracted from the file metadata
      // For the demo, we leave it as null unless provided by the client
    } catch (err) {
      return c.json(
        {
          error: {
            code: "FILE_UPLOAD_ERROR",
            message: "Failed to save audio file",
            details: { error: err instanceof Error ? err.message : String(err) },
          },
        },
        500
      );
    }
  }

  const maxImages = 10;
  const maxImageBytes = 15 * 1024 * 1024;
  if (imageEntries.length > maxImages) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `At most ${maxImages} images per update`,
          details: { count: imageEntries.length },
        },
      },
      400
    );
  }

  for (let i = 0; i < imageEntries.length; i++) {
    const img = imageEntries[i];
    if (!VALID_IMAGE_TYPES.includes(img.type)) {
      return c.json(
        {
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Image must be jpeg, png, webp, gif, or heic",
            details: { providedType: img.type, index: i },
          },
        },
        400
      );
    }
    if (img.size > maxImageBytes) {
      return c.json(
        {
          error: {
            code: "FILE_TOO_LARGE",
            message: "Each image must be under 15MB",
            details: { index: i, maxSize: maxImageBytes },
          },
        },
        400
      );
    }
    try {
      const { url } = await saveImageFile(img, updateId, i);
      savedImageRows.push({ url });
    } catch (err) {
      return c.json(
        {
          error: {
            code: "FILE_UPLOAD_ERROR",
            message: "Failed to save image file",
            details: { error: err instanceof Error ? err.message : String(err), index: i },
          },
        },
        500
      );
    }
  }

  // Insert into database
  try {
    await db.insert(updates).values({
      id: updateId,
      siteId: project.siteId,
      projectId: validatedProjectId,
      sourceType: "voice",
      needsReview: 0,
      recordedBy: validatedRecordedBy,
      locationId: validatedLocationId,
      transcript: validatedTranscript,
      audioUrl: audioUrl,
      audioDuration: audioDuration,
      status: "Pending",
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    return c.json(
      {
        error: {
          code: "DATABASE_ERROR",
          message: "Failed to create update record",
          details: { error: err instanceof Error ? err.message : String(err) },
        },
      },
      500
    );
  }

  const attachmentTaskId = await resolveTaskIdForUpdateRow(db, validatedProjectId, {
    id: updateId,
    linkedTaskId: null,
  });

  for (const row of savedImageRows) {
    await db.insert(updateAttachments).values({
      id: randomUUID(),
      updateId,
      taskId: attachmentTaskId,
      url: row.url,
      type: "Image",
      uploadedAt: now,
    });
  }

  opsLog("info", "update.created", {
    updateId,
    projectId: validatedProjectId,
    hasAudio: !!audioUrl,
    imageCount: savedImageRows.length,
  });
  await insertAuditEvent(db, {
    eventType: "update.created",
    projectId: validatedProjectId,
    entityType: "update",
    entityId: updateId,
    payload: {
      recordedBy: validatedRecordedBy,
      hasAudio: !!audioUrl,
      attachmentCount: savedImageRows.length,
    },
  });

  return c.json(
    {
      id: updateId,
      siteId: project.siteId,
      projectId: validatedProjectId,
      recordedBy: validatedRecordedBy,
      transcript: validatedTranscript,
      audioUrl: audioUrl,
      audioDuration: audioDuration ? parseInt(audioDuration, 10) : null,
      status: "Pending",
      hasAttachments: savedImageRows.length > 0,
      attachmentCount: savedImageRows.length,
      createdAt: now,
      updatedAt: now,
    },
    201
  );
}
