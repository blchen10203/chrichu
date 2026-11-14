import { expect, test } from "@playwright/test";
import { findStage, expectReveal, valueOf } from "./stages";

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

test("height and reach show feet and inches, switch to inches, and remember it", async ({ page }) => {
  await page.goto("/infinite");
  await findStage(page, "silhouette-stage");
  const ref = page.getByTestId("ref-value");
  await expect(ref).toHaveText(/^\d+' [\d.]+"$/);

  await page.getByRole("button", { name: "Inches", exact: true }).click();
  await expect(ref).toHaveText(/^[\d.]+ in$/);
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(page.getByTestId("your-estimate")).toHaveText(/ in$/);

  await page.reload();
  await findStage(page, "silhouette-stage");
  await expect(page.getByTestId("ref-value")).toHaveText(/ in$/);
  await expect(page.getByRole("button", { name: "Inches", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("height scales the red figure from its feet with the corner handle", async ({ page }) => {
  await page.goto("/infinite");
  let stage = await findStage(page, "silhouette-stage");
  for (let i = 0; i < 60 && (await page.getByRole("heading", { level: 1 }).textContent())?.startsWith("How tall") !== true; i++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: "Next round" }).click();
    stage = page.getByTestId("silhouette-stage");
  }
  const handle = stage.getByTestId("height-handle");
  const box = (await handle.boundingBox())!;
  const before = await valueOf(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 - 30, { steps: 4 });
  await page.mouse.up();
  expect(await valueOf(page)).toBeGreaterThan(before);
  await expectReveal(page, stage);
});

test("a pinch on the height figure does not first snap to the first finger", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "silhouette-stage");
  for (let i = 0; i < 60 && (await page.getByRole("heading", { level: 1 }).textContent())?.startsWith("How tall") !== true; i++) {
    await page.getByRole("button", { name: "Lock in" }).click();
    await page.getByRole("button", { name: "Next round" }).click();
  }
  const before = await valueOf(page);
  await stage.evaluate((el) => {
    const plot = el.firstElementChild as HTMLElement;
    const r = plot.getBoundingClientRect();
    const fire = (type: string, id: number, fx: number, fy: number) =>
      plot.dispatchEvent(new PointerEvent(type, { pointerId: id, isPrimary: id === 1, clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles: true }));
    fire("pointerdown", 1, 0.75, 0.9); // low on the plot: a snap would clamp to the minimum
    fire("pointerdown", 2, 0.6, 0.5);
  });
  expect(await valueOf(page)).toBe(before);
  await stage.evaluate((el) => {
    const plot = el.firstElementChild as HTMLElement;
    for (const id of [1, 2]) plot.dispatchEvent(new PointerEvent("pointerup", { pointerId: id, isPrimary: id === 1, bubbles: true }));
  });
});
