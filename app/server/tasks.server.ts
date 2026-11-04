import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { POLICY } from "~/config/hub";
import { can, type Actor } from "~/domain/permissions";
import {
  allowedStatusTransitions,
  canComment,
  canEditField,
  canModifyComment,
  canSelfAssign,
  normalizeTaskChange,
  PRIORITY_IDS,
  STATUS_IDS,
  statusLabel,
  type TaskChange,
  type TaskField,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
  TRACKED_FIELDS,
} from "~/domain/tasks";
import { taskEventRecipients, type NotificationDraft } from "~/domain/notifications";
import type { Database } from "./db";
import { schema } from "./db";
import { notificationInserts } from "./notifications.server";

const { task, user, comment, activityEvent, taskReference, referenceItem } = schema;

/* ------------------------------ filters ------------------------------ */

export const taskFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.array(z.enum(STATUS_IDS as [TaskStatus, ...TaskStatus[]])).catch([]),
  priority: z.array(z.enum(PRIORITY_IDS as [TaskPriority, ...TaskPriority[]])).catch([]),
  assignee: z.string().max(64).catch(""),
  due: z.enum(["", "overdue", "due_soon"]).catch(""),
  archived: z.enum(["", "1"]).catch(""),
  sort: z.enum(["updated", "created", "due", "priority", "title"]).catch("updated"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
  group: z.enum(["none", "status", "priority", "assignee"]).catch("none"),
  view: z.enum(["list", "board"]).catch("list"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export function parseTaskFilters(url: URL): TaskFilters {
  const p = url.searchParams;
  return taskFiltersSchema.parse({
    q: p.get("q") ?? "",
    status: p.getAll("status"),
    priority: p.getAll("priority"),
    assignee: p.get("assignee") ?? "",
    due: p.get("due") ?? "",
    archived: p.get("archived") ?? "",
    sort: p.get("sort") ?? undefined,
    dir: p.get("dir") ?? undefined,
    group: p.get("group") ?? undefined,
    view: p.get("view") ?? undefined,
    page: p.get("page") ?? 1,
  });
}

const priorityRankSql = sql<number>`case ${task.priority} when 'urgent' then 3 when 'high' then 2 when 'medium' then 1 else 0 end`;

function whereFor(filters: TaskFilters, actor: Actor): SQL | undefined {
  const where: (SQL | undefined)[] = [filters.archived ? isNotNull(task.archivedAt) : isNull(task.archivedAt)];
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(sql`${task.title} like ${term} escape '\\'`, sql`cast(${task.number} as text) = ${filters.q.replace(/^#/, "")}`));
  }
  if (filters.status.length) where.push(inArray(task.status, filters.status));
  if (filters.priority.length) where.push(inArray(task.priority, filters.priority));
  if (filters.assignee === "me") where.push(eq(task.assigneeId, actor.id));
  else if (filters.assignee === "unassigned") where.push(isNull(task.assigneeId));
  else if (filters.assignee) where.push(eq(task.assigneeId, filters.assignee));
  const today = new Date().toISOString().slice(0, 10);
  if (filters.due === "overdue") where.push(and(isNotNull(task.dueDate), lt(task.dueDate, today), ne(task.status, "done")));
  if (filters.due === "due_soon") {
    const soon = new Date(Date.now() + POLICY.dueSoonDays * 86_400_000).toISOString().slice(0, 10);
    where.push(and(isNotNull(task.dueDate), sql`${task.dueDate} between ${today} and ${soon}`, ne(task.status, "done")));
  }
  return and(...where);
}

function orderFor(filters: TaskFilters): SQL[] {
  const dir = filters.dir === "asc" ? asc : desc;
  switch (filters.sort) {
    case "created":
      return [dir(task.createdAt)];
    case "due":
      // Tasks without a due date always sort last.
      return [sql`${task.dueDate} is null`, dir(task.dueDate), desc(task.updatedAt)];
    case "priority":
      return [dir(priorityRankSql), desc(task.updatedAt)];
    case "title":
      return [dir(sql`lower(${task.title})`)];
    default:
      return [dir(task.updatedAt)];
  }
}

const assignee = alias(user, "assignee");

