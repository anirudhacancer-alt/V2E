import { z } from "zod";

export const ImprovementCategoryEnum = z.enum([
	"quality",
	"schedule",
	"safety",
	"maintenance",
	"retail_execution",
	"other",
]);
export type ImprovementCategory = z.infer<typeof ImprovementCategoryEnum>;

export const ImprovementStatusEnum = z.enum([
	"open",
	"in_progress",
	"validated",
	"closed",
]);
export type ImprovementStatus = z.infer<typeof ImprovementStatusEnum>;

export const ImprovementSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().uuid(),
	projectId: z.string().uuid(),
	siteId: z.string().uuid(),
	title: z.string().min(1).max(300),
	problemStatement: z.string().min(1).max(2000),
	category: ImprovementCategoryEnum,
	rootCause: z.string().max(2000).nullable().optional(),
	ownerId: z.string().uuid(),
	status: ImprovementStatusEnum,
	targetDate: z.coerce.date().nullable().optional(),
	linkedTaskIds: z.array(z.string().uuid()).default([]),
	linkedBlockerIds: z.array(z.string().uuid()).default([]),
	linkedCommitmentIds: z.array(z.string().uuid()).default([]),
	effectivenessNote: z.string().max(2000).nullable().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Improvement = z.infer<typeof ImprovementSchema>;

export const CreateImprovementSchema = z.object({
	projectId: z.string().uuid(),
	siteId: z.string().uuid(),
	title: z.string().min(1).max(300),
	problemStatement: z.string().min(1).max(2000),
	category: ImprovementCategoryEnum,
	rootCause: z.string().max(2000).nullable().optional(),
	ownerId: z.string().uuid(),
	targetDate: z.coerce.date().nullable().optional(),
	linkedTaskIds: z.array(z.string().uuid()).default([]),
	linkedBlockerIds: z.array(z.string().uuid()).default([]),
	linkedCommitmentIds: z.array(z.string().uuid()).default([]),
});

export type CreateImprovement = z.infer<typeof CreateImprovementSchema>;

export const UpdateImprovementSchema = z.object({
	title: z.string().min(1).max(300).optional(),
	problemStatement: z.string().min(1).max(2000).optional(),
	category: ImprovementCategoryEnum.optional(),
	rootCause: z.string().max(2000).nullable().optional(),
	ownerId: z.string().uuid().optional(),
	status: ImprovementStatusEnum.optional(),
	targetDate: z.coerce.date().nullable().optional(),
	linkedTaskIds: z.array(z.string().uuid()).optional(),
	linkedBlockerIds: z.array(z.string().uuid()).optional(),
	linkedCommitmentIds: z.array(z.string().uuid()).optional(),
	effectivenessNote: z.string().max(2000).nullable().optional(),
});

export type UpdateImprovement = z.infer<typeof UpdateImprovementSchema>;

export const ImprovementCardSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	title: z.string(),
	problemStatement: z.string(),
	category: ImprovementCategoryEnum,
	status: ImprovementStatusEnum,
	ownerName: z.string(),
	ownerId: z.string().uuid(),
	targetDate: z.coerce.date().nullable().optional(),
	linkedTaskCount: z.number().int().min(0),
	linkedBlockerCount: z.number().int().min(0),
	linkedCommitmentCount: z.number().int().min(0),
	isOverdue: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type ImprovementCard = z.infer<typeof ImprovementCardSchema>;
