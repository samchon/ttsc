package linthost

import "testing"

// TestRuleCorpusPlaywrightNoNthMethods verifies the lint rule corpus fixture playwright/no-nth-methods.ts.
//
// Positional locator methods couple tests to document order. This pins the
// final-method check for nth locator calls.
//
// 1. Load a locator.nth call.
// 2. Enable playwright/no-nth-methods from the annotated expect comment.
// 3. Assert the positional locator method is reported.
func TestRuleCorpusPlaywrightNoNthMethods(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-nth-methods.ts", `import { test } from "@playwright/test";

test("uses position", async ({ page }) => {
  // expect: playwright/no-nth-methods error
  page.getByRole("button").nth(0);
});
`)
}
