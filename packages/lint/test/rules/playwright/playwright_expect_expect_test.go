package linthost

import "testing"

// TestRuleCorpusPlaywrightExpectExpect verifies the lint rule corpus fixture playwright/expect-expect.ts.
//
// Playwright tests without assertions can pass without checking the page state.
// This pins the SourceFile-level scan that finds a test callback and verifies it
// contains an expect call before the callback returns.
//
// 1. Load a Playwright test body with no assertion.
// 2. Enable playwright/expect-expect from the annotated expect comment.
// 3. Assert the native Engine reports the unasserted test call.
func TestRuleCorpusPlaywrightExpectExpect(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-expect-expect.ts", `import { test } from "@playwright/test";

// expect: playwright/expect-expect error
test("loads page", async ({ page }) => {
  await page.goto("/");
});
`)
}
