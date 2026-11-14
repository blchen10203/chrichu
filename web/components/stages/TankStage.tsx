import { useEffect, useRef, type PointerEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { GaugeSlider, clamp, useGaugeInput } from "@/components/stages/gauge";
import { fromFraction, toFraction } from "@/lib/engine/scale";

export const TANK_FILL_SECONDS = 3;
export const DRAG_THRESHOLD_PX = 8;

const TANK = "relative h-64 w-24 rounded-2xl border-2 border-line";

export function TankStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const t = clamp(toFraction(metric, value));
  const { onKeyDown } = useGaugeInput(metric, value, () => 0, interactive ? onChange : undefined);

  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const hold = useRef({ t: 0, at: 0, y: 0, dragging: false });
  const stop = () => clearInterval(timer.current);
  useEffect(() => stop, []);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = (hold.current = { t, at: Date.now(), y: e.clientY, dragging: false });
    stop();
    timer.current = setInterval(() => onChange?.(fromFraction(metric, clamp(h.t + (Date.now() - h.at) / (TANK_FILL_SECONDS * 1000)))), 50);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const h = hold.current;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (!h.dragging && Math.abs(e.clientY - h.y) <= DRAG_THRESHOLD_PX) return;
    h.dragging = true;
    stop();
    const r = e.currentTarget.getBoundingClientRect();
    onChange?.(fromFraction(metric, clamp(1 - (e.clientY - r.top) / r.height)));
  };

  return (
    <div data-testid="tank-stage" className="flex flex-none items-end justify-center gap-8 px-6 py-4">
      <div className={TANK}>
        <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-[0.875rem]" style={{ height: `${clamp(toFraction(metric, refValue)) * 100}%` }}>
          <div className="size-full bg-blue opacity-40" />
        </div>
      </div>
      <div
        data-testid="tank-red"
        className={`${TANK} touch-none`}
        {...(interactive ? { onPointerDown: down, onPointerMove: move, onPointerUp: stop, onPointerCancel: stop } : {})}
      >
        <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-[0.875rem]" style={{ height: `${t * 100}%` }}>
          <div data-testid="guess-fill" className="size-full bg-red" />
        </div>
        {reveal && (
          <svg
            data-testid="true-value"
            viewBox="0 0 40 4"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-2 h-1 -translate-y-1/2 text-truth"
            style={{ top: `${(1 - clamp(toFraction(metric, actual))) * 100}%` }}
          >
            <line x1="0" y1="2" x2="40" y2="2" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeDasharray="4 3" />
          </svg>
        )}
        {interactive && <GaugeSlider metric={metric} value={value} x={50} y={(1 - t) * 100} onKeyDown={onKeyDown} />}
      </div>
    </div>
  );
}
