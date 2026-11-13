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
