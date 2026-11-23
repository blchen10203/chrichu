"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";
import { bigButton, Header } from "@/components/RoundShell";
import { RouletteBoard } from "@/components/RouletteBoard";
import { RouletteList } from "@/components/RouletteList";
import { rightCount, slotsOf, type Entry } from "@/lib/engine/roulette";
import { rankings, type Division } from "@/lib/rankings";

type Phase = "board" | "list" | "over" | "won";

const screen = "flex flex-1 flex-col gap-6";
const rise = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

export default function RoulettePage() {
  const [cleared, setCleared] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<Division | null>(null);
  const [phase, setPhase] = useState<Phase>("board");
  const [last, setLast] = useState<{ right: number; total: number } | null>(null);
  const total = rankings.divisions.length;

  const restart = () => {
    setCleared(new Set());
    setOpen(null);
    setLast(null);
    setPhase("board");
  };

  const lockIn = (d: Division, order: Entry[]) => {
    const right = rightCount(d, order);
    const slots = slotsOf(d).length;
    if (right < slots) {
      setLast({ right, total: slots });
      return setPhase("over");
    }
    const next = new Set(cleared).add(d.division);
    setCleared(next);
    setOpen(null);
    setPhase(next.size === total ? "won" : "board");
  };

  const end = (label: string, result: string) => (
    <motion.div key={phase} {...rise} className={screen}>
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <h1 className="font-display text-[56px] font-extralight leading-none tracking-tight">{result}</h1>
      </div>
      <div className="flex-1" />
      <button type="button" className={bigButton} onClick={restart}>
        Restart roulette
      </button>
    </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <Header modeLabel="Roulette" />
      {/* No fade on first paint: the server-rendered board shows before scripts load. */}
      <AnimatePresence mode="wait" initial={false}>
        {phase === "list" && open ? (
          <motion.div key={`list-${open.division}`} {...fade} className={screen}>
            <RouletteList
              division={open}
              onLockIn={(order) => lockIn(open, order)}
              onBack={() => {
                setOpen(null);
                setPhase("board");
              }}
            />
          </motion.div>
        ) : phase === "over" && last ? (
          end("Run over", `${last.right} of ${last.total} right`)
        ) : phase === "won" ? (
          end("All cleared", `${cleared.size} of ${total} cleared`)
        ) : (
          <motion.div key="board" {...fade} className={screen}>
            <RouletteBoard
              cleared={cleared}
              onPick={(name) => {
                setOpen(rankings.divisions.find((d) => d.division === name) ?? null);
                setPhase("list");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
