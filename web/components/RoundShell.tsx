"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Stage, startValue } from "@/components/stages";
import { Timer } from "@/components/Timer";
import { config } from "@/lib/config";
import { metricCopy } from "@/lib/copy";
import { fromFraction, nudge } from "@/lib/engine/scale";
import type { Fighter, Metric } from "@/lib/engine/types";
import { setFeet, useFeet, useFormat } from "@/lib/units";
import { useTween } from "@/lib/useTween";


export function Header({ modeLabel, top }: { modeLabel: string; top?: ReactNode }) {
  return (
    <>
      {/* pr-10 keeps the mode label clear of the theme toggle in the corner. */}
      <div className="flex items-center justify-between pr-10 text-[15px]">
        <Link href="/" className="flex min-h-11 items-center font-semibold">
          {config.name}
        </Link>
        <div className="text-muted">{modeLabel}</div>
      </div>
      {top}
    </>
  );
}

type RowsProps = { metric: Metric; refFighter: Fighter; target: Fighter; refValue: number };

// Switches height and reach between 6' 2" and 74 in; remembered in this browser.
function UnitToggle() {
  const feet = useFeet();
  const option = (on: boolean, label: string, name: string) => (
    <button
      type="button"
      aria-pressed={feet === on}
      aria-label={name}
      onClick={() => setFeet(on)}
      className={`flex min-h-11 items-center px-3 ${feet === on ? "font-medium text-text" : "text-muted"} focus-visible:outline-2 focus-visible:outline-text`}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Units" className="flex self-end text-sm">
      {option(true, "ft·in", "Feet and inches")}
      {option(false, "in", "Inches")}
    </div>
  );
}

export function FighterRows({ metric, refFighter, target, refValue }: RowsProps) {
  const format = useFormat();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar fighter={refFighter} corner="blue" />
        <div className="flex-1 text-[15px] text-muted">{refFighter.name}</div>
        <div data-testid="ref-value" className="font-display text-[28px] font-light text-blue">{format(metric, refValue)}</div>
      </div>
      <div className="flex items-center gap-3">
        <Avatar fighter={target} corner="red" />
        <div className="flex-1 text-[15px] font-medium">{target.name}</div>
      </div>
      {metric.unit === "in" && <UnitToggle />}
    </div>
  );
}

export const panel = "flex flex-1 flex-col gap-6 rounded-sm";
export const bigButton =
  "flex h-14 w-full items-center justify-center rounded-full bg-text text-[17px] font-medium text-bg active:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";
export const quietButton =
  "flex h-14 w-full items-center justify-center rounded-full border border-text text-[17px] font-medium active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

type Props = RowsProps & {
  modeLabel: string;
  top?: ReactNode;
  seconds?: number;
  onLockIn: (guess: number) => void;
};

// Holding − or +: one step at once, then after a beat a steady run (about 13 a second) until let go.
export const HOLD_DELAY_MS = 400;
export const HOLD_EVERY_MS = 75;

export function RoundShell({ modeLabel, top, seconds, metric, refFighter, target, refValue, onLockIn }: Props) {
  const [guess, setGuess] = useState(() => startValue(metric));
  // The timer fires from a stale closure, so it reads the latest estimate from here.
  const guessRef = useRef(guess);
  const change = (g: number) => {
    guessRef.current = g;
    setGuess(g);
  };
  const copy = metricCopy(metric, target.name);
  const format = useFormat();

  const repeat = useRef(0);
  const stopHold = () => {
    clearTimeout(repeat.current);
    clearInterval(repeat.current);
  };
  useEffect(() => stopHold, []); // a Survival timer can end the round mid-hold
  // Each nudge button carries its direction in data-dir; the handlers are shared.
  const dirOf = (e: { currentTarget: HTMLElement }) => Number(e.currentTarget.dataset.dir) as 1 | -1;
  const step = (dir: 1 | -1) => change(nudge(metric, guessRef.current, dir));
  const holdStart = (e: PointerEvent<HTMLButtonElement>) => {
    const dir = dirOf(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    stopHold();
    step(dir);
    repeat.current = window.setTimeout(() => (repeat.current = window.setInterval(() => step(dir), HOLD_EVERY_MS)), HOLD_DELAY_MS);
  };
  // The pointer already stepped; only a keyboard press (Enter, Space: detail 0) steps on click.
  const keyStep = (e: MouseEvent<HTMLButtonElement>) => e.detail === 0 && step(dirOf(e));
  const nudger = {
    onPointerDown: holdStart,
    onPointerUp: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
    onContextMenu: (e: MouseEvent) => e.preventDefault(), // a long press must not open a menu
    onClick: keyStep,
  };
  // The reference arrives first: it sweeps up from the bottom of the scale to the other fighter's value.
  const refShown = useTween(fromFraction(metric, 0), refValue, 700, 100);
  const stage = { metric, refValue: refShown, value: guess, onChange: change, refId: refFighter.id, targetId: target.id };
  const circle =
    "flex size-12 touch-none select-none items-center justify-center rounded-full border border-line text-text active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text";

  return (
    <>
      <Header modeLabel={modeLabel} />
      {(top || seconds) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">{top}</div>
          {seconds && <Timer seconds={seconds} onExpire={() => onLockIn(guessRef.current)} />}
        </div>
      )}
      <h1 className="text-[26px] font-normal leading-[1.15] tracking-tight text-balance">{copy.question}</h1>
      <div className={panel}>
        <Stage {...stage} />
        <FighterRows metric={metric} refFighter={refFighter} target={target} refValue={refValue} />
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Decrease" className={circle} data-dir="-1" {...nudger}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9 H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {/* The live estimate, between the nudges: it follows every drag, tap and key. The slider already speaks it. */}
        <div data-testid="guess-value" aria-hidden="true" className="min-w-28 text-center font-display text-[32px] font-light leading-none">
          {format(metric, guess)}
        </div>
        <button type="button" aria-label="Increase" className={circle} data-dir="1" {...nudger}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9 H15 M9 3 V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <button type="button" className={bigButton} onClick={() => onLockIn(guess)}>
        Lock in
      </button>
    </>
  );
}
