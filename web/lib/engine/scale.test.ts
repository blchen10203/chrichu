import { describe, expect, it } from "vitest";
import { formatValue, fromFraction, nudge, snapValue, toFraction } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";

const m = (over: Partial<Metric>): Metric => ({
  id: "x", label: "", unit: "", round: "bar", scale: "linear", snap: 1, min: 0, max: 100, step: 1, ...over,
});
const reach = m({ id: "reach", unit: "in", snap: 0.5, min: 59.8, max: 86.2 });
const strikes = m({ id: "career_sig", scale: "log", snap: null, min: 22.6566, max: 5867.9579 });

describe("snapValue", () => {
  it("snaps linear values to the snap", () => {
    expect(snapValue(reach, 81.26)).toBe(81.5);
    expect(snapValue(m({ snap: 0.1, max: 9 }), 6.5499)).toBe(6.5);
  });
  it("stays inside the range", () => {
    expect(snapValue(reach, 10)).toBe(60);
    expect(snapValue(reach, 200)).toBe(86);
  });
  it("snaps log values to 2 significant figures inside the range", () => {
    expect(snapValue(strikes, 1564)).toBe(1600);
    expect(snapValue(strikes, 742)).toBe(740);
    expect(snapValue(strikes, 5)).toBe(23);
    expect(snapValue(strikes, 99999)).toBe(5800);
  });
});

describe("nudge", () => {
  it("moves one snap", () => {
    expect(nudge(reach, 81, 1)).toBe(81.5);
    expect(nudge(reach, 81, -1)).toBe(80.5);
  });
  it("stops at the ends", () => {
    expect(nudge(reach, 86, 1)).toBe(86);
    expect(nudge(reach, 60, -1)).toBe(60);
  });
  it("moves one 2-significant-figure value on a log metric", () => {
    expect(nudge(strikes, 1600, 1)).toBe(1700);
    expect(nudge(strikes, 1000, -1)).toBe(990);
    expect(nudge(strikes, 99, 1)).toBe(100);
    expect(nudge(strikes, 5800, 1)).toBe(5800);
    expect(nudge(strikes, 23, -1)).toBe(23);
  });
});

describe("axis position", () => {
  it("is linear for linear metrics", () => {
    expect(toFraction(m({ min: 60, max: 80 }), 70)).toBeCloseTo(0.5);
    expect(fromFraction(m({ min: 60, max: 80 }), 0.5)).toBe(70);
  });
  it("is logarithmic for log metrics", () => {
    const log = m({ scale: "log", snap: null, min: 10, max: 1000 });
    expect(toFraction(log, 100)).toBeCloseTo(0.5);
    expect(fromFraction(log, 0.5)).toBe(100);
  });
  it("clamps positions outside the axis", () => {
    expect(fromFraction(reach, -1)).toBe(60);
    expect(fromFraction(reach, 2)).toBe(86);
  });
});

describe("formatValue", () => {
  it("uses the snap's decimals and the unit", () => {
    expect(formatValue(reach, 81)).toBe("81.0 in");
    expect(formatValue(m({ unit: "in", snap: 1 }), 76)).toBe("76 in");
    expect(formatValue(m({ unit: "/min", snap: 0.1 }), 6.5)).toBe("6.5");
    expect(formatValue(m({ unit: "%", snap: 1 }), 96)).toBe("96%");
    expect(formatValue(m({ unit: "years", snap: 1 }), 39)).toBe("39");
  });
  it("writes inches as feet and inches when asked", () => {
    const height = m({ unit: "in", snap: 1 });
    expect(formatValue(height, 74, true)).toBe(`6' 2"`);
    expect(formatValue(height, 72, true)).toBe(`6' 0"`);
    expect(formatValue(height, 71.6, true)).toBe(`6' 0"`); // rounds before splitting
    expect(formatValue(reach, 84.5, true)).toBe(`7' 0.5"`);
    expect(formatValue(reach, 2.5, true)).toBe(`2.5"`); // a gap under a foot
    expect(formatValue(m({ unit: "%", snap: 1 }), 96, true)).toBe("96%"); // other units ignore it
  });
  it("groups thousands on log metrics", () => {
    expect(formatValue(strikes, 1600)).toBe("1,600");
  });
});
