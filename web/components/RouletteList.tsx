"use client";

import { motion, Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import { headingFocus } from "@/components/RouletteBoard";
import { bigButton, quietButton } from "@/components/RoundShell";
import { fighters } from "@/lib/engine/data";
import { entryKey, slotsOf, type Entry } from "@/lib/engine/roulette";
import { fighterImage } from "@/lib/images";
import type { Division } from "@/lib/rankings";

const hasImage = new Map(fighters.map((f) => [f.id, f.hasImage]));

function Row({ entry, label, selected, onTap }: { entry: Entry; label: string; selected: boolean; onTap: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      data-testid="roulette-row"
      className="relative flex items-center gap-2 rounded-full bg-bg"
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${entry.name}, ${label}`}
        onClick={onTap}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-full border p-1 pr-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${
          selected ? "border-text" : "border-line"
        }`}
      >
        <span className="w-14 shrink-0 text-center font-display text-[22px] font-light leading-none">{label}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
        <img
          src={entry.id ? fighterImage(entry.id, hasImage.get(entry.id) ?? false) : fighterImage("", false)}
          alt={entry.name}
          width={44}
          height={44}
          draggable={false}
          className="size-11 shrink-0 rounded-full border border-line object-cover grayscale"
        />
        <span className="min-w-0 break-words text-[15px] leading-tight">{entry.name}</span>
      </button>
      {/* Only the handle starts a drag, so a finger elsewhere still scrolls the page. */}
      <span
        aria-hidden="true"
        data-testid="roulette-handle"
        onPointerDown={(e) => controls.start(e)}
        className="flex size-11 shrink-0 cursor-grab touch-none select-none items-center justify-center text-[22px] text-muted active:cursor-grabbing"
      >
        ≡
      </span>
    </Reorder.Item>
  );
}

type ListProps = { division: Division; order: Entry[]; onOrder: (order: Entry[]) => void; onLockIn: () => void; onBack: () => void };

export function RouletteList({ division, order, onOrder, onLockIn, onBack }: ListProps) {
  const slots = slotsOf(division);
  const [selected, setSelected] = useState<string | null>(null);

  // Tap one row, then another to swap them; tapping the same row again lets go.
  const tap = (key: string) => {
    if (selected && selected !== key) {
      const a = order.findIndex((e) => entryKey(e) === selected);
      const b = order.findIndex((e) => entryKey(e) === key);
      const next = [...order];
      [next[a], next[b]] = [next[b], next[a]];
      onOrder(next);
    }
    setSelected(selected === null ? key : null);
  };

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
      <Reorder.Group axis="y" as="ol" initial={{ opacity: 0 }} animate={{ opacity: 1 }} values={order} onReorder={onOrder} aria-label={`${division.division} order`} className="flex flex-col gap-2">
        {order.map((e, i) => (
          <Row key={entryKey(e)} entry={e} label={slots[i].label} selected={selected === entryKey(e)} onTap={() => tap(entryKey(e))} />
        ))}
      </Reorder.Group>
      <p className="text-xs text-muted">Drag a fighter by ≡ to their slot, or tap two fighters to swap them.</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={quietButton} onClick={onBack}>
          ← Board
        </button>
        <button type="button" className={bigButton} onClick={onLockIn}>
          Lock in
        </button>
      </div>
    </>
  );
}
