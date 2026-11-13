import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("the dial sweeps with a drag and a tap on the ring", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "dial-stage");
  const afterKey = await expectGuessing(page, stage);
  const box = (await stage.getByTestId("dial-face").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.5); // left of centre: low
  const low = await valueOf(page);
  expect(low).not.toBe(afterKey);
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5, { steps: 6 }); // over the top to the right
  await page.mouse.up();
  expect(await valueOf(page)).toBeGreaterThan(low);
  await expectReveal(page, stage);
});
