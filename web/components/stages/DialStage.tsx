import type { KeyboardEvent, PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { fractionAt, pointAt } from "@/lib/arc";
import { formatValue, fromFraction, nudge, toFraction } from "@/lib/engine/scale";

const SWEEP = 270;
const R_OUT = 44;
const R_IN = 34;
const clamp = (t: number) => Math.min(1, Math.max(0, t));

// SVG arc from fraction 0 to t at radius r, in a 100x100 box.
function arc(t: number, r: number) {
  const a = pointAt(0, SWEEP);
  const b = pointAt(t, SWEEP);
  return `M${50 + r * a.dx} ${50 + r * a.dy}A${r} ${r} 0 ${t * SWEEP > 180 ? 1 : 0} 1 ${50 + r * b.dx} ${50 + r * b.dy}`;
}

function Arc({ t, r, className, width = 6 }: { t: number; r: number; className: string; width?: number }) {
  if (t < 0.002) return null;
  return <path d={arc(t, r)} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" className={className} />;
}

export function DialStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const t = clamp(toFraction(metric, value));

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange?.(fromFraction(metric, fractionAt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), SWEEP)));
  };
  const key = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };

  const knob = pointAt(t, SWEEP);
  const tick = pointAt(clamp(toFraction(metric, actual ?? 0)), SWEEP);

  return (
    <div data-testid="dial-stage" className="flex flex-none justify-center px-2">
      <div
        data-testid="dial-face"
        className="relative aspect-square w-full max-w-80 touch-none"
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
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
          <Arc t={1} r={R_OUT} width={8} className="text-line" />
          <Arc t={1} r={R_IN} className="text-line" />
          <Arc t={clamp(toFraction(metric, refValue))} r={R_IN} className="text-blue" />
          <Arc t={t} r={R_OUT} width={8} className="text-red" />
          {reveal && (
            <line
              data-testid="true-value"
              x1={50 + 28 * tick.dx}
              y1={50 + 28 * tick.dy}
              x2={50 + 50 * tick.dx}
              y2={50 + 50 * tick.dy}
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="3 2"
              className="text-text"
            />
          )}
        </svg>
        {interactive && (
          // 44 px hit area around the visible knob.
          <div
            role="slider"
            tabIndex={0}
            aria-label="Your estimate"
            aria-valuemin={fromFraction(metric, 0)}
            aria-valuemax={fromFraction(metric, 1)}
            aria-valuenow={value}
            aria-valuetext={formatValue(metric, value)}
            onKeyDown={key}
            className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            style={{ left: `${50 + R_OUT * knob.dx}%`, top: `${50 + R_OUT * knob.dy}%` }}
          >
            <div className="size-5 rounded-full border-2 border-text bg-red" />
          </div>
        )}
      </div>
    </div>
  );
}
