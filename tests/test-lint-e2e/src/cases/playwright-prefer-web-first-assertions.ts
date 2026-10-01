declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("checks visibility", async ({ page }) => {
  const submit = page.getByRole("button");
  // expect: playwright/prefer-web-first-assertions error
  expect(await submit.isVisible()).toBe(true);
});
