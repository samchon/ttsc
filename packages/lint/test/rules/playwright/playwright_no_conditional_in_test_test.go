package linthost

import "testing"

// TestRuleCorpusPlaywrightNoConditionalInTest verifies the lint rule corpus fixture playwright/no-conditional-in-test.ts.
//
// Branching inside a test can hide untested paths. This pins the ancestor walk
// that reports conditional statements while they are still inside the nearest
// Playwright test-like callback.
//
// 1. Load a Playwright test containing an if statement.
// 2. Enable playwright/no-conditional-in-test from the annotated expect comment.
// 3. Assert the conditional statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies an if statement inside a test callback is reported; exact rule, severity and source-line comparison rejects missing or extra findings.
// @evidence contracts/testing.md#independent-expectations The authored expect annotation expresses the supported playwright/no-conditional-in-test diagnostic policy for the literal fixture; the accepted control is independently written and must produce zero findings, not a snapshot generated from the rule.
// @evidence contracts/testing.md#distinguishing-cases Straight-line statements inside the callback do not create a conditional path. The original reported fixture and the accepted control both execute in this case.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPlaywrightNoConditionalInTest is a discoverable Go unit entry; virtual TypeScript ASTs run through the owning lint engine in the shared Go process without a browser, installed consumer or product child host.
func TestRuleCorpusPlaywrightNoConditionalInTest(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-no-conditional-in-test.ts", `import { test } from "@playwright/test";

test("branches", async ({ page }) => {
  const ready = await page.isVisible("main");
  // expect: playwright/no-conditional-in-test error
  if (ready) {
    await page.click("button");
  }
});
`)
  assertRuleSkipsSource(t, "playwright/no-conditional-in-test", "import { test } from \"@playwright/test\"; test(\"straight\", async ({ page }) => { await page.click(\"button\"); });\n")
}
