"use client";

import { useEffect, useRef, useState } from "react";
import { HpBar } from "@/components/HpBar";
import { RankingReveal, RankingShell } from "@/components/RankingRound";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { SurvivalResults } from "@/components/SurvivalResults";
import { correctCount, rankingScore, type Placement } from "@/lib/engine/ranking";
import { localDate } from "@/lib/engine/rounds";
import { dailyScore, SURVIVAL_HP, SURVIVAL_SECONDS, takeHit, takeRankingHit } from "@/lib/engine/scoring";
import { activeOnly } from "@/lib/prefs";
import { browserStorage, load, recordSurvival, save, type State } from "@/lib/storage";
import { useStorageSync } from "@/lib/storage/useStorageSync";
import { nextTurn, turnKey, type Turn } from "@/lib/turns";

type Result = { guess: number; placement: Placement; score: number; lost: number };

export default function SurvivalPage() {
  const [state, setState] = useState<State | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState({ n: 1, hp: SURVIVAL_HP });
  const [results, setResults] = useState(false);
  const locked = useRef(false); // a tap and a timer expiry in one tick must not score twice

  const active = activeOnly.useValue();

  function pick(date: string, last?: string) {
    setTurn(nextTurn(date, last));
    setResult(null);
    locked.current = false;
  }

  useStorageSync(setState);

  // The date, storage and Math.random exist only after mount.
  useEffect(() => {
    const date = localDate(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(date);
    setState(load(browserStorage()));
    pick(date);
  }, []);

  if (!state || !today || !turn) return <Header modeLabel="Survival" />;

  const dead = result !== null && run.hp === 0;
  const modeLabel = `Round ${run.n}${active ? " · Active" : ""}`;

  if (results && result) {
    const fatal =
      turn.kind === "ranking"
        ? { division: turn.round.division, right: correctCount(turn.round, result.placement), of: turn.round.slots.length, lost: result.lost }
        : { metric: turn.play.metric, target: turn.play.target, guess: result.guess, actual: turn.play.actual, lost: result.lost };
    return (
      <SurvivalResults
        survived={run.n - 1}
        best={state.survival.best}
        fatal={fatal}
        onPlayAgain={() => {
          setRun({ n: 1, hp: SURVIVAL_HP });
          setResults(false);
          pick(today, turnKey(turn));
        }}
      />
    );
  }

  if (result) {
    const reveal = {
      modeLabel,
      top: <HpBar hp={run.hp} />,
      score: result.score,
      hpLost: result.lost,
      nextLabel: dead ? "See results" : "Next round",
      onNext: () => {
        if (dead) return setResults(true);
        setRun({ ...run, n: run.n + 1 });
        pick(today, turnKey(turn));
      },
    };
    return turn.kind === "ranking" ? (
      <RankingReveal {...reveal} round={turn.round} placement={result.placement} />
    ) : (
      <Reveal {...reveal} {...turn.play} guess={result.guess} />
    );
  }

  // Scores the round and takes the HP; a slider guess or a placement, once.
  function lockIn(score: number, hit: { hp: number; lost: number }, guess: number, placement: Placement) {
    if (!state || locked.current) return;
    locked.current = true;
    if (hit.hp === 0) {
      // Save before the fatal Reveal so a closed tab still counts the run.
      const next = recordSurvival(state, run.n - 1);
      save(next, browserStorage());
      setState(next);
    }
    setRun({ ...run, hp: hit.hp });
    setResult({ guess, placement, score, lost: hit.lost });
  }

  const shell = { modeLabel, top: <HpBar hp={run.hp} />, seconds: SURVIVAL_SECONDS };
  if (turn.kind === "ranking") {
    const round = turn.round;
    return (
      <RankingShell
        key={run.n}
        {...shell}
        round={round}
        onLockIn={(placement) => {
          const score = rankingScore(round, placement);
          lockIn(score, takeRankingHit(run.hp, score), 0, placement);
        }}
      />
    );
  }

  const play = turn.play;
  return (
    <RoundShell
      key={run.n}
      {...shell}
      {...play}
      onLockIn={(guess) => lockIn(dailyScore(play.metric, guess, play.actual), takeHit(run.hp, play.metric, guess, play.actual), guess, [])}
    />
  );
}
