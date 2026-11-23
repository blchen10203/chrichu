import { describe, expect, it } from "vitest";
import { fighters } from "@/lib/engine/data";
import { getFighterRank, rankings } from "@/lib/rankings";

describe("rankings", () => {
  it("loads the scraped file", () => {
    expect(rankings.divisions.length).toBeGreaterThanOrEqual(10);
    for (const d of rankings.divisions) expect(d.ranked.length).toBeGreaterThanOrEqual(5);
  });
  it("only links fighters we have", () => {
    const ids = new Set(fighters.map((f) => f.id));
    for (const d of rankings.divisions)
      for (const f of [d.champion, ...d.ranked]) if (f?.id) expect(ids.has(f.id)).toBe(true);
  });
  it("finds a champion's belt and a contender's rank", () => {
    const division = rankings.divisions.find((d) => !d.is_p4p && d.champion?.id)!;
    expect(getFighterRank(division.champion!.id!)).toMatchObject({ isChampion: true, rank: 0 });
    const contender = rankings.divisions
      .flatMap((d) => d.ranked.map((r) => ({ ...r, d })))
      .find((r) => r.id && !r.d.is_p4p && !rankings.divisions.some((d) => d.champion?.id === r.id))!;
    expect(getFighterRank(contender.id!)?.isChampion).toBe(false);
    expect(getFighterRank("no-such-fighter")).toBeNull();
  });
});
