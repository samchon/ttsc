package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferLocator verifies the lint rule corpus fixture playwright/prefer-locator.ts.
//
// Page selector action APIs are weaker than locator-based actions. This pins
// the page method table used by prefer-locator.
//
// 1. Load a page.click selector action.
// 2. Enable playwright/prefer-locator from the annotated expect comment.
// 3. Assert the page action is reported.
func TestRuleCorpusPlaywrightPreferLocator(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-locator.ts", `import { test } from "@playwright/test";

test("clicks selector", async ({ page }) => {
  // expect: playwright/prefer-locator error
  await page.click("button");
});
`)
}
