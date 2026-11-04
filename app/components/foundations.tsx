// Shared UI for the Foundations pages: section nav, swatches, value cells, doc tables, tracking controls.
import * as React from "react";
import { Link, NavLink, useFetcher } from "react-router";
import { RiArrowRightSLine, RiHistoryLine } from "@remixicon/react";
import { cn } from "~/lib/cn";
import { StatusBadge, type StatusTone } from "~/components/ui/display";
import {
  findMention,
  formatValue,
  isColorLiteral,
  MODE_GROUPS,
  SECTIONS,
  type ModeGroup,
  type Token,
  valuesByMode,
} from "~/foundations/model";

export function tokenHref(id: string) {
  return `/foundations/token/${encodeURIComponent(id)}`;
}

export function FoundationNav({ showUpdates }: { showUpdates: boolean }) {
  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-label-sm transition",
      isActive ? "bg-bg-strong-950 text-text-white-0" : "text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 hover:text-text-strong-950",
    );
  return (
    <nav aria-label="Foundation sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      <NavLink to="/foundations" end className={item}>
        All
      </NavLink>
      {SECTIONS.map((s) => (
        <NavLink key={s.id} to={`/foundations/${s.id}`} className={item}>
          {s.label}
        </NavLink>
      ))}
      {showUpdates ? (
        <NavLink to="/foundations/updates" className={item}>
          <RiHistoryLine className="size-4" aria-hidden /> Updates
        </NavLink>
      ) : null}
    </nav>
  );
}

