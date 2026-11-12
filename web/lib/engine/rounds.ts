import { rng } from "./rng";
import type { Fighter, FighterId, Metric, MetricId, Round } from "./types";

const DAY_MS = 86_400_000;
const SET_SIZE = 5;

const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`);
const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const eligible = (fighters: Fighter[], metric: MetricId) => fighters.filter((f) => metric in f.metrics);
const pick = <T>(rand: () => number, items: T[]) => items[Math.floor(rand() * items.length)];

export function localDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function puzzleNumber(date: string, launchDate: string): number {
  return Math.round((utcDay(date) - utcDay(launchDate)) / DAY_MS) + 1;
}

export function ageOn(dob: string, date: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function actualValue(fighter: Fighter, metricId: MetricId, date: string): number {
  return metricId === "age" ? ageOn(fighter.dob!, date) : fighter.metrics[metricId];
}

// Picks a metric and two different eligible fighters (none of `used`).
function roundFor(rand: () => number, metric: MetricId, fighters: Fighter[], used: Set<FighterId>): Round {
  const pool = eligible(fighters, metric).filter((f) => !used.has(f.id));
  if (pool.length < 2) throw new Error(`Not enough fighters for metric ${metric}`);
  const ref = pick(rand, pool);
  const target = pick(rand, pool.filter((f) => f !== ref));
  return { metric, ref: ref.id, target: target.id };
}

export function randomRound(rand: () => number, fighters: Fighter[], metrics: Metric[], avoidMetric?: MetricId): Round {
  const choices = byId(metrics).filter((m) => m.id !== avoidMetric);
  return roundFor(rand, pick(rand, choices).id, byId(fighters), new Set());
}

export function dailySet(date: string, fighters: Fighter[], metrics: Metric[]): Round[] {
  const rand = rng(date);
  const sortedFighters = byId(fighters);
  const sortedMetrics = byId(metrics);
  const silhouettes = sortedMetrics.filter((m) => m.id === "height" || m.id === "reach");
  if (sortedMetrics.length < SET_SIZE || silhouettes.length === 0) throw new Error("Not enough metrics for a Daily set");

  const first = pick(rand, silhouettes);
  const rest = sortedMetrics.filter((m) => m !== first);
  const chosen = [first];
  while (chosen.length < SET_SIZE) chosen.push(...rest.splice(Math.floor(rand() * rest.length), 1));
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }

  const used = new Set<FighterId>();
  return chosen.map((m) => {
    const round = roundFor(rand, m.id, sortedFighters, used);
    used.add(round.ref).add(round.target);
    return round;
  });
}

export function isValidRound(round: Round, fighters: Fighter[], metrics: Metric[]): boolean {
  if (!metrics.some((m) => m.id === round.metric) || round.ref === round.target) return false;
  const ok = (id: FighterId) => fighters.some((f) => f.id === id && round.metric in f.metrics);
  return ok(round.ref) && ok(round.target);
}

export function repairRounds(saved: Round[], played: number, date: string, fighters: Fighter[], metrics: Metric[]): Round[] {
  if (saved.slice(played).every((r) => isValidRound(r, fighters, metrics))) return saved;
  return [...saved.slice(0, played), ...dailySet(date, fighters, metrics).slice(played)];
}
