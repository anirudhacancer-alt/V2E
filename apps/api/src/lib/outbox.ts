/**
 * Transactional outbox (§17): enqueue domain events on the same DB as writes;
 * `processOutboxBatch` delivers in-app notifications without blocking HTTP handlers.
 */

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull, lte, or } from "drizzle-orm";
import type { DemoDb } from "@v2e/database";
import {
  auditEvents,
  commitments,
  deviceTokens,
  emailQueue,
  deliveryAttempts,
  notifications,
  notificationPreferences,
  outboxEvents,
  pushQueue,
  tasks,
  teamMembers,
  users,
} from "@v2e/database";

const MAX_BATCH = 20;
const MAX_ATTEMPTS = 8;

export async function enqueueOutboxEvent(
  db: DemoDb,
  input: {
    tenantId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(outboxEvents).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    eventType: input.eventType,
    payload: JSON.stringify(input.payload),
    status: "pending",
    attempts: 0,
    nextAttemptAt: null,
    processedAt: null,
    lastError: null,
    createdAt: now,
  });
}

async function insertSystemAuditEvent(
  db: DemoDb,
  input: {
    eventType: string;
    projectId?: string | null;
    siteId?: string | null;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  await db.insert(auditEvents).values({
    id: randomUUID(),
    occurredAt: now,
    eventType: input.eventType,
    projectId: input.projectId ?? null,
    siteId: input.siteId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    actor: "system",
    payload: JSON.stringify({
      ...(input.siteId ? { siteId: input.siteId } : {}),
      ...input.payload,
    }),
  });
  await enqueueOutboxEvent(db, {
    tenantId: "demo",
    eventType: input.eventType,
    payload: {
      projectId: input.projectId ?? null,
      siteId: input.siteId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      actor: "system",
      ...input.payload,
    },
  });
}

async function emitOverdueTaskEvents(db: DemoDb): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const existingRows = await db
    .select({ entityId: auditEvents.entityId })
    .from(auditEvents)
    .where(eq(auditEvents.eventType, "task.overdue"));
  const existingIds = new Set(existingRows.map((row) => row.entityId));

  const taskRows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      siteId: tasks.siteId,
      title: tasks.title,
      ownerId: tasks.ownerId,
      dueDate: tasks.dueDate,
      status: tasks.status,
    })
    .from(tasks);

  for (const task of taskRows) {
    const normalizedStatus = (task.status ?? "").toLowerCase();
    if (
      existingIds.has(task.id) ||
      task.dueDate >= today ||
      normalizedStatus === "done" ||
      normalizedStatus === "canceled" ||
      normalizedStatus === "cancelled"
    ) {
      continue;
    }

    const [owner] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.id, task.ownerId))
      .limit(1);

    await insertSystemAuditEvent(db, {
      eventType: "task.overdue",
      projectId: task.projectId,
      siteId: task.siteId,
      entityType: "task",
      entityId: task.id,
      payload: {
        title: task.title,
        ownerId: task.ownerId,
        dueDate: task.dueDate,
        notifyUserId: owner?.userId ?? null,
      },
    });
  }
}

async function resolveRecipientUserId(
  db: DemoDb,
  row: { eventType: string; payload: string }
): Promise<string | undefined> {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const entityId =
    typeof payload.entityId === "string" ? payload.entityId : undefined;
  const direct =
    typeof payload.notifyUserId === "string" ? payload.notifyUserId : undefined;
  if (direct) {
    return direct;
  }

  if (row.eventType.startsWith("task.") && entityId) {
    const [task] = await db
      .select({ ownerId: tasks.ownerId })
      .from(tasks)
      .where(eq(tasks.id, entityId))
      .limit(1);
    if (!task) return undefined;
    const [owner] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.id, task.ownerId))
      .limit(1);
    return owner?.userId ?? undefined;
  }

  if (row.eventType.startsWith("commitment.") && entityId) {
    const [commitment] = await db
      .select({ ownerId: commitments.ownerId })
      .from(commitments)
      .where(eq(commitments.id, entityId))
      .limit(1);
    if (!commitment) return undefined;
    const [owner] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.id, commitment.ownerId))
      .limit(1);
    return owner?.userId ?? undefined;
  }

  return undefined;
}

async function getChannelPreference(
  db: DemoDb,
  userId: string,
  channel: "in_app" | "email" | "push",
  eventType: string
): Promise<boolean> {
  const [pref] = await db
    .select({ isEnabled: notificationPreferences.isEnabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.eventType, eventType)
      )
    )
    .limit(1);

  if (channel === "in_app") {
    return pref ? pref.isEnabled === 1 : true;
  }
  return pref ? pref.isEnabled === 1 : false;
}

