package linthost

import "testing"

// TestRuleCorpusPlaywrightNoConditionalExpect verifies the lint rule corpus fixture playwright/no-conditional-expect.ts.
//
// Conditional assertions hide coverage when the branch is not taken. This pins
// the ancestor walk from an expect call to an enclosing conditional inside a
// Playwright test body.
//
// 1. Load a Playwright test with an expect call under an if statement.
// 2. Enable playwright/no-conditional-expect from the annotated expect comment.
// 3. Assert the conditional expect call is reported.
func TestRuleCorpusPlaywrightNoConditionalExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-conditional-expect.ts", `import { test, expect } from "@playwright/test";

test("checks conditionally", async ({ page }) => {
  if (await page.isVisible("main")) {
    // expect: playwright/no-conditional-expect error
    expect(page.url()).toContain("home");
  }
});
`)
}
