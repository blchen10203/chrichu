import { expect, test } from "@playwright/test";

test("a keyboard-only player can play Infinite rounds", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/infinite");
  await expect(page.getByText("INFINITE · ROUND 1")).toBeVisible();

  const slider = page.getByRole("slider");
  const before = await slider.getAttribute("aria-valuenow");
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  expect(await slider.getAttribute("aria-valuenow")).not.toBe(before);
  await expect(slider).toHaveAttribute("aria-valuetext", /.+/);

  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByText("/ 100")).toBeVisible();
  await expect(page.getByText("Actual")).toBeVisible();

  await page.getByRole("button", { name: "Next round" }).click();
  await expect(page.getByText("INFINITE · ROUND 2")).toBeVisible();
  await expect(page.getByText(/Average \d+ over 1 round/)).toBeVisible();

  expect(errors).toEqual([]);
});
