declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("waits for selector", async ({ page }) => {
  // expect: playwright/no-wait-for-selector error
  await page.waitForSelector("button");
});
