import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { POLICY } from "~/config/hub";
import type { Database } from "./db";
import { schema } from "./db";

const { referenceItem, referenceGroup, referenceRelation, tokenTracking } = schema;
export type ReferenceKind = "foundation" | "component" | "icon";

export async function listGroups(db: Database, kind: ReferenceKind) {
  return db
    .select()
    .from(referenceGroup)
    .where(eq(referenceGroup.kind, kind))
    .orderBy(asc(referenceGroup.sortOrder), asc(referenceGroup.label));
}

function searchClause(q: string): SQL | undefined {
  if (!q) return undefined;
  const term = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  return or(
    sql`${referenceItem.title} like ${term} escape '\\'`,
    sql`${referenceItem.summary} like ${term} escape '\\'`,
  );
}

export const referenceFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  group: z.string().max(64).catch(""),
  level: z.string().max(32).catch(""),
  status: z.string().max(32).catch(""),
  sort: z.enum(["title", "updated"]).catch("title"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
  view: z.enum(["grid", "list", "atomic"]).catch("grid"),
  /** Team-only tracking filter: a platform and a tracking status. */
  platform: z.enum(["design", "web", "mobile"]).catch("design"),
  progress: z.enum(["", "todo", "in_progress", "in_review", "done"]).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ReferenceFilters = z.infer<typeof referenceFiltersSchema>;

export function parseReferenceFilters(url: URL): ReferenceFilters {
  const p = url.searchParams;
  // "order" is the combined sort control used by the toolbar, e.g. "updated:desc".
  const [orderSort, orderDir] = (p.get("order") ?? "").split(":");
  return referenceFiltersSchema.parse({
    q: p.get("q") ?? "",
    group: p.get("group") ?? "",
    level: p.get("level") ?? "",
    status: p.get("status") ?? "",
    sort: orderSort || (p.get("sort") ?? undefined),
    dir: orderDir || (p.get("dir") ?? undefined),
    view: p.get("view") ?? undefined,
    platform: p.get("platform") ?? undefined,
    progress: p.get("progress") ?? "",
    page: p.get("page") ?? 1,
  });
}

/** Items whose tracking status for a platform matches; items without a row count as Todo. */
function progressClause(platform: "design" | "web" | "mobile", progress: string): SQL {
  const column = platform === "web" ? tokenTracking.webStatus : platform === "mobile" ? tokenTracking.mobileStatus : tokenTracking.designStatus;
  if (progress === "todo") {
    return sql`${referenceItem.id} not in (select ${tokenTracking.tokenId} from ${tokenTracking} where ${column} <> 'todo')`;
  }
  return sql`${referenceItem.id} in (select ${tokenTracking.tokenId} from ${tokenTracking} where ${column} = ${progress})`;
}

export async function listReferenceItems(
  db: Database,
  kind: ReferenceKind,
  filters: ReferenceFilters,
  opts: { paginate: boolean; pageSize?: number; tracking?: boolean } = { paginate: true },
) {
  const where = and(
    eq(referenceItem.kind, kind),
    searchClause(filters.q),
    filters.group ? eq(referenceItem.groupKey, filters.group) : undefined,
    filters.level ? eq(referenceItem.level, filters.level) : undefined,
    filters.status ? eq(referenceItem.status, filters.status) : undefined,
    opts.tracking && filters.progress ? progressClause(filters.platform, filters.progress) : undefined,
  );
  const dir = filters.dir === "desc" ? desc : asc;
  const order = filters.sort === "updated" ? [dir(referenceItem.updatedAt)] : [dir(sql`lower(${referenceItem.title})`)];
  const pageSize = opts.pageSize ?? POLICY.pageSize;
  const query = db
    .select({
      id: referenceItem.id,
      title: referenceItem.title,
      summary: referenceItem.summary,
      groupKey: referenceItem.groupKey,
      level: referenceItem.level,
      status: referenceItem.status,
      value: referenceItem.value,
      previewKey: referenceItem.previewKey,
      isSample: referenceItem.isSample,
      updatedAt: referenceItem.updatedAt,
    })
    .from(referenceItem)
    .where(where)
    .orderBy(...order);
  const [items, [totalRow]] = await Promise.all([
    opts.paginate ? query.limit(pageSize).offset((filters.page - 1) * pageSize) : query.limit(1000),
    db.select({ n: count() }).from(referenceItem).where(where),
  ]);
  return { items, total: totalRow?.n ?? 0, pageSize };
}

export async function getReferenceItem(db: Database, kind: ReferenceKind, id: string) {
  const item = await db.query.referenceItem.findFirst({ where: and(eq(referenceItem.id, id), eq(referenceItem.kind, kind)) });
  if (!item) return null;
  const [outgoing, incoming, group] = await Promise.all([
    db
      .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind, relation: referenceRelation.kind })
      .from(referenceRelation)
      .innerJoin(referenceItem, eq(referenceItem.id, referenceRelation.toId))
      .where(eq(referenceRelation.fromId, id)),
    db
      .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind, relation: referenceRelation.kind })
      .from(referenceRelation)
      .innerJoin(referenceItem, eq(referenceItem.id, referenceRelation.fromId))
      .where(eq(referenceRelation.toId, id)),
    db.query.referenceGroup.findFirst({ where: and(eq(referenceGroup.kind, kind), eq(referenceGroup.key, item.groupKey)) }),
  ]);
  return {
    item,
    groupLabel: group?.label ?? item.groupKey,
    uses: outgoing.filter((r) => r.relation === "uses"),
    usedBy: incoming.filter((r) => r.relation === "uses"),
    related: [...outgoing, ...incoming].filter((r) => r.relation === "related"),
  };
}


export async function referenceCounts(db: Database) {
  const rows = await db.select({ kind: referenceItem.kind, n: count() }).from(referenceItem).groupBy(referenceItem.kind);
  const groups = await db.select({ kind: referenceGroup.kind, n: count() }).from(referenceGroup).groupBy(referenceGroup.kind);
  const get = (list: { kind: string; n: number }[], kind: string) => list.find((r) => r.kind === kind)?.n ?? 0;
  return {
    foundations: get(rows, "foundation"),
    components: get(rows, "component"),
    icons: get(rows, "icon"),
    componentCategories: get(groups, "component"),
  };
}

/** Options for "related items" pickers (tasks, changelog). */
export async function referencePickerOptions(db: Database) {
  return db
    .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind })
    .from(referenceItem)
    .orderBy(asc(referenceItem.kind), asc(sql`lower(${referenceItem.title})`))
    .limit(500);
}

export async function referenceTitles(db: Database, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select({ id: referenceItem.id, title: referenceItem.title, kind: referenceItem.kind })
    .from(referenceItem)
    .where(inArray(referenceItem.id, ids));
}
