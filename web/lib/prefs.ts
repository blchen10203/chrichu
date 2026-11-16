import { useSyncExternalStore } from "react";
import { browserStorage } from "@/lib/storage";

// A per-browser on/off setting, kept apart from the game state so a missing or odd value can never
// reset anyone's streak. `on` and `off` are what is stored; anything else reads as `fallback`.
export function boolPref(key: string, on: string, off: string, fallback: boolean) {
  const listeners = new Set<() => void>();
  let value: boolean | null = null;
  const read = () => {
    try {
      const v = browserStorage()?.getItem(key);
      return v === on ? true : v === off ? false : fallback;
    } catch {
      return fallback;
    }
  };
  const get = () => (value ??= read());
  const set = (next: boolean) => {
    value = next;
    try {
      browserStorage()?.setItem(key, next ? on : off);
    } catch {} // blocked storage: the choice lasts until reload
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const useValue = () => useSyncExternalStore(subscribe, get, () => fallback);
  return { get, set, useValue };
}

// Infinite and Survival with active fighters only (see activeFighters). Never the Daily.
export const activeOnly = boolPref("reachdle:active", "1", "0", false);
