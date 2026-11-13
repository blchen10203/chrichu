import { expect, test } from "@playwright/test";

test("home shows the modes, and today's result once Daily is done", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Daily/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Infinite/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Survival/ })).toHaveCount(0);
  await expect(page.getByText("Streak: 0 days")).toBeVisible();

  await page.getByRole("link", { name: /Daily/ }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await page.goto("/");
  await expect(page.getByText(/Done today · \d+ \/ 500/)).toBeVisible();
  await expect(page.getByText("Streak: 1 day")).toBeVisible();

  await page.getByRole("link", { name: "How to Play" }).click();
  await expect(page.getByRole("heading", { name: "How to Play" })).toBeVisible();
  await page.goto("/faq");
  await expect(page.getByText("No. It is an unofficial fan project.")).toBeVisible();
});
