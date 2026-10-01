declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

// expect: playwright/no-focused-test error
test.only("focuses one case", async ({ page }) => {
  await page.goto("/");
});
