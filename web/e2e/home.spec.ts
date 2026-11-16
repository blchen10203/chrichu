import { expect, test } from "@playwright/test";

test("home shows the modes, and today's result once Daily is done", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Daily/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Infinite/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Survival/ })).toBeVisible();
  await expect(page.getByText("Streak: 0 days")).toBeVisible();

  await page.getByRole("link", { name: /Daily/ }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await page.goto("/");
  await expect(page.getByText(/^\d+ \/ 500$/)).toBeVisible();
  await expect(page.getByText("Streak: 1 day")).toBeVisible();

  await page.getByRole("link", { name: "How to Play" }).click();
  await expect(page.getByRole("heading", { name: "How to Play" })).toBeVisible();
  await page.goto("/faq");
  await expect(page.getByText("No. It is an unofficial fan project.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /Survival/ }).click();
  await expect(page.getByText("Round 1", { exact: true })).toBeVisible();
});

test("the active-only switch is remembered and marks Infinite and Survival, not the Daily", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Active fighters only" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("The Daily always uses every fighter.", { exact: false })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await page.goto("/infinite");
  await expect(page.getByText("Round 1 · Active", { exact: true })).toBeVisible();
  await page.goto("/survival");
  await expect(page.getByText("Round 1 · Active", { exact: true })).toBeVisible();
  await page.goto("/daily");
  await expect(page.getByText("Round 1 of 5", { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await page.goto("/infinite");
  await expect(page.getByText("Round 1", { exact: true })).toBeVisible();
});
