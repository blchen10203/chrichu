import { describe, expect, it } from "vitest";
import { fighters } from "@/lib/engine/data";
import { maybeRankingRound, RANKING, randomRankingRound, rankingScore } from "@/lib/engine/ranking";
import { rng } from "@/lib/engine/rng";
import { SURVIVAL_HP, takeRankingHit } from "@/lib/engine/scoring";
import { rankings, type Division } from "@/lib/rankings";

const [a, b, c, d] = fighters;
const division = (ranked: [number, string][], is_p4p = false): Division => ({
  division: is_p4p ? "Pound-for-Pound" : "Flyweight",
  is_p4p,
  champion: null,
  ranked: ranked.map(([rank, id]) => ({ rank, name: id, slug: id, id, change: null })),
});

describe("randomRankingRound", () => {
  it("draws three fighters of one division into rank order, each from the pool", () => {
    for (let i = 0; i < 50; i++) {
      const round = randomRankingRound(rng(`r${i}`), rankings.divisions, fighters)!;
      const d = rankings.divisions.find((x) => x.division === round.division)!;
      expect(d.is_p4p).toBe(false);
      expect(round.slots).toHaveLength(3);
      expect(round.slots.map((s) => s.rank)).toEqual([...round.slots.map((s) => s.rank)].sort((x, y) => x - y));
      for (const s of round.slots) expect(d.ranked.find((r) => r.id === s.fighter.id)?.rank).toBe(s.rank);
      expect(new Set(round.order.map((f) => f.id))).toEqual(new Set(round.slots.map((s) => s.fighter.id)));
    }
  });
  it("skips P4P lists, tied ranks, and fighters outside the pool", () => {
    const tied = division([[1, a.id], [2, b.id], [2, c.id], [4, d.id]]);
    expect(randomRankingRound(Math.random, [tied], fighters)).toBeNull(); // only ranks 1 and 4 are untied
    const p4p = division([[1, a.id], [2, b.id], [3, c.id]], true);
    expect(randomRankingRound(Math.random, [p4p], fighters)).toBeNull();
    const ok = division([[1, a.id], [2, b.id], [3, c.id]]);
    expect(randomRankingRound(Math.random, [ok], [a, b])).toBeNull();
    expect(randomRankingRound(Math.random, [ok], fighters)?.slots.map((s) => s.fighter.id)).toEqual([a.id, b.id, c.id]);
  });
});

describe("maybeRankingRound", () => {
  it("never opens a run, never comes twice in a row, and otherwise comes about one round in four", () => {
    const always = () => 0;
    expect(maybeRankingRound(always, rankings.divisions, fighters)).toBeNull();
    expect(maybeRankingRound(always, rankings.divisions, fighters, RANKING)).toBeNull();
    expect(maybeRankingRound(always, rankings.divisions, fighters, "height")).not.toBeNull();
    const rand = rng("share");
    let n = 0;
    for (let i = 0; i < 2000; i++) if (maybeRankingRound(rand, rankings.divisions, fighters, "height")) n++;
    expect(n / 2000).toBeGreaterThan(0.2);
    expect(n / 2000).toBeLessThan(0.3);
  });
});

describe("scoring a ranking round", () => {
  const round = randomRankingRound(Math.random, [division([[3, a.id], [5, b.id], [6, c.id]])], fighters)!;
  it("gives a third of 100 per fighter in the right slot, and nothing for an empty one", () => {
    expect(rankingScore(round, [a.id, b.id, c.id])).toBe(100);
    expect(rankingScore(round, [a.id, c.id, b.id])).toBe(33);
    expect(rankingScore(round, [b.id, c.id, a.id])).toBe(0);
    expect(rankingScore(round, [a.id, null, null])).toBe(33);
  });
  it("costs HP like a slider guess with the same score", () => {
    expect(takeRankingHit(SURVIVAL_HP, 100)).toEqual({ hp: 10, lost: 0 });
    expect(takeRankingHit(SURVIVAL_HP, 33)).toEqual({ hp: 8.3, lost: 1.7 });
    expect(takeRankingHit(SURVIVAL_HP, 0)).toEqual({ hp: 7.5, lost: 2.5 });
    expect(takeRankingHit(1, 0)).toEqual({ hp: 0, lost: 1 });
  });
});
