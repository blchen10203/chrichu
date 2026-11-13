"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { BarStage } from "@/components/BarStage";
import { SilhouetteStage } from "@/components/SilhouetteStage";
import { config } from "@/lib/config";
import { metricCopy } from "@/lib/copy";
import { formatValue, fromFraction, nudge } from "@/lib/engine/scale";
import type { Fighter, Metric } from "@/lib/engine/types";


export function Header({ modeLabel, top }: { modeLabel: string; top?: ReactNode }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="font-display text-[22px] font-bold tracking-wider">{config.name}</div>
        <div className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold tracking-wider text-muted">{modeLabel}</div>
      </div>
      {top}
    </>
  );
}

type RowsProps = { metric: Metric; refFighter: Fighter; target: Fighter; refValue: number };

export function FighterRows({ metric, refFighter, target, refValue }: RowsProps) {
  return (
    <div className="flex flex-col gap-2 px-1.5">
      <div className="flex items-center gap-2.5">
        <Avatar fighter={refFighter} corner="blue" />
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{refFighter.name}</div>
          <div className="text-xs text-muted">Blue corner · reference</div>
        </div>
        <div className="font-display text-2xl font-bold text-blue">{formatValue(metric, refValue)}</div>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar fighter={target} corner="red" />
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{target.name}</div>
          <div className="text-xs text-muted">Red corner · your estimate</div>
        </div>
      </div>
    </div>
  );
}

export const panel = "flex flex-1 flex-col gap-3 rounded-2xl border border-line bg-panel px-3 py-4";
export const bigButton =
  "flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-action font-display text-2xl font-bold tracking-wider text-white";

type Props = RowsProps & {
  modeLabel: string;
  top?: ReactNode;
  onLockIn: (guess: number) => void;
};

export function RoundShell({ modeLabel, top, metric, refFighter, target, refValue, onLockIn }: Props) {
  const [guess, setGuess] = useState(() => fromFraction(metric, 0.5));
  const copy = metricCopy(metric, target.name);
  const stage = { metric, refValue, value: guess, onChange: setGuess };
  const circle = "flex size-12 items-center justify-center rounded-full border border-line bg-panel text-text";

  return (
    <>
      <Header modeLabel={modeLabel} top={top} />
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold tracking-[1.5px] text-red">{copy.category}</div>
        <h1 className="font-display text-[30px] font-bold leading-[1.05]">{copy.question}</h1>
      </div>
      <div className={panel}>
        {metric.round === "silhouette" ? <SilhouetteStage {...stage} /> : <BarStage {...stage} />}
        <FighterRows metric={metric} refFighter={refFighter} target={target} refValue={refValue} />
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Decrease" className={circle} onClick={() => setGuess(nudge(metric, guess, -1))}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9 H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="font-display text-[56px] font-bold leading-none text-red">{formatValue(metric, guess)}</div>
        <button type="button" aria-label="Increase" className={circle} onClick={() => setGuess(nudge(metric, guess, 1))}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9 H15 M9 3 V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="text-center text-xs text-muted">Drag, or tap − and + to fine-tune</p>
      <button type="button" aria-label="Lock in" className={bigButton} onClick={() => onLockIn(guess)}>
        LOCK IN
      </button>
    </>
  );
}
