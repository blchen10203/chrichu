"use client";

import { motion, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { whereAt } from "@/components/RankingRound";
import { headingFocus } from "@/components/RouletteBoard";
import { bigButton, quietButton } from "@/components/RoundShell";
import { fighters } from "@/lib/engine/data";
import { entryKey, slotsOf, type Entry } from "@/lib/engine/roulette";
import { fighterImage } from "@/lib/images";
import type { Division } from "@/lib/rankings";

// A list in play: the dealt pool on the right, and who sits in each slot on the left.
export type ListState = { pool: Entry[]; placed: (Entry | null)[] };
type Where = number | "side";

const hasImage = new Map(fighters.map((f) => [f.id, f.hasImage]));
const SHUFFLES = 6;
const SHUFFLE_MS = 180;

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type ChipProps = { entry: Entry; group: string; where: string; compact: boolean; selected: boolean; busy: boolean; onTap: () => void; onDrag: (to: Where | null) => void; onDrop: (to: Where | null) => void };

function Chip({ entry, group, where, compact, selected, busy, onTap, onDrag, onDrop }: ChipProps) {
  const dragged = useRef(false);
  // info.point is page coordinates; the drop targets are found by viewport ones.
  const at = (info: PanInfo) => whereAt(info.point.x - window.scrollX, info.point.y - window.scrollY);
  return (
    <motion.button
      type="button"
      layoutId={`${group}-${entryKey(entry)}`}
      layout
      drag={!busy}
      dragSnapToOrigin
      dragMomentum={false}
      whileDrag={{ scale: 1.05, zIndex: 20, boxShadow: "0 10px 24px rgb(0 0 0 / 0.35)" }}
      onPointerDown={() => (dragged.current = false)}
      onDragStart={() => (dragged.current = true)}
      onDrag={(_, info) => onDrag(at(info))}
      onDragEnd={(_, info) => onDrop(at(info))}
      onClick={() => !dragged.current && onTap()}
      disabled={busy}
      data-testid="roulette-chip"
      aria-label={`${entry.name}, ${where}`}
      aria-pressed={selected}
      className={`relative flex w-full touch-none select-none items-center gap-2 rounded-full border bg-bg p-1 pr-3 text-left leading-tight ${compact ? "text-[13px]" : "text-sm"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${
        busy ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${selected ? "border-text" : "border-line"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
      <img
        src={entry.id ? fighterImage(entry.id, hasImage.get(entry.id) ?? false) : fighterImage("", false)}
        alt=""
        width={44}
        height={44}
        draggable={false}
        className={`${compact ? "size-8" : "size-11"} shrink-0 rounded-full border border-line object-cover grayscale`}
      />
      <span className="min-w-0 break-words">{entry.name}</span>
    </motion.button>
  );
}

type ListProps = { division: Division; state: ListState; shuffle: boolean; onChange: (state: ListState) => void; onLockIn: () => void; onBack: () => void };

export function RouletteList({ division, state, shuffle, onChange, onLockIn, onBack }: ListProps) {
  const slots = slotsOf(division);
  const { pool, placed } = state;
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<Where | null>(null);
  const reduced = useReducedMotion();
  // Fresh per opening, so a reopened list does not fly its fighters in from where they last were.
  const group = useId();
  // While dealing, the pool shows a few random orders before settling on the dealt one.
  const [dealing, setDealing] = useState<Entry[] | null>(() => (shuffle && !reduced ? shuffled(pool) : null));
  useEffect(() => {
    if (!dealing) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      setDealing(n < SHUFFLES ? shuffled(pool) : null);
      if (n >= SHUFFLES) clearInterval(id);
    }, SHUFFLE_MS);
    return () => clearInterval(id);
    // Runs once per opening; `dealing` only says whether to start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = dealing !== null;

  // Puts `key` at `to`; a fighter already in that slot goes where `key` came from.
  const move = (key: string, to: Where) => {
    const entry = pool.find((e) => entryKey(e) === key)!;
    const next = [...placed];
    const from = next.findIndex((e) => e && entryKey(e) === key);
    if (from >= 0) next[from] = null;
    if (to !== "side") {
      if (from >= 0) next[from] = next[to];
      next[to] = entry;
    }
    onChange({ pool, placed: next });
    setSelected(null);
  };

  // Tap a fighter, then a slot (or a placed fighter, to swap); tap it again to let go.
  const tap = (key: string) => {
    const at = placed.findIndex((e) => e && entryKey(e) === key);
    if (selected && selected !== key && at >= 0) return move(selected, at);
    setSelected(selected === key ? null : key);
  };

  const chip = (e: Entry, where: string) => (
    <Chip
      key={entryKey(e)}
      entry={e}
      group={group}
      where={where}
      compact={where !== "not placed"}
      selected={selected === entryKey(e)}
      busy={busy}
      onTap={() => tap(entryKey(e))}
      onDrag={setOver}
      onDrop={(to) => {
        setOver(null);
        if (to !== null) move(entryKey(e), to);
      }}
    />
  );
  const waiting = (dealing ?? pool).filter((e) => !placed.includes(e));
  const highlight = (w: Where) => (over === w ? "border-text bg-line/40" : "border-line");

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-muted">Official UFC rankings</div>
        <motion.h1
          {...headingFocus}
          layoutId={`division-${division.division}`}
          layoutCrossfade={false}
          className="self-start text-[26px] font-medium leading-[1.15] tracking-tight outline-none"
        >
          {division.division}
        </motion.h1>
      </div>
      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] content-start gap-2">
        <ol aria-label={`${division.division} ranks`} className="flex flex-col gap-2">
          {slots.map((slot, i) => {
            const e = placed[i];
            return (
              <li key={i} data-drop={i} data-testid="roulette-slot" className="flex items-center gap-2">
                <span className="w-11 shrink-0 font-display text-[18px] font-light leading-none">{slot.label}</span>
                <div className={`flex min-h-14 min-w-0 flex-1 items-center rounded-full border border-dashed p-1 ${highlight(i)}`}>
                  {e ? (
                    chip(e, `placed at ${slot.label}`)
                  ) : (
                    <button
                      type="button"
                      aria-label={`Place at ${slot.label}`}
                      disabled={!selected}
                      onClick={() => selected && move(selected, i)}
                      className="h-11 w-full rounded-full text-xs text-muted focus-visible:outline-2 focus-visible:outline-text"
                    >
                      {selected ? "Place here" : ""}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div
          data-drop="side"
          aria-label="Fighters to place"
          className={`flex flex-col gap-2 rounded-3xl border p-1 ${over === "side" ? highlight("side") : "border-transparent"}`}
        >
          {waiting.map((e) => chip(e, "not placed"))}
        </div>
      </div>
      <p className="text-xs text-muted">Drag each fighter to their rank, or tap a fighter and then a rank.</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={quietButton} onClick={onBack}>
          ← Board
        </button>
        <button type="button" className={`${bigButton} disabled:opacity-40`} disabled={placed.includes(null)} onClick={onLockIn}>
          Lock in
        </button>
      </div>
    </>
  );
}
