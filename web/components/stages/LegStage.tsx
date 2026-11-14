import { useId } from "react";
import type { StageProps } from "@/components/BarStage";
import { GaugeSlider, clamp, useGaugeInput } from "@/components/stages/gauge";
import { toFraction } from "@/lib/engine/scale";

// SVG user units: one standing leg, hip at the top, foot on the floor.
const W = 200;
const H = 290;
const ANKLE = 245; // a grip here is the bottom of the scale
const HIP = 30; // and here the top
const yOf = (t: number) => ANKLE - t * (ANKLE - HIP);

// The leg's two edges, top to bottom: [y, left x, right x].
const PROFILE: [number, number, number][] = [
  [8, 64, 136], [70, 69, 131], [128, 82, 118], [150, 80, 121], [185, 83, 120], [235, 90, 110], [255, 91, 109],
];

// Where the leg's edges are at height y.
function edges(y: number): [number, number] {
  const i = Math.max(0, PROFILE.findIndex(([py]) => py >= y) - 1);
  const [y0, l0, r0] = PROFILE[i];
  const [y1, l1, r1] = PROFILE[Math.min(i + 1, PROFILE.length - 1)];
  const f = y1 === y0 ? 0 : clamp((y - y0) / (y1 - y0));
  return [l0 + (l1 - l0) * f, r0 + (r1 - r0) * f];
}

// A smooth line through points: each corner becomes a curve through the midpoints.
function smooth(points: [number, number][]) {
  const mid = (a: number[], b: number[]) => `${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
  let d = `M${points[0].join(" ")}`;
  for (let i = 1; i < points.length - 1; i++) d += `Q${points[i].join(" ")} ${mid(points[i], points[i + 1])}`;
  return d + `L${points.at(-1)!.join(" ")}`;
}

// Down the left edge, round the heel and toes, up the right edge; open at the hip.
const LEG = smooth([
  ...PROFILE.map(([y, l]) => [l, y] as [number, number]),
  [86, 268], [87, 280], [150, 280], [152, 272], [116, 262],
  ...PROFILE.slice().reverse().map(([y, , r]) => [r, y] as [number, number]),
]);

// An arm reaching in from one side, its hand clasped round the leg at height y.
function Grip({ t, side, className, dashed, testId }: { t: number; side: "left" | "right"; className: string; dashed?: boolean; testId?: string }) {
  const y = yOf(t);
  const [l, r] = edges(y);
  const left = side === "left";
  const start = left ? 0 : W;
  const wrist = left ? l - 4 : r + 4;
  const arm = `M${start} ${y - 8}C${(start + wrist) / 2} ${y - 7} ${wrist} ${y - 6} ${wrist} ${y - 5.5}L${wrist} ${y + 5.5}C${wrist} ${y + 6} ${(start + wrist) / 2} ${y + 8} ${start} ${y + 9}`;
  const stroke = { fill: "var(--color-bg)", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" as const, strokeDasharray: dashed ? "4 3" : undefined };
  return (
    <g data-testid={testId} className={className}>
      <path d={arm} {...stroke} fill={dashed ? "none" : stroke.fill} />
      <rect x={l - 6} y={y - 7} width={r - l + 12} height="14" rx="7" {...stroke} fill={dashed ? "none" : stroke.fill} />
    </g>
  );
}

export function LegStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const t = clamp(toFraction(metric, value));
  const fade = `legfade${useId().replace(/[^\w-]/g, "")}`;
  // Pointer height on the face, as a share of the way from ankle to hip.
  const at = (e: { clientY: number }, r: DOMRect) => clamp((ANKLE - ((e.clientY - r.top) / r.height) * H) / (ANKLE - HIP));
  const { face, onKeyDown } = useGaugeInput(metric, value, at, interactive ? onChange : undefined);

  return (
    <div data-testid="leg-stage" className="flex flex-1 items-center justify-center py-2">
      <div data-testid="leg-face" className="relative h-72 touch-none" style={{ aspectRatio: `${W} / ${H}` }} {...face}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" role="img" aria-label="Grips on a leg: higher up means more takedowns">
          <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="40">
            <stop offset="0" stopColor="var(--color-text)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--color-text)" />
          </linearGradient>
          <path d={LEG} fill="none" stroke={`url(#${fade})`} strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="0" x2={W} y1="280" y2="280" stroke="var(--color-tick)" />
          <Grip t={clamp(toFraction(metric, refValue))} side="right" className="text-blue" />
          <Grip testId="guess-grip" t={t} side="left" className="text-red" />
          {reveal && <Grip testId="true-value" t={clamp(toFraction(metric, actual))} side="left" className="text-text" dashed />}
        </svg>
        {interactive && <GaugeSlider metric={metric} value={value} x={50} y={(yOf(t) / H) * 100} onKeyDown={onKeyDown} />}
      </div>
    </div>
  );
}
