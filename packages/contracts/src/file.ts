import { z } from "zod";

/**
 * File schema - canonical file metadata for uploads.
 * Phase G: §12.24
 */
export const FileSchema = z.object({
  id: z.string().uuid(),
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  checksum: z.string().nullable().optional(),
  uploadedByUserId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
});

export type File = z.infer<typeof FileSchema>;

export const CreateFileSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  checksum: z.string().optional(),
  uploadedByUserId: z.string().uuid().optional(),
});

export type CreateFile = z.infer<typeof CreateFileSchema>;
