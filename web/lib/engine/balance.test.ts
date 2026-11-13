import { expect, it } from "vitest";
import { fighters, metrics } from "@/lib/engine/data";
import { rng } from "@/lib/engine/rng";
import { randomRound } from "@/lib/engine/rounds";
import { SURVIVAL_HP, dailyScore, takeHit } from "@/lib/engine/scoring";

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

it("a player who always guesses the median survives fewer than 12 rounds on average", () => {
  const median = (id: string) => {
    const v = fighters.filter((f) => id in f.metrics).map((f) => f.metrics[id]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const rand = rng("survival-balance");
  const RUNS = 500;
  let total = 0;
  for (let run = 0; run < RUNS; run++) {
    let hp = SURVIVAL_HP;
    let last: string | undefined;
    for (;;) {
      const round = randomRound(rand, fighters, metrics, last);
      last = round.metric;
      const metric = metrics.find((m) => m.id === round.metric)!;
      const target = fighters.find((f) => f.id === round.target)!;
      hp = takeHit(hp, metric, median(metric.id), target.metrics[metric.id]).hp;
      if (hp === 0) break;
      total++;
    }
  }
  expect(total / RUNS).toBeLessThan(12);
});
