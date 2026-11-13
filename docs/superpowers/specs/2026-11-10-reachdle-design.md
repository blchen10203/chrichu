# Reachdle: design spec

Date: 2026-11-10
Status: awaiting review
Working name: Reachdle (one config value; can change)
Mockups: https://claude.ai/artifact/4JRw7xCJShMBUCNAD4cHiu

## 1. Purpose

A public, free, browser game in the style of Magnitudle, built on UFC fighter
measurements and fight statistics. The player sees a reference fighter's real
value and estimates another fighter's value by dragging a silhouette or a bar.
Close estimates earn partial credit.

Success: a player finishes the daily set in under two minutes, is surprised by
at least one answer, and shares the result.

## 2. Scope

In v1:

- Three modes: Daily, Infinite, Survival, shipped in the order of section 14.
- Two round types: silhouette (height, reach) and bar (every other metric).
- About 200 hand-curated notable fighters.
- Static site on Vercel's free domain. No backend, no accounts.
- Streaks and stats saved in the player's browser.
- Share button producing a text result.
- Weekly automatic data refresh through a GitHub Action.

Out of v1:

- Versus or any multiplayer.
- Global leaderboards or "how you compared" histograms (they need a backend).
- Daily archive.
- Accounts and cross-device sync.
- Ape index rounds.

## 3. Decisions made by the owner

- Real UFC fighter photos and the UFC logo are used, with a credit line.
  This is a known takedown risk (section 13). Images sit behind one function
  so they can be switched off in one change.
- Low-spread metrics are not shipped at all. The owner picks the shipped list
  from the build report (5.5).
- Career record is shown as win percentage, not a win:loss ratio. It covers
  UFC fights only; the data source has no full pro record (11.1).
- No number gives the estimate away while guessing: no live number, no axis
  values, no ruler scale. The player judges the red bar or figure against the
  blue reference by eye. All numbers appear on the reveal. (Changed
  2026-11-13; this replaced "a live number is shown while dragging".)
- Stats refresh weekly by GitHub Action.

## 4. Architecture

```
pipeline/                    Python. Never deployed.
  roster.csv                 name, ufcstats id, ufc.com slug, deceased flag
  shipped.json               metric ids to ship, optional step overrides (owner-edited)
  build.py                   download CSVs -> clean, derive -> fighters.json, metrics.json, report
  images.py                  ufc.com headshots -> web/public/img/fighters/ (run by hand)
  tests/                     pytest, with small sample CSVs

web/                         Next.js (App Router, output: 'export'), TypeScript, Tailwind
  data/                      fighters.json, metrics.json (committed)
  public/img/                fighters/<id>.png, ufc-logo.svg, fallback.svg
  lib/config.ts              game name, site URL, launch date, image switches
  lib/engine/                pure TypeScript, no React: rounds, scoring, damage
  lib/storage/               localStorage wrapper
  lib/images/                fighterImage(id) -> URL
  components/                SilhouetteStage, BarStage, RoundShell, Reveal,
                             Results, ShareButton, HpBar, Timer
  app/                       /, /daily, /infinite, /survival, /how-to-play, /faq

.github/workflows/update-data.yml
```

Boundaries:

- The site only reads JSON. It never contacts ufcstats or the dataset. If the
  pipeline breaks, the live game keeps running on the last good data.
- The engine has no UI. All three modes call it.
- The Daily set is built in the browser by the engine from the date (7.1).
  There is no schedule file, so round selection rules exist in exactly one
  place.
- `fighterImage()` is the only code that knows where images come from.
- `metrics.json` defines each metric once. Adding a metric is a data change.

Vercel builds from the `web/` directory on every push to `main`.

## 5. Data

### 5.1 Roster

About 200 fighters: current champions, the ranked top 15 of each division, and
well-known retired fighters. The list is drafted, then reviewed by the owner.
Each row carries the ufcstats fighter id. Section 11.1 covers shared names.

### 5.2 fighters.json

One entry per fighter:

```json
{
  "id": "jon-jones",
  "name": "Jon Jones",
  "dob": "1987-07-19",
  "deceased": false,
  "hasImage": true,
  "trackedFights": 24,
  "metrics": { "height": 76, "reach": 84.5, "slpm": 4.3 }
}
```

A metric key is present only when the fighter is eligible for it. Values above
are illustrative.

### 5.3 Candidate metrics

Every candidate is computed. The owner picks which ship (5.5).

