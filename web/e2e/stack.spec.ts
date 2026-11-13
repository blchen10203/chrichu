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
