"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { fighters, metrics } from "@/lib/engine/data";
import { localDate, playOf, randomRound, type Play } from "@/lib/engine/rounds";
import { dailyScore } from "@/lib/engine/scoring";

type Result = { guess: number; score: number };

const newRound = (avoid?: string): Play =>
  playOf(randomRound(Math.random, fighters, metrics, avoid), localDate(new Date()), fighters, metrics);

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
