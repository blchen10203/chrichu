import Link from "next/link";
import { Header, bigButton, panel } from "@/components/RoundShell";
import { ShareButton } from "@/components/ShareButton";
import { config } from "@/lib/config";
import { metricCopy } from "@/lib/copy";
import { formatValue } from "@/lib/engine/scale";
import { survivalShareText } from "@/lib/engine/share";
import type { Fighter, Metric } from "@/lib/engine/types";

type Props = {
  survived: number;
  best: number;
  fatal: { metric: Metric; target: Fighter; guess: number; actual: number; lost: number };
  onPlayAgain: () => void;
};

export function SurvivalResults({ survived, best, fatal, onPlayAgain }: Props) {
  const { metric, target, guess, actual, lost } = fatal;
  return (
    <>
      <Header modeLabel="SURVIVAL · OVER" />
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-semibold tracking-[1.5px] text-red">ROUNDS SURVIVED</div>
        <div data-testid="survival-total" className="font-display text-[104px] font-bold leading-[0.9]">{survived}</div>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-panel p-3">
        <div className="text-xs text-muted">Your best</div>
        <div className="font-display text-[30px] font-bold">{best}</div>
      </div>
      <div className={`${panel} flex-none gap-1.5`}>
        <div className="text-xs text-muted">Ended by</div>
        <div className="text-[15px] font-semibold">
          {metricCopy(metric, target.name).short} · {target.name}
        </div>
        <div className="text-[13px]">
          You said {formatValue(metric, guess)} · Actual {formatValue(metric, actual)}
        </div>
        <div className="font-semibold text-red">−{lost.toFixed(1)} HP</div>
      </div>
      <ShareButton text={survivalShareText(config.name, survived, config.siteUrl)} />
      <button type="button" aria-label="Play again" className={bigButton} onClick={onPlayAgain}>
        PLAY AGAIN
      </button>
      <Link href="/" className="flex h-12 items-center justify-center rounded-xl border border-line text-[15px] font-semibold">
        Home
      </Link>
    </>
  );
}
