package linthost

import "testing"

// TestRuleCorpusPlaywrightNoFocusedTest verifies the lint rule corpus fixture playwright/no-focused-test.ts.
//
// Focused tests silently exclude the rest of the suite in CI. This pins the
// call-chain recognizer for `test.only` and `test.describe.only` shapes.
//
// 1. Load a Playwright test declared with test.only.
// 2. Enable playwright/no-focused-test from the annotated expect comment.
// 3. Assert the focused test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies test.only is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-focused-test diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An ordinary test call does not exclude sibling cases. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoFocusedTest is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoFocusedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-focused-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-focused-test error
test.only("focuses one case", async ({ page }) => {
  await page.goto("/");
});
`)
  assertRuleSkipsSource(t, "playwright/no-focused-test", "import { test } from \"@playwright/test\"; test(\"ordinary\", () => {});\n")
}
