import { expect, test, type Page } from "@playwright/test";

// Plays Infinite until a ranking round comes up (about one round in four, never the first).
async function findRankingRound(page: Page) {
  await page.goto("/infinite");
  for (let i = 0; i < 60 && !(await page.getByTestId("rank-slot").count()); i++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: "Next round" }).click();
  }
  await expect(page.getByTestId("rank-slot")).toHaveCount(3);
}

test("fighters drag into their ranks and the reveal shows the real ones", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await findRankingRound(page);

  await expect(page.getByRole("heading", { name: /Where do they rank at .+\?/ })).toBeVisible();
  const ranks = await page.getByTestId("rank-slot").allInnerTexts();
  expect(ranks.map((t) => t.trim())).toEqual(expect.arrayContaining([expect.stringMatching(/^#\d+/)]));
  const side = page.getByLabel("Fighters to place").getByTestId("rank-chip");
  await expect(side).toHaveCount(3);
  await expect(side.first().getByRole("img")).toBeVisible(); // the photo beside the name

  for (let slot = 0; slot < 3; slot++) {
    const chip = (await side.first().boundingBox())!;
    const target = (await page.getByTestId("rank-slot").nth(slot).boundingBox())!;
    await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("rank-slot").nth(slot).getByTestId("rank-chip")).toHaveCount(1);
  }
  await expect(side).toHaveCount(0);

  // Dragging a placed fighter onto another slot swaps the two.
  const first = page.getByTestId("rank-slot").nth(0).getByTestId("rank-chip");
  const second = page.getByTestId("rank-slot").nth(1).getByTestId("rank-chip");
  const [a, b] = [await first.textContent(), await second.textContent()];
  const from = (await first.boundingBox())!;
  const to = (await second.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(first).toHaveText(b!);
  await expect(second).toHaveText(a!);

  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("/ 100")).toBeVisible();
  await expect(page.getByText(/^[0-3] of 3 right$/)).toBeVisible();
  await expect(page.getByTestId("rank-answer")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("a keyboard player places fighters by selecting one, then a rank", async ({ page }) => {
  await findRankingRound(page);
  for (let slot = 0; slot < 3; slot++) {
    await page.getByLabel("Fighters to place").getByTestId("rank-chip").first().focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^Place at #\d+$/ }).first().focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByLabel("Fighters to place").getByTestId("rank-chip")).toHaveCount(0);
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByTestId("rank-answer")).toHaveCount(3);
});
