import { expect, test } from "@playwright/test";
import { valueOf } from "./stages";

test("holding + steps once, waits a beat, then runs until let go; a tap is one step", async ({ page }) => {
  await page.clock.install();
  await page.goto("/infinite");
  const plus = page.getByRole("button", { name: "Increase" });
  const box = (await plus.boundingBox())!;

  const start = await valueOf(page);
  await plus.click(); // a tap: exactly one step
  const oneStep = await valueOf(page);
  expect(oneStep).toBeGreaterThan(start);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pressed = await valueOf(page);
  expect(pressed).toBeGreaterThan(oneStep); // the press itself steps
  await page.clock.runFor(300);
  expect(await valueOf(page)).toBe(pressed); // then a beat before repeating
  await page.clock.runFor(700);
  const held = await valueOf(page);
  expect(held).toBeGreaterThan(pressed); // then it runs
  await page.mouse.up();
  await page.clock.runFor(1000);
  expect(await valueOf(page)).toBe(held); // let go: it stops

  await page.getByRole("button", { name: "Decrease" }).focus();
  await page.keyboard.press("Enter"); // the keyboard still steps once
  expect(await valueOf(page)).toBeLessThan(held);
});
