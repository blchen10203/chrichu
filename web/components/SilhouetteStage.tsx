import { useId, useRef, type PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { arrowKeys } from "@/components/stages/gauge";
import outlinesJson from "@/data/outlines.json";
import { fighters } from "@/lib/engine/data";
import { fromFraction, snapValue } from "@/lib/engine/scale";
import { useFormat } from "@/lib/units";

// SVG user units. A figure is FIG tall: head at y 0, floor at y FIG, centred on x 0.
const W = 320;
const H = 300;
const FIG = 120;
const BLUE_TOP = 8;
const RED_TOP = 170;
const GROUND = 280;

// d: the outline; cut: where its photo stops (FIG when whole); sy: the arms' centre line; sl, sr: the shoulder edges.
type Outline = { d: string; cut: number; sy: number; sl: number; sr: number };

// Traced from photos by pipeline/images.py.
const outlines: Record<string, Outline> = outlinesJson;

// Fighters with no usable photo: a plain standing figure, drawn the same way. Right half, mirrored.
const half: [number, number][] = [
  [2.8, 15.5], [3, 19], [11, 21], [14.5, 23.5], [16, 30], [16.5, 45], [16, 60], [15, 64], [13.5, 61], [13, 45], [12, 32],
  [10.5, 40], [11.5, 58], [10, 90], [8.5, 116], [9.5, 120], [2.5, 120], [2, 90], [1, 64],
];
const GENERIC: Outline = {
  d:
    "M-5.5 7.5a5.5 7.5 0 1 0 11 0a5.5 7.5 0 1 0 -11 0Z" +
    `M${[...half, [0, 63], ...half.map(([x, y]) => [-x, y]).reverse()].map((p) => p.join(" ")).join("L")}`, // open at the neck: no line under the chin
  cut: FIG,
  sy: 23,
  sl: -14.5,
  sr: 14.5,
};
const outlineOf = (id?: string) => (id && outlines[id]) || GENERIC;
const heightOf = (id?: string) => fighters.find((f) => f.id === id)?.metrics.height ?? 70;

// One fighter's outline, fading out between `fade` (y from, y to) when given or where the photo stops.
function Body({ o, color, filled, fade }: { o: Outline; color: string; filled?: boolean; fade?: [number, number] }) {
  const id = `fade${useId().replace(/[^\w-]/g, "")}`;
  const [y1, y2] = fade ?? (o.cut < FIG ? [o.cut - 18, o.cut] : [0, 0]);
  return (
    <>
      {y2 > 0 && (
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      )}
      <path
        d={o.d}
        fill={filled ? "var(--color-bg)" : "none"}
        stroke={y2 > 0 ? `url(#${id})` : color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

// Real proportions, in inches: upper arm and wrist thickness, hand length and width.
const ARM = { shoulder: 4.6, wrist: 2.4, hand: 7.5, palm: 3.4 };

// One arm in stage units, from the shoulder edge at (x, y) out to the fingertips at tipX. Open at the shoulder, so it joins the body without a seam.
function armPath(x: number, y: number, tipX: number, ppi: number) {
  const dir = Math.sign(tipX - x) || 1;
  const t0 = ARM.shoulder * ppi, t1 = ARM.wrist * ppi, hw = ARM.palm * ppi;
  const hand = Math.min(ARM.hand * ppi, 0.4 * Math.abs(tipX - x));
  const wx = tipX - dir * hand;
  const at = (f: number) => x + (wx - x) * f;
  const n = (v: number) => Math.round(v * 10) / 10;
  return (
    `M${n(x - dir * 2)} ${n(y - t0 / 2)}` +
    `C${n(at(0.35))} ${n(y - t0 / 2)} ${n(at(0.7))} ${n(y - t1 / 2)} ${n(wx)} ${n(y - t1 / 2)}` +
    `Q${n(tipX)} ${n(y - hw / 2)} ${n(tipX)} ${n(y)}` +
    `Q${n(tipX)} ${n(y + hw / 2)} ${n(wx)} ${n(y + t1 / 2)}` +
    `C${n(at(0.7))} ${n(y + t1 / 2)} ${n(at(0.3))} ${n(y + t0 / 2)} ${n(x - dir * t0 * 0.3)} ${n(y + t0 * 0.6)}`
  );
}

// A reach row: the fighter's bust at true size for their height, arms out to `span` inches fingertip to fingertip.
function Reacher({ id, top, span, ppi, color, dashed }: { id?: string; top: number; span: number; ppi: number; color: string; dashed?: boolean }) {
  const o = outlineOf(id);
  const k = (heightOf(id) * ppi) / FIG; // figure units to stage units
  const y = top + o.sy * k;
  const arm = (edge: number, dir: number) => (
    <path
      d={armPath(W / 2 + edge * k, y, W / 2 + (dir * span * ppi) / 2, ppi)}
      fill={dashed ? "none" : "var(--color-bg)"}
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "4 3" : undefined}
    />
  );
  return (
    <g data-testid={dashed ? "true-value" : undefined}>
      {!dashed && (
        <g transform={`translate(${W / 2} ${top}) scale(${k})`}>
          <Body o={o} color={color} filled fade={[o.sy - 2, Math.min(o.cut, o.sy + 7)]} />
        </g>
      )}
      {arm(o.sl, -1)}
      {arm(o.sr, 1)}
    </g>
  );
}

// Where a reach row's fingertips sit, for the drag handles.
const handY = (id: string | undefined, top: number, ppi: number) => top + (outlineOf(id).sy * heightOf(id) * ppi) / FIG;

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

export function SilhouetteStage({ metric, refValue, value, onChange, actual, refId, targetId }: StageProps) {
  const reach = metric.id === "reach";
  const formatValue = useFormat();
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
  const key = arrowKeys(metric, value, onChange);

  const handles = reach
    ? [
        { label: "Your estimate, left hand", x: cx - (value * ppi) / 2, y: handY(targetId, RED_TOP, ppi) },
        { label: "Your estimate, right hand", x: cx + (value * ppi) / 2, y: handY(targetId, RED_TOP, ppi) },
      ]
    : [{ label: "Your estimate", x: (W * 3) / 4 + (20 * value * ppi) / FIG, y: GROUND - value * ppi }];
  const figure = (v: number, x: number, color: string, id?: string) => (
    <g transform={`translate(${x} ${GROUND}) scale(${(v * ppi) / FIG}) translate(0 ${-FIG})`}>
      <Body o={outlineOf(id)} color={color} />
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
              <Reacher id={refId} top={BLUE_TOP} span={refValue} ppi={ppi} color="var(--color-blue)" />
              <Ticks x={cx % (4 * ppi)} y={150} n={Math.ceil(W / (4 * ppi)) + 1} step={4 * ppi} />
              {reveal && <text x={cx} y={140} textAnchor="middle" fontSize="11" fill="var(--color-muted)">each tick = 4 in</text>}
              <Reacher id={targetId} top={RED_TOP} span={value} ppi={ppi} color="var(--color-red)" />
              {reveal && <Reacher id={targetId} top={RED_TOP} span={actual} ppi={ppi} color="var(--color-truth)" dashed />}
            </>
          ) : (
            <>
              <line x1="0" x2={W} y1={GROUND} y2={GROUND} stroke="var(--color-tick)" />
              <Ticks x={cx} y={GROUND} n={Math.floor(metric.max / 4) + 1} step={4 * ppi} vertical />
              {figure(refValue, W / 4, "var(--color-blue)", refId)}
              {figure(value, (W * 3) / 4, "var(--color-red)", targetId)}
              {reveal && (
                <g data-testid="true-value" strokeDasharray="4 3">
                  {figure(actual, (W * 3) / 4, "var(--color-truth)", targetId)}
                </g>
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
