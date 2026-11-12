import { describe, expect, it } from "vitest";
import { fighters, metrics } from "@/lib/engine/data";
import { actualValue, localDate } from "@/lib/engine/rounds";
import { snapValue } from "@/lib/engine/scale";
import { dailyScore } from "@/lib/engine/scoring";

describe("data", () => {
  it("loads the built files", () => {
    expect(fighters.length).toBeGreaterThanOrEqual(150);
    expect(metrics.length).toBeGreaterThanOrEqual(5);
    expect(metrics.some((m) => m.id === "height" || m.id === "reach")).toBe(true);
  });
  it("only references shipped metrics", () => {
    const ids = new Set(metrics.map((m) => m.id));
    for (const f of fighters) for (const key of Object.keys(f.metrics)) expect(ids.has(key)).toBe(true);
  });
  it("keeps every eligible actual value in range and scorable", () => {
    const today = localDate(new Date());
    for (const m of metrics) for (const f of fighters) {
      if (!(m.id in f.metrics)) continue;
      const actual = actualValue(f, m.id, today);
      expect(actual).toBeGreaterThanOrEqual(m.min);
      expect(actual).toBeLessThanOrEqual(m.max);
      expect(dailyScore(m, snapValue(m, actual), actual)).toBe(100);
    }
  });
});
