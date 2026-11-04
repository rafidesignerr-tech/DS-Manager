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
  { kind: "component", key: "actions", label: "Actions", description: "Sample category." },
  { kind: "component", key: "forms", label: "Forms", description: "Sample category." },
  { kind: "component", key: "feedback", label: "Feedback", description: "Sample category." },
  { kind: "component", key: "navigation", label: "Navigation", description: "Sample category." },
  { kind: "component", key: "layout", label: "Layout", description: "Sample category." },
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

const components: [string, string, string, string][] = [
  ["Sample Button", "actions", "atom", "stable"],
  ["Sample Icon Button", "actions", "atom", "beta"],
  ["Sample Button Group", "actions", "molecule", "draft"],
  ["Sample Input", "forms", "atom", "stable"],
  ["Sample Checkbox", "forms", "atom", "stable"],
  ["Sample Form Field", "forms", "molecule", "beta"],
  ["Sample Search Bar", "forms", "molecule", "draft"],
  ["Sample Badge", "feedback", "atom", "stable"],
  ["Sample Alert", "feedback", "molecule", "beta"],
  ["Sample Toast", "feedback", "molecule", "deprecated"],
  ["Sample Tab", "navigation", "atom", "stable"],
  ["Sample Breadcrumb", "navigation", "molecule", "beta"],
  ["Sample Header", "navigation", "organism", "draft"],
  ["Sample Card", "layout", "molecule", "stable"],
  ["Sample Data Table", "layout", "organism", "beta"],
  ["Sample Page Shell", "layout", "organism", "draft"],
];
for (const [title, group, level, status] of components) add({ kind: "component", group, title, level, status });

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

const id = (title: string) => items.find((i) => i.title === title)!.id;
const relations: [string, string, "uses" | "related"][] = [
  [id("Sample Button Group"), id("Sample Button"), "uses"],
  [id("Sample Icon Button"), id("Sample Button"), "related"],
  [id("Sample Form Field"), id("Sample Input"), "uses"],
  [id("Sample Form Field"), id("Sample Checkbox"), "uses"],
  [id("Sample Search Bar"), id("Sample Input"), "uses"],
  [id("Sample Search Bar"), id("Sample Icon Button"), "uses"],
  [id("Sample Alert"), id("Sample Badge"), "related"],
  [id("Sample Header"), id("Sample Tab"), "uses"],
  [id("Sample Header"), id("Sample Search Bar"), "uses"],
  [id("Sample Data Table"), id("Sample Checkbox"), "uses"],
  [id("Sample Data Table"), id("Sample Badge"), "uses"],
  [id("Sample Page Shell"), id("Sample Header"), "uses"],
  [id("Sample Page Shell"), id("Sample Card"), "uses"],
];

const lines: string[] = [
  "-- Sample reference content (is_sample = 1). Safe to delete.",
  "DELETE FROM reference_relation WHERE from_id LIKE 'sample-%';",
  "DELETE FROM reference_item WHERE is_sample = 1;",
  "DELETE FROM reference_group;",
];
groups.forEach((g, i) =>
  lines.push(`INSERT INTO reference_group (kind, key, label, description, sort_order) VALUES (${q(g.kind)}, ${q(g.key)}, ${q(g.label)}, ${q(g.description)}, ${i});`),
);
items.forEach((it, i) =>
  lines.push(
    `INSERT INTO reference_item (id, kind, group_key, title, summary, details, level, status, value, preview_key, is_sample, sort_order) VALUES (${[it.id, it.kind, it.group, it.title, SUMMARY, DETAILS, it.level ?? null, it.status ?? null, it.value ?? null, it.preview ?? null].map(q).join(", ")}, 1, ${i});`,
  ),
);
relations.forEach(([from, to, kind]) => lines.push(`INSERT INTO reference_relation (from_id, to_id, kind) VALUES (${q(from)}, ${q(to)}, ${q(kind)});`));

mkdirSync("drizzle/seed", { recursive: true });
writeFileSync("drizzle/seed/sample.sql", lines.join("\n") + "\n");
console.log(`Wrote ${groups.length} groups, ${items.length} items, ${relations.length} relations.`);
