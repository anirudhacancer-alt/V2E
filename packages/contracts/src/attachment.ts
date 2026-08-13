import { z } from "zod";

export const AttachmentTypeEnum = z.enum(["Image", "Audio", "Video", "Document"]);

export const AttachmentParentTypeEnum = z.enum(["task", "update"]);

export const AttachmentSchema = z.discriminatedUnion("parentType", [
  z.object({
    id: z.string().uuid(),
    parentType: z.literal("task"),
    parentId: z.string().uuid(),
    url: z.string().min(1),
    type: AttachmentTypeEnum,
    uploadedAt: z.coerce.date(),
  }),
  z.object({
    id: z.string().uuid(),
    parentType: z.literal("update"),
    parentId: z.string().uuid(),
    taskId: z.string().uuid().nullable().optional(),
    url: z.string().min(1),
    type: AttachmentTypeEnum,
    uploadedAt: z.coerce.date(),
  }),
]);

export type Attachment = z.infer<typeof AttachmentSchema>;

export const CreateAttachmentSchema = z.object({
  parentType: AttachmentParentTypeEnum,
  parentId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  url: z.string().min(1).optional(),
  type: AttachmentTypeEnum.optional(),
  fileName: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
  base64Data: z.string().min(1).optional(),
});

export type CreateAttachment = z.infer<typeof CreateAttachmentSchema>;
