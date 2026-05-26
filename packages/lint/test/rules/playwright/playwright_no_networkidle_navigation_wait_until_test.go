package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNetworkidleNavigationWaitUntil verifies the lint rule corpus fixture playwright/no-networkidle-navigation-wait-until.ts.
//
// Navigation APIs accept waitUntil options in method-specific argument slots.
// This pins the narrowed branch so page.goto still reports networkidle while
// unrelated option objects are ignored.
//
// 1. Load a page.goto call with waitUntil set to networkidle.
// 2. Enable playwright/no-networkidle from the annotated expect comment.
// 3. Assert the networkidle literal is reported.
func TestRuleCorpusPlaywrightNoNetworkidleNavigationWaitUntil(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-networkidle-navigation-wait-until.ts", `import { test } from "@playwright/test";

test("navigates", async ({ page }) => {
  // expect: playwright/no-networkidle error
  await page.goto("/", { waitUntil: "networkidle" });
});
`)
}
