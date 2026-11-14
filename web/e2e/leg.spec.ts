import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("takedowns: sliding the grip up the leg means more", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "leg-stage");
  await expectGuessing(page, stage);
  const box = (await stage.getByTestId("leg-face").boundingBox())!;
  const at = (fy: number) => [box.x + box.width * 0.3, box.y + box.height * fy] as const;
  await page.mouse.click(...at(0.8)); // near the ankle: few
  const low = await valueOf(page);
  await page.mouse.move(...at(0.8));
  await page.mouse.down();
  await page.mouse.move(...at(0.2), { steps: 6 }); // up the thigh
  await page.mouse.up();
  expect(await valueOf(page)).toBeGreaterThan(low);
  await expectReveal(page, stage);
  await expect(stage.getByTestId("guess-grip")).toBeVisible(); // the estimate stays beside the true value
});
