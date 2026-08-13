/**
 * Resolve which task an update (transcript) belongs to for denormalized `update_attachments.taskId`:
 * human follow-up (`linkedTaskId`) or task spawned from this update (`tasks.sourceUpdateId`).
 */
export function buildSourceTaskIdByUpdateId(
  tasks: { id: string; sourceUpdateId: string | null }[]
): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tasks) {
    if (t.sourceUpdateId) {
      m.set(t.sourceUpdateId, t.id);
    }
  }
  return m;
}

export function resolveTaskIdForUpdate(
  update: { id: string; linkedTaskId: string | null },
  sourceTaskIdByUpdateId: Map<string, string>
): string | null {
  if (update.linkedTaskId) {
    return update.linkedTaskId;
  }
  return sourceTaskIdByUpdateId.get(update.id) ?? null;
}
