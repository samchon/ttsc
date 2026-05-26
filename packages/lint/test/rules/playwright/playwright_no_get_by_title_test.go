package linthost

import "testing"

// TestRuleCorpusPlaywrightNoGetByTitle verifies the lint rule corpus fixture playwright/no-get-by-title.ts.
//
// Title attributes are not accessible names. This pins the simple call-chain
// detector for getByTitle so the rule stays registered and executable.
//
// 1. Load a Playwright locator lookup by title.
// 2. Enable playwright/no-get-by-title from the annotated expect comment.
// 3. Assert the getByTitle call is reported.
func TestRuleCorpusPlaywrightNoGetByTitle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-get-by-title.ts", `import { test } from "@playwright/test";

test("uses title", async ({ page }) => {
  // expect: playwright/no-get-by-title error
  page.getByTitle("Settings");
});
`)
}
