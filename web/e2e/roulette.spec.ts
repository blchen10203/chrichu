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

test("clearing a division by taps checks it off", async ({ page }) => {
  await page.goto("/roulette");
  await expect(page.getByTestId("division-card")).toHaveCount(13);
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
  await card(page, "Lightweight").click();

  const lw = rankings.divisions.find((d) => d.division === "Lightweight")!;
  const answer = [...(lw.champion ? [lw.champion.name] : []), ...lw.ranked.map((r) => r.name)];
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
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("1 of 13 cleared")).toBeVisible();
  await expect(card(page, "Lightweight")).toBeDisabled();
  await expect(card(page, "Lightweight").getByLabel("Cleared")).toBeVisible();
});

test("leaving a division keeps it unsolved", async ({ page }) => {
  await page.goto("/roulette");
  await card(page, "Lightweight").click();
  await expect(page.getByTestId("roulette-row").first()).toBeVisible();
  await page.getByRole("button", { name: "← Board" }).click();
  await expect(page.getByText("0 of 13 cleared")).toBeVisible();
  await expect(card(page, "Lightweight")).toBeEnabled();
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
