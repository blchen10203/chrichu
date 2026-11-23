"use client";

import { motion } from "motion/react";
import { entriesOf } from "@/lib/engine/roulette";
import { rankings } from "@/lib/rankings";

// Only the division just cleared pops its check and ticks the counter; the rest appear still.
export function RouletteBoard({ cleared, justCleared, onPick }: { cleared: Set<string>; justCleared: string | null; onPick: (division: string) => void }) {
  const total = rankings.divisions.length;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-normal leading-[1.15] tracking-tight text-balance">Ranking Roulette</h1>
        <p className="text-sm text-muted">Clear every division. One mistake ends the run.</p>
      </div>
      <motion.p initial={justCleared ? { opacity: 0, y: -6 } : false} animate={{ opacity: 1, y: 0 }} className="text-sm">
        {cleared.size} of {total} cleared
      </motion.p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rankings.divisions.map((d) => {
          const done = cleared.has(d.division);
          return (
            <motion.button
              key={d.division}
              layoutId={`division-${d.division}`}
              type="button"
              data-testid="division-card"
              disabled={done}
              onClick={() => onPick(d.division)}
              className="relative flex min-h-20 flex-col items-start justify-between gap-2 rounded-lg border border-line p-3 text-left enabled:active:bg-line disabled:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            >
              <span className="pr-5 text-[15px] font-medium leading-tight">{d.division}</span>
              <span className="text-xs text-muted">{entriesOf(d).length} fighters</span>
              {done && (
                <motion.span
                  role="img"
                  aria-label="Cleared"
                  initial={d.division === justCleared ? { scale: 0 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute top-2 right-3 text-truth"
                >
                  ✓
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </>
  );
}
