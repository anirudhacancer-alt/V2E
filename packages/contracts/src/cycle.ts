import { z } from "zod";

export const CycleStatusEnum = z.enum(["planned", "active", "closed"]);
export type CycleStatus = z.infer<typeof CycleStatusEnum>;

export const CycleSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().uuid(),
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	status: CycleStatusEnum,
	goal: z.string().max(500).nullable().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export type Cycle = z.infer<typeof CycleSchema>;

export const CreateCycleSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	status: CycleStatusEnum.default("planned"),
	goal: z.string().max(500).nullable().optional(),
});

export type CreateCycle = z.infer<typeof CreateCycleSchema>;

export const UpdateCycleSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	status: CycleStatusEnum.optional(),
	goal: z.string().max(500).nullable().optional(),
});

export type UpdateCycle = z.infer<typeof UpdateCycleSchema>;

export const CycleCardSchema = z.object({
	id: z.string().uuid(),
	projectId: z.string().uuid(),
	name: z.string(),
	startDate: z.coerce.date(),
	endDate: z.coerce.date(),
	status: CycleStatusEnum,
	goal: z.string().nullable().optional(),
	commitmentCount: z.number().int().min(0),
	completedCommitmentCount: z.number().int().min(0),
	atRiskCommitmentCount: z.number().int().min(0),
	isCurrent: z.boolean(),
	daysRemaining: z.number().int(),
});

export type CycleCard = z.infer<typeof CycleCardSchema>;
