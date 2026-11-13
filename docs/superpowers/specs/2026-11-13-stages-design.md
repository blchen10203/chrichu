# Reachdle: interactive stages design

Date: 2026-11-13
Status: approved by the owner 2026-11-13
Builds on: `docs/superpowers/specs/2026-11-10-reachdle-design.md` (the main spec)

## Intent

Bar charts are boring. A Daily has 5 rounds and only one must be height or
reach, so three or four rounds are the same bar drag. Each kind of stat should
get its own gesture and picture, so every round feels different and the guess
stays visual: you judge your red estimate against the blue reference by eye.

This is a personal project with no deadline. Nothing ships publicly until the
stages are in.

## Goals

- Every shipped stat except reach gets a new stage, chosen to suit the stat:
  - **Dial:** win %, finish rate.
  - **Stack:** knockdowns, submission wins.
  - **Tank:** career strikes.
  - **Tachometer:** strikes per minute, takedowns per 15 min.
  - **Timeline:** age.
  - **Height:** a scaled silhouette.
- Each stage shows the blue reference in the same form as the player's red
  estimate.
- No number gives the estimate away while guessing. The main spec, section 3,
  still holds.
- Remove every sign of a launch date or deadline (Part 0).

## Non-goals

- No change to scoring, round selection, saving, sharing or the modes. A stage
  turns a gesture into a value; the engine does the rest unchanged.
- No change to the data pipeline or `metrics.json`.
- No new reach stage. Reach keeps today's fingertip drag.
- No sound, haptics or animation beyond what a gesture needs.

## Anti-goals (a failure even if it works)

- A stage that leaks the answer: a scale, label, count readout or tick
  numbers during the guess.
- A stage a keyboard player cannot finish.
- A stage that scrolls or zooms the page while you drag on a phone.
- A gesture you cannot undo. Every stage can go both up and down.

## Constraints

- Every stage takes the existing `StageProps`:
  `{ metric, refValue, value, onChange?, actual? }`.
  - With `onChange` it is interactive.
  - With `actual` it is the reveal: no controls, and the true value is drawn as
    a dashed white outline in that stage's form.
- Every stage maps value to picture through `toFraction` / `fromFraction` and
  `snapValue` / `nudge` from `@/lib/engine/scale`. The picture is therefore on
  the same axis the scoring uses, and log stats such as career strikes stay
  log.
- Every stage has one focusable `role="slider"` element:
  - `aria-label="Your estimate"`;
  - `aria-valuemin`, `aria-valuemax` and `aria-valuenow`;
  - `aria-valuetext` from `formatValue`, kept so screen readers still work;
  - arrow keys nudge one snap, as in `BarStage`.
- The plot has `touch-action: none`, and drags use pointer capture.
- The − and + buttons under the stage stay. They call `nudge`, as today.
- Touch targets are at least 44 px, and the layout works from 360 to 430 px
  wide.
- The React lint rule `react-hooks/static-components` forbids choosing a
  component type during render. Pick the stage by returning the right
  element, `<DialStage {...props} />`, from a switch. Do not assign a
  component to a variable.
- The rule that a bar round's reference reaches at least 15% of the axis
  (main spec 6.1) applies to every stage except silhouettes. It already does:
  the rule keys on `metric.round === "bar"`, which these stats keep.

## Approaches

- **A. One component per stage, chosen by a small table in code. Owner picked
  this.**
  - A table in `web/components/stages/index.tsx` maps a stat id to a stage
    kind.
  - An unlisted stat falls back to `BarStage`, so a new stat in the data never
    breaks a round.
- **B. Store the stage kind in `metrics.json`.** Rejected: it changes the
  pipeline and its tests for a setting only the site uses.
- **C. One generic stage that changes its skin.** Rejected: dial, stack, tank
  and timeline need different gestures, not different colours.

## The stages, as decided

All stages draw the blue reference on the left or behind, and the red estimate
on the right or in front. Colours come from the theme tokens.

| Kind | Stats | Picture | Gesture |
|---|---|---|---|
| `dial` | `win_pct`, `finish_rate` | A gauge arc of about 270°. The blue arc is filled to the reference, and a red arc is swept on a second ring. | Drag around the ring to set the red arc's end. A tap on the ring jumps there. |
| `stack` | `knockdowns`, `sub_wins` | Two piles of icons in rows of 6: gloves for knockdowns, tap-out hands for submissions. The blue pile shows the reference count. | Tap the space above the red pile to add one. Tap the pile, or −, to remove the top one. |
| `tank` | `career_sig` | Two tall tanks or crowd meters. The blue one is filled to the reference. | Press and hold the red tank: it fills at a steady rate (full in about 3 s) and stops on release. Dragging on the tank sets the level directly, and − / + fine-tune it. |
| `tach` | `slpm`, `td_avg` | A speedometer with a sweep of about 240°. A ghost blue needle marks the reference; the red needle is yours. | Drag the red needle. A tap on the face jumps it. |
| `timeline` | `age` | A horizontal strip with "younger" at the left and "older" at the right, and no years or eras on it (era labels would give away numbers). A blue pin marks the reference. | Drag the red pin along the strip. Right means older. |
| `height` | `height` | Today's two figures on one ground line. The red figure scales from its feet. | Drag a scale handle at the red figure's top corner, or pinch on touch. Arrow keys nudge. This replaces today's head handle. |

