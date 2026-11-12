import { expect, it } from "vitest";
import { fighters, metrics } from "@/lib/engine/data";
import { dailyScore } from "@/lib/engine/scoring";

it("a player who always guesses the median averages 40 to 55 per round", () => {
  const perMetric = metrics.map((m) => {
    const values = fighters.filter((f) => m.id in f.metrics).map((f) => f.metrics[m.id]).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    return values.reduce((sum, v) => sum + dailyScore(m, median, v), 0) / values.length;
  });
  const average = perMetric.reduce((a, b) => a + b, 0) / perMetric.length;
  expect(average).toBeGreaterThanOrEqual(40);
  expect(average).toBeLessThanOrEqual(55);
});
