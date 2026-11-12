import type { Metric } from "@/lib/engine/types";

// Spec 6.2: guesses within FREE_ZONE steps lose nothing; ZERO_DISTANCE steps off scores zero.
export const FREE_ZONE = 0.5;
export const ZERO_DISTANCE = 3;

export function penalty(metric: Metric, guess: number, actual: number): number {
  if (metric.scale === "log" && guess <= 0) return Infinity;
  const v = metric.scale === "log" ? Math.log10 : (x: number) => x;
  const stepsOff = Math.abs(v(guess) - v(actual)) / metric.step;
  return Math.max(0, stepsOff - FREE_ZONE);
}

export function dailyScore(metric: Metric, guess: number, actual: number): number {
  const p = penalty(metric, guess, actual);
  return Math.round(100 * Math.max(0, 1 - p / (ZERO_DISTANCE - FREE_ZONE)));
}
