import { expect, test, type Page } from "@playwright/test";
import rankings from "../data/rankings.json";

const card = (page: Page, division: string) => page.getByRole("button", { name: new RegExp(`^${division}\\b`) });
const slot = (page: Page, i: number) => page.getByTestId("roulette-slot").nth(i);
const pool = (page: Page) => page.getByLabel("Fighters to place").getByTestId("roulette-chip");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const chipOf = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${escape(name)}, `) });
const nameIn = (page: Page, i: number) => slot(page, i).getByTestId("roulette-chip").getAttribute("aria-label").then((l) => l?.split(", ")[0]);

const errorsOf = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  errorsOf.set(page, errors);
});
test.afterEach(({ page }) => expect(errorsOf.get(page)).toEqual([]));

// The names in slot order, from the same rankings.json the page reads.
const answerOf = (division: string) => {
  const d = rankings.divisions.find((x) => x.division === division)!;
  return [...(d.champion && !d.is_p4p ? [d.champion.name] : []), ...d.ranked.map((r) => r.name)];
};

// Taps a fighter (the pool's first when no name), then a slot. Chips stay disabled while the pool shuffles in.
async function place(page: Page, name: string | null, i: number) {
  await expect(pool(page).first()).toBeEnabled();
  const chip = chipOf(page, name ?? (await pool(page).first().getAttribute("aria-label"))!.split(", ")[0]);
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await slot(page, i).getByRole("button", { name: /^Place at / }).click();
  await expect(slot(page, i).getByTestId("roulette-chip")).toHaveCount(1);
}

// Fills every slot, in the given order of names, or in the pool's dealt order (never fully right).
async function fill(page: Page, answer?: string[]) {
  const n = await page.getByTestId("roulette-slot").count();
  for (let i = 0; i < n; i++) await place(page, answer ? answer[i] : null, i);
}

async function clear(page: Page, division: string, answer: string[]) {
  await card(page, division).click();
  await fill(page, answer);
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("1 of 13 cleared")).toBeVisible();
  await expect(card(page, division)).toBeDisabled();
  await expect(card(page, division).getByLabel("Cleared")).toBeVisible();
}

test("clearing a division by taps checks it off", async ({ page }) => {
  await page.goto("/roulette");
  await expect(page.getByTestId("division-card")).toHaveCount(13);
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
  await clear(page, "Lightweight", answerOf("Lightweight"));
});

test("a pound-for-pound list has 15 slots and no Champ", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Men's Pound-for-Pound").click();
  await expect(page.getByTestId("roulette-slot")).toHaveCount(15);
  await expect(pool(page)).toHaveCount(15);
  await expect(page.getByTestId("roulette-slot").getByText("Champ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "← Board" }).click();
  await clear(page, "Men's Pound-for-Pound", answerOf("Men's Pound-for-Pound"));
});

test("tied fighters are right in either order", async ({ page }) => {
  // The rankings change daily, so find whichever list has two fighters sharing a rank today.
  const tie = rankings.divisions
    .map((d) => ({ division: d.division, pair: d.ranked.filter((r) => d.ranked.some((o) => o !== r && o.rank === r.rank)) }))
    .find((t) => t.pair.length >= 2);
  test.skip(!tie, "no list in rankings.json has a tie today");
  const { division, pair } = tie!;
  const answer = answerOf(division);
  const [a, b] = [answer.indexOf(pair[0].name), answer.indexOf(pair[1].name)];
  expect(pair[0].rank).toBe(pair[1].rank);
  [answer[a], answer[b]] = [answer[b], answer[a]];
  await page.goto("/roulette");
  await clear(page, division, answer);
});

test("leaving a division keeps it unsolved and keeps its placements", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await place(page, null, 0);
  const first = await nameIn(page, 0);
  await page.getByRole("button", { name: "← Board" }).click();
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
  await expect(card(page, "Lightweight")).toBeEnabled();
  await card(page, "Lightweight").click();
  await expect.poll(() => nameIn(page, 0)).toBe(first);
  await expect(pool(page)).toHaveCount(15);
});

test("the fighters shuffle in, and lock in waits for every slot", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await expect(page.getByTestId("roulette-slot")).toHaveCount(16);
  await expect(pool(page)).toHaveCount(16);
  await expect(pool(page).first()).toBeDisabled(); // dealing
  await expect(pool(page).first()).toBeEnabled();
  const lockIn = page.getByRole("button", { name: "Lock in" });
  await expect(lockIn).toBeDisabled();
  await fill(page);
  await expect(lockIn).toBeEnabled();
});

test("stepping back right after a wrong lock-in still ends the run", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await fill(page);
  const lockIn = page.getByRole("button", { name: "Lock in" });
  await lockIn.scrollIntoViewIfNeeded(); // ← Board sits beside it, so its box stays put
  const back = (await page.getByRole("button", { name: "← Board" }).boundingBox())!;
  await lockIn.click();
  // A raw click where the button was: it must neither leave the list nor hit Restart.
  await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
  await expect(page.getByText(/^\d+ of 1[56] right$/)).toBeVisible();
  await expect(page.getByTestId("roulette-slot")).toHaveCount(16);
  await expect(page.getByRole("button", { name: "Restart roulette" })).toBeVisible();
});

test("a wrong order ends the run", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await fill(page);
  await page.getByRole("button", { name: "Lock in" }).click();
  // The list stays up, each slot marked right or wrong, and the marks add up to the count.
  const result = page.getByText(/^\d+ of 16 right$/);
  await expect(result).toBeVisible();
  const right = parseInt((await result.textContent())!);
  await expect(page.getByTestId("roulette-slot").getByText("Right", { exact: true })).toHaveCount(right);
  await expect(page.getByTestId("roulette-slot").getByText("Wrong", { exact: true })).toHaveCount(16 - right);
  await expect(pool(page)).toHaveCount(0);
  await expect(slot(page, 0).getByTestId("roulette-chip")).toBeDisabled();
  await page.getByRole("button", { name: "Restart roulette" }).click();
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
});

test("a fighter drags from the pool into a slot and back", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  const chip = pool(page).first();
  await expect(chip).toBeEnabled();
  // The pool keeps sliding into its dealt order for a moment after the chips come alive.
  let last = "";
  await expect.poll(async () => last === (last = JSON.stringify(await chip.boundingBox())), { intervals: [150] }).toBe(true);
  const name = (await chip.getAttribute("aria-label"))!.split(", ")[0];
  const drag = async (from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }) => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
    await page.mouse.up();
  };
  await drag((await chip.boundingBox())!, (await slot(page, 3).boundingBox())!);
  await expect.poll(() => nameIn(page, 3)).toBe(name);
  await expect(pool(page)).toHaveCount(15);
  const placed = slot(page, 3).getByTestId("roulette-chip");
  await drag((await placed.boundingBox())!, (await page.getByLabel("Fighters to place").boundingBox())!);
  await expect(pool(page)).toHaveCount(16);
  await expect(slot(page, 3).getByTestId("roulette-chip")).toHaveCount(0);
});
