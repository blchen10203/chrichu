import type { KeyboardEvent, PointerEvent } from "react";
import { fractionAt } from "@/lib/arc";
import { formatValue, fromFraction, nudge } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";

export const clamp = (t: number) => Math.min(1, Math.max(0, t));

// Where a pointer sits on a round face, as a fraction of the sweep.
export const arcAt = (sweep: number) => (e: PointerEvent, r: DOMRect) =>
  fractionAt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), sweep);

// Every stage's slider: up/right nudges the estimate up a step, down/left down a step.
export const arrowKeys = (metric: Metric, value: number, onChange?: (v: number) => void) => (e: KeyboardEvent) => {
  const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
  if (!dir || !onChange) return;
  e.preventDefault();
  onChange(nudge(metric, value, dir as 1 | -1));
};

// Pointer and key handling shared by the gauge-like stages. `at` maps a pointer to a 0..1 fraction. Pass no onChange for no handlers.
export function useGaugeInput(metric: Metric, value: number, at: (e: PointerEvent, r: DOMRect) => number, onChange?: (v: number) => void) {
  const drag = (e: PointerEvent<HTMLDivElement>) => onChange?.(fromFraction(metric, at(e, e.currentTarget.getBoundingClientRect())));
  const onKeyDown = arrowKeys(metric, value, onChange);
  const face = onChange
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag(e);
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => e.currentTarget.hasPointerCapture(e.pointerId) && drag(e),
      }
    : {};
  return { face, onKeyDown };
}

// The one focusable slider: a 44 px hit area around the visible knob, at x/y percent of the face.
export function GaugeSlider({ metric, value, x, y, onKeyDown, orientation }: { metric: Metric; value: number; x: number; y: number; onKeyDown: (e: KeyboardEvent) => void; orientation?: "horizontal" }) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Your estimate"
      aria-orientation={orientation}
      aria-valuemin={fromFraction(metric, 0)}
      aria-valuemax={fromFraction(metric, 1)}
      aria-valuenow={value}
      aria-valuetext={formatValue(metric, value)}
      onKeyDown={onKeyDown}
      className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="size-5 rounded-full border-2 border-text bg-red" />
    </div>
  );
}
