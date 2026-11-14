import { expect, test } from "@playwright/test";

test("a keyboard-only player can play Infinite rounds", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/infinite");
  await expect(page.getByText("Round 1", { exact: true })).toBeVisible();

  const slider = page.getByRole("slider").first();
  const before = await slider.getAttribute("aria-valuenow");
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  expect(await slider.getAttribute("aria-valuenow")).not.toBe(before);
  await expect(slider).toHaveAttribute("aria-valuetext", /.+/);

  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("/ 100")).toBeVisible();
  await expect(page.getByText("Actual")).toBeVisible();

  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText("Round 2", { exact: true })).toBeVisible();
  await expect(page.getByText(/Average \d+ over 1 round/)).toBeVisible();

  expect(errors).toEqual([]);
});

test("no numbers give the estimate away while guessing, and they return on the reveal", async ({ page }) => {
  await page.goto("/infinite");
  for (let round = 1; round <= 8; round++) {
    await expect(page.getByText(`Round ${round}`, { exact: true })).toBeVisible();
    const slider = page.getByRole("slider").first();
    await slider.focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");

    await expect(page.getByTestId("axis-labels")).toHaveCount(0);
    await expect(page.getByText("each tick")).toHaveCount(0);
    const estimate = (await slider.getAttribute("aria-valuetext"))!;
    const ref = await page.getByTestId("ref-value").textContent();
    if (estimate !== ref) await expect(page.getByText(estimate, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Lock in" }).click();
    await expect(page.getByTestId("your-estimate")).toHaveText(estimate);
    await page.getByRole("button", { name: "Next round" }).click();
  }
});
