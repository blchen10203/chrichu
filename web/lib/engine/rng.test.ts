import { describe, expect, it } from "vitest";
import { rng } from "@/lib/engine/rng";

describe("rng", () => {
  it("gives the same numbers for the same seed in every browser", () => {
    const r = rng("2026-12-01");
    expect([r(), r(), r()]).toEqual([0.3137097910512239, 0.6874263635836542, 0.24878930835984647]);
  });
  it("gives different numbers for a different seed", () => {
    expect(rng("2026-12-02")()).toBe(0.7272352848667651);
  });
});
