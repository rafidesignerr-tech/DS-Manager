import { Link, useLocation } from "react-router";
import { RiArrowLeftLine, RiArrowRightUpLine, RiLinksLine } from "@remixicon/react";
import { Card, CardHeader } from "~/components/ui/page";
import { Badge, SampleBadge, StatusBadge, type StatusTone } from "~/components/ui/display";
import { ATOMIC_LEVELS, REFERENCE_STATUSES } from "~/config/hub";
import { Time } from "~/components/ui/time";

type Linked = { id: string; title: string; kind: string };

export function referenceHref(kind: string, id: string): string {
  return kind === "foundation" ? "/foundations" : kind === "icon" ? `/icons?selected=${id}` : `/components/${id}`;
}

const STATUS_TONE: Record<string, StatusTone> = { stable: "completed", beta: "information", draft: "pending", deprecated: "failed" };

export function referenceStatusLabel(id: string | null) {
  return REFERENCE_STATUSES.find((s) => s.id === id)?.label ?? id;
}
export function levelLabel(id: string | null) {
  return ATOMIC_LEVELS.find((l) => l.id === id)?.label.replace(/s$/, "") ?? id;
}

export function ReferenceStatus({ status }: { status: string | null }) {
  if (!status) return null;
  return <StatusBadge tone={STATUS_TONE[status] ?? "disabled"}>{referenceStatusLabel(status)}</StatusBadge>;
}

function LinkedList({ title, items, empty }: { title: string; items: Linked[]; empty: string }) {
  const location = useLocation();
  // Keep the original list context so "Back" still returns to the filtered list.
  const from = (location.state as { from?: string } | null)?.from;
  return (
    <Card>
      <CardHeader title={title} />
      {items.length ? (
        <ul className="divide-y divide-stroke-soft-200">
          {items.map((r) => (
            <li key={`${title}-${r.id}`}>
              <Link to={referenceHref(r.kind, r.id)} state={{ from }} className="group flex items-center gap-3 px-4 py-3 hover:bg-bg-weak-50">
                <RiLinksLine className="size-5 text-text-soft-400" aria-hidden />
                <span className="flex-1 text-label-sm text-text-strong-950">{r.title}</span>
                <Badge color="gray">{r.kind}</Badge>
                <RiArrowRightUpLine className="size-4 text-text-soft-400 group-hover:text-text-sub-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-paragraph-sm text-text-sub-600">{empty}</p>
      )}
    </Card>
  );
}

export function ReferenceDetail({
  listHref,
  listLabel,
  item,
  groupLabel,
  uses,
  usedBy,
  related,
}: {
  listHref: string;
  listLabel: string;
  item: { id: string; title: string; summary: string; details: string; level: string | null; status: string | null; value: string | null; isSample: boolean; updatedAt: Date | string };
  groupLabel: string;
  uses: Linked[];
  usedBy: Linked[];
  related: Linked[];
}) {
  const location = useLocation();
  const back = (location.state as { from?: string } | null)?.from ?? listHref;
  return (
    <div className="flex flex-col gap-6">
      <Link to={back} className="inline-flex w-fit items-center gap-1.5 text-label-sm text-text-sub-600 hover:text-text-strong-950">
        <RiArrowLeftLine className="size-4" aria-hidden /> Back to {listLabel}
      </Link>

      <header className="space-y-3 border-b border-stroke-soft-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="blue">{groupLabel}</Badge>
          {item.level ? <Badge color="purple">{levelLabel(item.level)}</Badge> : null}
          <ReferenceStatus status={item.status} />
          {item.isSample ? <SampleBadge /> : null}
        </div>
        <h1 className="text-title-h5 text-text-strong-950">{item.title}</h1>
        <p className="max-w-2xl text-paragraph-md text-text-sub-600">{item.summary}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="text-label-md text-text-strong-950">Overview</h2>
            <p className="mt-2 whitespace-pre-line text-paragraph-sm text-text-sub-600">{item.details || "No details yet."}</p>
          </Card>
          <LinkedList title="Uses" items={uses} empty="This item doesn't use other items." />
          <LinkedList title="Used by" items={usedBy} empty="Nothing uses this item yet." />
        </div>
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="text-label-md text-text-strong-950">Details</h2>
            <dl className="mt-3 space-y-3 text-paragraph-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-sub-600">Group</dt>
                <dd className="text-right text-text-strong-950">{groupLabel}</dd>
              </div>
              {item.level ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-sub-600">Level</dt>
                  <dd className="text-right text-text-strong-950">{levelLabel(item.level)}</dd>
                </div>
              ) : null}
              {item.status ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-sub-600">Status</dt>
                  <dd className="text-right text-text-strong-950">{referenceStatusLabel(item.status)}</dd>
                </div>
              ) : null}
              {item.value ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-sub-600">Value</dt>
                  <dd className="text-right text-text-strong-950">{item.value}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-text-sub-600">Last updated</dt>
                <dd className="text-right text-text-strong-950"><Time value={item.updatedAt} format="datetime" /></dd>
              </div>
            </dl>
          </Card>
          <LinkedList title="Related" items={related} empty="No related items." />
        </div>
      </div>
    </div>
  );
}
