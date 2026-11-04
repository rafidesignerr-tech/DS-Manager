/**
 * Foundation token model. Reads tokens.json (the source of truth, a DTCG export)
 * and builds a read-only index: tiers, modes, reference chains and "used by" links.
 * To update tokens, replace tokens.json; nothing else needs to change.
 */
import raw from "./tokens.json";

export type SectionId = "colors" | "typography" | "spacing" | "radius" | "elevation" | "layout";
export type Tier = "scale" | "primitive" | "semantic";

export const SECTIONS: { id: SectionId; label: string; description: string }[] = [
  { id: "colors", label: "Colors", description: "Palettes, brand colors and semantic color roles for Light and Dark." },
  { id: "typography", label: "Typography", description: "Type scale, primitives and the semantic text styles." },
  { id: "spacing", label: "Spacing", description: "Spacing steps and semantic spacing across three densities." },
  { id: "radius", label: "Radius", description: "Corner scale, named radii and semantic shape tokens." },
  { id: "elevation", label: "Elevation", description: "Shadow geometry and semantic shadow opacity per theme." },
  { id: "layout", label: "Layout", description: "Breakpoints, grid and page layout per device." },
];

export const TIER_LABELS: Record<Tier, string> = { scale: "Scale", primitive: "Primitive", semantic: "Semantic" };

/** Token-set groups that have more than one mode, and the default mode used to resolve references. */
export const MODE_GROUPS = {
  "color-semantic": { label: "Theme", modes: ["Light", "Dark"], default: "Light" },
  "typography-scale": { label: "Type scale", modes: ["XL", "LG", "MD", "SM"], default: "LG" },
  "spacing-semantic": { label: "Density", modes: ["Default", "Compact", "Comfortable"], default: "Default" },
  "layout-semantic": { label: "Device", modes: ["Mobile", "Tablet", "Desktop"], default: "Desktop" },
} as const;
export type ModeGroup = keyof typeof MODE_GROUPS;
export type ModeContext = Partial<Record<ModeGroup, string>>;

export interface TokenValue {
  /** Value as written in the file, e.g. "{colors.coolgray.25}" or "#ffffff". */
  raw: string | number;
  /** Referenced token id, when the value is an alias. */
  ref: string | null;
}

export interface Token {
  id: string;
  /** Path in the file, dot separated: colors.bg.base.canvas */
  path: string;
  /** Token-set group, e.g. "color-semantic". */
  set: string;
  section: SectionId;
  tier: Tier;
  /** Grouping key for tables, e.g. "colors.bg.base". */
  group: string;
  name: string;
  type: string;
  description: string;
  webVar: string | null;
  /** Mode names for this token's own set ("Default" when the set has one mode). */
  modes: string[];
  /** Single-value tokens use the "" property; text styles use family/weight/size/... */
  values: Record<string, Record<string, TokenValue>>;
}

type RawNode = { $value?: unknown; $type?: string; $description?: string; $extensions?: Record<string, unknown> } & Record<string, unknown>;

function setInfo(setName: string): { set: string; mode: string } {
  const [set, mode = "Default"] = setName.split("/");
  return { set: set ?? setName, mode };
}

function classify(set: string, path: string): { section: SectionId; tier: Tier } {
  const top = path.split(".")[0];
  switch (set) {
    case "primitives":
      if (top === "colors") return { section: "colors", tier: "primitive" };
      if (top === "typography") return { section: "typography", tier: "primitive" };
      if (top === "spacing") return { section: "spacing", tier: "primitive" };
      if (top === "radius") return { section: "radius", tier: "primitive" };
      if (top === "elevation") return { section: "elevation", tier: "primitive" };
      return { section: "layout", tier: "primitive" };
    case "color-semantic":
      return top === "shadow" ? { section: "elevation", tier: "semantic" } : { section: "colors", tier: "semantic" };
    case "typography-semantic":
      return { section: "typography", tier: "semantic" };
    case "typography-scale":
      return { section: "typography", tier: "scale" };
    case "spacing-semantic":
      return { section: "spacing", tier: "semantic" };
    case "radius-semantic":
      return { section: "radius", tier: "semantic" };
    case "radius-scale":
      return { section: "radius", tier: "scale" };
    case "layout-scale":
      return { section: "layout", tier: "scale" };
    default:
      return { section: "layout", tier: "semantic" };
  }
}

export const TEXT_STYLE_PROPERTIES = ["family", "weight", "size", "line-height", "letter-spacing"] as const;

