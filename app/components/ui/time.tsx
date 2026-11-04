import * as React from "react";
import { formatDateTime, formatRelative } from "~/lib/format";

const utcFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });

/**
 * Server and first client render use UTC so hydration matches; after hydration the
 * viewer's own time zone is shown. Relative times ("5 minutes ago") refresh then too.
 */
export function Time({ value, format = "relative", className }: { value: Date | string | number; format?: "relative" | "datetime"; className?: string }) {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const date = value instanceof Date ? value : new Date(value);
  const text = format === "relative" ? formatRelative(date) : hydrated ? formatDateTime(date) : utcFmt.format(date);
  return (
    <time dateTime={date.toISOString()} title={hydrated ? formatDateTime(date) : undefined} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
