declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("branches", async ({ page }) => {
  const ready = await page.isVisible("main");
  // expect: playwright/no-conditional-in-test error
  if (ready) {
    await page.click("button");
  }
});