| id | Label | Round | Scale | Snap |
|---|---|---|---|---|
| height | Height (in) | silhouette | linear | 1 |
| reach | Reach (in) | silhouette | linear | 0.5 |
| slpm | Significant strikes landed per minute | bar | linear | 0.1 |
| sapm | Significant strikes absorbed per minute | bar | linear | 0.1 |
| str_acc | Striking accuracy % | bar | linear | 1 |
| str_def | Striking defense % | bar | linear | 1 |
| career_sig | Career significant strikes landed | bar | log | 2 sig. figures |
| knockdowns | Career knockdowns landed | bar | linear | 1 |
| head_pct, body_pct, leg_pct | Share of strikes to each target % | bar | linear | 1 |
| td_avg | Takedowns per 15 minutes | bar | linear | 0.1 |
| td_acc | Takedown accuracy % | bar | linear | 1 |
| td_def | Takedown defense % | bar | linear | 1 |
| sub_avg | Submission attempts per 15 minutes | bar | linear | 0.1 |
| td_per_fight | Takedowns per fight | bar | linear | 0.1 |
| min_per_td | Minutes per takedown | bar | log | 2 sig. figures |
| control_time | Career control time (min) | bar | log | 2 sig. figures |
| win_pct | Win % (UFC fights) | bar | linear | 1 |
| ufc_fights | UFC fights | bar | linear | 1 |
| ufc_wins | UFC wins | bar | linear | 1 |
| finish_rate | % of wins by finish | bar | linear | 1 |
| ko_wins | Wins by KO/TKO | bar | linear | 1 |
| sub_wins | Wins by submission | bar | linear | 1 |
| cage_time | Career cage time (min) | bar | log | 2 sig. figures |
| avg_fight_len | Average fight length (min) | bar | linear | 0.1 |
| age | Age (years) | bar | linear | 1 |
| debut_age | Age at UFC debut | bar | linear | 1 |

Notes:

- "UFC fights", "UFC wins" and "Win %" count only fights at UFC events.
  ufcstats also lists some Pride, Strikeforce and WEC fights; those feed the
  rate metrics but not these three.
- Age is computed in the browser from `dob` on the day of play.

### 5.4 Eligibility

A fighter is eligible for a metric only with clean data for it:

- Missing or zero height, reach or birth date: not eligible for that metric.
- Rate and percentage metrics drawn from fights: at least 5 tracked fights.
- `min_per_td`: at least 3 career takedowns.
- `finish_rate`: at least 5 wins.
- `age`: not eligible if `deceased` is true.
- Log metrics: the value must be at least 1 in the metric's unit. A zero has
  no logarithm, and a tiny value would stretch the axis.

### 5.5 Metric selection

`build.py` computes every candidate and writes a report: for each metric, the
number of eligible fighters, minimum, median, maximum, standard deviation and
step. The owner reads it and lists the metrics to ship in
`pipeline/shipped.json`, aiming for about 10 that are fun to guess and well
spread. Height and reach always ship.

A metric with fewer than 30 eligible fighters cannot ship. The build stops if
one is listed.

There is no automatic spread cutoff. Standard deviation divided by mean was
considered and rejected: it penalises any metric with a large average (win %,
age, accuracy) and, for log metrics, changes with the unit.

### 5.6 metrics.json

For each shipped metric: id, label, unit, round type, scale, snap, slider
minimum and maximum, and `step`.

- `step` = 0.4 standard deviations across eligible fighters (in log10 space
  for log metrics). It can be overridden by hand in `pipeline/shipped.json`.
- Slider range = pool minimum to pool maximum, padded by 10% of the range,
  and floored at 0 where a negative value is meaningless. It is the same for
  every round of that metric, so the axis never hints at the answer.

## 6. Round engine

### 6.1 A round

```ts
type Round = { metric: MetricId; ref: FighterId; target: FighterId };
```

The player sees the reference fighter's real value and estimates the target's.

Selection rules:

- Both fighters are eligible for the metric and are different people.
- In a bar round the reference's bar is at least 15% of the axis tall. With
  no axis numbers it is the player's only scale. The target can be any value.
- No metric appears twice in a row (Infinite, Survival).
- A Daily set has 5 different metrics, at least one of them height or reach,
  and no fighter appears twice in the set.

### 6.2 Scoring

```
v(x)       = x            for linear metrics
           = log10(x)     for log metrics
stepsOff   = |v(guess) - v(actual)| / step
penalty    = max(0, stepsOff - 0.5)
dailyScore = round(100 * max(0, 1 - penalty / 2.5))
damage     = penalty                      (Survival, in HP)
```

