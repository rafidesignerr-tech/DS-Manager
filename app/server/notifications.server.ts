import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import type { NotificationDraft } from "~/domain/notifications";
import type { Database } from "./db";
import { schema } from "./db";

export function notificationInserts(db: Database, drafts: NotificationDraft[], actorId: string | null) {
  if (!drafts.length) return [];
  return [
    db.insert(schema.notification).values(
      drafts.map((d) => ({
        recipientId: d.recipientId,
        event: d.event,
        targetType: d.targetType,
        targetId: d.targetId,
        title: d.title,
        actorId,
      })),
    ),
  ];
}

export async function managerIds(db: Database, exceptId?: string | null): Promise<string[]> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(eq(schema.user.role, "manager"), eq(schema.user.status, "active")));
  return rows.map((r) => r.id).filter((id) => id !== exceptId);
}

export async function activeMemberIds(db: Database, exceptId?: string | null): Promise<string[]> {
  const rows = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.status, "active"));
  return rows.map((r) => r.id).filter((id) => id !== exceptId);
}

export async function unreadCount(db: Database, recipientId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.notification)
    .where(and(eq(schema.notification.recipientId, recipientId), isNull(schema.notification.readAt)));
  return row?.n ?? 0;
}

export async function listNotifications(
  db: Database,
  recipientId: string,
  opts: { unreadOnly: boolean; before?: Date; limit: number },
) {
  const where = [eq(schema.notification.recipientId, recipientId)];
  if (opts.unreadOnly) where.push(isNull(schema.notification.readAt));
  if (opts.before) where.push(lt(schema.notification.createdAt, opts.before));
  const rows = await db
    .select({
      id: schema.notification.id,
      event: schema.notification.event,
      targetType: schema.notification.targetType,
      targetId: schema.notification.targetId,
      title: schema.notification.title,
      readAt: schema.notification.readAt,
      createdAt: schema.notification.createdAt,
      actorName: schema.user.name,
      actorImage: schema.user.image,
    })
    .from(schema.notification)
    .leftJoin(schema.user, eq(schema.user.id, schema.notification.actorId))
    .where(and(...where))
    .orderBy(desc(schema.notification.createdAt))
    .limit(opts.limit + 1);
  return { items: rows.slice(0, opts.limit), hasMore: rows.length > opts.limit };
}

/** Marks notifications read. Scoped to the recipient, so nobody can mark another person's. */
export async function markRead(db: Database, recipientId: string, ids: string[] | "all") {
  const where = [eq(schema.notification.recipientId, recipientId), isNull(schema.notification.readAt)];
  if (ids !== "all") {
    if (!ids.length) return;
    where.push(inArray(schema.notification.id, ids));
  }
  await db.update(schema.notification).set({ readAt: new Date() }).where(and(...where));
}
