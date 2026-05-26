package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForTimeout verifies the lint rule corpus fixture playwright/no-wait-for-timeout.ts.
//
// Fixed timeouts make tests slow and flaky compared with locator assertions.
// This pins the direct page.waitForTimeout call-chain path.
//
// 1. Load a Playwright test that waits for a hard-coded timeout.
// 2. Enable playwright/no-wait-for-timeout from the annotated expect comment.
// 3. Assert the timeout call is reported.
func TestRuleCorpusPlaywrightNoWaitForTimeout(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-timeout.ts", `import { test } from "@playwright/test";

test("waits explicitly", async ({ page }) => {
  // expect: playwright/no-wait-for-timeout error
  await page.waitForTimeout(1000);
});
`)
}
