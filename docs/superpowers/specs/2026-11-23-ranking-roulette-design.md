# Ranking Roulette — design

## Intent

A fourth mode beside Daily, Infinite and Survival, cleared in one sitting. A board shows all 13 media-ranked
lists. The player picks one, orders its fighters on a second screen and locks in. All right: back to the board
with that list checked off, then pick the next. Any mistake ends the run. Clearing all 13 wins.

## Rules (the user's)

- Lists: the 13 in `web/data/rankings.json` (11 weight classes, men's and women's pound-for-pound).
- Slots, labelled **Champ, #1 … #15**. A weight class has a Champ slot plus its 15 ranked fighters (16 slots);
  a vacant belt has no Champ slot. On a P4P list the "champion" is the #1 fighter, so it has #1–#15 only (15).
- Ties (two fighters sharing a rank) count as right in either order.
- Fighters missing from our data (5 today) appear by name with the placeholder photo.
- Lock in, all right: the list is cleared and the player returns to the board.
- Lock in, anything wrong: the run ends. The list stays up with each slot outlined green (right) or red (wrong),
  the count ("11 of 16 right"), and a **Restart roulette** button that clears the whole board.
- One sitting: nothing is saved between visits.

## Approaches

1. Reuse the ranking round's drag code, animate with React's built-in `<ViewTransition>`. No new dependency.
2. **Chosen by the user:** the `motion` library (`motion/react`). Its `Reorder` list does drag-to-reorder and
   moves the other rows aside; its layout animations and `AnimatePresence` cover the rest. Costs a dependency
   (~40 KB).
3. Two real URLs with the run in browser storage. Back button for free, more moving parts, experimental page
   transitions in Next.

## Design

- **Route:** `/roulette`, one page with screens: board, division, run over, all cleared. State lives in the page
  (cleared lists, the open list, the dealt order), so a reload starts a new run.
- **Home:** a fourth big link, "Roulette", under Survival.
- **Board:** 13 cards in rank-list order, each with the list name, its fighter count and a check mark once
  cleared. Cleared cards cannot be opened again. A counter: "4 of 13 cleared".
- **Division screen:** the fighters are dealt into the slots in a random order (every slot always filled, so lock
  in works at any time). Each row: slot label, photo, name, a drag handle (≡). Drag a row by its handle to move it;
  the rows between slide aside. Only the handle starts a drag, so a phone can still scroll the 16-row list.
  Tap (or Enter on) one row then another to swap them, for keyboard and for people who prefer taps.
  "← Board" goes back without locking in, and the list stays unsolved.
- **Checking:** a slot is right when the fighter in it has that slot's rank (the champion's rank is 0). That makes
  ties right in either order for free.
- **Animations** (all through `motion`, and switched off for people who ask for reduced motion):
  rows sliding while dragging or swapping; the screen change between board and division (the chosen card grows
  into the division heading); on a clear, the card's check mark pops in and the counter ticks; the run-over and
  all-cleared screens fade and rise in.
- **All cleared:** "13 of 13 cleared" with a Restart roulette button (builder's call).
- **Deal:** never deals a list already in the right order (builder's call; a redeal, only matters for ties-heavy luck).
- **Engine:** `web/lib/engine/roulette.ts`, pure and tested: the slots of a list, a dealt order, and the count
  of right slots.

## Non-goals

- No best score, streak or history saved (one sitting).
- No timer, no hints, no partial credit.
- No change to the existing modes or the active-only setting.

## Left to the builder

Exact styling within the site's look (fonts, colours, spacing of existing pages), animation timings, and
copy on the run-over and all-cleared screens.
