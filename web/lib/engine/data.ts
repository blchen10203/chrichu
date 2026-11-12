import fightersJson from "@/data/fighters.json";
import metricsJson from "@/data/metrics.json";
import type { Fighter, Metric } from "@/lib/engine/types";

// JSON widens Metric.round and Metric.scale to string, so the literal types need a cast.
export const fighters = fightersJson as Fighter[];
export const metrics = metricsJson as Metric[];
