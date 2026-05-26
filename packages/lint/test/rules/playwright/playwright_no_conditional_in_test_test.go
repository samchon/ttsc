package linthost

import "testing"

// TestRuleCorpusPlaywrightNoConditionalInTest verifies the lint rule corpus fixture playwright/no-conditional-in-test.ts.
//
// Branching inside a test can hide untested paths. This pins the ancestor walk
// that reports conditional statements while they are still inside the nearest
// Playwright test-like callback.
//
// 1. Load a Playwright test containing an if statement.
// 2. Enable playwright/no-conditional-in-test from the annotated expect comment.
// 3. Assert the conditional statement is reported.
func TestRuleCorpusPlaywrightNoConditionalInTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-conditional-in-test.ts", `import { test } from "@playwright/test";

test("branches", async ({ page }) => {
  const ready = await page.isVisible("main");
  // expect: playwright/no-conditional-in-test error
  if (ready) {
    await page.click("button");
  }
});
`)
}
