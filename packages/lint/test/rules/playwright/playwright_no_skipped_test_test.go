package linthost

import "testing"

// TestRuleCorpusPlaywrightNoSkippedTest verifies the lint rule corpus fixture playwright/no-skipped-test.ts.
//
// Skipped tests can leave missing coverage unnoticed. This pins the call-chain
// recognizer for `test.skip` and `test.describe.skip` shapes.
//
// 1. Load a Playwright test declared with test.skip.
// 2. Enable playwright/no-skipped-test from the annotated expect comment.
// 3. Assert the skipped test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies test.skip is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-skipped-test diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases An ordinary test remains scheduled. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoSkippedTest is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoSkippedTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-skipped-test.ts", `import { test } from "@playwright/test";

// expect: playwright/no-skipped-test error
test.skip("skips one case", async ({ page }) => {
  await page.goto("/");
});
`)
  assertRuleSkipsSource(t, "playwright/no-skipped-test", "import { test } from \"@playwright/test\"; test(\"ordinary\", () => {});\n")
}
