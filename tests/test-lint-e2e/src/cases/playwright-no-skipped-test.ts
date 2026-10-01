declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

// expect: playwright/no-skipped-test error
test.skip("skips one case", async ({ page }) => {
  await page.goto("/");
});
