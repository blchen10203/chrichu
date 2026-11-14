import { expect, type Locator, type Page } from "@playwright/test";

// Plays Infinite rounds until the stage appears; stages show up in random rounds.
export async function findStage(page: Page, testId: string): Promise<Locator> {
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId(testId).count()) break;
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: "Next round" }).click();
  }
  const stage = page.getByTestId(testId);
  await expect(stage).toBeVisible();
  return stage;
}

export const valueOf = async (page: Page) => Number(await page.getByRole("slider").first().getAttribute("aria-valuenow"));

// Stages with a printed scale (tank, stack) pass `scaled`; the rest must show no numbers while guessing.
export async function expectGuessing(page: Page, stage: Locator, scaled = false): Promise<number> {
  if (!scaled) await expect(stage).not.toContainText(/\d/);
  expect(await stage.evaluate((el) => [el, ...el.querySelectorAll("*")].some((n) => getComputedStyle(n).touchAction === "none"))).toBe(true);
  const slider = stage.getByRole("slider");
  await expect(slider).toHaveCount(1);
  const before = Number(await slider.getAttribute("aria-valuenow"));
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  await expect(slider).not.toHaveAttribute("aria-valuenow", String(before));
  const after = Number(await slider.getAttribute("aria-valuenow"));
  expect(after).toBeGreaterThan(before); // ArrowUp is +1
  return after;
}

export async function expectReveal(page: Page, stage: Locator) {
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(stage).toBeVisible();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(stage.getByTestId("true-value")).toBeVisible();
}
