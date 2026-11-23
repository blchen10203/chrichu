"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { bigButton, Header } from "@/components/RoundShell";
import { headingFocus, RouletteBoard } from "@/components/RouletteBoard";
import { RouletteList } from "@/components/RouletteList";
import { deal, rightCount, slotsOf, type Entry } from "@/lib/engine/roulette";
import { rankings, type Division } from "@/lib/rankings";

type Run = {
  phase: "board" | "list" | "over" | "won";
  cleared: Set<string>;
  open: Division | null;
  orders: Map<string, Entry[]>; // each opened list's arrangement, kept when the player steps back to the board
  last: { right: number; total: number } | null;
  justCleared: string | null;
};

const fresh = (): Run => ({ phase: "board", cleared: new Set(), open: null, orders: new Map(), last: null, justCleared: null });

const screen = "flex flex-1 flex-col gap-6";
// An exiting screen stays on the page while it fades, so it must not take clicks.
const gone = { opacity: 0, pointerEvents: "none" as const };
const rise = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: gone };
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: gone };
// The popped-out screen lingers until the card's move ends, so it hides fast.
const leave = { exit: { ...gone, transition: { duration: 0.15 } } };

export default function RoulettePage() {
  const [run, setRun] = useState(fresh);
  const { phase, cleared, open, orders, last } = run;
  const total = rankings.divisions.length;

  // Every change goes through an updater that checks the phase, since a fading screen's handlers hold stale state.
  const pick = (name: string) => {
    const d = rankings.divisions.find((x) => x.division === name)!;
    const dealt = orders.get(name) ?? deal(Math.random, d); // the first open in a run deals
    setRun((r) =>
      r.phase !== "board" || r.cleared.has(name)
        ? r
        : { ...r, phase: "list", open: d, justCleared: null, orders: r.orders.has(name) ? r.orders : new Map(r.orders).set(name, dealt) },
    );
  };

  const reorder = (d: Division, order: Entry[]) =>
    setRun((r) => (r.phase === "list" && r.open === d ? { ...r, orders: new Map(r.orders).set(d.division, order) } : r));

  const back = () => setRun((r) => (r.phase === "list" ? { ...r, phase: "board", open: null } : r));

  const lockIn = () =>
    setRun((r) => {
      if (r.phase !== "list" || !r.open) return r;
      const right = rightCount(r.open, r.orders.get(r.open.division)!);
      const slots = slotsOf(r.open).length;
      if (right < slots) return { ...r, phase: "over", last: { right, total: slots } };
      const next = new Set(r.cleared).add(r.open.division);
      return { ...r, phase: next.size === total ? "won" : "board", cleared: next, open: null, justCleared: r.open.division };
    });

  const end = (label: string, result: string) => (
    <motion.div key={phase} {...rise} className={screen}>
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <h1 {...headingFocus} className="font-display text-[56px] font-extralight leading-none tracking-tight outline-none">
          {result}
        </h1>
      </div>
      <div className="flex-1" />
      <button type="button" className={bigButton} onClick={() => setRun(fresh())}>
        Restart roulette
      </button>
    </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <Header modeLabel="Roulette" />
      {/* No fade on first paint: the server-rendered board shows before scripts load. */}
      <AnimatePresence mode="wait" initial={false}>
        {phase === "over" && last ? (
          end("Run over", `${last.right} of ${last.total} right`)
        ) : phase === "won" ? (
          end("All cleared", `${cleared.size} of ${total} cleared`)
        ) : (
          <motion.div key="play" {...fade} className={screen}>
            {/* Board and list swap in one commit, so the card can grow into the heading. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {phase === "list" && open ? (
                <motion.div key={`list-${open.division}`} {...leave} className={screen}>
                  <RouletteList
                    division={open}
                    order={orders.get(open.division)!}
                    onOrder={(order) => reorder(open, order)}
                    onLockIn={lockIn}
                    onBack={back}
                  />
                </motion.div>
              ) : (
                <motion.div key="board" {...leave} className={screen}>
                  <RouletteBoard cleared={cleared} justCleared={run.justCleared} onPick={pick} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
