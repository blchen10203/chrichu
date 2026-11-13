import type { KeyboardEvent, PointerEvent } from "react";
import { fractionAt } from "@/lib/arc";
import { formatValue, fromFraction, nudge } from "@/lib/engine/scale";
import type { Metric } from "@/lib/engine/types";

export const clamp = (t: number) => Math.min(1, Math.max(0, t));

// Pointer and key handling shared by the dial and the tachometer. Pass no onChange for no handlers.
export function useGaugeInput(metric: Metric, value: number, sweep: number, onChange?: (v: number) => void) {
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange?.(fromFraction(metric, fractionAt(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), sweep)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };
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
export function GaugeSlider({ metric, value, x, y, onKeyDown }: { metric: Metric; value: number; x: number; y: number; onKeyDown: (e: KeyboardEvent) => void }) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Your estimate"
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
