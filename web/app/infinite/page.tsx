"use client";

import { useEffect, useState } from "react";
import { RankingReveal, RankingShell } from "@/components/RankingRound";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { rankingScore, type Placement } from "@/lib/engine/ranking";
import { localDate } from "@/lib/engine/rounds";
import { dailyScore } from "@/lib/engine/scoring";
import { activeOnly } from "@/lib/prefs";
import { nextTurn, turnKey, type Turn } from "@/lib/turns";

type Result = { guess: number; placement: Placement; score: number };

export default function InfinitePage() {
  const [turn, setTurn] = useState<Turn | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [session, setSession] = useState({ n: 0, total: 0 });
  const active = activeOnly.useValue();

  // Math.random exists only after mount, so the first round is picked here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTurn(nextTurn(localDate(new Date())));
  }, []);

  if (!turn) return <Header modeLabel="Infinite" />;

  const modeLabel = `Round ${session.n + 1}${active ? " · Active" : ""}`;
  const top =
    session.n > 0 ? (
      <div className="text-xs text-muted">
        Average {Math.round(session.total / session.n)} over {session.n} {session.n === 1 ? "round" : "rounds"}
      </div>
    ) : undefined;

  if (result) {
    const onNext = () => {
      setSession({ n: session.n + 1, total: session.total + result.score });
      setTurn(nextTurn(localDate(new Date()), turnKey(turn)));
      setResult(null);
    };
    return turn.kind === "ranking" ? (
      <RankingReveal modeLabel={modeLabel} top={top} round={turn.round} {...result} nextLabel="Next round" onNext={onNext} />
    ) : (
      <Reveal modeLabel={modeLabel} top={top} {...turn.play} {...result} nextLabel="Next round" onNext={onNext} />
    );
  }

  if (turn.kind === "ranking") {
    return (
      <RankingShell
        key={session.n}
        modeLabel={modeLabel}
        top={top}
        round={turn.round}
        onLockIn={(placement) => setResult({ guess: 0, placement, score: rankingScore(turn.round, placement) })}
      />
    );
  }

  const play = turn.play;
  return (
    <RoundShell
      key={session.n}
      modeLabel={modeLabel}
      top={top}
      {...play}
      onLockIn={(guess) => {
        setResult({ guess, placement: [], score: dailyScore(play.metric, guess, play.actual) });
      }}
    />
  );
}
