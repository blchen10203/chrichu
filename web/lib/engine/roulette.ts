import type { Division, RankedFighter } from "@/lib/rankings";

// Ranking Roulette: put a whole division's fighters into their media-ranked slots.
export type Entry = RankedFighter & { rank: number }; // the champion has rank 0
export type Slot = { label: string; rank: number };

// A P4P list's champion is its #1 fighter, who is already in `ranked`.
const hasChampion = (d: Division) => !d.is_p4p && d.champion !== null;

export function slotsOf(d: Division): Slot[] {
  const ranked = d.ranked.map((r) => ({ label: `#${r.rank}`, rank: r.rank }));
  return hasChampion(d) ? [{ label: "Champ", rank: 0 }, ...ranked] : ranked;
}

export function entriesOf(d: Division): Entry[] {
  return hasChampion(d) ? [{ ...d.champion!, rank: 0 }, ...d.ranked] : [...d.ranked];
}

// Slots whose entry has that slot's rank; tied fighters are right in either order.
export const rightCount = (d: Division, order: Entry[]) => slotsOf(d).filter((s, i) => order[i]?.rank === s.rank).length;

// Redeals a solved shuffle so the player always has something to do.
export function deal(rand: () => number, d: Division): Entry[] {
  const entries = entriesOf(d);
  const out = [...entries];
  do {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  } while (rightCount(d, out) === entries.length);
  return out;
}

export const entryKey = (e: Entry) => e.slug;