/** Color swatch over a checkerboard so transparent colors stay visible. */
export function Swatch({ color, size = "md", label }: { color: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const dims = size === "sm" ? "size-5 rounded" : size === "lg" ? "h-16 w-full rounded-xl" : "size-8 rounded-lg";
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden ring-1 ring-inset ring-stroke-soft-200", dims)}
      style={{ backgroundImage: "conic-gradient(#e5e7eb 25%, #fff 0 50%, #e5e7eb 0 75%, #fff 0)", backgroundSize: "8px 8px" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="absolute inset-0" style={{ background: color }} />
    </span>
  );
}

export function ValueText({ token, value, property = "" }: { token: Token; value: string | number | null; property?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {isColorLiteral(value) ? <Swatch color={value} size="sm" /> : null}
      <code className="font-mono text-paragraph-xs text-text-strong-950">{formatValue(token, value, property)}</code>
    </span>
  );
}

/** The alias a value points to (first hop), as a link. */
export function RefLink({ refId }: { refId: string | null }) {
  if (!refId) return null;
  const path = refId.split("--")[1] ?? refId;
  return (
    <Link to={tokenHref(refId)} className="inline-flex items-center gap-0.5 font-mono text-paragraph-xs text-primary-base hover:underline">
      <RiArrowRightSLine className="size-3.5" aria-hidden />
      {path}
    </Link>
  );
}

/** Value cell: one value, or one per mode when the token varies. */
export function TokenValues({ token, property = "", compact = false }: { token: Token; property?: string; compact?: boolean }) {
  const rows = valuesByMode(token, property);
  if (rows.length === 1) {
    const r = rows[0]!;
    return (
      <div className="flex flex-col gap-0.5">
        <ValueText token={token} value={r.resolved.value} property={property} />
        {!compact && r.raw?.ref ? <RefLink refId={r.raw.ref} /> : null}
      </div>
    );
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      {rows.map((r) => (
        <React.Fragment key={r.mode}>
          <dt className="text-paragraph-xs text-text-sub-600">{r.mode}</dt>
          <dd>
            <ValueText token={token} value={r.resolved.value} property={property} />
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function modeLabel(group: ModeGroup) {
  return MODE_GROUPS[group].label;
}

/* ------------------------------ docs ------------------------------ */

export type DocTable = { title: string; subtitle: string; columns: string[]; rows: string[][] };

const MENTION = /\b(?:color|spacing|shape|radius|shadow|typography|layout|elevation|scale|effect)[./][\w./%*-]+\w\*?/g;

/** Renders documentation text, turning token mentions into links when the token exists. */
export function DocText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const token = findMention(m[0]);
    parts.push(
      token ? (
        <Link key={start} to={tokenHref(token.id)} className="rounded bg-primary-alpha-10 px-1 font-mono text-paragraph-xs text-primary-darker hover:underline dark:text-primary-base">
          {m[0]}
        </Link>
      ) : (
        <code key={start} className="rounded bg-bg-weak-50 px-1 font-mono text-paragraph-xs text-text-sub-600" title="Not found in the current tokens file">
          {m[0]}
        </code>
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

export function DocTables({ tables }: { tables: DocTable[] }) {
  if (!tables.length) return <p className="text-paragraph-sm text-text-sub-600">No guidance has been written for this section yet.</p>;
  return (
    <div className="flex flex-col gap-8">
      {tables.map((t, i) => (
        <section key={`${t.title}-${i}`} aria-labelledby={`doc-${i}`} className="space-y-3">
          <div className="space-y-1">
            <h2 id={`doc-${i}`} className="text-label-lg text-text-strong-950">
              {t.title}
            </h2>
            {t.subtitle ? <p className="max-w-3xl text-paragraph-sm text-text-sub-600">{t.subtitle}</p> : null}
          </div>
          <div className="overflow-x-auto rounded-2xl ring-1 ring-inset ring-stroke-soft-200">
            <table className="w-full min-w-[720px] text-left align-top">
              <thead>
                <tr className="bg-bg-weak-50">
                  {t.columns.map((c) => (
                    <th key={c} scope="col" className="px-4 py-2 text-subheading-xs uppercase text-text-sub-600">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke-soft-200">
                {t.rows.map((row, r) => (
                  <tr key={r} className="align-top">
                    {row.map((cell, c) => (
                      <td key={c} className={cn("px-4 py-3 text-paragraph-sm", c === 0 ? "text-label-sm text-text-strong-950" : "text-text-sub-600")}>
                        <DocText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------ tracking ------------------------------ */

export const TRACK_OPTIONS = [
  { id: "todo", label: "Todo", tone: "disabled" as StatusTone },
  { id: "in_progress", label: "In progress", tone: "feature" as StatusTone },
  { id: "in_review", label: "In review", tone: "pending" as StatusTone },
  { id: "done", label: "Done", tone: "completed" as StatusTone },
];

/** Tracking platforms, shared with the server module (which can't be imported by UI code). */
export const TRACK_PLATFORMS = [
  { id: "design", label: "Design", column: "designStatus" },
  { id: "web", label: "Web", column: "webStatus" },
  { id: "mobile", label: "Mobile", column: "mobileStatus" },
] as const;

export function TrackBadge({ status }: { status: string }) {
  const o = TRACK_OPTIONS.find((x) => x.id === status) ?? TRACK_OPTIONS[0]!;
  return <StatusBadge tone={o.tone}>{o.label}</StatusBadge>;
}

const toneDot: Record<string, string> = { todo: "bg-faded-base", in_progress: "bg-feature-base", in_review: "bg-warning-base", done: "bg-success-base" };

/** Inline status select that saves on change (no page reload). */
export function TrackSelect({ tokenId, field, value, label }: { tokenId: string; field: "designStatus" | "webStatus" | "mobileStatus"; value: string; label: string }) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get(field);
  const shown = typeof pending === "string" ? pending : value;
  return (
    <fetcher.Form method="post" action="/foundations/track" className="contents">
      <input type="hidden" name="tokenId" value={tokenId} />
      <label className="relative inline-flex items-center">
        <span className="sr-only">{label}</span>
        <span className={cn("pointer-events-none absolute left-2 size-1.5 rounded-full", toneDot[shown] ?? toneDot.todo)} aria-hidden />
        <select
          name={field}
          value={shown}
          onChange={(e) => fetcher.submit(e.currentTarget.form)}
          className="h-7 appearance-none rounded-md bg-bg-white-0 pl-5 pr-2 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 focus-visible:shadow-button-important-focus"
        >
          {TRACK_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </fetcher.Form>
  );
}

export function AssigneeSelect({ tokenId, value, members, label }: { tokenId: string; value: string | null; members: { id: string; name: string }[]; label: string }) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("assigneeId");
  const shown = typeof pending === "string" ? pending : (value ?? "");
  return (
    <fetcher.Form method="post" action="/foundations/track" className="contents">
      <input type="hidden" name="tokenId" value={tokenId} />
      <label>
        <span className="sr-only">{label}</span>
        <select
          name="assigneeId"
          value={shown}
          onChange={(e) => fetcher.submit(e.currentTarget.form)}
          className="h-7 max-w-36 appearance-none truncate rounded-md bg-bg-white-0 px-2 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 focus-visible:shadow-button-important-focus"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    </fetcher.Form>
  );
}

/** Percentage of tokens marked Done for a platform. */
export function DoneBar({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-paragraph-xs text-text-sub-600">
        <span>{label}</span>
        <span>
          {done}/{total} done
        </span>
      </div>
      <div role="progressbar" aria-label={`${label} done`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-bg-soft-200">
        <div className={cn("h-full rounded-full", pct === 100 ? "bg-success-base" : "bg-primary-base")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
