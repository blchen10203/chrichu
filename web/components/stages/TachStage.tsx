import type { StageProps } from "@/components/BarStage";
import { GaugeSlider, arcAt, clamp, useGaugeInput } from "@/components/stages/gauge";
import { pointAt } from "@/lib/arc";
import { toFraction } from "@/lib/engine/scale";

const SWEEP = 240;
const R_OUT = 46;
const R_NEEDLE = 38;
const TICKS = Array.from({ length: 13 }, (_, i) => i / 12);

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
      strokeLinecap={dash ? "butt" : "round"}
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

  const { face, onKeyDown } = useGaugeInput(metric, value, arcAt(SWEEP), interactive ? onChange : undefined);

  const tip = pointAt(t, SWEEP);
  const a = pointAt(0, SWEEP);
  const b = pointAt(1, SWEEP);

  return (
    <div data-testid="tach-stage" className="flex flex-none justify-center px-2">
      <div
        data-testid="tach-face"
        className="relative aspect-square w-full max-w-80 touch-none"
        {...face}
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
          <Needle testId="guess-needle" t={t} width={3} className="text-red" />
          {reveal && <Needle testId="true-value" t={clamp(toFraction(metric, actual))} width={2} dash="4 3" className="text-truth" />}
          <circle cx="50" cy="50" r="3" fill="currentColor" className="text-red" />
        </svg>
        {interactive && <GaugeSlider metric={metric} value={value} x={50 + R_NEEDLE * tip.dx} y={50 + R_NEEDLE * tip.dy} onKeyDown={onKeyDown} />}
      </div>
    </div>
  );
}
