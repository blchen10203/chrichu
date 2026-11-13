import type { KeyboardEvent, PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { clamp } from "@/components/stages/gauge";
import { formatValue, fromFraction, nudge, toFraction } from "@/lib/engine/scale";

// A pin is a line across the strip; the red one gets a 44 px slider hit area while guessing.
function Pin({ t, className, dash, opacity, testId }: { t: number; className: string; dash?: string; opacity?: number; testId?: string }) {
  return (
    <svg
      data-testid={testId}
      viewBox="0 0 4 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 h-20 w-1 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ left: `${t * 100}%`, opacity }}
    >
      <line x1="2" y1="0" x2="2" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeDasharray={dash} />
    </svg>
  );
}

export function TimelineStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const t = clamp(toFraction(metric, value));

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange?.(fromFraction(metric, clamp((e.clientX - r.left) / r.width)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };
  const handlers = interactive
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag(e);
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(e),
      }
    : {};

  return (
    <div data-testid="timeline-stage" className="flex-none px-6 py-4">
      <div data-testid="timeline-strip" className="relative h-24 touch-none" {...handlers}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <Pin t={clamp(toFraction(metric, refValue))} className="text-blue" opacity={0.4} />
        <Pin testId="guess-pin" t={t} className="text-red" />
        {reveal && <Pin testId="true-value" t={clamp(toFraction(metric, actual))} className="text-text" dash="4 3" />}
        {interactive && (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Your estimate"
            aria-orientation="horizontal"
            aria-valuemin={fromFraction(metric, 0)}
            aria-valuemax={fromFraction(metric, 1)}
            aria-valuenow={value}
            aria-valuetext={formatValue(metric, value)}
            onKeyDown={onKeyDown}
            className="absolute top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            style={{ left: `${t * 100}%` }}
          >
            <div className="size-5 rounded-full border-2 border-text bg-red" />
          </div>
        )}
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>younger</span>
        <span>older</span>
      </div>
    </div>
  );
}
