import { z } from "zod";

export const MediaTypeEnum = z.enum(["Image", "Audio", "Video", "Document"]);
export type MediaType = z.infer<typeof MediaTypeEnum>;

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  type: MediaTypeEnum,
  uploadedAt: z.date(),
  /** Denormalized task link when the parent update maps to a task (site progress / transcripts). */
  taskId: z.string().uuid().nullable().optional(),
});

export type MediaAsset = z.infer<typeof MediaAssetSchema>;
