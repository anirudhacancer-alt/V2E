import { z } from "zod";

export const SeverityEnum = z.enum(["Critical", "High", "Medium", "Low"]);
export type Severity = z.infer<typeof SeverityEnum>;

/** Full seeded / API task lifecycle (supervisor PATCH still limits to Active | Blocked | Done). */
export const TaskStatusEnum = z.enum([
  "Review",
  "New",
  "Planned",
  "In-progress",
  "Blocked",
  "Done",
]);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const UpdateCategoryEnum = z.enum([
  "Blocker",
  "WorkCompletion",
  "QAIssue",
  "MaterialDelay",
  "GeneralUpdate",
]);
export type UpdateCategory = z.infer<typeof UpdateCategoryEnum>;

/** Work package / discipline (site execution departments). */
export const DepartmentEnum = z.enum([
  "Civil",
  "Structure",
  "MEP",
  "Electrical",
  "Plumbing",
  "Finishing",
  "Masonry",
  "Carpentry",
  "Steel",
  "Painting",
  "Facade",
  "Production",
  "Packaging",
  "Maintenance",
  "Utilities",
  "Quality",
  "Warehouse",
  "Procurement",
  "Planning",
  "QAQC",
  "Safety",
]);
export type Department = z.infer<typeof DepartmentEnum>;

/** Values for `<select>` / API payloads; kept in sync with `DepartmentEnum`. */
export const DEPARTMENT_CODES = DepartmentEnum.options;

/**
 * Legacy human-readable role label (seed/adaptor compatibility only).
 * Runtime contracts should use `RoleTypeCodeSchema` instead.
 */
export const OrgRoleEnum = z.string().min(1).max(80);
export type OrgRole = z.infer<typeof OrgRoleEnum>;

export const SpecialtyEnum = z.enum([
  "General",
  "Civil",
  "Electrical",
  "MEP",
  "Plumbing",
  "Finishing",
  "Masonry",
  "Carpentry",
  "Steel",
  "Painting",
  "Production",
  "Packaging",
  "Maintenance",
  "Utilities",
  "Quality",
  "Warehouse",
  "Procurement",
  "Planning",
  "QAQC",
  "Safety",
]);
export type Specialty = z.infer<typeof SpecialtyEnum>;

export const AttendanceStatusEnum = z.enum(["Present", "Absent"]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusEnum>;

/**
 * Canonical `role_types.code` value (SCREAMING_SNAKE), FK in SQLite.
 */
export const RoleTypeCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/);
export type RoleTypeCode = z.infer<typeof RoleTypeCodeSchema>;