Worked example, reach with step 2 in: actual 84.5, guess 81.0. That is 3.5 in
off, 1.75 steps, penalty 1.25. Daily score 50. Survival damage 1.3 HP
(displayed to one decimal).

Log example with step 0.15: actual 3,400, guess 1,700. log10(2) = 0.30, so
2 steps off, penalty 1.5. Daily score 40. Survival damage 1.5 HP.

### 6.3 Tunable constants

| Constant | Start value |
|---|---|
| Free zone | 0.5 steps |
| Zero-score distance | 3 steps |
| Step | 0.4 standard deviations |
| Survival HP | 10 |
| Survival timer | 15 seconds |

These are starting values, to be tuned with real data and play. Step starts at
0.4 because, on a bell-shaped metric, a player who always guesses the median
then averages about 50 per round. At 0.5 they average about 59, above the
balance target in section 12.

## 7. Modes

### 7.1 Daily

- The engine builds the 5 rounds in the browser from a random generator seeded
  with the date. The result depends only on the date and the current data, so
  every player gets the same set with no schedule file.
- The puzzle number is the number of days since the launch date in
  `lib/config.ts`, starting at 1.
- The date is the player's local date. The puzzle changes at local midnight.
- One attempt per day. The day's rounds are saved the first time Daily is
  opened, and each Lock In is saved immediately. A reload resumes the same set
  at the next unplayed round, even if the data was refreshed in between.
- If a saved, unplayed round is no longer valid after a refresh, it is rebuilt
  from the seed.
- After the fifth round the results screen shows. Opening Daily again that day
  shows the same results and a countdown to the next puzzle.
- Saved rounds store fighters and metric, not the answer. The answer is read
  from the current `fighters.json`.

### 7.2 Infinite

- Random rounds without end. Each is scored 0 to 100.
- Shows the session's running average and round count.
- No timer. Nothing is lost by leaving.

### 7.3 Survival

- Start at 10.0 HP. Each round has a 15 second timer.
- At zero seconds the slider's current value is locked in.
- Damage follows 6.2. The run ends when HP reaches 0.
- Score is rounds survived. Unlimited attempts; rounds are random each run.
- End screen: rounds survived, personal best, the round that ended the run,
  share button.

## 8. Interface

Mobile first, dark theme, condensed display type for numbers and headings.
The reference fighter is always blue; the player's estimate is always red.

Every round uses one shell:

1. Header: game name, mode and round label. Daily adds five progress pips and
   the running score. Survival adds the HP bar and the timer.
2. Question: metric category and a one-line prompt naming the target.
3. Stage: silhouette or bar (below).
4. Minus and plus buttons that move one snap. No number is shown for the
   estimate until the reveal.
5. Lock In button.

Silhouette stage:

- Reach: two front-facing figures with arms out, stacked, sharing one inch
  scale and a tick ruler. The player drags either fingertip handle.
- Height: two standing figures side by side on a shared ground line. The
  player drags a handle at the top of the red figure's head.

Bar stage: two vertical bars on a fixed axis with gridlines. The blue bar is
locked and labelled with its value. The player drags the top of the red bar.
Log metrics use a log axis.

Reveal: the round score, the player's estimate, the actual value, the size and
direction of the miss. The stage shows the estimate against a dashed outline
of the true value. Survival shows HP lost.

Results (Daily): total out of 500, a bar per round, streak, average, best,
share button, links to the other modes, countdown.

Controls are real buttons and sliders. The drag handle is keyboard operable:
arrow keys move one snap.

Home page: three mode cards, current streak, links to How to Play and FAQ.

Footer on every page: the UFC logo and the line "UFC and fighter images are
property of their owners. Unofficial fan project, not affiliated with UFC."
The logo does not appear beside the game's name.

## 9. Saved state

One localStorage key, `reachdle:v1`:

```json
{
  "daily": {
    "days": { "2026-12-01": {
      "rounds": [{ "metric": "reach", "ref": "...", "target": "..." }],
      "guesses": [81.0], "scores": [50], "done": false } },
    "streak": 4, "maxStreak": 9, "lastDone": "2026-11-30"
  },
  "survival": { "best": 14, "runs": 6 },
  "infinite": { "rounds": 120, "totalScore": 7900 }
}
```

- Streak counts consecutive local dates with a finished Daily.
- If storage is blocked, or the saved value fails to parse, the game plays
  normally with empty state and does not crash.

