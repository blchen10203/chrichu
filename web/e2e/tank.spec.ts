import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("holding fills the tank, letting go stops it, and a drag stops the filling", async ({ page }) => {
  await page.clock.install();
  await page.goto("/infinite");
  const stage = await findStage(page, "tank-stage");
  await expectGuessing(page, stage);
  const tank = stage.getByTestId("tank-red");
  const box = (await tank.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.8;

  const start = await valueOf(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.mouse.up();
  const held = await valueOf(page);
  expect(held).toBeGreaterThan(start); // hold fills from the current level
  await page.clock.runFor(2000);
  expect(await valueOf(page)).toBe(held); // let go: it stops

  await page.mouse.move(cx, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + box.height * 0.6, { steps: 4 }); // moved > 8 px: now a drag
  const dragged = await valueOf(page);
  await page.clock.runFor(2000);
  expect(await valueOf(page)).toBe(dragged); // no creeping while dragging
  await page.mouse.up();
  await expectReveal(page, stage);
  await expect(stage.getByTestId("guess-fill")).toBeVisible(); // the guess stays on screen
});
