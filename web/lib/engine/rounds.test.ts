import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";
import { fighters, metrics } from "@/lib/engine/data";
import { rng } from "@/lib/engine/rng";
import {
  MIN_REF_FRACTION, actualValue, ageOn, dailySet, isValidRound, localDate, puzzleNumber, randomRound, repairRounds,
} from "@/lib/engine/rounds";
import { toFraction } from "@/lib/engine/scale";
import type { Round } from "@/lib/engine/types";

const DAY = "2026-12-01";
const byId = new Map(fighters.map((f) => [f.id, f]));

describe("dates", () => {
  it("formats the local day", () => {
    expect(localDate(new Date(2026, 11, 1, 23, 59))).toBe("2026-12-01");
    expect(localDate(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
  it("numbers puzzles from the first puzzle day", () => {
    expect(puzzleNumber("2026-11-13", "2026-11-13")).toBe(1);
    expect(puzzleNumber("2026-12-24", "2026-11-13")).toBe(42);
  });
  it("counts Daily #1 from a fixed first puzzle day", () => {
    expect(config).not.toHaveProperty("launchDate");
    expect(config.firstPuzzle).toBe("2026-11-13");
  });
  it("counts whole years of age", () => {
    expect(ageOn("1987-07-19", "2026-07-18")).toBe(38);
    expect(ageOn("1987-07-19", "2026-07-19")).toBe(39);
  });
  it("reads age from the birth date, not the file", () => {
    const jones = byId.get("jon-jones")!;
    expect(actualValue(jones, "age", "2030-07-19")).toBe(43);
    expect(actualValue(jones, "height", DAY)).toBe(jones.metrics.height);
  });
});

describe("dailySet", () => {
  const set = dailySet(DAY, fighters, metrics);
  it("has 5 different metrics, one of them height or reach", () => {
    expect(set).toHaveLength(5);
    expect(new Set(set.map((r) => r.metric)).size).toBe(5);
    expect(set.some((r) => r.metric === "height" || r.metric === "reach")).toBe(true);
  });
  it("never repeats a fighter and only uses eligible ones", () => {
    const used = set.flatMap((r) => [r.ref, r.target]);
    expect(new Set(used).size).toBe(10);
    for (const r of set) expect(isValidRound(r, fighters, metrics)).toBe(true);
  });
  it("is the same for everyone on the same day", () => {
    expect(dailySet(DAY, fighters, metrics)).toEqual(set);
    expect(dailySet(DAY, [...fighters].reverse(), [...metrics].reverse())).toEqual(set);
  });
  it("changes from day to day", () => {
    expect(dailySet("2026-12-02", fighters, metrics)).not.toEqual(set);
  });
  it("holds its rules across a year of days", () => {
    for (let i = 0; i < 365; i++) {
      const date = localDate(new Date(2026, 11, 1 + i));
      const s = dailySet(date, fighters, metrics);
      expect(new Set(s.map((r) => r.metric)).size).toBe(5);
      expect(new Set(s.flatMap((r) => [r.ref, r.target])).size).toBe(10);
      expect(s.some((r) => r.metric === "height" || r.metric === "reach")).toBe(true);
    }
  });
  it("fails loudly when the data cannot make a set", () => {
    expect(() => dailySet(DAY, fighters, metrics.slice(0, 4))).toThrow();
    expect(() => dailySet(DAY, fighters, metrics.filter((m) => m.round === "bar"))).toThrow();
  });
});

describe("randomRound", () => {
  it("picks two different eligible fighters", () => {
    const rand = rng("x");
    for (let i = 0; i < 200; i++) {
      const r = randomRound(rand, fighters, metrics);
      expect(r.ref).not.toBe(r.target);
      expect(isValidRound(r, fighters, metrics)).toBe(true);
    }
  });
  it("never repeats the avoided metric", () => {
    const rand = rng("y");
    for (let i = 0; i < 200; i++) expect(randomRound(rand, fighters, metrics, "reach").metric).not.toBe("reach");
  });
});

describe("reference fighters", () => {
  // With no axis numbers, the blue bar is the only scale: it must be tall enough to judge by.
  const visible = (r: Round) => {
    const m = metrics.find((x) => x.id === r.metric)!;
    return m.round === "silhouette" || toFraction(m, byId.get(r.ref)!.metrics[m.id]) >= MIN_REF_FRACTION;
  };
  it("never gives a bar round a reference too short to judge by", () => {
    const rand = rng("refs");
    for (let i = 0; i < 2000; i++) expect(visible(randomRound(rand, fighters, metrics))).toBe(true);
    for (let i = 0; i < 365; i++) {
      for (const r of dailySet(localDate(new Date(2026, 11, 1 + i)), fighters, metrics)) expect(visible(r)).toBe(true);
    }
  });
  it("still lets the target be any eligible fighter, a zero included", () => {
    const rand = rng("targets");
    const zero = Array.from({ length: 2000 }, () => randomRound(rand, fighters, metrics))
      .some((r) => byId.get(r.target)!.metrics[r.metric] === 0);
    expect(zero).toBe(true);
  });
});

describe("saved rounds", () => {
  const set = dailySet(DAY, fighters, metrics);
  it("spots a round whose fighter or metric is gone", () => {
    expect(isValidRound({ ...set[0], target: "nobody" }, fighters, metrics)).toBe(false);
    expect(isValidRound({ ...set[0], metric: "nope" }, fighters, metrics)).toBe(false);
    expect(isValidRound({ ...set[0], ref: set[0].target }, fighters, metrics)).toBe(false);
  });
  it("keeps a healthy saved set as it is", () => {
    expect(repairRounds(set, 2, DAY, fighters, metrics)).toEqual(set);
  });
  it("keeps played rounds and rebuilds the unplayed ones when one is broken", () => {
    const saved = set.map((r, i) => (i === 3 ? { ...r, target: "nobody" } : r));
    const fixed = repairRounds(saved, 2, DAY, fighters, metrics);
    expect(fixed.slice(0, 2)).toEqual(saved.slice(0, 2));
    expect(fixed.slice(2)).toEqual(set.slice(2));
  });
  it("repairs unplayed rounds when a fighter is removed from the data", () => {
    const smaller = fighters.filter((f) => f.id !== set[3].target);
    const fixed = repairRounds(set, 2, DAY, smaller, metrics);
    expect(fixed.slice(0, 2)).toEqual(set.slice(0, 2));
    expect(fixed).toHaveLength(5);
    for (const r of fixed.slice(2)) expect(isValidRound(r, smaller, metrics)).toBe(true);
  });
  it("leaves a broken round alone once it has been played", () => {
    const saved = set.map((r, i) => (i === 0 ? { ...r, target: "nobody" } : r));
    expect(repairRounds(saved, 1, DAY, fighters, metrics)).toEqual(saved);
  });
});
