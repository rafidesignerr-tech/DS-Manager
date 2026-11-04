import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiArrowUpLine,
  RiBellLine,
  RiCameraLine,
  RiCloseLine,
  RiGridLine,
  RiHeartLine,
  RiImageLine,
  RiMusic2Line,
  RiPlayLine,
  RiRefreshLine,
  RiSearchLine,
  RiSettings3Line,
  RiStarLine,
  RiUser3Line,
  RiQuestionMark,
} from "@remixicon/react";
import type { Route } from "./+types/icons";
import { ActiveFilters, chipList, PageHeader } from "~/components/ui/page";
import { EmptyState } from "~/components/ui/feedback";
import { Badge, SampleBadge } from "~/components/ui/display";
import { CatalogToolbar } from "~/components/catalog-toolbar";
import { cn } from "~/lib/cn";
import { withParams } from "~/lib/url";
import { getDb } from "~/server/request.server";
import { listGroups, listReferenceItems, parseReferenceFilters } from "~/server/reference.server";

export const meta: Route.MetaFunction = () => [{ title: "Icons · D.S Hub" }];

/** Preview glyphs for sample icons. Real icon assets replace this map later. */
const PREVIEWS: Record<string, React.ComponentType<{ className?: string }>> = {
  search: RiSearchLine,
  settings: RiSettings3Line,
  user: RiUser3Line,
  bell: RiBellLine,
  heart: RiHeartLine,
  star: RiStarLine,
  "arrow-right": RiArrowRightLine,
  "arrow-left": RiArrowLeftLine,
  "arrow-up": RiArrowUpLine,
  refresh: RiRefreshLine,
  image: RiImageLine,
  play: RiPlayLine,
  camera: RiCameraLine,
  music: RiMusic2Line,
};

function Preview({ previewKey, className }: { previewKey: string | null; className?: string }) {
  const Icon = (previewKey && PREVIEWS[previewKey]) || RiQuestionMark;
  return <Icon className={className} aria-hidden />;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const db = getDb(context);
  const url = new URL(request.url);
  const filters = parseReferenceFilters(url);
  const [groups, result] = await Promise.all([
    listGroups(db, "icon"),
    listReferenceItems(db, "icon", { ...filters, sort: "title", dir: "asc" }, { paginate: true, pageSize: 120 }),
  ]);
  const selectedId = url.searchParams.get("selected");
  // The panel works even when the selected icon is outside the current filter.
  const selected = selectedId
    ? (result.items.find((i) => i.id === selectedId) ??
      (await db.query.referenceItem.findFirst({ where: (r, { and, eq }) => and(eq(r.id, selectedId), eq(r.kind, "icon")) })) ??
      null)
    : null;
  return { filters, groups, ...result, selected };
}

export default function Icons({ loaderData }: Route.ComponentProps) {
  const { filters, groups, items, total, selected } = loaderData;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const groupLabel = (key: string) => groups.find((g) => g.key === key)?.label ?? key;
  const chips = chipList(
    filters.q && { key: "q", label: `Search: ${filters.q}`, remove: { q: null } },
    filters.group && { key: "group", label: groupLabel(filters.group), remove: { group: null } },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={RiGridLine} title="Icons" description="Find an icon by name or category, then open it for details." />
      <div className="space-y-3">
        <CatalogToolbar
          searchLabel="Search icons"
          q={filters.q}
          selects={[{ name: "group", label: "Category", value: filters.group, allLabel: "All categories", options: groups.map((g) => ({ value: g.key, label: g.label })) }]}
        />
        <ActiveFilters chips={chips} />
      </div>
      <p className="text-paragraph-sm text-text-sub-600" role="status">
        {total.toLocaleString("en")} {total === 1 ? "icon" : "icons"}
      </p>

      {items.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {items.map((icon) => (
            <li key={icon.id}>
              <Link
                to={withParams(params, { selected: icon.id }, { keepPage: true })}
                preventScrollReset
                aria-current={selected?.id === icon.id ? "true" : undefined}
                className={cn(
                  "flex h-full flex-col items-center gap-3 rounded-2xl bg-bg-white-0 p-4 text-center ring-1 ring-inset ring-stroke-soft-200 transition hover:ring-stroke-sub-300",
                  selected?.id === icon.id && "ring-2 ring-primary-base",
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-bg-weak-50">
                  <Preview previewKey={icon.previewKey} className="size-6 text-text-strong-950" />
                </span>
                <span className="line-clamp-2 text-label-xs text-text-sub-600">{icon.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={RiSearchLine}
          title={chips.length ? "No icons match" : "No icons yet"}
          description={chips.length ? "Try another name or category." : "Icons appear here once content is added."}
          action={chips.length ? <Link to="?" className="text-label-sm text-primary-base hover:underline">Clear filters</Link> : undefined}
        />
      )}

      <DialogPrimitive.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) navigate(withParams(params, { selected: null }, { keepPage: true }), { preventScrollReset: true, replace: true });
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
          <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-bg-white-0 shadow-regular-md focus:outline-none sm:inset-y-2 sm:right-2 sm:rounded-20">
            {selected ? (
              <>
                <div className="flex items-center gap-3 border-b border-stroke-soft-200 px-5 py-4">
                  <DialogPrimitive.Title className="flex-1 text-label-lg text-text-strong-950">{selected.title}</DialogPrimitive.Title>
                  <DialogPrimitive.Close className="flex size-6 items-center justify-center rounded-md text-text-soft-400 hover:bg-bg-weak-50" aria-label="Close details">
                    <RiCloseLine className="size-5" />
                  </DialogPrimitive.Close>
                </div>
                <div className="flex flex-col gap-5 overflow-y-auto p-5">
                  <div className="flex h-48 items-center justify-center rounded-2xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
                    <Preview previewKey={selected.previewKey} className="size-16 text-text-strong-950" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge color="blue">{groupLabel(selected.groupKey)}</Badge>
                    {selected.isSample ? <SampleBadge /> : null}
                  </div>
                  <p className="text-paragraph-sm text-text-sub-600">{selected.summary}</p>
                  <div className="grid grid-cols-4 gap-2" aria-label="Size preview">
                    {[16, 20, 24, 32].map((s) => (
                      <div key={s} className="flex flex-col items-center gap-2 rounded-xl p-3 ring-1 ring-inset ring-stroke-soft-200">
                        <span style={{ width: s, height: s }} className="flex">
                          <Preview previewKey={selected.previewKey} className="size-full text-text-strong-950" />
                        </span>
                        <span className="text-paragraph-xs text-text-sub-600">{s}px</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
