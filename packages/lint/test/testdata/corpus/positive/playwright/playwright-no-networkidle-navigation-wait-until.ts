import { test } from "@playwright/test";

test("navigates", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.goto("/", { waitUntil: "networkidle" });
});
