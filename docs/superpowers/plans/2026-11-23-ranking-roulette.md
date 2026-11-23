# Ranking Roulette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fourth mode, `/roulette`: clear all 13 media-ranked lists in one sitting; one wrong lock-in ends the run.

**Architecture:** A pure engine module (`lib/engine/roulette.ts`) builds slots, deals and checks; one client page
(`app/roulette/page.tsx`) holds the run in state and switches screens; `components/Roulette*.tsx` draw the board and
the division list with `motion` (`Reorder`, `layoutId`, `AnimatePresence`, `MotionConfig reducedMotion="user"`).

**Tech Stack:** Next.js 16 static export, React 19.3, Tailwind 4, `motion` 14 (`motion/react`), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-ranking-roulette-design.md`

## Global Constraints

- Slot labels exactly `Champ`, `#1` … `#15`. Weight class: Champ + 15 (16 slots); vacant belt: no Champ; P4P: `#1`–`#15` only.
- A slot is right when its fighter's rank equals the slot's rank (Champ = rank 0). Ties right in either order.
- Wrong lock-in copy: `{right} of {total} right`, and a button `Restart roulette`. No hint of which slots.
- All cleared: `13 of 13 cleared` and `Restart roulette`. Board counter: `{n} of 13 cleared`.
- Nothing saved to storage; reload = new run.
- Animations off under reduced motion (`MotionConfig reducedMotion="user"`).
- Existing modes unchanged; follow existing styles (`Header`, `bigButton`, `quietButton`, `panel` from `components/RoundShell.tsx`).

## Review Focus

