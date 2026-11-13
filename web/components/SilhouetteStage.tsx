import type { KeyboardEvent, PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { formatValue, fromFraction, nudge, snapValue } from "@/lib/engine/scale";

// SVG user units. The figure is 120 tall: head at the top, arm bar at y 32..44.
const W = 320;
const H = 300;
const FIG = 120;
const BLUE_TOP = 8;
const RED_TOP = 170;
const GROUND = 280;
const OUTLINE = { fill: "none", stroke: "#F2F3F5", strokeWidth: 2, strokeDasharray: "6 4" } as const;

function Figure({ fill }: { fill: string }) {
  return (
    <>
      <circle cx="0" cy="14" r="12" fill={fill} />
      <rect x="-20" y="30" width="40" height="50" rx="8" fill={fill} />
      <rect x="-19" y="76" width="16" height="44" rx="6" fill={fill} />
      <rect x="3" y="76" width="16" height="44" rx="6" fill={fill} />
    </>
  );
}

function Ticks({ x, y, n, step, vertical }: { x: number; y: number; n: number; step: number; vertical?: boolean }) {
  return Array.from({ length: n }, (_, i) => (
    <line
      key={i}
      stroke="#4A5060"
      {...(vertical
        ? { x1: x - 4, x2: x + 4, y1: y - i * step, y2: y - i * step }
        : { x1: x + i * step, x2: x + i * step, y1: y - 4, y2: y + 4 })}
    />
  ));
}

export function SilhouetteStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reach = metric.id === "reach";
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const cx = W / 2;
  const ppi = reach ? W / metric.max : (GROUND - 20) / metric.max;

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    onChange?.(snapValue(metric, reach ? (2 * Math.abs(x - cx)) / ppi : (GROUND - y) / ppi));
  };
  const key = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };

  const handles = reach
    ? [
        { label: "Your estimate, left hand", x: cx - (value * ppi) / 2, y: RED_TOP + 38 },
        { label: "Your estimate, right hand", x: cx + (value * ppi) / 2, y: RED_TOP + 38 },
      ]
    : [{ label: "Your estimate", x: (W * 3) / 4, y: GROUND - value * ppi }];
  const armBar = (v: number, top: number, fill: string, props = {}) => (
    <rect x={cx - (v * ppi) / 2} y={top + 32} width={v * ppi} height="12" rx="6" fill={fill} {...props} />
  );
  const figure = (v: number, x: number, fill: string) => (
    <g transform={`translate(${x} ${GROUND}) scale(${(v * ppi) / FIG}) translate(0 ${-FIG})`}>
      <Figure fill={fill} />
    </g>
  );

  return (
    <div data-testid="silhouette-stage" className="flex flex-1 items-center justify-center">
      <div
        className="relative w-full touch-none"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: "100%" }}
        onPointerDown={
          interactive
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag(e);
              }
            : undefined
        }
        onPointerMove={interactive ? (e) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(e) : undefined}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" role="img" aria-label={reach ? "Arm spans of both fighters" : "Heights of both fighters"}>
          {reach ? (
            <>
              <g transform={`translate(${cx} ${BLUE_TOP})`}>
                <Figure fill="#5B9BFF" />
              </g>
              {armBar(refValue, BLUE_TOP, "#5B9BFF")}
              <Ticks x={cx % (4 * ppi)} y={150} n={Math.ceil(W / (4 * ppi)) + 1} step={4 * ppi} />
              {reveal && <text x={cx} y={168} textAnchor="middle" fontSize="11" fill="#A0A6B2">each tick = 4 in</text>}
              <g transform={`translate(${cx} ${RED_TOP})`}>
                <Figure fill="#FF5A5F" />
              </g>
              {armBar(value, RED_TOP, "#FF5A5F")}
              {reveal && armBar(actual, RED_TOP, "none", { ...OUTLINE, rx: 6 })}
            </>
          ) : (
            <>
              <line x1="0" x2={W} y1={GROUND} y2={GROUND} stroke="#4A5060" />
              <Ticks x={cx} y={GROUND} n={Math.floor(metric.max / 4) + 1} step={4 * ppi} vertical />
              {figure(refValue, W / 4, "#5B9BFF")}
              {figure(value, (W * 3) / 4, "#FF5A5F")}
              {reveal && (
                <rect x={(W * 3) / 4 - 30} y={GROUND - actual * ppi} width="60" height={actual * ppi} {...OUTLINE} />
              )}
            </>
          )}
        </svg>
        {interactive &&
          handles.map((h) => (
            <div
              key={h.label}
              role="slider"
              tabIndex={0}
              aria-label={h.label}
              aria-orientation={reach ? "horizontal" : "vertical"}
              aria-valuemin={fromFraction(metric, 0)}
              aria-valuemax={fromFraction(metric, 1)}
              aria-valuenow={value}
              aria-valuetext={formatValue(metric, value)}
              onKeyDown={key}
              // 44 px hit area around a smaller visible dot.
              className="group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: `${(h.x / W) * 100}%`, top: `${(h.y / H) * 100}%` }}
            >
              <div className="size-6 rounded-full border-2 border-text bg-bg group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-text" />
            </div>
          ))}
      </div>
    </div>
  );
}
