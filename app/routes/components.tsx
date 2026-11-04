import { Link, useLocation } from "react-router";
import { RiGridLine, RiListUnordered, RiNodeTree, RiSearchLine, RiShapesLine } from "@remixicon/react";
import type { Route } from "./+types/components";
import { ActiveFilters, chipList, Card, PageHeader, Pagination, SegmentedLinks } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Badge, SampleBadge } from "~/components/ui/display";
import { CatalogToolbar } from "~/components/catalog-toolbar";
import { levelLabel, ReferenceStatus, referenceStatusLabel } from "~/components/reference-detail";
import { ComponentPreview } from "~/components/component-preview";
import { AssigneeSelect, TRACK_OPTIONS, TRACK_PLATFORMS as PLATFORMS, TrackSelect } from "~/components/foundations";
import { getComponentEntry, isBuildingBlock } from "~/catalog/components";
import { ATOMIC_LEVELS, REFERENCE_STATUSES } from "~/config/hub";
import { can } from "~/domain/permissions";
import { cn } from "~/lib/cn";
import { getActor, getDb } from "~/server/request.server";
import { listGroups, listReferenceItems, parseReferenceFilters } from "~/server/reference.server";
import { EMPTY_TRACKING, trackingFor } from "~/server/foundations.server";
import { listMembers } from "~/server/tasks.server";

export const meta: Route.MetaFunction = () => [{ title: "Components · D.S Hub" }];

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context);
  const team = can(getActor(context), "foundation.track");
  const filters = parseReferenceFilters(new URL(request.url));
  const atomic = filters.view === "atomic";
  const [groups, result] = await Promise.all([
    listGroups(db, "component"),
    listReferenceItems(db, "component", filters, { paginate: !atomic, tracking: team }),
  ]);
  const items = result.items.map((i) => {
    const entry = getComponentEntry(i.id);
    return { ...i, hasPreview: !!entry, buildingBlock: entry ? isBuildingBlock(entry) : false, sets: entry?.sets.length ?? 0 };
  });
  if (!team) return { filters, groups, ...result, items, team, tracking: {} as Record<string, typeof EMPTY_TRACKING>, members: [] };
  const [rows, members] = await Promise.all([trackingFor(db, items.map((i) => i.id)), listMembers(db)]);
  const tracking = Object.fromEntries(items.map((i) => [i.id, rows.get(i.id) ?? { ...EMPTY_TRACKING }]));
  return { filters, groups, ...result, items, team, tracking, members: members.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name })) };
}

type Item = Route.ComponentProps["loaderData"]["items"][number];

