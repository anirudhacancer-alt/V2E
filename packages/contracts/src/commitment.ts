import { z } from "zod";
import { RoleTypeCodeSchema } from "./enums.js";

/**
 * Commitment status lifecycle.
 * planned → in_progress → completed | at_risk | missed | carried_over
 */
export const CommitmentStatusEnum = z.enum([
  "planned",
  "in_progress",
  "completed",
  "at_risk",
  "missed",
  "carried_over",
]);
export type CommitmentStatus = z.infer<typeof CommitmentStatusEnum>;

/**
 * Commitment horizon for grouped display.
 * Used for field app grouping: Today / This Week / Look-ahead
 */
export const CommitmentHorizonEnum = z.enum([
  "today",
  "this_week",
  "look_ahead",
  "past",
]);
export type CommitmentHorizon = z.infer<typeof CommitmentHorizonEnum>;

/**
 * Commitment entity schema.
 * Tracks what a team or owner commits to deliver in a standup/planning cycle.
 */
export const CommitmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  siteId: z.string().uuid(),
  /** FK to work_cycles.id - nullable in phase 1. */
  workCycleId: z.string().uuid().nullable().optional(),
  /** FK to standup_sessions.id - nullable if not from standup. */
  standupSessionId: z.string().uuid().nullable().optional(),
  /** FK to tasks.id - nullable if commitment is standalone. */
  sourceTaskId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  /** FK to team_members.id (owner of the commitment). */
  ownerId: z.string().uuid(),
  /** FK to role_types.code (role responsible for delivery). */
  assigneeRoleCode: RoleTypeCodeSchema,
  status: CommitmentStatusEnum,
  /** Date when commitment was made. */
  commitDate: z.coerce.date(),
  /** Target delivery date. */
  targetDate: z.coerce.date(),
  /** When commitment was completed (null if not completed). */
  completedAt: z.coerce.date().nullable().optional(),
  /** FK to commitments.id - if carried over from a prior commitment. */
  carriedOverFromCommitmentId: z.string().uuid().nullable().optional(),
  /** Reason for at_risk or missed status. */
  riskReason: z.string().max(1000).nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Commitment = z.infer<typeof CommitmentSchema>;

/**
 * Schema for creating a new commitment.
 */
export const CreateCommitmentSchema = CommitmentSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type CreateCommitment = z.infer<typeof CreateCommitmentSchema>;

/**
 * Schema for updating an existing commitment.
 */
export const UpdateCommitmentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  ownerId: z.string().uuid().optional(),
  assigneeRoleCode: RoleTypeCodeSchema.optional(),
  status: CommitmentStatusEnum.optional(),
  targetDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  riskReason: z.string().max(1000).nullable().optional(),
});

export type UpdateCommitment = z.infer<typeof UpdateCommitmentSchema>;

/**
 * Read-model card for commitment list display.
 */
export const CommitmentCardSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  status: CommitmentStatusEnum,
  ownerName: z.string(),
  ownerId: z.string().uuid(),
  assigneeRoleCode: RoleTypeCodeSchema,
  assigneeRoleName: z.string(),
  commitDate: z.coerce.date(),
  targetDate: z.coerce.date(),
  completedAt: z.coerce.date().nullable().optional(),
  /** Computed horizon for grouping. */
  horizon: CommitmentHorizonEnum,
  /** true if targetDate is past and not completed. */
  isOverdue: z.boolean(),
  /** Display summary: "Due today", "Due Mar 6", "Completed", "Missed", etc. */
  statusSummary: z.string(),
  /** Linked task title if sourceTaskId is set. */
  linkedTaskTitle: z.string().nullable().optional(),
  /** Linked task ID for navigation. */
  linkedTaskId: z.string().uuid().nullable().optional(),
  /** Linked task status. */
  linkedTaskStatus: z.string().nullable().optional(),
  /** Reason for risk/miss if applicable. */
  riskReason: z.string().nullable().optional(),
  /** true if carried over from a previous commitment. */
  isCarriedOver: z.boolean(),
});

export type CommitmentCard = z.infer<typeof CommitmentCardSchema>;
