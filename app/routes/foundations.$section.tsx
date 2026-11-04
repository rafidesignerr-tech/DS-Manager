import * as React from "react";
import { Form, Link, useSearchParams } from "react-router";
import { RiArrowLeftLine, RiFileCopyLine, RiSearchLine, RiStickyNoteLine } from "@remixicon/react";
import type { Route } from "./+types/foundations.$section";
import { ActiveFilters, chipList, PageHeader, SegmentedLinks } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Badge } from "~/components/ui/display";
import { Input, Select } from "~/components/ui/form";
import {
  AssigneeSelect,
  DocTables,
  FoundationNav,
  RefLink,
  Swatch,
  tokenHref,
  TokenValues,
  TRACK_OPTIONS,
  TrackSelect,
  ValueText,
  type DocTable,
} from "~/components/foundations";
import { can } from "~/domain/permissions";
import docsJson from "~/foundations/docs.json";
import {
  formatValue,
  MODE_GROUPS,
  resolve,
  SECTIONS,
  TEXT_STYLE_PROPERTIES,
  TIER_LABELS,
  tokensFor,
  usedBy,
  valuesByMode,
  varyingGroup,
  type ModeGroup,
  type SectionId,
  type Tier,
  type Token,
} from "~/foundations/model";
import { cn } from "~/lib/cn";
import { getActor, getDb, notFound } from "~/server/request.server";
import { EMPTY_TRACKING, trackingFor, type Tracking } from "~/server/foundations.server";
import { listMembers } from "~/server/tasks.server";

const DOCS = docsJson as Record<SectionId, { overview: DocTable[]; usage: DocTable[] }>;
type Tab = "overview" | Tier | "usage";

export const meta: Route.MetaFunction = ({ params }) => {
  const s = SECTIONS.find((x) => x.id === params.section);
  return [{ title: `${s?.label ?? "Foundations"} · D.S Hub` }];
};

/** Serializable row for the client. */
function toRow(t: Token, tracking: Tracking | undefined) {
  return {
    id: t.id,
    path: t.path,
    name: t.name,
    group: t.group,
    description: t.description,
    webVar: t.webVar,
    usedByCount: usedBy(t.id).length,
    tracking: tracking ?? { tokenId: t.id, ...EMPTY_TRACKING },
  };
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const section = SECTIONS.find((s) => s.id === params.section);
  if (!section) throw notFound("This foundation section doesn't exist.");
  const actor = getActor(context);
  const team = can(actor, "foundation.track");
  const url = new URL(request.url);
  const tiers = (["scale", "primitive", "semantic"] as Tier[]).filter((t) => tokensFor(section.id, t).length);
  const tabParam = url.searchParams.get("tab") as Tab | null;
  const tabs: Tab[] = ["overview", ...tiers, "usage"];
  const tab: Tab = tabParam && tabs.includes(tabParam) ? tabParam : "overview";

  if (tab === "overview" || tab === "usage") {
    return { section, tabs, tab, team, docs: DOCS[section.id][tab], rows: null, members: [], groups: [], filters: null, actorId: actor?.id ?? null };
  }

  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const group = url.searchParams.get("group") ?? "";
  const platform = (url.searchParams.get("platform") ?? "design") as "design" | "web" | "mobile";
  const status = url.searchParams.get("status") ?? "";
  const assignee = url.searchParams.get("assignee") ?? "";
  const all = tokensFor(section.id, tab);
  const groups = [...new Set(all.map((t) => t.group))];
  const tracking = team ? await trackingFor(getDb(context), all.map((t) => t.id)) : new Map<string, Tracking>();
  const statusKey = `${platform}Status` as "designStatus" | "webStatus" | "mobileStatus";

  const filtered = all.filter((t) => {
    if (q && !t.path.toLowerCase().includes(q) && !(t.webVar ?? "").toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    if (group && t.group !== group) return false;
    if (team && status) {
      const tr = tracking.get(t.id);
      if ((tr?.[statusKey] ?? "todo") !== status) return false;
    }
    if (team && assignee) {
      const a = tracking.get(t.id)?.assigneeId ?? null;
      if (assignee === "me" ? a !== actor?.id : assignee === "unassigned" ? a !== null : a !== assignee) return false;
    }
    return true;
  });
  const members = team ? (await listMembers(getDb(context))).filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name })) : [];
  return {
    section,
    tabs,
    tab,
    team,
    docs: null,
    rows: filtered.map((t) => toRow(t, tracking.get(t.id))),
    total: all.length,
    members,
    groups,
    filters: { q, group, platform, status, assignee },
    actorId: actor?.id ?? null,
  };
}

