"use client";

import { useEffect, useState } from "react";
import { Results } from "@/components/Results";
import { Reveal } from "@/components/Reveal";
import { Header, RoundShell } from "@/components/RoundShell";
import { config } from "@/lib/config";
import { fighters, metrics } from "@/lib/engine/data";
import { actualValue, dailySet, localDate, puzzleNumber, repairRounds } from "@/lib/engine/rounds";
import { dailyScore } from "@/lib/engine/scoring";
import { browserStorage, load, recordGuess, save, startDay, type State } from "@/lib/storage";

type Shown = { i: number; guess: number; score: number };

export default function DailyPage() {
  const [today, setToday] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  // The date and storage exist only after mount.
  useEffect(() => {
    const date = localDate(new Date());
    let s = load(browserStorage());
    const saved = s.daily.days[date];
    if (!saved) {
      s = startDay(s, date, dailySet(date, fighters, metrics));
      save(s, browserStorage());
    } else {
      const rounds = repairRounds(saved.rounds, saved.guesses.length, date, fighters, metrics);
      if (rounds !== saved.rounds) {
        s = { ...s, daily: { ...s.daily, days: { ...s.daily.days, [date]: { ...saved, rounds } } } };
        save(s, browserStorage());
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(date);
    setState(s);
  }, []);

  const day = today && state ? state.daily.days[today] : null;
  if (!today || !state || !day) return <Header modeLabel="DAILY" />;

  const puzzle = puzzleNumber(today, config.launchDate);
  if (day.done && !shown) return <Results puzzle={puzzle} day={day} state={state} today={today} />;

  const i = shown ? shown.i : day.guesses.length;
  const round = day.rounds[i];
  const metric = metrics.find((m) => m.id === round.metric)!;
  const refFighter = fighters.find((f) => f.id === round.ref)!;
  const target = fighters.find((f) => f.id === round.target)!;
  const play = {
    metric,
    refFighter,
    target,
    refValue: actualValue(refFighter, metric.id, today),
    actual: actualValue(target, metric.id, today),
  };

  const played = day.guesses.length;
  const pip = (n: number) => (n < played ? "bg-text" : n === played ? "bg-red" : "bg-line");
  const top = (
    <div className="flex items-center justify-between">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((n) => (
          <div key={n} className={`h-1.5 w-6 rounded-full ${pip(n)}`} />
        ))}
      </div>
      <div className="text-xs text-muted">Score {day.scores.reduce((a, b) => a + b, 0)}</div>
    </div>
  );
  const modeLabel = `DAILY · ROUND ${i + 1} / 5`;

  if (shown) {
    return (
      <Reveal
        modeLabel={modeLabel}
        top={top}
        {...play}
        guess={shown.guess}
        score={shown.score}
        nextLabel={day.done ? "SEE RESULTS" : "NEXT ROUND"}
        onNext={() => setShown(null)}
      />
    );
  }

  return (
    <RoundShell
      key={i}
      modeLabel={modeLabel}
      top={top}
      {...play}
      onLockIn={(guess) => {
        const score = dailyScore(metric, guess, play.actual);
        const next = recordGuess(state, today, guess, score);
        save(next, browserStorage());
        setState(next);
        setShown({ i, guess, score });
      }}
    />
  );
}
