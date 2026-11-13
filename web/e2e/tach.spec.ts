import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("the tachometer needle follows a drag and a tap", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "tach-stage");
  const afterKey = await expectGuessing(page, stage);
  const box = (await stage.getByTestId("tach-face").boundingBox())!;
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.click(...at(0.1, 0.5)); // left of centre: low
  const low = await valueOf(page);
  expect(low).not.toBe(afterKey);
  await page.mouse.move(...at(0.1, 0.5));
  await page.mouse.down();
  await page.mouse.move(...at(0.5, 0.1), { steps: 6 }); // over the top
  await page.mouse.move(...at(0.9, 0.5), { steps: 6 });
  await page.mouse.up();
  expect(await valueOf(page)).toBeGreaterThan(low);
  await expectReveal(page, stage);
});
