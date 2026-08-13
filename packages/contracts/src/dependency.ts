import { z } from "zod";

export const DependencyTypeEnum = z.enum([
	"blocks",
	"finish_to_start",
	"start_to_start",
	"finish_to_finish",
]);
export type DependencyType = z.infer<typeof DependencyTypeEnum>;

export const DependencySchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().uuid(),
	projectId: z.string().uuid(),
	predecessorTaskId: z.string().uuid(),
	successorTaskId: z.string().uuid(),
	dependencyType: DependencyTypeEnum,
	lagDays: z.number().int().min(0).default(0),
	isHardConstraint: z.boolean().default(true),
	reason: z.string().max(500).nullable().optional(),
	createdBy: z.string().uuid(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Dependency = z.infer<typeof DependencySchema>;

export const CreateDependencySchema = z.object({
	predecessorTaskId: z.string().uuid(),
	successorTaskId: z.string().uuid(),
	dependencyType: DependencyTypeEnum.default("finish_to_start"),
	lagDays: z.number().int().min(0).default(0),
	isHardConstraint: z.boolean().default(true),
	reason: z.string().max(500).nullable().optional(),
});

export type CreateDependency = z.infer<typeof CreateDependencySchema>;

export const UpdateDependencySchema = z.object({
	lagDays: z.number().int().min(0).optional(),
	isHardConstraint: z.boolean().optional(),
	reason: z.string().max(500).nullable().optional(),
});

export type UpdateDependency = z.infer<typeof UpdateDependencySchema>;

export const DependencyCardSchema = z.object({
	id: z.string().uuid(),
	dependencyType: DependencyTypeEnum,
	direction: z.enum(["predecessor", "successor"]),
	relatedTaskId: z.string().uuid(),
	relatedTaskTitle: z.string(),
	relatedTaskStatus: z.string(),
	relatedTaskSeverity: z.string().optional(),
	lagDays: z.number().int().min(0),
	isHardConstraint: z.boolean(),
	reason: z.string().nullable().optional(),
	isBlocking: z.boolean(),
});

export type DependencyCard = z.infer<typeof DependencyCardSchema>;

export const DependencySummarySchema = z.object({
	dependencyCount: z.number().int().min(0),
	blockedByCount: z.number().int().min(0),
	blocksCount: z.number().int().min(0),
	isDependencyBlocked: z.boolean(),
});

export type DependencySummary = z.infer<typeof DependencySummarySchema>;
