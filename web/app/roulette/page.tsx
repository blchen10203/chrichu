"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { bigButton, Header } from "@/components/RoundShell";
import { headingFocus, RouletteBoard } from "@/components/RouletteBoard";
import { RouletteList, type ListState } from "@/components/RouletteList";
import { deal, rightCount, slotsOf, type Entry } from "@/lib/engine/roulette";
import { rankings, type Division } from "@/lib/rankings";

type Run = {
  phase: "board" | "list" | "over" | "won";
  cleared: Set<string>;
  open: Division | null;
  lists: Map<string, ListState>; // each opened list's pool and placements, kept when the player steps back to the board
  dealt: boolean; // the open list was dealt just now, so its pool shuffles in
  justCleared: string | null;
};

const fresh = (): Run => ({ phase: "board", cleared: new Set(), open: null, lists: new Map(), dealt: false, justCleared: null });

const screen = "flex flex-1 flex-col gap-6";
// An exiting screen stays on the page while it fades, so it must not take clicks.
const gone = { opacity: 0, pointerEvents: "none" as const };
// A screen brought back while still fading out must come back to life, not stay as its exit left it.
const shown = { opacity: 1, pointerEvents: "auto" as const };
const rise = { initial: { opacity: 0, y: 16 }, animate: { ...shown, y: 0 }, exit: gone };
const fade = { initial: { opacity: 0 }, animate: shown, exit: gone };
// The popped-out screen lingers until the card's move ends, so it hides fast.
const leave = { animate: shown, exit: { ...gone, transition: { duration: 0.15 } } };

export default function RoulettePage() {
  const [run, setRun] = useState(fresh);
  const { phase, cleared, open, lists } = run;
  const total = rankings.divisions.length;

  // Every change goes through an updater that checks the phase, since a fading screen's handlers hold stale state.
  const pick = (name: string) => {
    const d = rankings.divisions.find((x) => x.division === name)!;
    const dealt: ListState = { pool: deal(Math.random, d), placed: slotsOf(d).map(() => null) }; // used on a list's first open
    setRun((r) =>
      r.phase !== "board" || r.cleared.has(name)
        ? r
        : { ...r, phase: "list", open: d, justCleared: null, dealt: !r.lists.has(name), lists: r.lists.has(name) ? r.lists : new Map(r.lists).set(name, dealt) },
    );
  };

  const change = (d: Division, list: ListState) =>
    setRun((r) => (r.phase === "list" && r.open === d ? { ...r, lists: new Map(r.lists).set(d.division, list) } : r));

  const back = () => setRun((r) => (r.phase === "list" ? { ...r, phase: "board", open: null } : r));

  const lockIn = () =>
    setRun((r) => {
      const placed = r.open && r.lists.get(r.open.division)!.placed;
      if (r.phase !== "list" || !r.open || !placed || placed.includes(null)) return r;
      // A wrong order keeps the list open, now marked slot by slot.
      if (rightCount(r.open, placed as Entry[]) < placed.length) return { ...r, phase: "over" };
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
        {phase === "won" ? (
          end("All cleared", `${cleared.size} of ${total} cleared`)
        ) : (
          <motion.div key="play" {...fade} className={screen}>
            {/* Board and list swap in one commit, so the card can grow into the heading. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {(phase === "list" || phase === "over") && open ? (
                <motion.div key={`list-${open.division}`} {...leave} className={screen}>
                  <RouletteList
                    division={open}
                    state={lists.get(open.division)!}
                    shuffle={run.dealt}
                    checked={phase === "over"}
                    onChange={(list) => change(open, list)}
                    onLockIn={lockIn}
                    onBack={back}
                    onRestart={() => setRun(fresh())}
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