/* ------------------------------ cells ------------------------------ */

type Row = NonNullable<Route.ComponentProps["loaderData"]["rows"]>[number];

function CopyVar({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 font-mono text-paragraph-xs text-text-sub-600 hover:text-text-strong-950"
      aria-label={`Copy ${value}`}
    >
      {value}
      <RiFileCopyLine className="size-3.5" aria-hidden />
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
      {copied ? <span className="text-success-base">Copied</span> : null}
    </button>
  );
}

function TrackingCells({ row, members }: { row: Row; members: { id: string; name: string }[] }) {
  const t = row.tracking;
  return (
    <>
      <td className="px-3 py-2">
        <TrackSelect tokenId={row.id} field="designStatus" value={t.designStatus} label={`Design status for ${row.path}`} />
      </td>
      <td className="px-3 py-2">
        <TrackSelect tokenId={row.id} field="webStatus" value={t.webStatus} label={`Web status for ${row.path}`} />
      </td>
      <td className="px-3 py-2">
        <TrackSelect tokenId={row.id} field="mobileStatus" value={t.mobileStatus} label={`Mobile status for ${row.path}`} />
      </td>
      <td className="px-3 py-2">
        <AssigneeSelect tokenId={row.id} value={t.assigneeId} members={members} label={`Assignee for ${row.path}`} />
      </td>
      <td className="px-3 py-2">
        <Link to={tokenHref(row.id)} className="inline-flex items-center gap-1 text-paragraph-xs text-text-sub-600 hover:text-text-strong-950" aria-label={`Notes for ${row.path}`}>
          <RiStickyNoteLine className={cn("size-4", t.notes ? "text-primary-base" : "text-text-soft-400")} aria-hidden />
          {t.notes ? "Notes" : "Add"}
        </Link>
      </td>
    </>
  );
}

function TokenName({ row }: { row: Row }) {
  return (
    <div className="min-w-0">
      <Link to={tokenHref(row.id)} className="block font-mono text-paragraph-xs text-text-strong-950 hover:underline">
        {row.path}
      </Link>
      {row.webVar ? <CopyVar value={row.webVar} /> : null}
      {row.description ? <p className="mt-0.5 line-clamp-2 max-w-md text-paragraph-xs text-text-sub-600">{row.description}</p> : null}
    </div>
  );
}

/* ------------------------------ views ------------------------------ */

