"use client";

import { useEffect, useRef, useState } from "react";
import { HpBar } from "@/components/HpBar";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { SurvivalResults } from "@/components/SurvivalResults";
import { fighters, metrics } from "@/lib/engine/data";
import { actualValue, localDate, randomRound } from "@/lib/engine/rounds";
import { dailyScore, SURVIVAL_HP, SURVIVAL_SECONDS, takeHit } from "@/lib/engine/scoring";
import type { Fighter, Metric } from "@/lib/engine/types";
import { browserStorage, load, recordSurvival, save, type State } from "@/lib/storage";

type Play = { metric: Metric; refFighter: Fighter; target: Fighter; refValue: number; actual: number };
type Result = { guess: number; score: number; lost: number };

export default function SurvivalPage() {
  const [state, setState] = useState<State | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [play, setPlay] = useState<Play | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [run, setRun] = useState({ n: 1, hp: SURVIVAL_HP });
  const [results, setResults] = useState(false);
  const locked = useRef(false); // a tap and a timer expiry in one tick must not score twice

  function pick(date: string, avoid?: string) {
    const r = randomRound(Math.random, fighters, metrics, avoid);
    const metric = metrics.find((m) => m.id === r.metric)!;
    const refFighter = fighters.find((f) => f.id === r.ref)!;
    const target = fighters.find((f) => f.id === r.target)!;
    setPlay({ metric, refFighter, target, refValue: actualValue(refFighter, metric.id, date), actual: actualValue(target, metric.id, date) });
    setResult(null);
    locked.current = false;
  }

  // The date, storage and Math.random exist only after mount.
  useEffect(() => {
    const date = localDate(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(date);
    setState(load(browserStorage()));
    pick(date);
  }, []);

  if (!state || !today || !play) return <Header modeLabel="SURVIVAL" />;

  const dead = result !== null && run.hp === 0;
  const modeLabel = `SURVIVAL · ROUND ${run.n}`;

  if (results && result) {
    return (
      <SurvivalResults
        survived={run.n - 1}
        best={state.survival.best}
        fatal={{ metric: play.metric, target: play.target, guess: result.guess, actual: play.actual, lost: result.lost }}
        onPlayAgain={() => {
          setRun({ n: 1, hp: SURVIVAL_HP });
          setResults(false);
          pick(today, play.metric.id);
        }}
      />
    );
  }

  if (result) {
    return (
      <Reveal
        modeLabel={modeLabel}
        top={<HpBar hp={run.hp} />}
        {...play}
        {...result}
        hpLost={result.lost}
        nextLabel={dead ? "SEE RESULTS" : "NEXT ROUND"}
        onNext={() => {
          if (dead) return setResults(true);
          setRun({ ...run, n: run.n + 1 });
          pick(today, play.metric.id);
        }}
      />
    );
  }

  return (
    <RoundShell
      key={run.n}
      modeLabel={modeLabel}
      top={<HpBar hp={run.hp} />}
      seconds={SURVIVAL_SECONDS}
      {...play}
      onLockIn={(guess) => {
        if (locked.current) return;
        locked.current = true;
        const score = dailyScore(play.metric, guess, play.actual);
        const { hp, lost } = takeHit(run.hp, play.metric, guess, play.actual);
        if (hp === 0) {
          // Save before the fatal Reveal so a closed tab still counts the run.
          const next = recordSurvival(state, run.n - 1);
          save(next, browserStorage());
          setState(next);
        }
        setRun({ ...run, hp });
        setResult({ guess, score, lost });
      }}
    />
  );
}
