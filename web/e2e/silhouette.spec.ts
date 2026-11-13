import { expect, test } from "@playwright/test";

test("height and reach rounds use a silhouette with a working handle", async ({ page }) => {
  await page.goto("/infinite");
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId("silhouette-stage").count()) break;
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: "Next round" }).click();
  }
  await expect(page.getByTestId("silhouette-stage")).toBeVisible();

  const slider = page.getByRole("slider").first();
  const before = Number(await slider.getAttribute("aria-valuenow"));
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  const afterKey = Number(await slider.getAttribute("aria-valuenow"));
  expect(afterKey).toBeGreaterThan(before);

  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 - 20, { steps: 4 });
  await page.mouse.up();
  expect(Number(await slider.getAttribute("aria-valuenow"))).not.toBe(afterKey);

  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByTestId("silhouette-stage")).toBeVisible(); // reveal keeps the silhouette
  await expect(page.getByRole("slider")).toHaveCount(0);
});
