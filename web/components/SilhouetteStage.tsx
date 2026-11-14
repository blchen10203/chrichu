import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { formatValue, fromFraction, nudge, snapValue } from "@/lib/engine/scale";

// SVG user units. The figure is 120 tall: head at the top, arm bar at y 32..44.
const W = 320;
const H = 300;
const FIG = 120;
const BLUE_TOP = 8;
const RED_TOP = 170;
const GROUND = 280;
const OUTLINE = { fill: "none", stroke: "var(--color-text)", strokeWidth: 2, strokeDasharray: "6 4" } as const;

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
      stroke="var(--color-tick)"
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

  // Height only: active pointers, and the pinch's starting distance and value.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; v0: number } | null>(null);
  const pinched = useRef(false);
  const before = useRef(value); // the value before the first finger landed
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const lift = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    if (!pointers.current.size) pinched.current = false;
  };

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
    : [{ label: "Your estimate", x: (W * 3) / 4 + (20 * value * ppi) / FIG, y: GROUND - value * ppi }];
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
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {} // untracked (synthetic) pointers throw; the gesture still works
                if (reach) return drag(e);
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.current.size === 2) {
                  onChange?.(before.current); // undo the first finger's snap
                  pinch.current = { d0: spread() || 1, v0: before.current };
                  pinched.current = true;
                } else if (pointers.current.size === 1) {
                  before.current = value;
                  drag(e);
                }
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                if (reach) return drag(e);
                if (!pointers.current.has(e.pointerId)) return;
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pinch.current) onChange?.(snapValue(metric, (pinch.current.v0 * spread()) / pinch.current.d0));
                else if (!pinched.current) drag(e);
              }
            : undefined
        }
        onPointerUp={interactive && !reach ? lift : undefined}
        onPointerCancel={interactive && !reach ? lift : undefined}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" role="img" aria-label={reach ? "Arm spans of both fighters" : "Heights of both fighters"}>
          {reach ? (
            <>
              <g transform={`translate(${cx} ${BLUE_TOP})`}>
                <Figure fill="var(--color-blue)" />
              </g>
              {armBar(refValue, BLUE_TOP, "var(--color-blue)")}
              <Ticks x={cx % (4 * ppi)} y={150} n={Math.ceil(W / (4 * ppi)) + 1} step={4 * ppi} />
              {reveal && <text x={cx} y={168} textAnchor="middle" fontSize="11" fill="var(--color-muted)">each tick = 4 in</text>}
              <g transform={`translate(${cx} ${RED_TOP})`}>
                <Figure fill="var(--color-red)" />
              </g>
              {armBar(value, RED_TOP, "var(--color-red)")}
              {reveal && armBar(actual, RED_TOP, "none", { ...OUTLINE, rx: 6, "data-testid": "true-value" })}
            </>
          ) : (
            <>
              <line x1="0" x2={W} y1={GROUND} y2={GROUND} stroke="var(--color-tick)" />
              <Ticks x={cx} y={GROUND} n={Math.floor(metric.max / 4) + 1} step={4 * ppi} vertical />
              {figure(refValue, W / 4, "var(--color-blue)")}
              {figure(value, (W * 3) / 4, "var(--color-red)")}
              {reveal && (
                <rect x={(W * 3) / 4 - 30} y={GROUND - actual * ppi} width="60" height={actual * ppi} data-testid="true-value" {...OUTLINE} />
              )}
            </>
          )}
        </svg>
        {interactive &&
          handles.map((h) => (
            <div
              key={h.label}
              role="slider"
              data-testid={reach ? undefined : "height-handle"}
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
