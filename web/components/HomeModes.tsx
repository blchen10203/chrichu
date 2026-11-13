"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localDate } from "@/lib/engine/rounds";
import { browserStorage, currentStreak, load } from "@/lib/storage";

const card = "flex min-h-[72px] flex-col justify-center rounded-2xl border border-line bg-panel px-4 py-3";
const title = "font-display text-2xl font-bold tracking-wider";

export function HomeModes() {
  // The date and storage exist only after mount.
  const [live, setLive] = useState<{ streak: number; total: number | null } | null>(null);
  useEffect(() => {
    const today = localDate(new Date());
    const state = load(browserStorage());
    const day = state.daily.days[today];
    const total = day?.done ? day.scores.reduce((a, b) => a + b, 0) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive({ streak: currentStreak(state, today), total });
  }, []);

  return (
    <>
      <Link href="/daily" className={card}>
        <span className={title}>Daily</span>
        <span className="text-sm text-muted">
          {live?.total != null ? `Done today · ${live.total} / 500` : "5 rounds. One try a day."}
        </span>
      </Link>
      <Link href="/infinite" className={card}>
        <span className={title}>Infinite</span>
        <span className="text-sm text-muted">Endless practice. No pressure.</span>
      </Link>
      <div className={`${card} opacity-50`} aria-disabled="true">
        <span className={title}>Survival</span>
        <span className="text-sm text-muted">Coming soon.</span>
      </div>
      <p className="min-h-5 text-sm text-muted">
        {live && `Streak: ${live.streak} ${live.streak === 1 ? "day" : "days"}`}
      </p>
    </>
  );
}