const listColumns = {
  id: task.id,
  number: task.number,
  title: task.title,
  status: task.status,
  priority: task.priority,
  progress: task.progress,
  dueDate: task.dueDate,
  blockerReason: task.blockerReason,
  assigneeId: task.assigneeId,
  assigneeName: assignee.name,
  assigneeImage: assignee.image,
  updatedAt: task.updatedAt,
  createdAt: task.createdAt,
  archivedAt: task.archivedAt,
};

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>["items"][number];

export async function listTasks(db: Database, actor: Actor, filters: TaskFilters) {
  const where = whereFor(filters, actor);
  const [items, [totalRow]] = await Promise.all([
    db
      .select(listColumns)
      .from(task)
      .leftJoin(assignee, eq(assignee.id, task.assigneeId))
      .where(where)
      .orderBy(...orderFor(filters))
      .limit(POLICY.pageSize)
      .offset((filters.page - 1) * POLICY.pageSize),
    db.select({ n: count() }).from(task).where(where),
  ]);
  return { items, total: totalRow?.n ?? 0, pageSize: POLICY.pageSize };
}

/** Board view: the same filters, grouped by status, capped per column. */
export async function boardTasks(db: Database, actor: Actor, filters: TaskFilters) {
  const statuses = filters.status.length ? filters.status : STATUS_IDS;
  const columns = await Promise.all(
    statuses.map(async (status) => {
      const where = and(whereFor({ ...filters, status: [status] }, actor));
      const [items, [totalRow]] = await Promise.all([
        db
          .select(listColumns)
          .from(task)
          .leftJoin(assignee, eq(assignee.id, task.assigneeId))
          .where(where)
          .orderBy(...orderFor(filters))
          .limit(POLICY.boardColumnLimit),
        db.select({ n: count() }).from(task).where(where),
      ]);
      return { status, items, total: totalRow?.n ?? 0 };
    }),
  );
  return columns;
}

export async function listMembers(db: Database) {
  return db
    .select({ id: user.id, name: user.name, image: user.image, role: user.role, status: user.status })
    .from(user)
    .orderBy(asc(user.name));
}

/* ------------------------------ detail ------------------------------ */

function toRecord(row: typeof task.$inferSelect): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    progress: row.progress,
    assigneeId: row.assigneeId,
    createdById: row.createdById,
    dueDate: row.dueDate,
    blockerReason: row.blockerReason,
    archivedAt: row.archivedAt,
  };
}

export async function getTaskRow(db: Database, id: string) {
  return db.query.task.findFirst({ where: eq(task.id, id) });
}

export async function getTaskDetail(db: Database, actor: Actor, id: string) {
  const row = await getTaskRow(db, id);
  if (!row) return null;
  const creator = alias(user, "creator");
  const actorUser = alias(user, "actor_user");
  const [people, comments, activity, related] = await Promise.all([
    db
      .select({ assigneeName: assignee.name, assigneeImage: assignee.image, creatorName: creator.name })
      .from(task)
      .leftJoin(assignee, eq(assignee.id, task.assigneeId))
      .leftJoin(creator, eq(creator.id, task.createdById))
      .where(eq(task.id, id)),
    db
      .select({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        editedAt: comment.editedAt,
        deletedAt: comment.deletedAt,
        authorId: comment.authorId,
        authorName: user.name,
        authorImage: user.image,
      })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(and(eq(comment.targetType, "task"), eq(comment.targetId, id)))
      .orderBy(asc(comment.createdAt)),
    db
      .select({
        id: activityEvent.id,
        action: activityEvent.action,
        field: activityEvent.field,
        fromValue: activityEvent.fromValue,
        toValue: activityEvent.toValue,
        createdAt: activityEvent.createdAt,
        actorName: actorUser.name,
      })
      .from(activityEvent)
      .leftJoin(actorUser, eq(actorUser.id, activityEvent.actorId))
      .where(and(eq(activityEvent.targetType, "task"), eq(activityEvent.targetId, id)))
      .orderBy(asc(activityEvent.createdAt)),
    db
      .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind })
      .from(taskReference)
      .innerJoin(referenceItem, eq(referenceItem.id, taskReference.referenceId))
      .where(eq(taskReference.taskId, id)),
  ]);
  const record = toRecord(row);
  const now = new Date();
  const editable = Object.fromEntries(
    (["title", "description", "status", "priority", "progress", "assigneeId", "dueDate", "relatedItemIds"] as TaskField[]).map(
      (f) => [f, canEditField(actor, record, f)],
    ),
  ) as Record<TaskField, boolean>;

  return {
    task: { ...row, ...people[0] },
    comments: comments.map((c) => ({ ...c, canModify: !c.deletedAt && canModifyComment(actor, c, now) })),
    activity,
    related,
    permissions: {
      editable,
      statusOptions: allowedStatusTransitions(actor, record),
      canSelfAssign: canSelfAssign(actor, record),
      canComment: canComment(actor, record),
      canArchive: can(actor, "task.archive") && !row.archivedAt,
      canRestore: can(actor, "task.archive") && !!row.archivedAt,
    },
  };
}