1. A list with a tie (Flyweight, Women's Bantamweight today): either order clears it. → Task 1 test.
2. A fighter with `id: null`: shown by name with `/img/fallback.svg`, no crash. → Task 2 (uses `fighterImage(id ?? "", false)`).
3. A dealt order that is already right: never dealt. → Task 1 test.
4. Keyboard/tap only (no drag): tap two rows swaps them, so a list can be cleared without dragging. → Task 3 e2e.
5. Leaving a division with "← Board" then reopening it: it is dealt again and still unsolved. → Task 3 e2e.

---

### Task 1: Engine

**Files:**
- Create: `web/lib/engine/roulette.ts`
- Test: `web/lib/engine/roulette.test.ts`

**Interfaces:**
- Consumes: `Division`, `RankedFighter` from `web/lib/rankings.ts`.
- Produces:
  - `type Entry = RankedFighter & { rank: number }` (champion has rank 0)
  - `type Slot = { label: string; rank: number }`
  - `slotsOf(d: Division): Slot[]` — Champ first when a weight class has a champion; then each ranked entry's rank as `#n`, in list order (ties give two equal labels).
  - `entriesOf(d: Division): Entry[]` — the champion (rank 0, weight classes only) then `d.ranked`.
  - `deal(rand: () => number, d: Division): Entry[]` — a shuffle of `entriesOf(d)` that is never fully right.
  - `rightCount(d: Division, order: Entry[]): number` — slots whose entry's rank equals the slot's rank.
  - `entryKey(e: Entry): string` — `e.slug` (unique within a list; used as React key and Reorder value id).

- [ ] **Step 1: Write the failing tests** in `roulette.test.ts`, using small `Division` fixtures (as in `ranking.test.ts`):
  - weight class with champion → `slotsOf` labels `["Champ","#1","#2","#3"]`; `entriesOf` length 4, first rank 0.
  - vacant weight class (`champion: null`) → no `Champ`.
  - P4P (`is_p4p: true`, champion equals ranked #1) → labels start `#1`, length equals `ranked.length`.
  - tie `[[1,a],[2,b],[2,c],[4,d]]`: `rightCount` is 4 for both `a,b,c,d` and `a,c,b,d`; 2 for `a,d,c,b` (slots 1,2,2,4: a and c right).
  - `deal` with `rng("x")` over 200 seeds never returns a fully right order, and always returns a permutation of `entriesOf`.
  - every list in the real `rankings.divisions` gives 16 slots for a weight class with a champion, 15 otherwise.
- [ ] **Step 2:** `cd web && npx vitest run lib/engine/roulette.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the five exports. `deal`: Fisher–Yates with `rand`, redeal while `rightCount === entries.length` (lists of 1 cannot occur; ≥15 entries).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `Add the Ranking Roulette engine`.

### Task 2: Page, board and division screens with motion

**Files:**
- Modify: `web/package.json` (add `motion`)
- Create: `web/app/roulette/page.tsx`, `web/components/RouletteBoard.tsx`, `web/components/RouletteList.tsx`
- Modify: `web/components/HomeModes.tsx` (fourth link `Roulette` → `/roulette`, same `mode`/`word` classes)

**Interfaces:**
- Consumes: Task 1 exports; `rankings` from `lib/rankings.ts`; `fighters` from `lib/engine/data.ts` (to find `hasImage` by `id`); `fighterImage` from `lib/images`; `Header`, `bigButton`, `quietButton` from `components/RoundShell`.
- Produces:
  - `RouletteBoard({ cleared: Set<string>, onPick: (division: string) => void })` — 13 cards (`data-testid="division-card"`, a `<button>` named by division; cleared ones disabled, with a check mark `aria-label="Cleared"`), and the counter `{n} of 13 cleared`. Each card has `layoutId={`division-${name}`}`.
  - `RouletteList({ division: Division, onLockIn: (order: Entry[]) => void, onBack: () => void })` — heading with the same `layoutId` as its card; `Reorder.Group axis="y"` of `Reorder.Item`s (`data-testid="roulette-row"`), each: slot label, 44px round photo (grayscale, like `Avatar`), name, and a ≡ handle (`aria-hidden`) that starts the drag via `useDragControls` with `dragListener={false}`. The row body is a `<button>` (`aria-pressed` when selected) for tap-to-swap: tap one, tap another → swap. Buttons `← Board` and `Lock in`.
  - Page state: `cleared: Set<string>`, `open: Division | null`, `phase: "board" | "list" | "over" | "won"`, `last: { right: number; total: number } | null`. Lock in: `rightCount === total` → add to cleared, back to board (or `won` at 13); else `over`.
  - Wrap the page in `MotionConfig reducedMotion="user"` and the screens in `AnimatePresence mode="wait"`.

- [ ] **Step 1:** `cd web && npm install motion@14.14.0` → package.json and lock updated.
- [ ] **Step 2:** Build the three files and the home link as above. Copy: board heading `Ranking Roulette`, subtitle `Clear every division. One mistake ends the run.`; over screen `{right} of {total} right` + `Restart roulette`; won screen `13 of 13 cleared` + `Restart roulette`. Restart resets all state.
- [ ] **Step 3:** `npx tsc --noEmit` (ignore stale `.next/types`), `npx eslint .`, `npx vitest run` → clean / all pass.
- [ ] **Step 4:** Commit `Add the Ranking Roulette mode`.

### Task 3: End-to-end test and animations check

**Files:**
- Create: `web/e2e/roulette.spec.ts`
- Modify: `web/e2e/home.spec.ts` (expect the `Roulette` link)

- [ ] **Step 1: Write the tests** (reading the answer from `@/data/rankings.json` via a relative import):
  - `clearing a division by taps checks it off`: open `/roulette`, 13 `division-card`s; open `Lightweight`; arrange rows into the right order by tapping pairs (selection sort over `roulette-row` texts); `Lock in`; board shows `1 of 13 cleared` and the Lightweight card is disabled with `Cleared`.
  - `leaving a division keeps it unsolved`: open a list, `← Board`, counter still `0 of 13 cleared`, card enabled.
  - `a wrong order ends the run`: open a list, `Lock in` on the dealt (never right) order → text `/^\d+ of 1[56] right$/` and `Restart roulette`; click it → `0 of 13 cleared`.
  - `a drag moves a row`: mouse-drag row 0's handle below row 2 → row 0's name is now at index 2.
  - No console errors in any test.
- [ ] **Step 2:** `npx playwright test e2e/roulette.spec.ts e2e/home.spec.ts` → PASS (dev server on :3000 is reused).
- [ ] **Step 3:** Full suites: `npx vitest run`, `npx playwright test` → all pass. Look at the board, a list, a clear and the over screen in the browser at 390×844 and desktop.
- [ ] **Step 4:** Commit `Test Ranking Roulette end to end`.