const REF = /^\{(.+)\}$/;

function walk(node: RawNode, path: string[], out: { path: string; node: RawNode }[]) {
  if (node && typeof node === "object" && "$value" in node) {
    out.push({ path: path.join("."), node });
    return;
  }
  for (const [k, v] of Object.entries(node ?? {})) {
    if (k.startsWith("$") || !v || typeof v !== "object") continue;
    walk(v as RawNode, [...path, k], out);
  }
}

export function tokenId(set: string, path: string): string {
  return `${set}--${path}`;
}

function build(data: Record<string, unknown>) {
  const tokens = new Map<string, Token>();
  const byPath = new Map<string, string>();

  for (const [setName, tree] of Object.entries(data)) {
    if (setName.startsWith("$")) continue;
    const { set, mode } = setInfo(setName);
    const leaves: { path: string; node: RawNode }[] = [];
    walk(tree as RawNode, [], leaves);
    for (const { path, node } of leaves) {
      byPath.set(path, path); // filled with ids below
      const isTextStyle = set === "typography-semantic";
      const ownerPath = isTextStyle ? path.slice(0, path.lastIndexOf(".")) : path;
      const property = isTextStyle ? path.slice(path.lastIndexOf(".") + 1) : "";
      const id = tokenId(set, ownerPath);
      let token = tokens.get(id);
      if (!token) {
        const { section, tier } = classify(set, ownerPath);
        const parts = ownerPath.split(".");
        const ext = (node.$extensions ?? {}) as Record<string, { Web?: string } | undefined>;
        token = {
          id,
          path: ownerPath,
          set,
          section,
          tier,
          group: parts.slice(0, -1).join("."),
          name: parts.at(-1) ?? ownerPath,
          type: isTextStyle ? "typography" : String(node.$type ?? "unknown"),
          description: isTextStyle ? "" : String(node.$description ?? ""),
          webVar: isTextStyle ? null : (ext["com.figma.codeSyntax"]?.Web ?? null),
          modes: [],
          values: {},
        };
        tokens.set(id, token);
      }
      if (!token.modes.includes(mode)) token.modes.push(mode);
      const value = node.$value;
      (token.values[property] ??= {})[mode] = { raw: typeof value === "number" ? value : String(value), ref: null };
    }
  }

  // Path → token id. Text-style properties are addressable by their full path.
  const pathToId = new Map<string, string>();
  for (const t of tokens.values()) pathToId.set(t.path, t.id);
  for (const t of tokens.values()) {
    if (t.set !== "typography-semantic") continue;
    for (const prop of Object.keys(t.values)) pathToId.set(`${t.path}.${prop}`, t.id);
  }

  const usedBy = new Map<string, Set<string>>();
  const unresolved: string[] = [];
  for (const t of tokens.values()) {
    for (const byMode of Object.values(t.values)) {
      for (const v of Object.values(byMode)) {
        const m = typeof v.raw === "string" ? REF.exec(v.raw) : null;
        if (!m?.[1]) continue;
        const target = pathToId.get(m[1]) ?? null;
        v.ref = target;
        if (!target) unresolved.push(`${t.path} → ${m[1]}`);
        else {
          if (!usedBy.has(target)) usedBy.set(target, new Set());
          usedBy.get(target)!.add(t.id);
        }
      }
    }
  }
  return { tokens, usedBy, unresolved, pathToId };
}

const INDEX = build(raw as Record<string, unknown>);

export function allTokens(): Token[] {
  return [...INDEX.tokens.values()];
}
export function getToken(id: string): Token | undefined {
  return INDEX.tokens.get(id);
}
export function tokenByPath(path: string): Token | undefined {
  const id = INDEX.pathToId.get(path);
  return id ? INDEX.tokens.get(id) : undefined;
}
export function usedBy(id: string): Token[] {
  return [...(INDEX.usedBy.get(id) ?? [])].map((x) => INDEX.tokens.get(x)!).filter(Boolean);
}
export function unresolvedReferences(): string[] {
  return INDEX.unresolved;
}

export function isModeGroup(set: string): set is ModeGroup {
  return set in MODE_GROUPS;
}

export function defaultContext(): ModeContext {
  return Object.fromEntries(Object.entries(MODE_GROUPS).map(([k, v]) => [k, v.default])) as ModeContext;
}

export interface Resolved {
  value: string | number | null;
  /** Ids from the token's own value down to the final literal. */
  chain: string[];
}

