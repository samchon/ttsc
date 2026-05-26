package linthost

import "testing"

// TestRuleCorpusPlaywrightValidTitle verifies the lint rule corpus fixture playwright/valid-title.ts.
//
// Empty titles make reports hard to interpret. This pins the non-empty string
// validation for Playwright test titles.
//
// 1. Load a Playwright test with an empty title.
// 2. Enable playwright/valid-title from the annotated expect comment.
// 3. Assert the test call is reported.
func TestRuleCorpusPlaywrightValidTitle(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-valid-title.ts", `import { test } from "@playwright/test";

// expect: playwright/valid-title error
test("", async () => {});
`)
}
