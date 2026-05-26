package linthost

import "testing"

// TestRuleCorpusPlaywrightNoWaitForSelector verifies the lint rule corpus fixture playwright/no-wait-for-selector.ts.
//
// Selector waits are less expressive than locators and web-first assertions.
// This pins the page.waitForSelector call matcher.
//
// 1. Load a Playwright test that waits for a selector.
// 2. Enable playwright/no-wait-for-selector from the annotated expect comment.
// 3. Assert page.waitForSelector is reported.
func TestRuleCorpusPlaywrightNoWaitForSelector(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-wait-for-selector.ts", `import { test } from "@playwright/test";

test("waits for selector", async ({ page }) => {
  // expect: playwright/no-wait-for-selector error
  await page.waitForSelector("button");
});
`)
}
