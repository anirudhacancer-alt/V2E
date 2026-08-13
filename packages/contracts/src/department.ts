import { z } from "zod";

/**
 * DepartmentRecord schema - execution/support departments (work packages / disciplines).
 * Maps to the `departments` table in the database.
 * Note: Named DepartmentRecord to avoid conflict with DepartmentEnum in enums.ts.
 */
export const DepartmentRecordSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  isSiteFunction: z.boolean().default(false),
  isExecutionDiscipline: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0),
});

export type DepartmentRecord = z.infer<typeof DepartmentRecordSchema>;

/** Create schema - omits system-generated id field. */
export const CreateDepartmentRecordSchema = DepartmentRecordSchema.omit({ id: true });
export type CreateDepartmentRecord = z.infer<typeof CreateDepartmentRecordSchema>;

/** Update schema - all fields optional for partial updates. */
export const UpdateDepartmentRecordSchema = CreateDepartmentRecordSchema.partial();
export type UpdateDepartmentRecord = z.infer<typeof UpdateDepartmentRecordSchema>;
