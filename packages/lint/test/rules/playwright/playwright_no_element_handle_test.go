package linthost

import "testing"

// TestRuleCorpusPlaywrightNoElementHandle verifies the lint rule corpus fixture playwright/no-element-handle.ts.
//
// ElementHandle APIs are discouraged because locators retry and stay closer to
// user-facing behavior. This pins the page.$ call shape covered by the rule.
//
// 1. Load a Playwright test that reads an ElementHandle with page.$.
// 2. Enable playwright/no-element-handle from the annotated expect comment.
// 3. Assert the ElementHandle helper call is reported.
func TestRuleCorpusPlaywrightNoElementHandle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-element-handle.ts", `import { test } from "@playwright/test";

test("gets a handle", async ({ page }) => {
  // expect: playwright/no-element-handle error
  await page.$("button");
});
`)
}
