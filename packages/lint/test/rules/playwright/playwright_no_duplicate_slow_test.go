package linthost

import "testing"

// TestRuleCorpusPlaywrightNoDuplicateSlow verifies the lint rule corpus fixture playwright/no-duplicate-slow.ts.
//
// Repeating test.slow() is redundant and can mask copy-paste mistakes. This
// pins the callback-local counter that reports only the second slow marker.
//
// 1. Load a Playwright test callback with two test.slow() calls.
// 2. Enable playwright/no-duplicate-slow from the annotated expect comment.
// 3. Assert the duplicate slow marker is reported.
func TestRuleCorpusPlaywrightNoDuplicateSlow(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-duplicate-slow.ts", `import { test } from "@playwright/test";

test("marks slow twice", async () => {
  test.slow();
  // expect: playwright/no-duplicate-slow error
  test.slow();
});
`)
}
