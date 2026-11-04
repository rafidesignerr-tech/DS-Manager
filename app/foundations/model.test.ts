import { describe, expect, it } from "vitest";
import docs from "./docs.json";
import {
  allTokens,
  findMention,
  formatValue,
  getToken,
  resolve,
  sectionStats,
  tokenId,
  unresolvedReferences,
  usedBy,
  valuesByMode,
  varyingGroup,
} from "./model";

describe("token index", () => {
  it("resolves every reference in the file", () => {
    expect(unresolvedReferences()).toEqual([]);
  });

  it("matches the counts in tokens.json", () => {
    expect(sectionStats("colors")).toMatchObject({ primitive: 146, semantic: 116 });
    expect(sectionStats("typography")).toMatchObject({ scale: 18, primitive: 44, semantic: 46 });
    expect(sectionStats("spacing")).toMatchObject({ primitive: 14, semantic: 31 });
    expect(sectionStats("radius")).toMatchObject({ scale: 9, primitive: 9, semantic: 13 });
    expect(sectionStats("elevation")).toMatchObject({ primitive: 17, semantic: 8 });
    expect(sectionStats("layout")).toMatchObject({ scale: 9, primitive: 15, semantic: 4 });
  });

  it("gives every token a unique id", () => {
    const ids = allTokens().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolution", () => {
  it("resolves semantic colors per theme", () => {
    const canvas = getToken(tokenId("color-semantic", "colors.bg.base.canvas"))!;
    const values = valuesByMode(canvas);
    expect(values.map((v) => v.mode)).toEqual(["Light", "Dark"]);
    expect(values[0]?.resolved.value).toBe("#f9fafc");
    expect(values[0]?.resolved.chain).toEqual([tokenId("primitives", "colors.coolgray.25")]);
  });

  it("follows font-size primitives into the type scale", () => {
    const size = getToken(tokenId("primitives", "typography.size.400"))!;
    expect(varyingGroup(size)).toBe("typography-scale");
    const byMode = valuesByMode(size);
    expect(byMode.map((v) => v.mode)).toEqual(["XL", "LG", "MD", "SM"]);
    expect(byMode.every((v) => typeof v.resolved.value === "number")).toBe(true);
  });

  it("resolves text style properties", () => {
    const style = getToken(tokenId("typography-semantic", "typography.display.lg.base"))!;
    expect(resolve(style, "family").value).toBe("Tawuniya");
    expect(resolve(style, "weight").value).toBe(500);
  });

  it("tracks used-by links", () => {
    const coolgray25 = tokenId("primitives", "colors.coolgray.25");
    expect(usedBy(coolgray25).some((t) => t.path === "colors.bg.base.canvas")).toBe(true);
  });

  it("formats units", () => {
    const space = getToken(tokenId("primitives", "spacing.space.500"))!;
    expect(formatValue(space, 16)).toBe("16px");
  });
});

describe("docs", () => {
  it("links most token mentions in the usage docs to real tokens", () => {
    const mentions = new Set<string>();
    for (const section of Object.values(docs)) {
      for (const table of [...section.overview, ...section.usage]) {
        for (const row of table.rows) for (const cell of row) for (const m of cell.match(/\b(?:color|spacing|shape|radius|shadow|typography|layout)[./][\w./%-]+\w/g) ?? []) mentions.add(m);
      }
    }
    const unmatched = [...mentions].filter((m) => !m.includes("*") && !findMention(m));
    // Docs may mention names that don't exist as tokens (e.g. effect styles); they render as plain text.
    expect(unmatched.length).toBeLessThan(mentions.size / 3);
  });
});