/* ------------------------------ writes ------------------------------ */

export class TaskError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160, "Keep the title under 160 characters."),
  description: z.string().trim().max(10_000).default(""),
  status: z.enum(["backlog", "todo"]).default("backlog"),
  priority: z.enum(PRIORITY_IDS as [TaskPriority, ...TaskPriority[]]).default("medium"),
  assigneeId: z.string().max(64).optional().transform((v) => v || null),
  dueDate: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date."),
  relatedItemIds: z.array(z.string().max(64)).max(20).default([]),
});

async function assertMember(db: Database, userId: string | null) {
  if (!userId) return;
  const member = await db.query.user.findFirst({ where: and(eq(user.id, userId), eq(user.status, "active")) });
  if (!member) throw new TaskError(400, "Choose an active team member.", { assigneeId: "Choose an active team member." });
}

async function validReferenceIds(db: Database, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select({ id: referenceItem.id }).from(referenceItem).where(inArray(referenceItem.id, ids));
  return rows.map((r) => r.id);
}

export async function createTask(db: Database, actor: Actor, input: z.infer<typeof createTaskSchema>) {
  if (!can(actor, "task.create")) throw new TaskError(403, "Only managers can create tasks.");
  await assertMember(db, input.assigneeId);
  const id = crypto.randomUUID();
  const refs = await validReferenceIds(db, input.relatedItemIds);
  const statements = [
    db.insert(task).values({
      id,
      number: sql`(select coalesce(max(${task.number}), 0) + 1 from ${task})`,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      createdById: actor.id,
    }),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "task", targetId: id, action: "created" }),
    ...(refs.length ? [db.insert(taskReference).values(refs.map((referenceId) => ({ taskId: id, referenceId })))] : []),
    ...notificationInserts(
      db,
      taskEventRecipients("task_assigned", { assigneeId: input.assigneeId, createdById: actor.id, participantIds: [] }, actor.id).map(
        (recipientId): NotificationDraft => ({
          recipientId,
          event: "task_assigned",
          targetType: "task",
          targetId: id,
          title: input.title,
        }),
      ),
      actor.id,
    ),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
  return id;
}

async function participantIds(db: Database, taskId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: comment.authorId })
    .from(comment)
    .where(and(eq(comment.targetType, "task"), eq(comment.targetId, taskId)));
  return rows.map((r) => r.id);
}

function displayValue(field: string, value: unknown, names: Map<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field === "assigneeId") return names.get(String(value)) ?? "Former member";
  return String(value);
}

/**
 * Updates a task. Every field is checked against the actor's permissions on the
 * server; the interface only mirrors these rules.
 */
