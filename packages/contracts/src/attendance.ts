import { z } from "zod";
import { AttendanceStatusEnum } from "./enums.js";

export const AttendanceRecordSchema = z.object({
  teamMemberId: z.string().uuid(),
  name: z.string(),
  role: z.string(),
  status: AttendanceStatusEnum,
});

export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

/** One roll-call session (standup as a point in time); attendance rows hang off this. */
export const AttendanceSessionSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  projectId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conductedBy: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AttendanceSession = z.infer<typeof AttendanceSessionSchema>;

export const AttendanceSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  status: AttendanceStatusEnum,
  notes: z.string().max(500).optional(),
  recordedAt: z.date(),
});

export type Attendance = z.infer<typeof AttendanceSchema>;

export const CreateAttendanceSchema = AttendanceSchema.omit({
  id: true,
  recordedAt: true,
});

export type CreateAttendance = z.infer<typeof CreateAttendanceSchema>;

export const AttendanceStatsSchema = z.object({
  total: z.number().int().min(0),
  present: z.number().int().min(0),
  absent: z.number().int().min(0),
  attendanceRate: z.number().min(0).max(100),
});

export type AttendanceStats = z.infer<typeof AttendanceStatsSchema>;
