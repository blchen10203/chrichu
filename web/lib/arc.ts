// Gauge geometry shared by the dial and the tachometer. The arc is symmetric about the vertical:
// it starts bottom-left, runs clockwise over the top and ends bottom-right, gap centred at the bottom.
const DEG = Math.PI / 180;
const startOf = (sweepDeg: number) => 180 + (360 - sweepDeg) / 2;

/** Fraction 0..1 along the arc for a pointer offset (screen coords, y down). Points in the gap go to the nearer end. */
export function fractionAt(dx: number, dy: number, sweepDeg: number): number {
  const c = (Math.atan2(dx, -dy) / DEG + 360) % 360;
  const d = (((c - startOf(sweepDeg)) % 360) + 360) % 360;
  if (d <= sweepDeg) return d / sweepDeg;
  return d - sweepDeg < 360 - d ? 1 : 0;
}

/** Unit vector at fraction t along the arc. */
export function pointAt(t: number, sweepDeg: number): { dx: number; dy: number } {
  const c = (startOf(sweepDeg) + t * sweepDeg) * DEG;
  return { dx: Math.sin(c), dy: -Math.cos(c) };
}
