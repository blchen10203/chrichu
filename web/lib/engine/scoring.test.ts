import { describe, expect, it } from "vitest";
import { dailyScore, penalty } from "@/lib/engine/scoring";
import type { Metric } from "@/lib/engine/types";

const base = { label: "", unit: "", round: "bar", min: 0, max: 1 } as const;
const reach: Metric = { ...base, id: "reach", scale: "linear", snap: 0.5, step: 2 };
const strikes: Metric = { ...base, id: "career_sig", scale: "log", snap: null, step: 0.15 };

describe("scoring", () => {
  it("matches the spec's linear example", () => {
    expect(penalty(reach, 81, 84.5)).toBeCloseTo(1.25);
    expect(dailyScore(reach, 81, 84.5)).toBe(50);
  });
  it("matches the spec's log example", () => {
    expect(penalty(strikes, 1700, 3400)).toBeCloseTo(1.507, 2);
    expect(dailyScore(strikes, 1700, 3400)).toBe(40);
  });
  it("is symmetric", () => {
    expect(dailyScore(reach, 88, 84.5)).toBe(50);
  });
  it("gives full marks inside the free zone", () => {
    expect(dailyScore(reach, 84.5, 84.5)).toBe(100);
    expect(dailyScore(reach, 85.5, 84.5)).toBe(100); // exactly 0.5 steps
    expect(penalty(reach, 85.5, 84.5)).toBe(0);
  });
  it("gives zero at 3 steps and beyond", () => {
    expect(dailyScore(reach, 90.5, 84.5)).toBe(0);
    expect(dailyScore(reach, 0, 84.5)).toBe(0);
  });
  it("scores a non-positive guess on a log metric as zero, not NaN", () => {
    expect(dailyScore(strikes, 0, 3400)).toBe(0);
  });
});
