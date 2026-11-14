import type { StageProps } from "@/components/BarStage";
import { GaugeSlider, clamp, useGaugeInput } from "@/components/stages/gauge";
import { toFraction } from "@/lib/engine/scale";

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

  const { face, onKeyDown } = useGaugeInput(metric, value, (e, r) => clamp((e.clientX - r.left) / r.width), interactive ? onChange : undefined);

  return (
    <div data-testid="timeline-stage" className="flex-none px-6 py-4">
      <div data-testid="timeline-strip" className="relative h-24 touch-none" {...face}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <Pin t={clamp(toFraction(metric, refValue))} className="text-blue" opacity={0.4} />
        <Pin testId="guess-pin" t={t} className="text-red" />
        {reveal && <Pin testId="true-value" t={clamp(toFraction(metric, actual))} className="text-truth" dash="4 3" />}
        {interactive && <GaugeSlider metric={metric} value={value} x={t * 100} y={50} orientation="horizontal" onKeyDown={onKeyDown} />}
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>younger</span>
        <span>older</span>
      </div>
    </div>
  );
}
