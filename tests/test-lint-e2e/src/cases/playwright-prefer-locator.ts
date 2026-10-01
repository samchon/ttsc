declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("clicks selector", async ({ page }) => {
  // expect: playwright/prefer-locator error
  await page.click("button");
});
