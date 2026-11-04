const dateFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** For calendar dates stored as YYYY-MM-DD. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateTime(value: Date | string | number): string {
  return dateTimeFmt.format(toDate(value));
}

export function formatRelative(value: Date | string | number, now: number = Date.now()): string {
  const diff = (toDate(value).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), "day");
  return dateFmt.format(toDate(value));
}

export function isoDate(value: Date | string | number): string {
  return toDate(value).toISOString();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}
