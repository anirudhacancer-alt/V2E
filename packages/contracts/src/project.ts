import { z } from "zod";

/** Vertical / execution type (§8.2). */
export const ProjectTypeSchema = z.enum([
  "construction",
  "factory",
  "retail",
  "warehouse",
  "venue",
  "ngo",
  "other",
]);

/** Lifecycle status distinct from `isActive` boolean. */
export const ProjectLifecycleStatusSchema = z.enum([
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  type: ProjectTypeSchema.optional(),
  status: ProjectLifecycleStatusSchema.optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
