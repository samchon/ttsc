package linthost

import "testing"

// TestRuleCorpusPlaywrightNoPagePause verifies the lint rule corpus fixture playwright/no-page-pause.ts.
//
// page.pause() is a debugging helper that should not remain in committed test
// sources. This pins the direct page.pause call-chain path.
//
// 1. Load a Playwright test that calls page.pause().
// 2. Enable playwright/no-page-pause from the annotated expect comment.
// 3. Assert the pause call is reported.
func TestRuleCorpusPlaywrightNoPagePause(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-page-pause.ts", `import { test } from "@playwright/test";

test("debugs page", async ({ page }) => {
  // expect: playwright/no-page-pause error
  await page.pause();
});
`)
}
