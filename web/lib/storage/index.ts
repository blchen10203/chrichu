import type { Round } from "@/lib/engine/types";

export type DayState = { rounds: Round[]; guesses: number[]; scores: number[]; done: boolean };
export type State = {
  daily: { days: Record<string, DayState>; streak: number; maxStreak: number; lastDone: string | null };
  survival: { best: number; runs: number };
  infinite: { rounds: number; totalScore: number };
};

export const STORAGE_KEY = "reachdle:v1";
const ROUNDS_PER_DAY = 5;

export const emptyState = (): State => ({
  daily: { days: {}, streak: 0, maxStreak: 0, lastDone: null },
  survival: { best: 0, runs: 0 },
  infinite: { rounds: 0, totalScore: 0 },
});

// The only function allowed to touch `window`.
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNums = (v: unknown): boolean => Array.isArray(v) && v.every(isNum);
const isRound = (v: unknown): boolean =>
  isObject(v) && [v.metric, v.ref, v.target].every((x) => typeof x === "string");
const isDay = (v: unknown): boolean =>
  isObject(v) && Array.isArray(v.rounds) && v.rounds.every(isRound) &&
  isNums(v.guesses) && isNums(v.scores) && typeof v.done === "boolean";

// All-or-nothing: any mismatch anywhere means a fresh state, so later code can trust the shape.
function isState(v: unknown): v is State {
  if (!isObject(v) || !isObject(v.daily) || !isObject(v.survival) || !isObject(v.infinite)) return false;
  const { days, streak, maxStreak, lastDone } = v.daily;
  return (
    isObject(days) && Object.values(days).every(isDay) &&
    isNum(streak) && isNum(maxStreak) && (lastDone === null || typeof lastDone === "string") &&
    isNum(v.survival.best) && isNum(v.survival.runs) &&
    isNum(v.infinite.rounds) && isNum(v.infinite.totalScore)
  );
}

export function load(storage: Pick<Storage, "getItem"> | null): State {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    return isState(data) ? data : emptyState();
  } catch {
    return emptyState();
  }
}

export function save(state: State, storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Blocked or full storage must never break the game.
  }
}

export function startDay(state: State, date: string, rounds: Round[]): State {
  if (state.daily.days[date]) return state;
  const day: DayState = { rounds, guesses: [], scores: [], done: false };
  return { ...state, daily: { ...state.daily, days: { ...state.daily.days, [date]: day } } };
}

const dayBefore = (date: string): string =>
  new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);

export function recordGuess(state: State, date: string, guess: number, score: number): State {
  if (!Number.isFinite(guess) || !Number.isFinite(score)) return state;
  const day = state.daily.days[date];
  if (!day || day.done) return state;
  const guesses = [...day.guesses, guess];
  const scores = [...day.scores, score];
  const done = scores.length >= ROUNDS_PER_DAY;
  const days = { ...state.daily.days, [date]: { ...day, guesses, scores, done } };
  if (!done) return { ...state, daily: { ...state.daily, days } };
  const streak = state.daily.lastDone === dayBefore(date) ? state.daily.streak + 1 : 1;
  return {
    ...state,
    daily: { days, streak, maxStreak: Math.max(state.daily.maxStreak, streak), lastDone: date },
  };
}

export function recordInfinite(state: State, score: number): State {
  if (!Number.isFinite(score)) return state;
  const { rounds, totalScore } = state.infinite;
  return { ...state, infinite: { rounds: rounds + 1, totalScore: totalScore + score } };
}

export function currentStreak(state: State, today: string): number {
  const { lastDone, streak } = state.daily;
  return lastDone === today || lastDone === dayBefore(today) ? streak : 0;
}

export function dailyStats(state: State): { played: number; average: number; best: number } {
  const totals = Object.values(state.daily.days)
    .filter((d) => d.done)
    .map((d) => d.scores.reduce((a, b) => a + b, 0));
  if (!totals.length) return { played: 0, average: 0, best: 0 };
  return {
    played: totals.length,
    average: Math.round(totals.reduce((a, b) => a + b, 0) / totals.length),
    best: Math.max(...totals),
  };
}
