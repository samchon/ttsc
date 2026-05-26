package linthost

import "testing"

// TestRuleCorpusPlaywrightNoEval verifies the lint rule corpus fixture playwright/no-eval.ts.
//
// Page eval helpers bypass locator semantics and can create brittle tests. This
// pins detection of the page.$eval helper branch.
//
// 1. Load a Playwright test that calls page.$eval.
// 2. Enable playwright/no-eval from the annotated expect comment.
// 3. Assert the eval helper is reported.
func TestRuleCorpusPlaywrightNoEval(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-eval.ts", `import { test } from "@playwright/test";

test("evaluates selector", async ({ page }) => {
  // expect: playwright/no-eval error
  await page.$eval("button", (button) => button.textContent);
});
`)
}
