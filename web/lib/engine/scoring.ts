import type { Metric } from "@/lib/engine/types";

// Spec 6.2: guesses within FREE_ZONE steps lose nothing; ZERO_DISTANCE steps off scores zero.
export const FREE_ZONE = 0.5;
export const ZERO_DISTANCE = 3;
// Spec 6.3: Survival tunables.
export const SURVIVAL_HP = 10;
export const SURVIVAL_SECONDS = 15;

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

const oneDecimal = (x: number) => Math.round(x * 10) / 10;

// Survival damage: the round's penalty, to one decimal, never more than the HP left.
export function takeHit(hp: number, metric: Metric, guess: number, actual: number): { hp: number; lost: number } {
  const lost = Math.min(hp, oneDecimal(penalty(metric, guess, actual)));
  return { hp: oneDecimal(hp - lost), lost };
}
