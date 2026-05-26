package linthost

import "testing"

// TestRuleCorpusPlaywrightPreferWebFirstAssertions verifies the lint rule corpus fixture playwright/prefer-web-first-assertions.ts.
//
// Awaiting locator state before a generic matcher loses Playwright's built-in
// retry loop. This pins the high-confidence `expect(await locator.isVisible())`
// pattern.
//
// 1. Load a Playwright assertion over an awaited locator state call.
// 2. Enable playwright/prefer-web-first-assertions from the annotated expect comment.
// 3. Assert the generic matcher call is reported.
func TestRuleCorpusPlaywrightPreferWebFirstAssertions(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-prefer-web-first-assertions.ts", `import { test, expect } from "@playwright/test";

test("checks visibility", async ({ page }) => {
  const submit = page.getByRole("button");
  // expect: playwright/prefer-web-first-assertions error
  expect(await submit.isVisible()).toBe(true);
});
`)
}