function ModeTable({ rows, modeGroup, team, members, tokens }: { rows: Row[]; modeGroup: ModeGroup | null; team: boolean; members: { id: string; name: string }[]; tokens: Map<string, Token> }) {
  const modes = modeGroup ? MODE_GROUPS[modeGroup].modes : [];
  const grouped = new Map<string, Row[]>();
  for (const r of rows) (grouped.get(r.group) ?? grouped.set(r.group, []).get(r.group)!).push(r);
  const cols = 2 + (modes.length || 1) + (team ? 5 : 0);
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-inset ring-stroke-soft-200">
      <table className="w-full min-w-[880px] text-left">
        <caption className="sr-only">Tokens</caption>
        <thead>
          <tr className="bg-bg-weak-50 text-subheading-xs uppercase text-text-sub-600">
            <th scope="col" className="px-3 py-2 font-medium">Token</th>
            {modes.length ? (
              modes.map((m) => (
                <th key={m} scope="col" className="px-3 py-2 font-medium">{m}</th>
              ))
            ) : (
              <th scope="col" className="px-3 py-2 font-medium">Value</th>
            )}
            <th scope="col" className="px-3 py-2 font-medium">Used by</th>
            {team ? (
              <>
                <th scope="col" className="px-3 py-2 font-medium">Design</th>
                <th scope="col" className="px-3 py-2 font-medium">Web</th>
                <th scope="col" className="px-3 py-2 font-medium">Mobile</th>
                <th scope="col" className="px-3 py-2 font-medium">Assignee</th>
                <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Notes</span></th>
              </>
            ) : null}
          </tr>
        </thead>
        {[...grouped.entries()].map(([group, items]) => (
          <tbody key={group} className="divide-y divide-stroke-soft-200 border-t border-stroke-soft-200">
            <tr className="bg-bg-weak-25">
              <th scope="colgroup" colSpan={cols} className="px-3 py-1.5 text-left font-mono text-paragraph-xs font-normal text-text-sub-600">
                {group || "—"} <span className="text-text-sub-600">· {items.length}</span>
              </th>
            </tr>
            {items.map((row) => {
              const token = tokens.get(row.id)!;
              const byMode = modeGroup ? valuesByMode(token) : null;
              return (
                <tr key={row.id} className="align-top hover:bg-bg-weak-50">
                  <td className="px-3 py-2.5">
                    <TokenName row={row} />
                  </td>
                  {byMode ? (
                    byMode.map((v) => (
                      <td key={v.mode} className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <ValueText token={token} value={v.resolved.value} />
                          {v.raw?.ref && token.set === modeGroup ? <RefLink refId={v.raw.ref} /> : null}
                        </div>
                      </td>
                    ))
                  ) : (
                    <td className="px-3 py-2.5">
                      <TokenValues token={token} />
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-paragraph-xs text-text-sub-600">{row.usedByCount || "—"}</td>
                  {team ? <TrackingCells row={row} members={members} /> : null}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function ColorRamps({ rows, tokens }: { rows: Row[]; tokens: Map<string, Token> }) {
  const grouped = new Map<string, Row[]>();
  for (const r of rows) (grouped.get(r.group) ?? grouped.set(r.group, []).get(r.group)!).push(r);
  return (
    <div className="flex flex-col gap-6">
      {[...grouped.entries()].map(([group, items]) => (
        <section key={group} aria-labelledby={`ramp-${group}`} className="space-y-2">
          <h2 id={`ramp-${group}`} className="text-label-md capitalize text-text-strong-950">
            {group.split(".").at(-1)} <span className="text-paragraph-sm text-text-sub-600">· {items.length}</span>
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-13">
            {items.map((row) => {
              const value = String(resolve(tokens.get(row.id)!).value);
              return (
                <li key={row.id}>
                  <Link to={tokenHref(row.id)} className="group block rounded-xl p-1 hover:bg-bg-weak-50 focus-visible:shadow-button-primary-focus">
                    <Swatch color={value} size="lg" label={`${row.path}: ${value}`} />
                    <span className="mt-1.5 block truncate text-label-xs text-text-strong-950">{row.name}</span>
                    <span className="block truncate font-mono text-[11px] leading-4 text-text-sub-600">{value}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TextStyles({ rows, team, members, tokens }: { rows: Row[]; team: boolean; members: { id: string; name: string }[]; tokens: Map<string, Token> }) {
  const [params] = useSearchParams();
  const scale = (params.get("scale") ?? MODE_GROUPS["typography-scale"].default) as string;
  const ctx = { "typography-scale": scale };
  return (
    <div className="space-y-3">
      <SegmentedLinks label="Type scale" param="scale" value={scale} options={MODE_GROUPS["typography-scale"].modes.map((m) => ({ value: m, label: m }))} />
      <div className="overflow-x-auto rounded-2xl ring-1 ring-inset ring-stroke-soft-200">
        <table className="w-full min-w-[960px] text-left">
          <caption className="sr-only">Text styles at the {scale} type scale</caption>
          <thead>
            <tr className="bg-bg-weak-50 text-subheading-xs uppercase text-text-sub-600">
              <th scope="col" className="px-3 py-2 font-medium">Style</th>
              <th scope="col" className="px-3 py-2 font-medium">Preview</th>
              {TEXT_STYLE_PROPERTIES.map((p) => (
                <th key={p} scope="col" className="px-3 py-2 font-medium">{p}</th>
              ))}
              {team ? (
                <>
                  <th scope="col" className="px-3 py-2 font-medium">Design</th>
                  <th scope="col" className="px-3 py-2 font-medium">Web</th>
                  <th scope="col" className="px-3 py-2 font-medium">Mobile</th>
                  <th scope="col" className="px-3 py-2 font-medium">Assignee</th>
                  <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Notes</span></th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft-200">
            {rows.map((row) => {
              const token = tokens.get(row.id)!;
              const v = Object.fromEntries(TEXT_STYLE_PROPERTIES.map((p) => [p, resolve(token, p, ctx).value]));
              const style: React.CSSProperties = {
                fontFamily: `${v.family}, Inter, sans-serif`,
                fontWeight: Number(v.weight) || undefined,
                fontSize: Math.min(Number(v.size) || 16, 64),
                lineHeight: v["line-height"] ? `${Math.min(Number(v["line-height"]), 72)}px` : undefined,
                letterSpacing: v["letter-spacing"] !== undefined ? `${v["letter-spacing"]}px` : undefined,
              };
              return (
                <tr key={row.id} className="align-middle hover:bg-bg-weak-50">
                  <td className="px-3 py-2.5">
                    <Link to={tokenHref(row.id)} className="font-mono text-paragraph-xs text-text-strong-950 hover:underline">
                      {row.path.replace(/^typography\./, "")}
                    </Link>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <span className="block truncate text-text-strong-950" style={style}>
                      Aa Sample text
                    </span>
                  </td>
                  {TEXT_STYLE_PROPERTIES.map((p) => (
                    <td key={p} className="px-3 py-2.5 font-mono text-paragraph-xs text-text-strong-950">
                      {formatValue(token, v[p] ?? null, p)}
                    </td>
                  ))}
                  {team ? <TrackingCells row={row} members={members} /> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-paragraph-xs text-text-sub-600">Previews use the resolved values. Sizes above 64px are capped in the preview only.</p>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

const TAB_LABELS: Record<Tab, string> = { overview: "Overview", scale: "Scale", primitive: "Primitives", semantic: "Semantic", usage: "Usage" };

export default function FoundationSection({ loaderData }: Route.ComponentProps) {
  const { section, tabs, tab, team, docs, rows, members, groups, filters } = loaderData;
  const [params] = useSearchParams();
  const view = params.get("view") === "table" ? "table" : "ramps";
  const tokens = React.useMemo(() => new Map(tokensFor(section.id as SectionId, (tab === "overview" || tab === "usage" ? "semantic" : tab) as Tier).map((t) => [t.id, t])), [section.id, tab]);
  const modeGroup = React.useMemo<ModeGroup | null>(() => {
    if (!rows?.length) return null;
    const groupsSeen = new Set(rows.map((r) => varyingGroup(tokens.get(r.id)!)));
    const only = [...groupsSeen][0] ?? null;
    return groupsSeen.size === 1 && only ? only : null;
  }, [rows, tokens]);

  const chips = filters
    ? chipList(
        filters.q && { key: "q", label: `Search: ${filters.q}`, remove: { q: null } },
        filters.group && { key: "group", label: filters.group, remove: { group: null } },
        filters.status && { key: "status", label: `${filters.platform}: ${TRACK_OPTIONS.find((o) => o.id === filters.status)?.label ?? filters.status}`, remove: { status: null } },
        filters.assignee && { key: "assignee", label: filters.assignee === "me" ? "Assigned to me" : filters.assignee === "unassigned" ? "Unassigned" : (members.find((m) => m.id === filters.assignee)?.name ?? "Member"), remove: { assignee: null } },
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Link to="/foundations" className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> All foundations
      </Link>
      <PageHeader title={section.label} description={section.description} />
      <FoundationNav showUpdates={team} />

      <nav aria-label={`${section.label} tabs`} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 border-b border-stroke-soft-200">
          {tabs.map((t) => (
            <li key={t}>
              <Link
                to={`?tab=${t}`}
                aria-current={t === tab ? "page" : undefined}
                preventScrollReset
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-label-sm transition",
                  t === tab ? "border-primary-base text-text-strong-950" : "border-transparent text-text-sub-600 hover:text-text-strong-950",
                )}
              >
                {TAB_LABELS[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {docs ? (
        <DocTables tables={docs} />
      ) : rows && filters ? (
        <div className="flex flex-col gap-4">
          <Form method="get" role="search" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" preventScrollReset onChange={(e) => (e.target as HTMLElement).tagName === "SELECT" && e.currentTarget.requestSubmit()}>
            <input type="hidden" name="tab" value={tab} />
            {params.get("view") ? <input type="hidden" name="view" value={params.get("view")!} /> : null}
            {params.get("scale") ? <input type="hidden" name="scale" value={params.get("scale")!} /> : null}
            <div className="md:w-72">
              <label htmlFor="token-search" className="sr-only">Search tokens</label>
              <Input id="token-search" name="q" type="search" size="small" defaultValue={filters.q} placeholder="Search name, variable or description" leadingIcon={RiSearchLine} key={filters.q} />
            </div>
            {groups.length > 1 ? (
              <div className="md:w-52">
                <label htmlFor="token-group" className="sr-only">Group</label>
                <Select id="token-group" name="group" size="small" defaultValue={filters.group} key={filters.group}>
                  <option value="">All groups</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </div>
            ) : null}
            {team ? (
              <>
                <div className="md:w-32">
                  <label htmlFor="token-platform" className="sr-only">Platform</label>
                  <Select id="token-platform" name="platform" size="small" defaultValue={filters.platform} key={filters.platform}>
                    <option value="design">Design</option>
                    <option value="web">Web</option>
                    <option value="mobile">Mobile</option>
                  </Select>
                </div>
                <div className="md:w-36">
                  <label htmlFor="token-status" className="sr-only">Status</label>
                  <Select id="token-status" name="status" size="small" defaultValue={filters.status} key={filters.status}>
                    <option value="">Any status</option>
                    {TRACK_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="md:w-40">
                  <label htmlFor="token-assignee" className="sr-only">Assignee</label>
                  <Select id="token-assignee" name="assignee" size="small" defaultValue={filters.assignee} key={filters.assignee}>
                    <option value="">Anyone</option>
                    <option value="me">Me</option>
                    <option value="unassigned">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            ) : null}
            <button type="submit" className="h-9 rounded-lg px-3 text-label-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50">Apply</button>
          </Form>
          <ActiveFilters chips={chips} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-paragraph-sm text-text-sub-600" role="status">
              {rows.length === loaderData.total ? `${rows.length} tokens` : `${rows.length} of ${loaderData.total} tokens`}
              {modeGroup ? <> · values per {MODE_GROUPS[modeGroup].label.toLowerCase()}</> : null}
            </p>
            <div className="flex items-center gap-2">
              <Badge color="gray">{TIER_LABELS[tab as Tier]}</Badge>
              {section.id === "colors" && tab === "primitive" ? (
                <SegmentedLinks label="View" param="view" value={view} options={[{ value: "ramps", label: "Ramps" }, { value: "table", label: "Table" }]} />
              ) : null}
            </div>
          </div>

          {!rows.length ? (
            <EmptyState icon={RiSearchLine} title="No tokens match" description="Try another search or remove a filter." action={<Link to={`?tab=${tab}`} className="text-label-sm text-primary-base hover:underline">Clear filters</Link>} />
          ) : section.id === "colors" && tab === "primitive" && view === "ramps" ? (
            <ColorRamps rows={rows} tokens={tokens} />
          ) : section.id === "typography" && tab === "semantic" ? (
            <TextStyles rows={rows} team={team} members={members} tokens={tokens} />
          ) : (
            <ModeTable rows={rows} modeGroup={modeGroup} team={team} members={members} tokens={tokens} />
          )}
        </div>
      ) : null}
    </div>
  );
}
