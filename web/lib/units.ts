import { useSyncExternalStore } from "react";
import { formatValue } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";
import { browserStorage } from "@/lib/storage";

// Feet-and-inches or plain inches for height and reach: a per-browser preference, kept apart
// from the game state so a missing or odd value can never reset anyone's streak.
const KEY = "reachdle:units";
const listeners = new Set<() => void>();
let feet: boolean | null = null;

const read = () => {
  try {
    return browserStorage()?.getItem(KEY) !== "in";
  } catch {
    return true;
  }
};

export function setFeet(next: boolean) {
  feet = next;
  try {
    browserStorage()?.setItem(KEY, next ? "ft" : "in");
  } catch {} // blocked storage: the choice lasts until reload
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useFeet = () => useSyncExternalStore(subscribe, () => (feet ??= read()), () => true);

// formatValue with the reader's chosen units.
export function useFormat() {
  const f = useFeet();
  return (metric: Metric, value: number) => formatValue(metric, value, f);
}
