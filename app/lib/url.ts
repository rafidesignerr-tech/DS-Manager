/** Returns `pathname?search` with the given params changed. `null` removes a param. Page resets unless set. */
export function withParams(
  current: URLSearchParams,
  changes: Record<string, string | string[] | null>,
  opts: { keepPage?: boolean } = {},
): string {
  const next = new URLSearchParams(current);
  if (!opts.keepPage && !("page" in changes)) next.delete("page");
  for (const [key, value] of Object.entries(changes)) {
    next.delete(key);
    if (value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v !== "") next.append(key, v);
  }
  const s = next.toString();
  return s ? `?${s}` : "?";
}
