import type { KeyboardEvent, PointerEvent } from "react";
import { formatValue, fromFraction, nudge, toFraction } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";

export type StageProps = {
  metric: Metric;
  refValue: number;
  value: number;
  onChange?: (value: number) => void;
  actual?: number;
  refId?: string; // fighter ids, for stages that draw the fighters themselves
  targetId?: string;
};

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];
// The label is 40px tall (mt-2 + text-2xl) in a plot at least 240px tall: below ~17% it would spill under the baseline.
const SHORT_BAR = 0.18;
const pct = (metric: Metric, v: number) => `${Math.min(1, Math.max(0, toFraction(metric, v))) * 100}%`;

export function BarStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange?.(fromFraction(metric, 1 - (e.clientY - r.top) / r.height));
  };
  const key = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };

  return (
    <div className="flex min-h-64 flex-1 gap-2">
      {/* Axis numbers would let the player read the answer off; they appear only on the reveal. */}
      <div data-testid={reveal ? "axis-labels" : undefined} className="relative my-2 w-12 shrink-0 text-[11px] text-muted">
        {reveal &&
          TICKS.map((t) => (
            <div key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${t * 100}%` }}>
              {formatValue(metric, fromFraction(metric, t))}
            </div>
          ))}
      </div>
      <div
        className="relative my-2 flex-1 touch-none border-b border-tick"
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
        {TICKS.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${t * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end justify-around">
          <div className="relative flex w-24 justify-center rounded-t-lg bg-blue" style={{ height: pct(metric, refValue) }}>
            <span
              className={
                toFraction(metric, refValue) < SHORT_BAR
                  ? "absolute bottom-full left-1/2 mb-1 -translate-x-1/2 font-display text-2xl font-bold text-blue"
                  : "mt-2 font-display text-2xl font-bold text-bg"
              }
            >
              {formatValue(metric, refValue)}
            </span>
          </div>
          <div className="relative h-full w-24">
            <div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-red" style={{ height: pct(metric, value) }}>
              {!reveal && (
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Your estimate"
                  aria-orientation="vertical"
                  aria-valuemin={fromFraction(metric, 0)}
                  aria-valuemax={fromFraction(metric, 1)}
                  aria-valuenow={value}
                  aria-valuetext={formatValue(metric, value)}
                  onKeyDown={key}
                  className="absolute left-1/2 top-0 flex h-8 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-text bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 6 L8 2.5 L12 6 M4 10 L8 13.5 L12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
            {reveal && (
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-lg border-2 border-dashed border-text"
                style={{ height: pct(metric, actual) }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
