import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("dragging the pin right makes the fighter older", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "timeline-stage");
  await expect(stage).toContainText("younger");
  await expect(stage).toContainText("older");
  await expectGuessing(page, stage);
  const pin = page.getByRole("slider").first();
  const box = (await pin.boundingBox())!;
  const before = await valueOf(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  expect(await valueOf(page)).toBeGreaterThan(before);
  await expectReveal(page, stage);
  await expect(stage.getByTestId("guess-pin")).toBeVisible();
});