function buildNotificationText(
  row: { eventType: string },
  payload: Record<string, unknown>
) {
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : `Event: ${row.eventType}`;
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : `${row.eventType}${typeof payload.entityId === "string" ? ` (${payload.entityId})` : ""}`;
  return { title, body };
}

/**
 * Process pending outbox rows: optional in-app notification, then mark delivered.
 */
export async function processOutboxBatch(
  db: DemoDb,
  opts?: { limit?: number }
): Promise<{ processed: number; errors: number }> {
  await emitOverdueTaskEvents(db);

  const limit = Math.min(opts?.limit ?? MAX_BATCH, MAX_BATCH);
  const now = new Date().toISOString();

  const pending = await db
    .select()
    .from(outboxEvents)
    .where(
      and(
        eq(outboxEvents.status, "pending"),
        or(
          isNull(outboxEvents.nextAttemptAt),
          lte(outboxEvents.nextAttemptAt, now)
        )
      )
    )
    .orderBy(asc(outboxEvents.createdAt))
    .limit(limit);

  let processed = 0;
  let errors = 0;

  for (const row of pending) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const notifyUserId = await resolveRecipientUserId(db, row);

      if (notifyUserId) {
        const [userRow] = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.id, notifyUserId))
          .limit(1);

        if (userRow) {
          const { title, body } = buildNotificationText(row, payload);
          const inAppEnabled = await getChannelPreference(
            db,
            notifyUserId,
            "in_app",
            row.eventType
          );
          const emailEnabled = await getChannelPreference(
            db,
            notifyUserId,
            "email",
            row.eventType
          );
          const pushEnabled = await getChannelPreference(
            db,
            notifyUserId,
            "push",
            row.eventType
          );

          let notificationId: string | null = null;
          if (inAppEnabled) {
            notificationId = randomUUID();
            await db.insert(notifications).values({
              id: notificationId,
              tenantId: row.tenantId,
              userId: notifyUserId,
              type: row.eventType,
              title,
              body,
              entityType:
                typeof payload.entityType === "string" ? payload.entityType : undefined,
              entityId: typeof payload.entityId === "string" ? payload.entityId : null,
              status: "unread",
              createdAt: now,
              readAt: null,
            });
            await db.insert(deliveryAttempts).values({
              id: randomUUID(),
              notificationId,
              channel: "in_app",
              status: "success",
              attemptedAt: now,
              providerResponse: JSON.stringify({ source: "outbox" }),
            });
          }

          if (emailEnabled && userRow.email) {
            await db.insert(emailQueue).values({
              id: randomUUID(),
              tenantId: row.tenantId,
              notificationId,
              toEmail: userRow.email,
              ccEmails: null,
              subject: title,
              bodyText: body,
              bodyHtml: null,
              templateId: null,
              templateVars: JSON.stringify(payload),
              status: "pending",
              attempts: 0,
              nextAttemptAt: null,
              sentAt: null,
              providerMessageId: null,
              lastError: null,
              createdAt: now,
            });
          }

          if (pushEnabled) {
            const tokens = await db
              .select({
                token: deviceTokens.token,
                platform: deviceTokens.platform,
              })
              .from(deviceTokens)
              .where(
                and(
                  eq(deviceTokens.userId, notifyUserId),
                  eq(deviceTokens.isActive, 1)
                )
              );
            for (const token of tokens) {
              await db.insert(pushQueue).values({
                id: randomUUID(),
                tenantId: row.tenantId,
                notificationId,
                userId: notifyUserId,
                deviceToken: token.token,
                platform: token.platform,
                title,
                body,
                data: JSON.stringify(payload),
                badge: null,
                sound: null,
                status: "pending",
                attempts: 0,
                nextAttemptAt: null,
                sentAt: null,
                providerMessageId: null,
                lastError: null,
                createdAt: now,
              });
            }
          }
        }
      }

      await db
        .update(outboxEvents)
        .set({
          status: "delivered",
          processedAt: now,
          lastError: null,
        })
        .where(eq(outboxEvents.id, row.id));
      processed += 1;
    } catch (e) {
      errors += 1;
      const message = e instanceof Error ? e.message : String(e);
      const nextAttempts = row.attempts + 1;
      const failed = nextAttempts >= MAX_ATTEMPTS;
      const backoffMs = Math.min(300_000, 2000 * 2 ** Math.min(nextAttempts, 8));
      await db
        .update(outboxEvents)
        .set({
          status: failed ? "failed" : "pending",
          attempts: nextAttempts,
          lastError: message,
          nextAttemptAt: failed
            ? null
            : new Date(Date.now() + backoffMs).toISOString(),
        })
        .where(eq(outboxEvents.id, row.id));
    }
  }

  return { processed, errors };
}

/** Test hook: count rows by status. */
export async function countOutboxByStatus(
  db: DemoDb,
  status: string
): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(outboxEvents)
    .where(eq(outboxEvents.status, status));
  return Number(r?.n ?? 0);
}
