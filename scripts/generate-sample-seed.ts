/**
 * Generates drizzle/seed/sample.sql — neutral placeholder reference content so
 * search, filters, sorting and the Atomic view can be exercised (BRD §15, #14).
 * Every row has is_sample = 1. Nothing here describes a real design system.
 *
 *   npx tsx scripts/generate-sample-seed.ts
 *   npm run db:seed:local
 *
 * Remove it any time with: DELETE FROM reference_item WHERE is_sample = 1;
 */
import { writeFileSync, mkdirSync } from "node:fs";

type Kind = "foundation" | "component" | "icon";
const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);

const groups: { kind: Kind; key: string; label: string; description: string }[] = [
  { kind: "icon", key: "interface", label: "Interface", description: "Sample category." },
  { kind: "icon", key: "arrows", label: "Arrows", description: "Sample category." },
  { kind: "icon", key: "media", label: "Media", description: "Sample category." },
];

const SUMMARY = "Placeholder entry for layout and testing. Replace with your own content.";
const DETAILS = "This is sample content. It shows where descriptions, usage notes and guidance will appear once real content is added.";

type Item = { id: string; kind: Kind; group: string; title: string; level?: string; status?: string; value?: string; preview?: string };
const items: Item[] = [];
let n = 0;
const add = (i: Omit<Item, "id"> & { id?: string }) => items.push({ id: i.id ?? `sample-${i.kind}-${String(++n).padStart(3, "0")}`, ...i });

// Foundations come from app/foundations/tokens.json, not from this seed.

// Components come from app/catalog/components.json (see generate-components-seed.ts).

const icons: [string, string, string][] = [
  ["Sample icon: search", "interface", "search"],
  ["Sample icon: settings", "interface", "settings"],
  ["Sample icon: user", "interface", "user"],
  ["Sample icon: bell", "interface", "bell"],
  ["Sample icon: heart", "interface", "heart"],
  ["Sample icon: star", "interface", "star"],
  ["Sample icon: arrow right", "arrows", "arrow-right"],
  ["Sample icon: arrow left", "arrows", "arrow-left"],
  ["Sample icon: arrow up", "arrows", "arrow-up"],
  ["Sample icon: refresh", "arrows", "refresh"],
  ["Sample icon: image", "media", "image"],
  ["Sample icon: play", "media", "play"],
  ["Sample icon: camera", "media", "camera"],
  ["Sample icon: music", "media", "music"],
];
for (const [title, group, preview] of icons) add({ kind: "icon", group, title, preview });


const lines: string[] = [
  "-- Sample reference content (is_sample = 1). Safe to delete.",
  "DELETE FROM reference_relation WHERE from_id LIKE 'sample-%';",
  "DELETE FROM reference_item WHERE is_sample = 1 AND kind = 'icon';",
  "DELETE FROM reference_group WHERE kind = 'icon';",
];
groups.forEach((g, i) =>
  lines.push(`INSERT INTO reference_group (kind, key, label, description, sort_order) VALUES (${q(g.kind)}, ${q(g.key)}, ${q(g.label)}, ${q(g.description)}, ${i});`),
);
items.forEach((it, i) =>
  lines.push(
    `INSERT INTO reference_item (id, kind, group_key, title, summary, details, level, status, value, preview_key, is_sample, sort_order) VALUES (${[it.id, it.kind, it.group, it.title, SUMMARY, DETAILS, it.level ?? null, it.status ?? null, it.value ?? null, it.preview ?? null].map(q).join(", ")}, 1, ${i});`,
  ),
);

mkdirSync("drizzle/seed", { recursive: true });
writeFileSync("drizzle/seed/sample.sql", lines.join("\n") + "\n");
console.log(`Wrote ${groups.length} groups, ${items.length} items.`);
