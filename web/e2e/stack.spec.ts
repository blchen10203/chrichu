import { expect, test } from "@playwright/test";
import { expectGuessing, expectReveal, findStage, valueOf } from "./stages";

test("the stack starts empty, grows with a tap, shrinks with a tap on the pile, and stops at the maximum", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "stack-stage");
  const slider = page.getByRole("slider").first();
  expect(await valueOf(page)).toBe(Number(await slider.getAttribute("aria-valuemin")));

  const afterKey = await expectGuessing(page, stage);
  await stage.getByTestId("stack-add").click();
  expect(await valueOf(page)).toBe(afterKey + 1);
  await stage.getByTestId("stack-pile").click();
  expect(await valueOf(page)).toBe(afterKey);

  const max = Number(await slider.getAttribute("aria-valuemax"));
  for (let i = 0; i < max + 5; i++) await stage.getByTestId("stack-add").click();
  expect(await valueOf(page)).toBe(max);

  await expectReveal(page, stage);
});

test("a tap on a blank cell beside a partial top row adds one; a tap on an icon removes one", async ({ page }) => {
  await page.goto("/infinite");
  const stage = await findStage(page, "stack-stage");
  const slider = page.getByRole("slider").first();
  const min = Number(await slider.getAttribute("aria-valuemin"));
  while ((await valueOf(page)) < min + 7) await stage.getByTestId("stack-add").click();
  const box = (await stage.getByTestId("stack-pile").boundingBox())!;
  await stage.getByTestId("stack-pile").click({ position: { x: box.width * 0.9, y: box.height * 0.25 } });
  expect(await valueOf(page)).toBe(min + 8);
  await stage.getByTestId("stack-pile").click({ position: { x: box.width * 0.05, y: box.height * 0.9 } });
  expect(await valueOf(page)).toBe(min + 7);
});
