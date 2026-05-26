package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferToHaveLength verifies the lint rule corpus fixture playwright/prefer-to-have-length.ts.
//
// Length assertions should use the dedicated web-first matcher where possible.
// This pins the existing awaited length() matcher branch.
//
// 1. Load an expect(await collection.length()).toBe(...) assertion.
// 2. Enable playwright/prefer-to-have-length from the annotated expect comment.
// 3. Assert the matcher call is reported.
func TestRuleCorpusPlaywrightPreferToHaveLength(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-to-have-length.ts", `import { test, expect } from "@playwright/test";

test("checks length", async ({ page }) => {
  const collection = page.locator("li");
  // expect: playwright/prefer-to-have-length error
  expect(await collection.length()).toBe(2);
});
`)
}
