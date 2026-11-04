// Read-only component catalog synced from the Figma components library.
// Source of truth for component details (sets, variants, properties, previews).
// The database holds the matching reference_item rows (for search, tasks,
// changelog links and relations) and team tracking; see
// scripts/generate-components-seed.ts.
import data from "./components.json";

export type SetKind = "public" | "internal" | "deprecated";
export type PropertyType = "text" | "boolean" | "instance swap" | "slot";

export interface ComponentSet {
  figmaId: string;
  name: string;
  figmaName: string;
  kind: SetKind;
  description: string;
  variants: number;
  axes: Record<string, string[]>;
  properties: { name: string; type: PropertyType }[];
  moreProperties?: number;
}

export interface ComponentEntry {
  id: string;
  title: string;
  level: "atom" | "molecule" | "organism";
  category: string;
  summary: string;
  figmaPage: string;
  designDone: boolean;
  sets: ComponentSet[];
  uses: string[];
}

export interface Category {
  key: string;
  label: string;
  description: string;
}

const catalog = data as unknown as { source: { fileKey: string; fileName: string; syncedAt: string }; categories: Category[]; components: ComponentEntry[] };

export const CATALOG_SOURCE = catalog.source;
export const COMPONENT_CATEGORIES: Category[] = catalog.categories;
export const COMPONENTS: ComponentEntry[] = catalog.components;

const byId = new Map(COMPONENTS.map((c) => [c.id, c]));

export function getComponentEntry(id: string): ComponentEntry | undefined {
  return byId.get(id);
}

export function isComponentId(id: string): boolean {
  return byId.has(id);
}

/** Sets meant to be placed in screens (not internal parts, not deprecated). */
export function publicSets(c: ComponentEntry): ComponentSet[] {
  return c.sets.filter((s) => s.kind === "public");
}

/** True when the page only holds internal parts used inside other components. */
export function isBuildingBlock(c: ComponentEntry): boolean {
  return publicSets(c).length === 0;
}

export function previewSrc(id: string): string {
  return `/components/${id}.png`;
}

/** Deep link to the component's page in the Figma file. */
export function figmaUrl(nodeId: string): string {
  return `https://www.figma.com/design/${CATALOG_SOURCE.fileKey}/?node-id=${nodeId.replace(":", "-")}`;
}

/** Components that use the given one (reverse of `uses`). */
export function componentUsedBy(id: string): ComponentEntry[] {
  return COMPONENTS.filter((c) => c.uses.includes(id));
}
