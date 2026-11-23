import type { Fighter, FighterId } from "@/lib/engine/types";
import type { Division } from "@/lib/rankings";

// A ranking round: three fighters from one division's media rankings, dragged into their ranks.
export type RankingRound = {
  division: string;
  slots: { rank: number; fighter: Fighter }[]; // the answer, by rank
  order: Fighter[]; // as they are offered on the side
};
export type Placement = (FighterId | null)[]; // the fighter put in each slot, slot by slot

export const RANKING = "ranking"; // its place among metric ids, for "not twice in a row"
export const RANKING_SHARE = 0.25;
const SIZE = 3;

// About one round in four; never the first round (it opens with the slider) and never twice in a row.
// `last` is the previous round's metric id or RANKING, undefined at the start.
export function maybeRankingRound(rand: () => number, divisions: Division[], fighters: Fighter[], last?: string): RankingRound | null {
  if (last === undefined || last === RANKING || rand() >= RANKING_SHARE) return null;
  return randomRankingRound(rand, divisions, fighters);
}

// Weight classes only (a P4P list is not a division), fighters in `fighters` only, and no tied ranks: a tie
// would make two answers right. Null when no division has three such fighters.
export function randomRankingRound(rand: () => number, divisions: Division[], fighters: Fighter[]): RankingRound | null {
  const byId = new Map(fighters.map((f) => [f.id, f]));
  const options = divisions
    .filter((d) => !d.is_p4p)
    .map((d) => ({
      division: d.division,
      entries: d.ranked
        .filter((r) => r.id && byId.has(r.id) && d.ranked.filter((o) => o.rank === r.rank).length === 1)
        .map((r) => ({ rank: r.rank, fighter: byId.get(r.id!)! })),
    }))
    .filter((o) => o.entries.length >= SIZE);
  if (options.length === 0) return null;
  const { division, entries } = options[Math.floor(rand() * options.length)];
  const picked = shuffle(rand, entries).slice(0, SIZE);
  return {
    division,
    slots: [...picked].sort((a, b) => a.rank - b.rank),
    order: shuffle(rand, picked).map((e) => e.fighter),
  };
}

function shuffle<T>(rand: () => number, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const correctCount = (round: RankingRound, placement: Placement) =>
  round.slots.filter((s, i) => placement[i] === s.fighter.id).length;

// A share of 100, like a slider round: an unplaced fighter is wrong.
export const rankingScore = (round: RankingRound, placement: Placement) =>
  Math.round((100 * correctCount(round, placement)) / round.slots.length);
