export type SupervisorTaskState =
  | "In-progress"
  | "Blocked"
  | "Overdue"
  | "Backlog"
  | "Done";

function startOfUtcDay(input: string | Date): Date {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function endOfWorkWeekUtc(input: string | Date): Date {
  const day = startOfUtcDay(input);
  const weekday = day.getUTCDay();
  const mondayIndex = weekday === 0 ? 6 : weekday - 1;
  const friday = new Date(day.getTime());
  friday.setUTCDate(friday.getUTCDate() + (4 - mondayIndex));
  return friday;
}

export function deriveSupervisorTaskState(task: {
  status: string;
  dueDate: string;
}): SupervisorTaskState {
  if (task.status === "Done") {
    return "Done";
  }

  const today = startOfUtcDay(new Date());
  const dueDate = startOfUtcDay(task.dueDate);
  if (dueDate.getTime() < today.getTime()) {
    return "Overdue";
  }

  const weekEnd = endOfWorkWeekUtc(today);
  if (dueDate.getTime() > weekEnd.getTime()) {
    return "Backlog";
  }

  if (task.status === "Blocked") {
    return "Blocked";
  }

  return "In-progress";
}

export function isCurrentUiTaskState(state: SupervisorTaskState): boolean {
  return state === "In-progress" || state === "Blocked" || state === "Overdue";
}
