# Reachdle Survival and Weekly Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Survival mode (10 HP, 15-second rounds, run ends at 0 HP), and make the weekly GitHub Action check the new data and commit it to `main` only when the checks pass.

**Architecture:** Survival is one more client page over the same engine and round components as Daily and Infinite. The only new rule (damage applied to HP) lives in the engine, and the run is saved the moment it ends. The data checks live in `pipeline/build.py`, so a hand run and the Action refuse bad data in the same way; the workflow only runs the build and commits what it wrote.

**Tech Stack:** Next.js 16 (static export), React 19, Tailwind 4, Vitest, Playwright (its `page.clock` for the timer); Python 3.13 with pytest; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-reachdle-design.md` (sections 6.2, 6.3, 7.3, 8, 9, 10, 11.3, 12, 14).

This is plan 4 of 4. Tasks 1 to 3 need screens plan (plan 3) Tasks 2 to 5 finished: they reuse `RoundShell`, `Reveal`, `ShareButton`, the home page and the Playwright setup. Tasks 4 and 5 touch only the pipeline and can run at any time. Spec 14 ships Survival after the first release, and switches the Action's schedule on only once a hand-run update has worked a few times (Task 5).

## Global Constraints

- Tasks 1 to 3: work in `web/` and run commands from `web/`. Task 4: run commands from the repo root. Commit directly to `main`.
- Everything in the screens plan's Global Constraints still applies: read the Next.js guide before the first Next.js change, static export only, never read the date, `localStorage` or `Math.random()` during render, no game rule in a component, keep state in React state as well as storage, colours, fonts, 44 px touch targets, 430 px column.
- Spec 7.3, verbatim: "Start at 10.0 HP. Each round has a 15 second timer." "At zero seconds the slider's current value is locked in." "The run ends when HP reaches 0." "Score is rounds survived. Unlimited attempts; rounds are random each run." "End screen: rounds survived, personal best, the round that ended the run, share button."
- Damage = the round's penalty from spec 6.2, shown to one decimal. Worked examples: reach, step 2, actual 84.5, guess 81.0 → 1.3 HP; log, step 0.15, actual 3,400, guess 1,700 → 1.5 HP.
- No metric twice in a row (spec 6.1): each round passes the previous round's metric to `randomRound` as `avoidMetric`.
- Survival share text (spec 10): `Reachdle Survival — 14 rounds` then the site address on the next line. Use `config.name` and `config.siteUrl`.
- Spec 11.3: the Action runs Tuesdays 10:00 UTC (`0 10 * * 2`). It commits to `main` only if validation passes. Validation fails when a roster fighter is missing from the CSVs, more than 15% of existing fighter-metric values changed, fewer than 150 fighters remain, or a shipped metric has fewer than 30 eligible fighters. A failed run fails the workflow. `build.py` already stops on the first and last of these; Task 4 adds the other two.

## Review Focus

Each line is pinned by a test in the task named.

1. HP must reach exactly 0 when the damage equals the HP left. Subtracting decimals (1.3 − 1.3) must not leave 0.0000001 and keep a dead run alive. (Task 1 unit test)
2. A phone that sleeps or switches apps mid-round must still lock in when the player comes back. The timer counts against a fixed deadline, not by counting ticks. (Task 2 end-to-end test, with `clock.fastForward`)
3. Once a round is locked in, the timer must never fire again. A timer expiring on the Reveal screen, or at the same moment as a Lock In tap, must not score the round twice. (Task 2 end-to-end test)
4. Closing the tab on the fatal Reveal must still count the run and the personal best. (Task 2 end-to-end test reads storage before the results screen)
5. The owner removing fighters from the roster or metrics from `shipped.json` must not trip the 15% guard. Only values that exist in both builds count. (Task 4 pytest)

## File Structure

| File | Responsibility |
|---|---|
| `web/lib/engine/scoring.ts` (+ test) | Survival constants and `takeHit`. |
| `web/lib/engine/balance.test.ts` | The spec 12 Survival balance check. |
| `web/lib/engine/share.ts` (+ test) | `survivalShareText`. |
| `web/lib/storage/index.ts` (+ test) | `recordSurvival`. |
| `web/components/HpBar.tsx`, `Timer.tsx` | Replace the stubs. |
| `web/components/RoundShell.tsx`, `Reveal.tsx` | Optional timer; optional HP lost line. |
| `web/components/SurvivalResults.tsx` | The end screen. New. |
| `web/app/survival/page.tsx` | The mode. |
| `web/e2e/survival.spec.ts` | End-to-end tests. New. |
| `web/app/page.tsx`, `web/components/Results.tsx`, `web/app/how-to-play/page.tsx`, `web/e2e/home.spec.ts` | Link Survival in. |
| `pipeline/build.py`, `pipeline/tests/test_build.py` | `validate` and its call in `main`. |
| `.github/workflows/update-data.yml` | Commit the data; schedule. |

---

### Task 1: Survival rules in the engine and storage

**Files:**
- Modify: `web/lib/engine/scoring.ts`, `web/lib/engine/scoring.test.ts`, `web/lib/engine/balance.test.ts`, `web/lib/engine/share.ts`, `web/lib/engine/share.test.ts`, `web/lib/storage/index.ts`, `web/lib/storage/index.test.ts`

**Interfaces:**
- Produces:
  - `SURVIVAL_HP = 10`, `SURVIVAL_SECONDS = 15` in `@/lib/engine/scoring`, beside `FREE_ZONE` (spec 6.3 tunable constants).
  - `takeHit(hp: number, metric: Metric, guess: number, actual: number): { hp: number; lost: number }` in `@/lib/engine/scoring`.
  - `survivalShareText(name: string, rounds: number, siteUrl: string): string` in `@/lib/engine/share`.
  - `recordSurvival(state: State, survived: number): State` in `@/lib/storage`.

- [ ] **Step 1: Write the failing tests**

In `scoring.test.ts`, using the existing `reach` and `strikes` fixtures:
```ts
describe("takeHit", () => {
  it("matches the spec's worked examples, to one decimal", () => {
    expect(takeHit(10, reach, 81, 84.5)).toEqual({ hp: 8.7, lost: 1.3 });
    expect(takeHit(10, strikes, 1700, 3400)).toEqual({ hp: 8.5, lost: 1.5 });
  });
  it("costs nothing inside the free zone", () => {
    expect(takeHit(10, reach, 85.5, 84.5)).toEqual({ hp: 10, lost: 0 });
  });
  it("reaches exactly zero, with no rounding residue", () => {
    expect(takeHit(1.3, reach, 81, 84.5)).toEqual({ hp: 0, lost: 1.3 });
    let hp = 10;
    for (let i = 0; i < 7; i++) hp = takeHit(hp, reach, 81, 84.5).hp;
    expect(hp).toBe(0.9);
  });
  it("never loses more than the HP left", () => {
    expect(takeHit(0.5, reach, 60, 84.5)).toEqual({ hp: 0, lost: 0.5 });
    expect(takeHit(2, strikes, 0, 3400)).toEqual({ hp: 0, lost: 2 }); // infinite penalty
  });
});
```

In `share.test.ts`:
```ts
it("writes the Survival share text", () => {
  expect(survivalShareText("Reachdle", 14, "https://reachdle.vercel.app"))
    .toBe("Reachdle Survival — 14 rounds\nhttps://reachdle.vercel.app");
  expect(survivalShareText("Reachdle", 1, "https://x")).toBe("Reachdle Survival — 1 round\nhttps://x");
});
```

In `storage/index.test.ts`:
```ts
describe("survival", () => {
  it("counts the run and keeps the best", () => {
    let s = recordSurvival(emptyState(), 6);
    s = recordSurvival(s, 4);
    expect(s.survival).toEqual({ best: 6, runs: 2 });
    expect(recordSurvival(s, 9).survival).toEqual({ best: 9, runs: 3 });
  });
  it("ignores a non-finite or negative count", () => {
    const s = emptyState();
    expect(recordSurvival(s, NaN)).toBe(s);
    expect(recordSurvival(s, -1)).toBe(s);
  });
});
```

In `balance.test.ts` (spec 12: the median bot survives fewer than 12 rounds on average), adding imports for `rng`, `randomRound`, `takeHit` and `SURVIVAL_HP`:
```ts
it("a player who always guesses the median survives fewer than 12 rounds on average", () => {
  const median = (id: string) => {
    const v = fighters.filter((f) => id in f.metrics).map((f) => f.metrics[id]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const rand = rng("survival-balance");
  const RUNS = 500;
  let total = 0;
  for (let run = 0; run < RUNS; run++) {
    let hp = SURVIVAL_HP;
    let last: string | undefined;
    for (;;) {
      const round = randomRound(rand, fighters, metrics, last);
      last = round.metric;
      const metric = metrics.find((m) => m.id === round.metric)!;
      const target = fighters.find((f) => f.id === round.target)!;
      hp = takeHit(hp, metric, median(metric.id), target.metrics[metric.id]).hp;
      if (hp === 0) break;
      total++;
    }
  }
  expect(total / RUNS).toBeLessThan(12);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL, `takeHit`, `survivalShareText` and `recordSurvival` are not exported.

- [ ] **Step 3: Implement**

- `takeHit`: `lost` is `penalty(...)` rounded to one decimal, capped at `hp`; the new HP is `hp − lost`, rounded to one decimal so it lands exactly on 0. An infinite penalty loses all the HP left.
- `survivalShareText`: `{name} Survival — {n} round` or `rounds`, a newline, then `siteUrl`.
- `recordSurvival`: returns `state` unchanged for a non-finite or negative `survived`. Otherwise `runs + 1` and `best = max(best, survived)`.

- [ ] **Step 4: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass. If only the balance test fails, stop and tell the owner: spec 6.3 says the constants then need tuning, which is the owner's call.

- [ ] **Step 5: Commit**

```bash
git add web/lib
git commit -m "Add Survival damage, share text and saved runs"
```

---

### Task 2: The Survival mode

**Files:**
- Modify: `web/components/HpBar.tsx`, `web/components/Timer.tsx`, `web/components/RoundShell.tsx`, `web/components/Reveal.tsx`, `web/app/survival/page.tsx`
- Create: `web/components/SurvivalResults.tsx`, `web/e2e/survival.spec.ts`

**Interfaces:**
- Consumes: Task 1; screens plan `RoundShell`, `Reveal`, `ShareButton({ text })`, `metricCopy`.
- Produces:
  - `HpBar({ hp }: { hp: number })` and `Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void })`, as named exports in place of the stubs' default exports.
  - `RoundShell` gains `seconds?: number`. `Reveal` gains `hpLost?: number`, and its `Your estimate` value gets `data-testid="your-estimate"`.
  - `SurvivalResults({ survived: number; best: number; fatal: { metric: Metric; target: Fighter; guess: number; actual: number; lost: number }; onPlayAgain: () => void })`.

- [ ] **Step 1: Write the failing tests** (`web/e2e/survival.spec.ts`)

```ts
import { expect, test } from "@playwright/test";

test("the timer locks in the current estimate, even after the phone slept", async ({ page }) => {
  await page.clock.install();
  await page.goto("/survival");
  await expect(page.getByText("SURVIVAL · ROUND 1")).toBeVisible();
  await expect(page.getByText("10.0 HP")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(/^\d+s$/);

  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  const estimate = await slider.getAttribute("aria-valuetext");

  await page.clock.fastForward(20_000); // one jump, no ticks in between
  await expect(page.getByText("/ 100")).toBeVisible();
  await expect(page.getByTestId("your-estimate")).toHaveText(estimate!);
  await expect(page.getByText(/^−\d+\.\d HP$/)).toBeVisible();

  await page.clock.fastForward(30_000); // the timer is gone: the Reveal waits
  await expect(page.getByText("SURVIVAL · ROUND 1")).toBeVisible();
  await expect(page.getByRole("button", { name: /Next round|See results/ })).toBeVisible();
});

test("a run ends, is saved at once, and can be played again", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/survival");
  for (let round = 1; round <= 60; round++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await expect(page.getByText("/ 100")).toBeVisible();
    if (await page.getByRole("button", { name: "See results" }).isVisible()) break;
    await page.getByRole("button", { name: "Next round" }).click();
  }
  await expect(page.getByText("0.0 HP", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("reachdle:v1")!).survival);
  expect(saved.runs).toBe(1); // saved before the results screen

  await page.getByRole("button", { name: "See results" }).click();
  const survived = Number(await page.getByTestId("survival-total").textContent());
  expect(saved.best).toBe(survived);
  await expect(page.getByText("Ended by")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share result" })).toBeVisible();

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByText("SURVIVAL · ROUND 1")).toBeVisible();
  await expect(page.getByText("10.0 HP")).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run e2e -- survival`
Expected: FAIL, "SURVIVAL · ROUND 1" not found.

- [ ] **Step 3: Implement `HpBar` and `Timer`**

- `HpBar`: a track in the line colour with a red fill `hp / SURVIVAL_HP` wide, and the label `{hp.toFixed(1)} HP` in the display font. The track has `role="meter"`, `aria-label="HP"`, `aria-valuemin={0}`, `aria-valuemax={SURVIVAL_HP}`, `aria-valuenow={hp}`.
- `Timer`: shows `{n}s`, where `n` is the whole seconds left rounded up; it turns red at 5 or less. It has `role="timer"` and `aria-label="Time left"`, and no live region (a spoken count every second is noise). Before mount it shows `{seconds}s`. In an effect on mount, fix `deadline = Date.now() + seconds * 1000` and check it every 250 ms. When `Date.now() >= deadline`, clear the interval and call `onExpire` once. Keep `onExpire` in a ref so a parent re-render never restarts the count. Clear the interval on unmount.

- [ ] **Step 4: Extend `RoundShell` and `Reveal`**

- `RoundShell`: keep the current estimate in a ref as well as state. When `seconds` is set, render `Timer` right-aligned in the same row as `top`, with `onExpire` calling `onLockIn` with the ref's value. The timer unmounts with the shell, so it cannot fire after Lock In.
- `Reveal`: when `hpLost` is set, show `−{hpLost.toFixed(1)} HP` in red under the `Off by` lines (spec 8: "Survival shows HP lost"). Add `data-testid="your-estimate"` to the value in the `Your estimate` box.

- [ ] **Step 5: Implement the Survival page and `SurvivalResults`** (spec 7.3)

The page is a client component. Before mount, render only the header row. After mount, `state = load(browserStorage())` and `today = localDate(new Date())`. Then start a run: HP `SURVIVAL_HP`, round number 1, and `randomRound(Math.random, fighters, metrics, lastMetric)`.

- Round: `RoundShell` with a `key` per round, mode label `SURVIVAL · ROUND {n}`, `top={<HpBar hp={hp} />}` and `seconds={SURVIVAL_SECONDS}`.
- Lock In: ignore it unless a round is showing. This guard stops a tap and a timer expiry from scoring the same round twice. Then:
  - `actual = actualValue(target, metric.id, today)`, `score = dailyScore(...)` and `{ hp, lost } = takeHit(...)`.
  - If the new HP is 0, the run is over and has survived `n − 1` rounds. Apply `recordSurvival(state, n − 1)` and `save` **now**, before showing the Reveal.
  - Show `Reveal` with `top={<HpBar hp={newHp} />}` and `hpLost={lost}`. Its `nextLabel` is `NEXT ROUND`, or `SEE RESULTS` when HP is 0.
- Next round: `n + 1`, with a new random round that avoids the last metric.
- See results: `SurvivalResults`, with `best` from the state saved above and `fatal` set to the last round's values. `onPlayAgain` starts a new run, still avoiding the last metric.

`SurvivalResults`, top to bottom:
1. The header row with a pill reading `SURVIVAL · OVER`.
2. `ROUNDS SURVIVED` in red small caps, then the count in very large display type with `data-testid="survival-total"`.
3. A stat box headed `Your best`.
4. A panel headed `Ended by`. It shows `{short label} · {target name}` from `metricCopy`, then `You said {formatValue(guess)} · Actual {formatValue(actual)}`, then `−{lost.toFixed(1)} HP` in red.
5. `ShareButton` with `survivalShareText(config.name, survived, config.siteUrl)`.
6. A full-width `PLAY AGAIN` button with `aria-label="Play again"`, and a link home.

- [ ] **Step 6: Verify**

Run: `npm run e2e && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass, with the build listing the same 6 routes.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "Add Survival mode"
```

---

### Task 3: Link Survival into the site

**Files:**
- Modify: `web/app/page.tsx`, `web/components/Results.tsx`, `web/app/how-to-play/page.tsx`, `web/e2e/home.spec.ts`

- [ ] **Step 1: Change the home test** (`web/e2e/home.spec.ts`)

Replace `await expect(page.getByRole("link", { name: /Survival/ })).toHaveCount(0);` with:
```ts
  await expect(page.getByRole("link", { name: /Survival/ })).toBeVisible();
```
and add at the end of the test:
```ts
  await page.goto("/");
  await page.getByRole("link", { name: /Survival/ }).click();
  await expect(page.getByText("SURVIVAL · ROUND 1")).toBeVisible();
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run e2e -- home`
Expected: FAIL, the Survival link is not found.

- [ ] **Step 3: Implement**

- Home: the Survival card becomes a link to `/survival` like the other two, with the sub-line `10 HP. 15 seconds a round.`
- `Results`: add a `Play Survival` link to `/survival` beside `Play Infinite` (spec 8: "links to the other modes").
- How to Play, item 4 becomes: `Daily is the same 5 rounds for everyone, once a day. Infinite never ends and does not count. Survival gives you 10 HP and 15 seconds a round; misses cost HP, and the run ends at zero.`

- [ ] **Step 4: Verify**

Run: `npm run e2e && npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "Link Survival from home, results and How to Play"
```

---

### Task 4: Check the data before it is written, and commit it from the Action

**Files:**
- Modify: `pipeline/build.py`, `pipeline/tests/test_build.py`, `.github/workflows/update-data.yml`

**Interfaces:**
- Produces: `MIN_FIGHTERS = 150`, `MAX_CHANGED = 0.15` and `validate(old: list | None, new: list, shipped: dict) -> None` in `build.py`. It raises `BuildError`.

- [ ] **Step 1: Write the failing tests** (append to `pipeline/tests/test_build.py`)

```python
def roster_of(n):
    return [{"id": f"f{i}", "metrics": {"height": 70.0, "reach": 72.0}} for i in range(n)]


def test_too_few_fighters_stops():
    with pytest.raises(build.BuildError, match="149 fighters, need 150"):
        build.validate(None, roster_of(149), SHIP)


def test_first_build_has_nothing_to_compare():
    build.validate(None, roster_of(150), SHIP)


def test_up_to_15_percent_changed_passes():
    new = roster_of(150)
    for f in new[:45]:            # 45 of 300 values
        f["metrics"]["height"] = 71.0
    build.validate(roster_of(150), new, SHIP)


def test_more_than_15_percent_changed_stops():
    new = roster_of(150)
    for f in new[:46]:
        f["metrics"]["height"] = 71.0
    with pytest.raises(build.BuildError, match=r"15\.3% of values changed"):
        build.validate(roster_of(150), new, SHIP)


def test_a_lost_value_counts_as_changed():
    new = roster_of(150)
    for f in new[:46]:
        del f["metrics"]["reach"]
    with pytest.raises(build.BuildError, match="changed"):
        build.validate(roster_of(150), new, SHIP)


def test_roster_and_shipped_edits_do_not_count():
    old = roster_of(200)          # 50 fighters since removed from the roster
    for f in old:
        f["metrics"]["slpm"] = 4.0  # a metric since removed from shipped.json
    build.validate(old, roster_of(150), SHIP)


def test_main_keeps_the_old_data_when_too_much_changed(tmp_path, monkeypatch, capsys):
    (tmp_path / "pipeline").mkdir()
    (tmp_path / "web" / "data").mkdir(parents=True)
    (tmp_path / "pipeline" / "roster.csv").write_text(
        "name,ufcstats_id,ufc_slug,deceased\nA One,aaaa,a-one,0\nB Two,bbbb,b-two,0\n")
    (tmp_path / "pipeline" / "shipped.json").write_text(json.dumps(SHIP))
    old = tmp_path / "web" / "data" / "fighters.json"
    old_text = json.dumps([{"id": i, "metrics": {"height": 1, "reach": 1}} for i in ("a-one", "b-two")])
    old.write_text(old_text)
    monkeypatch.setattr(build, "ROOT", tmp_path)
    monkeypatch.setattr(build, "SOURCE", DATA)
    monkeypatch.setattr(build, "MIN_FIGHTERS", 2)
    monkeypatch.setattr(build, "build", functools.partial(build.build, min_eligible=2))
    assert build.main() == 1
    assert old.read_text() == old_text
    assert "changed" in capsys.readouterr().err
```

In `test_main_writes_the_site_data`, add `monkeypatch.setattr(build, "MIN_FIGHTERS", 2)` beside the other `monkeypatch` lines. Its two-fighter build would otherwise stop at the new 150 minimum.

- [ ] **Step 2: Run them to see them fail**

Run: `python -m pytest pipeline -q`
Expected: FAIL, `build` has no attribute `validate`.

- [ ] **Step 3: Implement `validate`, and call it from `main`**

- `validate`: stop with `"Only {n} fighters, need {MIN_FIGHTERS}."` when `len(new) < MIN_FIGHTERS`. Read both constants from the module at call time, so the tests can patch them.
  - With `old` given, the values compared are every `(fighter id, metric)` pair in `old` whose fighter is still in `new` and whose metric is still in `shipped["ship"]`. A pair has changed when the new value differs or is missing.
  - If more than `MAX_CHANGED` of the compared values changed, stop with `"{pct:.1f}% of values changed since the last build (limit 15%). If this is expected, delete web/data/fighters.json and run the build again."` The delete is the owner's one-off override, so there is no flag.
  - `old = None` (first build) skips the comparison.
- `main`: inside the existing `try`, after `build(...)`, read `ROOT / "web" / "data" / "fighters.json"` if it exists (else `None`) and call `validate(old, fighters, shipped)`. Add `ValueError` to the caught exceptions, so a corrupt old file also fails cleanly. Nothing is written when validation fails.

- [ ] **Step 4: Run the tests, then a real build**

Run: `python -m pytest pipeline -q`
Expected: all pass.

Run: `python pipeline/build.py`
Expected: exit 0, ending `Wrote 200 fighters, 10 metrics`, with the committed data as the old file. Then `git checkout web/data pipeline/report.txt`, so this commit carries code only.

- [ ] **Step 5: Make the workflow commit the data**

In `.github/workflows/update-data.yml`:
- Add `permissions: contents: write` at the top level.
- Replace the `TODO` line with a step named `Commit the new data` that sets the git user to `github-actions[bot]` (email `41898282+github-actions[bot]@users.noreply.github.com`), runs `git add web/data pipeline/report.txt`, and then runs `git diff --cached --quiet || (git commit -m "Update fighter data" && git push)`.
- Leave `schedule` commented out (Task 5).

A failed build exits 1, which fails the job before the commit step (spec 11.3).

- [ ] **Step 6: Commit**

```bash
git add pipeline/build.py pipeline/tests/test_build.py .github/workflows/update-data.yml
git commit -m "Validate refreshed data and commit it from the Action"
```

---

### Task 5: Run the Action by hand, then schedule it

These steps need the owner. Do not start them without the owner.

- [ ] **Step 1: OWNER pushes, then runs "Update data" by hand.** Use GitHub → Actions → Update data → Run workflow.
  Expected: the run is green. It adds a commit `Update fighter data` to `main` when the data changed, and no commit when it did not. If the push step fails with 403, set Settings → Actions → General → Workflow permissions to "Read and write" and run it again.
- [ ] **Step 2: OWNER repeats Step 1 after the next UFC event or two** (spec 14: "once the hand-run update has worked a few times"). Check that each data commit's diff looks like a normal weekly change, and that Vercel redeployed.
- [ ] **Step 3: Switch on the schedule.** Uncomment the `schedule` block (`cron: "0 10 * * 2"`) and delete the comment above it.

```bash
git add .github/workflows/update-data.yml
git commit -m "Run the data update every Tuesday"
git push
```