function ItemCard({ item, groupLabel, from }: { item: Item; groupLabel: string; from: string }) {
  return (
    <Link
      to={`/components/${item.id}`}
      state={{ from }}
      className="group flex h-full flex-col rounded-2xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition hover:ring-stroke-sub-300 focus-visible:shadow-button-primary-focus"
    >
      {item.hasPreview ? (
        <ComponentPreview id={item.id} className="h-36 rounded-t-2xl" />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-t-2xl bg-bg-weak-50" aria-hidden>
          <RiShapesLine className="size-8 text-text-disabled-300" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-label-sm text-text-strong-950">{item.title}</p>
          {item.isSample ? <SampleBadge /> : null}
        </div>
        <p className="line-clamp-2 text-paragraph-xs text-text-sub-600">{item.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Badge color="blue">{groupLabel}</Badge>
          {item.level ? <Badge color="purple">{levelLabel(item.level)}</Badge> : null}
          {item.buildingBlock ? <Badge color="gray">Building block</Badge> : null}
          <ReferenceStatus status={item.status} />
        </div>
      </div>
    </Link>
  );
}

export default function Components({ loaderData }: Route.ComponentProps) {
  const { filters, groups, items, total, pageSize, team, tracking, members } = loaderData;
  const location = useLocation();
  const from = location.pathname + location.search;
  const groupLabel = (key: string) => groups.find((g) => g.key === key)?.label ?? key;
  const platformLabel = PLATFORMS.find((p) => p.id === filters.platform)?.label ?? "Design";

  const chips = chipList(
    filters.q && { key: "q", label: `Search: ${filters.q}`, remove: { q: null } },
    filters.group && { key: "group", label: groupLabel(filters.group), remove: { group: null } },
    filters.level && { key: "level", label: levelLabel(filters.level) ?? filters.level, remove: { level: null } },
    filters.status && { key: "status", label: referenceStatusLabel(filters.status) ?? filters.status, remove: { status: null } },
    team && filters.progress && {
      key: "progress",
      label: `${platformLabel}: ${TRACK_OPTIONS.find((o) => o.id === filters.progress)?.label ?? filters.progress}`,
      remove: { progress: null, platform: null },
    },
  );

  const results =
    filters.view === "atomic" ? (
      <div className="grid gap-4 lg:grid-cols-3">
        {ATOMIC_LEVELS.map((level) => {
          const inLevel = items.filter((i) => i.level === level.id);
          return (
            <section key={level.id} aria-labelledby={`level-${level.id}`} className="rounded-2xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
              <h2 id={`level-${level.id}`} className="flex items-center justify-between px-1 pb-3 text-label-md text-text-strong-950">
                {level.label} <Badge color="gray">{inLevel.length}</Badge>
              </h2>
              {inLevel.length ? (
                <ul className="flex flex-col gap-2">
                  {inLevel.map((item) => (
                    <li key={item.id}>
                      <Link to={`/components/${item.id}`} state={{ from }} className="flex items-center gap-2 rounded-xl bg-bg-white-0 p-3 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 hover:ring-stroke-sub-300">
                        <span className="flex-1 text-label-sm text-text-strong-950">{item.title}</span>
                        {item.buildingBlock ? <Badge color="gray">Building block</Badge> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 pb-2 text-paragraph-sm text-text-sub-600">Nothing at this level.</p>
              )}
            </section>
          );
        })}
      </div>
    ) : filters.view === "list" ? (
      <Card className="overflow-x-auto">
        <table className={cn("w-full text-left", team ? "min-w-[1080px]" : "min-w-[640px]")}>
          <caption className="sr-only">Components</caption>
          <thead>
            <tr className="bg-bg-weak-50 text-paragraph-sm text-text-sub-600">
              <th scope="col" className="px-4 py-2 font-normal">Name</th>
              <th scope="col" className="px-4 py-2 font-normal">Category</th>
              <th scope="col" className="px-4 py-2 font-normal">Level</th>
              {team ? (
                <>
                  {PLATFORMS.map((p) => (
                    <th key={p.id} scope="col" className="px-3 py-2 font-normal">{p.label}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-normal">Assignee</th>
                </>
              ) : (
                <th scope="col" className="px-4 py-2 font-normal">Status</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-soft-200">
            {items.map((item) => {
              const t = tracking[item.id];
              return (
                <tr key={item.id} className="hover:bg-bg-weak-50">
                  <td className="px-4 py-3">
                    <Link to={`/components/${item.id}`} state={{ from }} className="text-label-sm text-text-strong-950 hover:underline">
                      {item.title}
                    </Link>
                    <p className="line-clamp-1 max-w-sm text-paragraph-xs text-text-sub-600">{item.summary}</p>
                  </td>
                  <td className="px-4 py-3 text-paragraph-sm text-text-sub-600">{groupLabel(item.groupKey)}</td>
                  <td className="px-4 py-3 text-paragraph-sm text-text-sub-600">{levelLabel(item.level) ?? "—"}</td>
                  {team && t ? (
                    <>
                      {PLATFORMS.map((p) => (
                        <td key={p.id} className="px-3 py-3">
                          <TrackSelect tokenId={item.id} field={p.column} value={t[p.column]} label={`${p.label} status for ${item.title}`} />
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <AssigneeSelect tokenId={item.id} value={t.assigneeId} members={members} label={`Assignee for ${item.title}`} />
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3">
                      <ReferenceStatus status={item.status} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} groupLabel={groupLabel(item.groupKey)} from={from} />
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={RiShapesLine}
        title="Components"
        description="Every component in the Figma library: what it is, its variants and properties, and what it's built from."
        actions={
          <SegmentedLinks
            label="View"
            param="view"
            value={filters.view}
            options={[
              { value: "grid", label: "Grid", icon: RiGridLine },
              { value: "list", label: "List", icon: RiListUnordered },
              { value: "atomic", label: "Atomic", icon: RiNodeTree },
            ]}
          />
        }
      />

      <div className="space-y-3">
        <CatalogToolbar
          searchLabel="Search components"
          q={filters.q}
          keep={["view"]}
          selects={[
            { name: "group", label: "Category", value: filters.group, allLabel: "All categories", options: groups.map((g) => ({ value: g.key, label: g.label })) },
            { name: "level", label: "Level", value: filters.level, allLabel: "All levels", options: ATOMIC_LEVELS.map((l) => ({ value: l.id, label: l.label })) },
            { name: "status", label: "Status", value: filters.status, allLabel: "All statuses", options: REFERENCE_STATUSES.map((s) => ({ value: s.id, label: s.label })) },
            ...(team
              ? [
                  { name: "platform", label: "Platform", value: filters.platform, options: PLATFORMS.map((p) => ({ value: p.id, label: p.label })) },
                  { name: "progress", label: "Progress", value: filters.progress, allLabel: "Any progress", options: TRACK_OPTIONS.map((o) => ({ value: o.id, label: o.label })) },
                ]
              : []),
            {
              name: "order",
              label: "Sort by",
              value: `${filters.sort}:${filters.dir}`,
              options: [
                { value: "title:asc", label: "Name A–Z" },
                { value: "title:desc", label: "Name Z–A" },
                { value: "updated:desc", label: "Recently updated" },
              ],
            },
          ]}
        />
        <ActiveFilters chips={chips} />
      </div>

      <p className="text-paragraph-sm text-text-sub-600" role="status">
        {total.toLocaleString("en")} {total === 1 ? "component" : "components"}
      </p>

      {items.length ? (
        <div className={cn(filters.view === "atomic" ? "" : "space-y-2")}>
          {results}
          {filters.view !== "atomic" ? <Pagination page={filters.page} total={total} pageSize={pageSize} label="Components pages" /> : null}
        </div>
      ) : (
        <EmptyState
          icon={chips.length ? RiSearchLine : RiShapesLine}
          title={chips.length ? "No components match" : "No components yet"}
          description={chips.length ? "Try removing a filter or searching for something else." : "Components appear here once the catalog is loaded into the database."}
          action={chips.length ? <Link to={`?view=${filters.view}`} className="text-label-sm text-primary-base hover:underline">Clear filters</Link> : undefined}
        />
      )}
    </div>
  );
}
