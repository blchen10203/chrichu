"use client";

import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { quality } from "@/components/Reveal";
import { bigButton, Header, panel } from "@/components/RoundShell";
import { Timer } from "@/components/Timer";
import { correctCount, type Placement, type RankingRound } from "@/lib/engine/ranking";
import type { Fighter, FighterId } from "@/lib/engine/types";

type Where = number | "side"; // a slot, or the list on the side
type Drag = { id: FighterId; x: number; y: number; moved: boolean; over: Where | null };

const DRAG_PX = 6; // less than this is a tap
const rankLabel = "w-9 shrink-0 font-display text-[26px] font-light leading-none";
const dropZone = "flex min-h-14 flex-1 items-center rounded-lg border border-dashed p-1";

// The drop target under the pointer: the nearest element marked data-drop.
function whereAt(x: number, y: number): Where | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const drop = (el as HTMLElement).dataset?.drop;
    if (drop !== undefined) return drop === "side" ? "side" : Number(drop);
  }
  return null;
}

function Chip({ fighter, label, selected, drag, ...handlers }: {
  fighter: Fighter;
  label: string;
  selected: boolean;
  drag: Drag | null;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const moving = drag?.id === fighter.id && drag.moved;
  return (
    <button
      type="button"
      data-testid="rank-chip"
      aria-label={label}
      aria-pressed={selected}
      onDragStart={(e) => e.preventDefault()} // the photo must not start a native image drag
      {...handlers}
      style={moving ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined}
      className={`relative flex w-full touch-none select-none items-center gap-2 rounded-full border bg-bg p-1 pr-3 text-left text-sm leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${
        moving ? "z-10 cursor-grabbing shadow-lg" : "cursor-grab"
      } ${selected ? "border-text" : "border-line"}`}
    >
      <Avatar fighter={fighter} />
      <span className="min-w-0 break-words">{fighter.name}</span>
    </button>
  );
}

type ShellProps = {
  modeLabel: string;
  top?: ReactNode;
  seconds?: number;
  round: RankingRound;
  onLockIn: (placement: Placement) => void;
};

export function RankingShell({ modeLabel, top, seconds, round, onLockIn }: ShellProps) {
  const [placed, setPlaced] = useState<Placement>(() => round.slots.map(() => null));
  // The timer fires from a stale closure, so it reads the latest placement from here.
  const placedRef = useRef(placed);
  const [selected, setSelected] = useState<FighterId | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = useRef<{ id: FighterId; x: number; y: number; moved: boolean } | null>(null);

  // Puts `id` at `to`; a fighter already there goes where `id` came from.
  const move = (id: FighterId, to: Where) => {
    const next = [...placedRef.current];
    const from = next.indexOf(id);
    if (from >= 0) next[from] = null;
    if (to !== "side") {
      if (from >= 0) next[from] = next[to];
      next[to] = id;
    }
    placedRef.current = next;
    setPlaced(next);
    setSelected(null);
  };

  // Tap a fighter, then a rank (or a placed fighter, to swap).
  const tap = (id: FighterId) => {
    const at = placedRef.current.indexOf(id);
    if (selected && selected !== id && at >= 0) return move(selected, at);
    setSelected(selected === id ? null : id);
  };

  const handlersFor = (id: FighterId) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { id, x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      if (!s) return;
      const x = e.clientX - s.x;
      const y = e.clientY - s.y;
      if (!s.moved && Math.hypot(x, y) < DRAG_PX) return;
      s.moved = true;
      setDrag({ id, x, y, moved: true, over: whereAt(e.clientX, e.clientY) });
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      const s = start.current;
      start.current = null;
      setDrag(null);
      if (!s) return;
      if (!s.moved) return tap(id);
      const to = whereAt(e.clientX, e.clientY);
      if (to !== null) move(id, to);
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(null);
    },
    // The pointer already handled itself; only a keyboard press (Enter, Space: detail 0) acts on click.
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail === 0) tap(id);
    },
  });

  const chip = (f: Fighter, where: string) => (
    <Chip key={f.id} fighter={f} label={`${f.name}, ${where}`} selected={selected === f.id} drag={drag} {...handlersFor(f.id)} />
  );
  const waiting = round.order.filter((f) => !placed.includes(f.id));
  const highlight = (w: Where) => (drag?.over === w ? "border-text bg-line/40" : "border-line");

  return (
    <>
      <Header modeLabel={modeLabel} />
      {(top || seconds) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">{top}</div>
          {seconds && <Timer seconds={seconds} onExpire={() => onLockIn(placedRef.current)} />}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wide text-muted">Official UFC rankings</div>
        <h1 className="text-[26px] font-normal leading-[1.15] tracking-tight text-balance">
          Where do they rank at <span className="font-medium">{round.division}</span>?
        </h1>
      </div>
      <div className={`${panel} grid grid-cols-2 content-start gap-3`}>
        <ol aria-label={`${round.division} ranks`} className="flex flex-col gap-3">
          {round.slots.map((slot, i) => {
            const fighter = round.order.find((f) => f.id === placed[i]);
            return (
              <li key={slot.rank} data-drop={i} data-testid="rank-slot" className="flex items-center gap-2">
                <span className={rankLabel}>#{slot.rank}</span>
                <div className={`${dropZone} ${highlight(i)}`}>
                  {fighter ? (
                    chip(fighter, `placed at #${slot.rank}`)
                  ) : (
                    <button
                      type="button"
                      aria-label={`Place at #${slot.rank}`}
                      disabled={!selected}
                      onClick={() => selected && move(selected, i)}
                      className="h-12 w-full rounded-full text-xs text-muted focus-visible:outline-2 focus-visible:outline-text"
                    >
                      {selected ? "Place here" : ""}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div data-drop="side" aria-label="Fighters to place" className={`flex flex-col gap-3 rounded-lg border border-transparent ${drag?.over === "side" ? highlight("side") : ""}`}>
          {waiting.map((f) => chip(f, "not placed"))}
        </div>
        <p className="col-span-2 text-xs text-muted">Drag each fighter to their rank, or tap a fighter and then a rank.</p>
      </div>
      <button type="button" className={bigButton} onClick={() => onLockIn(placedRef.current)}>
        Lock in
      </button>
    </>
  );
}

type RevealProps = {
  modeLabel: string;
  top?: ReactNode;
  round: RankingRound;
  placement: Placement;
  score: number;
  hpLost?: number;
  nextLabel: string;
  onNext: () => void;
};

export function RankingReveal({ modeLabel, top, round, placement, score, hpLost, nextLabel, onNext }: RevealProps) {
  const right = correctCount(round, placement);
  const nameOf = (id: FighterId | null) => round.order.find((f) => f.id === id)?.name ?? "nobody";
  return (
    <>
      <Header modeLabel={modeLabel} top={top} />
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <div
              data-testid="score"
              className={`origin-bottom-left font-display text-[120px] font-extralight leading-[0.8] ${score === 100 ? "motion-safe:animate-pop" : ""}`}
              style={{ color: quality(score, "var(--quality-text)") }}
            >
              {score}
            </div>
            <div className="font-display text-[28px] font-light text-muted">/ 100</div>
          </div>
          <div className="text-right text-sm text-muted">
            {right} of {round.slots.length} right
            {hpLost !== undefined && <div className="text-text">−{hpLost.toFixed(1)} HP</div>}
          </div>
        </div>
        <div aria-hidden="true" className="h-1.5 rounded-full bg-line">
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: quality(score, "var(--quality-bar)") }} />
        </div>
      </div>
      <div className={panel}>
        <div className="text-xs uppercase tracking-wide text-muted">{round.division} rankings</div>
        <ol className="flex flex-col gap-3">
          {round.slots.map((slot, i) => {
            const ok = placement[i] === slot.fighter.id;
            return (
              <li key={slot.rank} data-testid="rank-answer" className="flex items-center gap-3">
                <span className={rankLabel}>#{slot.rank}</span>
                <Avatar fighter={slot.fighter} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-medium">{slot.fighter.name}</span>
                  {!ok && <span className="text-xs text-muted line-through">{nameOf(placement[i])}</span>}
                </div>
                <span aria-label={ok ? "Right" : "Wrong"} className={ok ? "text-truth" : "text-red"}>
                  {ok ? "✓" : "✗"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <button type="button" className={bigButton} onClick={onNext}>
        {nextLabel}
      </button>
    </>
  );
}
