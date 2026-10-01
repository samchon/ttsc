declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

// expect: playwright/expect-expect error
test("loads page", async ({ page }) => {
  await page.goto("/");
});
