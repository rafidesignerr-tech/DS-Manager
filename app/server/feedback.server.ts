import { and, asc, count, desc, eq } from "drizzle-orm";
import { can, type Actor } from "~/domain/permissions";
import { FEEDBACK_STATUS_IDS, type FeedbackStatus, type FeedbackSubmission } from "~/domain/feedback";
import { POLICY } from "~/config/hub";
import type { Database } from "./db";
import { schema } from "./db";
import { managerIds, notificationInserts } from "./notifications.server";

const { feedback, feedbackNote, user, activityEvent } = schema;

export type SubmitResult = { status: "created" | "duplicate"; id: string };

/** Stores a submission privately. A repeated submissionId returns the original instead of a copy. */
export async function submitFeedback(db: Database, actor: Actor | null, input: FeedbackSubmission): Promise<SubmitResult> {
  const existing = await db.query.feedback.findFirst({ where: eq(feedback.submissionId, input.submissionId) });
  if (existing) return { status: "duplicate", id: existing.id };
  const id = crypto.randomUUID();
  const managers = await managerIds(db, actor?.id);
  const preview = input.message.length > 80 ? `${input.message.slice(0, 77)}…` : input.message;
  const statements = [
    db
      .insert(feedback)
      .values({
        id,
        submissionId: input.submissionId,
        topic: input.topic,
        message: input.message,
        contactEmail: input.contactEmail ?? null,
        submittedById: actor?.id ?? null,
      })
      .onConflictDoNothing({ target: feedback.submissionId }),
    ...notificationInserts(
      db,
      managers.map((recipientId) => ({ recipientId, event: "feedback_submitted" as const, targetType: "feedback" as const, targetId: id, title: preview })),
      actor?.id ?? null,
    ),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return { status: "created", id };
}

export async function listFeedback(db: Database, opts: { status: FeedbackStatus | ""; page: number }) {
  const where = opts.status ? eq(feedback.status, opts.status) : undefined;
  const [items, [totalRow], countsRows] = await Promise.all([
    db
      .select({
        id: feedback.id,
        topic: feedback.topic,
        message: feedback.message,
        status: feedback.status,
        hasContact: feedback.contactEmail,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(POLICY.pageSize)
      .offset((opts.page - 1) * POLICY.pageSize),
    db.select({ n: count() }).from(feedback).where(where),
    db.select({ status: feedback.status, n: count() }).from(feedback).groupBy(feedback.status),
  ]);
  return {
    items: items.map(({ hasContact, ...rest }) => ({ ...rest, hasContact: !!hasContact })),
    total: totalRow?.n ?? 0,
    pageSize: POLICY.pageSize,
    counts: Object.fromEntries(countsRows.map((r) => [r.status, r.n])) as Partial<Record<FeedbackStatus, number>>,
  };
}

export async function getFeedback(db: Database, actor: Actor, id: string) {
  const row = await db.query.feedback.findFirst({ where: eq(feedback.id, id) });
  if (!row) return null;
  const notes = await db
    .select({ id: feedbackNote.id, body: feedbackNote.body, createdAt: feedbackNote.createdAt, authorName: user.name, authorImage: user.image })
    .from(feedbackNote)
    .innerJoin(user, eq(user.id, feedbackNote.authorId))
    .where(eq(feedbackNote.feedbackId, id))
    .orderBy(asc(feedbackNote.createdAt));
  const history = await db
    .select({ id: activityEvent.id, fromValue: activityEvent.fromValue, toValue: activityEvent.toValue, createdAt: activityEvent.createdAt, actorName: user.name })
    .from(activityEvent)
    .leftJoin(user, eq(user.id, activityEvent.actorId))
    .where(and(eq(activityEvent.targetType, "feedback"), eq(activityEvent.targetId, id)))
    .orderBy(asc(activityEvent.createdAt));
  return {
    feedback: row,
    notes,
    history,
    permissions: { canTriage: can(actor, "feedback.triage"), canAddNote: can(actor, "feedback.addNote") },
  };
}

export async function setFeedbackStatus(db: Database, actor: Actor, id: string, status: FeedbackStatus) {
  if (!can(actor, "feedback.triage")) throw new Response("Forbidden", { status: 403 });
  if (!FEEDBACK_STATUS_IDS.includes(status)) throw new Response("Bad request", { status: 400 });
  const row = await db.query.feedback.findFirst({ where: eq(feedback.id, id) });
  if (!row) throw new Response("Not found", { status: 404 });
  if (row.status === status) return;
  await db.batch([
    db.update(feedback).set({ status, updatedAt: new Date() }).where(eq(feedback.id, id)),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "feedback", targetId: id, action: "changed", field: "status", fromValue: row.status, toValue: status }),
  ]);
}

export async function addFeedbackNote(db: Database, actor: Actor, id: string, body: string) {
  if (!can(actor, "feedback.addNote")) throw new Response("Forbidden", { status: 403 });
  const row = await db.query.feedback.findFirst({ where: eq(feedback.id, id) });
  if (!row) throw new Response("Not found", { status: 404 });
  await db.insert(feedbackNote).values({ feedbackId: id, authorId: actor.id, body });
}
