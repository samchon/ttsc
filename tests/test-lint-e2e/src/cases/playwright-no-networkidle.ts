declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("waits for network", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.waitForLoadState("networkidle");
});
