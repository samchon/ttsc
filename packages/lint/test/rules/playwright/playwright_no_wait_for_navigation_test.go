package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForNavigation verifies the lint rule corpus fixture playwright/no-wait-for-navigation.ts.
//
// waitForNavigation is racy compared with URL or web-first waits. This pins the
// page.waitForNavigation call matcher.
//
// 1. Load a Playwright test that waits for navigation.
// 2. Enable playwright/no-wait-for-navigation from the annotated expect comment.
// 3. Assert page.waitForNavigation is reported.
func TestRuleCorpusPlaywrightNoWaitForNavigation(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-navigation.ts", `import { test } from "@playwright/test";

test("waits for navigation", async ({ page }) => {
  // expect: playwright/no-wait-for-navigation error
  await page.waitForNavigation();
});
`)
}
