import { describe, expect, it } from "vitest";
import {
  STORAGE_KEY, currentStreak, dailyStats, emptyState, load, recordGuess, recordInfinite, save, startDay,
} from "@/lib/storage";
import type { Round } from "@/lib/engine/types";

const rounds: Round[] = [1, 2, 3, 4, 5].map((i) => ({ metric: `m${i}`, ref: `a${i}`, target: `b${i}` }));
const fake = (value: string | null) => ({ getItem: () => value });
const playDay = (state = emptyState(), date: string, scores = [50, 50, 50, 50, 50]) =>
  scores.reduce((s, score) => recordGuess(s, date, 70, score), startDay(state, date, rounds));

describe("load and save", () => {
  it("round-trips", () => {
    let stored = "";
    const state = playDay(emptyState(), "2026-12-01");
    save(state, { setItem: (key, value) => { expect(key).toBe(STORAGE_KEY); stored = value; } });
    expect(load(fake(stored))).toEqual(state);
  });
  it.each([null, "", "not json", "null", "[]", '{"daily":5}', '{"daily":{"days":[]}}'])(
    "gives an empty state for %s", (value) => {
      expect(load(fake(value))).toEqual(emptyState());
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Patch = (s: any) => void;
  const broken = (patch: Patch) => {
    const s = JSON.parse(JSON.stringify(playDay(emptyState(), "2026-12-01")));
    patch(s);
    return JSON.stringify(s);
  };
  it.each<[string, Patch]>([
    ["a day entry that is empty", (s) => { s.daily.days["2026-12-01"] = {}; }],
    ["guesses that is not an array", (s) => { s.daily.days["2026-12-01"].guesses = "x"; }],
    ["a round missing target", (s) => { delete s.daily.days["2026-12-01"].rounds[0].target; }],
    ["an empty infinite", (s) => { s.infinite = {}; }],
    ["a string survival best", (s) => { s.survival.best = "1"; }],
    ["a numeric lastDone", (s) => { s.daily.lastDone = 5; }],
  ])("gives an empty state for %s", (_name, patch) => {
    expect(load(fake(broken(patch)))).toEqual(emptyState());
  });
  it("gives an empty state when storage is missing or throws", () => {
    expect(load(null)).toEqual(emptyState());
    expect(load({ getItem: () => { throw new Error("blocked"); } })).toEqual(emptyState());
  });
  it("does not throw when saving fails", () => {
    expect(() => save(emptyState(), { setItem: () => { throw new Error("full"); } })).not.toThrow();
    expect(() => save(emptyState(), null)).not.toThrow();
  });
});

describe("daily progress", () => {
  it("starts a day once and keeps its rounds", () => {
    const started = startDay(emptyState(), "2026-12-01", rounds);
    expect(started.daily.days["2026-12-01"]).toEqual({ rounds, guesses: [], scores: [], done: false });
    expect(startDay(recordGuess(started, "2026-12-01", 81, 50), "2026-12-01", [])).toEqual(
      recordGuess(started, "2026-12-01", 81, 50));
  });
  it("records each guess and finishes on the fifth", () => {
    const four = playDay(emptyState(), "2026-12-01", [10, 20, 30, 40]);
    expect(four.daily.days["2026-12-01"].done).toBe(false);
    expect(four.daily.streak).toBe(0);
    const five = recordGuess(four, "2026-12-01", 70, 50);
    expect(five.daily.days["2026-12-01"]).toMatchObject({ guesses: [70, 70, 70, 70, 70], scores: [10, 20, 30, 40, 50], done: true });
    expect(five.daily).toMatchObject({ streak: 1, maxStreak: 1, lastDone: "2026-12-01" });
  });
  it("ignores a guess on a finished or unstarted day", () => {
    const done = playDay(emptyState(), "2026-12-01");
    expect(recordGuess(done, "2026-12-01", 1, 100)).toEqual(done);
    expect(recordGuess(emptyState(), "2026-12-01", 1, 100)).toEqual(emptyState());
  });
  it("does not change the state it was given", () => {
    const before = startDay(emptyState(), "2026-12-01", rounds);
    const copy = structuredClone(before);
    recordGuess(before, "2026-12-01", 81, 50);
    expect(before).toEqual(copy);
  });
});

describe("streak", () => {
  it("grows on consecutive days, across a month end", () => {
    const s = playDay(playDay(playDay(emptyState(), "2026-12-30"), "2026-12-31"), "2027-01-01");
    expect(s.daily).toMatchObject({ streak: 3, maxStreak: 3, lastDone: "2027-01-01" });
  });
  it("resets after a missed day but keeps the record", () => {
    const s = playDay(playDay(playDay(emptyState(), "2026-12-01"), "2026-12-02"), "2026-12-04");
    expect(s.daily).toMatchObject({ streak: 1, maxStreak: 2 });
  });
  it("shows zero once a day has been missed", () => {
    const s = playDay(emptyState(), "2026-12-01");
    expect(currentStreak(s, "2026-12-01")).toBe(1);
    expect(currentStreak(s, "2026-12-02")).toBe(1); // today not played yet
    expect(currentStreak(s, "2026-12-03")).toBe(0);
    expect(currentStreak(emptyState(), "2026-12-01")).toBe(0);
  });
});

describe("stats", () => {
  it("averages and finds the best finished day", () => {
    let s = playDay(emptyState(), "2026-12-01", [100, 100, 100, 100, 41]);
    s = playDay(s, "2026-12-02", [60, 60, 60, 60, 60]);
    s = recordGuess(startDay(s, "2026-12-03", rounds), "2026-12-03", 1, 100); // unfinished
    expect(dailyStats(s)).toEqual({ played: 2, average: 371, best: 441 });
    expect(dailyStats(emptyState())).toEqual({ played: 0, average: 0, best: 0 });
  });
  it("totals Infinite rounds", () => {
    expect(recordInfinite(recordInfinite(emptyState(), 80), 40).infinite).toEqual({ rounds: 2, totalScore: 120 });
  });
});
