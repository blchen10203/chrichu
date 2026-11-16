"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ACTIVE_YEARS, localDate } from "@/lib/engine/rounds";
import { activeOnly } from "@/lib/prefs";
import { browserStorage, currentStreak, load } from "@/lib/storage";

const mode =
  "group flex items-baseline justify-between py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text";
const word = "font-display text-[88px] font-extralight leading-[0.95] tracking-tight motion-safe:transition-[font-weight] motion-safe:duration-300 group-hover:font-normal";

// Infinite and Survival with active fighters only; the note says the Daily is never filtered.
function ActiveToggle() {
  const on = activeOnly.useValue();
  return (
    <div className="mt-4 flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby="active-note"
        onClick={() => activeOnly.set(!on)}
        className="flex min-h-11 items-center gap-3 self-start text-[15px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-text"
      >
        <span className={`relative h-6 w-10 shrink-0 rounded-full motion-safe:transition-colors ${on ? "bg-text" : "bg-line"}`}>
          <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-bg shadow-sm motion-safe:transition-transform ${on ? "translate-x-4" : ""}`} />
        </span>
        Active fighters only
      </button>
      <p id="active-note" className="text-xs text-muted">
        Infinite and Survival only: fighters with a UFC fight in the last {ACTIVE_YEARS} years. The Daily always uses every fighter.
      </p>
    </div>
  );
}

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
      <ActiveToggle />
      <p className="mt-2 min-h-5 text-sm text-muted">
        {live && `Streak: ${live.streak} ${live.streak === 1 ? "day" : "days"}`}
      </p>
    </div>
  );
}
