import { describe, expect, it } from "vitest";
import { metricCopy } from "@/lib/copy";
import { metrics } from "@/lib/engine/data";
import type { Metric } from "@/lib/engine/types";

const get = (id: string) => metrics.find((m) => m.id === id)!;

describe("metricCopy", () => {
  it("asks a plain question about the target", () => {
    expect(metricCopy(get("reach"), "Israel Adesanya")).toEqual({
      category: "REACH", question: "How long is Israel Adesanya's reach?", short: "Reach" });
    expect(metricCopy(get("slpm"), "Max Holloway").question).toBe(
      "How many significant strikes does Max Holloway land per minute?");
  });
  it("handles names ending in s", () => {
    expect(metricCopy(get("reach"), "Jon Jones").question).toBe("How long is Jon Jones' reach?");
  });
  it("has copy for every shipped metric", () => {
    for (const m of metrics) expect(metricCopy(m, "X").question).not.toContain(m.label);
  });
  it("falls back to the label for an unknown metric", () => {
    const odd = { ...get("reach"), id: "new_stat", label: "New stat" } as Metric;
    expect(metricCopy(odd, "Jon Jones")).toEqual({
      category: "NEW STAT", question: "New stat: Jon Jones?", short: "New stat" });
  });
});
