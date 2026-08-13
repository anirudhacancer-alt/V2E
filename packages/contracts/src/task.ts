import { z } from "zod";
import {
  SeverityEnum,
  TaskStatusEnum,
  DepartmentEnum,
  RoleTypeCodeSchema,
} from "./enums.js";
import { MediaAssetSchema } from "./media.js";

export const TaskSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  ownerId: z.string().uuid(),
  /** FK to `role_types.code`. */
  assigneeRoleCode: RoleTypeCodeSchema,
  severity: SeverityEnum,
  /** FK to `departments.code`. */
  departmentCode: DepartmentEnum.optional(),
  location: z.string().min(1).max(200),
  /** FK to `locations.id` (project-scoped). */
  locationId: z.string().min(1).max(80),
  status: TaskStatusEnum,
  source: z.enum(["Manual", "VoiceUpdate", "AIGenerated", "Escalated"]),
  sourceUpdateId: z.string().uuid().optional(),
  startDate: z.date(),
  dueDate: z.date(),
  completedAt: z.date().optional(),
  attachments: z.array(MediaAssetSchema).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type CreateTask = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional(),
  status: TaskStatusEnum.optional(),
  severity: SeverityEnum.optional(),
  dueDate: z.date().optional(),
}).partial();

export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

export const TaskCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  severity: SeverityEnum,
  /** Canonical `departments.code` when set. */
  departmentCode: DepartmentEnum.nullable().optional(),
  owner: z.string(),
  ownerId: z.string().uuid(),
  assigneeRoleCode: RoleTypeCodeSchema,
  assigneeRoleName: z.string().min(1),
  location: z.string(),
  /** Compact line from `locations.listLabel` for list rows; detail views use full `location`. */
  locationList: z.string().min(1),
  dueDate: z.union([z.date(), z.string()]),
  status: TaskStatusEnum,
  isOverdue: z.boolean(),
  /** Supervisor-first due state copy: Overdue 3d, Due today, Due Mar 6, Open 22d, … */
  dueSummary: z.string(),
  /** Days since task was created (for "Open Nd") */
  openDays: z.number().int().min(0),
  source: z.string().optional(),
  sourceUpdateId: z.string().uuid().nullable().optional(),
  updatedAt: z.union([z.date(), z.string()]),
  // Phase A dependency fields
  /** Total number of dependencies (both directions). */
  dependencyCount: z.number().int().min(0).default(0),
  /** Number of tasks blocking this task (predecessors not done). */
  blockedByCount: z.number().int().min(0).default(0),
  /** Number of tasks this task is blocking (this task is predecessor). */
  blocksCount: z.number().int().min(0).default(0),
  /** true if any hard-constraint predecessor is not done. */
  isDependencyBlocked: z.boolean().default(false),
});

export type TaskCard = z.infer<typeof TaskCardSchema>;

export const TaskFilterSchema = z.object({
  siteId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  status: TaskStatusEnum.optional(),
  severity: SeverityEnum.optional(),
  department: DepartmentEnum.optional(),
  ownerId: z.string().uuid().optional(),
  reporterTeamMemberId: z.string().uuid().optional(),
  dueBefore: z.union([z.date(), z.string()]).optional(),
  dueAfter: z.union([z.date(), z.string()]).optional(),
  overdueOnly: z.boolean().default(false),
});

export type TaskFilter = z.infer<typeof TaskFilterSchema>;
