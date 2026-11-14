import type { Metric } from "@/lib/engine/types";

const clean = (x: number) => Number(x.toFixed(6));
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sig2 = (x: number) => Number(x.toPrecision(2));
// Size of one unit in the 2nd significant figure of x.
const unit2 = (x: number) => 10 ** (Math.floor(Math.log10(x)) - 1);

function bounds(metric: Metric): [number, number] {
  if (metric.scale === "linear") {
    const s = metric.snap ?? 1;
    return [clean(Math.ceil(metric.min / s) * s), clean(Math.floor(metric.max / s) * s)];
  }
  return [
    sig2(Math.ceil(metric.min / unit2(metric.min) - 1e-9) * unit2(metric.min)),
    sig2(Math.floor(metric.max / unit2(metric.max) + 1e-9) * unit2(metric.max)),
  ];
}

export function snapValue(metric: Metric, raw: number): number {
  const [lo, hi] = bounds(metric);
  if (metric.scale === "log") return clamp(sig2(raw), lo, hi);
  const s = metric.snap ?? 1;
  return clamp(clean(Math.round(raw / s) * s), lo, hi);
}

export function nudge(metric: Metric, value: number, direction: 1 | -1): number {
  if (metric.scale === "linear") return snapValue(metric, value + direction * (metric.snap ?? 1));
  const [lo, hi] = bounds(metric);
  let step = unit2(value);
  // Stepping down from a power of ten drops to the next lower place (1000 -> 990).
  if (direction === -1 && Math.abs(Math.log10(value) % 1) < 1e-9) step /= 10;
  return clamp(sig2(value + direction * step), lo, hi);
}

const axis = (metric: Metric, x: number) => (metric.scale === "log" ? Math.log(x) : x);

export function toFraction(metric: Metric, value: number): number {
  const lo = axis(metric, metric.min);
  return (axis(metric, value) - lo) / (axis(metric, metric.max) - lo);
}

export function fromFraction(metric: Metric, t: number): number {
  const lo = axis(metric, metric.min);
  const x = lo + clamp(t, 0, 1) * (axis(metric, metric.max) - lo);
  return snapValue(metric, metric.scale === "log" ? Math.exp(x) : x);
}

// `feet` writes inch metrics as 6' 2" (under a foot, just 3"); half inches keep their decimal.
export function formatValue(metric: Metric, value: number, feet = false): string {
  if (metric.scale === "log") return Math.round(value).toLocaleString("en-US");
  const decimals = String(metric.snap ?? 1).split(".")[1]?.length ?? 0;
  if (feet && metric.unit === "in") {
    const total = Number(value.toFixed(decimals));
    const ft = Math.floor(total / 12);
    const inches = `${Number((total - ft * 12).toFixed(decimals))}"`;
    return ft ? `${ft}' ${inches}` : inches;
  }
  const suffix = metric.unit === "in" ? " in" : metric.unit === "%" ? "%" : "";
  return value.toFixed(decimals) + suffix;
}
