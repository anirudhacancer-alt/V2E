import { z } from "zod";
import { RoleTypeCodeSchema } from "./enums.js";

/**
 * Standup Session contracts (§13).
 *
 * Standup sessions are point-in-time meeting instances scoped by project and
 * optional org hierarchy level. This file contains schemas for:
 * - Session entity (CRUD)
 * - Session summary response (AI-generated or manual)
 * - Attendance tracking within sessions
 */

// ============================================================================
// Standup Session Scope
// ============================================================================

export const StandupSessionScopeLevelEnum = z.enum([
  "team",
  "department",
  "site",
  "plant",
  "region",
]);

export type StandupSessionScopeLevel = z.infer<typeof StandupSessionScopeLevelEnum>;

export const StandupSessionStatusEnum = z.enum([
  "draft",
  "active",
  "closed",
]);

export type StandupSessionStatus = z.infer<typeof StandupSessionStatusEnum>;

// ============================================================================
// Standup Session Entity
// ============================================================================

export const StandupSessionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  projectId: z.string().uuid(),
  /** Scope level for the session (team, department, site, etc.). */
  scopeLevel: StandupSessionScopeLevelEnum,
  /** Reference to the scoped entity (e.g., department code, site ID). */
  scopeRef: z.string().nullable().optional(),
  /** Session date in YYYY-MM-DD format. */
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Owner/conductor of the session. */
  ownerId: z.string().uuid(),
  /** Session status. */
  status: StandupSessionStatusEnum,
  /** AI-generated or manual summary text. */
  summaryText: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StandupSession = z.infer<typeof StandupSessionSchema>;

// ============================================================================
// Standup Session Create/Update
// ============================================================================

export const StandupSessionCreateSchema = z.object({
  projectId: z.string().uuid(),
  scopeLevel: StandupSessionScopeLevelEnum,
  scopeRef: z.string().nullable().optional(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ownerId: z.string().uuid(),
  status: StandupSessionStatusEnum.optional().default("draft"),
  summaryText: z.string().nullable().optional(),
});

export type StandupSessionCreate = z.infer<typeof StandupSessionCreateSchema>;

export const StandupSessionUpdateSchema = z.object({
  scopeLevel: StandupSessionScopeLevelEnum.optional(),
  scopeRef: z.string().nullable().optional(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ownerId: z.string().uuid().optional(),
  status: StandupSessionStatusEnum.optional(),
  summaryText: z.string().nullable().optional(),
});

export type StandupSessionUpdate = z.infer<typeof StandupSessionUpdateSchema>;

// ============================================================================
// Standup Session List Response
// ============================================================================

export const StandupSessionCardSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  scopeLevel: StandupSessionScopeLevelEnum,
  scopeRef: z.string().nullable().optional(),
  sessionDate: z.string(),
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  status: StandupSessionStatusEnum,
  hasSummary: z.boolean(),
  attendeeCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StandupSessionCard = z.infer<typeof StandupSessionCardSchema>;

export const StandupSessionListResponseSchema = z.object({
  data: z.array(StandupSessionCardSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  }),
});

export type StandupSessionListResponse = z.infer<typeof StandupSessionListResponseSchema>;

// ============================================================================
// Standup Session Summary Response (§13)
// ============================================================================

export const StandupSessionAttendeeSchema = z.object({
  teamMemberId: z.string().uuid(),
  name: z.string(),
  orgRoleCode: RoleTypeCodeSchema,
  roleName: z.string(),
  /** Attendance status: present, absent, late, excused. */
  attendanceStatus: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().nullable().optional(),
});

export type StandupSessionAttendee = z.infer<typeof StandupSessionAttendeeSchema>;

export const StandupSessionSummaryResponseSchema = z.object({
  /** Session metadata. */
  session: z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    projectName: z.string(),
    scopeLevel: StandupSessionScopeLevelEnum,
    scopeRef: z.string().nullable().optional(),
    sessionDate: z.string(),
    ownerId: z.string().uuid(),
    ownerName: z.string(),
    status: StandupSessionStatusEnum,
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  /** AI-generated or manual summary text. */
  summaryText: z.string().nullable(),
  /** Model used for AI summary generation (if applicable). */
  modelUsed: z.string().nullable().optional(),
  /** Attendance records for this session. */
  attendees: z.array(StandupSessionAttendeeSchema),
  /** Summary statistics. */
  stats: z.object({
    /** Total expected attendees. */
    totalExpected: z.number().int().min(0),
    /** Attendees marked present. */
    present: z.number().int().min(0),
    /** Attendees marked absent. */
    absent: z.number().int().min(0),
    /** Attendees marked late. */
    late: z.number().int().min(0),
    /** Attendees marked excused. */
    excused: z.number().int().min(0),
    /** Attendance rate as decimal (0-1). */
    attendanceRate: z.number().min(0).max(1),
  }),
  /** Commitments made during this session. */
  commitmentsMade: z.number().int().min(0),
  /** Tasks discussed/referenced. */
  tasksDiscussed: z.number().int().min(0),
});

export type StandupSessionSummaryResponse = z.infer<typeof StandupSessionSummaryResponseSchema>;

// ============================================================================
// Standup Session Detail Response
// ============================================================================

export const StandupSessionDetailResponseSchema = StandupSessionSchema.extend({
  projectName: z.string(),
  ownerName: z.string(),
  /** Attendance records. */
  attendees: z.array(StandupSessionAttendeeSchema),
  /** Commitments linked to this session. */
  commitments: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    ownerId: z.string().uuid(),
    ownerName: z.string(),
    status: z.string(),
    targetDate: z.string(),
  })),
  /** Stats summary. */
  stats: z.object({
    attendeeCount: z.number().int().min(0),
    presentCount: z.number().int().min(0),
    commitmentCount: z.number().int().min(0),
  }),
});

export type StandupSessionDetailResponse = z.infer<typeof StandupSessionDetailResponseSchema>;
