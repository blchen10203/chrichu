"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header, panel } from "@/components/RoundShell";
import { ShareButton } from "@/components/ShareButton";
import { config } from "@/lib/config";
import { metricCopy } from "@/lib/copy";
import { fighters, metrics } from "@/lib/engine/data";
import { localDate } from "@/lib/engine/rounds";
import { shareText } from "@/lib/engine/share";
import { currentStreak, dailyStats, type DayState, type State } from "@/lib/storage";

const two = (n: number) => String(n).padStart(2, "0");

function untilMidnight(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.round((next.getTime() - now.getTime()) / 1000));
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-line bg-panel p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-[30px] font-bold">{value}</div>
    </div>
  );
}

type Props = { puzzle: number; day: DayState; state: State; today: string };

export function Results({ puzzle, day, state, today }: Props) {
  const [left, setLeft] = useState<string | null>(null);
  const [newDay, setNewDay] = useState(false);

  // The clock exists only after mount.
  useEffect(() => {
    const tick = () => {
      setLeft(untilMidnight());
      setNewDay(localDate(new Date()) !== today);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today]);

  const total = day.scores.reduce((a, b) => a + b, 0);
  const streak = currentStreak(state, today);
  const stats = dailyStats(state);

  return (
    <>
      <Header modeLabel={puzzle < 1 ? "DAILY · DONE" : `DAILY #${puzzle} · DONE`} />
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-semibold tracking-[1.5px] text-red">FINAL SCORE</div>
        <div className="flex items-baseline gap-2">
          <div data-testid="daily-total" className="font-display text-[104px] font-bold leading-[0.9]">{total}</div>
          <div className="font-display text-[30px] font-semibold text-muted">/ 500</div>
        </div>
      </div>
      <div className={`${panel} flex-none gap-3.5`}>
        {day.scores.map((score, i) => {
          const round = day.rounds[i];
          const metric = metrics.find((m) => m.id === round?.metric);
          const target = fighters.find((f) => f.id === round?.target);
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <div>{metric && target ? `${metricCopy(metric, target.name).short} · ${target.name}` : `Round ${i + 1}`}</div>
                <div className="font-semibold">{score}</div>
              </div>
              <div className="flex h-2.5 rounded-[5px] bg-line">
                <div className="rounded-[5px] bg-text" style={{ width: `${score}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Stat label="Streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
        <Stat label="Your average" value={String(stats.average)} />
        <Stat label="Your best" value={String(stats.best)} />
      </div>
      <ShareButton text={shareText(config.name, puzzle, day.scores, config.siteUrl)} />
      <Link href="/infinite" className="flex h-12 items-center justify-center rounded-xl border border-line text-[15px] font-semibold">
        Play Infinite
      </Link>
      <Link href="/survival" className="flex h-12 items-center justify-center rounded-xl border border-line text-[15px] font-semibold">
        Play Survival
      </Link>
      {newDay ? (
        <Link href="/daily" className="flex h-12 items-center justify-center rounded-xl bg-red text-[15px] font-semibold">
          Today&apos;s puzzle is ready
        </Link>
      ) : (
        <div className="text-center text-xs text-muted">Next daily in {left ?? "--:--:--"}</div>
      )}
    </>
  );
}
