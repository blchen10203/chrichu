import { formatValue } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";
import { boolPref } from "@/lib/prefs";

// Feet-and-inches or plain inches for height and reach, remembered in this browser.
const feet = boolPref("reachdle:units", "ft", "in", true);
export const setFeet = feet.set;
export const useFeet = feet.useValue;

// formatValue with the reader's chosen units.
export function useFormat() {
  const f = useFeet();
  return (metric: Metric, value: number) => formatValue(metric, value, f);
}
