import { z } from "zod";
import { SeverityEnum } from "./enums.js";

/**
 * Standup **list item** shapes (planned / completed / blocked rows).
 *
 * We do **not** persist a `standups` table or a monolithic `Standup` entity in SQLite anymore
 * (see migrations under `packages/database/drizzle`). The supervisor standup screen is driven by
 * **read models** assembled from tasks: `StandupPrepResponseSchema` in `api-responses.ts` composes
 * these schemas for API responses. Keep them here so list rows stay typed and reusable.
 * (AI-generated standup **text** may be cached per project/day in `project_standup_ai_summaries` — that
 * is separate from these list rows and does not replace task-derived prep.)
 */
export const PlannedItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  location: z.string().optional(),
  department: z.string().nullable().optional(),
});

export type PlannedItem = z.infer<typeof PlannedItemSchema>;

export const CompletedItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  location: z.string().optional(),
});

export type CompletedItem = z.infer<typeof CompletedItemSchema>;

export const BlockedItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  severity: SeverityEnum,
  relatedTaskId: z.string().uuid().optional(),
  blockerReason: z.string().min(1),
});

export type BlockedItem = z.infer<typeof BlockedItemSchema>;
