import { describe, expect, it } from "vitest";
import { fighters, metrics } from "@/lib/engine/data";

describe("data", () => {
  it("loads the built files", () => {
    expect(fighters.length).toBeGreaterThanOrEqual(150);
    expect(metrics.length).toBeGreaterThanOrEqual(5);
    expect(metrics.some((m) => m.id === "height" || m.id === "reach")).toBe(true);
  });
  it("only references shipped metrics", () => {
    const ids = new Set(metrics.map((m) => m.id));
    for (const f of fighters) for (const key of Object.keys(f.metrics)) expect(ids.has(key)).toBe(true);
  });
});
