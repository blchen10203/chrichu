import { expect, test, type Page } from "@playwright/test";

async function playRound(page: Page) {
  await page.getByRole("slider").first().focus();
  await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("/ 100")).toBeVisible();
}

test("a Daily survives a reload and can only be played once", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/daily");
  await expect(page.getByText("Round 1 of 5")).toBeVisible();
  const firstQuestion = await page.getByRole("heading", { level: 1 }).textContent();

  await playRound(page);
  await page.getByRole("button", { name: "Next round" }).click();
  await playRound(page); // locked in, reveal showing

  await page.reload();
  await expect(page.getByText("Round 3 of 5")).toBeVisible();
  expect(await page.getByRole("heading", { level: 1 }).textContent()).not.toBe(firstQuestion);

  for (let round = 3; round <= 5; round++) {
    await playRound(page);
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await expect(page.getByText("/ 500")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share result" })).toBeVisible();
  await expect(page.getByText(/Next daily in \d\d:\d\d:\d\d/)).toBeVisible();
  const total = await page.getByTestId("daily-total").textContent();

  await page.reload();
  await expect(page.getByTestId("daily-total")).toHaveText(total!);
  await expect(page.getByRole("button", { name: "Lock in" })).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("the game plays with storage blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await page.goto("/daily");
  for (let round = 1; round <= 5; round++) {
    await playRound(page);
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await expect(page.getByText("/ 500")).toBeVisible();
});

test("sharing copies the result", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/daily");
  for (let round = 1; round <= 5; round++) {
    await playRound(page);
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByText("Copied")).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/\/500\r?\n[🟩🟨🟥]{5}\r?\nhttps:\/\//u);
});

test("results left open past midnight offer today's puzzle instead of a countdown", async ({ page }) => {
  const late = new Date();
  late.setHours(23, 58, 0, 0);
  await page.clock.install({ time: late });
  await page.goto("/daily");
  for (let round = 1; round <= 5; round++) {
    await playRound(page);
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await expect(page.getByText(/Next daily in/)).toBeVisible();

  await page.clock.fastForward(3 * 60_000);
  await expect(page.getByText(/Next daily in/)).toHaveCount(0);
  await page.getByRole("button", { name: "Today's puzzle is ready" }).click();
  await expect(page.getByText("Round 1 of 5")).toBeVisible();
});
