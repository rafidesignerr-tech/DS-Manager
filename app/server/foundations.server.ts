import { and, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { can, type Actor } from "~/domain/permissions";
import { getToken } from "~/foundations/model";
import { POLICY } from "~/config/hub";
import type { Database } from "./db";
import { schema } from "./db";

const { tokenTracking, activityEvent, user } = schema;

export const TRACK_STATUSES = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In progress" },
  { id: "in_review", label: "In review" },
  { id: "done", label: "Done" },
] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number]["id"];
export const TRACK_STATUS_IDS = TRACK_STATUSES.map((s) => s.id) as [TrackStatus, ...TrackStatus[]];
export const PLATFORMS = [
  { id: "design", label: "Design", column: "designStatus" },
  { id: "web", label: "Web", column: "webStatus" },
  { id: "mobile", label: "Mobile", column: "mobileStatus" },
] as const;
export type Platform = (typeof PLATFORMS)[number]["id"];

export function trackStatusLabel(id: string): string {
  return TRACK_STATUSES.find((s) => s.id === id)?.label ?? id;
}

export interface Tracking {
  tokenId: string;
  designStatus: TrackStatus;
  webStatus: TrackStatus;
  mobileStatus: TrackStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  notes: string;
  docsUrl: string | null;
  updatedAt: Date | null;
}

export const EMPTY_TRACKING: Omit<Tracking, "tokenId"> = {
  designStatus: "todo",
  webStatus: "todo",
  mobileStatus: "todo",
  assigneeId: null,
  assigneeName: null,
  notes: "",
  docsUrl: null,
  updatedAt: null,
};

/** Tracking rows for the given tokens (missing rows mean "not started"). */
export async function trackingFor(db: Database, tokenIds: string[]): Promise<Map<string, Tracking>> {
  const out = new Map<string, Tracking>();
  if (!tokenIds.length) return out;
  const assignee = alias(user, "assignee");
  // D1 caps bound parameters per query, so look up in chunks.
  for (let i = 0; i < tokenIds.length; i += 90) {
    const chunk = tokenIds.slice(i, i + 90);
    const rows = await db
      .select({ row: tokenTracking, assigneeName: assignee.name })
      .from(tokenTracking)
      .leftJoin(assignee, eq(assignee.id, tokenTracking.assigneeId))
      .where(inArray(tokenTracking.tokenId, chunk));
    for (const { row, assigneeName } of rows) {
      out.set(row.tokenId, {
        tokenId: row.tokenId,
        designStatus: row.designStatus,
        webStatus: row.webStatus,
        mobileStatus: row.mobileStatus,
        assigneeId: row.assigneeId,
        assigneeName,
        notes: row.notes,
        docsUrl: row.docsUrl,
        updatedAt: row.updatedAt,
      });
    }
  }
  return out;
}

export async function allTracking(db: Database) {
  return db.select().from(tokenTracking);
}

export const trackingUpdateSchema = z.object({
  designStatus: z.enum(TRACK_STATUS_IDS).optional(),
  webStatus: z.enum(TRACK_STATUS_IDS).optional(),
  mobileStatus: z.enum(TRACK_STATUS_IDS).optional(),
  assigneeId: z
    .string()
    .max(64)
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  notes: z.string().max(5000, "Keep notes under 5,000 characters.").optional(),
  docsUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null))
    .refine((v) => v == null || /^https?:\/\//i.test(v), "Use a full link starting with https://"),
});
export type TrackingUpdate = z.infer<typeof trackingUpdateSchema>;

export class TrackingError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

const FIELD_LABELS: Record<string, string> = {
  designStatus: "design",
  webStatus: "web",
  mobileStatus: "mobile",
  assigneeId: "assignee",
  notes: "notes",
  docsUrl: "docs link",
};

/** Saves tracking for one token and records each changed field in the activity log. */
export async function updateTracking(db: Database, actor: Actor, tokenId: string, change: TrackingUpdate) {
  if (!can(actor, "foundation.track")) throw new TrackingError(403, "You can't update token tracking.");
  if (!getToken(tokenId)) throw new TrackingError(404, "This token doesn't exist in the current tokens file.");
  if (change.assigneeId) {
    const member = await db.query.user.findFirst({ where: and(eq(user.id, change.assigneeId), eq(user.status, "active")) });
    if (!member) throw new TrackingError(400, "Choose an active team member.");
  }
  const current = (await db.query.tokenTracking.findFirst({ where: eq(tokenTracking.tokenId, tokenId) })) ?? {
    tokenId,
    ...EMPTY_TRACKING,
  };
  const fields = (Object.keys(change) as (keyof TrackingUpdate)[]).filter(
    (k) => change[k] !== undefined && change[k] !== (current as Record<string, unknown>)[k],
  );
  if (!fields.length) return;

  const names = new Map<string, string>();
  if (fields.includes("assigneeId")) {
    const ids = [current.assigneeId, change.assigneeId].filter((x): x is string => !!x);
    if (ids.length) for (const m of await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids))) names.set(m.id, m.name);
  }
  const show = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    if (field === "assigneeId") return names.get(String(v)) ?? "Former member";
    if (field.endsWith("Status")) return trackStatusLabel(String(v));
    if (field === "notes") return String(v).slice(0, 120);
    return String(v);
  };

  const values = Object.fromEntries(fields.map((f) => [f, change[f]]));
  await db.batch([
    db
      .insert(tokenTracking)
      .values({ tokenId, ...EMPTY_TRACKING, ...pickRow(current), ...values, updatedById: actor.id, updatedAt: new Date() })
      .onConflictDoUpdate({ target: tokenTracking.tokenId, set: { ...values, updatedById: actor.id, updatedAt: new Date() } }),
    db.insert(activityEvent).values(
      fields.map((f) => ({
        actorId: actor.id,
        targetType: "token",
        targetId: tokenId,
        action: "changed",
        field: FIELD_LABELS[f] ?? f,
        fromValue: show(f, (current as Record<string, unknown>)[f]),
        toValue: show(f, change[f]),
      })),
    ),
  ]);
}

function pickRow(row: Record<string, unknown>) {
  return {
    designStatus: row.designStatus as TrackStatus,
    webStatus: row.webStatus as TrackStatus,
    mobileStatus: row.mobileStatus as TrackStatus,
    assigneeId: (row.assigneeId as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    docsUrl: (row.docsUrl as string | null) ?? null,
  };
}

/** The Updates log: every tracking change, newest first. */
export async function listUpdates(db: Database, opts: { page: number; tokenId?: string }) {
  const where = opts.tokenId
    ? and(eq(activityEvent.targetType, "token"), eq(activityEvent.targetId, opts.tokenId))
    : eq(activityEvent.targetType, "token");
  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: activityEvent.id,
        tokenId: activityEvent.targetId,
        field: activityEvent.field,
        fromValue: activityEvent.fromValue,
        toValue: activityEvent.toValue,
        createdAt: activityEvent.createdAt,
        actorName: user.name,
        actorImage: user.image,
      })
      .from(activityEvent)
      .leftJoin(user, eq(user.id, activityEvent.actorId))
      .where(where)
      .orderBy(desc(activityEvent.createdAt))
      .limit(POLICY.pageSize)
      .offset((opts.page - 1) * POLICY.pageSize),
    db.select({ n: count() }).from(activityEvent).where(where),
  ]);
  return { items, total: totalRow?.n ?? 0, pageSize: POLICY.pageSize };
}
