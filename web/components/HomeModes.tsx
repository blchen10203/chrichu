"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localDate } from "@/lib/engine/rounds";
import { browserStorage, currentStreak, load } from "@/lib/storage";

const mode =
  "group flex items-baseline justify-between py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text";
const word = "font-display text-[88px] font-extralight leading-[0.95] tracking-tight motion-safe:transition-[font-weight] motion-safe:duration-300 group-hover:font-normal";

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
    <div className="flex flex-1 flex-col justify-center gap-2">
      <Link href="/daily" className={mode}>
        <span className={word}>Daily</span>
        {live?.total != null && <span className="text-sm text-muted">{live.total} / 500</span>}
      </Link>
      <Link href="/infinite" className={mode}>
        <span className={word}>Infinite</span>
      </Link>
      <Link href="/survival" className={mode}>
        <span className={word}>Survival</span>
      </Link>
      <p className="mt-4 min-h-5 text-sm text-muted">
        {live && `Streak: ${live.streak} ${live.streak === 1 ? "day" : "days"}`}
      </p>
    </div>
  );
}
