// Align UI page header, card, segmented control (as links), pagination, filter chips.
import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine } from "@remixicon/react";
import { cn } from "~/lib/cn";
import { withParams } from "~/lib/url";

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-stroke-soft-200 pb-5 md:flex-row md:items-center", className)}>
      {Icon ? (
        <div className="hidden size-12 shrink-0 items-center justify-center rounded-full bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 md:flex">
          <Icon className="size-6 text-text-sub-600" aria-hidden />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? <div className="text-paragraph-sm text-text-sub-600">{eyebrow}</div> : null}
        <h1 className="text-label-lg text-text-strong-950 md:text-title-h6">{title}</h1>
        {description ? <p className="text-paragraph-sm text-text-sub-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function Card({ className, children, as: As = "section", ...rest }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" | "li" }) {
  return (
    <As className={cn("rounded-2xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, description }: { title: React.ReactNode; action?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-stroke-soft-200 px-4 py-3.5">
      <div className="flex-1 space-y-0.5">
        <h2 className="text-label-md text-text-strong-950">{title}</h2>
        {description ? <p className="text-paragraph-xs text-text-sub-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Segmented control whose options are links, so each view has a stable URL. */
export function SegmentedLinks<T extends string>({
  options,
  value,
  param,
  label,
}: {
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  param: string;
  label: string;
}) {
  const [params] = useSearchParams();
  return (
    <nav aria-label={label} className="inline-flex rounded-10 bg-bg-weak-50 p-1">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <Link
            key={o.value}
            to={withParams(params, { [param]: o.value })}
            aria-current={active ? "page" : undefined}
            preventScrollReset
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-label-sm transition",
              active ? "bg-bg-white-0 text-text-strong-950 shadow-[0_6px_10px_0_rgba(14,18,27,0.06),0_2px_4px_0_rgba(14,18,27,0.03)]" : "text-text-sub-600 hover:text-text-strong-950",
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden /> : null}
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pagination({ page, total, pageSize, label = "Pagination" }: { page: number; total: number; pageSize: number; label?: string }) {
  const [params] = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const link = (p: number) => withParams(params, { page: p === 1 ? null : String(p) }, { keepPage: true });
  const btn = "flex size-8 items-center justify-center rounded-lg text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50";
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-4">
      <p className="text-paragraph-sm text-text-sub-600">
        {first.toLocaleString("en")}–{last.toLocaleString("en")} of {total.toLocaleString("en")}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link to={link(page - 1)} className={btn} aria-label="Previous page">
            <RiArrowLeftSLine className="size-5" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none text-text-disabled-300")} aria-hidden>
            <RiArrowLeftSLine className="size-5" />
          </span>
        )}
        <span className="text-label-sm text-text-strong-950">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link to={link(page + 1)} className={btn} aria-label="Next page">
            <RiArrowRightSLine className="size-5" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none text-text-disabled-300")} aria-hidden>
            <RiArrowRightSLine className="size-5" />
          </span>
        )}
      </div>
    </nav>
  );
}

export type FilterChip = { key: string; label: string; remove: Record<string, string | string[] | null> };

/** Builds a chip list, skipping filters that aren't set. */
export function chipList(...items: (FilterChip | false | "" | null | undefined)[]): FilterChip[] {
  return items.filter((c): c is FilterChip => !!c);
}

/** Removable chips for active filters (BRD §10: visible, removable, combinable). */
export function ActiveFilters({ chips }: { chips: FilterChip[] }) {
  const [params] = useSearchParams();
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <Link
          key={c.key}
          to={withParams(params, c.remove)}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-bg-white-0 pl-2 pr-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label}
          <RiCloseLine className="size-4 text-text-soft-400" aria-hidden />
        </Link>
      ))}
      <Link to="?" className="text-label-xs text-text-sub-600 underline-offset-2 hover:underline">
        Clear all
      </Link>
    </div>
  );
}
