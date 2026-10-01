declare const test: any;
declare const expect: any;
declare const page: any;
import { test, expect } from "@playwright/test";

test("checks conditionally", async ({ page }) => {
  if (await page.isVisible("main")) {
    // expect: playwright/no-conditional-expect error
    expect(page.url()).toContain("home");
  }
});
