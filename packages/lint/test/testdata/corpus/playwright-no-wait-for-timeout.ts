declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("waits explicitly", async ({ page }) => {
  // expect: playwright/no-wait-for-timeout error
  await page.waitForTimeout(1000);
});
