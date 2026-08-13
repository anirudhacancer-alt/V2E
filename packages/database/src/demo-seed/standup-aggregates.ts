import type { CsvRow } from "./types.js";

function utcYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Match standup-prep-from-tasks rules for materialized `standups` row counts. */
export function countPlannedForStandupDay(
  tasks: CsvRow[],
  projectId: string,
  standupDayYmd: string
): number {
  return tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.status === "In-progress" &&
      utcYmd(t.dueDate) === standupDayYmd
  ).length;
}

export function countCompletedOnStandupDay(
  tasks: CsvRow[],
  projectId: string,
  standupDayYmd: string
): number {
  return tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.status === "Done" &&
      t.completedAt &&
      utcYmd(t.completedAt) === standupDayYmd
  ).length;
}

export function countBlockedForProject(
  tasks: CsvRow[],
  projectId: string
): number {
  return tasks.filter(
    (t) => t.projectId === projectId && t.status === "Blocked"
  ).length;
}
