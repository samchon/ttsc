declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("waits for navigation", async ({ page }) => {
  // expect: playwright/no-wait-for-navigation error
  await page.waitForNavigation();
});
