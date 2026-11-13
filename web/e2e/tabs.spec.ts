import { expect, test } from "@playwright/test";

test("a stale Survival tab does not erase a Daily finished in another tab", async ({ context }) => {
  const a = await context.newPage();
  await a.goto("/survival");
  await expect(a.getByText("SURVIVAL · ROUND 1")).toBeVisible();

  const b = await context.newPage();
  await b.goto("/daily");
  for (let round = 1; round <= 5; round++) {
    await b.getByRole("slider").first().focus();
    await b.keyboard.press("ArrowUp");
    await b.getByRole("button", { name: "Lock in" }).click();
    await b.getByRole("button", { name: round < 5 ? "Next round" : "See results" }).click();
  }
  await expect(b.getByTestId("daily-total")).toBeVisible();

  for (let round = 1; round <= 60; round++) {
    await a.getByRole("button", { name: "Lock in" }).click();
    await expect(a.getByText("/ 100")).toBeVisible();
    if (await a.getByRole("button", { name: "See results" }).isVisible()) break;
    await a.getByRole("button", { name: "Next round" }).click();
  }

  await b.goto("/daily");
  await expect(b.getByTestId("daily-total")).toBeVisible();
  await expect(b.getByRole("button", { name: "Lock in" })).toHaveCount(0);
});
