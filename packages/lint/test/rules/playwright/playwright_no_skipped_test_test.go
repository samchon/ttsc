package linthost

import "testing"

// TestRuleCorpusPlaywrightNoSkippedTest verifies the lint rule corpus fixture playwright/no-skipped-test.ts.
//
// Skipped tests can leave missing coverage unnoticed. This pins the call-chain
// recognizer for `test.skip` and `test.describe.skip` shapes.
//
// 1. Load a Playwright test declared with test.skip.
// 2. Enable playwright/no-skipped-test from the annotated expect comment.
// 3. Assert the skipped test call is reported.
func TestRuleCorpusPlaywrightNoSkippedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-skipped-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-skipped-test error
test.skip("skips one case", async ({ page }) => {
  await page.goto("/");
});
`)
}
