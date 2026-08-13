/**
 * Standup prep lists are derived from `tasks` only (UTC calendar days).
 *
 * - **Planned today:** `status === "In-progress"` and `dueDate` (UTC) is today.
 * - **Completed yesterday:** `status === "Done"` and `completedAt` (UTC) is yesterday.
 * - **Carry-forward (`carryForwardDueYesterday`):** tasks that were **planned for yesterday**
 *   but are still **incomplete** and **not blocked**: `status === "In-progress"` and `dueDate` (UTC)
 *   is yesterday. Excludes `Blocked` and `Done` (only `In-progress` rows match). Same semantics as
 *   "slipped" / in-progress work, not blockers.
 *
 * See `docs/field-app/standup-prep-from-tasks.md`.
 */

export type TaskRowForStandup = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  ownerId: string;
  severity: string;
  department: string | null;
  location: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
};

/** ISO timestamp → `YYYY-MM-DD` in UTC. */
export function utcYmd(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function standupPrepDateBounds(now: Date = new Date()): {
  todayYmd: string;
  yesterdayYmd: string;
} {
  const t = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const yesterday = new Date(t.getTime() - 86_400_000);
  return {
    todayYmd: utcYmd(t.toISOString()),
    yesterdayYmd: utcYmd(yesterday.toISOString()),
  };
}

/** For a historical standup row, treat `standupDateIso` as “today” (meeting day) vs prior calendar day. */
export function standupPrepDateBoundsForStandupDate(standupDateIso: string): {
  todayYmd: string;
  yesterdayYmd: string;
} {
  const d = new Date(standupDateIso);
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const yesterday = new Date(t.getTime() - 86_400_000);
  return {
    todayYmd: utcYmd(t.toISOString()),
    yesterdayYmd: utcYmd(yesterday.toISOString()),
  };
}

export function plannedForTodayTasks(
  tasks: TaskRowForStandup[],
  projectId: string,
  todayYmd: string,
): TaskRowForStandup[] {
  return tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.status === "In-progress" &&
      utcYmd(t.dueDate) === todayYmd,
  );
}

export function completedYesterdayTasks(
  tasks: TaskRowForStandup[],
  projectId: string,
  yesterdayYmd: string,
): TaskRowForStandup[] {
  return tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.status === "Done" &&
      Boolean(t.completedAt) &&
      utcYmd(t.completedAt as string) === yesterdayYmd,
  );
}

/**
 * In-progress work due yesterday but not done — "slipped" from yesterday's plan.
 * DB `Blocked` / `Done` tasks are excluded (`status === "In-progress"` only).
 */
export function carryForwardDueYesterdayTasks(
  tasks: TaskRowForStandup[],
  projectId: string,
  yesterdayYmd: string,
): TaskRowForStandup[] {
  return tasks.filter(
    (t) =>
      t.projectId === projectId &&
      t.status === "In-progress" &&
      utcYmd(t.dueDate) === yesterdayYmd,
  );
}
