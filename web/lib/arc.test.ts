import { describe, expect, it } from "vitest";
import { fractionAt, pointAt } from "@/lib/arc";

describe("arc", () => {
  it("puts the top of the gauge at the middle", () => {
    expect(fractionAt(0, -1, 270)).toBeCloseTo(0.5);
    expect(fractionAt(-1, 0, 270)).toBeCloseTo(1 / 6);
    expect(fractionAt(1, 0, 270)).toBeCloseTo(5 / 6);
    expect(fractionAt(0, -1, 240)).toBeCloseTo(0.5);
  });
  it("sends a point in the bottom gap to the nearer end, never wrapping", () => {
    expect(fractionAt(-0.1, 1, 270)).toBe(0);
    expect(fractionAt(0.1, 1, 270)).toBe(1);
  });
  it("round-trips a fraction through a point", () => {
    for (const t of [0, 0.25, 0.5, 0.9, 1]) {
      const p = pointAt(t, 270);
      expect(fractionAt(p.dx, p.dy, 270)).toBeCloseTo(t);
    }
    expect(pointAt(0.5, 270).dx).toBeCloseTo(0);
    expect(pointAt(0.5, 270).dy).toBeCloseTo(-1);
  });
});
