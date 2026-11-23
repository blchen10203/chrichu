import { expect, test, type Page } from "@playwright/test";
import rankings from "../data/rankings.json";

const card = (page: Page, division: string) => page.getByRole("button", { name: new RegExp(`^${division}\\b`) });
const rowNames = (page: Page) =>
  page.getByTestId("roulette-row").evaluateAll((rows) => rows.map((r) => r.querySelector("button")!.getAttribute("aria-label")!.split(", ")[0]));

// A swap animates the rows into place; clicking a moving row can hit its neighbour.
const settled = (page: Page) =>
  expect
    .poll(async () => {
      const read = () => page.getByTestId("roulette-row").evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().y)).join());
      const before = await read();
      await page.waitForTimeout(100);
      return before === (await read());
    })
    .toBe(true);

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

// Taps rows into the given order, one swap at a time.
async function arrange(page: Page, answer: string[]) {
  await expect(page.getByTestId("roulette-row")).toHaveCount(answer.length);
  for (let i = 0; i < answer.length; i++) {
    const j = (await rowNames(page)).indexOf(answer[i]);
    if (j === i) continue;
    await settled(page);
    const rows = page.getByTestId("roulette-row");
    const a = rows.nth(i).getByRole("button").first();
    await a.click();
    await expect(a).toHaveAttribute("aria-pressed", "true");
    await rows.nth(j).getByRole("button").first().click();
    await expect.poll(async () => (await rowNames(page))[i]).toBe(answer[i]);
  }
}

async function clear(page: Page, division: string, answer: string[]) {
  await card(page, division).click();
  await arrange(page, answer);
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
  await expect(page.getByTestId("roulette-row")).toHaveCount(15);
  await expect(page.getByTestId("roulette-row").getByText("Champ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "← Board" }).click();
  await clear(page, "Men's Pound-for-Pound", answerOf("Men's Pound-for-Pound"));
});

test("tied fighters are right in either order", async ({ page }) => {
  await page.goto("/roulette");
  const answer = answerOf("Flyweight");
  const a = answer.indexOf("Sumudaerji");
  const b = answer.indexOf("Steve Erceg"); // both ranked #12
  [answer[a], answer[b]] = [answer[b], answer[a]];
  await clear(page, "Flyweight", answer);
});

test("leaving a division keeps it unsolved and keeps its order", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await expect(page.getByTestId("roulette-row").first()).toBeVisible();
  const order = await rowNames(page);
  await page.getByRole("button", { name: "← Board" }).click();
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
  await expect(card(page, "Lightweight")).toBeEnabled();
  await card(page, "Lightweight").click();
  await expect(page.getByTestId("roulette-row").first()).toBeVisible();
  expect(await rowNames(page)).toEqual(order);
});

test("stepping back right after a wrong lock-in still ends the run", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  const lockIn = page.getByRole("button", { name: "Lock in" });
  await lockIn.scrollIntoViewIfNeeded(); // ← Board sits beside it, so its box stays put
  const back = (await page.getByRole("button", { name: "← Board" }).boundingBox())!;
  await lockIn.click();
  // A raw click where the button was: Playwright's own checks would wait for the list to go.
  await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
  await expect(page.getByText(/^\d+ of 1[56] right$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart roulette" })).toBeVisible();
});

test("a wrong order ends the run", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText(/^\d+ of 1[56] right$/)).toBeVisible();
  await page.getByRole("button", { name: "Restart roulette" }).click();
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
});

test("a drag moves a row", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  const rows = page.getByTestId("roulette-row");
  await expect(rows.first()).toBeVisible();
  const first = (await rowNames(page))[0];
  const from = (await rows.nth(0).getByTestId("roulette-handle").boundingBox())!;
  const to = (await rows.nth(2).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await rowNames(page)).indexOf(first)).toBe(2);
});
