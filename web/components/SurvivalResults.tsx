import Link from "next/link";
import { Header, bigButton, panel } from "@/components/RoundShell";
import { Stat } from "@/components/Results";
import { ShareButton } from "@/components/ShareButton";
import { config } from "@/lib/config";
import { metricCopy } from "@/lib/copy";
import { survivalShareText } from "@/lib/engine/share";
import type { Fighter, Metric } from "@/lib/engine/types";
import { useFormat } from "@/lib/units";

type Props = {
  survived: number;
  best: number;
  fatal: { metric: Metric; target: Fighter; guess: number; actual: number; lost: number };
  onPlayAgain: () => void;
};

export function SurvivalResults({ survived, best, fatal, onPlayAgain }: Props) {
  const { metric, target, guess, actual, lost } = fatal;
  const formatValue = useFormat();
  return (
    <>
      <Header modeLabel="Survival" />
      <div className="flex items-baseline gap-3">
        <div data-testid="survival-total" className="font-display text-[136px] font-extralight leading-[0.8]">{survived}</div>
        <div className="text-[15px] text-muted">{survived === 1 ? "round" : "rounds"}</div>
      </div>
      <div className={`${panel} flex-none gap-6`}>
        <div className="flex gap-6">
          <Stat label="Best" value={String(best)} />
          <Stat label="Last hit" value={`−${lost.toFixed(1)} HP`} />
        </div>
        <div className="flex flex-col gap-1 text-[15px]">
          <div className="text-xs text-muted">Ended by</div>
          <div>
            {target.name} <span className="text-muted">{metricCopy(metric, target.name).short.toLowerCase()}</span>
          </div>
          <div className="text-muted">
            {formatValue(metric, guess)}, actual {formatValue(metric, actual)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <button type="button" className={bigButton} onClick={onPlayAgain}>
          Play again
        </button>
        <ShareButton text={survivalShareText(config.name, survived, config.siteUrl)} quiet />
        <Link href="/" className="flex min-h-11 items-center justify-center text-sm text-muted">
          Home
        </Link>
      </div>
    </>
  );
}