`reach` keeps today's `SilhouetteStage` reach layout.

### Gesture details

These are my calls, settled after the builder check.

- **Every stage**
  - **Keys and buttons follow the value.** ArrowUp, ArrowRight and + raise the
    value. ArrowDown, ArrowLeft and − lower it. `aria-valuemin` and
    `aria-valuemax` stay in the stat's own terms.
  - **Ranges.** Every picture spans `toFraction` 0 to 1 across its range: the
    arc's sweep, the strip's length, the tank's height.
  - **Drags clamp.** A drag past either end stops at that end and never wraps
    around.
- **Dial and tachometer**
  - **Dead gap.** A drag that crosses the gap at the bottom of the dial goes
    to whichever end is nearer.
- **Timeline**
  - **Direction.** "Younger" is at the left and "older" at the right, so moving
    the pin right means older. The picture, the keys and screen readers then
    all agree.
- **Stack**
  - **Starting count.** The red pile starts empty, at the axis minimum, rather
    than at the middle like other stages. You build the pile.
  - **Adding and removing.** A tap in the empty space above the red pile adds
    one icon. A tap on the red pile removes the top one. There is no
    drag-to-set: tapping is the gesture.
  - **No empty slots.** Empty slots are never drawn, because they would show
    the maximum.
  - **Layout.** Piles grow upward in rows of 6. The stage keeps the same
    height for every stat, so the size of the area gives nothing away.
  - **Code change.** `RoundShell` takes the starting value from the stage
    table, so the stack can start at its minimum.
- **Tank**
  - **Hold to fill.** A press starts filling from the current level. It does
    not jump to the pointer. The fill rate is steady in `toFraction` terms,
    filling the whole tank in about 3 s, which is fair on the log scale.
  - **Press becomes drag.** Once the pointer moves more than 8 px, the press
    becomes a drag: filling stops and the level follows the pointer.
  - **Going down.** You lower the level by dragging, with −, or with the arrow
    keys.
- **Height**
  - **Scaling.** The figure scales evenly from its feet.
  - **Handle.** The handle sits at the top corner of the figure. Dragging it
    sets the height from its vertical distance to the ground, as the head
    handle does today.
  - **Pinch.** Pinching with two fingers on the plot scales the figure too.
    Playwright cannot pinch, so pinch is checked by hand on a phone, with the
    owner's phone check. The height half of `silhouette.spec.ts` is updated to
    drag the new handle.

Reveal, per stage: the dashed true value is drawn as
- a dashed arc end for the dial;
- dashed empty icon slots up to the true count for the stack;
- a dashed level line for the tank;
- a dashed needle for the tachometer;
- a dashed pin for the timeline;
- a dashed figure outline for height, as today.

Build order: one stage at a time, each with its own tests. Stack, dial,
tachometer, timeline, tank, then height scaling.

## Part 0: no launch date

- **Config:** replace `launchDate` in `web/lib/config.ts` with
  `firstPuzzle: "2026-11-13"`, the date of Daily #1. It is a fixed starting
  point, not a deadline, and it has no "placeholder until launch" comment.
  - Rename `puzzleNumber`'s second parameter to match, and the test name
    "numbers puzzles from launch day".
  - Today's puzzle is #1, so the share text never shows a number below 1.
  - The test examples are re-derived from the new start: 2026-11-13 is #1 and
    2026-12-24 is #42.
- **Main spec:** remove the launch-date wording:
  - section 4, the config line;
  - section 7.1, the puzzle number;
  - section 12, "first release";
  - section 14, "This is the first release".
- **Screens plan:** remove the "OWNER sets the launch date" step from Task 6
  and the "before launch" note on the results pill.
- **Past plans:** completed plans (engine, pipeline) stay as historical
  records. Their wording is not changed.

## Testing

- **Per stage**, one Playwright test reaches the stage through Infinite by
  skipping rounds until its `data-testid` (`dial-stage` and so on) appears, as
  `silhouette.spec.ts` does. It checks that:
  - the arrow keys change `aria-valuenow`;
  - the stage's own gesture changes the value:
    - **stack:** a tap adds exactly one;
    - **tank:** a hold fills it, using the page clock;
    - **dial and tach:** a drag moves it;
    - **timeline:** dragging right makes the fighter older;
  - the reveal keeps the stage, with no slider and a dashed outline present.
- **Hidden numbers:** the existing check in `infinite.spec.ts` keeps passing
  for every stage.
- **All existing tests** keep passing. A test that selects `getByRole("slider")`
  must still find exactly one slider per stage, except reach.

## Left to the builder

- The exact sizes, angles, icon artwork (inline SVG), fill rate and easing.
- How the stack lays out at its axis maximum: knockdowns go up to 22, so the
  pile may need 4 rows.
- Whether the stage table lives in `index.tsx` or beside `RoundShell`.
- The shapes of the dashed reveal marks.