/** Follows aliases to a literal value under the given mode context. */
export function resolve(token: Token, property = "", ctx: ModeContext = defaultContext(), ownMode?: string): Resolved {
  const chain: string[] = [];
  let current: Token | undefined = token;
  let prop = property;
  let mode = ownMode;
  for (let depth = 0; current && depth < 20; depth++) {
    const byMode: Record<string, TokenValue> | undefined = current.values[prop] ?? current.values[""];
    if (!byMode) return { value: null, chain };
    const pick: string =
      mode && byMode[mode] ? mode : isModeGroup(current.set) ? (ctx[current.set] ?? MODE_GROUPS[current.set].default) : (Object.keys(byMode)[0] ?? "Default");
    const v: TokenValue | undefined = byMode[pick];
    if (!v) return { value: null, chain };
    if (!v.ref) return { value: v.raw, chain };
    chain.push(v.ref);
    current = INDEX.tokens.get(v.ref);
    prop = "";
    mode = undefined;
  }
  return { value: null, chain };
}

/**
 * The mode group a token's value depends on: its own set's modes, or the first
 * multi-mode set reached through its references (e.g. a font-size primitive
 * that points into the type scale).
 */
export function varyingGroup(token: Token, property = ""): ModeGroup | null {
  if (isModeGroup(token.set)) return token.set;
  let current: Token | undefined = token;
  let prop = property;
  for (let depth = 0; current && depth < 20; depth++) {
    if (isModeGroup(current.set)) return current.set;
    const v = Object.values(current.values[prop] ?? current.values[""] ?? {})[0];
    if (!v?.ref) return null;
    current = INDEX.tokens.get(v.ref);
    prop = "";
  }
  return null;
}

/** Values for each mode of the group this token varies by (or a single entry). */
export function valuesByMode(token: Token, property = ""): { mode: string; resolved: Resolved; raw: TokenValue | undefined }[] {
  const group = varyingGroup(token, property);
  const own = token.values[property] ?? token.values[""] ?? {};
  if (!group) {
    const first = Object.keys(own)[0] ?? "Default";
    return [{ mode: first, resolved: resolve(token, property), raw: own[first] }];
  }
  return MODE_GROUPS[group].modes.map((mode) => {
    const ctx = { ...defaultContext(), [group]: mode };
    const isOwn = token.set === group;
    return { mode, resolved: resolve(token, property, ctx, isOwn ? mode : undefined), raw: isOwn ? own[mode] : Object.values(own)[0] };
  });
}

const PX_SECTIONS = new Set<SectionId>(["spacing", "radius", "layout"]);

/** Human display for a literal value. */
export function formatValue(token: Token, value: string | number | null, property = ""): string {
  if (value === null) return "—";
  if (typeof value === "number") {
    const p = property || token.path;
    const unitless = /weight|columns|\bcolumns\b/.test(p) || token.path.startsWith("layout.grid.columns") || token.path.startsWith("columns.");
    if (unitless) return String(value);
    if (PX_SECTIONS.has(token.section) || token.section === "elevation" || token.section === "typography") {
      return value === 999 && token.section === "radius" ? "999px (full)" : `${value}px`;
    }
    return String(value);
  }
  return value;
}

export function isColorLiteral(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v);
}

/** Section-level counts by tier. */
export function sectionStats(section: SectionId) {
  const list = allTokens().filter((t) => t.section === section);
  return {
    total: list.length,
    scale: list.filter((t) => t.tier === "scale").length,
    primitive: list.filter((t) => t.tier === "primitive").length,
    semantic: list.filter((t) => t.tier === "semantic").length,
  };
}

export function tokensFor(section: SectionId, tier: Tier): Token[] {
  return allTokens().filter((t) => t.section === section && t.tier === tier);
}

/** Converts a docs-style token mention ("color.bg.base.canvas", "spacing.stack.md", "shape.rounded") to a token. */
export function findMention(mention: string): Token | undefined {
  const m = mention.replace(/\//g, ".").trim();
  const candidates = [m, m.replace(/^color\./, "colors."), `spacing.${m}`, `radius.${m}`, `elevation.${m}`, `typography.${m}`, m.replace(/^spacing\./, ""), `elevation.shadow.${m.replace(/^shadow\./, "")}`, m.replace(/^radius\.scale\./, "radius.scale.")];
  for (const c of candidates) {
    const t = tokenByPath(c);
    if (t) return t;
  }
  return undefined;
}
