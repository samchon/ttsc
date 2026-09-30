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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies page.$eval is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-eval diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases A locator lookup does not evaluate browser code. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoEval is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoEval(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-eval.ts", `import { test } from "@playwright/test";

test("evaluates selector", async ({ page }) => {
  // expect: playwright/no-eval error
  await page.$eval("button", (button) => button.textContent);
});
`)
  assertRuleSkipsSource(t, "playwright/no-eval", "import { test } from \"@playwright/test\"; test(\"locator\", ({ page }) => { page.getByRole(\"button\"); });\n")
}
