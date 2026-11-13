import type { KeyboardEvent, PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { fractionAt, pointAt } from "@/lib/arc";
import { formatValue, fromFraction, nudge, toFraction } from "@/lib/engine/scale";

const SWEEP = 240;
const R_OUT = 46;
const R_NEEDLE = 38;
const TICKS = Array.from({ length: 13 }, (_, i) => i / 12);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

function Needle({ t, className, width, dash, opacity, testId }: { t: number; className: string; width: number; dash?: string; opacity?: number; testId?: string }) {
  const p = pointAt(t, SWEEP);
  return (
    <line
      data-testid={testId}
      x1="50"
      y1="50"
      x2={50 + R_NEEDLE * p.dx}
      y2={50 + R_NEEDLE * p.dy}
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dash}
      opacity={opacity}
      className={className}
    />
  );
}

export function TachStage({ metric, refValue, value, onChange, actual }: StageProps) {
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

  const tip = pointAt(t, SWEEP);
  const a = pointAt(0, SWEEP);
  const b = pointAt(1, SWEEP);

  return (
    <div data-testid="tach-stage" className="flex flex-none justify-center px-2">
      <div
        data-testid="tach-face"
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
          <path
            d={`M${50 + R_OUT * a.dx} ${50 + R_OUT * a.dy}A${R_OUT} ${R_OUT} 0 1 1 ${50 + R_OUT * b.dx} ${50 + R_OUT * b.dy}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-line"
          />
          {TICKS.map((f) => {
            const p = pointAt(f, SWEEP);
            return <line key={f} x1={50 + 40 * p.dx} y1={50 + 40 * p.dy} x2={50 + 46 * p.dx} y2={50 + 46 * p.dy} stroke="currentColor" strokeWidth="1.5" className="text-line" />;
          })}
          <Needle t={clamp(toFraction(metric, refValue))} width={3} opacity={0.4} className="text-blue" />
          {reveal ? (
            <Needle testId="true-value" t={clamp(toFraction(metric, actual))} width={2} dash="3 2" className="text-text" />
          ) : (
            <Needle t={t} width={3} className="text-red" />
          )}
          <circle cx="50" cy="50" r="3" fill="currentColor" className="text-red" />
        </svg>
        {interactive && (
          // 44 px hit area around the needle tip.
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
            style={{ left: `${50 + R_NEEDLE * tip.dx}%`, top: `${50 + R_NEEDLE * tip.dy}%` }}
          >
            <div className="size-5 rounded-full border-2 border-text bg-red" />
          </div>
        )}
      </div>
    </div>
  );
}
