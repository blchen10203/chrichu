import type { StageProps } from "@/components/BarStage";
import { GaugeSlider, arcAt, clamp, useGaugeInput } from "@/components/stages/gauge";
import { pointAt } from "@/lib/arc";
import { toFraction } from "@/lib/engine/scale";

const SWEEP = 270;
const R_OUT = 44;
const R_IN = 34;

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

  const { face, onKeyDown } = useGaugeInput(metric, value, arcAt(SWEEP), interactive ? onChange : undefined);

  const knob = pointAt(t, SWEEP);
  const tick = pointAt(clamp(toFraction(metric, actual ?? 0)), SWEEP);

  return (
    <div data-testid="dial-stage" className="flex flex-none justify-center px-2">
      <div
        data-testid="dial-face"
        className="relative aspect-square w-full max-w-80 touch-none"
        {...face}
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
        {interactive && <GaugeSlider metric={metric} value={value} x={50 + R_OUT * knob.dx} y={50 + R_OUT * knob.dy} onKeyDown={onKeyDown} />}
      </div>
    </div>
  );
}
