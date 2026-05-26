package linthost

import "testing"

// TestRuleCorpusPlaywrightNoFocusedTest verifies the lint rule corpus fixture playwright/no-focused-test.ts.
//
// Focused tests silently exclude the rest of the suite in CI. This pins the
// call-chain recognizer for `test.only` and `test.describe.only` shapes.
//
// 1. Load a Playwright test declared with test.only.
// 2. Enable playwright/no-focused-test from the annotated expect comment.
// 3. Assert the focused test call is reported.
func TestRuleCorpusPlaywrightNoFocusedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-focused-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-focused-test error
test.only("focuses one case", async ({ page }) => {
  await page.goto("/");
});
`)
}
