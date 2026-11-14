"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { fighters, metrics } from "@/lib/engine/data";
import { actualValue, localDate, randomRound } from "@/lib/engine/rounds";
import { dailyScore } from "@/lib/engine/scoring";
import type { Fighter, Metric } from "@/lib/engine/types";

type Play = { metric: Metric; refFighter: Fighter; target: Fighter; refValue: number; actual: number };
type Result = { guess: number; score: number };

function newRound(avoid?: string): Play {
  const r = randomRound(Math.random, fighters, metrics, avoid);
  const metric = metrics.find((m) => m.id === r.metric)!;
  const refFighter = fighters.find((f) => f.id === r.ref)!;
  const target = fighters.find((f) => f.id === r.target)!;
  const today = localDate(new Date());
  return { metric, refFighter, target, refValue: actualValue(refFighter, metric.id, today), actual: actualValue(target, metric.id, today) };
}

export default function InfinitePage() {
  const [play, setPlay] = useState<Play | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [session, setSession] = useState({ n: 0, total: 0 });

  // Math.random exists only after mount, so the first round is picked here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlay(newRound());
  }, []);

  if (!play) return <Header modeLabel="Infinite" />;

  const modeLabel = `Round ${session.n + 1}`;
  const top =
    session.n > 0 ? (
      <div className="text-xs text-muted">
        Average {Math.round(session.total / session.n)} over {session.n} {session.n === 1 ? "round" : "rounds"}
      </div>
    ) : undefined;

  if (result) {
    return (
      <Reveal
        modeLabel={modeLabel}
        top={top}
        {...play}
        {...result}
        nextLabel="Next round"
        onNext={() => {
          setSession({ n: session.n + 1, total: session.total + result.score });
          setPlay(newRound(play.metric.id));
          setResult(null);
        }}
      />
    );
  }

  return (
    <RoundShell
      key={session.n}
      modeLabel={modeLabel}
      top={top}
      {...play}
      onLockIn={(guess) => {
        setResult({ guess, score: dailyScore(play.metric, guess, play.actual) });
      }}
    />
  );
}