export async function updateTask(
  db: Database,
  actor: Actor,
  id: string,
  rawChange: TaskChange,
  relatedItemIds?: string[],
) {
  const row = await getTaskRow(db, id);
  if (!row) throw new TaskError(404, "This task no longer exists.");
  const record = toRecord(row);

  const changedFields = (Object.keys(rawChange) as (keyof TaskChange)[]).filter(
    (k) => rawChange[k] !== undefined && rawChange[k] !== record[k],
  );
  for (const field of changedFields) {
    // Blocker reason travels with a status change; it is checked through "status".
    const checked: TaskField = field === "blockerReason" ? "status" : field;
    if (!canEditField(actor, record, checked)) throw new TaskError(403, "You can't change this field on this task.");
  }
  if (relatedItemIds && !canEditField(actor, record, "relatedItemIds")) {
    throw new TaskError(403, "You can't change related items on this task.");
  }
  if (rawChange.status && rawChange.status !== record.status && !allowedStatusTransitions(actor, record).includes(rawChange.status)) {
    throw new TaskError(403, `You can't move this task to ${statusLabel(rawChange.status)}.`);
  }
  if (rawChange.assigneeId !== undefined && rawChange.assigneeId !== record.assigneeId) {
    await assertMember(db, rawChange.assigneeId);
  }

  const onlyChanged: TaskChange = Object.fromEntries(changedFields.map((f) => [f, rawChange[f]]));
  const { change, result } = normalizeTaskChange(record, onlyChanged);
  if (!result.ok) throw new TaskError(400, "Check the highlighted fields.", result.errors);

  const finalFields = (Object.keys(change) as (keyof TaskChange)[]).filter((k) => change[k] !== record[k]);
  if (!finalFields.length && !relatedItemIds) return;

  const memberRows = await listMembers(db);
  const names = new Map(memberRows.map((m) => [m.id, m.name]));
  const after: TaskRecord = { ...record, ...change };

  const activities: (typeof activityEvent.$inferInsert)[] = finalFields
    .filter((f): f is (typeof TRACKED_FIELDS)[number] => (TRACKED_FIELDS as readonly string[]).includes(f))
    .filter((f) => !(f === "blockerReason" && change.blockerReason === null))
    .map((field) => ({
      actorId: actor.id,
      targetType: "task",
      targetId: id,
      action: field === "assigneeId" ? (change.assigneeId ? "assigned" : "unassigned") : "changed",
      field,
      fromValue: displayValue(field, record[field], names),
      toValue: displayValue(field, after[field], names),
    }));
  if (relatedItemIds) {
    activities.push({ actorId: actor.id, targetType: "task", targetId: id, action: "changed", field: "relatedItems", fromValue: null, toValue: null });
  }

  const audience = { assigneeId: after.assigneeId, createdById: record.createdById, participantIds: await participantIds(db, id) };
  const drafts: NotificationDraft[] = [];
  const push = (event: Parameters<typeof taskEventRecipients>[0]) =>
    taskEventRecipients(event, audience, actor.id, record.assigneeId).forEach((recipientId) =>
      drafts.push({ recipientId, event, targetType: "task", targetId: id, title: after.title }),
    );
  if (finalFields.includes("assigneeId") && after.assigneeId) push("task_assigned");
  if (finalFields.includes("status")) {
    if (after.status === "blocked") push("task_blocked");
    else if (record.status === "blocked") push("task_unblocked");
    else if (!finalFields.includes("assigneeId")) push("task_status_changed");
  }

  const refs = relatedItemIds ? await validReferenceIds(db, relatedItemIds) : null;
  const statements = [
    db.update(task).set({ ...change, updatedAt: new Date() }).where(eq(task.id, id)),
    ...(activities.length ? [db.insert(activityEvent).values(activities)] : []),
    ...(refs ? [db.delete(taskReference).where(eq(taskReference.taskId, id))] : []),
    ...(refs?.length ? [db.insert(taskReference).values(refs.map((referenceId) => ({ taskId: id, referenceId })))] : []),
    ...notificationInserts(db, dedupe(drafts), actor.id),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

function dedupe(drafts: NotificationDraft[]): NotificationDraft[] {
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const key = `${d.recipientId}:${d.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function selfAssign(db: Database, actor: Actor, id: string) {
  const row = await getTaskRow(db, id);
  if (!row) throw new TaskError(404, "This task no longer exists.");
  if (!canSelfAssign(actor, toRecord(row))) {
    throw new TaskError(409, row.assigneeId ? "Someone else already took this task." : "This task can't be claimed right now.");
  }
  // Conditional update guards against two people claiming at the same moment.
  const result = await db
    .update(task)
    .set({ assigneeId: actor.id, updatedAt: new Date() })
    .where(and(eq(task.id, id), isNull(task.assigneeId)))
    .returning({ id: task.id });
  if (!result.length) throw new TaskError(409, "Someone else already took this task.");
  const notify = row.createdById !== actor.id
    ? [{ recipientId: row.createdById, event: "task_status_changed" as const, targetType: "task" as const, targetId: id, title: row.title }]
    : [];
  const statements = [
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "task", targetId: id, action: "self_assigned", field: "assigneeId", toValue: actor.name }),
    ...notificationInserts(db, notify, actor.id),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

export async function setArchived(db: Database, actor: Actor, id: string, archived: boolean) {
  if (!can(actor, "task.archive")) throw new TaskError(403, "Only managers can archive tasks.");
  const row = await getTaskRow(db, id);
  if (!row) throw new TaskError(404, "This task no longer exists.");
  await db.batch([
    db.update(task).set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() }).where(eq(task.id, id)),
    db.insert(activityEvent).values({ actorId: actor.id, targetType: "task", targetId: id, action: archived ? "archived" : "restored" }),
  ]);
}

/* ------------------------------ comments ------------------------------ */

export const commentSchema = z.string().trim().min(1, "Write a comment first.").max(5000, "Keep comments under 5,000 characters.");

export async function addComment(db: Database, actor: Actor, taskId: string, body: string) {
  const row = await getTaskRow(db, taskId);
  if (!row) throw new TaskError(404, "This task no longer exists.");
  if (!canComment(actor, toRecord(row))) throw new TaskError(403, "You can't comment on this task.");
  const participants = await participantIds(db, taskId);
  const drafts = taskEventRecipients(
    "task_comment_added",
    { assigneeId: row.assigneeId, createdById: row.createdById, participantIds: participants },
    actor.id,
  ).map((recipientId): NotificationDraft => ({ recipientId, event: "task_comment_added", targetType: "task", targetId: taskId, title: row.title }));
  const statements = [
    db.insert(comment).values({ targetType: "task", targetId: taskId, authorId: actor.id, body }),
    db.update(task).set({ updatedAt: new Date() }).where(eq(task.id, taskId)),
    ...notificationInserts(db, drafts, actor.id),
  ];
  await db.batch(statements as [(typeof statements)[number], ...(typeof statements)[number][]]);
}

async function loadComment(db: Database, actor: Actor, taskId: string, commentId: string) {
  const row = await db.query.comment.findFirst({
    where: and(eq(comment.id, commentId), eq(comment.targetId, taskId), isNull(comment.deletedAt)),
  });
  if (!row) throw new TaskError(404, "This comment no longer exists.");
  if (!canModifyComment(actor, row)) throw new TaskError(403, "You can't change this comment anymore.");
  return row;
}

export async function editComment(db: Database, actor: Actor, taskId: string, commentId: string, body: string) {
  await loadComment(db, actor, taskId, commentId);
  await db.update(comment).set({ body, editedAt: new Date() }).where(eq(comment.id, commentId));
}

/** Soft delete keeps the conversation history readable. */
export async function deleteComment(db: Database, actor: Actor, taskId: string, commentId: string) {
  await loadComment(db, actor, taskId, commentId);
  await db.update(comment).set({ deletedAt: new Date(), body: "" }).where(eq(comment.id, commentId));
}

/* ------------------------------ home ------------------------------ */

export async function recentTaskActivity(db: Database, limit = 8) {
  const actorUser = alias(user, "actor_user");
  return db
    .select({
      id: activityEvent.id,
      action: activityEvent.action,
      field: activityEvent.field,
      toValue: activityEvent.toValue,
      createdAt: activityEvent.createdAt,
      actorName: actorUser.name,
      actorImage: actorUser.image,
      taskId: task.id,
      taskNumber: task.number,
      taskTitle: task.title,
    })
    .from(activityEvent)
    .innerJoin(task, eq(task.id, activityEvent.targetId))
    .leftJoin(actorUser, eq(actorUser.id, activityEvent.actorId))
    .where(eq(activityEvent.targetType, "task"))
    .orderBy(desc(activityEvent.createdAt))
    .limit(limit);
}

export async function taskCountsByStatus(db: Database) {
  const rows = await db
    .select({ status: task.status, n: count() })
    .from(task)
    .where(isNull(task.archivedAt))
    .groupBy(task.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<TaskStatus, number>>;
}

export async function myOpenTaskCount(db: Database, actorId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(task)
    .where(and(eq(task.assigneeId, actorId), ne(task.status, "done"), isNull(task.archivedAt)));
  return row?.n ?? 0;
}

