declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("evaluates against element", async ({ page }) => {
  // expect: playwright/no-eval error
  await page.$eval("#root", (el) => el.textContent);
});
