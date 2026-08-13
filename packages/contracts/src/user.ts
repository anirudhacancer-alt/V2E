import { z } from "zod";
import { DepartmentEnum, RoleTypeCodeSchema } from "./enums.js";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  /** FK to `role_types.code`. */
  orgRoleCode: RoleTypeCodeSchema,
  /** FK to `departments.code` when the person is tied to a discipline. */
  departmentCode: DepartmentEnum.optional(),
  specialty: z.string().max(80).optional(),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  employeeId: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  preferences: z
    .object({
      pushNotificationsEnabled: z.boolean().default(true),
      darkModeEnabled: z.boolean().default(false),
    })
    .default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = CreateUserSchema.partial();

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const UserProfileSchema = UserSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
