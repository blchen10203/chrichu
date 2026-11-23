import { fighters, metrics } from "@/lib/engine/data";
import { maybeRankingRound, RANKING, type RankingRound } from "@/lib/engine/ranking";
import { activeFighters, playOf, randomRound, type Play } from "@/lib/engine/rounds";
import { activeOnly } from "@/lib/prefs";
import { rankings } from "@/lib/rankings";

// One round of Infinite or Survival: a slider guess or a ranking round.
export type Turn = { kind: "metric"; play: Play } | { kind: "ranking"; round: RankingRound };

export const turnKey = (t: Turn) => (t.kind === "ranking" ? RANKING : t.play.metric.id);

// `last` is the previous turn's key, undefined for the first round.
export function nextTurn(date: string, last?: string): Turn {
  const pool = activeOnly.get() ? activeFighters(fighters) : fighters;
  const round = maybeRankingRound(Math.random, rankings.divisions, pool, last);
  if (round) return { kind: "ranking", round };
  return { kind: "metric", play: playOf(randomRound(Math.random, pool, metrics, last), date, fighters, metrics) };
}
