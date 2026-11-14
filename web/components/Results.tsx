"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bigButton, Header, panel, quietButton } from "@/components/RoundShell";
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

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-[32px] font-light leading-none">{value}</div>
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
      <Header modeLabel={puzzle < 1 ? "Daily" : `Daily #${puzzle}`} />
      <div className="flex items-baseline gap-2">
        <div data-testid="daily-total" className="font-display text-[136px] font-extralight leading-[0.8]">{total}</div>
        <div className="font-display text-[28px] font-light text-muted">/ 500</div>
      </div>
      <div className={`${panel} flex-none gap-4`}>
        {day.scores.map((score, i) => {
          const round = day.rounds[i];
          const metric = metrics.find((m) => m.id === round?.metric);
          const target = fighters.find((f) => f.id === round?.target);
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-[13px]">
                <div className="text-muted">
                  {target?.name ?? `Round ${i + 1}`}
                  {metric && target && <span className="text-text"> {metricCopy(metric, target.name).short.toLowerCase()}</span>}
                </div>
                <div className="font-display text-base tabular-nums">{score}</div>
              </div>
              <div className="flex h-0.5 bg-line">
                <div className="bg-text" style={{ width: `${score}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-6">
        <Stat label="Streak" value={`${streak} ${streak === 1 ? "day" : "days"}`} />
        <Stat label="Average" value={String(stats.average)} />
        <Stat label="Best" value={String(stats.best)} />
      </div>
      <div className="flex flex-col gap-3">
        <ShareButton text={shareText(config.name, puzzle, day.scores, config.siteUrl)} />
        <div className="flex gap-3">
          <Link href="/infinite" className={quietButton}>
            Infinite
          </Link>
          <Link href="/survival" className={quietButton}>
            Survival
          </Link>
        </div>
        {newDay ? (
          <Link href="/daily" className={bigButton}>
            Today&apos;s puzzle is ready
          </Link>
        ) : (
          <div className="text-center text-xs text-muted tabular-nums">Next daily in {left ?? "--:--:--"}</div>
        )}
      </div>
    </>
  );
}
