import type { ReactNode } from "react";
import { BarStage } from "@/components/BarStage";
import { SilhouetteStage } from "@/components/SilhouetteStage";
import { bigButton, FighterRows, Header, panel } from "@/components/RoundShell";
import { metricCopy } from "@/lib/copy";
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

export function Reveal({ modeLabel, top, metric, refFighter, target, refValue, guess, actual, score, hpLost, nextLabel, onNext }: Props) {
  const copy = metricCopy(metric, target.name);
  const stage = { metric, refValue, value: guess, actual };
  const spotOn = guess === snapValue(metric, actual);

  return (
    <>
      <Header modeLabel={modeLabel} top={top} />
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold tracking-[1.5px] text-red">
            {copy.category} · {target.name.toUpperCase()}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="font-display text-[96px] font-bold leading-[0.9]">{score}</div>
            <div className="font-display text-[28px] font-semibold text-muted">/ 100</div>
          </div>
        </div>
        <div className="pb-1.5 text-right text-sm text-muted">
          {!spotOn && (
            <>
              Off by {formatValue(metric, Math.abs(guess - actual))}
              <br />
            </>
          )}
          {spotOn ? "Spot on" : guess < actual ? "too low" : "too high"}
          {hpLost !== undefined && <div className="font-semibold text-red">−{hpLost.toFixed(1)} HP</div>}
        </div>
      </div>
      <div className={panel}>
        {metric.round === "silhouette" ? <SilhouetteStage {...stage} /> : <BarStage {...stage} />}
        <FighterRows metric={metric} refFighter={refFighter} target={target} refValue={refValue} />
        <div className="flex gap-2 px-1.5">
          <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-bg px-3 py-2.5">
            <div className="text-xs text-muted">Your estimate</div>
            <div data-testid="your-estimate" className="font-display text-[28px] font-bold text-red">{formatValue(metric, guess)}</div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-dashed border-text bg-bg px-3 py-2.5">
            <div className="text-xs text-muted">Actual</div>
            <div className="font-display text-[28px] font-bold">{formatValue(metric, actual)}</div>
          </div>
        </div>
      </div>
      <button type="button" aria-label={nextLabel[0] + nextLabel.slice(1).toLowerCase()} className={bigButton} onClick={onNext}>
        {nextLabel}
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 10 H16 M11 5 L16 10 L11 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
