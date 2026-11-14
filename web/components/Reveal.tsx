import { useEffect, useState, type ReactNode } from "react";
import { Stage } from "@/components/stages";
import { bigButton, FighterRows, Header, panel } from "@/components/RoundShell";
import { formatValue, snapValue } from "@/lib/engine/scale";
import type { Fighter, Metric } from "@/lib/engine/types";

type Props = {
  modeLabel: string;
  top?: ReactNode;
  metric: Metric;
  refFighter: Fighter;
  target: Fighter;
  refValue: number;
  guess: number;
  actual: number;
  score: number;
  hpLost?: number;
  nextLabel: string;
  onNext: () => void;
};

// A score's colour: red at 0, through amber, to green at 100. `lightness` keeps text dark enough to read on white.
const quality = (score: number, lightness: number) => `hsl(${Math.round(score * 1.3)} 75% ${lightness}%)`;

// Counts up from 0 to `target` with an ease-out, or shows it at once when the viewer prefers less motion.
function useCountUp(target: number, ms = 600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setN(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

export function Reveal({ modeLabel, top, metric, refFighter, target, refValue, guess, actual, score, hpLost, nextLabel, onNext }: Props) {
  const stage = { metric, refValue, value: guess, actual, refId: refFighter.id, targetId: target.id };
  const spotOn = guess === snapValue(metric, actual);
  const good = score >= 80;

  const shown = useCountUp(score);

  // Haptic confirmation on every answer, stronger on good ones; navigator.vibrate is missing on iOS Safari, so it's a no-op there.
  useEffect(() => {
    navigator.vibrate?.(spotOn ? [30, 60, 30, 60, 90] : good ? 40 : 15);
  }, [good, spotOn]);

  return (
    <>
      <Header modeLabel={modeLabel} top={top} />
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <div
              data-testid="score"
              className={`origin-bottom-left font-display text-[120px] font-extralight leading-[0.8] ${good ? "motion-safe:animate-pop" : ""}`}
              style={{ color: quality(shown, 34) }}
            >
              {shown}
            </div>
            <div className="font-display text-[28px] font-light text-muted">/ 100</div>
          </div>
          <div className="text-right text-sm text-muted motion-safe:animate-settle">
            {spotOn ? "Spot on" : `${formatValue(metric, Math.abs(guess - actual))} ${guess < actual ? "too low" : "too high"}`}
            {hpLost !== undefined && <div className="text-text">−{hpLost.toFixed(1)} HP</div>}
          </div>
        </div>
        {/* How good the guess was, red to green, filling in step with the count. */}
        <div aria-hidden="true" className="h-1.5 rounded-full bg-line">
          <div className="h-full rounded-full" style={{ width: `${shown}%`, background: quality(shown, 46) }} />
        </div>
      </div>
      <div className={`${panel} ${spotOn ? "motion-safe:animate-ring" : ""}`}>
        <Stage {...stage} />
        <FighterRows metric={metric} refFighter={refFighter} target={target} refValue={refValue} />
        <div className="flex gap-6">
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-xs text-muted">Your estimate</div>
            <div data-testid="your-estimate" className="font-display text-[32px] font-light leading-none">{formatValue(metric, guess)}</div>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-xs text-muted">Actual</div>
            <div className="self-start border-b border-dashed border-text font-display text-[32px] font-light leading-none">{formatValue(metric, actual)}</div>
          </div>
        </div>
      </div>
      <button type="button" className={bigButton} onClick={onNext}>
        {nextLabel}
      </button>
    </>
  );
}