## 10. Sharing

The share button uses the device share sheet where available, otherwise
copies to the clipboard and confirms.

```
Reachdle #42 — 387/500
🟩🟨🟩🟨🟩
https://reachdle.vercel.app
```

Green for 80 or more, yellow for 40 to 79, red below 40. Survival shares
"Reachdle Survival — 14 rounds" with the link.

## 11. Data pipeline

### 11.1 Source

We do not scrape ufcstats ourselves.

- Stats come from the CSV files published at
  https://github.com/Greco1899/scrape_ufc_stats, a maintained scrape of
  ufcstats. They hold each fighter's height, reach and birth date, per-round
  fight stats (strikes by target, takedowns, control time, knockdowns) and
  fight results (outcome, method, round, time). `build.py` downloads them on
  every run. We read the CSV output only and do not copy that project's code
  (GPL-3.0).
- The files have no full pro record, so win % covers UFC fights only.
- A roster fighter is matched to the fighter file by ufcstats id (in its URL
  column). Fight rows carry names only. If another ufcstats fighter shares a
  roster fighter's name, the build stops and names them, and that fighter is
  left off the roster for v1.
- Headshots come from ufc.com athlete pages through `images.py`. It is run by
  hand when the roster changes and is not part of the weekly Action.
  `build.py` sets `hasImage` from whether the file exists; without one the
  site shows the fallback silhouette.

### 11.2 Build

Downloads the CSVs, cleans values, derives metrics, applies eligibility,
computes steps and slider ranges, and writes `fighters.json`, `metrics.json`
(shipped metrics only) and a readable report.

The whole update is one command, `python pipeline/build.py`, and runs the same
locally as in the Action.

### 11.3 Weekly Action

`.github/workflows/update-data.yml`, Tuesdays 10:00 UTC:

1. Run build.
2. Validate. Commit to `main` only if validation passes.

Validation fails, and nothing is committed, when:

- any roster fighter is missing from the CSVs,
- more than 15% of existing fighter-metric values changed since the last run
  (the usual sign that the dataset changed format),
- fewer than 150 fighters remain, or
- a shipped metric has fewer than 30 eligible fighters.

A failed run fails the workflow, so GitHub notifies the owner. The live site
is untouched.

## 12. Testing

- Engine (Vitest): the worked examples in 6.2, log metrics, eligibility,
  selection rules, date-seeded generation returning the same set every time.
- Balance (Vitest): a bot that always guesses the pool median should average
  40 to 55 per Daily round and survive fewer than 12 Survival rounds on
  average. Outside that range, constants need tuning.
- Pipeline (pytest): `build.py` runs against small sample CSVs. Covers
  eligibility, the log minimum, and the stop on a shared name.
- Storage (Vitest): blocked storage and corrupt values.
- End to end (Playwright): one smoke test for the first release, which
  finishes a Daily with a reload part-way. "Die in Survival" is added when
  Survival ships.
- By hand: drag feel on a real phone.

## 13. Risks

- **Intellectual property.** UFC headshots are copyrighted and the logo is a
  trademark. A credit line is not a licence. The likely consequence is a
  takedown notice to Vercel. Mitigation: `lib/config.ts` has
  `showFighterImages` and `showUfcLogo`; setting both to false and redeploying
  removes every such asset from the site. The switch does not remove
  headshots from the repo or its history, so a takedown could also hit
  GitHub. The repo is therefore made private before the first headshot is
  committed (section 14).
- **The dataset can stop updating or change format.** It is one person's
  repo. The site keeps running on the last good data, and the sample-CSV
  tests and the 15% guard catch a format change before bad data ships. If it
  stops for good, we write our own ufcstats scraper then.
- **Answers are public.** All stats ship in JSON. With no leaderboard this
  only lets a player fool themselves.
- **A refresh can change today's puzzle.** A player who starts after the
  Tuesday refresh may get a different set, or a slightly different answer,
  from one who started before it. Players who already started keep their
  saved set. Accepted for v1.
- **Silhouette differences are small on a phone** (about 4 pixels per inch).
  The unlabelled ruler and the nudge buttons help; the estimate is meant to
  be visual.

## 14. Build order

1. Make the GitHub repo private, before any headshot is committed.
2. Pipeline: roster, `build.py` and its report. The owner picks the shipped
   metrics. Updates are run by hand.
3. Engine, Daily and Infinite. Deploy. This is the first release.
4. Survival.
5. Weekly Action, once the hand-run update has worked a few times.
