import { z } from "zod";
import { DepartmentEnum, RoleTypeCodeSchema } from "./enums.js";

export const MemberSchema = z.object({
	id: z.string().uuid(),
	siteId: z.string().uuid(),
	userId: z.string().uuid().optional(),
	name: z.string().min(1).max(100),
	/** FK to `role_types.code`. */
	orgRoleCode: RoleTypeCodeSchema,
	/** FK to `departments.code` when tied to a discipline. */
	departmentCode: DepartmentEnum.optional(),
	specialty: z.string().max(80).optional(),
	reportsToUserId: z.string().uuid().optional(),
	email: z.string().email().optional(),
	phone: z.string().regex(/^\+[1-9]\d{1,14}$/).optional(),
	isActive: z.boolean().default(true),
	joinedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type Member = z.infer<typeof MemberSchema>;

export const CreateMemberSchema = MemberSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export type CreateMember = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = CreateMemberSchema.partial();

export type UpdateMember = z.infer<typeof UpdateMemberSchema>;

export const MemberWithUserSchema = MemberSchema;

export type MemberWithUser = z.infer<typeof MemberWithUserSchema>;
