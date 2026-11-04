import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { POLICY } from "~/config/hub";
import { can, type Actor } from "~/domain/permissions";
import type { Database } from "./db";
import { schema } from "./db";
import { activeMemberIds, notificationInserts } from "./notifications.server";

const { changelogEntry, changelogReference, referenceItem, user, activityEvent } = schema;

export const changelogSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  summary: z.string().trim().min(1, "Add a short summary.").max(500, "Keep the summary under 500 characters."),
  details: z.string().trim().max(20_000).default(""),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  relatedItemIds: z.array(z.string().max(64)).max(20).default([]),
});
export type ChangelogInput = z.infer<typeof changelogSchema>;

/** Visitors and anyone without draft access only ever see published entries. */
export async function listChangelog(db: Database, actor: Actor | null, opts: { page: number; includeDrafts: boolean }) {
  const includeDrafts = opts.includeDrafts && can(actor, "changelog.viewDrafts");
  const where = includeDrafts ? undefined : eq(changelogEntry.status, "published");
  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: changelogEntry.id,
        title: changelogEntry.title,
        summary: changelogEntry.summary,
        entryDate: changelogEntry.entryDate,
        status: changelogEntry.status,
        isSample: changelogEntry.isSample,
      })
      .from(changelogEntry)
      .where(where)
      .orderBy(desc(changelogEntry.entryDate), desc(changelogEntry.createdAt))
      .limit(POLICY.pageSize)
      .offset((opts.page - 1) * POLICY.pageSize),
    db.select({ n: count() }).from(changelogEntry).where(where),
  ]);
  return { items, total: totalRow?.n ?? 0, pageSize: POLICY.pageSize };
}

export async function getChangelogEntry(db: Database, actor: Actor | null, id: string) {
  const row = await db
    .select({ entry: changelogEntry, authorName: user.name })
    .from(changelogEntry)
    .leftJoin(user, eq(user.id, changelogEntry.createdById))
    .where(eq(changelogEntry.id, id))
    .get();
  if (!row) return null;
  if (row.entry.status !== "published" && !can(actor, "changelog.viewDrafts")) return null;
  const related = await db
    .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind })
    .from(changelogReference)
    .innerJoin(referenceItem, eq(referenceItem.id, changelogReference.referenceId))
    .where(eq(changelogReference.entryId, id));
  return { ...row, related };
}

async function validRefs(db: Database, ids: string[]) {
  if (!ids.length) return [];
  return (await db.select({ id: referenceItem.id }).from(referenceItem).where(inArray(referenceItem.id, ids))).map((r) => r.id);
}

export async function saveChangelogDraft(db: Database, actor: Actor, input: ChangelogInput, id?: string) {
  if (!can(actor, "changelog.draft")) throw new Response("Forbidden", { status: 403 });
  const refs = await validRefs(db, input.relatedItemIds);
  const entryId = id ?? crypto.randomUUID();
  if (id) {
    const existing = await db.query.changelogEntry.findFirst({ where: eq(changelogEntry.id, id) });
    if (!existing) throw new Response("Not found", { status: 404 });
  }
  const values = { title: input.title, summary: input.summary, details: input.details, entryDate: input.entryDate };
  const statements = [
    id
      ? db.update(changelogEntry).set({ ...values, updatedAt: new Date() }).where(eq(changelogEntry.id, id))
      : db.insert(changelogEntry).values({ id: entryId, ...values, createdById: actor.id }),
    db.delete(changelogReference).where(eq(changelogReference.entryId, entryId)),
    ...(refs.length ? [db.insert(changelogReference).values(refs.map((referenceId) => ({ entryId, referenceId })))] : []),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return entryId;
}

export async function setChangelogPublished(db: Database, actor: Actor, id: string, publish: boolean) {
  if (!can(actor, "changelog.publish")) throw new Response("Forbidden", { status: 403 });
  const row = await db.query.changelogEntry.findFirst({ where: eq(changelogEntry.id, id) });
  if (!row) throw new Response("Not found", { status: 404 });
  const isPublished = row.status === "published";
  if (isPublished === publish) return;
  const recipients = publish ? await activeMemberIds(db, actor.id) : [];
  const statements = [
    db
      .update(changelogEntry)
      .set({ status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null, updatedAt: new Date() })
      .where(eq(changelogEntry.id, id)),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "changelog", targetId: id, action: publish ? "published" : "unpublished" }),
    ...notificationInserts(
      db,
      recipients.map((recipientId) => ({ recipientId, event: "changelog_published" as const, targetType: "changelog" as const, targetId: id, title: row.title })),
      actor.id,
    ),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

export async function deleteChangelogDraft(db: Database, actor: Actor, id: string) {
  if (!can(actor, "changelog.publish")) throw new Response("Forbidden", { status: 403 });
  const row = await db.query.changelogEntry.findFirst({ where: eq(changelogEntry.id, id) });
  if (!row) throw new Response("Not found", { status: 404 });
  if (row.status === "published") throw new Response("Unpublish the entry before deleting it.", { status: 409 });
  await db.delete(changelogEntry).where(and(eq(changelogEntry.id, id), eq(changelogEntry.status, "draft")));
}
