import { z } from "zod";

/**
 * Org role taxonomy — maps to `role_types`.
 */
export const RoleSchema = z.object({
	id: z.string().uuid(),
	/** Role code in SCREAMING_SNAKE_CASE format (e.g., FOREMAN, SITE_MANAGER). */
	code: z.string().min(1).max(64).regex(/^[A-Z][A-Z0-9_]*$/),
	name: z.string().min(1).max(100),
	level: z.string().min(1).max(50),
	isManagerial: z.boolean().default(false),
	isFieldBased: z.boolean().default(false),
	isCrewRole: z.boolean().default(false),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().min(0),
});

export type Role = z.infer<typeof RoleSchema>;

export const CreateRoleSchema = RoleSchema.omit({ id: true });
export type CreateRole = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = CreateRoleSchema.partial();
export type UpdateRole = z.infer<typeof UpdateRoleSchema>;
