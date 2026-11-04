// Align UI display components: Badge, StatusBadge, Avatar, ProgressBar, Divider, Kbd, Tag.
import * as React from "react";
import { cn } from "~/lib/cn";
import { tv, type VariantProps } from "~/lib/tv";

export const badgeVariants = tv({
  base: "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-subheading-2xs uppercase",
  variants: {
    color: {
      gray: "bg-faded-lighter text-faded-dark",
      blue: "bg-information-lighter text-information-dark dark:text-blue-300",
      orange: "bg-warning-lighter text-warning-dark dark:text-orange-300",
      red: "bg-error-lighter text-error-dark dark:text-red-300",
      green: "bg-success-lighter text-success-dark dark:text-green-300",
      purple: "bg-feature-lighter text-feature-dark dark:text-purple-300",
      sky: "bg-verified-lighter text-verified-dark dark:text-sky-300",
      yellow: "bg-away-lighter text-away-dark dark:text-yellow-300",
      teal: "bg-stable-lighter text-stable-dark dark:text-teal-300",
    },
  },
  defaultVariants: { color: "gray" },
});
export type BadgeColor = NonNullable<VariantProps<typeof badgeVariants>["color"]>;

export function Badge({ color, className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  return <span className={badgeVariants({ color, class: className })}>{children}</span>;
}

/** Status badge: colour is always paired with a dot and a text label (BRD §13). */
export const statusTones = {
  completed: { dot: "bg-success-base", text: "text-text-sub-600" },
  pending: { dot: "bg-warning-base", text: "text-text-sub-600" },
  failed: { dot: "bg-error-base", text: "text-text-sub-600" },
  disabled: { dot: "bg-faded-base", text: "text-text-sub-600" },
  information: { dot: "bg-information-base", text: "text-text-sub-600" },
  feature: { dot: "bg-feature-base", text: "text-text-sub-600" },
} as const;
export type StatusTone = keyof typeof statusTones;

export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  const t = statusTones[tone];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md bg-bg-white-0 px-2 text-label-xs ring-1 ring-inset ring-stroke-soft-200", t.text, className)}>
      <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />
      {children}
    </span>
  );
}

const avatarSizes = { 20: "size-5 text-[10px]", 24: "size-6 text-label-2xs", 32: "size-8 text-label-xs", 40: "size-10 text-label-sm", 56: "size-14 text-label-lg", 80: "size-20 text-title-h5" } as const;
const avatarColors = ["bg-blue-200 text-blue-950", "bg-yellow-200 text-yellow-950", "bg-purple-200 text-purple-950", "bg-sky-200 text-sky-950", "bg-red-200 text-red-950", "bg-green-200 text-green-950", "bg-teal-200 text-teal-950"];

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

export function Avatar({ name, image, size = 32, className }: { name: string | null | undefined; image?: string | null; size?: keyof typeof avatarSizes; className?: string }) {
  const label = name ?? "Unassigned";
  return (
    <span className={cn("relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full", avatarSizes[size], !image && (name ? colorFor(name) : "bg-bg-soft-200 text-text-sub-600"), className)}>
      {image ? <img src={image} alt="" className="size-full object-cover" /> : <span aria-hidden>{initials(name)}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ProgressBar({ value, className, label }: { value: number; className?: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-bg-soft-200", className)}>
      <div className={cn("h-full rounded-full transition-all", v === 100 ? "bg-success-base" : "bg-primary-base")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-0 border-t border-stroke-soft-200", className)} />;
  return (
    <div className={cn("flex items-center gap-3 text-subheading-2xs uppercase text-text-sub-600", className)} role="separator">
      <span className="h-px flex-1 bg-stroke-soft-200" />
      {label}
      <span className="h-px flex-1 bg-stroke-soft-200" />
    </div>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 items-center rounded bg-bg-white-0 px-1.5 text-subheading-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200", className)}>{children}</kbd>;
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center gap-2 rounded-md bg-bg-white-0 px-2 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200", className)}>{children}</span>;
}

/** Visible marker for placeholder content (BRD §13). */
export function SampleBadge({ className }: { className?: string }) {
  return (
    <Badge color="yellow" className={className}>
      Sample
    </Badge>
  );
}
