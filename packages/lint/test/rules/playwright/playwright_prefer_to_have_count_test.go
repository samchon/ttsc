package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferToHaveCount verifies the lint rule corpus fixture playwright/prefer-to-have-count.ts.
//
// Web-first count assertions retry and produce clearer diagnostics. This pins
// the awaited count() matcher branch.
//
// 1. Load an expect(await locator.count()).toBe(...) assertion.
// 2. Enable playwright/prefer-to-have-count from the annotated expect comment.
// 3. Assert the matcher call is reported.
func TestRuleCorpusPlaywrightPreferToHaveCount(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-to-have-count.ts", `import { test, expect } from "@playwright/test";

test("counts", async ({ page }) => {
  // expect: playwright/prefer-to-have-count error
  expect(await page.locator("li").count()).toBe(2);
});
`)
}
