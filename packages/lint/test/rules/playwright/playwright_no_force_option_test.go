package linthost

import "testing"

// TestRuleCorpusPlaywrightNoForceOption verifies the lint rule corpus fixture playwright/no-force-option.ts.
//
// The force option bypasses Playwright actionability checks and makes tests less
// representative of user behavior. This pins detection of object options with
// `force: true`.
//
// 1. Load a locator action with the force option enabled.
// 2. Enable playwright/no-force-option from the annotated expect comment.
// 3. Assert the force property is reported.
func TestRuleCorpusPlaywrightNoForceOption(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-force-option.ts", `import { test } from "@playwright/test";

test("forces click", async ({ page }) => {
  // expect: playwright/no-force-option error
  await page.getByRole("button").click({ force: true });
});
`)
}
