import { describe, expect, it } from "vitest";
import { rng } from "@/lib/engine/rng";
import { deal, entriesOf, entryKey, rightCount, slotsOf } from "@/lib/engine/roulette";
import { rankings, type Division } from "@/lib/rankings";

const fighter = (slug: string) => ({ name: slug, slug, id: null });
const list = (ranks: number[], champion: string | null, is_p4p = false): Division => ({
  division: is_p4p ? "Pound-for-Pound" : "Flyweight",
  is_p4p,
  champion: champion ? fighter(champion) : null,
  ranked: ranks.map((rank, i) => ({ ...fighter(`f${i}`), rank, change: null })),
});

describe("slotsOf and entriesOf", () => {
  it("puts the champion first in a weight class", () => {
    const d = list([1, 2, 3], "champ");
    expect(slotsOf(d).map((s) => s.label)).toEqual(["Champ", "#1", "#2", "#3"]);
    const entries = entriesOf(d);
    expect(entries).toHaveLength(4);
    expect(entries[0].rank).toBe(0);
  });
  it("has no Champ slot for a vacant belt", () => {
    const d = list([1, 2, 3], null);
    expect(slotsOf(d).map((s) => s.label)).toEqual(["#1", "#2", "#3"]);
    expect(entriesOf(d)).toHaveLength(3);
  });
  it("leaves the champion out of a P4P list, where they are also ranked #1", () => {
    const d = list([1, 2, 3], "f0", true);
    expect(slotsOf(d).map((s) => s.label)).toEqual(["#1", "#2", "#3"]);
    expect(entriesOf(d)).toHaveLength(d.ranked.length);
  });
  it("gives every real list 16 slots with a champion and 15 without", () => {
    for (const d of rankings.divisions) {
      expect(slotsOf(d)).toHaveLength(!d.is_p4p && d.champion ? 16 : 15);
      expect(entriesOf(d)).toHaveLength(slotsOf(d).length);
    }
  });
});

describe("rightCount", () => {
  const d = list([1, 2, 2, 4], null);
  const [a, b, c, e] = entriesOf(d);
  it("counts slots whose fighter has that rank, ties right in either order", () => {
    expect(rightCount(d, [a, b, c, e])).toBe(4);
    expect(rightCount(d, [a, c, b, e])).toBe(4);
    expect(rightCount(d, [a, e, c, b])).toBe(2);
  });
});

describe("deal", () => {
  it("is a permutation of the entries and never fully right", () => {
    const d = list([1, 2, 3, 4], "champ");
    const keys = entriesOf(d).map(entryKey).sort();
    for (let i = 0; i < 200; i++) {
      const order = deal(rng(`x${i}`), d);
      expect(order.map(entryKey).sort()).toEqual(keys);
      expect(rightCount(d, order)).toBeLessThan(order.length);
    }
  });
});
