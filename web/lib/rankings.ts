import rankingsJson from "@/data/rankings.json";
import type { FighterId } from "@/lib/engine/types";

// data/rankings.json, the media-voted UFC rankings written by pipeline/rankings.py.
export type RankedFighter = {
  name: string;
  slug: string; // ufc.com/athlete/<slug>
  id: FighterId | null; // our fighter, or null when they are not in data/fighters.json
};

export type Division = {
  division: string;
  is_p4p: boolean;
  champion: RankedFighter | null; // on a P4P list, the #1 fighter; null for a vacant belt
  ranked: (RankedFighter & { rank: number; change: string | null })[]; // change: "+2", "-1", "NR"
};

export type Rankings = {
  source: string;
  fetched_at: string; // ISO time
  last_updated: string | null; // as the page shows it, e.g. "Tuesday, Nov. 17"
  divisions: Division[];
};

export type FighterRank = { division: string; rank: number; isChampion: boolean }; // rank 0 for a champion

export const rankings = rankingsJson as Rankings;

// A weight-class belt first, then a weight-class rank, then a P4P rank.
export function getFighterRank(id: FighterId): FighterRank | null {
  const divisions = [...rankings.divisions.filter((d) => !d.is_p4p), ...rankings.divisions.filter((d) => d.is_p4p)];
  const champ = divisions.find((d) => !d.is_p4p && d.champion?.id === id);
  if (champ) return { division: champ.division, rank: 0, isChampion: true };
  for (const d of divisions) {
    const r = d.ranked.find((f) => f.id === id);
    if (r) return { division: d.division, rank: r.rank, isChampion: false };
  }
  return null;
}
