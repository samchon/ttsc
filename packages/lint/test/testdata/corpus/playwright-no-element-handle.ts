declare const test: any;
declare const expect: any;
declare const page: any;
import { test } from "@playwright/test";

test("gets a handle", async ({ page }) => {
  // expect: playwright/no-element-handle error
  await page.$("button");
});
