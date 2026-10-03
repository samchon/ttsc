import { test } from "@playwright/test";

test("evaluates selector", async ({ page }) => {
  // expect: playwright/no-eval error
  await page.$eval("button", (button) => button.textContent);
});
