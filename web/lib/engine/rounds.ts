import { rng } from "@/lib/engine/rng";
import { toFraction } from "@/lib/engine/scale";
import type { Fighter, FighterId, Metric, MetricId, Round } from "@/lib/engine/types";

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

export function puzzleNumber(date: string, firstPuzzle: string): number {
  return Math.round((utcDay(date) - utcDay(firstPuzzle)) / DAY_MS) + 1;
}

export function ageOn(dob: string, date: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// Active: on the current UFC roster (Wikipedia's list, at the last data build). Infinite and Survival can play only these; the Daily uses everyone.
export function activeFighters(fighters: Fighter[]): Fighter[] {
  return fighters.filter((f) => f.active);
}

export function actualValue(fighter: Fighter, metricId: MetricId, date: string): number {
  return metricId === "age" ? ageOn(fighter.dob!, date) : fighter.metrics[metricId];
}

// With no axis numbers, the blue reference bar is the player's only scale, so it must be tall enough to judge by.
export const MIN_REF_FRACTION = 0.15;

// Picks two different eligible fighters (none of `used`); in a bar round the reference must be visible.
function roundFor(rand: () => number, metric: Metric, fighters: Fighter[], used: Set<FighterId>): Round {
  const pool = eligible(fighters, metric.id).filter((f) => !used.has(f.id));
  const refs = metric.round === "bar" ? pool.filter((f) => toFraction(metric, f.metrics[metric.id]) >= MIN_REF_FRACTION) : pool;
  if (refs.length < 1 || pool.length < 2) throw new Error(`Not enough fighters for metric ${metric.id}`);
  const ref = pick(rand, refs);
  const target = pick(rand, pool.filter((f) => f !== ref));
  return { metric: metric.id, ref: ref.id, target: target.id };
}

export function randomRound(rand: () => number, fighters: Fighter[], metrics: Metric[], avoidMetric?: MetricId): Round {
  const choices = byId(metrics).filter((m) => m.id !== avoidMetric);
  return roundFor(rand, pick(rand, choices), byId(fighters), new Set());
}

const isSilhouette = (id: MetricId) => id === "height" || id === "reach";

// The rounds that follow `kept` up to a full set: metrics and fighters `kept` has not used, and a height
// or reach round unless `kept` has one. With nothing kept this draws exactly what the Daily always has.
function fill(rand: () => number, kept: Round[], fighters: Fighter[], metrics: Metric[]): Round[] {
  const rest = byId(metrics).filter((m) => !kept.some((r) => r.metric === m.id));
  const silhouettes = rest.filter((m) => isSilhouette(m.id));
  const needSilhouette = !kept.some((r) => isSilhouette(r.metric));
  if (kept.length + rest.length < SET_SIZE || (needSilhouette && silhouettes.length === 0)) {
    throw new Error("Not enough metrics for a Daily set");
  }

  const chosen = needSilhouette ? rest.splice(rest.indexOf(pick(rand, silhouettes)), 1) : [];
  while (kept.length + chosen.length < SET_SIZE) chosen.push(...rest.splice(Math.floor(rand() * rest.length), 1));
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }

  const sortedFighters = byId(fighters);
  const used = new Set<FighterId>(kept.flatMap((r) => [r.ref, r.target]));
  return chosen.map((m) => {
    const round = roundFor(rand, m, sortedFighters, used);
    used.add(round.ref).add(round.target);
    return round;
  });
}

// The Daily draws by position in this list, so a fighter joining it would change every future puzzle.
const dailyPool = (fighters: Fighter[]) => fighters.filter((f) => f.daily);

export function dailySet(date: string, fighters: Fighter[], metrics: Metric[]): Round[] {
  return fill(rng(date), [], dailyPool(fighters), metrics);
}

export function isValidRound(round: Round, fighters: Fighter[], metrics: Metric[]): boolean {
  if (!metrics.some((m) => m.id === round.metric) || round.ref === round.target) return false;
  const ok = (id: FighterId) => fighters.some((f) => f.id === id && round.metric in f.metrics);
  return ok(round.ref) && ok(round.target);
}

// New data can break a saved round; the unplayed ones are then drawn again, around what was already played.
export function repairRounds(saved: Round[], played: number, date: string, fighters: Fighter[], metrics: Metric[]): Round[] {
  if (saved.slice(played).every((r) => isValidRound(r, fighters, metrics))) return saved;
  const kept = saved.slice(0, played);
  return [...kept, ...fill(rng(date), kept, dailyPool(fighters), metrics)];
}

// Everything a round's screen needs. Only call it with a valid round.
export type Play = { metric: Metric; refFighter: Fighter; target: Fighter; refValue: number; actual: number };
export function playOf(round: Round, date: string, fighters: Fighter[], metrics: Metric[]): Play {
  const metric = metrics.find((m) => m.id === round.metric)!;
  const refFighter = fighters.find((f) => f.id === round.ref)!;
  const target = fighters.find((f) => f.id === round.target)!;
  return { metric, refFighter, target, refValue: actualValue(refFighter, metric.id, date), actual: actualValue(target, metric.id, date) };
}
